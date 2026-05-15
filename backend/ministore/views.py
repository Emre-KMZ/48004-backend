import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import StoreStatus, CustomUser

def backend_healthcheck(request):
    return JsonResponse({"status": "healthy"})

def db_healthcheck(request):
    try:
        # Check if table exists and has data
        status_obj = StoreStatus.objects.first()
        if not status_obj:
            # Auto-populate a dummy record if empty
            status_obj = StoreStatus.objects.create(store_name="MiniStore", is_online=True)
            
        return JsonResponse({
            "status": "healthy",
            "data": {
                "store_name": status_obj.store_name,
                "is_online": status_obj.is_online
            }
        })
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)

import re

@csrf_exempt
def register_customer(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    
    try:
        data = json.loads(request.body)
        email = data.get("email", "").strip()
        full_name = data.get("full_name", "").strip()
        password = data.get("password", "")
        
        # Constraint: Missing fields
        if not email or not full_name or not password:
            return JsonResponse({"error": "Please provide full name, email, and password."}, status=400)
            
        # Email Validation regex fallback
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            return JsonResponse({"error": "Invalid email formatting."}, status=400)
            
        # Password Complexity Validation
        if len(password) <= 5 or not re.search(r"[A-Z]", password) or not re.search(r"[a-z]", password) or not re.search(r"\d", password):
            return JsonResponse({"error": "Password does not meet complexity requirements."}, status=400)

        # Requirement 3: Check email uniqueness
        if CustomUser.objects.filter(email=email).exists():
            return JsonResponse({"error": "This email is already registered."}, status=400)
            
        # Constraint 2 & Requirement 4: Explicitly force role to "Customer", ignoring payload
        user = CustomUser.objects.create_user(
            email=email,
            password=password,
            full_name=full_name,
            role="Customer"
        )
        
        return JsonResponse({"message": "Registration successful"}, status=201)
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid request body format."}, status=400)


import jwt
from datetime import datetime, timedelta
from django.conf import settings

@csrf_exempt
def login_user(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
        
    try:
        data = json.loads(request.body)
        email = data.get("email", "").strip()
        password = data.get("password", "")

        user = CustomUser.objects.filter(email=email).first()
        
        # Constraint 1: Generic failure response (prevent enumeration)
        if not user or not user.check_password(password):
            return JsonResponse({"error": "Invalid email or password"}, status=400)

        # Requirement 3 & 4 & Constraint 4: Produce 2-hour JWT Payload
        payload = {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "exp": datetime.utcnow() + timedelta(hours=2)
        }
        
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
        
        return JsonResponse({
            "token": token,
            "role": user.role,
            "email": user.email
        }, status=200)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid request body format."}, status=400)


from django.db.models import Q, Count, F, Avg
from .models import Product, ProductImage, Category, Cart, CartItem, Order, OrderItem, ProductChangeLog
from django.db import transaction


INVENTORY_CHANGED_ERROR = "Inventory changed: Some items in your cart are no longer available."


def serialize_cart_item(item):
    product = item.product
    return {
        "id": item.id,
        "product_id": product.id,
        "name": product.name,
        "price": str(product.price),
        "quantity": item.quantity,
        "stock": product.stock,
        "is_available": product.is_available,
        "is_out_of_stock": product.stock == 0,
        "exceeds_stock": item.quantity > product.stock,
        "image_url": product.images.first().image.url if product.images.exists() else None,
    }


def build_stock_validation_result(requested_items):
    product_map = {
        p.id: p for p in Product.objects.filter(id__in=[item["product_id"] for item in requested_items])
    }
    details = []
    is_valid = True

    for requested in requested_items:
        product_id = requested["product_id"]
        requested_qty = requested["quantity"]
        product = product_map.get(product_id)

        if not product:
            is_valid = False
            details.append({
                "product_id": product_id,
                "requested_quantity": requested_qty,
                "available_quantity": 0,
                "is_available": False,
                "valid": False,
                "reason": "Product not found",
            })
            continue

        valid = requested_qty <= product.stock
        if not valid:
            is_valid = False

        details.append({
            "product_id": product.id,
            "product_name": product.name,
            "requested_quantity": requested_qty,
            "available_quantity": product.stock,
            "is_available": product.is_available,
            "valid": valid,
            "reason": None if valid else "Insufficient stock",
        })

    return {"valid": is_valid, "details": details}

# ----------------------------
# CATEGORY APIS
# ----------------------------
@csrf_exempt
def list_categories(request):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    cats = Category.objects.annotate(product_count=Count('products'))
    result = []
    for c in cats:
        result.append({
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "slug": c.slug,
            "image_url": c.image.url if c.image else None,
            "count": c.product_count,
        })
    return JsonResponse({"categories": result}, status=200)

@csrf_exempt
def admin_add_category(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    try:
        if request.content_type == 'application/json':
            data = json.loads(request.body)
            name = data.get('name', '')
            description = data.get('description', '')
        else:
            name = request.POST.get('name', '')
            description = request.POST.get('description', '')
        if not name:
            return JsonResponse({"error": "Category name is required"}, status=400)
        c = Category(name=name, description=description)
        if 'image' in request.FILES:
            img = request.FILES['image']
            if img.size > 6*1024*1024:
                return JsonResponse({"error": "Image exceeds 6MB limit"}, status=400)
            c.image = img
        c.save()
        return JsonResponse({"id": c.id, "name": c.name, "description": c.description, "image_url": c.image.url if c.image else None}, status=201)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
def admin_delete_category(request, category_id):
    try:
        cat = Category.objects.get(pk=category_id)
    except Category.DoesNotExist:
        return JsonResponse({"error": "Category not found"}, status=404)

    if request.method == "DELETE":
        cat.delete()
        return JsonResponse({"message": "Category deleted"}, status=200)

    elif request.method == "PUT" or request.method == "POST":
        if request.content_type == 'application/json':
            data = json.loads(request.body)
            name = data.get('name', cat.name)
            description = data.get('description', cat.description)
        else:
            name = request.POST.get('name', cat.name)
            description = request.POST.get('description', cat.description)
        cat.name = name
        cat.description = description
        if 'image' in request.FILES:
            img = request.FILES['image']
            if img.size > 6*1024*1024:
                return JsonResponse({"error": "Image exceeds 6MB limit"}, status=400)
            cat.image = img
        cat.save()
        return JsonResponse({"id": cat.id, "name": cat.name, "description": cat.description, "image_url": cat.image.url if cat.image else None}, status=200)

    return JsonResponse({"error": "Method not allowed"}, status=405)

# ----------------------------
# PRODUCT APIS (CRUD)
# ----------------------------
@csrf_exempt
def list_products(request):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
        
    q_search = request.GET.get("search", "").strip()
    q_category = request.GET.get("category", "").strip()

    products = Product.objects.all()
    if q_search:
        products = products.filter(Q(name__icontains=q_search) | Q(keywords__icontains=q_search) | Q(description__icontains=q_search))
    if q_category:
        products = products.filter(category__name__iexact=q_category)

    serialized = []
    for p in products:
        serialized.append({
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "keywords": p.keywords,
            "price": str(p.price),
            "stock": p.stock,
            "is_available": p.is_available,
            "category_id": p.category.id if p.category else None,
            "category_name": p.category.name if p.category else None,
            "images": [{"id": img.id, "url": img.image.url} for img in p.images.all()],
            "is_active": p.is_active
        })
    return JsonResponse({"products": serialized}, status=200)

@csrf_exempt
def product_details(request, product_id):
    if request.method == "GET":
        try:
            p = Product.objects.get(pk=product_id)
            data = {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "keywords": p.keywords,
                "price": str(p.price),
                "stock": p.stock,
                "is_available": p.is_available,
                "category_id": p.category.id if p.category else None,
                "images": [{"id": img.id, "url": img.image.url} for img in p.images.all()]
            }
            return JsonResponse(data, status=200)
        except Product.DoesNotExist:
            return JsonResponse({"error": "Not Found"}, status=404)

    elif request.method in ("PUT", "PATCH"):
        try:
            p = Product.objects.get(pk=product_id)
        except Product.DoesNotExist:
            return JsonResponse({"error": "Not Found"}, status=404)

        try:
            data = json.loads(request.body)
            price = float(data.get('price', p.price))
            stock = int(data.get('stock', p.stock))

            if price < 0.01: return JsonResponse({"error": "Price must be >= 0.01"}, status=400)
            if stock < 0: return JsonResponse({"error": "Stock cannot be negative"}, status=400)

            p.name = data.get('name', p.name)
            p.description = data.get('description', p.description)
            p.keywords = data.get('keywords', p.keywords)
            p.price = price
            p.stock = stock

            cat_id = data.get('category_id')
            if cat_id:
                try:
                    p.category = Category.objects.get(pk=cat_id)
                except Category.DoesNotExist:
                    return JsonResponse({"error": "Category not found"}, status=400)
            elif 'category_id' in data:
                p.category = None

            p.save()
            return JsonResponse({"message": "Updated Successfully"}, status=200)
        except ValueError:
            return JsonResponse({"error": "Invalid numerical constraint formatting"}, status=400)

    elif request.method == "DELETE":
        try:
            Product.objects.get(pk=product_id).delete()
            return JsonResponse({"message": "Product and associated images deleted"}, status=200)
        except Product.DoesNotExist:
            return JsonResponse({"error": "Not Found"}, status=404)

    return JsonResponse({"error": "Method not allowed"}, status=405)

@csrf_exempt
def admin_add_product(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
        
    try:
        name = request.POST.get('name', '')
        desc = request.POST.get('description', '')
        keys = request.POST.get('keywords', '')
        price = float(request.POST.get('price', 0))
        stock = int(request.POST.get('stock', 0))
        cat_id = request.POST.get('category_id')
        
        if price < 0.01: return JsonResponse({"error": "Price must be > 0"}, status=400)
        if stock < 0: return JsonResponse({"error": "Stock cannot be negative"}, status=400)
        
        cat = None
        if cat_id:
            try:
                cat = Category.objects.get(pk=cat_id)
            except Category.DoesNotExist:
                return JsonResponse({"error": "Invalid Category"}, status=400)
                
        p = Product.objects.create(
            name=name, description=desc, keywords=keys, price=price, stock=stock, category=cat
        )
        
        # Multi-image looping attachment logic matching Constraints
        for img in request.FILES.getlist('images'):
            if img.size > 6*1024*1024: continue
            if img.content_type not in ['image/jpeg', 'image/png', 'image/webp']: continue
            ProductImage.objects.create(product=p, image=img)
            
        return JsonResponse({"message": "Product Created", "id": p.id}, status=201)
        
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
def admin_product_images(request, product_id):
    if request.method != "POST": return JsonResponse({"error": "Method not allowed"}, status=405)
    try:
        p = Product.objects.get(pk=product_id)
        if 'image' not in request.FILES: return JsonResponse({"error": "No image attached"}, status=400)
        img = request.FILES['image']
        if img.size > 6*1024*1024: return JsonResponse({"error": "Exceeds 6MB limit"}, status=400)
        if img.content_type not in ['image/jpeg', 'image/png', 'image/webp']: return JsonResponse({"error": "Invalid format"}, status=400)
        
        pi = ProductImage.objects.create(product=p, image=img)
        return JsonResponse({"message": "Image Added", "id": pi.id, "url": pi.image.url}, status=201)
    except Product.DoesNotExist:
        return JsonResponse({"error": "Product Not Found"}, status=404)

@csrf_exempt
def admin_delete_image(request, img_id):
    if request.method != "DELETE": return JsonResponse({"error": "Method not allowed"}, status=405)
    try:
        ProductImage.objects.get(pk=img_id).delete()
        return JsonResponse({"message": "Image Deleted"}, status=200)
    except ProductImage.DoesNotExist:
        return JsonResponse({"error": "Image Not Found"}, status=404)

@csrf_exempt
def admin_reorder_images(request):
    if request.method != "PUT": return JsonResponse({"error": "Method not allowed"}, status=405)
    try:
        data = json.loads(request.body)
        image_ids = data.get('image_ids', [])
        for idx, img_id in enumerate(image_ids):
            try:
                img = ProductImage.objects.get(pk=img_id)
                img.order = idx
                img.save(update_fields=['order'])
            except ProductImage.DoesNotExist:
                continue
        return JsonResponse({"message": "Reordered Successfully"}, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
def public_product_details(request, product_id):
    if request.method != "GET": return JsonResponse({"error": "Method not allowed"}, status=405)
    try:
        p = Product.objects.get(pk=product_id)
        data = {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "keywords": p.keywords,
            "price": str(p.price),
            "stock": p.stock,
            "is_available": p.is_available,
            "category_name": p.category.name if p.category else None,
            "images": [{"id": img.id, "url": img.image.url} for img in p.images.all()]
        }
        return JsonResponse(data, status=200)
    except Product.DoesNotExist:
        return JsonResponse({"error": "Not Found"}, status=404)


@csrf_exempt
def product_stock(request, product_id):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    try:
        product = Product.objects.get(pk=product_id)
    except Product.DoesNotExist:
        return JsonResponse({"error": "Product not found"}, status=404)

    return JsonResponse(
        {
            "product_id": product.id,
            "stock_quantity": product.stock,
            "is_available": product.is_available,
        },
        status=200,
    )


@csrf_exempt
def validate_stock(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid request body"}, status=400)

    payload_items = data.get("items", [])
    if not isinstance(payload_items, list):
        return JsonResponse({"error": "items must be an array"}, status=400)

    requested_items = []
    for raw_item in payload_items:
        try:
            product_id = int(raw_item.get("product_id"))
            quantity = int(raw_item.get("quantity", 0))
        except (TypeError, ValueError):
            return JsonResponse({"error": "Each item must include numeric product_id and quantity"}, status=400)

        if quantity < 1:
            return JsonResponse({"error": "Quantity must be at least 1"}, status=400)

        requested_items.append({"product_id": product_id, "quantity": quantity})

    result = build_stock_validation_result(requested_items)
    return JsonResponse(result, status=200 if result["valid"] else 409)

@csrf_exempt
def cart_ops(request):
    if not hasattr(request, 'jwt_payload'): return JsonResponse({"error": "Unauthorized. Must be logged in."}, status=401)
    try:
        user = CustomUser.objects.get(id=request.jwt_payload['id'])
    except CustomUser.DoesNotExist:
        return JsonResponse({"error": "Unauthorized. Security exception."}, status=401)
    cart, _ = Cart.objects.get_or_create(user=user)

    if request.method == "GET":
        items = [serialize_cart_item(i) for i in cart.items.select_related("product")]
        return JsonResponse({"cart_id": cart.id, "items": items, "total": str(cart.total_price)}, status=200)

    elif request.method == "DELETE":
        cart.items.all().delete()
        return JsonResponse({"message": "Cart cleared"}, status=200)

    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            product_id = data.get('product_id')
            qty = int(data.get('quantity', 1))
            if qty < 1:
                return JsonResponse({"error": "Quantity must be at least 1"}, status=400)
            prod = Product.objects.get(pk=product_id)
            if prod.stock <= 0:
                return JsonResponse({"error": "Product is out of stock", "max_allowed": 0}, status=409)
            item, created = CartItem.objects.get_or_create(cart=cart, product=prod)
            requested_total = qty if created else item.quantity + qty
            adjusted_total = min(requested_total, prod.stock)
            item.quantity = adjusted_total
            item.save()
            adjusted = adjusted_total != requested_total
            return JsonResponse(
                {
                    "message": "Added to cart" if not adjusted else "Quantity adjusted to available stock",
                    "adjusted": adjusted,
                    "max_allowed": prod.stock,
                    "quantity": item.quantity,
                },
                status=200,
            )
        except Product.DoesNotExist:
            return JsonResponse({"error": "Product not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Method not allowed"}, status=405)

@csrf_exempt
def cart_sync(request):
    if request.method != "POST": return JsonResponse({"error": "Method not allowed"}, status=405)
    if not hasattr(request, 'jwt_payload'): return JsonResponse({"error": "Unauthorized"}, status=401)
    try:
        user = CustomUser.objects.get(id=request.jwt_payload['id'])
    except CustomUser.DoesNotExist:
        return JsonResponse({"error": "Unauthorized. Security exception."}, status=401)
    cart, _ = Cart.objects.get_or_create(user=user)
    
    try:
        data = json.loads(request.body)
        items = data.get('items', [])
        for local_item in items:
            try:
                prod = Product.objects.get(pk=local_item['product_id'])
                qty = int(local_item.get('quantity', 1))
                if qty < 1 or prod.stock <= 0:
                    continue
                db_item, created = CartItem.objects.get_or_create(cart=cart, product=prod)
                requested_total = qty if created else db_item.quantity + qty
                db_item.quantity = min(requested_total, prod.stock)
                db_item.save()
            except Product.DoesNotExist:
                continue
                
        return JsonResponse({"message": "Cart synchronized successfully"}, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# User Order History API
# Returns only the authenticated user's past orders
# Sorted by newest first

import jwt
from django.conf import settings

def get_authenticated_user(request):
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ")[1]

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return CustomUser.objects.get(id=payload["id"])
    except Exception:
        return None
    
@csrf_exempt
def user_order_history(request):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    user = get_authenticated_user(request)

    if not user:
        return JsonResponse({"error": "Unauthorized"}, status=401)

    orders = Order.objects.filter(user=user).order_by("-created_at")

    data = []
    for order in orders:
        data.append({
            "order_id": order.id,
            "created_at": order.created_at,
            "status": order.status,
            "total_price": str(order.total_price),
        })

    return JsonResponse({"orders": data}, status=200)


@csrf_exempt
def checkout(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    if not hasattr(request, 'jwt_payload'):
        return JsonResponse({"error": "Unauthorized"}, status=401)

    try:
        user = CustomUser.objects.get(id=request.jwt_payload['id'])
    except CustomUser.DoesNotExist:
        return JsonResponse({"error": "Unauthorized"}, status=401)

    try:
        data = json.loads(request.body)
        shipping_address = data.get('shipping_address', '').strip()
        contact_name = data.get('contact_name', '').strip()
        contact_email = data.get('contact_email', '').strip()
        contact_phone = data.get('contact_phone', '').strip()

        if not shipping_address:
            return JsonResponse({"error": "Shipping address is required"}, status=400)

        if not contact_name or not contact_email:
            return JsonResponse({"error": "Contact name and email are required"}, status=400)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid request body"}, status=400)

    cart = Cart.objects.filter(user=user).first()
    if not cart or not cart.items.exists():
        return JsonResponse({"error": "Your cart is empty"}, status=400)

    try:
        with transaction.atomic():
            cart_items = list(
                cart.items.select_related("product")
                .select_for_update()
                .order_by("id")
            )

            locked_products = {
                p.id: p
                for p in Product.objects.select_for_update()
                .filter(id__in=[item.product_id for item in cart_items])
            }

            shortages = []
            for item in cart_items:
                product = locked_products.get(item.product_id)
                if not product or item.quantity > product.stock:
                    shortages.append({
                        "product_id": item.product_id,
                        "product_name": item.product.name,
                        "requested_quantity": item.quantity,
                        "available_quantity": product.stock if product else 0,
                    })

            if shortages:
                return JsonResponse(
                    {"error": INVENTORY_CHANGED_ERROR, "shortages": shortages},
                    status=409,
                )

            order = Order.objects.create(
                user=user,
                total_price=cart.total_price,
                shipping_address=shipping_address,
                contact_name=contact_name,
                contact_email=contact_email,
                contact_phone=contact_phone,
                status=Order.Status.PENDING,
            )

            for item in cart_items:
                product = locked_products[item.product_id]
                product.stock = product.stock - item.quantity
                product.save(update_fields=["stock", "is_available"])

                OrderItem.objects.create(
                    order=order,
                    product=item.product,
                    product_name=item.product.name,
                    product_price=item.product.price,
                    quantity=item.quantity,
                )

            cart.items.all().delete()
        return JsonResponse({"order_id": order.id, "message": "Order placed successfully"}, status=201)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def cart_item_ops(request, item_id):
    if not hasattr(request, 'jwt_payload'):
        return JsonResponse({"error": "Unauthorized"}, status=401)
    try:
        user = CustomUser.objects.get(id=request.jwt_payload['id'])
    except CustomUser.DoesNotExist:
        return JsonResponse({"error": "Unauthorized"}, status=401)

    try:
        item = CartItem.objects.get(pk=item_id, cart__user=user)
    except CartItem.DoesNotExist:
        return JsonResponse({"error": "Item not found"}, status=404)

    if request.method == "PUT":
        try:
            data = json.loads(request.body)
            qty = int(data.get('quantity', 1))
            if qty < 1:
                return JsonResponse({"error": "Quantity must be at least 1"}, status=400)
            if item.product.stock <= 0:
                return JsonResponse({"error": "Product is out of stock", "max_allowed": 0}, status=409)
            adjusted_qty = min(qty, item.product.stock)
            item.quantity = adjusted_qty
            item.save()
            return JsonResponse(
                {
                    "message": "Quantity updated" if adjusted_qty == qty else "Quantity adjusted to available stock",
                    "adjusted": adjusted_qty != qty,
                    "max_allowed": item.product.stock,
                    "quantity": adjusted_qty,
                },
                status=200,
            )
        except (ValueError, json.JSONDecodeError):
            return JsonResponse({"error": "Invalid data"}, status=400)

    elif request.method == "DELETE":
        item.delete()
        return JsonResponse({"message": "Item removed"}, status=200)

    return JsonResponse({"error": "Method not allowed"}, status=405)

@csrf_exempt
def order_detail(request, order_id):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    user = get_authenticated_user(request)

    if not user:
        return JsonResponse({"error": "Unauthorized"}, status=401)

    try:
        # Ownership guard:
        # If the order does not belong to this user, return 404.
        order = Order.objects.prefetch_related("items").get(id=order_id, user=user)
    except Order.DoesNotExist:
        return JsonResponse({"error": "Order not found"}, status=404)

    items = []
    for item in order.items.all():
        items.append({
            "id": item.id,
            "product_id": item.product.id if item.product else None,
            "product_name": item.product_name,
            "price_at_purchase": str(item.product_price),
            "quantity": item.quantity,
            "line_total": str(item.line_total),
        })

    data = {
        "order_id": order.id,
        "created_at": order.created_at,
        "status": order.status,
        "total_price": str(order.total_price),

        # Historical snapshot saved on the order
        "shipping_address": order.shipping_address,
        "contact_name": order.contact_name,
        "contact_email": order.contact_email,
        "contact_phone": order.contact_phone,
        "items": items,
    }

    return JsonResponse(data, status=200)

from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum, Count
from django.db.models.functions import TruncDay, TruncMonth, TruncWeek
from decimal import Decimal


SUCCESSFUL_ORDER_STATUSES = [
    Order.Status.PROCESSING,
    Order.Status.SHIPPED,
    Order.Status.DELIVERED,
]


def is_admin_user(request):
    user = get_authenticated_user(request)

    if not user:
        return None

    if user.role == "Admin" or user.is_staff or user.is_superuser:
        return user

    return None


def parse_date_range(request):
    start_date = request.GET.get("start_date")
    end_date = request.GET.get("end_date")

    queryset_filter = {}

    if start_date:
        queryset_filter["created_at__date__gte"] = start_date

    if end_date:
        queryset_filter["created_at__date__lte"] = end_date

    return queryset_filter


@csrf_exempt
def admin_stats_summary(request):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    admin_user = is_admin_user(request)
    if not admin_user:
        return JsonResponse({"error": "Admin access required"}, status=403)

    date_filter = parse_date_range(request)

    successful_orders = Order.objects.filter(
        status__in=SUCCESSFUL_ORDER_STATUSES,
        **date_filter
    )

    all_orders = Order.objects.filter(**date_filter)

    total_revenue = successful_orders.aggregate(
        total=Sum("total_price")
    )["total"] or Decimal("0.00")

    total_orders = all_orders.count()

    total_customers = CustomUser.objects.filter(
        role="Customer",
        is_staff=False,
        is_superuser=False
    ).count()

    return JsonResponse({
        "total_revenue": str(total_revenue),
        "total_orders": total_orders,
        "total_customers": total_customers,
    }, status=200)

@csrf_exempt
def admin_stats_graph_data(request):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    admin_user = is_admin_user(request)
    if not admin_user:
        return JsonResponse({"error": "Admin access required"}, status=403)

    period = request.GET.get("period", "daily")
    range_days = int(request.GET.get("range", 30))

    end_date = timezone.now().date()
    start_date = end_date - timedelta(days=range_days)

    if period == "weekly":
        trunc_func = TruncWeek
    else:
        trunc_func = TruncDay

    revenue_rows = (
        Order.objects
        .filter(
            status__in=SUCCESSFUL_ORDER_STATUSES,
            created_at__date__gte=start_date,
            created_at__date__lte=end_date
        )
        .annotate(date=trunc_func("created_at"))
        .values("date")
        .annotate(revenue=Sum("total_price"))
        .order_by("date")
    )

    order_rows = (
        Order.objects
        .filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date
        )
        .annotate(date=trunc_func("created_at"))
        .values("date")
        .annotate(orders=Count("id"))
        .order_by("date")
    )

    revenue_map = {
        row["date"].date().isoformat(): row["revenue"] or Decimal("0.00")
        for row in revenue_rows
    }

    orders_map = {
        row["date"].date().isoformat(): row["orders"] or 0
        for row in order_rows
    }

    graph_data = []

    current_date = start_date
    while current_date <= end_date:
        date_key = current_date.isoformat()

        graph_data.append({
            "date": date_key,
            "revenue": float(revenue_map.get(date_key, Decimal("0.00"))),
            "orders": orders_map.get(date_key, 0),
        })

        if period == "weekly":
            current_date += timedelta(days=7)
        else:
            current_date += timedelta(days=1)

    return JsonResponse(graph_data, safe=False, status=200)
    
@csrf_exempt
def admin_stats_insights(request):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    admin_user = is_admin_user(request)
    if not admin_user:
        return JsonResponse({"error": "Admin access required"}, status=403)

    top_selling_products = (
        OrderItem.objects
        .filter(order__status__in=SUCCESSFUL_ORDER_STATUSES)
        .values("product_id", "product_name")
        .annotate(total_quantity=Sum("quantity"))
        .order_by("-total_quantity")[:5]
    )

    low_stock_products = Product.objects.filter(stock__lt=5).values(
        "id", "name", "stock"
    ).order_by("stock")

    return JsonResponse({
        "top_selling_products": list(top_selling_products),
        "low_stock_products": list(low_stock_products),
    }, status=200)

@csrf_exempt
def admin_order_status_update(request, order_id):
    if request.method != "PATCH":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    admin_user = is_admin_user(request)
    if not admin_user:
        return JsonResponse({"error": "Admin access required"}, status=403)

    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return JsonResponse({"error": "Order not found"}, status=404)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid request body"}, status=400)

    new_status = data.get("status")

    valid_statuses = [
        Order.Status.PENDING,
        Order.Status.PROCESSING,
        Order.Status.SHIPPED,
        Order.Status.DELIVERED,
        Order.Status.CANCELLED,
    ]

    allowed_transitions = {
        Order.Status.PENDING: [Order.Status.PROCESSING, Order.Status.CANCELLED],
        Order.Status.PROCESSING: [Order.Status.SHIPPED, Order.Status.CANCELLED],
        Order.Status.SHIPPED: [Order.Status.DELIVERED],
        Order.Status.DELIVERED: [],
        Order.Status.CANCELLED: [],
    }

    if new_status not in valid_statuses:
        return JsonResponse({"error": "Invalid status"}, status=400)

    current_status = order.status

    if new_status == current_status:
        return JsonResponse({
            "message": "Order already has this status",
            "order_id": order.id,
            "status": order.status,
        }, status=200)

    if new_status not in allowed_transitions.get(current_status, []):
        return JsonResponse({
            "error": f"Invalid status transition from {current_status} to {new_status}"
        }, status=400)

    old_status = order.status

    order.status = new_status
    order.save(update_fields=["status", "updated_at"])

    OrderStatusHistory.objects.create(
        order=order,
        changed_by=admin_user,
        old_status=old_status,
        new_status=new_status,
    )

    return JsonResponse({
        "message": "Order status updated successfully",
        "order_id": order.id,
        "status": order.status,
        "updated_at": order.updated_at,
    }, status=200)

@csrf_exempt
def admin_list_orders(request):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    
    orders = Order.objects.all().order_by("-created_at")
    result = []
    for o in orders:
        result.append({
            "id": o.id,
            "customer_name": o.contact_name or o.user.full_name or o.user.email,
            "total_price": str(o.total_price),
            "status": o.status,
            "created_at": o.created_at.isoformat(),
        })
    return JsonResponse(result, safe=False, status=200)

from django.core.cache import cache

@csrf_exempt
def verify_admin(request):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    ip = request.META.get("REMOTE_ADDR", "unknown")
    cache_key = f"verify_admin_attempts:{ip}"
    attempts = cache.get(cache_key, 0)

    if attempts >= 20:
        return JsonResponse({"error": "Too many requests"}, status=429)

    cache.set(cache_key, attempts + 1, timeout=60)

    user = get_authenticated_user(request)

    if not user:
        return JsonResponse({"error": "Unauthorized"}, status=401)

    if not (user.is_staff or user.is_superuser or user.role == "Admin"):
        return JsonResponse({"error": "Admin access required"}, status=403)

    return JsonResponse({
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
    }, status=200)


# ----------------------------
# QUICK UPDATES API (Inline Edit & Bulk)
# ----------------------------
@csrf_exempt
def admin_quick_update_product(request, product_id):
    if request.method != "PATCH":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    admin_user = is_admin_user(request)
    if not admin_user:
        return JsonResponse({"error": "Admin access required"}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid request body"}, status=400)

    field = data.get("field")
    value = data.get("value")

    if field not in ("price", "stock"):
        return JsonResponse({"error": "Only 'price' and 'stock' fields can be quick-updated"}, status=400)

    try:
        with transaction.atomic():
            product = Product.objects.select_for_update().get(pk=product_id)

            if field == "price":
                try:
                    new_price = float(value)
                except (TypeError, ValueError):
                    return JsonResponse({"error": "Invalid price format"}, status=400)
                if new_price < 0.01:
                    return JsonResponse({"error": "Price must be at least 0.01"}, status=400)

                old_price = str(product.price)
                product.price = new_price
                product.save(update_fields=["price", "updated_at"])

                ProductChangeLog.objects.create(
                    product=product,
                    field_changed="price",
                    old_value=old_price,
                    new_value=str(new_price),
                    changed_by=admin_user,
                    source="manual",
                )

                return JsonResponse({
                    "message": "Price updated",
                    "product_id": product.id,
                    "field": "price",
                    "new_value": str(product.price),
                }, status=200)

            elif field == "stock":
                try:
                    new_stock = int(value)
                except (TypeError, ValueError):
                    return JsonResponse({"error": "Invalid stock format"}, status=400)
                if new_stock < 0:
                    return JsonResponse({"error": "Stock cannot be negative"}, status=400)

                old_stock = str(product.stock)
                product.stock = new_stock
                product.save(update_fields=["stock", "is_available", "updated_at"])

                ProductChangeLog.objects.create(
                    product=product,
                    field_changed="stock",
                    old_value=old_stock,
                    new_value=str(new_stock),
                    changed_by=admin_user,
                    source="manual",
                )

                return JsonResponse({
                    "message": "Stock updated",
                    "product_id": product.id,
                    "field": "stock",
                    "new_value": product.stock,
                    "is_available": product.is_available,
                }, status=200)

    except Product.DoesNotExist:
        return JsonResponse({"error": "Product not found"}, status=404)


@csrf_exempt
def admin_bulk_update_products(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    admin_user = is_admin_user(request)
    if not admin_user:
        return JsonResponse({"error": "Admin access required"}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid request body"}, status=400)

    product_ids = data.get("product_ids", [])
    action = data.get("action")
    field = data.get("field")
    value = data.get("value")

    if not product_ids or not isinstance(product_ids, list):
        return JsonResponse({"error": "product_ids must be a non-empty array"}, status=400)
    if field not in ("price", "stock"):
        return JsonResponse({"error": "field must be 'price' or 'stock'"}, status=400)
    if action not in ("set", "increase_percent", "decrease_percent", "increase_fixed", "decrease_fixed", "add_units"):
        return JsonResponse({"error": "Invalid action"}, status=400)

    results = []
    errors = []

    try:
        with transaction.atomic():
            products = Product.objects.select_for_update().filter(id__in=product_ids)
            product_map = {p.id: p for p in products}

            for pid in product_ids:
                product = product_map.get(pid)
                if not product:
                    errors.append({"product_id": pid, "error": "Product not found"})
                    continue

                if field == "price":
                    old_val = float(product.price)
                    if action == "set":
                        new_val = float(value)
                    elif action == "increase_percent":
                        new_val = old_val * (1 + float(value) / 100)
                    elif action == "decrease_percent":
                        new_val = old_val * (1 - float(value) / 100)
                    elif action == "increase_fixed":
                        new_val = old_val + float(value)
                    elif action == "decrease_fixed":
                        new_val = old_val - float(value)
                    else:
                        errors.append({"product_id": pid, "error": "Invalid action for price"})
                        continue

                    new_val = round(new_val, 2)
                    if new_val < 0.01:
                        errors.append({"product_id": pid, "error": f"Resulting price {new_val} is below minimum 0.01"})
                        continue

                    product.price = new_val
                    product.save(update_fields=["price", "updated_at"])

                    ProductChangeLog.objects.create(
                        product=product,
                        field_changed="price",
                        old_value=str(old_val),
                        new_value=str(new_val),
                        changed_by=admin_user,
                        source="bulk",
                    )

                    results.append({
                        "product_id": product.id,
                        "field": "price",
                        "old_value": str(old_val),
                        "new_value": str(new_val),
                    })

                elif field == "stock":
                    old_val = product.stock
                    if action == "set":
                        new_val = int(value)
                    elif action == "add_units":
                        new_val = old_val + int(value)
                    elif action == "increase_percent":
                        new_val = int(old_val * (1 + float(value) / 100))
                    elif action == "decrease_percent":
                        new_val = int(old_val * (1 - float(value) / 100))
                    elif action == "increase_fixed":
                        new_val = old_val + int(value)
                    elif action == "decrease_fixed":
                        new_val = old_val - int(value)
                    else:
                        errors.append({"product_id": pid, "error": "Invalid action for stock"})
                        continue

                    if new_val < 0:
                        errors.append({"product_id": pid, "error": f"Resulting stock {new_val} would be negative"})
                        continue

                    product.stock = new_val
                    product.save(update_fields=["stock", "is_available", "updated_at"])

                    ProductChangeLog.objects.create(
                        product=product,
                        field_changed="stock",
                        old_value=str(old_val),
                        new_value=str(new_val),
                        changed_by=admin_user,
                        source="bulk",
                    )

                    results.append({
                        "product_id": product.id,
                        "field": "stock",
                        "old_value": old_val,
                        "new_value": new_val,
                        "is_available": product.is_available,
                    })

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({
        "message": f"Bulk update complete. {len(results)} succeeded, {len(errors)} failed.",
        "updated": results,
        "errors": errors,
    }, status=200)


@csrf_exempt
def admin_product_change_log(request):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    admin_user = is_admin_user(request)
    if not admin_user:
        return JsonResponse({"error": "Admin access required"}, status=403)

    product_id = request.GET.get("product_id")
    limit = int(request.GET.get("limit", 50))

    logs = ProductChangeLog.objects.select_related("product", "changed_by").all()
    if product_id:
        logs = logs.filter(product_id=product_id)

    logs = logs[:limit]

    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "product_id": log.product_id,
            "product_name": log.product.name,
            "field_changed": log.field_changed,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "changed_by": log.changed_by.email if log.changed_by else None,
            "changed_at": log.changed_at.isoformat(),
            "source": log.source,
        })

    return JsonResponse({"logs": result}, status=200)


@csrf_exempt
def admin_product_price_stats(request):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    admin_user = is_admin_user(request)
    if not admin_user:
        return JsonResponse({"error": "Admin access required"}, status=403)

    stats = Product.objects.aggregate(
        avg_price=Avg("price"),
    )

    return JsonResponse({
        "avg_price": str(stats["avg_price"] or 0),
    }, status=200)
