import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword
} from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    getDoc,
    query,
    where,
    doc,
    updateDoc,
    deleteDoc,
    orderBy,
    limit,
    startAfter,
    increment,
    runTransaction,
    setDoc
} from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAgBUaMIawsOqMbLpju2mrd6kMaranT2rI",
    authDomain: "sgresolve-login-register.firebaseapp.com",
    projectId: "sgresolve-login-register",
    messagingSenderId: "564104431729",
    appId: "1:564104431729:web:57557b54673a8c18d973d0",
    measurementId: "G-R3QDN8V84C"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- AI API Endpoints ---
const IMAGE_ANALYZER_API_URL = "https://ai-photo-analyser-production.up.railway.app//analyze-image";
const TEXT_ANALYSIS_API_URL = 'https://auto-detect-model-production.up.railway.app/predict';
const SUGGEST_AGENCY_API_URL = "https://auto-agency-suggestion-ai-production.up.railway.app/suggest-agency";

// --- ImgBB Key ---
const IMGBB_API_KEY = '8c3ac5bab399ca801e354b900052510d'; // Your ImgBB Key


// --- reCAPTCHA Callbacks---
window.onRecaptchaSuccess = function () {
    console.log('reCAPTCHA verification successful (frontend)');
    const submitButton = document.getElementById('submit-report-button'); // Use specific ID now
    const recaptchaError = document.getElementById('recaptcha-error');
    if (submitButton) submitButton.disabled = false;
    if (recaptchaError) recaptchaError.style.display = 'none'; // Hide error message
};

window.onRecaptchaExpired = function () {
    console.warn('reCAPTCHA verification expired'); // Changed to warn
    const submitButton = document.getElementById('submit-report-button');
    const recaptchaError = document.getElementById('recaptcha-error');
    if (submitButton) submitButton.disabled = true;
    if (recaptchaError) {
        recaptchaError.textContent = "CAPTCHA expired. Please verify again.";
        recaptchaError.style.display = 'block'; // Show error message
    }
    // Reset the CAPTCHA widget if needed (might happen automatically)
    // if (typeof grecaptcha !== 'undefined' && grecaptcha) grecaptcha.reset();
};

window.onRecaptchaError = function () {
    console.error('reCAPTCHA error occurred');
    const submitButton = document.getElementById('submit-report-button');
    const recaptchaError = document.getElementById('recaptcha-error');
    if (submitButton) submitButton.disabled = true;
    if (recaptchaError) {
        recaptchaError.textContent = "CAPTCHA failed to load or verify. Please try refreshing.";
        recaptchaError.style.display = 'block'; // Show error message
    }
    console.error("CAPTCHA failed to load. Please refresh the page."); // Log error instead of popup
};
// --- End reCAPTCHA Callbacks ---


