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
    
    # Public Lookups
    path("api/products/", views.list_products, name="list_products"),
    path("api/products/<int:product_id>/", views.public_product_details, name="public_product_details"),
    path("api/categories/", views.list_categories, name="list_categories"),
    
    # Authenticated Shopping APIs
    path("api/cart/", views.cart_ops, name="cart_ops"),
    path("api/cart/sync/", views.cart_sync, name="cart_sync"),
    
    # Protected Admin Routes
    path("api/admin/categories/", views.admin_add_category, name="admin_add_category"),
    path("api/admin/categories/<int:category_id>/", views.admin_delete_category, name="admin_delete_category"),
    
    path("api/admin/products/", views.admin_add_product, name="admin_add_product"),
    path("api/admin/products/<int:product_id>/", views.product_details, name="product_details"),
    path("api/admin/products/<int:product_id>/images/", views.admin_product_images, name="admin_product_images"),
    path("api/admin/product-images/<int:img_id>/", views.admin_delete_image, name="admin_delete_image"),
    path("api/admin/product-images/reorder/", views.admin_reorder_images, name="admin_reorder_images"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

