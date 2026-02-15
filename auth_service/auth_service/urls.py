from django.contrib import admin
from django.urls import path

from accounts.views import register, login

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/register", register),
    path("api/login", login),
]
