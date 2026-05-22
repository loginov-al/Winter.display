import os
import secrets
import uuid
from functools import wraps

from flask import Blueprint, jsonify, request, session
from PIL import Image
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

import config
from extensions import db
from models import Photo, PhotoGroup, Screen, User, UserSettings

api_bp = Blueprint("api", __name__, url_prefix="/api")

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return view(*args, **kwargs)

    return wrapped


def current_user_id():
    return uuid.UUID(session["user_id"])


def get_or_create_settings(user_id):
    settings = UserSettings.query.filter_by(user_id=user_id).first()
    if settings is None:
        settings = UserSettings(user_id=user_id)
        db.session.add(settings)
        db.session.commit()
    return settings


def generate_token():
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        token = "".join(secrets.choice(alphabet) for _ in range(6))
        if not Screen.query.filter_by(token=token).first():
            return token


def user_upload_dir(user_id):
    path = os.path.join(config.UPLOAD_FOLDER, str(user_id))
    os.makedirs(path, exist_ok=True)
    return path


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def save_photo_file(user_id, file_storage, compress):
    photo_id = uuid.uuid4()
    upload_dir = user_upload_dir(user_id)
    filename = f"{photo_id}.jpg"
    filepath = os.path.join(upload_dir, filename)

    image = Image.open(file_storage.stream)
    if compress:
        image = image.convert("RGB")
        max_side = 1600
        image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        image.save(filepath, format="JPEG", quality=82, optimize=True)
    else:
        ext = file_storage.filename.rsplit(".", 1)[1].lower()
        if ext in {"jpg", "jpeg"}:
            image = image.convert("RGB")
            image.save(filepath, format="JPEG", quality=92, optimize=True)
        else:
            filename = f"{photo_id}.{ext}"
            filepath = os.path.join(upload_dir, filename)
            file_storage.stream.seek(0)
            file_storage.save(filepath)

    return filename


def photo_to_dict(photo):
    return {
        "id": str(photo.id),
        "name": photo.original_name,
        "url": f"/uploads/{photo.user_id}/{photo.filename}",
        "groupId": str(photo.group_id) if photo.group_id else None,
        "createdAt": photo.created_at.isoformat() if photo.created_at else None,
    }


def group_to_dict(group, photos_count=0):
    return {
        "id": str(group.id),
        "name": group.name,
        "color": group.color,
        "photosCount": photos_count,
    }


def screen_to_dict(screen):
    group_name = "Все фото"
    if screen.group_id and screen.group:
        group_name = screen.group.name
    elif screen.group_id is None:
        group_name = "Все фото"

    return {
        "id": str(screen.id),
        "name": screen.name,
        "description": screen.description,
        "groupId": str(screen.group_id) if screen.group_id else None,
        "groupName": group_name,
        "token": screen.token,
        "slideInterval": screen.slide_interval,
        "active": screen.active,
        "status": screen.status,
        "lastSync": screen.last_sync.isoformat() if screen.last_sync else None,
    }


def settings_to_dict(settings):
    return {
        "autoplay": settings.autoplay,
        "compress": settings.compress,
        "defaultSlideInterval": settings.default_slide_interval,
    }


@api_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email и пароль обязательны"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Аккаунт уже существует"}), 409

    user = User(email=email, password_hash=generate_password_hash(password))
    db.session.add(user)
    db.session.flush()
    db.session.add(UserSettings(user_id=user.id))
    db.session.commit()

    session["user_id"] = str(user.id)
    return jsonify({"ok": True}), 201


@api_bp.post("/login")
def api_login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "Неверный логин или пароль"}), 401

    session["user_id"] = str(user.id)
    return jsonify({"ok": True})


@api_bp.post("/logout")
def api_logout():
    session.clear()
    return jsonify({"ok": True})


@api_bp.get("/me")
@login_required
def me():
    user = db.session.get(User, current_user_id())
    settings = get_or_create_settings(user.id)
    photos_count = Photo.query.filter_by(user_id=user.id).count()
    screens_count = Screen.query.filter_by(user_id=user.id).count()
    groups_count = PhotoGroup.query.filter_by(user_id=user.id).count()

    return jsonify({
        "email": user.email,
        "settings": settings_to_dict(settings),
        "stats": {
            "photos": photos_count,
            "screens": screens_count,
            "groups": groups_count,
        },
    })


@api_bp.get("/photos")
@login_required
def list_photos():
    user_id = current_user_id()
    filter_value = request.args.get("filter", "all")

    query = Photo.query.filter_by(user_id=user_id).order_by(Photo.created_at.desc())
    if filter_value == "ungrouped":
        query = query.filter(Photo.group_id.is_(None))
    elif filter_value not in ("all", ""):
        try:
            group_id = uuid.UUID(filter_value)
            query = query.filter_by(group_id=group_id)
        except ValueError:
            return jsonify({"error": "Invalid filter"}), 400

    photos = query.all()
    return jsonify([photo_to_dict(photo) for photo in photos])


