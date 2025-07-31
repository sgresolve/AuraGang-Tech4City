# **SGResolve - AI in Smart City**

Spot It. Report It. Resolve It

SGResolve is an innovative, AI-driven platform designed to transform Singapore into a smarter and more responsive city. The application empowers citizens to report local issues, track report progress in real time, and engage in community discussions—all while leveraging advanced technologies such as AI-powered categorization, cloud-based workflows, and interactive maps.

## **Table of Contents**
- [Overview](#overview)
- [Features](#features)
- [Technologies Used](#technologies-used)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## **Overview**
SGResolve is built to address urban challenges by enabling fast and efficient issue reporting. The platform provides a user-friendly interface for:

- Reporting local issues (e.g., potholes, street light outages) with location details and image uploads.
- Tracking the status of reported issues via an interactive map.
- Engaging with the community through forums.
- Accessing an admin dashboard with real-time analytics and report management tools.

---

## **Features**
- **User Authentication**: Secure login and registration using Firebase Authentication.
- **Issue Reporting**: Intuitive reporting page with location detection, image upload, and AI-powered categorization.
- **Interactive Maps**: Integration with Leaflet to display and track report locations.
- **Admin Dashboard**: Tools for monitoring reports, filtering by categories (e.g., infrastructure, environmental, safety), and viewing analytics via Chart.js.
- **Community Forum**: A dedicated space for users to share ideas and discuss local issues.
- **Custom Chatbot**: An AI-powered chatbot to assist users and provide quick information.
- **Voice-to-Text Reporting**: Hands-free reporting with Web Speech API integration.
- **Popup CAPTCHA**: Simple math questions (e.g., "7 + 9" or "9 × 2") to prevent bot spam.
- **Progressive Web App (PWA)**: Install SGResolve to your home screen for app-like access.

---

## **Technologies Used**
- **HTML5 & CSS3**: For structure and styling of the web application.
- **JavaScript (ES6+)**: Core functionality, including UI interactions and API calls.
- **Firebase**: Utilized for authentication, real-time database (Firestore), and hosting.
- **Leaflet**: For interactive map functionality.
- **Chart.js**: To render analytics charts in the admin dashboard.
- **Web Speech API**: Enables voice-to-text reporting.
- **External APIs**: Integration with an AI auto-detect model to analyze report descriptions.
- **Service Workers**: Support PWA features like offline access and home screen installation.

---



## **Usage**
### **Reporting an Issue:**
1. On the landing page, click **"Report an Issue"** to sign in.
2. Once logged in, navigate to the reporting page.
3. Use the map to select your location, fill in the issue details (type, voice, or upload an image), and utilize the AI auto-detect feature to categorize.
4. Answer the popup CAPTCHA (e.g., "7 + 9 = ?") to submit.

### **Community Engagement:**
- Access the community forum to view and create posts.
- Engage with other users by sharing feedback and discussing local issues.

### **Admin Dashboard:**
- Admin users (e.g., with an email like `admin@sgresolve.com`) can log in to view submitted reports.
- Use filtering options to sort reports by category, urgency, or image availability.
- View real-time analytics and manage report statuses.

### **Install to Home Screen:**
- On a mobile browser (e.g., Chrome), tap the menu and select "Add to Home Screen."
- Launch SGResolve from your home screen like a native app, with basic offline support.

---
## **Project Structure**
 ![image](https://github.com/user-attachments/assets/4d886c35-ffe3-48d2-b14f-f4e882b96745)




---

## **Contributing**
Contributions are closed as of now. Please use the **Community Forum** to provide feedback, suggest improvements, or report issues.

---

## **License**
This project is licensed under the **MIT License**. See the LICENSE file for details.

---

## **Contact**
For any inquiries or further information, please contact:
**Project Maintainer**: Pushkal Vashist
