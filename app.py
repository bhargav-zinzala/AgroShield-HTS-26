import os
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
def _resolve_asset_dir(name: str) -> str:
    primary = os.path.join(BASE_DIR, name)
    nested = os.path.join(BASE_DIR, "AgroShield", name)

    if os.path.isdir(primary) and os.listdir(primary):
        return primary
    if os.path.isdir(nested):
        return nested
    return primary

template_dir = _resolve_asset_dir("templates")
static_dir = _resolve_asset_dir("static")

app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)
CORS(app)

MONGO_URI = os.getenv("MONGO_URI")
users_collection = None

try:
    if not MONGO_URI:
        raise ValueError("MONGO_URI is missing. Add it to your .env file.")

    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    client.admin.command("ping")
    db = client["AgroShieldDB"]
    users_collection = db["users"]
    print("Connected to MongoDB Atlas successfully.")
except Exception as e:
    print("Failed to connect to MongoDB:", e)


def db_ready():
    return users_collection is not None


@app.route('/', methods=['GET'])
def home():
    return render_template('index.html')


@app.route('/add_farm', methods=['GET'])
def add_farm():
    return render_template('add_farm.html')


@app.route('/dashboard', methods=['GET'])
def dashboard():
    return render_template('dashboard.html')


@app.route('/api/send_otp', methods=['POST'])
def send_otp():
    data = request.json or {}
    mobile = data.get('mobile')
    return jsonify({"message": f"OTP sent to {mobile}", "success": True})


@app.route('/api/verify_otp', methods=['POST'])
def verify_otp():
    if not db_ready():
        return jsonify({"message": "Database unavailable", "success": False}), 503

    data = request.json or {}
    mobile = data.get('mobile')
    otp = data.get('otp')

    if otp == '123456':
        existing_user = users_collection.find_one({"mobile": mobile})
        if existing_user:
            return jsonify({"message": "Login successful", "status": "login", "success": True})

        new_user = {"mobile": mobile, "farm_details": None}
        users_collection.insert_one(new_user)
        return jsonify({"message": "Registration successful", "status": "register", "success": True})

    return jsonify({"message": "Invalid OTP", "success": False})


@app.route('/api/save_farm', methods=['POST'])
def save_farm():
    if not db_ready():
        return jsonify({"message": "Database unavailable", "success": False}), 503

    data = request.json or {}
    mobile = data.get('mobile')

    farm_data = {
        "coordinates": data.get('coordinates'),
        "crop": data.get('crop'),
        "planting_date": data.get('planting_date'),
        "soil_type": data.get('soil_type')
    }

    result = users_collection.update_one(
        {"mobile": mobile},
        {"$set": {"farm_details": farm_data}}
    )

    if result.modified_count > 0:
        return jsonify({"message": "Farm details saved successfully!", "success": True})
    return jsonify({"message": "Could not save farm details. User not found.", "success": False})


@app.route('/api/get_user_data', methods=['POST'])
def get_user_data():
    if not db_ready():
        return jsonify({"message": "Database unavailable", "success": False}), 503

    data = request.json or {}
    mobile = data.get('mobile')

    user = users_collection.find_one({"mobile": mobile}, {'_id': 0})

    if user:
        return jsonify({"success": True, "data": user})
    return jsonify({"success": False, "message": "User not found"})


if __name__ == '__main__':
    app.run(debug=True, port=5000)