@api_bp.post("/photos")
@login_required
def upload_photos():
    user_id = current_user_id()
    settings = get_or_create_settings(user_id)
    files = request.files.getlist("files")
    group_id_raw = request.form.get("groupId")

    if not files:
        return jsonify({"error": "Файлы не переданы"}), 400

    group_id = None
    if group_id_raw:
        try:
            group_id = uuid.UUID(group_id_raw)
            group = PhotoGroup.query.filter_by(id=group_id, user_id=user_id).first()
            if not group:
                return jsonify({"error": "Группа не найдена"}), 404
        except ValueError:
            return jsonify({"error": "Invalid groupId"}), 400

    created = []
    for file_storage in files:
        if not file_storage or not file_storage.filename:
            continue
        if not allowed_file(file_storage.filename):
            continue

        filename = save_photo_file(user_id, file_storage, settings.compress)
        photo = Photo(
            user_id=user_id,
            group_id=group_id,
            filename=filename,
            original_name=secure_filename(file_storage.filename),
        )
        db.session.add(photo)
        db.session.flush()
        created.append(photo_to_dict(photo))

    db.session.commit()
    return jsonify(created), 201


@api_bp.patch("/photos/<photo_id>")
@login_required
def update_photo(photo_id):
    user_id = current_user_id()
    photo = Photo.query.filter_by(id=photo_id, user_id=user_id).first()
    if not photo:
        return jsonify({"error": "Not found"}), 404

    data = request.get_json(silent=True) or {}
    group_id_raw = data.get("groupId")

    if group_id_raw in ("", None):
        photo.group_id = None
    else:
        try:
            group_id = uuid.UUID(group_id_raw)
            group = PhotoGroup.query.filter_by(id=group_id, user_id=user_id).first()
            if not group:
                return jsonify({"error": "Группа не найдена"}), 404
            photo.group_id = group_id
        except ValueError:
            return jsonify({"error": "Invalid groupId"}), 400

    db.session.commit()
    return jsonify(photo_to_dict(photo))


@api_bp.delete("/photos/<photo_id>")
@login_required
def delete_photo(photo_id):
    user_id = current_user_id()
    photo = Photo.query.filter_by(id=photo_id, user_id=user_id).first()
    if not photo:
        return jsonify({"error": "Not found"}), 404

    filepath = os.path.join(user_upload_dir(user_id), photo.filename)
    if os.path.exists(filepath):
        os.remove(filepath)

    db.session.delete(photo)
    db.session.commit()
    return jsonify({"ok": True})


@api_bp.delete("/photos")
@login_required
def delete_all_photos():
    user_id = current_user_id()
    photos = Photo.query.filter_by(user_id=user_id).all()
    upload_dir = user_upload_dir(user_id)

    for photo in photos:
        filepath = os.path.join(upload_dir, photo.filename)
        if os.path.exists(filepath):
            os.remove(filepath)
        db.session.delete(photo)

    db.session.commit()
    return jsonify({"ok": True})


@api_bp.get("/groups")
@login_required
def list_groups():
    user_id = current_user_id()
    groups = PhotoGroup.query.filter_by(user_id=user_id).order_by(PhotoGroup.created_at.desc()).all()
    result = []
    for group in groups:
        count = Photo.query.filter_by(user_id=user_id, group_id=group.id).count()
        result.append(group_to_dict(group, count))
    return jsonify(result)


@api_bp.post("/groups")
@login_required
def create_group():
    user_id = current_user_id()
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    color = data.get("color") or "#000000"

    if not name:
        return jsonify({"error": "Название обязательно"}), 400

    group = PhotoGroup(user_id=user_id, name=name, color=color)
    db.session.add(group)
    db.session.commit()
    return jsonify(group_to_dict(group, 0)), 201


@api_bp.patch("/groups/<group_id>")
@login_required
def update_group(group_id):
    user_id = current_user_id()
    group = PhotoGroup.query.filter_by(id=group_id, user_id=user_id).first()
    if not group:
        return jsonify({"error": "Not found"}), 404

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if name:
        group.name = name
    if data.get("color"):
        group.color = data["color"]

    db.session.commit()
    count = Photo.query.filter_by(user_id=user_id, group_id=group.id).count()
    return jsonify(group_to_dict(group, count))


@api_bp.delete("/groups/<group_id>")
@login_required
def delete_group(group_id):
    user_id = current_user_id()
    group = PhotoGroup.query.filter_by(id=group_id, user_id=user_id).first()
    if not group:
        return jsonify({"error": "Not found"}), 404

    Photo.query.filter_by(user_id=user_id, group_id=group.id).update({"group_id": None})
    Screen.query.filter_by(user_id=user_id, group_id=group.id).update({"group_id": None})
    db.session.delete(group)
    db.session.commit()
    return jsonify({"ok": True})