document.addEventListener('DOMContentLoaded', () => {
    // Singapore's Geographical Boundaries
    const SINGAPORE_BOUNDS = { latMin: 1.15, latMax: 1.47, lonMin: 103.6, lonMax: 104.0 };
    const singaporeLatLngBounds = L.latLngBounds(
        [SINGAPORE_BOUNDS.latMin, SINGAPORE_BOUNDS.lonMin],
        [SINGAPORE_BOUNDS.latMax, SINGAPORE_BOUNDS.lonMax]
    );

    // Initialize Maps
    let reportingMap = null;
    let adminMap = null;
    let nearbyMap = null;
    let tempMarker; // Moved here, global for reporting map clicks

    function initializeReportingMap() {
        if (!reportingMap && document.getElementById('map')) {
            reportingMap = L.map('map').setView([1.3521, 103.8198], 11);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(reportingMap);
            reportingMap.on('click', function (e) {
                const { lat, lng } = e.latlng;
                if (!singaporeLatLngBounds.contains(e.latlng)) {
                    console.warn('Please select a location within Singapore.'); return; // Log warning
                }
                // Remove previous temp marker if exists
                if (tempMarker) {
                    reportingMap.removeLayer(tempMarker);
                    tempMarker = null; // Clear reference
                }
                // Add new marker
                tempMarker = L.marker([lat, lng]).addTo(reportingMap);
                document.getElementById('latitude').value = lat.toFixed(6);
                document.getElementById('longitude').value = lng.toFixed(6);
            });
        }
    }
    function initializeAdminMap() {
        if (!adminMap && document.getElementById('admin-map')) {
            adminMap = L.map('admin-map').setView([1.3521, 103.8198], 11);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(adminMap);
        }
    }
    function initializeNearbyMap() {
        if (!nearbyMap && document.getElementById('nearby-map')) {
            nearbyMap = L.map('nearby-map').setView([1.3521, 103.8198], 11);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(nearbyMap);
        }
    }

    initializeReportingMap();
    initializeAdminMap();
    initializeNearbyMap();

    // Global Variables
    let adminReportMarkers = [];
    let imageDataUrl = null; // Base64 data for analysis/preview
    let currentUser = null;
    let currentUserData = null; // Holds full user profile including gamification from Firestore
    let lastVisiblePost = null;
    let isLoadingForumPosts = false;
    let nearbyMarkers = [];
    let statusChartInstance = null;
    let urgencyChartInstance = null;
    let categoryChartInstance = null;
    let rpNotificationTimeout; // Store timeout for RP sidebar to prevent overlaps

    // --- Speech Recognition Variables ---
    let recognition;
    let isRecognizing = false;
    let targetInputFieldForSpeech = null; // To avoid conflict with other 'targetInputField' if any


    // Predefined Locations & Colors
    const PREDEFINED_LOCATIONS = {
        punggol: { lat: 1.4051, lon: 103.9025, name: "Punggol" }, sengkang: { lat: 1.3917, lon: 103.8954, name: "Sengkang" }, hougang: { lat: 1.3716, lon: 103.8931, name: "Hougang" }, serangoon: { lat: 1.3497, lon: 103.8731, name: "Serangoon" }, tampines: { lat: 1.3544, lon: 103.9439, name: "Tampines" }, pasir_ris: { lat: 1.3731, lon: 103.9493, name: "Pasir Ris" }, bedok: { lat: 1.3240, lon: 103.9298, name: "Bedok" }, changi_airport: { lat: 1.3592, lon: 103.9896, name: "Changi Airport" }, woodlands: { lat: 1.4360, lon: 103.7860, name: "Woodlands" }, yishun: { lat: 1.4295, lon: 103.8350, name: "Yishun" }, sembawang: { lat: 1.4491, lon: 103.8200, name: "Sembawang" }, ang_mo_kio: { lat: 1.3699, lon: 103.8496, name: "Ang Mo Kio" }, bishan: { lat: 1.3508, lon: 103.8484, name: "Bishan" }, toa_payoh: { lat: 1.3324, lon: 103.8497, name: "Toa Payoh" }, orchard: { lat: 1.3048, lon: 103.8318, name: "Orchard Road" }, city_hall: { lat: 1.2931, lon: 103.8525, name: "City Hall" }, raffles_place: { lat: 1.2839, lon: 103.8515, name: "Raffles Place" }, jurong_east: { lat: 1.3331, lon: 103.7422, name: "Jurong East" }, clementi: { lat: 1.3150, lon: 103.7651, name: "Clementi" }, bukit_batok: { lat: 1.3490, lon: 103.7496, name: "Bukit Batok" }, choa_chu_kang: { lat: 1.3854, lon: 103.7446, name: "Choa Chu Kang" }, boon_lay: { lat: 1.3386, lon: 103.7060, name: "Boon Lay" }, harbourfront: { lat: 1.2659, lon: 103.8214, name: "HarbourFront" }, marina_bay: { lat: 1.2808, lon: 103.8596, name: "Marina Bay Sands" },
    };
    const STATUS_COLORS = { 'Pending': 'rgba(255, 193, 7, 0.7)', 'In Progress': 'rgba(54, 162, 235, 0.7)', 'Resolved': 'rgba(40, 167, 69, 0.7)' };
    const URGENCY_COLORS = { 'Low': 'rgba(75, 192, 192, 0.7)', 'Medium': 'rgba(255, 159, 64, 0.7)', 'High': 'rgba(255, 99, 132, 0.7)' };
    const CATEGORY_COLORS_MONTHLY = { 'Infrastructure': 'rgba(153, 102, 255, 0.7)', 'Environmental': 'rgba(40, 167, 69, 0.7)', 'Safety': 'rgba(255, 99, 132, 0.7)', 'Others': 'rgba(201, 203, 207, 0.7)' };

    // --- Gamification Constants ---
    const POINT_VALUES = {
        REGISTER: 50,
        FIRST_REPORT: 100, // Bonus points for the very first report
        SUBMIT_REPORT: 20, // Base points for any report
        REPORT_WITH_IMAGE: 15, // Bonus points if report has image
        REPORT_WITH_DESCRIPTION: 5, // Bonus points for description > 50 chars
        USE_AI_IMAGE: 10,
        USE_AI_TEXT: 5,
        REPORT_RESOLVED: 50, // Points when *your* report is resolved
        CREATE_FORUM_POST: 15,
        CREATE_FORUM_COMMENT: 5,
        GIVE_UPVOTE: 1, // Points for giving an upvote
    };
    const LEVELS = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000]; // RP for levels 1 to 10
    const LEVEL_NAMES = [
        "Civic Starter", "Observer", "Reporter", "Contributor", "Community Pillar",
        "City Guardian", "Urban Advocate", "Neighborhood Hero", "City Visionary",
        "Nation Builder", "Singapore Changemaker"
    ];

    const BADGES = {
        // --- Account & First Actions ---
        'register_welcome': { name: "Welcome Aboard!", description: "Joined SGResolve.", icon: "👋" },
        'first_report': { name: "First Responder", description: "Submitted your first report.", icon: "☝️" },
        'shutterbug': { name: "Shutterbug", description: "Submitted your first report with an image.", icon: "📸" },
        'ai_image_user': { name: "AI Assistant (Image)", description: "Used the AI Image Analyzer.", icon: "🖼️🤖" },
        'ai_text_user': { name: "AI Assistant (Text)", description: "Used the AI Text Analyzer.", icon: "📝🤖" },
        'forum_founder': { name: "Forum Founder", description: "Created your first forum post.", icon: "💬" },
        'commentator': { name: "Commentator", description: "Made your first forum comment.", icon: "🗣️" },

        // --- Reporting Milestones ---
        'reporter_5': { name: "Junior Reporter", description: "Submitted 5 reports.", icon: "📰" },
        'reporter_10': { name: "Seasoned Reporter", description: "Submitted 10 reports.", icon: "🗞️" },
        'reporter_25': { name: "Veteran Reporter", description: "Submitted 25 reports.", icon: "🏆" },
        'shutterbug_5': { name: "Photo Enthusiast", description: "Submitted 5 reports with images.", icon: "📷✨" },

        // --- Resolution Milestones ---
        'resolved_1': { name: "Problem Solver", description: "Your first report was resolved!", icon: "✅" },
        'resolved_5': { name: "Consistent Solver", description: "Got 5 of your reports resolved.", icon: "🛠️" },

        // --- Forum Milestones ---
        'forum_contributor_5': { name: "Forum Contributor", description: "Created 5 forum posts.", icon: "✍️" },
        'active_commentator_10': { name: "Active Commentator", description: "Made 10 forum comments.", icon: "🗣️💬" },
        'upvoter_10': { name: "Community Supporter", description: "Gave 10 upvotes.", icon: "👍➕" },
    };


    // Page Elements
    const pages = {
        landing: document.getElementById('landing-page'),
        login: document.getElementById('login-page'),
        register: document.getElementById('register-page'),
        admin: document.getElementById('admin-page'),
        reporting: document.getElementById('reporting-page'),
        myReports: document.getElementById('my-reports-page'),
        community: document.getElementById('community-forum-page'),
        about: document.getElementById('about-page'),
        nearbyReports: document.getElementById('nearby-reports-page'),
        profile: document.getElementById('profile-page'), // Added profile page
    };

    const navbar = document.getElementById('navbar');
    const menuToggle = document.querySelector('.menu-toggle');
    const navbarUl = document.getElementById('navbar-ul'); // Assuming your UL has this ID

    if (menuToggle && navbar && navbarUl) {
        menuToggle.addEventListener('click', () => {
            const isOpened = navbar.classList.toggle('nav-open');
            menuToggle.setAttribute('aria-expanded', isOpened);
        });
    }

    // --- Helper Functions ---
    function hideAllPages() {
        Object.values(pages).forEach(page => {
            if (page) { page.style.display = 'none'; page.classList.remove('show'); }
        });
    }

    function showPage(pageId) {
        const pageToShow = pages[pageId];
        if (!pageToShow) { console.error(`Attempted to show a non-existent page: ${pageId}`); return; }

        hideAllPages();
        pageToShow.style.display = 'block';
        // Use setTimeout to allow the display change to render before adding the class for transition
        setTimeout(() => {
            pageToShow.classList.add('show');
        }, 10); // Small delay

        // Invalidate maps or render content specific to the shown page
        if (pageId === 'reporting') {
            if (reportingMap) reportingMap.invalidateSize();
            // Reset CAPTCHA when showing reporting page
            if (typeof grecaptcha !== 'undefined' && grecaptcha) {
                try {
                    const widgetContainer = document.getElementById('recaptcha-container');
                    const widgetId = widgetContainer?.getAttribute('data-widget-id');
                    if (widgetId) {
                        grecaptcha.reset(widgetId);
                    } else {
                        grecaptcha.reset(); // Fallback
                    }
                    const submitBtn = document.getElementById('submit-report-button');
                    if (submitBtn) submitBtn.disabled = true;
                    const recaptchaError = document.getElementById('recaptcha-error');
                    if (recaptchaError) recaptchaError.style.display = 'none';

                } catch (e) {
                    console.error("Error resetting reCAPTCHA on page show:", e);
                }
            }
        }
        else if (pageId === 'admin' && adminMap) { adminMap.invalidateSize(); renderAdminReports(); renderAdminAnalytics(); }
        else if (pageId === 'nearbyReports' && nearbyMap) nearbyMap.invalidateSize();
        else if (pageId === 'about') initializeAboutPageObserver();
        else if (pageId === 'myReports' && currentUser) renderUserReports();
        else if (pageId === 'community') renderForumPosts(); // Initial render
        else if (pageId === 'profile' && currentUserData) renderProfilePage(); // Render profile if shown
    }

    function updateNavbar() {
        const loggedIn = !!currentUser;
        navbar.style.display = loggedIn ? 'block' : 'none'; // Use block for navbar

        // Show/hide gamification elements based on login state
        const gamificationElements = document.querySelectorAll('.gamification-nav');
        gamificationElements.forEach(el => {
            el.style.display = loggedIn ? 'inline-block' : 'none';
        });
        const profileLink = document.getElementById('nav-profile');
        if (profileLink) profileLink.parentElement.style.display = loggedIn ? 'list-item' : 'none';

        // Call UI update AFTER ensuring currentUserData might be loaded
        updateGamificationUI(); // Update RP/Level display
    }

    // --- MODIFIED: Central Popup function now only logs to console ---
    function showPopup(message, type = 'info', pointsEarned = 0, autoClose = true) {
        // Log based on type to differentiate messages in console
        switch (type) {
            case 'error':
                console.error(`[Popup Stub - Error]: ${message}`);
                break;
            case 'warning':
                console.warn(`[Popup Stub - Warning]: ${message}`);
                break;
            case 'success':
                console.log(`[Popup Stub - Success]: ${message}`);
                break;
            default: // info
                console.info(`[Popup Stub - Info]: ${message}`);
        }

        // NOTE: The original DOM manipulation for the popup overlay, icon, message,
        // close button, and auto-close timeout is intentionally removed.
        // Also, the associated HTML and event listeners for closing the popup
        // ('popup-close' click, Escape key) are no longer functional with this change.
    }
    // Removed popup close listeners as the popup itself is disabled.
    // document.getElementById('popup-close')?.addEventListener('click', () => { /* ... */ });
    // document.addEventListener('keydown', (e) => { /* ... */ });

    // --- REMOVED Badge Earned Modal Popup Function ---
    // Badge notifications will now be logged directly to console in awardPointsAndCheckBadges
    // function showBadgeEarnedPopup(badgeId) { /* ... */ }

    // --- Sidebar RP Notification Function (Remains unchanged) ---
    function showRpNotification(message, points) {
        const sidebar = document.getElementById('rp-notification-sidebar');
        const messageEl = sidebar?.querySelector('.rp-message');
        const pointsEl = sidebar?.querySelector('.rp-points');

        if (!sidebar || !messageEl || !pointsEl || points <= 0) {
            // console.log("RP Notification not shown (sidebar element missing or points <= 0)");
            return; // Don't show if element missing or no points
        }

        // Clear existing timeouts if a new notification comes quickly
        clearTimeout(rpNotificationTimeout);
        sidebar.classList.remove('fade-out'); // Remove fade-out if it was in progress

        messageEl.textContent = message;
        pointsEl.textContent = `+${points} RP`;

        sidebar.classList.add('show');

        // Set timeout to hide the notification
        rpNotificationTimeout = setTimeout(() => {
            sidebar.classList.add('fade-out'); // Start fading out

            // Use another timeout to fully hide after fade-out animation completes
            setTimeout(() => {
                sidebar.classList.remove('show', 'fade-out');
            }, 500); // Match the fade-out duration in CSS (0.5s)

        }, 4000); // Show for 4 seconds before starting fade
    }


    // --- Gamification Functions ---

    // NEW function specifically for initial user creation (includes new counters)
    async function initializeFirestoreUser(userId, displayName) {
        if (!userId) return;
        const userRef = doc(db, "users", userId);
        console.log(`Initializing NEW Firestore user document for ${userId}`);
        try {
            await setDoc(userRef, {
                displayName: displayName || 'User',
                resolvePoints: 0,
                level: 1,
                earnedBadges: [],
                // Counters
                reportCount: 0,
                reportWithImageCount: 0,
                resolvedReportCount: 0, // Reports SUBMITTED BY USER that got resolved
                forumPostCount: 0,
                forumCommentCount: 0,
                upvoteGivenCount: 0,   // <-- ADDED COUNTER
                // Timestamps
                createdAt: new Date(),
                lastLogin: new Date() // Optional: track last login
            });
            console.log(`Successfully initialized Firestore user ${userId}`);
        } catch (error) {
            console.error(`Failed to initialize Firestore user data for ${userId}:`, error);
            throw error; // Propagate the error
        }
    }

    // Fetch and store user data from Firestore (handles new counters)
    async function fetchAndSetCurrentUserData(userId) {
        if (!userId) {
            currentUserData = null;
            updateGamificationUI();
            return;
        }
        try {
            const userRef = doc(db, "users", userId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                currentUserData = { uid: userId, ...userSnap.data() };
                // Ensure defaults for ALL fields, including new ones
                currentUserData.displayName = currentUserData.displayName ?? auth.currentUser?.displayName ?? 'User';
                currentUserData.resolvePoints = currentUserData.resolvePoints ?? 0;
                currentUserData.level = currentUserData.level ?? 1;
                currentUserData.earnedBadges = currentUserData.earnedBadges ?? [];
                currentUserData.reportCount = currentUserData.reportCount ?? 0;
                currentUserData.reportWithImageCount = currentUserData.reportWithImageCount ?? 0;
                currentUserData.resolvedReportCount = currentUserData.resolvedReportCount ?? 0;
                currentUserData.forumPostCount = currentUserData.forumPostCount ?? 0;
                currentUserData.forumCommentCount = currentUserData.forumCommentCount ?? 0;
                currentUserData.upvoteGivenCount = currentUserData.upvoteGivenCount ?? 0; // <-- ADDED DEFAULT
            } else {
                console.log("User document not found in Firestore, initializing...");
                const authDisplayName = auth.currentUser?.displayName || 'User';
                await initializeFirestoreUser(userId, authDisplayName); // Use the clean initialization function

                // Re-fetch after initialization
                const newUserSnap = await getDoc(userRef);
                if (newUserSnap.exists()) {
                    currentUserData = { uid: userId, ...newUserSnap.data() };
                    // Apply defaults again
                    currentUserData.displayName = currentUserData.displayName ?? authDisplayName;
                    currentUserData.resolvePoints = currentUserData.resolvePoints ?? 0;
                    currentUserData.level = currentUserData.level ?? 1;
                    currentUserData.earnedBadges = currentUserData.earnedBadges ?? [];
                    currentUserData.reportCount = currentUserData.reportCount ?? 0;
                    currentUserData.reportWithImageCount = currentUserData.reportWithImageCount ?? 0;
                    currentUserData.resolvedReportCount = currentUserData.resolvedReportCount ?? 0;
                    currentUserData.forumPostCount = currentUserData.forumPostCount ?? 0;
                    currentUserData.forumCommentCount = currentUserData.forumCommentCount ?? 0;
                    currentUserData.upvoteGivenCount = currentUserData.upvoteGivenCount ?? 0; // <-- ADDED DEFAULT
                } else {
                    console.error("Failed to fetch user data even after initialization attempt.");
                    // Fallback structure
                    currentUserData = { uid: userId, displayName: authDisplayName, resolvePoints: 0, level: 1, earnedBadges: [], reportCount: 0, reportWithImageCount: 0, resolvedReportCount: 0, forumPostCount: 0, forumCommentCount: 0, upvoteGivenCount: 0 };
                }
            }
            console.log("Fetched currentUserData:", currentUserData);
            updateGamificationUI(); // Update display elements
        } catch (error) {
            console.error("Error fetching user data:", error);
            currentUserData = { uid: userId, displayName: auth.currentUser?.displayName || 'User', resolvePoints: 0, level: 1, earnedBadges: [], reportCount: 0, reportWithImageCount: 0, resolvedReportCount: 0, forumPostCount: 0, forumCommentCount: 0, upvoteGivenCount: 0 };
            updateGamificationUI();
            console.error("Error fetching user profile data."); // Log error
        }
    }


    // Update Navbar RP/Level display
    function updateGamificationUI() {
        const rpDisplay = document.getElementById('user-rp-display');
        const levelDisplay = document.getElementById('user-level-display');

        if (currentUserData) {
            const points = currentUserData.resolvePoints || 0;
            const level = currentUserData.level || 1;
            if (rpDisplay) rpDisplay.textContent = `RP: ${points}`;
            if (levelDisplay) levelDisplay.textContent = `Level: ${level}`;
        } else {
            if (rpDisplay) rpDisplay.textContent = `RP: -`;
            if (levelDisplay) levelDisplay.textContent = `Level: -`;
        }
        if (pages.profile && pages.profile.classList.contains('show')) {
            renderProfilePage();
        }
    }

    // Calculate user level based on points
    function calculateLevel(points) {
        let level = 1;
        for (let i = LEVELS.length - 1; i >= 0; i--) {
            if (points >= LEVELS[i]) {
                level = i + 1;
                break;
            }
        }
        return Math.min(level, LEVEL_NAMES.length); // Cap level at max defined name
    }

    // Calculate points needed for the next level
    function getPointsForNextLevel(currentPoints) {
        const currentLevel = calculateLevel(currentPoints);
        if (currentLevel >= LEVELS.length) {
            return { pointsNeeded: 0, nextLevelPoints: currentPoints, currentLevelPoints: LEVELS[LEVELS.length - 1] }; // Max level
        }
        const nextLevelPoints = LEVELS[currentLevel];
        const currentLevelPoints = LEVELS[currentLevel - 1] || 0;
        const pointsNeeded = nextLevelPoints - currentPoints;
        return { pointsNeeded, nextLevelPoints, currentLevelPoints };
    }

    // Calculate progress percentage towards the next level
    function getLevelProgress(currentPoints) {
        const levelInfo = getPointsForNextLevel(currentPoints);
        const currentLevel = calculateLevel(currentPoints);

        if (currentLevel >= LEVELS.length) return 100;

        const pointsInCurrentLevel = currentPoints - levelInfo.currentLevelPoints;
        const pointsForThisLevel = levelInfo.nextLevelPoints - levelInfo.currentLevelPoints;

        if (pointsForThisLevel <= 0) return 100; // Avoid division by zero

        return Math.max(0, Math.min(100, (pointsInCurrentLevel / pointsForThisLevel) * 100));
    }

    // --- MODIFIED: Core function to award points, check badges, logs badge/level events ---
    async function awardPointsAndCheckBadges(userId, pointsToAdd, actionType, data = {}) {
        if (!userId || !currentUser) return 0; // Ensure user is logged in

        if (currentUser.email === 'admin@sgresolve.com') { console.log("Admin actions do not earn points."); return 0; }
        if (pointsToAdd < 0 && actionType !== 'checkOnly') { console.warn("Attempted to award negative points. Ignoring."); return 0; }

        const userRef = doc(db, "users", userId);
        let awardedPointsActual = 0;
        let newBadgesEarnedIds = [];
        let levelIncreased = false;
        let initialLevel = 1;
        let finalLevelAfterUpdate = 1; // To store the level *after* update for logging

        try {
            await runTransaction(db, async (transaction) => {
                const userSnap = await transaction.get(userRef);
                if (!userSnap.exists()) throw new Error(`User document ${userId} missing during transaction.`);

                const userData = userSnap.data();
                const currentPoints = userData.resolvePoints ?? 0;
                initialLevel = userData.level ?? 1; // Store level before changes
                const earnedBadges = userData.earnedBadges ?? [];
                let reportCount = userData.reportCount ?? 0;
                let reportWithImageCount = userData.reportWithImageCount ?? 0;
                let resolvedReportCount = userData.resolvedReportCount ?? 0;
                let forumPostCount = userData.forumPostCount ?? 0;
                let forumCommentCount = userData.forumCommentCount ?? 0;
                let upvoteGivenCount = userData.upvoteGivenCount ?? 0;

                let pointsToAwardTotal = pointsToAdd;
                const hasBadge = (badgeId) => earnedBadges.includes(badgeId) || newBadgesEarnedIds.includes(badgeId);
                const checkAndStageBadge = (badgeId, condition) => { if (condition && !hasBadge(badgeId)) newBadgesEarnedIds.push(badgeId); };

                // --- Action Processing & Counter Updates ---
                switch (actionType) {
                    case 'register':
                        checkAndStageBadge('register_welcome', true);
                        break;
                    case 'submitReport':
                        reportCount++;
                        if (reportCount === 1) {
                            pointsToAwardTotal += POINT_VALUES.FIRST_REPORT;
                        }
                        checkAndStageBadge('first_report', reportCount === 1);
                        checkAndStageBadge('reporter_5', reportCount === 5);
                        checkAndStageBadge('reporter_10', reportCount === 10);
                        checkAndStageBadge('reporter_25', reportCount === 25);
                        if (data.hasImage) {
                            reportWithImageCount++;
                            checkAndStageBadge('shutterbug', reportWithImageCount === 1);
                            checkAndStageBadge('shutterbug_5', reportWithImageCount === 5);
                        }
                        break;
                    case 'useAiImage':
                        checkAndStageBadge('ai_image_user', !hasBadge('ai_image_user'));
                        break;
                    case 'useAiText':
                        checkAndStageBadge('ai_text_user', !hasBadge('ai_text_user'));
                        break;
                    case 'reportResolved':
                        resolvedReportCount++;
                        checkAndStageBadge('resolved_1', resolvedReportCount === 1);
                        checkAndStageBadge('resolved_5', resolvedReportCount === 5);
                        break;
                    case 'createForumPost':
                        forumPostCount++;
                        checkAndStageBadge('forum_founder', forumPostCount === 1);
                        checkAndStageBadge('forum_contributor_5', forumPostCount === 5);
                        break;
                    case 'createForumComment':
                        forumCommentCount++;
                        checkAndStageBadge('commentator', forumCommentCount === 1);
                        checkAndStageBadge('active_commentator_10', forumCommentCount === 10);
                        break;
                    case 'giveUpvote':
                        upvoteGivenCount++;
                        checkAndStageBadge('upvoter_10', upvoteGivenCount === 10);
                        break;
                    case 'checkOnly': break; // No points, just badge check
                }
                // --- End Action Processing ---

                const finalPoints = currentPoints + pointsToAwardTotal;
                finalLevelAfterUpdate = calculateLevel(finalPoints); // Calculate final level
                const finalBadges = [...earnedBadges, ...newBadgesEarnedIds];
                levelIncreased = finalLevelAfterUpdate > initialLevel; // Check if level changed

                const updateData = {
                    resolvePoints: finalPoints, level: finalLevelAfterUpdate, earnedBadges: finalBadges,
                    reportCount, reportWithImageCount, resolvedReportCount,
                    forumPostCount, forumCommentCount, upvoteGivenCount,
                };
                transaction.update(userRef, updateData);
                awardedPointsActual = pointsToAwardTotal;
            }); // End Transaction

            console.log(`Transaction successful: Awarded ${awardedPointsActual} points to ${userId}. New badges checked: ${newBadgesEarnedIds.join(', ')}`);

            // Update local state AFTER successful transaction
            if (currentUser && currentUser.uid === userId) {
                await fetchAndSetCurrentUserData(userId); // Fetch fresh data

                // *** Log Badge and Level Up events to CONSOLE ***
                newBadgesEarnedIds.forEach(badgeId => {
                    const badge = BADGES[badgeId];
                    if (badge) {
                        console.info(`%cBadge Earned: ${badge.icon} ${badge.name}! (${badge.description})`, 'color: blue; font-weight: bold;');
                    }
                });
                if (levelIncreased) {
                    console.info(`%cCongratulations! You reached Level ${finalLevelAfterUpdate}! (${LEVEL_NAMES[finalLevelAfterUpdate - 1] || ''})`, 'color: green; font-weight: bold;');
                }
            }
            return awardedPointsActual; // Return points awarded in *this specific call*

        } catch (error) {
            console.error("Error in awardPointsAndCheckBadges transaction:", error);
            if (error.message.includes("User document missing")) {
                console.error("Critical error updating profile. Please try logging out and back in."); // Log error
            }
            return 0; // Indicate failure or no points awarded
        }
    }


    // Render Profile Page Content
    function renderProfilePage() {
        const profilePage = pages.profile;
        if (!profilePage || !currentUserData || !currentUser) {
            console.log("Cannot render profile: Page element, user data or current user missing.");
            if (profilePage) profilePage.innerHTML = '<p class="loading-message">Loading profile...</p>';
            if (!currentUserData && currentUser) {
                fetchAndSetCurrentUserData(currentUser.uid);
            }
            return;
        }

        // --- Ensure the FULL profile structure exists ---
        if (!document.getElementById('profile-username') || !document.getElementById('profile-email-display') || !document.getElementById('change-password-form')) {
            profilePage.innerHTML = `
                <h1>My Profile & Achievements</h1>
                <div class="profile-summary card">
                    <h2 id="profile-username">Username</h2>
                    <p>Level: <strong id="profile-level">1</strong> (<span id="profile-level-name">Civic Starter</span>)</p>
                    <p>Resolve Points (RP): <strong id="profile-rp">0</strong></p>
                    <div class="progress-bar-container"><div id="level-progress-bar" class="progress-bar-fill"></div></div>
                    <p><small id="rp-to-next-level">XXX RP to next level</small></p>
                </div>
                <div class="profile-details card">
                    <h2>Account Details</h2>
                    <p><strong>Email:</strong> <span id="profile-email-display">Loading...</span></p>
                    <form id="update-profile-form">
                        <label for="profile-new-name"><strong>Display Name:</strong></label>
                        <div style="display: flex; align-items: center; gap: 10px; margin-top: 5px;">
                            <input type="text" id="profile-new-name" placeholder="Your display name" required style="flex-grow: 1;">
                            <button type="submit" id="update-profile-button" class="button primary-button">Update Name</button>
                        </div>
                    </form>
                    <p id="update-profile-message" class="form-message"></p>
                </div>
                <div class="change-password card">
                    <h2>Change Password</h2>
                    <form id="change-password-form">
                        <label for="current-password">Current Password:</label>
                        <input type="password" id="current-password" required autocomplete="current-password">
                        <label for="new-password">New Password:</label>
                        <input type="password" id="new-password" required autocomplete="new-password" minlength="6">
                        <label for="confirm-new-password">Confirm New Password:</label>
                        <input type="password" id="confirm-new-password" required autocomplete="new-password">
                        <button type="submit" id="change-password-button" class="button secondary-button">Change Password</button>
                    </form>
                    <p id="change-password-message" class="form-message"></p>
                </div>
                <div class="profile-badges card">
                    <h2>My Badges</h2>
                    <div id="badges-container" class="badges-grid"><p id="no-badges-message" style="display: none;">...</p></div>
                </div>`;
            attachProfileEventListeners(); // Re-add listeners if structure rebuilt
        }

        // Populate Summary
        const currentDisplayName = currentUserData.displayName || currentUser.displayName || 'User';
        document.getElementById('profile-username').textContent = currentDisplayName;
        const points = currentUserData.resolvePoints || 0;
        const level = currentUserData.level || 1;
        const levelName = LEVEL_NAMES[level - 1] || 'Contributor';
        document.getElementById('profile-level').textContent = level;
        document.getElementById('profile-rp').textContent = points;
        const levelNameEl = document.getElementById('profile-level-name');
        if (levelNameEl) levelNameEl.textContent = levelName;

        // Populate Progress Bar
        const progressBar = document.getElementById('level-progress-bar');
        const progressPercent = getLevelProgress(points);
        if (progressBar) progressBar.style.width = `${progressPercent}%`;
        const nextLevelInfo = getPointsForNextLevel(points);
        const rpToNextEl = document.getElementById('rp-to-next-level');
        if (rpToNextEl) {
            if (level >= LEVELS.length) {
                rpToNextEl.textContent = "Max Level Reached!";
                if (progressBar) progressBar.style.width = '100%';
            } else {
                rpToNextEl.textContent = `${nextLevelInfo.pointsNeeded} RP to Level ${level + 1} (${LEVEL_NAMES[level] || ''})`;
            }
        }

        // Populate Profile Details
        const emailDisplay = document.getElementById('profile-email-display');
        const nameInput = document.getElementById('profile-new-name');
        if (emailDisplay) emailDisplay.textContent = currentUser.email || 'N/A';
        if (nameInput) nameInput.value = currentDisplayName; // Pre-fill input

        // Populate Badges
        const badgesContainer = document.getElementById('badges-container');
        const noBadgesMessage = document.getElementById('no-badges-message');
        if (!badgesContainer || !noBadgesMessage) return;
        badgesContainer.innerHTML = ''; // Clear previous
        const earnedBadges = currentUserData.earnedBadges || [];
        if (earnedBadges.length === 0) {
            noBadgesMessage.textContent = "You haven't earned any badges yet. Keep contributing!"; // Update message
            noBadgesMessage.style.display = 'block';
        } else {
            noBadgesMessage.style.display = 'none';
            earnedBadges.forEach(badgeId => {
                const badgeInfo = BADGES[badgeId];
                if (badgeInfo) {
                    const badgeDiv = document.createElement('div');
                    badgeDiv.classList.add('badge-item');
                    badgeDiv.title = `${badgeInfo.name}: ${badgeInfo.description}`;
                    badgeDiv.innerHTML = `
                         <span class="badge-icon" aria-hidden="true">${badgeInfo.icon}</span>
                         <span class="badge-name">${badgeInfo.name}</span>
                         <span class="badge-description">${badgeInfo.description}</span>
                     `;
                    badgesContainer.appendChild(badgeDiv);
                } else {
                    console.warn(`Badge info not found for ID: ${badgeId}`);
                }
            });
        }
        // Clear any previous messages
        const updateMsg = document.getElementById('update-profile-message');
        const changePwMsg = document.getElementById('change-password-message');
        if (updateMsg) updateMsg.textContent = '';
        if (changePwMsg) changePwMsg.textContent = '';
        if (document.getElementById('change-password-form')) document.getElementById('change-password-form').reset();
    }


    // --- Report Fetching & Rendering Functions ---
    async function fetchReports(userId = null) {
        try {
            let reportsQuery;
            const reportsCollection = collection(db, "reports");
            const constraints = [orderBy("timestamp", "desc")];
            if (userId) {
                constraints.unshift(where("userId", "==", userId));
            }
            reportsQuery = query(reportsCollection, ...constraints);

            const querySnapshot = await getDocs(reportsQuery);
            const reports = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const latitude = parseFloat(data.latitude);
                const longitude = parseFloat(data.longitude);
                if (isNaN(latitude) || isNaN(longitude)) {
                    console.warn(`Report ${doc.id} has invalid coordinates: lat=${data.latitude}, lon=${data.longitude}`);
                }
                reports.push({
                    id: doc.id,
                    ...data,
                    latitude: latitude,
                    longitude: longitude,
                    timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : (data.timestamp ? new Date(data.timestamp) : new Date())
                });
            });
            return reports;
        } catch (error) {
            console.error('Error fetching reports:', error);
            // showPopup(`Error fetching reports: ${error.message}`, 'error', 0, false); // REPLACED
            console.error(`Error fetching reports: ${error.message}`); // Log error
            return [];
        }
    }
    async function fetchReportsThisMonth() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const reportsCollection = collection(db, "reports");
        const q = query(
            reportsCollection,
            where("timestamp", ">=", startOfMonth),
            where("timestamp", "<=", endOfMonth)
        );
        try {
            const querySnapshot = await getDocs(q);
            const reports = [];
            querySnapshot.forEach((doc) => { reports.push({ id: doc.id, ...doc.data() }); });
            return reports;
        } catch (error) {
            console.error("Error fetching reports for this month:", error);
            return [];
        }
    }
    function applyFilters(allReports) {
        const imageFilter = document.getElementById('image-filter')?.value || 'all';
        const categoryFilter = document.getElementById('category-filter')?.value || 'all';
        const urgencyFilter = document.getElementById('urgency-filter')?.value || 'all';
        const threatFilter = document.getElementById('threat-filter')?.value || 'all';

        let filteredReports = allReports.slice(); // Shallow copy

        if (imageFilter !== 'all') {
            filteredReports = filteredReports.filter(report => {
                const hasImage = !!report.imageUrl;
                return imageFilter === 'with' ? hasImage : !hasImage;
            });
        }
        if (categoryFilter !== 'all') { filteredReports = filteredReports.filter(report => report.category === categoryFilter); }
        if (urgencyFilter !== 'all') { filteredReports = filteredReports.filter(report => report.urgency === urgencyFilter); }
        if (threatFilter !== 'all') { filteredReports = filteredReports.filter(report => report.threat === threatFilter); }

        return filteredReports;
    }
    function renderAdminMap(reportsToDisplay) {
        if (!adminMap) return;
        // Clear existing markers
        adminReportMarkers.forEach(marker => adminMap.removeLayer(marker));
        adminReportMarkers = [];

        if (!reportsToDisplay || reportsToDisplay.length === 0) {
            // adminMap.setView([1.3521, 103.8198], 11); // Optional reset
            return;
        }

        let validMarkersExist = false;
        reportsToDisplay.forEach(report => {
            if (typeof report.latitude === 'number' && typeof report.longitude === 'number' &&
                !isNaN(report.latitude) && !isNaN(report.longitude)) {

                const marker = L.marker([report.latitude, report.longitude]).addTo(adminMap);
                let popupContent = `
                    <strong>${report.locationName || 'N/A'}</strong><br>
                    Cat: ${report.category || 'N/A'} | Status: ${report.status || 'N/A'}<br>
                    Urgency: <span class="urgency-${(report.urgency || '').toLowerCase()}">${report.urgency || 'N/A'}</span> |
                    Threat: <span class="threat-${(report.threat || '').toLowerCase()}">${report.threat || 'N/A'}</span><br>
                    <small>Submitted: ${report.timestamp ? report.timestamp.toLocaleString() : 'N/A'}</small>`;
                if (report.imageUrl) {
                    popupContent += `<br><a href="${report.imageUrl}" target="_blank" rel="noopener noreferrer" title="View full image">
                                        <img src="${report.imageUrl}" alt="Report Image" class="popup-report-image">
                                      </a>`;
                }
                marker.bindPopup(popupContent);
                adminReportMarkers.push(marker);
                validMarkersExist = true;
            } else {
                console.warn(`Skipping marker for report ${report.id} due to invalid coordinates.`);
            }
        });

        if (validMarkersExist && adminReportMarkers.length > 0) {
            try {
                const group = new L.featureGroup(adminReportMarkers);
                adminMap.fitBounds(group.getBounds().pad(0.1));
            } catch (e) {
                console.error("Error fitting map bounds:", e);
                adminMap.setView([1.3521, 103.8198], 11); // Fallback view
            }
        } else if (reportsToDisplay.length > 0 && !validMarkersExist) {
            adminMap.setView([1.3521, 103.8198], 11);
        } else {
            adminMap.setView([1.3521, 103.8198], 11);
        }
    }
    // Helper to create status dropdown for admin reports
    function createStatusDropdown(currentStatus = 'Pending') {
        const statuses = ['Pending', 'In Progress', 'Resolved'];
        let optionsHtml = statuses.map(status =>
            `<option value="${status}" ${status === currentStatus ? 'selected' : ''}>${status}</option>`
        ).join('');
        return `
            <div style="display: flex; gap: 5px; align-items: center; margin-top: 5px;">
              <select class="status-update" aria-label="Update status">
                ${optionsHtml}
              </select>
              <button class="button secondary-button update-status-btn" style="padding: 5px 10px; font-size: 0.85rem;">Update</button>
            </div>
        `;
    }
    async function renderAdminReports() {
        const adminReportsContainer = document.getElementById('admin-reports-container');
        if (!adminReportsContainer) return;
        adminReportsContainer.innerHTML = '<p class="loading-message">Loading reports...</p>';

        try {
            const allReports = await fetchReports();
            const filteredReports = applyFilters(allReports);
            adminReportsContainer.innerHTML = '';

            if (filteredReports.length === 0) {
                adminReportsContainer.innerHTML = '<p class="no-data-message">No reports match the current filters.</p>';
                renderAdminMap([]); // Clear map
                return;
            }

            filteredReports.forEach(report => {
                const li = document.createElement('li');
                li.setAttribute('data-report-id', report.id);

                const reportTimestamp = report.timestamp ? report.timestamp.toLocaleString() : 'N/A';
                const imageHtml = report.imageUrl
                    ? `<a href="${report.imageUrl}" target="_blank" rel="noopener noreferrer" title="View full image"><img src="${report.imageUrl}" alt="Report Image" class="report-image"></a>`
                    : '<p><em>No image submitted.</em></p>';

                li.innerHTML = `
                    <div class="report-content">
                         <h3>${report.locationName || 'Unknown Location'}</h3>
                         <p><strong>Desc:</strong> ${report.description || 'No description.'}</p>
                         <p><strong>Submitted by:</strong> ${report.userName || 'Unknown User'} on ${reportTimestamp}</p>
                         ${imageHtml}
                    </div>
                    <div class="report-meta">
                        <span class="category">${report.category || 'N/A'}</span>
                        <span class="urgency urgency-${(report.urgency || 'N/A').toLowerCase()}">${report.urgency || 'N/A'}</span>
                        <span class="threat threat-${(report.threat || 'N/A').toLowerCase()}">${report.threat || 'N/A'}</span>
                    </div>
                    <div class="report-actions">
                         <p><strong>Status:</strong> <span class="report-status">${report.status || 'N/A'}</span></p>
                         ${createStatusDropdown(report.status || 'Pending')}
                         <p style="margin-top: 10px;"><strong>Suggested Agency:</strong>
                            <span class="suggested-agency-display" id="suggested-agency-${report.id}">Loading...</span>
                         </p>
                         <button class="button danger-button delete-report-btn" data-report-id="${report.id}" style="margin-top: 10px;">Delete Report</button>
                    </div>`;
                adminReportsContainer.appendChild(li);

                // --- NEW: Fetch and display suggested agency ---
                fetchAndDisplaySuggestedAgency(report.id, report.description, report.category, report.locationName);
                // --- END NEW ---
            });
            renderAdminMap(filteredReports); // Update map
        } catch (error) {
            console.error('Error rendering admin reports:', error);
            adminReportsContainer.innerHTML = '<p class="error-message">Error loading reports.</p>';
            renderAdminMap([]); // Clear map on error
        }
    }

    // --- NEW FUNCTION to fetch and display suggested agency ---
    async function fetchAndDisplaySuggestedAgency(reportId, description, category, locationName) {
        const agencyDisplayElement = document.getElementById(`suggested-agency-${reportId}`);
        if (!agencyDisplayElement) return;

        // Basic check to prevent calling API if critical info is missing for suggestion
        if (!description && !category) {
            agencyDisplayElement.textContent = 'N/A (Insufficient info)';
            agencyDisplayElement.style.color = '#777';
            return;
        }

        try {
            const response = await fetch(SUGGEST_AGENCY_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    description: description || "", // Send empty string if null/undefined
                    category: category || "",
                    locationName: locationName || ""
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Unknown API error" }));
                console.error(`Error fetching suggestion for report ${reportId}:`, response.status, errorData);
                agencyDisplayElement.textContent = `Error (${response.status})`;
                agencyDisplayElement.style.color = 'red';
                return;
            }

            const data = await response.json();
            if (data.suggested_agency) {
                agencyDisplayElement.textContent = data.suggested_agency;
                agencyDisplayElement.style.color = 'var(--primary-color)'; // Or any color you prefer
            } else if (data.error) {
                console.error(`API returned error for report ${reportId}:`, data.error);
                agencyDisplayElement.textContent = 'Suggestion Error';
                agencyDisplayElement.style.color = 'orange';
            }
            else {
                agencyDisplayElement.textContent = 'N/A';
                agencyDisplayElement.style.color = '#777';
            }
        } catch (error) {
            console.error(`Network or other error fetching suggestion for report ${reportId}:`, error);
            agencyDisplayElement.textContent = 'Unavailable';
            agencyDisplayElement.style.color = 'red';
        }
    }
    // --- END NEW FUNCTION ---

    async function renderUserReports() {
        if (!currentUser) return;
        const userReportsContainer = document.getElementById('user-reports-container');
        if (!userReportsContainer) return;
        userReportsContainer.innerHTML = '<p class="loading-message">Loading your reports...</p>';

        try {
            const userReports = await fetchReports(currentUser.uid);
            userReportsContainer.innerHTML = '';
            if (userReports.length === 0) {
                userReportsContainer.innerHTML = '<p class="no-data-message">You haven\'t submitted any reports yet.</p>';
                return;
            }
            userReports.forEach(report => {
                const li = document.createElement('li');
                li.setAttribute('data-report-id', report.id);
                const reportTimestamp = report.timestamp ? report.timestamp.toLocaleString() : 'N/A';
                const imageHtml = report.imageUrl
                    ? `<a href="${report.imageUrl}" target="_blank" rel="noopener noreferrer"><img src="${report.imageUrl}" alt="Report Image" class="user-report-image"></a>`
                    : '';

                li.innerHTML = `
                    <h3>${report.locationName || 'Unknown Location'}</h3>
                    <p><strong>Category:</strong> ${report.category || 'N/A'}</p>
                    <p><strong>Description:</strong> ${report.description || 'N/A'}</p>
                    <p><strong>Urgency:</strong> ${report.urgency || 'N/A'} | <strong>Threat:</strong> ${report.threat || 'N/A'}</p>
                    <p><strong>Status:</strong> ${report.status || 'N/A'}</p>
                    <p><strong>Submitted:</strong> ${reportTimestamp}</p>
                    ${imageHtml}
                `;
                userReportsContainer.appendChild(li);
            });
        } catch (error) {
            console.error('Error rendering user reports:', error);
            userReportsContainer.innerHTML = '<p class="error-message">Error loading your reports.</p>';
        }
    }
    async function renderAdminAnalytics() {
        const totalReportsEl = document.getElementById('stat-total-reports');
        const pendingReportsEl = document.getElementById('stat-pending-reports');
        const resolvedReportsEl = document.getElementById('stat-resolved-reports');
        const totalMonthEl = document.getElementById('total-reports-month');
        const statusChartCanvas = document.getElementById('status-chart');
        const noStatusDataEl = document.getElementById('no-status-data');
        const urgencyChartCanvas = document.getElementById('urgency-chart');
        const noUrgencyDataEl = document.getElementById('no-urgency-data');
        const categoryChartCanvas = document.getElementById('reports-chart');
        const noReportsMsgEl = document.getElementById('no-reports-message');

        const destroyChart = (instance) => { if (instance) instance.destroy(); };
        destroyChart(statusChartInstance); statusChartInstance = null;
        destroyChart(urgencyChartInstance); urgencyChartInstance = null;
        destroyChart(categoryChartInstance); categoryChartInstance = null;
        window.reportsChart = null; // Make sure this is cleared too

        if (statusChartCanvas) statusChartCanvas.style.display = 'block';
        if (noStatusDataEl) noStatusDataEl.style.display = 'none';
        if (urgencyChartCanvas) urgencyChartCanvas.style.display = 'block';
        if (noUrgencyDataEl) noUrgencyDataEl.style.display = 'none';
        if (categoryChartCanvas) categoryChartCanvas.style.display = 'block';
        if (noReportsMsgEl) noReportsMsgEl.style.display = 'none';

        try {
            const [allReports, reportsThisMonth] = await Promise.all([
                fetchReports(),
                fetchReportsThisMonth()
            ]);

            const totalReportsCount = allReports.length;
            const totalReportsMonthCount = reportsThisMonth.length;
            const statusCounts = { 'Pending': 0, 'In Progress': 0, 'Resolved': 0 };
            const urgencyCounts = { 'Low': 0, 'Medium': 0, 'High': 0 };
            const categoryCountsMonth = { 'Infrastructure': 0, 'Environmental': 0, 'Safety': 0, 'Others': 0 };

            allReports.forEach(report => {
                if (report.status && statusCounts.hasOwnProperty(report.status)) statusCounts[report.status]++;
                if (report.urgency && urgencyCounts.hasOwnProperty(report.urgency)) urgencyCounts[report.urgency]++;
            });
            reportsThisMonth.forEach(report => {
                const category = (report.category && categoryCountsMonth.hasOwnProperty(report.category)) ? report.category : 'Others';
                categoryCountsMonth[category]++;
            });

            if (totalReportsEl) totalReportsEl.textContent = totalReportsCount;
            if (pendingReportsEl) pendingReportsEl.textContent = statusCounts['Pending'];
            if (resolvedReportsEl) resolvedReportsEl.textContent = statusCounts['Resolved'];
            if (totalMonthEl) totalMonthEl.textContent = `Total this month: ${totalReportsMonthCount}`;

            // Status Chart
            const statusCtx = statusChartCanvas?.getContext('2d');
            const statusDataAvailable = Object.values(statusCounts).some(count => count > 0);
            if (statusChartCanvas) statusChartCanvas.style.display = statusDataAvailable ? 'block' : 'none';
            if (noStatusDataEl) noStatusDataEl.style.display = statusDataAvailable ? 'none' : 'block';
            if (statusCtx && statusDataAvailable) {
                statusChartInstance = new Chart(statusCtx, {
                    type: 'doughnut',
                    data: { labels: Object.keys(statusCounts), datasets: [{ data: Object.values(statusCounts), backgroundColor: Object.keys(statusCounts).map(status => STATUS_COLORS[status] || '#cccccc'), borderColor: '#fff', borderWidth: 2 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 15 } }, title: { display: false } } }
                });
            }

            // Urgency Chart
            const urgencyCtx = urgencyChartCanvas?.getContext('2d');
            const urgencyDataAvailable = Object.values(urgencyCounts).some(count => count > 0);
            if (urgencyChartCanvas) urgencyChartCanvas.style.display = urgencyDataAvailable ? 'block' : 'none';
            if (noUrgencyDataEl) noUrgencyDataEl.style.display = urgencyDataAvailable ? 'none' : 'block';
            if (urgencyCtx && urgencyDataAvailable) {
                urgencyChartInstance = new Chart(urgencyCtx, {
                    type: 'bar',
                    data: { labels: Object.keys(urgencyCounts), datasets: [{ data: Object.values(urgencyCounts), backgroundColor: Object.keys(urgencyCounts).map(urg => URGENCY_COLORS[urg] || '#cccccc'), borderColor: Object.keys(urgencyCounts).map(urg => (URGENCY_COLORS[urg] || '#cccccc').replace('0.7', '1')), borderWidth: 1 }] },
                    options: { indexAxis: 'x', responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true }, x: {} }, plugins: { legend: { display: false }, title: { display: false } } }
                });
            }

            // Category Chart (Monthly)
            const categoryCtx = categoryChartCanvas?.getContext('2d');
            const categoryDataAvailable = totalReportsMonthCount > 0;
            if (categoryChartCanvas) categoryChartCanvas.style.display = categoryDataAvailable ? 'block' : 'none';
            if (noReportsMsgEl) noReportsMsgEl.style.display = categoryDataAvailable ? 'none' : 'block';
            if (categoryCtx && categoryDataAvailable) {
                const allCategories = Object.keys(categoryCountsMonth);
                categoryChartInstance = new Chart(categoryCtx, {
                    type: 'bar',
                    data: { labels: allCategories, datasets: [{ data: allCategories.map(cat => categoryCountsMonth[cat]), backgroundColor: allCategories.map(cat => CATEGORY_COLORS_MONTHLY[cat] || '#cccccc'), borderColor: allCategories.map(cat => (CATEGORY_COLORS_MONTHLY[cat] || '#cccccc').replace('0.7', '1')), borderWidth: 1 }] },
                    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: '# Reports' } }, x: {} }, plugins: { legend: { display: false }, title: { display: false } } }
                });
                window.reportsChart = categoryChartInstance; // Assign to global if needed elsewhere
            } else {
                window.reportsChart = null;
            }

        } catch (error) {
            console.error("Error rendering admin analytics:", error);
            // showPopup("Error loading analytics data.", "error", 0, false); // REPLACED
            console.error("Error loading analytics data."); // Log error
            if (statusChartCanvas) statusChartCanvas.style.display = 'none';
            if (noStatusDataEl) { noStatusDataEl.textContent = 'Error loading status data.'; noStatusDataEl.style.display = 'block'; }
            if (urgencyChartCanvas) urgencyChartCanvas.style.display = 'none';
            if (noUrgencyDataEl) { noUrgencyDataEl.textContent = 'Error loading urgency data.'; noUrgencyDataEl.style.display = 'block'; }
            if (categoryChartCanvas) categoryChartCanvas.style.display = 'none';
            if (noReportsMsgEl) { noReportsMsgEl.textContent = 'Error loading category data.'; noReportsMsgEl.style.display = 'block'; }
        }
    }

    // --- Forum Functions ---
    function formatRichText(text) {
        if (!text) return '';
        const escapedText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return escapedText
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/\*(.*?)\*/g, '<em>$1</em>')         // Italics
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>') // Links
            .replace(/\n/g, '<br>');                      // Newlines
    }
    function getCategoryColor(category) {
        const colors = { General: '#4facfe', Issues: '#ff6b6b', Ideas: '#2ea44f', Events: '#f4a261' };
        return colors[category] || '#586069'; // Default grey
    }
    async function renderComments(postId) {
        const commentsList = document.querySelector(`.forum-post[data-post-id="${postId}"] .comments-list`);
        if (!commentsList) return;
        commentsList.innerHTML = '<li>Loading comments...</li>';
        try {
            const commentsQuery = query(collection(db, "forumPosts", postId, "comments"), orderBy("timestamp", "asc"));
            const querySnapshot = await getDocs(commentsQuery);
            commentsList.innerHTML = '';
            if (querySnapshot.empty) {
                commentsList.innerHTML = '<li>No comments yet. Be the first!</li>'; return;
            }
            querySnapshot.forEach((doc) => {
                const comment = doc.data();
                const commentTimestamp = comment.timestamp?.toDate ? new Date(comment.timestamp.toDate()) : new Date();
                const li = document.createElement('li');
                li.classList.add('comment-item');
                li.setAttribute('data-comment-id', doc.id);
                li.innerHTML = `
                    <div class="comment-content">
                        <span class="comment-author">${comment.author || 'Anonymous'}</span>
                        <span class="comment-timestamp">• ${commentTimestamp.toLocaleDateString()} ${commentTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <p>${formatRichText(comment.content)}</p>
                    </div>
                    <div class="comment-actions">
                        <button class="vote-btn upvote-comment" data-comment-id="${doc.id}" data-post-id="${postId}">👍 ${comment.upvotes || 0}</button>
                        <button class="vote-btn downvote-comment" data-comment-id="${doc.id}" data-post-id="${postId}">👎 ${comment.downvotes || 0}</button>
                        ${currentUser && currentUser.uid === comment.authorId ? `<button class="delete-comment-btn" data-comment-id="${doc.id}" data-post-id="${postId}">Delete</button>` : ''}
                    </div>`;
                commentsList.appendChild(li);
            });
        } catch (error) {
            console.error(`Error fetching comments for post ${postId}:`, error);
            commentsList.innerHTML = '<li>Error loading comments.</li>';
        }
    }
    function formatTimeAgo(date) {
        if (!(date instanceof Date) || isNaN(date)) return 'Invalid date';
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000; // Years
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000; // Months
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400; // Days
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600; // Hours
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60; // Minutes
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        if (seconds < 0) return "in the future";
        if (seconds < 10) return "just now";
        return Math.floor(seconds) + " seconds ago";
    }
    function createPostElement(post) {
        const postDiv = document.createElement('div');
        postDiv.classList.add('forum-post');
        if (post.pinned) postDiv.classList.add('pinned');
        postDiv.setAttribute('data-post-id', post.id);
        const postTimestamp = post.timestamp?.toDate ? new Date(post.timestamp.toDate()) : new Date();
        const timeAgo = formatTimeAgo(postTimestamp);

        const canDelete = currentUser && (currentUser.email === 'admin@sgresolve.com' || currentUser.uid === post.authorId);
        const deleteButtonHtml = canDelete ? `<button class="delete-post-btn" data-post-id="${post.id}" title="Delete Post">🗑️ Delete</button>` : '';
        const pinButtonHtml = (currentUser && currentUser.email === 'admin@sgresolve.com') ? `<button class="pin-btn" data-post-id="${post.id}" data-pinned="${post.pinned ? 'true' : 'false'}" title="${post.pinned ? 'Unpin Post' : 'Pin Post'}">${post.pinned ? 'Unpin' : 'Pin'}</button>` : '';

        postDiv.innerHTML = `
            <div class="post-header">
                 <span class="post-author">
                    ${post.pinned ? '<span class="pin-icon" title="Pinned Post">📌</span> ' : ''}
                    <a href="#" class="user-link" data-user="${post.authorId || ''}">${post.author || 'Anonymous'}</a>
                 </span>
                 <span class="post-meta">
                    • <span title="${postTimestamp.toLocaleString()}">${timeAgo}</span>
                    • <span class="post-category" style="background-color: ${getCategoryColor(post.category)}">${post.category}</span>
                 </span>
            </div>
            <h3>${post.title || 'Untitled Post'}</h3>
            <div class="post-content-preview">${formatRichText(post.content)}</div>
            <div class="post-actions">
                <button class="vote-btn upvote-post" data-post-id="${post.id}" title="Upvote">👍 ${post.upvotes || 0}</button>
                <button class="vote-btn downvote-post" data-post-id="${post.id}" title="Downvote">👎 ${post.downvotes || 0}</button>
                <button class="toggle-comments-btn" data-post-id="${post.id}" title="Show/Hide Comments">💬 Comments (${post.commentCount || 0})</button>
                ${pinButtonHtml}
                ${deleteButtonHtml}
             </div>
             <div class="comments-section" style="display: none;">
                 <h4>Comments</h4>
                 <ul class="comments-list"></ul>
                 <form class="comment-form">
                    <textarea placeholder="Add a comment..." required aria-label="Add a comment"></textarea>
                    <button type="submit" class="button primary-button">Comment</button>
                 </form>
            </div>`;
        return postDiv;
    }
    async function renderForumPosts(loadMore = false) {
        const forumPostsContainer = document.getElementById('forum-posts');
        const loadMoreButton = document.getElementById('load-more-posts');
        if (!forumPostsContainer) return;

        const existingNoMoreMsg = forumPostsContainer.querySelector('.no-more-posts-message');
        if (existingNoMoreMsg && !loadMore) existingNoMoreMsg.remove();

        if (!loadMore) {
            forumPostsContainer.innerHTML = '<p class="loading-message">Loading posts...</p>';
            lastVisiblePost = null; // Reset pagination
        } else if (loadMoreButton) {
            loadMoreButton.textContent = 'Loading...'; loadMoreButton.disabled = true;
        }
        isLoadingForumPosts = true;

        try {
            let postsQuery;
            const postsCollection = collection(db, "forumPosts");
            const baseConstraints = [orderBy("pinned", "desc"), orderBy("timestamp", "desc")];
            const fetchLimit = 10;

            if (loadMore && lastVisiblePost) {
                postsQuery = query(postsCollection, ...baseConstraints, startAfter(lastVisiblePost), limit(fetchLimit));
            } else {
                postsQuery = query(postsCollection, ...baseConstraints, limit(fetchLimit));
            }
            const querySnapshot = await getDocs(postsQuery);

            if (!loadMore) forumPostsContainer.innerHTML = ''; // Clear initial loading

            if (querySnapshot.empty && !loadMore) {
                forumPostsContainer.innerHTML = '<p class="no-data-message">No posts yet. Be the first to post!</p>';
                if (loadMoreButton) loadMoreButton.style.display = 'none';
            } else if (!querySnapshot.empty) {
                const postPromises = querySnapshot.docs.map(async (doc) => {
                    const post = { id: doc.id, ...doc.data() };
                    try {
                        // Use stored count if available and accurate, else query
                        if (typeof post.commentCount === 'number') {
                            // Trust stored count (can be updated via triggers/transactions)
                        } else {
                            const commentsSnap = await getDocs(collection(db, "forumPosts", post.id, "comments"));
                            post.commentCount = commentsSnap.size;
                        }
                    } catch (e) {
                        console.warn(`Could not fetch/verify comment count for post ${post.id}`, e);
                        post.commentCount = post.commentCount || 0; // Fallback to stored or 0
                    }
                    return post;
                });
                const postsWithCounts = await Promise.all(postPromises);

                postsWithCounts.forEach((post) => {
                    forumPostsContainer.appendChild(createPostElement(post));
                });
                lastVisiblePost = querySnapshot.docs[querySnapshot.docs.length - 1];

                if (loadMoreButton) {
                    loadMoreButton.style.display = querySnapshot.docs.length < fetchLimit ? 'none' : 'block';
                    loadMoreButton.disabled = false;
                    loadMoreButton.textContent = 'Load More Posts';
                }
            } else if (querySnapshot.empty && loadMore) {
                if (loadMoreButton) loadMoreButton.style.display = 'none';
                if (!forumPostsContainer.querySelector('.no-more-posts-message')) {
                    const noMoreMsg = document.createElement('p');
                    noMoreMsg.textContent = "You've reached the end!";
                    noMoreMsg.classList.add('no-more-posts-message', 'subtle-text', 'text-center');
                    forumPostsContainer.appendChild(noMoreMsg);
                }
            }

            // Fetch and render trending posts
            try {
                const allPostsSnapshot = await getDocs(query(collection(db, "forumPosts"), orderBy("timestamp", "desc"), limit(50)));
                const allPosts = [];
                allPostsSnapshot.forEach(doc => allPosts.push({ id: doc.id, ...doc.data() }));
                renderTrendingPosts(allPosts);
            } catch (trendError) {
                console.error("Error fetching posts for trending sidebar:", trendError);
                const trendingContainer = document.getElementById('trending-container');
                if (trendingContainer) trendingContainer.innerHTML = '<p>Error loading trending posts.</p>';
            }

        } catch (error) {
            console.error('Error fetching forum posts:', error);
            if (!loadMore) {
                forumPostsContainer.innerHTML = '<p class="error-message">Error loading posts.</p>';
            } else if (loadMoreButton) {
                loadMoreButton.textContent = 'Error loading';
                loadMoreButton.style.display = 'block';
            }
            // showPopup("Error loading forum posts.", "error", 0, false); // REPLACED
            console.error("Error loading forum posts."); // Log error
        } finally {
            isLoadingForumPosts = false;
            if (loadMoreButton && loadMoreButton.style.display === 'block') {
                loadMoreButton.disabled = false;
                loadMoreButton.textContent = 'Load More Posts';
            }
        }
    }


    function renderTrendingPosts(posts) {
        const trendingContainer = document.getElementById('trending-container');
        if (!trendingContainer) return;
        trendingContainer.innerHTML = ''; // Clear previous

        const scoredPosts = posts.map(post => ({
            ...post,
            score: (post.upvotes || 0) - (post.downvotes || 0),
            timestampDate: post.timestamp?.toDate ? new Date(post.timestamp.toDate()) : new Date(0)
        })).filter(post =>
            post.score > 0 ||
            (post.score === 0 && post.timestampDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Neutral score but recent
        );

        const trending = scoredPosts.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return b.timestampDate - a.timestampDate;
        }).slice(0, 5); // Top 5

        if (trending.length === 0) {
            trendingContainer.innerHTML = '<p>No trending posts yet.</p>';
            return;
        }

        trending.forEach(post => {
            const postDiv = document.createElement('div');
            postDiv.classList.add('trending-post');
            postDiv.setAttribute('data-post-id', post.id);
            postDiv.innerHTML = `
            <h4>${post.title || 'Untitled'}</h4>
            <p><small>By ${post.author || 'Anonymous'} • ${post.score} Score</small></p>
          `;
            postDiv.addEventListener('click', () => {
                const targetPostElement = document.querySelector(`.forum-post[data-post-id="${post.id}"]`);
                if (targetPostElement) {
                    targetPostElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetPostElement.classList.add('highlight');
                    setTimeout(() => { targetPostElement.classList.remove('highlight'); }, 1500);
                } else {
                    // showPopup("Post might not be loaded yet. Scroll down or click 'Load More Posts'.", "info", 0, false); // REPLACED
                    console.info("Post might not be loaded yet. Scroll down or click 'Load More Posts'."); // Log info
                }
            });
            trendingContainer.appendChild(postDiv);
        });
    }

    // --- Nearby Reports Functions ---
    function getDeviceLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation is not supported by your browser."));
            } else {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        if (typeof position.coords.latitude === 'number' && typeof position.coords.longitude === 'number') {
                            resolve({ lat: position.coords.latitude, lon: position.coords.longitude });
                        } else {
                            reject(new Error("Received invalid coordinates from browser."));
                        }
                    },
                    (error) => {
                        let message = `Geolocation error (Code: ${error.code}): `;
                        switch (error.code) {
                            case error.PERMISSION_DENIED: message += "Permission denied. Please enable location access."; break;
                            case error.POSITION_UNAVAILABLE: message += "Location information unavailable."; break;
                            case error.TIMEOUT: message += "Request timed out."; break;
                            default: message += "An unknown error occurred.";
                        }
                        reject(new Error(message));
                    },
                    { timeout: 10000, enableHighAccuracy: false }
                );
            }
        });
    }
    function clearNearbyMapMarkers() {
        if (nearbyMap) {
            nearbyMarkers.forEach(marker => nearbyMap.removeLayer(marker));
        }
        nearbyMarkers = [];
    }
    function renderNearbyReportItem(report, distance) {
        const li = document.createElement('li');
        li.classList.add('nearby-report-item');
        const distanceText = distance < 1000
            ? `${Math.round(distance)} m away`
            : `${(distance / 1000).toFixed(1)} km away`;

        const imageHtml = report.imageUrl
            ? `<div class="nearby-report-image"><img src="${report.imageUrl}" alt="Report Image"></div>`
            : '<div class="nearby-report-image no-image" aria-label="No image available"></div>';

        li.innerHTML = `
            <div class="nearby-report-info">
                <p><strong>Location:</strong> ${report.locationName || 'N/A'}</p>
                <p><strong>Category:</strong> ${report.category || 'N/A'} | <strong>Status:</strong> ${report.status || 'N/A'}</p>
                <p class="report-distance"><i class="icon-location" aria-hidden="true">📍</i> ${distanceText}</p>
            </div>
            ${imageHtml}
        `;
        li.addEventListener('click', () => {
            if (nearbyMap && typeof report.latitude === 'number' && typeof report.longitude === 'number') {
                nearbyMap.setView([report.latitude, report.longitude], 15);
                const correspondingMarker = nearbyMarkers.find(m =>
                    m.getLatLng().lat === report.latitude && m.getLatLng().lng === report.longitude
                );
                if (correspondingMarker) correspondingMarker.openPopup();
            }
        });
        return li;
    }
    async function displayNearbyReports() {
        const locationSelector = document.getElementById('location-selector');
        const radiusSelector = document.getElementById('radius-selector');
        const container = document.getElementById('nearby-reports-container');
        const statusDiv = document.getElementById('nearby-status');
        const loadButton = document.getElementById('load-nearby-reports');

        if (!locationSelector || !radiusSelector || !container || !statusDiv || !loadButton) return;
        if (!nearbyMap) { initializeNearbyMap(); if (!nearbyMap) { console.error("Map could not be initialized."); return; } } // Log error

        const selectedLocationType = locationSelector.value;
        const selectedRadius = parseInt(radiusSelector.value, 10);

        container.innerHTML = ''; statusDiv.textContent = 'Loading...';
        loadButton.disabled = true; loadButton.textContent = 'Loading...';
        clearNearbyMapMarkers();

        let centerCoords;
        let centerName = "Selected Area";
        let userMarker = null;

        try {
            if (selectedLocationType === 'current') {
                statusDiv.textContent = 'Getting your current location...';
                centerCoords = await getDeviceLocation();
                centerName = "Your Location";
                if (nearbyMap) {
                    userMarker = L.marker([centerCoords.lat, centerCoords.lon], {
                        icon: L.icon({ iconUrl: 'images/user-location-marker.png', iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -30] }),
                        zIndexOffset: 1000
                    }).addTo(nearbyMap);
                    userMarker.bindPopup("Your Current Location");
                    nearbyMarkers.push(userMarker);
                }
            } else if (PREDEFINED_LOCATIONS[selectedLocationType]) {
                centerCoords = PREDEFINED_LOCATIONS[selectedLocationType];
                centerName = PREDEFINED_LOCATIONS[selectedLocationType].name;
            } else {
                throw new Error("Invalid location selected.");
            }

            statusDiv.textContent = `Fetching reports near ${centerName}...`;
            const allReports = await fetchReports();

            const nearbyReports = [];
            const centerLatLng = L.latLng(centerCoords.lat, centerCoords.lon);

            allReports.forEach(report => {
                if (typeof report.latitude === 'number' && typeof report.longitude === 'number' &&
                    !isNaN(report.latitude) && !isNaN(report.longitude)) {
                    const reportLatLng = L.latLng(report.latitude, report.longitude);
                    const distance = centerLatLng.distanceTo(reportLatLng);
                    if (distance <= selectedRadius) {
                        nearbyReports.push({ ...report, distance });
                    }
                }
            });
            nearbyReports.sort((a, b) => a.distance - b.distance);

            if (nearbyReports.length === 0) {
                statusDiv.textContent = `No reports found within ${selectedRadius / 1000} km of ${centerName}.`;
                container.innerHTML = '<p class="no-data-message">Try selecting a larger radius or a different location.</p>';
                if (nearbyMap) nearbyMap.setView([centerCoords.lat, centerCoords.lon], 13);
            } else {
                statusDiv.textContent = `Showing ${nearbyReports.length} reports near ${centerName}.`;
                nearbyReports.forEach(report => {
                    container.appendChild(renderNearbyReportItem(report, report.distance));
                    if (nearbyMap && typeof report.latitude === 'number' && typeof report.longitude === 'number') {
                        const marker = L.marker([report.latitude, report.longitude]).addTo(nearbyMap);
                        const distanceText = report.distance < 1000 ? `${Math.round(report.distance)}m` : `${(report.distance / 1000).toFixed(1)}km`;
                        marker.bindPopup(`<strong>${report.locationName || 'N/A'}</strong><br>(${report.category || 'N/A'}) - ${report.status || 'N/A'}<br>~${distanceText} away`);
                        nearbyMarkers.push(marker);
                    }
                });

                if (nearbyMap && nearbyMarkers.length > 0) {
                    try {
                        const group = new L.featureGroup(nearbyMarkers);
                        nearbyMap.fitBounds(group.getBounds().pad(0.1));
                    } catch (e) {
                        console.error("Error fitting nearby map bounds:", e);
                        if (nearbyMarkers.length === 1) nearbyMap.setView(nearbyMarkers[0].getLatLng(), 15);
                        else nearbyMap.setView([centerCoords.lat, centerCoords.lon], 12);
                    }
                } else if (nearbyMap) {
                    if (userMarker) nearbyMap.setView(userMarker.getLatLng(), 15);
                    else nearbyMap.setView([centerCoords.lat, centerCoords.lon], 13);
                }
            }
        } catch (error) {
            console.error("Error loading nearby reports:", error);
            statusDiv.textContent = `Error: ${error.message}`;
            container.innerHTML = '<p class="error-message">Could not load nearby reports.</p>';
            // showPopup(`Could not load nearby reports: ${error.message}`, "error", 0, false); // REPLACED
            console.error(`Could not load nearby reports: ${error.message}`); // Log error
            if (nearbyMap && centerCoords) nearbyMap.setView([centerCoords.lat, centerCoords.lon], 11);
        } finally {
            loadButton.disabled = false; loadButton.textContent = 'Load Reports';
        }
    }

    // --- Chatbot Functions ---
    function toggleChat() {
        const chatWidget = document.querySelector('.chat-widget'); // Get the parent widget
        if (!chatWidget) return; // Exit if widget not found

        chatWidget.classList.toggle('active'); // Toggle class on the parent

        // Optional: Focus input when opening
        if (chatWidget.classList.contains('active')) {
            const userInput = chatWidget.querySelector('#user-input');
            if (userInput) {
                setTimeout(() => userInput.focus(), 100); // Small delay for transition
            }
        }
    }
    async function sendChatMessage() {
        const userInputElement = document.getElementById("user-input");
        const chatBox = document.getElementById("chat-box");
        const sendButton = document.querySelector('.send-button');

        if (!userInputElement || !chatBox || !sendButton) return;

        const userInput = userInputElement.value.trim();
        if (!userInput) return;

        userInputElement.disabled = true;
        sendButton.disabled = true; sendButton.textContent = '...';

        const userMsgDiv = document.createElement('div');
        userMsgDiv.classList.add('message', 'user');
        userMsgDiv.innerHTML = `<strong>You:</strong> ${userInput.replace(/</g, "&lt;").replace(/>/g, "&gt;")}`;
        chatBox.appendChild(userMsgDiv);
        userInputElement.value = "";
        chatBox.scrollTop = chatBox.scrollHeight;

        try {
            const CHATBOT_API_URL = "https://chatbot-server-production-9a90.up.railway.app/chat";
            const response = await fetch(CHATBOT_API_URL, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: userInput })
            });

            if (!response.ok) {
                let errorDetail = '';
                try { const errorData = await response.json(); errorDetail = errorData.error || JSON.stringify(errorData); } catch (e) { errorDetail = await response.text(); }
                throw new Error(`Chatbot API error: ${response.status} ${response.statusText}. Detail: ${errorDetail}`);
            }

            const data = await response.json();
            const botMsgDiv = document.createElement('div');
            botMsgDiv.classList.add('message', 'bot');
            // Use formatRichText for bot responses if they can contain markdown
            botMsgDiv.innerHTML = `<strong>SGResolve Bot:</strong> ${formatRichText(data.response || "Sorry, I couldn't process that.")}`;
            chatBox.appendChild(botMsgDiv);

        } catch (error) {
            console.error("Chatbot error:", error);
            const errorMsgDiv = document.createElement('div');
            errorMsgDiv.classList.add('message', 'bot', 'error');
            errorMsgDiv.innerHTML = `<strong>SGResolve Bot:</strong> Sorry, an error occurred connecting to the chatbot. Please try again later.`;
            chatBox.appendChild(errorMsgDiv);
        } finally {
            userInputElement.disabled = false;
            sendButton.disabled = false; sendButton.textContent = 'Send';
            chatBox.scrollTop = chatBox.scrollHeight;
            userInputElement.focus();
        }
    }

    // --- About Page Animation ---
    function initializeAboutPageObserver() {
        const sections = document.querySelectorAll('#about-page .about-section .content');
        if (sections.length === 0 || !('IntersectionObserver' in window)) {
            sections.forEach(section => { if (section.parentElement) section.parentElement.classList.add('visible'); });
            return;
        }
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (entry.target.parentElement) entry.target.parentElement.classList.add('visible');
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 }
        );
        sections.forEach(section => { observer.observe(section); });
    }


    // --- Speech Recognition Setup ---
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false; // Stop after the first distinct phrase
        recognition.interimResults = true; // Get results as they are being processed
        recognition.lang = 'en-SG'; // Prioritize Singapore English
        // Note: Actual preservation of Singlish (vs. "correction" to standard English)
        // depends on the browser's speech recognition engine and its 'en-SG' model.
        // This JS setting is a request; the engine's behavior is out of direct JS control.

        recognition.onstart = () => {
            isRecognizing = true;
            if (targetInputFieldForSpeech && targetInputFieldForSpeech.micButton) {
                targetInputFieldForSpeech.micButton.classList.add('recognizing');
                targetInputFieldForSpeech.micButton.innerHTML = '<i class="fas fa-stop-circle"></i>';
                targetInputFieldForSpeech.micButton.title = 'Stop Recording';
            }
            console.log('Voice recognition started.');
        };

        recognition.onresult = (event) => {
            let spokenTranscriptThisSession = "";
            // Concatenate all results for this event to get the current full transcript of the spoken part
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                spokenTranscriptThisSession += event.results[i][0].transcript;
            }
            // Trim the currently spoken part to avoid leading/trailing spaces from the speech engine if any
            spokenTranscriptThisSession = spokenTranscriptThisSession.trim();

            if (targetInputFieldForSpeech && targetInputFieldForSpeech.inputElement) {
                // Get the text that was in the input field *before* this recognition session started
                const existingText = targetInputFieldForSpeech.inputElement.dataset.currentFinalText || "";

                if (existingText && spokenTranscriptThisSession) {
                    // Add a space if existingText is not empty and doesn't already end with one
                    targetInputFieldForSpeech.inputElement.value = existingText + (existingText.endsWith(' ') ? '' : ' ') + spokenTranscriptThisSession;
                } else if (spokenTranscriptThisSession) {
                    // If no existing text, just use the spoken transcript
                    targetInputFieldForSpeech.inputElement.value = spokenTranscriptThisSession;
                } else {
                    // If spokenTranscript is empty (e.g. recognition started but no speech yet, or cleared during processing)
                    // just keep the existing text. This handles cases where `onresult` might fire with an empty transcript initially.
                    targetInputFieldForSpeech.inputElement.value = existingText;
                }
            }
            // console.log('Current spoken transcript: ', spokenTranscriptThisSession);
        };

        recognition.onerror = (event) => {
            isRecognizing = false;
            console.error('Speech recognition error:', event.error);
            let errorMessage = 'Speech recognition error: ' + event.error;

            if (event.error === 'not-allowed') {
                errorMessage = "Microphone access denied. Please allow microphone access in your browser settings.";
            } else if (event.error === 'no-speech') {
                errorMessage = "No speech detected. Please try again.";
            } else if (event.error === 'language-not-supported') {
                console.warn("Language 'en-SG' might not be fully supported by the browser. Trying 'en-US'.");
                recognition.lang = 'en-US'; // Fallback language
                errorMessage = "Switched to en-US due to language support. Please try again.";
            }
            console.error(errorMessage); // Using console log as per existing pattern

            if (targetInputFieldForSpeech && targetInputFieldForSpeech.micButton) {
                targetInputFieldForSpeech.micButton.classList.remove('recognizing');
                targetInputFieldForSpeech.micButton.innerHTML = '<i class="fas fa-microphone"></i>';
                targetInputFieldForSpeech.micButton.title = 'Use Microphone';
            }
            // targetInputFieldForSpeech = null; // Do not nullify here, onend will handle it
        };

        recognition.onend = () => {
            isRecognizing = false;
            if (targetInputFieldForSpeech && targetInputFieldForSpeech.micButton) {
                targetInputFieldForSpeech.micButton.classList.remove('recognizing');
                targetInputFieldForSpeech.micButton.innerHTML = '<i class="fas fa-microphone"></i>';
                targetInputFieldForSpeech.micButton.title = 'Use Microphone';
            }
            console.log('Voice recognition ended.');
            if (targetInputFieldForSpeech && targetInputFieldForSpeech.inputElement) {
                // The input field value should be correctly set by the last onresult.
                // Clean up the dataset attribute for the next session.
                delete targetInputFieldForSpeech.inputElement.dataset.currentFinalText;

                // Ensure the auto-detect button for problem description is enabled if there's text
                if (targetInputFieldForSpeech.inputElement.id === 'problemDesc') {
                    const autoDetectBtn = document.getElementById('autoDetect');
                    if (autoDetectBtn) autoDetectBtn.disabled = !targetInputFieldForSpeech.inputElement.value.trim();
                }
            }
            targetInputFieldForSpeech = null; // Clear the target now that recognition has ended
        };
    } else {
        console.warn('Speech Recognition API not supported in this browser.');
        // Hide all microphone buttons if the API is not available
        document.querySelectorAll('.mic-button').forEach(btn => btn.style.display = 'none');
    }
    // --- End Speech Recognition Setup ---


    // --- Auth State Change Listener ---
    onAuthStateChanged(auth, async (user) => { // Made async
        const wasLoggedIn = !!currentUser;
        currentUser = user;

        if (user) {
            console.log("User logged in:", user.uid, user.email, user.displayName);
            await fetchAndSetCurrentUserData(user.uid); // Fetch/init user data

            if (!wasLoggedIn) { // Only change page on initial login
                hideAllPages();
                if (user.email === 'admin@sgresolve.com') showPage('admin');
                else showPage('reporting');
            } else {
                updateNavbar(); // Just update navbar if already logged in
                if (pages.profile && pages.profile.classList.contains('show')) renderProfilePage(); // Refresh profile if visible
            }
            updateNavbar(); // Update navbar regardless

        } else {
            console.log("User logged out or not logged in.");
            currentUserData = null;
            imageDataUrl = null;
            const reportForm = document.getElementById('report-form'); if (reportForm) reportForm.reset();
            const imgPreview = document.getElementById('imagePreview'); if (imgPreview) imgPreview.innerHTML = '';
            const analyzeBtn = document.getElementById('analyzeImageBtn'); if (analyzeBtn) analyzeBtn.disabled = true;
            const autoDetectBtn = document.getElementById('autoDetect'); if (autoDetectBtn) autoDetectBtn.disabled = true;
            if (tempMarker && reportingMap) { reportingMap.removeLayer(tempMarker); tempMarker = null; }
            if (typeof grecaptcha !== 'undefined' && grecaptcha) { try { grecaptcha.reset(); } catch (e) { console.warn("Error resetting CAPTCHA on logout:", e); } }
            const submitBtn = document.getElementById('submit-report-button'); if (submitBtn) submitBtn.disabled = true;

            if (wasLoggedIn) { // Redirect to landing only if they *were* logged in
                hideAllPages(); showPage('landing');
            } else {
                if (!document.querySelector('.page.show')) showPage('landing'); // Safeguard
            }
            updateNavbar();
        }
    });


    // --- Event Listeners ---

    // Navigation
    document.getElementById('nav-home')?.addEventListener('click', (e) => { e.preventDefault(); if (currentUser) { currentUser.email === 'admin@sgresolve.com' ? showPage('admin') : showPage('reporting'); } else { showPage('landing'); } });
    document.getElementById('nav-my-reports')?.addEventListener('click', (e) => { e.preventDefault(); if (currentUser) { showPage('myReports'); } else { showPage('login'); } });
    document.getElementById('nav-nearby-reports')?.addEventListener('click', (e) => { e.preventDefault(); if (currentUser) { showPage('nearbyReports'); } else { showPage('login'); } });
    document.getElementById('nav-community')?.addEventListener('click', (e) => { e.preventDefault(); showPage('community'); });
    document.getElementById('nav-about')?.addEventListener('click', (e) => { e.preventDefault(); showPage('about'); });
    document.getElementById('nav-profile')?.addEventListener('click', (e) => { e.preventDefault(); if (currentUser) { showPage('profile'); } else { showPage('login'); } });
    document.getElementById('nav-logout')?.addEventListener('click', (e) => {
        e.preventDefault();
        signOut(auth).then(() => {
            // showPopup("Logged out successfully.", "success", 0, true); // REPLACED
            console.log("Logged out successfully.");
        }).catch(error => {
            console.error("Logout error:", error);
            // showPopup(`Logout failed: ${error.message}`, "error", 0, false); // REPLACED
            console.error(`Logout failed: ${error.message}`);
        });
    });



    // Landing Page Buttons
    document.getElementById('hero-report-issue')?.addEventListener('click', (e) => { e.preventDefault(); showPage(currentUser ? 'reporting' : 'login'); });
    document.getElementById('hero-learn-more')?.addEventListener('click', (e) => { e.preventDefault(); showPage('about'); });
    document.getElementById('cta-register')?.addEventListener('click', (e) => { e.preventDefault(); showPage('register'); });
    document.getElementById('cta-login')?.addEventListener('click', (e) => { e.preventDefault(); showPage('login'); });

    // Back Links
    document.getElementById('back-to-landing-from-login')?.addEventListener('click', (e) => { e.preventDefault(); showPage('landing'); });
    document.getElementById('back-to-landing-from-register')?.addEventListener('click', (e) => { e.preventDefault(); showPage('landing'); });
    document.getElementById('back-to-landing-from-about')?.addEventListener('click', (e) => { e.preventDefault(); showPage('landing'); });

    // Login/Register Links
    document.getElementById('go-to-register')?.addEventListener('click', (e) => { e.preventDefault(); showPage('register'); });
    document.getElementById('go-to-login')?.addEventListener('click', (e) => { e.preventDefault(); showPage('login'); });

    // Login Form
    document.getElementById('login-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const submitButton = e.target.querySelector('button[type="submit"]');
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) { console.warn("Please enter both email and password."); return; } // Log warning
        submitButton.disabled = true; submitButton.textContent = 'Logging in...';

        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                console.log('Login successful for:', userCredential.user.email);
                // showPopup('Logged in successfully!', 'success'); // REPLACED
                console.log('Logged in successfully!');
                currentUser = userCredential.user; // Immediate update
                // Auth listener handles the rest
            })
            .catch((error) => {
                console.error("Login Error:", error.code, error.message);
                let message = `Login failed. Please check credentials.`;
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    message = 'Invalid email or password.';
                } else if (error.code === 'auth/invalid-email') { message = 'Invalid email format.'; }
                else { message = `Login error: ${error.message}`; }
                // showPopup(message, 'error', 0, false); // REPLACED
                console.error(message); // Log error
            })
            .finally(() => { submitButton.disabled = false; submitButton.textContent = 'Login'; });
    });

    // Registration Form
    document.getElementById('register-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('register-name');
        const emailInput = document.getElementById('register-email');
        const passwordInput = document.getElementById('register-password');
        const submitButton = e.target.querySelector('button[type="submit"]');
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!name || !email || !password) { console.warn('Please fill in all fields: Full Name, Email, and Password.'); return; } // Log warning
        submitButton.disabled = true; submitButton.textContent = 'Registering...';

        createUserWithEmailAndPassword(auth, email, password)
            .then(async (userCredential) => {
                const user = userCredential.user;
                console.log('Registration successful for:', user.email);
                try { await updateProfile(user, { displayName: name }); console.log('Auth profile display name updated.'); }
                catch (profileError) { console.error('Error updating Auth profile name:', profileError); }

                try {
                    // Use the NEW clean initialization function
                    await initializeFirestoreUser(user.uid, name);
                    console.log('Firestore user document initialized cleanly.');
                    // Award registration points AFTER document exists
                    const pointsAwarded = await awardPointsAndCheckBadges(user.uid, POINT_VALUES.REGISTER, 'register');
                    // *** USE RP SIDEBAR FOR REGISTRATION SUCCESS WITH POINTS ***
                    if (pointsAwarded > 0) {
                        showRpNotification(`Welcome, ${name}!`, pointsAwarded);
                    } else {
                        console.log(`Registration successful! Welcome, ${name}!`); // Log success if no points (unlikely here)
                    }

                } catch (firestoreError) {
                    console.error('Error initializing Firestore user data:', firestoreError);
                    // showPopup('Registration successful, but failed to create profile. Please contact support.', 'error', 0, false); // REPLACED
                    console.error('Registration successful, but failed to create profile. Please contact support.'); // Log error
                }
                // Auth listener handles UI updates/navigation
            })
            .catch((error) => {
                console.error('Registration error:', error.code, error.message);
                let message = 'Registration failed. Please try again.';
                if (error.code === 'auth/email-already-in-use') message = 'Email already in use.';
                else if (error.code === 'auth/invalid-email') message = 'Invalid email format.';
                else if (error.code === 'auth/weak-password') message = 'Password is too weak.';
                // showPopup(message, 'error', 0, false); // REPLACED
                console.error(message); // Log error
            })
            .finally(() => { submitButton.disabled = false; submitButton.textContent = 'Register'; });
    });

    // Admin Logout
    document.getElementById('logout-admin')?.addEventListener('click', (e) => {
        e.preventDefault();
        signOut(auth).then(() => {
            // showPopup("Admin logged out successfully.", "success", 0, true); // REPLACED
            console.log("Admin logged out successfully.");
        }).catch(error => {
            console.error("Admin logout error:", error);
            // showPopup(`Logout failed: ${error.message}`, "error", 0, false); // REPLACED
            console.error(`Logout failed: ${error.message}`);
        });
    });

    // Reporting Page - Detect Location Button
    document.getElementById('detectLocation')?.addEventListener('click', function () {
        const button = this; button.disabled = true; button.textContent = 'Detecting...';
        getDeviceLocation().then(coords => {
            const latLng = L.latLng(coords.lat, coords.lon);
            if (!singaporeLatLngBounds.contains(latLng)) {
                // showPopup('Your detected location appears to be outside Singapore.', 'warning', 0, false); // REPLACED
                console.warn('Your detected location appears to be outside Singapore.');
            }
            if (!reportingMap) initializeReportingMap();
            if (reportingMap) {
                if (tempMarker) reportingMap.removeLayer(tempMarker);
                tempMarker = L.marker(latLng).addTo(reportingMap);
                reportingMap.setView(latLng, 16);
            }
            document.getElementById('latitude').value = coords.lat.toFixed(6);
            document.getElementById('longitude').value = coords.lon.toFixed(6);
        }).catch(error => {
            // showPopup(`Could not detect location: ${error.message}`, 'error', 0, false); // REPLACED
            console.error(`Could not detect location: ${error.message}`);
        })
            .finally(() => { button.disabled = false; button.textContent = 'Detect Location'; });
    });

    // Reporting Page - Image Upload & AI Analysis
    const imageUpload = document.getElementById('imageUpload');
    const imagePreview = document.getElementById('imagePreview');
    const analyzeImageBtn = document.getElementById('analyzeImageBtn');

    imageUpload?.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadstart = () => {
                if (imagePreview) imagePreview.innerHTML = '<p>Loading preview...</p>';
                if (analyzeImageBtn) analyzeImageBtn.disabled = true;
                imageDataUrl = null;
            };
            reader.onloadend = () => {
                imageDataUrl = reader.result; // Assign base64 data URL
                if (imagePreview) imagePreview.innerHTML = `<img src="${imageDataUrl}" alt="Image Preview">`;
                if (analyzeImageBtn) analyzeImageBtn.disabled = false; // Enable analysis button
            };
            reader.onerror = () => {
                console.error("Error reading file");
                if (imagePreview) imagePreview.innerHTML = '<p class="error-message">Error loading preview.</p>';
                if (analyzeImageBtn) analyzeImageBtn.disabled = true;
                imageDataUrl = null;
                // showPopup("Failed to read image file.", "error", 0, false); // REPLACED
                console.error("Failed to read image file.");
            };
            reader.readAsDataURL(file);
        } else {
            imageDataUrl = null;
            if (imagePreview) imagePreview.innerHTML = '';
            if (analyzeImageBtn) analyzeImageBtn.disabled = true;
            if (file) {
                // showPopup("Please select a valid image file.", "warning", 0, false); // REPLACED
                console.warn("Please select a valid image file.");
            }
        }
    });


    // AI Analyze Button (Image)
    analyzeImageBtn?.addEventListener('click', async () => {
        if (!imageDataUrl || !currentUser) {
            // showPopup("Please select an image first.", "warning", 0, false); // REPLACED
            console.warn("Please select an image first."); return;
        }
        if (!IMAGE_ANALYZER_API_URL || !IMAGE_ANALYZER_API_URL.startsWith('https')) {
            // showPopup("AI Image Analyzer Service URL not configured.", "error", 0, false); // REPLACED
            console.error("AI Image Analyzer Service URL not configured."); return;
        }

        analyzeImageBtn.disabled = true; analyzeImageBtn.textContent = 'Analyzing...';
        // showPopup("Sending image for AI analysis...", "info", 0, false); // REPLACED - Rely on button text
        console.info("Sending image for AI analysis...");

        try {
            const base64Data = imageDataUrl.split(',')[1];
            if (!base64Data) throw new Error("Invalid image data format.");

            const response = await fetch(IMAGE_ANALYZER_API_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json', }, body: JSON.stringify({ image_data: base64Data })
            });

            if (!response.ok) {
                let errorMsg = `AI analysis failed: ${response.status}`;
                try { errorMsg = (await response.json()).error || errorMsg; } catch (e) { }
                throw new Error(errorMsg);
            }
            const result = await response.json();

            const categorySelect = document.getElementById('category');
            const urgencySelect = document.getElementById('urgency');
            const threatSelect = document.getElementById('threat');
            const setSelectValue = (selectElement, value) => {
                if (selectElement && value && [...selectElement.options].some(opt => opt.value === value)) selectElement.value = value;
                else if (value) console.warn(`AI suggested value "${value}" not found in dropdown "${selectElement?.id}".`);
            };
            setSelectValue(categorySelect, result.category);
            setSelectValue(urgencySelect, result.urgency);
            setSelectValue(threatSelect, result.threat);

            // Award points and check badges
            const pointsAwarded = await awardPointsAndCheckBadges(currentUser.uid, POINT_VALUES.USE_AI_IMAGE, 'useAiImage');

            // Log success to console
            console.log(`AI Analysis Complete: Fields updated.`);

            // Show RP gain via sidebar if points > 0
            if (pointsAwarded > 0) {
                showRpNotification("AI Image Analysis used", pointsAwarded);
            }

        } catch (error) {
            console.error('AI Image Analysis Error:', error);
            // showPopup(`AI Analysis Failed: ${error.message}`, 'error', 0, false); // REPLACED
            console.error(`AI Analysis Failed: ${error.message}`);
        } finally {
            analyzeImageBtn.disabled = false; analyzeImageBtn.textContent = 'Analyze Image with AI';
        }
    });

    // Reporting Page - Auto Detect Feature (Text Analysis)
    const autoDetectButton = document.getElementById('autoDetect');
    const problemDescInput = document.getElementById('problemDesc');
    problemDescInput?.addEventListener('input', () => { if (autoDetectButton) autoDetectButton.disabled = !problemDescInput.value.trim(); });
    autoDetectButton?.addEventListener('click', async () => {
        const description = problemDescInput?.value.trim();
        if (!description || !currentUser) {
            // showPopup('Please enter a description first.', 'warning', 0, false); // REPLACED
            console.warn('Please enter a description first.'); return;
        }
        if (!TEXT_ANALYSIS_API_URL || !TEXT_ANALYSIS_API_URL.startsWith('https')) {
            // showPopup("Text Analysis Service URL not configured.", "error", 0, false); // REPLACED
            console.error("Text Analysis Service URL not configured."); return;
        }

        autoDetectButton.disabled = true; autoDetectButton.textContent = 'Detecting...';
        // showPopup("Analyzing description text...", "info", 0, false); // REPLACED - Rely on button text
        console.info("Analyzing description text...");

        try {
            const response = await fetch(TEXT_ANALYSIS_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: description }) });

            if (!response.ok) { let errorMsg = `Text analysis failed: ${response.status}`; try { errorMsg = (await response.json()).error || errorMsg; } catch (e) { } throw new Error(errorMsg); }
            const data = await response.json();

            const categorySelect = document.getElementById('category'); const urgencySelect = document.getElementById('urgency'); const threatSelect = document.getElementById('threat');
            const predictedCategory = data.category || ''; const predictedUrgency = data.urgency || ''; const predictedThreat = data.threat || '';
            const setSelectValue = (selectElement, value) => {
                if (selectElement && value && [...selectElement.options].some(opt => opt.value === value)) selectElement.value = value;
                else if (value) console.warn(`AI suggested value "${value}" not found in dropdown "${selectElement?.id}".`);
            };
            setSelectValue(categorySelect, predictedCategory);
            setSelectValue(urgencySelect, predictedUrgency);
            setSelectValue(threatSelect, predictedThreat);

            // Award points and check badges
            const pointsAwarded = await awardPointsAndCheckBadges(currentUser.uid, POINT_VALUES.USE_AI_TEXT, 'useAiText');

            // Log success to console
            console.log(`Text analysis complete! Categories suggested.`);

            // Show RP gain via sidebar if points > 0
            if (pointsAwarded > 0) {
                showRpNotification("AI Text Analysis used", pointsAwarded);
            }

        } catch (error) {
            console.error('Text Auto Detect Error:', error);
            // showPopup(`Text Auto-Detect Failed: ${error.message}`, 'error', 0, false); // REPLACED
            console.error(`Text Auto-Detect Failed: ${error.message}`);
        } finally {
            autoDetectButton.disabled = false; autoDetectButton.textContent = 'Auto Detect (Text)';
        }
    });

    // Reporting Page - Form Submission
    document.getElementById('report-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        let docRef = null;
        const submitButton = document.getElementById('submit-report-button');

        if (!currentUser || !currentUserData) {
            // showPopup("Please log in to submit a report.", "error", 0, false); // REPLACED
            console.error("Please log in to submit a report.");
            showPage('login'); return;
        }

        // CAPTCHA Check (Frontend only)
        if (submitButton.disabled) {
            const recaptchaError = document.getElementById('recaptcha-error');
            if (recaptchaError) { recaptchaError.textContent = "Please complete the CAPTCHA verification."; recaptchaError.style.display = 'block'; }
            console.warn("Attempted submission without completing CAPTCHA.");
            const captchaContainer = document.getElementById('recaptcha-container');
            if (captchaContainer) { captchaContainer.parentElement?.classList.add('shake'); setTimeout(() => { captchaContainer.parentElement?.classList.remove('shake'); }, 500); }
            return; // Stop submission
        }

        const locationNameInput = document.getElementById('locationName');
        const latitudeInput = document.getElementById('latitude');
        const longitudeInput = document.getElementById('longitude');
        const descriptionInput = document.getElementById('problemDesc');
        const categorySelect = document.getElementById('category');
        const urgencySelect = document.getElementById('urgency');
        const threatSelect = document.getElementById('threat');
        const fileInput = document.getElementById('imageUpload');
        const imagePreview = document.getElementById('imagePreview');
        const analyzeImageBtn = document.getElementById('analyzeImageBtn');
        const autoDetectButton = document.getElementById('autoDetect');

        const locationName = locationNameInput?.value.trim() ?? '';
        const latitudeStr = latitudeInput?.value ?? '';
        const longitudeStr = longitudeInput?.value ?? '';
        const description = descriptionInput?.value.trim() ?? '';
        const category = categorySelect?.value ?? '';
        const urgency = urgencySelect?.value ?? '';
        const threat = threatSelect?.value ?? '';
        const latitude = parseFloat(latitudeStr);
        const longitude = parseFloat(longitudeStr);

        if (!locationName || isNaN(latitude) || isNaN(longitude) || !description || !category || !urgency || !threat) {
            // showPopup('Please fill all required fields.', 'warning', 0, false); // REPLACED
            console.warn('Please fill all required fields.'); return;
        }
        if (!singaporeLatLngBounds.contains([latitude, longitude])) {
            // showPopup('Coordinates must be within Singapore.', 'warning', 0, false); // REPLACED
            console.warn('Coordinates must be within Singapore.'); return;
        }

        submitButton.disabled = true; submitButton.textContent = 'Submitting...';
        // showPopup("Submitting report...", "info", 0, false); // REPLACED - Rely on button text
        console.info("Submitting report...");

        let uploadedImageUrl = null;
        const file = fileInput?.files[0];

        // ImgBB Upload
        if (file && imageDataUrl && IMGBB_API_KEY) {
            try {
                console.log("Attempting image upload to ImgBB...");
                const formData = new FormData();
                const base64Data = imageDataUrl.split(',')[1];
                if (!base64Data) throw new Error("Invalid base64 image data.");
                formData.append('image', base64Data); formData.append('key', IMGBB_API_KEY);
                const imgbbResponse = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
                const imgbbData = await imgbbResponse.json();
                console.log("ImgBB Response:", imgbbData);
                if (imgbbData.success && imgbbData.data && imgbbData.data.url) {
                    uploadedImageUrl = imgbbData.data.url; console.log('Image Upload Success:', uploadedImageUrl);
                } else {
                    throw new Error(imgbbData.error?.message || `ImgBB upload failed. Status: ${imgbbData.status_code || 'Unknown'}`);
                }
            } catch (error) {
                console.error('Image Upload Error:', error);
                // showPopup(`Image upload failed: ${error.message}. Report will be submitted without image.`, 'warning', 0, false); // REPLACED
                console.warn(`Image upload failed: ${error.message}. Report will be submitted without image.`);
            }
        } else if (file) {
            console.warn("Image file selected, but imageDataUrl or ImgBB key missing.");
            if (!IMGBB_API_KEY) {
                // showPopup("ImgBB API Key not configured. Cannot upload image.", "warning", 0, false); // REPLACED
                console.warn("ImgBB API Key not configured. Cannot upload image.");
            }
        }

        const reporterName = currentUserData.displayName || 'Anonymous';
        const reportData = {
            userId: currentUser.uid, userName: reporterName, locationName, latitude, longitude, description, category, urgency, threat,
            imageUrl: uploadedImageUrl, status: 'Pending', timestamp: new Date()
        };

        try {
            docRef = await addDoc(collection(db, "reports"), reportData);
            console.log('Report added to Firestore with ID:', docRef.id);

            // Calculate points specific to THIS report submission
            let pointsForThisReport = POINT_VALUES.SUBMIT_REPORT;
            let actionData = { hasImage: !!uploadedImageUrl }; // Data needed for badge checks inside the function
            if (actionData.hasImage) pointsForThisReport += POINT_VALUES.REPORT_WITH_IMAGE;
            if (description.length > 50) pointsForThisReport += POINT_VALUES.REPORT_WITH_DESCRIPTION;

            // Award Points & Check Badges (function internally handles FIRST_REPORT bonus etc.)
            const totalPointsAwardedForAction = await awardPointsAndCheckBadges(currentUser.uid, pointsForThisReport, 'submitReport', actionData);

            // Log general success to console
            console.log('Report submitted successfully!');

            // Show RP gain via sidebar IF points were awarded
            if (totalPointsAwardedForAction > 0) {
                showRpNotification("Report submitted", totalPointsAwardedForAction);
            }

            // Reset Form
            e.target.reset();
            imageDataUrl = null;
            if (imagePreview) imagePreview.innerHTML = '';
            if (analyzeImageBtn) analyzeImageBtn.disabled = true;
            if (autoDetectButton) autoDetectButton.disabled = true;
            if (tempMarker && reportingMap) { reportingMap.removeLayer(tempMarker); tempMarker = null; }
            if (latitudeInput) latitudeInput.value = '';
            if (longitudeInput) longitudeInput.value = '';

            // Reset CAPTCHA and Disable Submit Button
            if (typeof grecaptcha !== 'undefined' && grecaptcha) { try { grecaptcha.reset(); } catch (captchaError) { console.error("Error resetting reCAPTCHA:", captchaError); } }
            if (submitButton) submitButton.disabled = true; // Ensure button is disabled

            // Refresh views if needed
            if (pages.myReports?.classList.contains('show')) renderUserReports();

        } catch (error) {
            console.error('Error adding report to Firestore:', error);
            // showPopup(`Error submitting report: ${error.message}`, 'error', 0, false); // REPLACED
            console.error(`Error submitting report: ${error.message}`);
        } finally {
            // Re-enable button ONLY if submission failed
            if (submitButton && !docRef) {
                submitButton.disabled = false;
                if (typeof grecaptcha !== 'undefined' && grecaptcha) grecaptcha.reset(); // Reset captcha on failure too
            } else if (submitButton && docRef) {
                submitButton.disabled = true; // Keep disabled on success
            }
            if (submitButton) submitButton.textContent = 'Submit Report';
        }
    });


    // --- Admin Page Actions ---
    document.getElementById('apply-filters')?.addEventListener('click', renderAdminReports);
    document.getElementById('reset-filters')?.addEventListener('click', () => {
        const imageFilter = document.getElementById('image-filter'); const categoryFilter = document.getElementById('category-filter'); const urgencyFilter = document.getElementById('urgency-filter'); const threatFilter = document.getElementById('threat-filter');
        if (imageFilter) imageFilter.value = 'all'; if (categoryFilter) categoryFilter.value = 'all'; if (urgencyFilter) urgencyFilter.value = 'all'; if (threatFilter) threatFilter.value = 'all';
        renderAdminReports();
    });
    document.getElementById('refresh-reports')?.addEventListener('click', async () => {
        const button = document.getElementById('refresh-reports');
        if (!button || button.disabled) return;
        button.disabled = true; button.textContent = 'Refreshing...';
        // showPopup("Refreshing data...", "info", 0, false); // REPLACED - Rely on button text
        console.info("Refreshing data...");
        try {
            await Promise.all([renderAdminReports(), renderAdminAnalytics()]);
            // showPopup("Data refreshed!", "success", 0, true); // REPLACED
            console.log("Data refreshed!");
        } catch (error) {
            console.error("Refresh Error:", error);
            // showPopup("Failed to refresh data.", "error", 0, false); // REPLACED
            console.error("Failed to refresh data.");
        } finally {
            if (button) { button.disabled = false; button.textContent = 'Refresh Reports'; }
        }
    });
    document.getElementById('export-data')?.addEventListener('click', async () => {
        const button = document.getElementById('export-data'); if (!button) return;
        button.disabled = true; button.textContent = 'Exporting...';
        // showPopup("Generating CSV export...", "info", 0, false); // REPLACED - Rely on button text
        console.info("Generating CSV export...");
        try {
            const allReports = await fetchReports();
            if (allReports.length === 0) {
                // showPopup("No reports to export.", "info", 0, true); // REPLACED
                console.info("No reports to export."); return;
            }
            const csvRows = []; const headers = ['ID', 'User ID', 'User Name', 'Location Name', 'Latitude', 'Longitude', 'Description', 'Category', 'Urgency', 'Threat', 'Image URL', 'Status', 'Timestamp'];
            csvRows.push(headers.join(','));
            const escapeCsvField = (field) => { const stringField = String(field ?? ''); if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) return `"${stringField.replace(/"/g, '""')}"`; return stringField; };
            allReports.forEach(report => {
                const timestampStr = report.timestamp instanceof Date ? report.timestamp.toISOString() : '';
                const row = [report.id, report.userId, report.userName, report.locationName, report.latitude, report.longitude, report.description, report.category, report.urgency, report.threat, report.imageUrl, report.status, timestampStr].map(escapeCsvField);
                csvRows.push(row.join(','));
            });
            const csvString = csvRows.join('\n'); const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a');
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob); link.setAttribute('href', url); const formattedDate = new Date().toISOString().split('T')[0]; link.setAttribute('download', `sgresolve_reports_${formattedDate}.csv`); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
                // showPopup("Export generated.", "success", 0, true); // REPLACED
                console.log("Export generated successfully.");
            } else {
                // showPopup("CSV generated, but auto-download not supported.", "warning", 0, false); // REPLACED
                console.warn("CSV generated, but auto-download not supported by this browser.");
            }
        } catch (error) {
            console.error('Error exporting reports:', error);
            // showPopup(`Export failed: ${error.message}`, 'error', 0, false); // REPLACED
            console.error(`Export failed: ${error.message}`);
        } finally {
            if (button) { button.disabled = false; button.textContent = 'Export Data'; }
        }
    });

    // Admin Page - Report List Actions
    document.getElementById('admin-reports-container')?.addEventListener('click', async (e) => {
        const target = e.target; const reportLi = target.closest('li[data-report-id]'); if (!reportLi) return;
        const reportId = reportLi.getAttribute('data-report-id'); if (!reportId) return;

        // --- Handle Status Update ---
        if (target.classList.contains('update-status-btn')) {
            const select = reportLi.querySelector('.status-update'); const newStatus = select?.value; if (!newStatus) return;
            const updateButton = target; if (updateButton.disabled) return;
            updateButton.disabled = true; updateButton.textContent = 'Updating...';
            const originalStatusSpan = reportLi.querySelector('.report-status');
            const originalStatusText = originalStatusSpan?.textContent;

            try {
                const reportRef = doc(db, "reports", reportId);
                let reporterUserId = null;
                let currentStatusInDB = null;

                // Get reporter's ID AND current status BEFORE updating
                const reportSnap = await getDoc(reportRef);
                if (reportSnap.exists()) {
                    reporterUserId = reportSnap.data().userId;
                    currentStatusInDB = reportSnap.data().status; // Get current status
                } else {
                    throw new Error("Report not found.");
                }

                // Only proceed if status is actually changing
                if (currentStatusInDB === newStatus) {
                    // showPopup("Status is already set to " + newStatus + ".", "info", 0, true); // REPLACED
                    console.info("Status is already set to " + newStatus + ".");
                    updateButton.disabled = false; updateButton.textContent = 'Update';
                    return; // Exit early
                }

                // Update the status in Firestore
                await updateDoc(reportRef, { status: newStatus });
                // showPopup("Status updated successfully.", "success", 0, true); // REPLACED
                console.log("Status updated successfully for report " + reportId);
                if (originalStatusSpan) originalStatusSpan.textContent = newStatus; // Update UI

                // Award points if marked Resolved AND reporter ID found AND status changed TO Resolved
                let pointsAwardedForResolution = 0;
                if (newStatus === 'Resolved' && currentStatusInDB !== 'Resolved' && reporterUserId) {
                    console.log(`Report ${reportId} marked Resolved. Awarding resolution points to user ${reporterUserId}.`);
                    pointsAwardedForResolution = await awardPointsAndCheckBadges(reporterUserId, POINT_VALUES.REPORT_RESOLVED, 'reportResolved');
                    // Show RP gain via sidebar if points were awarded
                    if (pointsAwardedForResolution > 0) {
                        // Note: This notification goes to the ADMIN triggering the action,
                        // not necessarily the user who submitted the report.
                        // Ideally, a notification system would inform the original reporter.
                        // For now, the admin sees the sidebar notification related to the points awarded.
                        showRpNotification("Report resolved points awarded", pointsAwardedForResolution);
                    }
                }

                await renderAdminAnalytics(); // Refresh analytics

            } catch (error) {
                console.error('Error updating status:', error);
                // showPopup(`Failed to update status: ${error.message}`, 'error', 0, false); // REPLACED
                console.error(`Failed to update status for report ${reportId}: ${error.message}`);
                if (originalStatusSpan && originalStatusText) originalStatusSpan.textContent = originalStatusText; // Revert UI
            } finally {
                updateButton.disabled = false; updateButton.textContent = 'Update';
            }
        }

        // --- Handle Report Deletion ---
        if (target.classList.contains('delete-report-btn')) {
            if (confirm(`Are you sure you want to DELETE report ${reportId}? This cannot be undone.`)) {
                const deleteButton = target; if (deleteButton.disabled) return;
                deleteButton.disabled = true; deleteButton.textContent = 'Deleting...';
                try {
                    await deleteDoc(doc(db, "reports", reportId));
                    // showPopup('Report deleted successfully.', 'success', 0, true); // REPLACED
                    console.log('Report deleted successfully: ' + reportId);
                    reportLi.remove();
                    // Re-render map and analytics accurately
                    const remainingReports = await fetchReports();
                    const filteredRemaining = applyFilters(remainingReports);
                    renderAdminMap(filteredRemaining);
                    await renderAdminAnalytics();
                } catch (error) {
                    console.error('Error deleting report:', error);
                    // showPopup(`Failed to delete report: ${error.message}`, 'error', 0, false); // REPLACED
                    console.error(`Failed to delete report ${reportId}: ${error.message}`);
                    deleteButton.disabled = false; deleteButton.textContent = 'Delete Report';
                }
            }
        }
    });


    // --- Community Forum Actions ---
    const forumContainer = document.getElementById('community-forum-page');
    if (forumContainer) {
        // New Post Form Submission
        document.getElementById('forum-post-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser || !currentUserData) {
                // showPopup("Please log in to create a post.", "error", 0, false); // REPLACED
                console.error("Please log in to create a post.");
                showPage('login'); return;
            }
            const titleInput = document.getElementById('post-title'); const contentInput = document.getElementById('post-content'); const categorySelect = document.getElementById('post-category'); const submitButton = document.getElementById('submit-button');
            const title = titleInput?.value.trim(); const content = contentInput?.value.trim(); const category = categorySelect?.value;
            if (!title || !content || !category) {
                // showPopup("Please fill in title, content, and category.", "warning", 0, false); // REPLACED
                console.warn("Please fill in title, content, and category."); return;
            }

            submitButton.disabled = true; submitButton.textContent = 'Posting...';
            try {
                const authorName = currentUserData.displayName || 'Anonymous';
                await addDoc(collection(db, "forumPosts"), {
                    title, content, category, author: authorName, authorId: currentUser.uid,
                    timestamp: new Date(), upvotes: 0, downvotes: 0, commentCount: 0, pinned: false
                });
                const pointsAwarded = await awardPointsAndCheckBadges(currentUser.uid, POINT_VALUES.CREATE_FORUM_POST, 'createForumPost');
                document.getElementById('forum-post-form').reset();

                // Log success to console
                console.log("Post submitted successfully!");

                // Show RP gain via sidebar if points > 0
                if (pointsAwarded > 0) {
                    showRpNotification("Forum post created", pointsAwarded);
                }

                await renderForumPosts(); // Refresh list
            } catch (error) {
                console.error('Error adding forum post:', error);
                // showPopup(`Error submitting post: ${error.message}`, 'error', 0, false); // REPLACED
                console.error(`Error submitting post: ${error.message}`);
            } finally {
                submitButton.disabled = false; submitButton.textContent = 'Post';
            }
        });

        // Event Delegation for Actions within Forum Posts
        const forumPostsContainer = document.getElementById('forum-posts');
        forumPostsContainer?.addEventListener('click', async (e) => {
            const target = e.target;
            const postElement = target.closest('.forum-post'); if (!postElement) return;
            const postId = postElement.getAttribute('data-post-id'); if (!postId) return;

            // Handle Comment Toggling
            if (target.classList.contains('toggle-comments-btn')) {
                const commentsSection = postElement.querySelector('.comments-section');
                if (commentsSection) {
                    const isHidden = commentsSection.style.display === 'none';
                    commentsSection.style.display = isHidden ? 'block' : 'none';
                    if (isHidden) {
                        await renderComments(postId);
                        const textarea = commentsSection.querySelector('.comment-form textarea');
                        if (textarea) textarea.focus();
                    }
                }
            }

            // Handle Voting
            if (target.classList.contains('vote-btn')) {
                if (!currentUser) {
                    // showPopup("Please log in to vote.", "error", 0, false); // REPLACED
                    console.error("Please log in to vote."); return;
                }
                if (target.disabled) return;
                target.disabled = true;

                const isUpvote = target.classList.contains('upvote-post') || target.classList.contains('upvote-comment');
                const isPostVote = target.classList.contains('upvote-post') || target.classList.contains('downvote-post');
                const isCommentVote = target.classList.contains('upvote-comment') || target.classList.contains('downvote-comment');
                const voteField = isUpvote ? 'upvotes' : 'downvotes';
                let docRef; let commentId = null;

                if (isPostVote) { docRef = doc(db, "forumPosts", postId); }
                else if (isCommentVote) { commentId = target.getAttribute('data-comment-id'); if (!commentId) { target.disabled = false; return; } docRef = doc(db, "forumPosts", postId, "comments", commentId); }
                else { target.disabled = false; return; }


                // Handle upvote (award points, update DB/UI)
                if (isUpvote) {
                    try {
                        await updateDoc(docRef, { [voteField]: increment(1) });
                        // Award points for GIVING an upvote
                        const pointsAwarded = await awardPointsAndCheckBadges(currentUser.uid, POINT_VALUES.GIVE_UPVOTE, 'giveUpvote');

                        // Update UI optimistically
                        const countMatch = target.textContent.match(/\d+$/);
                        const currentCount = countMatch ? parseInt(countMatch[0], 10) : 0;
                        const icon = target.textContent.split(' ')[0];
                        target.textContent = `${icon} ${currentCount + 1}`;

                        // Show RP gain via sidebar if points > 0
                        if (pointsAwarded > 0) {
                            showRpNotification("Upvote submitted", pointsAwarded);
                        }

                        setTimeout(() => { target.disabled = false; }, 500); // Re-enable

                    } catch (error) {
                        console.error("Voting error:", error);
                        // showPopup("Error recording vote.", "error", 0, false); // REPLACED
                        console.error("Error recording vote.");
                        target.disabled = false; // Re-enable on error
                    }
                } else { // Handle downvote (no points, just update DB/UI)
                    try {
                        await updateDoc(docRef, { [voteField]: increment(1) });
                        // Update UI optimistically
                        const countMatch = target.textContent.match(/\d+$/);
                        const currentCount = countMatch ? parseInt(countMatch[0], 10) : 0;
                        const icon = target.textContent.split(' ')[0];
                        target.textContent = `${icon} ${currentCount + 1}`;
                        setTimeout(() => { target.disabled = false; }, 500);
                    } catch (error) {
                        console.error("Voting error:", error);
                        // showPopup("Error recording vote.", "error", 0, false); // REPLACED
                        console.error("Error recording vote.");
                        target.disabled = false;
                    }
                }
            }


            // Handle Post Pinning/Unpinning (Admin)
            if (target.classList.contains('pin-btn') && currentUser?.email === 'admin@sgresolve.com') {
                const isPinned = target.getAttribute('data-pinned') === 'true';
                if (target.disabled) return;
                target.disabled = true; target.textContent = isPinned ? 'Unpinning...' : 'Pinning...';
                try {
                    await updateDoc(doc(db, "forumPosts", postId), { pinned: !isPinned });
                    // showPopup(`Post successfully ${isPinned ? 'unpinned' : 'pinned'}.`, 'success', 0, true); // REPLACED
                    console.log(`Post successfully ${isPinned ? 'unpinned' : 'pinned'}: ${postId}`);
                    await renderForumPosts(); // Re-render list for order
                } catch (error) {
                    console.error("Pinning error:", error);
                    // showPopup("Error changing pin status.", "error", 0, false); // REPLACED
                    console.error(`Error changing pin status for post ${postId}: ${error.message}`);
                    target.disabled = false; target.textContent = isPinned ? 'Unpin' : 'Pin'; target.setAttribute('data-pinned', isPinned ? 'true' : 'false');
                }
            }

            // Handle Post Deletion (Admin or Author)
            if (target.classList.contains('delete-post-btn')) {
                const postAuthorId = postElement.querySelector('.post-author .user-link')?.getAttribute('data-user');
                if (currentUser && (currentUser.email === 'admin@sgresolve.com' || currentUser.uid === postAuthorId)) {
                    if (confirm(`Are you sure you want to DELETE this post and all its comments?`)) {
                        if (target.disabled) return;
                        target.disabled = true; target.textContent = 'Deleting...';
                        try {
                            // Delete comments first
                            const commentsQuery = query(collection(db, "forumPosts", postId, "comments"));
                            const commentsSnapshot = await getDocs(commentsQuery);
                            const deletePromises = commentsSnapshot.docs.map(commentDoc => deleteDoc(commentDoc.ref));
                            await Promise.all(deletePromises);
                            // Delete post
                            await deleteDoc(doc(db, "forumPosts", postId));
                            // showPopup('Post and comments deleted.', 'success', 0, true); // REPLACED
                            console.log(`Post and comments deleted: ${postId}`);
                            postElement.remove();
                        } catch (error) {
                            console.error("Error deleting post:", error);
                            // showPopup(`Failed to delete post: ${error.message}`, 'error', 0, false); // REPLACED
                            console.error(`Failed to delete post ${postId}: ${error.message}`);
                            target.disabled = false; target.textContent = '🗑️ Delete';
                        }
                    }
                } else if (!currentUser) {
                    // showPopup("Please log in to delete posts.", "error", 0, false); // REPLACED
                    console.error("Please log in to delete posts.");
                } else {
                    // showPopup("You do not have permission.", "error", 0, false); // REPLACED
                    console.error("You do not have permission to delete this post.");
                }
            }

            // Handle Comment Deletion (Author or Admin)
            if (target.classList.contains('delete-comment-btn')) {
                const commentLi = target.closest('.comment-item');
                const commentId = target.getAttribute('data-comment-id');
                let commentAuthorId = null;
                try { // Fetch comment author
                    const commentRef = doc(db, "forumPosts", postId, "comments", commentId);
                    const commentSnap = await getDoc(commentRef);
                    if (commentSnap.exists()) commentAuthorId = commentSnap.data().authorId;
                    else { throw new Error("Comment not found in DB."); } // Check if comment exists before proceeding
                } catch (fetchError) {
                    console.error("Could not fetch comment details:", fetchError);
                    // showPopup("Error checking comment ownership.", "error", 0, false); // REPLACED
                    console.error("Error checking comment ownership or comment not found."); return;
                }

                if (currentUser && commentId && (currentUser.email === 'admin@sgresolve.com' || currentUser.uid === commentAuthorId)) {
                    if (confirm("Delete this comment?")) {
                        if (target.disabled) return;
                        target.disabled = true; target.textContent = 'Deleting...';
                        try {
                            await deleteDoc(doc(db, "forumPosts", postId, "comments", commentId));
                            // showPopup("Comment deleted.", "success", 0, true); // REPLACED
                            console.log(`Comment deleted: ${commentId} from post ${postId}`);
                            if (commentLi) commentLi.remove();
                            // Decrement comment count on post (handle potential race conditions if needed, but increment(-1) is generally safe)
                            await updateDoc(doc(db, "forumPosts", postId), { commentCount: increment(-1) });
                            // Update count display
                            const commentBtn = postElement.querySelector('.toggle-comments-btn');
                            if (commentBtn) {
                                const countMatch = commentBtn.textContent.match(/\((\d+)\)/);
                                const currentCount = countMatch ? parseInt(countMatch[1], 10) : 1; // Start from 1 if count was messed up
                                commentBtn.textContent = `💬 Comments (${Math.max(0, currentCount - 1)})`;
                            }
                        } catch (error) {
                            console.error("Error deleting comment:", error);
                            // showPopup(`Failed to delete comment: ${error.message}`, 'error', 0, false); // REPLACED
                            console.error(`Failed to delete comment ${commentId}: ${error.message}`);
                            target.disabled = false; target.textContent = 'Delete';
                        }
                    }
                } else if (!currentUser) {
                    // showPopup("Please log in to delete comments.", "error", 0, false); // REPLACED
                    console.error("Please log in to delete comments.");
                } else {
                    // showPopup("You do not have permission.", "error", 0, false); // REPLACED
                    console.error("You do not have permission to delete this comment.");
                }
            }
        });

        // Handle Comment Form Submission
        forumPostsContainer?.addEventListener('submit', async (e) => {
            if (e.target.classList.contains('comment-form')) {
                e.preventDefault();
                if (!currentUser || !currentUserData) {
                    // showPopup("Please log in to comment.", "error", 0, false); // REPLACED
                    console.error("Please log in to comment.");
                    showPage('login'); return;
                }
                const postElement = e.target.closest('.forum-post'); const postId = postElement?.getAttribute('data-post-id'); const textarea = e.target.querySelector('textarea'); const submitButton = e.target.querySelector('button[type="submit"]'); const content = textarea?.value.trim();
                if (!postId || !textarea || !content || !submitButton) return;

                submitButton.disabled = true; submitButton.textContent = 'Posting...';
                try {
                    const authorName = currentUserData.displayName || 'Anonymous';
                    await addDoc(collection(db, "forumPosts", postId, "comments"), {
                        content, author: authorName, authorId: currentUser.uid,
                        timestamp: new Date(), upvotes: 0, downvotes: 0
                    });
                    textarea.value = '';
                    // Award points for commenting
                    const pointsAwarded = await awardPointsAndCheckBadges(currentUser.uid, POINT_VALUES.CREATE_FORUM_COMMENT, 'createForumComment');
                    // Increment comment count on post doc
                    await updateDoc(doc(db, "forumPosts", postId), { commentCount: increment(1) });
                    // Update UI count
                    const commentBtn = postElement.querySelector('.toggle-comments-btn');
                    if (commentBtn) {
                        const countMatch = commentBtn.textContent.match(/\((\d+)\)/);
                        const currentCount = countMatch ? parseInt(countMatch[1], 10) : 0;
                        commentBtn.textContent = `💬 Comments (${currentCount + 1})`;
                    }

                    // Show RP gain via sidebar if points > 0
                    if (pointsAwarded > 0) {
                        showRpNotification("Comment added", pointsAwarded);
                    } else {
                        console.log(`Comment added to post ${postId}`); // Log if no points
                    }

                    await renderComments(postId); // Refresh comments list

                } catch (error) {
                    console.error('Error adding comment:', error);
                    // showPopup(`Failed to post comment: ${error.message}`, 'error', 0, false); // REPLACED
                    console.error(`Failed to post comment to ${postId}: ${error.message}`);
                } finally {
                    submitButton.disabled = false; submitButton.textContent = 'Comment';
                }
            }
        });

        // Forum Search Input
        const searchInput = forumContainer.querySelector('.search-input');
        let searchTimeout;
        searchInput?.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const searchTerm = searchInput.value.trim().toLowerCase();
            const forumPostsContainer = document.getElementById('forum-posts');
            const loadMoreButton = document.getElementById('load-more-posts');
            if (!forumPostsContainer) return;

            if (loadMoreButton) loadMoreButton.style.display = 'none'; // Hide load more during search
            const existingNoMoreMsg = forumPostsContainer.querySelector('.no-more-posts-message');
            if (existingNoMoreMsg) existingNoMoreMsg.remove();

            if (!searchTerm) { renderForumPosts(); return; } // Reload initial if search cleared

            searchTimeout = setTimeout(async () => {
                forumPostsContainer.innerHTML = '<p class="loading-message">Searching...</p>';
                try {
                    // Basic client-side search (improve with server-side for large scale)
                    // Consider Firestore text search extensions (like Algolia) for production
                    const postsQuery = query(collection(db, "forumPosts"), orderBy("timestamp", "desc"));
                    const querySnapshot = await getDocs(postsQuery);
                    const matchingPosts = [];
                    querySnapshot.forEach((doc) => {
                        const post = { id: doc.id, ...doc.data() };
                        if ((post.title && post.title.toLowerCase().includes(searchTerm)) ||
                            (post.content && post.content.toLowerCase().includes(searchTerm)) ||
                            (post.author && post.author.toLowerCase().includes(searchTerm)) ||
                            (post.category && post.category.toLowerCase().includes(searchTerm)) // Search category too
                        ) {
                            matchingPosts.push(post);
                        }
                    });

                    forumPostsContainer.innerHTML = ''; // Clear loading
                    if (matchingPosts.length === 0) {
                        forumPostsContainer.innerHTML = '<p class="no-data-message">No posts found matching search.</p>';
                    } else {
                        const postPromises = matchingPosts.map(async (post) => { // Get counts for matches
                            try { const commentsSnap = await getDocs(collection(db, "forumPosts", post.id, "comments")); post.commentCount = commentsSnap.size; } catch { post.commentCount = 0; }
                            return post;
                        });
                        const postsWithCounts = await Promise.all(postPromises);
                        postsWithCounts.forEach(post => { forumPostsContainer.appendChild(createPostElement(post)); });
                    }
                } catch (error) {
                    console.error('Error searching posts:', error);
                    forumPostsContainer.innerHTML = '<p class="error-message">Error performing search.</p>';
                    // showPopup("Search failed.", "error", 0, false); // REPLACED
                    console.error("Forum search failed.");
                }
            }, 500); // Debounce search
        });

        // Load More Posts Button Listener
        document.getElementById('load-more-posts')?.addEventListener('click', () => {
            if (!isLoadingForumPosts) renderForumPosts(true);
        });

    } // --- End of forumContainer check ---


    // --- Nearby Reports Page ---
    document.getElementById('load-nearby-reports')?.addEventListener('click', displayNearbyReports);


    // --- Profile Page Event Listeners ---
    function attachProfileEventListeners() {
        // Update Profile Name Form
        document.getElementById('update-profile-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser || !currentUserData) return;
            const nameInput = document.getElementById('profile-new-name');
            const updateButton = document.getElementById('update-profile-button');
            const messageArea = document.getElementById('update-profile-message');
            const newName = nameInput?.value.trim();

            if (!newName) { if (messageArea) messageArea.textContent = 'Display name cannot be empty.'; if (messageArea) messageArea.className = 'form-message error'; return; }
            const currentName = currentUserData.displayName || currentUser.displayName || '';
            if (newName === currentName) { if (messageArea) messageArea.textContent = 'Name is already set to this value.'; if (messageArea) messageArea.className = 'form-message info'; return; }

            updateButton.disabled = true; updateButton.textContent = 'Updating...';
            if (messageArea) messageArea.textContent = ''; messageArea.className = 'form-message';

            try {
                await updateProfile(auth.currentUser, { displayName: newName }); console.log("Auth profile updated.");
                const userRef = doc(db, "users", currentUser.uid); await updateDoc(userRef, { displayName: newName }); console.log("Firestore document updated.");
                await fetchAndSetCurrentUserData(currentUser.uid); // Refresh local data & UI
                if (messageArea) messageArea.textContent = 'Display name updated successfully!'; messageArea.className = 'form-message success';
                // showPopup('Display name updated!', 'success', 0, true); // REPLACED
                console.log('Display name updated!'); // Log success
            } catch (error) {
                console.error("Error updating display name:", error);
                if (messageArea) messageArea.textContent = `Error updating name: ${error.message}`; messageArea.className = 'form-message error';
                // showPopup(`Error updating name: ${error.message}`, 'error', 0, false); // REPLACED
                console.error(`Error updating name: ${error.message}`); // Log error
            } finally {
                updateButton.disabled = false; updateButton.textContent = 'Update Name';
            }
        });

        // Change Password Form
        document.getElementById('change-password-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return;
            const currentPasswordInput = document.getElementById('current-password');
            const newPasswordInput = document.getElementById('new-password');
            const confirmPasswordInput = document.getElementById('confirm-new-password');
            const changeButton = document.getElementById('change-password-button');
            const messageArea = document.getElementById('change-password-message');
            const currentPassword = currentPasswordInput?.value; const newPassword = newPasswordInput?.value; const confirmPassword = confirmPasswordInput?.value;

            if (!currentPassword || !newPassword || !confirmPassword) { if (messageArea) messageArea.textContent = 'Please fill all fields.'; if (messageArea) messageArea.className = 'form-message error'; return; }
            if (newPassword !== confirmPassword) { if (messageArea) messageArea.textContent = 'New passwords do not match.'; if (messageArea) messageArea.className = 'form-message error'; return; }
            if (newPassword.length < 6) { if (messageArea) messageArea.textContent = 'New password must be at least 6 characters.'; if (messageArea) messageArea.className = 'form-message error'; return; }

            changeButton.disabled = true; changeButton.textContent = 'Changing...';
            if (messageArea) messageArea.textContent = 'Re-authenticating...'; messageArea.className = 'form-message info';

            try {
                // Re-authenticate
                const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
                await reauthenticateWithCredential(currentUser, credential); console.log("User re-authenticated.");
                if (messageArea) messageArea.textContent = 'Updating password...';
                // Update password
                await updatePassword(currentUser, newPassword); console.log("Password updated.");
                if (messageArea) messageArea.textContent = 'Password changed successfully!'; messageArea.className = 'form-message success';
                // showPopup('Password changed successfully!', 'success', 0, true); // REPLACED
                console.log('Password changed successfully!'); // Log success
                currentPasswordInput.value = ''; newPasswordInput.value = ''; confirmPasswordInput.value = ''; // Clear fields
            } catch (error) {
                console.error("Error changing password:", error);
                let friendlyMessage = `Error: ${error.message}`;
                if (error.code === 'auth/wrong-password') friendlyMessage = 'Incorrect current password.';
                else if (error.code === 'auth/weak-password') friendlyMessage = 'New password is too weak.';
                else if (error.code === 'auth/requires-recent-login') friendlyMessage = 'Requires recent login. Please log out and log back in.';
                if (messageArea) messageArea.textContent = friendlyMessage; messageArea.className = 'form-message error';
                // showPopup(`Password change failed: ${friendlyMessage}`, 'error', 0, false); // REPLACED
                console.error(`Password change failed: ${friendlyMessage}`); // Log error
            } finally {
                changeButton.disabled = false; changeButton.textContent = 'Change Password';
            }
        });
    }
    // Attach listeners initially
    attachProfileEventListeners();


    // --- Chatbot ---
    document.getElementById('chat-icon')?.addEventListener('click', toggleChat);
    document.querySelector('.send-button')?.addEventListener('click', sendChatMessage);
    document.getElementById('user-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
    });
    document.getElementById('chat-close-button')?.addEventListener('click', toggleChat);

    // --- Microphone Button Event Listeners ---
    const chatbotMicBtn = document.getElementById('chatbot-mic-btn');
    const chatbotUserInput = document.getElementById('user-input');

    if (chatbotMicBtn && chatbotUserInput && recognition) {
        chatbotMicBtn.addEventListener('click', () => {
            if (isRecognizing) {
                recognition.stop();
                return;
            }
            targetInputFieldForSpeech = { inputElement: chatbotUserInput, micButton: chatbotMicBtn };
            // Store the text that is ALREADY in the input field before starting new recognition
            chatbotUserInput.dataset.currentFinalText = chatbotUserInput.value;
            try {
                recognition.start();
            } catch (e) {
                isRecognizing = false; // Ensure state is correct if start fails
                console.error("Error starting recognition (chatbot):", e);
                console.error("Could not start voice recognition. " + e.message);
                if (targetInputFieldForSpeech && targetInputFieldForSpeech.micButton) {
                    targetInputFieldForSpeech.micButton.classList.remove('recognizing');
                    targetInputFieldForSpeech.micButton.innerHTML = '<i class="fas fa-microphone"></i>';
                    targetInputFieldForSpeech.micButton.title = 'Use Microphone';
                }
                targetInputFieldForSpeech = null; // Clear if start failed immediately
            }
        });
    } else if (chatbotMicBtn) {
        chatbotMicBtn.style.display = 'none'; // Hide if API or element not available
    }

    const reportDescMicBtn = document.getElementById('report-desc-mic-btn');
    const problemDescTextarea = document.getElementById('problemDesc');

    if (reportDescMicBtn && problemDescTextarea && recognition) {
        reportDescMicBtn.addEventListener('click', () => {
            if (isRecognizing) {
                recognition.stop();
                return;
            }
            targetInputFieldForSpeech = { inputElement: problemDescTextarea, micButton: reportDescMicBtn };
            // Store the text that is ALREADY in the input field before starting new recognition
            problemDescTextarea.dataset.currentFinalText = problemDescTextarea.value;
            try {
                recognition.start();
            } catch (e) {
                isRecognizing = false; // Ensure state is correct
                console.error("Error starting recognition (report):", e);
                console.error("Could not start voice recognition. " + e.message);
                if (targetInputFieldForSpeech && targetInputFieldForSpeech.micButton) {
                    targetInputFieldForSpeech.micButton.classList.remove('recognizing');
                    targetInputFieldForSpeech.micButton.innerHTML = '<i class="fas fa-microphone"></i>';
                    targetInputFieldForSpeech.micButton.title = 'Use Microphone';
                }
                targetInputFieldForSpeech = null; // Clear if start failed immediately
            }
        });
    } else if (reportDescMicBtn) {
        reportDescMicBtn.style.display = 'none'; // Hide if API or element not available
    }
    // --- End Microphone Button Event Listeners ---


    // --- Initial Setup ---
    console.log("SGResolve App Initialized (No Center Popups). Using RP Sidebar & Console Logs.");
    if (!auth.currentUser && !document.querySelector('.page.show')) {
        showPage('landing'); // Ensure landing page is shown if not logged in
    }
});

