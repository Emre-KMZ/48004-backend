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


from .models import Product, ProductImage, Category

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
    products = Product.objects.all()
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
