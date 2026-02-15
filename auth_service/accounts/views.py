from datetime import datetime, timedelta, UTC

import jwt
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.hashers import make_password, check_password
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status


def issue_token(user: User, provider: str) -> str:
    payload = {
        "sub": user.username,
        "email": user.email,
        "provider": provider,
        "exp": datetime.now(UTC) + timedelta(hours=12),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


@api_view(["POST"])
def register(request):
    username = request.data.get("username")
    password = request.data.get("password")
    email = request.data.get("email", "")
    provider = request.data.get("provider", "local")
    if not username or not password:
        return Response({"detail": "username and password are required"}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username=username).exists():
        return Response({"detail": "already exists"}, status=status.HTTP_409_CONFLICT)
    user = User.objects.create(username=username, password=make_password(password), email=email)
    return Response({"access_token": issue_token(user, provider), "username": username, "provider": provider})


@api_view(["POST"])
def login(request):
    username = request.data.get("username")
    password = request.data.get("password")
    provider = request.data.get("provider", "local")
    user = User.objects.filter(username=username).first()
    if user is None or not check_password(password, user.password):
        return Response({"detail": "invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
    return Response({"access_token": issue_token(user, provider), "username": user.username, "provider": provider})