@api_bp.get("/screens")
@login_required
def list_screens():
    user_id = current_user_id()
    screens = Screen.query.filter_by(user_id=user_id).order_by(Screen.created_at.desc()).all()
    return jsonify([screen_to_dict(screen) for screen in screens])


@api_bp.post("/screens")
@login_required
def create_screen():
    user_id = current_user_id()
    settings = get_or_create_settings(user_id)
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Название обязательно"}), 400

    group_id = None
    if data.get("groupId"):
        try:
            group_id = uuid.UUID(data["groupId"])
            group = PhotoGroup.query.filter_by(id=group_id, user_id=user_id).first()
            if not group:
                return jsonify({"error": "Группа не найдена"}), 404
        except ValueError:
            return jsonify({"error": "Invalid groupId"}), 400

    screen = Screen(
        user_id=user_id,
        name=name,
        description=(data.get("description") or "").strip(),
        group_id=group_id,
        token=generate_token(),
        slide_interval=max(5, min(int(data.get("slideInterval") or settings.default_slide_interval), 300)),
        active=True,
        status="waiting",
    )
    db.session.add(screen)
    db.session.commit()
    return jsonify(screen_to_dict(screen)), 201


@api_bp.patch("/screens/<screen_id>")
@login_required
def update_screen(screen_id):
    user_id = current_user_id()
    screen = Screen.query.filter_by(id=screen_id, user_id=user_id).first()
    if not screen:
        return jsonify({"error": "Not found"}), 404

    data = request.get_json(silent=True) or {}
    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Название обязательно"}), 400
        screen.name = name
    if "description" in data:
        screen.description = (data.get("description") or "").strip()
    if "slideInterval" in data:
        screen.slide_interval = max(5, min(int(data["slideInterval"]), 300))
    if "groupId" in data:
        if data["groupId"] in ("", None):
            screen.group_id = None
        else:
            try:
                group_id = uuid.UUID(data["groupId"])
                group = PhotoGroup.query.filter_by(id=group_id, user_id=user_id).first()
                if not group:
                    return jsonify({"error": "Группа не найдена"}), 404
                screen.group_id = group_id
            except ValueError:
                return jsonify({"error": "Invalid groupId"}), 400

    db.session.commit()
    return jsonify(screen_to_dict(screen))


@api_bp.post("/screens/<screen_id>/toggle")
@login_required
def toggle_screen(screen_id):
    user_id = current_user_id()
    screen = Screen.query.filter_by(id=screen_id, user_id=user_id).first()
    if not screen:
        return jsonify({"error": "Not found"}), 404

    screen.active = not screen.active
    db.session.commit()
    return jsonify(screen_to_dict(screen))


@api_bp.delete("/screens/<screen_id>")
@login_required
def delete_screen(screen_id):
    user_id = current_user_id()
    screen = Screen.query.filter_by(id=screen_id, user_id=user_id).first()
    if not screen:
        return jsonify({"error": "Not found"}), 404

    db.session.delete(screen)
    db.session.commit()
    return jsonify({"ok": True})


@api_bp.delete("/screens")
@login_required
def delete_all_screens():
    user_id = current_user_id()
    Screen.query.filter_by(user_id=user_id).delete()
    db.session.commit()
    return jsonify({"ok": True})


@api_bp.get("/settings")
@login_required
def get_settings():
    settings = get_or_create_settings(current_user_id())
    user_id = current_user_id()
    return jsonify({
        **settings_to_dict(settings),
        "stats": {
            "photos": Photo.query.filter_by(user_id=user_id).count(),
            "screens": Screen.query.filter_by(user_id=user_id).count(),
            "groups": PhotoGroup.query.filter_by(user_id=user_id).count(),
        },
    })


@api_bp.patch("/settings")
@login_required
def update_settings():
    settings = get_or_create_settings(current_user_id())
    data = request.get_json(silent=True) or {}

    if "autoplay" in data:
        settings.autoplay = bool(data["autoplay"])
    if "compress" in data:
        settings.compress = bool(data["compress"])
    if "defaultSlideInterval" in data:
        settings.default_slide_interval = max(5, min(int(data["defaultSlideInterval"]), 300))

    db.session.commit()
    user_id = current_user_id()
    return jsonify({
        **settings_to_dict(settings),
        "stats": {
            "photos": Photo.query.filter_by(user_id=user_id).count(),
            "screens": Screen.query.filter_by(user_id=user_id).count(),
            "groups": PhotoGroup.query.filter_by(user_id=user_id).count(),
        },
    })
