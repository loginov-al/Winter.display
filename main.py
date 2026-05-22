import os

import config
from api import api_bp
from datetime import timedelta
from flask import Flask, jsonify, redirect, render_template, request, send_from_directory, session
from werkzeug.security import check_password_hash

from extensions import db
from models import User


def create_app():
    app = Flask(__name__)
    app.config.update(
        SECRET_KEY=config.SECRET_KEY,
        SQLALCHEMY_DATABASE_URI=config.DATABASE_URL,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )
    app.permanent_session_lifetime = timedelta(days=365)

    db.init_app(app)
    app.register_blueprint(api_bp)

    os.makedirs(config.UPLOAD_FOLDER, exist_ok=True)

    with app.app_context():
        db.create_all()

    register_routes(app)
    return app


def login_required_page():
    if "user_id" not in session:
        return redirect("/")
    return None


def register_routes(app):
    @app.route("/")
    def login_page():
        if "user_id" in session:
            return redirect("/home")
        return render_template("login.html")

    @app.route("/create_account")
    def create_account_page():
        if "user_id" in session:
            return redirect("/home")
        return render_template("register.html")

    @app.route("/login", methods=["POST"])
    def login():
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        user = User.query.filter_by(email=email).first()
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Неверный логин или пароль"}), 401

        session.permanent = True
        session["user_id"] = str(user.id)
        return jsonify({"ok": True})

    @app.route("/home")
    def home():
        redirect_response = login_required_page()
        if redirect_response:
            return redirect_response
        return render_template("home.html")

    @app.route("/groups")
    def groups():
        redirect_response = login_required_page()
        if redirect_response:
            return redirect_response
        return render_template("groups.html")

    @app.route("/settings")
    def settings_page():
        redirect_response = login_required_page()
        if redirect_response:
            return redirect_response
        return render_template("settings.html")

    @app.route("/tv")
    def tv():
        return render_template("tv.html")

    @app.route("/uploads/<user_id>/<filename>")
    def uploaded_file(user_id, filename):
        if "user_id" not in session or session["user_id"] != user_id:
            return jsonify({"error": "Unauthorized"}), 401
        directory = os.path.join(config.UPLOAD_FOLDER, user_id)
        return send_from_directory(directory, filename)


app = create_app()


if __name__ == "__main__":
    app.run(debug=True, port=5009)
