from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta

from app.schemas.auth import UserCreate, UserLogin, User as UserSchema, Token, UserUpdate, ChangePassword
from app.db.session import get_db
from app.db.models import User as UserModel
from app.utils.auth import verify_password, get_password_hash, create_access_token
from app.dependencies.auth import get_current_user
from app.config import settings

router = APIRouter()

@router.post("/register", response_model=Token)
def register(user_create: UserCreate, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.email == user_create.email).first()
    if user:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = get_password_hash(user_create.password)
    new_user = UserModel(
        name=user_create.name,
        email=user_create.email,
        password_hash=hashed_password,
        role="user"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": new_user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.options("/register")
def options_register():
    return {}

@router.post("/login", response_model=Token)
def login(user_login: UserLogin, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.email == user_login.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not verify_password(user_login.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.options("/login")
def options_login():
    return {}

@router.post("/logout")
def logout():
    # Since JWT is stateless, logout is handled client-side by removing token
    return {"message": "Logged out successfully"}

@router.post("/reset-password")
def reset_password(email: str, db: Session = Depends(get_db)):
    # TODO: Implement password reset logic (send email with reset token)
    # For now, just check if user exists
    user = db.query(UserModel).filter(UserModel.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Password reset email sent"}

@router.post("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    # TODO: Implement email verification with token
    # For now, just return success
    return {"message": "Email verified"}

@router.get("/me", response_model=UserSchema)
def read_users_me(current_user: UserModel = Depends(get_current_user)):
    return UserSchema(id=str(current_user.id), name=str(current_user.name), email=str(current_user.email), role=str(current_user.role), status=str(current_user.status))

@router.put("/me", response_model=UserSchema)
def update_user_profile(user_update: UserUpdate, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    # Check if email is already taken by another user
    if user_update.email and user_update.email != current_user.email:
        existing_user = db.query(UserModel).filter(UserModel.email == user_update.email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")

    # Update user fields
    if user_update.name is not None:
        current_user.name = user_update.name
    if user_update.email is not None:
        current_user.email = user_update.email

    db.commit()
    db.refresh(current_user)
    return UserSchema(id=str(current_user.id), name=str(current_user.name), email=str(current_user.email), role=str(current_user.role), status=str(current_user.status))

@router.post("/change-password")
def change_password(password_data: ChangePassword, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    # Verify current password
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Hash new password and update
    hashed_new_password = get_password_hash(password_data.new_password)
    current_user.password_hash = hashed_new_password
    db.commit()

    return {"message": "Password changed successfully"}

@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: str, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    # Only allow admin or the user themselves to delete
    if not (current_user.id == user_id or current_user.role == "Admin"):
        raise HTTPException(status_code=403, detail="Not authorized to delete this user")
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return None
