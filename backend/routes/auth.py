"""
Authentication routes: signup, login, logout
"""
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from datetime import datetime
from bson import ObjectId
from typing import Optional

from auth.password import hash_password, verify_password
from auth.jwt_handler import create_access_token, verify_token
from database.connection import get_users_collection

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer()


# Pydantic models for request/response
class SignupRequest(BaseModel):
    username: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    user_id: str
    username: str
    email: str
    pinecone_namespace: str
    created_at: datetime


# Dependency to get current user from token
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Verify JWT token and return current user data
    """
    token = credentials.credentials
    payload = verify_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    return payload


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(request: SignupRequest):
    """
    Create a new user account
    
    - Validates unique username and email
    - Hashes password
    - Auto-generates Pinecone namespace
    - Returns JWT token
    """
    users = get_users_collection()
    
    # Check if username already exists
    if users.find_one({"username": request.username}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Check if email already exists
    if users.find_one({"email": request.email}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user document
    user_id = ObjectId()
    pinecone_namespace = f"user_{str(user_id)}"
    
    user_doc = {
        "_id": user_id,
        "username": request.username,
        "email": request.email,
        "password_hash": hash_password(request.password),
        "pinecone_namespace": pinecone_namespace,
        "created_at": datetime.utcnow(),
        "last_login": datetime.utcnow()
    }
    
    # Insert into database
    users.insert_one(user_doc)
    
    # Create JWT token
    token_data = {
        "user_id": str(user_id),
        "username": request.username,
        "namespace": pinecone_namespace
    }
    access_token = create_access_token(token_data)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "user_id": str(user_id),
            "username": request.username,
            "email": request.email,
            "namespace": pinecone_namespace
        }
    }


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """
    Login with username and password
    
    - Verifies credentials
    - Updates last_login timestamp
    - Returns JWT token
    """
    users = get_users_collection()
    
    # Find user by username
    user = users.find_one({"username": request.username})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # Verify password
    if not verify_password(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # Update last login
    users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login": datetime.utcnow()}}
    )
    
    # Create JWT token
    token_data = {
        "user_id": str(user["_id"]),
        "username": user["username"],
        "namespace": user["pinecone_namespace"]
    }
    access_token = create_access_token(token_data)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "user_id": str(user["_id"]),
            "username": user["username"],
            "email": user["email"],
            "namespace": user["pinecone_namespace"]
        }
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """
    Get current user information from token
    """
    users = get_users_collection()
    user = users.find_one({"_id": ObjectId(current_user["user_id"])})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {
        "user_id": str(user["_id"]),
        "username": user["username"],
        "email": user["email"],
        "pinecone_namespace": user["pinecone_namespace"],
        "created_at": user["created_at"]
    }


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Logout (client should discard token)
    """
    return {"message": "Logged out successfully"}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
async def change_password(request: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    """
    Change user password
    
    - Verifies current password
    - Updates password hash
    - Requires re-login after change
    """
    users = get_users_collection()
    user = users.find_one({"_id": ObjectId(current_user["user_id"])})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verify current password
    if not verify_password(request.current_password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Validate new password
    if len(request.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long"
        )
    
    # Update password
    new_password_hash = hash_password(request.new_password)
    users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": new_password_hash}}
    )
    
    return {"message": "Password changed successfully. Please log in again."}
