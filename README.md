# **SGResolve - AI in Smart City**

SGResolve is an innovative, AI-driven platform designed to transform Singapore into a smarter and more responsive city. The application empowers citizens to report local issues, track report progress in real time, and engage in community discussions—all while leveraging advanced technologies such as AI-powered categorization, cloud-based workflows, and interactive maps.

## **Table of Contents**
- [Overview](#overview)
- [Features](#features)
- [Technologies Used](#technologies-used)
- [Installation and Setup](#installation-and-setup)
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

---

## **Technologies Used**
- **HTML5 & CSS3**: For structure and styling of the web application.
- **JavaScript (ES6+)**: Core functionality, including UI interactions and API calls.
- **Firebase**: Utilized for authentication, real-time database (Firestore), and hosting.
- **Leaflet**: For interactive map functionality.
- **Chart.js**: To render analytics charts in the admin dashboard.
- **External APIs**: Integration with an AI auto-detect model to analyze report descriptions.

---

## **Installation and Setup**
### Clone the repository:
```bash
git clone https://github.com/your-username/sgresolve.git
cd sgresolve
```
### Configure Firebase:
1. Create a Firebase project and enable Email/Password authentication.
2. Replace the Firebase configuration in `script.js` with your project's credentials.

### Install Dependencies:
SGResolve primarily uses CDN links for third-party libraries (Firebase, Chart.js, Leaflet). No additional package installation is required for the basic setup.

### Run the Application:
- Open `index.html` in your web browser.
- For a local development server, you can use VS Code Live Server or any similar tool.

---

## **Usage**
### **Reporting an Issue:**
1. On the landing page, click **"Report an Issue"** to sign in.
2. Once logged in, navigate to the reporting page.
3. Use the map to select your location, fill in the issue details, and optionally upload an image.
4. Utilize the AI auto-detect feature to help categorize your report.

### **Community Engagement:**
- Access the community forum to view and create posts.
- Engage with other users by sharing feedback and discussing local issues.

### **Admin Dashboard:**
- Admin users (e.g., with an email like `admin@sgresolve.com`) can log in to view submitted reports.
- Use filtering options to sort reports by category, urgency, or image availability.
- View real-time analytics and manage report statuses.

---

## **Project Structure**
```
sgresolve/
├── Other files        # Code for AI Models and Servers
├── index.html         # Main HTML file containing the structure and multiple pages
├── styles.css         # Comprehensive CSS file for all UI components
└── script.js          # JavaScript file handling authentication, maps, API calls, and UI logic
```

---

## **Contributing**
Contributions are welcome! If you have ideas or improvements, please follow these steps:
1. Fork the repository.
2. Create a new branch with a descriptive name.
3. Commit your changes with clear messages.
4. Submit a pull request explaining your improvements.

---

## **License**
This project is licensed under the **MIT License**. See the LICENSE file for details.

---

## **Contact**
For any inquiries or further information, please contact:
**Project Maintainers**: Pushkal Vashist, Kota Neil Aryan, Neelaansh Verma, Austin Biasbas Doctor

