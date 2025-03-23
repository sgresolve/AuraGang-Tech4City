from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import os

# Initialize the Flask application
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes, allowing all origins by default

# Define keywords for categories, urgency, and threat
category_keywords = {
    "Infrastructure": ["road", "pothole", "traffic", "light", "sidewalk", "bridge", "street", "pavement", "sewer", "drain", "highway", "railway", "airport", "pipeline", "subway", "tunnel", "canal", "utility", "powerline", "interchange", "terminal", "station", "reservoir"],
    "Environmental": ["pollution", "waste", "recycling", "green", "park", "tree", "air", "water", "flood", "trash", "litter", "ecosystem", "conservation", "biodiversity", "sustainability", "climate", "emissions", "habitat", "erosion", "deforestation", "wetland", "contamination",  "drought", "renewable", "wildlife", "fog", "runoff", "preservation"],
    "Safety": ["crime", "hazard", "emergency", "accident", "fire", "police", "ambulance", "dark", "safety", "theft", "security", "violence", "prevention", "patrol", "surveillance", "protection", "disaster", "evacuation", "warning", "rescue", "violation", "vandalism", "assault", "alarm", "enforcement", "inspection", "risk", "defence", "incident", "shelter"],
    "Others": ["public health", "healthcare", "education", "employment", "poverty", "homeless", "community"," welfare", "accessibility", "displacement", "transportation", "recreation", "services", "housing", "maintenance", "utilities", "infrastructure", "funding", "inclusion", "development", "outreach", "diversity", "governance"]
}

urgency_keywords = {
    "Low": ["not urgent", "later", "minor", "eventually", "whenever"],
    "Medium": ["soon", "timely", "important", "prompt", "today"],
    "High": ["urgent", "immediate", "critical", "emergency", "asap"]
}

threat_keywords = {
    "Minor": ["small", "insignificant", "negligible", "minor", "tiny"],
    "Moderate": ["concerning", "problematic", "significant", "moderate", "issue"],
    "Severe": ["dangerous", "hazardous", "life-threatening", "severe", "critical"]
}

# Create documents for TF-IDF vectorization by joining keywords into strings
category_documents = [" ".join(keywords) for keywords in category_keywords.values()]
urgency_documents = [" ".join(keywords) for keywords in urgency_keywords.values()]
threat_documents = [" ".join(keywords) for keywords in threat_keywords.values()]

# Initialize and fit TF-IDF vectorizers
category_vectorizer = TfidfVectorizer()
category_vectors = category_vectorizer.fit_transform(category_documents)

urgency_vectorizer = TfidfVectorizer()
urgency_vectors = urgency_vectorizer.fit_transform(urgency_documents)

threat_vectorizer = TfidfVectorizer()
threat_vectors = threat_vectorizer.fit_transform(threat_documents)

# Define a simple home route to check if the server is running
@app.route('/')
def home():
    return "Flask server is running on Railway!"

# Define the prediction endpoint
@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    text = data.get('text', '')
    
    if not text:
        return jsonify({"error": "No text provided"}), 400
    
    text_lower = text.lower()
    
    # Predict category
    category_text_vector = category_vectorizer.transform([text_lower])
    category_similarities = cosine_similarity(category_text_vector, category_vectors).flatten()
    category_index = np.argmax(category_similarities)
    category = list(category_keywords.keys())[category_index] if np.max(category_similarities) > 0.1 else "Others"
    
    # Predict urgency
    urgency_text_vector = urgency_vectorizer.transform([text_lower])
    urgency_similarities = cosine_similarity(urgency_text_vector, urgency_vectors).flatten()
    urgency_index = np.argmax(urgency_similarities)
    urgency = list(urgency_keywords.keys())[urgency_index]
    
    # Predict threat
    threat_text_vector = threat_vectorizer.transform([text_lower])
    threat_similarities = cosine_similarity(threat_text_vector, threat_vectors).flatten()
    threat_index = np.argmax(threat_similarities)
    threat = list(threat_keywords.keys())[threat_index]
    
    return jsonify({"category": category, "urgency": urgency, "threat": threat})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
