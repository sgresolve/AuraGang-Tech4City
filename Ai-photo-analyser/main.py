import google.generativeai as genai
from PIL import Image
import io
import base64
import os
import sys
import json
from flask import Flask, request, jsonify
from flask_cors import CORS # Import CORS
from dotenv import load_dotenv

# --- Configuration ---
load_dotenv() # Load environment variables from .env file for local dev
API_KEY = os.getenv("GEMINI_API_KEY") # Get API key from environment

# Use a model that supports vision, like gemini-1.5-flash
MODEL_NAME = 'gemini-2.0-flash'

# Define valid options (lowercase for easier matching)
VALID_CATEGORIES = ["infrastructure", "environmental", "safety", "others"]
VALID_URGENCY = ["low", "medium", "high"]
VALID_THREAT = ["minor", "moderate", "severe"]

# --- Initialize Flask App ---
app = Flask(__name__)
CORS(app) # Enable CORS for all routes - allows requests from your frontend URL

# --- Gemini AI Setup ---
def configure_gemini():
    """Configures the Generative AI client."""
    if not API_KEY:
        print("❌ Error: GEMINI_API_KEY environment variable not set.")
        return False
    try:
        genai.configure(api_key=API_KEY)
        print("✅ Gemini AI configured successfully.")
        return True
    except Exception as e:
        print(f"❌ Error configuring Gemini AI: {e}")
        return False

# --- Image Analysis Function (Modified) ---
def analyze_image_data(image_bytes):
    """Analyzes image data (bytes) using Gemini AI."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        # Ensure image is RGB
        if img.mode != 'RGB':
            img = img.convert('RGB')

        model = genai.GenerativeModel(MODEL_NAME)

        # Improved prompt asking for JSON directly
        prompt = f"""
        Analyze the image provided. Based *only* on the visual content, determine the most appropriate category, urgency level, and threat level for a civic issue report.

        - Category must be one of: {', '.join(VALID_CATEGORIES)}. Default to 'others'.
        - Urgency must be one of: {', '.join(VALID_URGENCY)}. Default to 'low'.
        - Threat must be one of: {', '.join(VALID_THREAT)}. Default to 'minor'.

        Return the response strictly in JSON format like this example:
        {{"category": "infrastructure", "urgency": "medium", "threat": "moderate"}}

        Do not include any introductory text, explanations, markdown formatting (like ```json), or any characters outside the single JSON object.
        """

        print("⚙️ Sending image to Gemini for analysis...")
        response = model.generate_content([prompt, img])

        print(f"📄 Raw Gemini Response Text:\n{response.text}")

        # Attempt to parse the JSON response
        try:
            # Clean potential markdown backticks or other stray text
            cleaned_text = response.text.strip()
            # Find the start and end of the JSON object
            json_start = cleaned_text.find('{')
            json_end = cleaned_text.rfind('}') + 1
            if json_start != -1 and json_end != -1:
                json_str = cleaned_text[json_start:json_end]
                result = json.loads(json_str)
                print(f"🔍 Parsed JSON: {result}")
            else:
                 raise ValueError("Could not find JSON object in response")

            # Extract and validate data (use lowercase for consistency)
            category = result.get('category', 'others').lower()
            urgency = result.get('urgency', 'low').lower()
            threat = result.get('threat', 'minor').lower()

            category = category if category in VALID_CATEGORIES else 'others'
            urgency = urgency if urgency in VALID_URGENCY else 'low'
            threat = threat if threat in VALID_THREAT else 'minor'

            print(f"🧠 Analysis Result: Category={category}, Urgency={urgency}, Threat={threat}")
            return category, urgency, threat

        except (json.JSONDecodeError, ValueError, AttributeError, KeyError) as e:
             print(f"⚠️ Error parsing Gemini JSON response or invalid format: {e}. Attempting fallback.")
             # Fallback: Try simple string searching (less reliable)
             text_lower = response.text.strip().lower()
             category = next((c for c in VALID_CATEGORIES if f'"category": "{c}"' in text_lower or f"'category': '{c}'" in text_lower), "others")
             urgency = next((u for u in VALID_URGENCY if f'"urgency": "{u}"' in text_lower or f"'urgency': '{u}'" in text_lower), "low")
             threat = next((t for t in VALID_THREAT if f'"threat": "{t}"' in text_lower or f"'threat': '{t}'" in text_lower), "minor")
             print(f"🧠 Fallback Parsing Result: Category={category}, Urgency={urgency}, Threat={threat}")
             return category, urgency, threat


    except genai.types.generation_types.StopCandidateException as sce:
        # Handle cases where the response might be blocked due to safety filters
        print(f"❌ Gemini API Error (Content Filtered/Stopped): {sce}")
        return 'others', 'low', 'minor' # Return defaults
    except Exception as e:
        print(f"❌ Unexpected error during image analysis: {e}")
        # Log the full traceback for debugging if possible
        import traceback
        traceback.print_exc()
        return None, None, None

# --- API Endpoint ---
@app.route('/analyze-image', methods=['POST'])
def handle_analyze_image():
    """API endpoint to receive image data and return analysis."""
    print("\n--- Received request for /analyze-image ---")
    if not request.json or 'image_data' not in request.json:
        print("❌ Error: Missing 'image_data' in JSON payload.")
        return jsonify({"error": "Missing image_data in JSON payload"}), 400

    image_data_base64 = request.json['image_data']

    # Remove the prefix "data:image/...;base64," if present
    if ',' in image_data_base64:
        header, image_data_base64 = image_data_base64.split(',', 1)
        print(f"ℹ️ Removed data URI header: {header}")

    try:
        # Decode base64 string to bytes
        image_bytes = base64.b64decode(image_data_base64)
        print(f"✅ Decoded base64 image data ({len(image_bytes)} bytes).")
    except (base64.binascii.Error, ValueError) as e:
        print(f"❌ Error decoding base64: {e}")
        return jsonify({"error": "Invalid base64 image data"}), 400

    # Analyze the image bytes
    category, urgency, threat = analyze_image_data(image_bytes)

    if category is not None:
         # Return capitalized values to match HTML <option value="...">
        response_data = {
            "category": category.capitalize(),
            "urgency": urgency.capitalize(),
            "threat": threat.capitalize()
        }
        print(f"✅ Analysis successful. Sending response: {response_data}")
        return jsonify(response_data), 200
    else:
        print("❌ Analysis failed internally.")
        return jsonify({"error": "Image analysis failed on the server"}), 500

# --- Health Check Endpoint (Good Practice) ---
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"}), 200

# --- Main Execution ---
if __name__ == '__main__':
    if not configure_gemini():
        sys.exit(1) # Exit if Gemini can't be configured

    # Get port from environment variable or default to 5001 (avoid conflict with common ports)
    # Railway will set the PORT env var automatically. Gunicorn uses this.
    port = int(os.environ.get('PORT', 5001))
    # Run with debug=False when using Gunicorn in production
    # Host '0.0.0.0' makes it accessible externally (needed for Railway/Docker)
    print(f"🚀 Starting Flask server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False) # Set debug=False for production/Gunicorn