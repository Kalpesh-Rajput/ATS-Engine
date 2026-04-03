#!/usr/bin/env python3
"""
Run from the backend directory to create a recruiter account:
  cd backend
  python ../scripts/create_admin.py
"""
import sys
import os

# Add backend directory to path so app imports work
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend')
sys.path.insert(0, backend_dir)

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import hash_password
from app.models.recruiter import Recruiter
from app.db.base import Base

engine = create_engine(settings.DATABASE_URL_SYNC)
Base.metadata.create_all(engine)

user_name = input("Name: ").strip()
email = input("Email: ").strip()
password = input("Password: ").strip()
is_admin = input("Admin? (y/n): ").strip().lower() == "y"

with Session(engine) as db:
    existing = db.query(Recruiter).filter(Recruiter.email == email).first()
    if existing:
        print(f"❌ Email {email} already exists.")
        sys.exit(1)

    r = Recruiter(
        user_name=user_name,
        email=email,
        hashed_password=hash_password(password),
        is_admin=is_admin,
    )
    db.add(r)
    db.commit()
    print(f"✅ Recruiter '{user_name}' created (admin={is_admin})")
