from django.contrib import admin
from django.http import JsonResponse
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from ministore import views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("backend-healthcheck/", views.backend_healthcheck, name="backend_healthcheck"),
    path("db-healthcheck/", views.db_healthcheck, name="db_healthcheck"),
    path("api/register/", views.register_customer, name="register_customer"),
    path("api/login/", views.login_user, name="login_user"),
    path("api/products/", views.list_products, name="list_products"),
    path("api/admin/products/<int:product_id>/image/", views.upload_product_image, name="upload_product_image"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

