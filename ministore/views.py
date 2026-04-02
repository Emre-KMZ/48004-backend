from django.http import JsonResponse
from .models import StoreStatus

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
