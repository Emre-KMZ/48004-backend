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
