import config
from datetime import timedelta
from flask import Flask, render_template

app = Flask(__name__)
app.config.update(SECRET_KEY=config.SECRET_KEY)
app.permanent_session_lifetime = timedelta(days=365)















if __name__ == "__main__":
    app.run(debug=True, port=5009)