// --- Sticky Trending posts ---
(function () {
    const nav = document.getElementById('navbar');
    const trending = document.getElementById('trending-posts');
    const heading = trending ? trending.querySelector('h2') : null;

    function recalc() {
        const navH = nav ? nav.offsetHeight : 0;
        const headH = heading ? heading.offsetHeight : 0;
        document.documentElement.style.setProperty('--nav-h', navH + 'px');
        document.documentElement.style.setProperty('--trend-head', headH + 'px');
    }

    // Recalculate on load, resize, and whenever the navbar/head size changes
    const ro = new ResizeObserver(recalc);
    if (nav) ro.observe(nav);
    if (heading) ro.observe(heading);
    window.addEventListener('resize', recalc);
    document.addEventListener('DOMContentLoaded', recalc);
    recalc();

    // (Styling parity) If you dynamically inject trending items, ensure they use .post-card.
    // Call this after you populate #trending-container.
    window.ensureTrendingCardsMatch = function () {
        const c = document.getElementById('trending-container');
        if (!c) return;
        c.querySelectorAll(':scope > *').forEach(el => el.classList.add('post-card'));
    };

    // If your hamburger toggles the navbar height, recalc on toggle clicks too.
    const toggleBtn = document.querySelector('#navbar .menu-toggle');
    if (toggleBtn) toggleBtn.addEventListener('click', () => {
        // Let the menu animate, then measure
        setTimeout(recalc, 250);
    });
})();
