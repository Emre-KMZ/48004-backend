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


from django.db.models import Q
from .models import Product, ProductImage, Category, Cart, CartItem

# ----------------------------
# CATEGORY APIS
# ----------------------------
@csrf_exempt
def list_categories(request):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    cats = [{"id": c.id, "name": c.name, "description": c.description} for c in Category.objects.all()]
    return JsonResponse({"categories": cats}, status=200)

@csrf_exempt
def admin_add_category(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    try:
        data = json.loads(request.body)
        c = Category.objects.create(name=data['name'], description=data.get('description', ''))
        return JsonResponse({"id": c.id, "name": c.name, "description": c.description}, status=201)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
def admin_delete_category(request, category_id):
    if request.method != "DELETE":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    try:
        Category.objects.get(pk=category_id).delete()
        return JsonResponse({"message": "Category deleted"}, status=200)
    except Category.DoesNotExist:
        return JsonResponse({"error": "Category not found"}, status=404)

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
                "category_id": p.category.id if p.category else None,
                "images": [{"id": img.id, "url": img.image.url} for img in p.images.all()]
            }
            return JsonResponse(data, status=200)
        except Product.DoesNotExist:
            return JsonResponse({"error": "Not Found"}, status=404)

    elif request.method == "PUT":
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
            else:
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
            "category_name": p.category.name if p.category else None,
            "images": [{"id": img.id, "url": img.image.url} for img in p.images.all()]
        }
        return JsonResponse(data, status=200)
    except Product.DoesNotExist:
        return JsonResponse({"error": "Not Found"}, status=404)

@csrf_exempt
def cart_ops(request):
    if not hasattr(request, 'jwt_payload'): return JsonResponse({"error": "Unauthorized. Must be logged in."}, status=401)
    try:
        user = CustomUser.objects.get(id=request.jwt_payload['id'])
    except CustomUser.DoesNotExist:
        return JsonResponse({"error": "Unauthorized. Security exception."}, status=401)
    cart, _ = Cart.objects.get_or_create(user=user)

    if request.method == "GET":
        items = []
        for i in cart.items.all():
            items.append({
                "id": i.id,
                "product_id": i.product.id,
                "name": i.product.name,
                "price": str(i.product.price),
                "quantity": i.quantity,
                "image_url": i.product.images.first().image.url if i.product.images.exists() else None
            })
        return JsonResponse({"cart_id": cart.id, "items": items, "total": str(cart.total_price)}, status=200)

    elif request.method == "DELETE":
        cart.items.all().delete()
        return JsonResponse({"message": "Cart cleared"}, status=200)

    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            product_id = data.get('product_id')
            qty = int(data.get('quantity', 1))
            prod = Product.objects.get(pk=product_id)
            item, created = CartItem.objects.get_or_create(cart=cart, product=prod)
            if not created:
                item.quantity += qty
            else:
                item.quantity = qty
            item.save()
            return JsonResponse({"message": "Added to cart"}, status=200)
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
                db_item, created = CartItem.objects.get_or_create(cart=cart, product=prod)
                if not created:
                    db_item.quantity += qty
                else:
                    db_item.quantity = qty
                db_item.save()
            except Product.DoesNotExist:
                continue
                
        return JsonResponse({"message": "Cart synchronized successfully"}, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# User Order History API
# Returns only the authenticated user's past orders
# Sorted by newest first

from .models import Order, CustomUser
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


from django.db import transaction
from .models import Order, OrderItem

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
            order = Order.objects.create(
                user=user,
                total_price=cart.total_price,
                shipping_address=shipping_address,
                contact_name=contact_name,
                contact_email=contact_email,
                contact_phone=contact_phone,
                status=Order.Status.PENDING,
            )
            for item in cart.items.select_related('product'):
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
            item.quantity = qty
            item.save()
            return JsonResponse({"message": "Quantity updated"}, status=200)
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

    end_date = timezone.now()
    start_date = end_date - timedelta(days=range_days)

    if period == "weekly":
        trunc_func = TruncWeek
    else:
        trunc_func = TruncDay

    revenue_data = (
        Order.objects
        .filter(
            status__in=SUCCESSFUL_ORDER_STATUSES,
            created_at__gte=start_date,
            created_at__lte=end_date
        )
        .annotate(date=trunc_func("created_at"))
        .values("date")
        .annotate(total_revenue=Sum("total_price"))
        .order_by("date")
    )

    orders_data = (
        Order.objects
        .filter(created_at__gte=start_date, created_at__lte=end_date)
        .annotate(date=trunc_func("created_at"))
        .values("date")
        .annotate(order_count=Count("id"))
        .order_by("date")
    )

    customers_data = (
        CustomUser.objects
        .filter(
            role="Customer",
            is_staff=False,
            is_superuser=False,
            date_joined__gte=start_date,
            date_joined__lte=end_date
        )
        .annotate(date=trunc_func("date_joined"))
        .values("date")
        .annotate(customer_count=Count("id"))
        .order_by("date")
    )

    return JsonResponse({
        "revenue_trend": [
            {
                "date": item["date"].date().isoformat(),
                "total_revenue": str(item["total_revenue"])
            }
            for item in revenue_data
        ],
        "orders_trend": [
            {
                "date": item["date"].date().isoformat(),
                "order_count": item["order_count"]
            }
            for item in orders_data
        ],
        "customer_acquisition_trend": [
            {
                "date": item["date"].date().isoformat(),
                "customer_count": item["customer_count"]
            }
            for item in customers_data
        ],
    }, status=200)


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