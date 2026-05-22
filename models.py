import uuid
from datetime import datetime, timezone

from extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

    groups = db.relationship("PhotoGroup", back_populates="user", cascade="all, delete-orphan")
    photos = db.relationship("Photo", back_populates="user", cascade="all, delete-orphan")
    screens = db.relationship("Screen", back_populates="user", cascade="all, delete-orphan")
    settings = db.relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")


class PhotoGroup(db.Model):
    __tablename__ = "photo_groups"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.Uuid, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(7), nullable=False, default="#000000")
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

    user = db.relationship("User", back_populates="groups")
    photos = db.relationship("Photo", back_populates="group")
    screens = db.relationship("Screen", back_populates="group")


class Photo(db.Model):
    __tablename__ = "photos"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.Uuid, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    group_id = db.Column(db.Uuid, db.ForeignKey("photo_groups.id", ondelete="SET NULL"), nullable=True, index=True)
    filename = db.Column(db.String(255), nullable=False)
    original_name = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

    user = db.relationship("User", back_populates="photos")
    group = db.relationship("PhotoGroup", back_populates="photos")


class Screen(db.Model):
    __tablename__ = "screens"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.Uuid, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    group_id = db.Column(db.Uuid, db.ForeignKey("photo_groups.id", ondelete="SET NULL"), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False, default="")
    token = db.Column(db.String(10), unique=True, nullable=False, index=True)
    slide_interval = db.Column(db.Integer, nullable=False, default=30)
    active = db.Column(db.Boolean, nullable=False, default=True)
    status = db.Column(db.String(20), nullable=False, default="waiting")
    last_sync = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

    user = db.relationship("User", back_populates="screens")
    group = db.relationship("PhotoGroup", back_populates="screens")


class UserSettings(db.Model):
    __tablename__ = "user_settings"

    user_id = db.Column(db.Uuid, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    autoplay = db.Column(db.Boolean, nullable=False, default=True)
    compress = db.Column(db.Boolean, nullable=False, default=True)
    default_slide_interval = db.Column(db.Integer, nullable=False, default=30)

    user = db.relationship("User", back_populates="settings")
