from django.contrib import admin
from django.http import JsonResponse
from django.urls import path
from ministore import views


urlpatterns = [
    path("admin/", admin.site.urls),
    path("backend-healthcheck/", views.backend_healthcheck, name="backend_healthcheck"),
    path("db-healthcheck/", views.db_healthcheck, name="db_healthcheck"),
]

