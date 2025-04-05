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
const IMAGE_ANALYZER_API_URL = "https://ai-photo-analyser-production.up.railway.app/analyze-image";
const TEXT_ANALYSIS_API_URL = 'https://auto-detect-model-production.up.railway.app/predict';

// --- ImgBB Key ---
const IMGBB_API_KEY = '8c3ac5bab399ca801e354b900052510d'; // Your ImgBB Key


// --- reCAPTCHA Callbacks---
window.onRecaptchaSuccess = function() {
  console.log('reCAPTCHA verification successful (frontend)');
  const submitButton = document.getElementById('submit-report-button'); // Use specific ID now
  const recaptchaError = document.getElementById('recaptcha-error');
  if (submitButton) submitButton.disabled = false;
  if (recaptchaError) recaptchaError.style.display = 'none'; // Hide error message
};

window.onRecaptchaExpired = function() {
  console.log('reCAPTCHA verification expired');
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

window.onRecaptchaError = function() {
  console.error('reCAPTCHA error occurred');
  const submitButton = document.getElementById('submit-report-button');
  const recaptchaError = document.getElementById('recaptcha-error');
  if (submitButton) submitButton.disabled = true;
  if (recaptchaError) {
      recaptchaError.textContent = "CAPTCHA failed to load or verify. Please try refreshing.";
      recaptchaError.style.display = 'block'; // Show error message
  }
  showPopup("CAPTCHA failed to load. Please refresh the page.", "error", 0, false);
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
            reportingMap.on('click', function(e) {
                const { lat, lng } = e.latlng;
                if (!singaporeLatLngBounds.contains(e.latlng)) {
                    showPopup('Please select a location within Singapore.', 'warning'); return;
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
    // let tempMarker; // Moved inside initializeReportingMap's scope initially, then made global
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

    // Predefined Locations & Colors (Keep as is)
     const PREDEFINED_LOCATIONS = { /* ... locations ... */
        punggol: { lat: 1.4051, lon: 103.9025, name: "Punggol" }, sengkang: { lat: 1.3917, lon: 103.8954, name: "Sengkang" }, hougang: { lat: 1.3716, lon: 103.8931, name: "Hougang" }, serangoon: { lat: 1.3497, lon: 103.8731, name: "Serangoon" }, tampines: { lat: 1.3544, lon: 103.9439, name: "Tampines" }, pasir_ris: { lat: 1.3731, lon: 103.9493, name: "Pasir Ris" }, bedok: { lat: 1.3240, lon: 103.9298, name: "Bedok" }, changi_airport: { lat: 1.3592, lon: 103.9896, name: "Changi Airport" }, woodlands: { lat: 1.4360, lon: 103.7860, name: "Woodlands" }, yishun: { lat: 1.4295, lon: 103.8350, name: "Yishun" }, sembawang: { lat: 1.4491, lon: 103.8200, name: "Sembawang" }, ang_mo_kio: { lat: 1.3699, lon: 103.8496, name: "Ang Mo Kio" }, bishan: { lat: 1.3508, lon: 103.8484, name: "Bishan" }, toa_payoh: { lat: 1.3324, lon: 103.8497, name: "Toa Payoh" }, orchard: { lat: 1.3048, lon: 103.8318, name: "Orchard Road" }, city_hall: { lat: 1.2931, lon: 103.8525, name: "City Hall" }, raffles_place: { lat: 1.2839, lon: 103.8515, name: "Raffles Place" }, jurong_east: { lat: 1.3331, lon: 103.7422, name: "Jurong East" }, clementi: { lat: 1.3150, lon: 103.7651, name: "Clementi" }, bukit_batok: { lat: 1.3490, lon: 103.7496, name: "Bukit Batok" }, choa_chu_kang: { lat: 1.3854, lon: 103.7446, name: "Choa Chu Kang" }, boon_lay: { lat: 1.3386, lon: 103.7060, name: "Boon Lay" }, harbourfront: { lat: 1.2659, lon: 103.8214, name: "HarbourFront" }, marina_bay: { lat: 1.2808, lon: 103.8596, name: "Marina Bay Sands" },
     };
     const STATUS_COLORS = { /* ... colors ... */ 'Pending': 'rgba(255, 193, 7, 0.7)', 'In Progress': 'rgba(54, 162, 235, 0.7)', 'Resolved': 'rgba(40, 167, 69, 0.7)' };
     const URGENCY_COLORS = { /* ... colors ... */ 'Low': 'rgba(75, 192, 192, 0.7)', 'Medium': 'rgba(255, 159, 64, 0.7)', 'High': 'rgba(255, 99, 132, 0.7)' };
     const CATEGORY_COLORS_MONTHLY = { /* ... colors ... */ 'Infrastructure': 'rgba(153, 102, 255, 0.7)', 'Environmental': 'rgba(40, 167, 69, 0.7)', 'Safety': 'rgba(255, 99, 132, 0.7)', 'Others': 'rgba(201, 203, 207, 0.7)' };

    // --- Gamification Constants ---
    const POINT_VALUES = {
        REGISTER: 50, FIRST_REPORT: 100, SUBMIT_REPORT: 20, REPORT_WITH_IMAGE: 15,
        REPORT_WITH_DESCRIPTION: 5, USE_AI_IMAGE: 10, USE_AI_TEXT: 5,
        REPORT_RESOLVED: 50, CREATE_FORUM_POST: 15, CREATE_FORUM_COMMENT: 5, GIVE_UPVOTE: 1,
    };
    const LEVELS = [0, 200, 500, 1000, 2000, 5000]; // RP for levels 1, 2, 3, 4, 5, 6
    const LEVEL_NAMES = ["Civic Starter", "Observer", "Reporter", "Contributor", "Community Pillar", "City Guardian"];
    const BADGES = {
        'register_welcome': { name: "Welcome Aboard!", description: "Joined SGResolve.", icon: "👋" },
        'first_report': { name: "First Responder", description: "Submitted your first report.", icon: "☝️" },
        'shutterbug': { name: "Shutterbug", description: "Submitted a report with an image.", icon: "📸" },
        'ai_image_user': { name: "AI Assistant (Image)", description: "Used the AI Image Analyzer.", icon: "🖼️🤖" },
        'ai_text_user': { name: "AI Assistant (Text)", description: "Used the AI Text Analyzer.", icon: "📝🤖" },
        'reporter_5': { name: "Junior Reporter", description: "Submitted 5 reports.", icon: "📰" },
        'resolved_1': { name: "Problem Solver", description: "Your first report was resolved!", icon: "✅" }, // Awarded on status update
        'forum_founder': { name: "Forum Founder", description: "Created your first forum post.", icon: "💬" }, // Needs counter
        'commentator': { name: "Commentator", description: "Made your first forum comment.", icon: "🗣️" }, // Needs counter
        // Add more badges as needed
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
                     // Use the container ID to potentially reset a specific instance if needed
                     // grecaptcha.reset(); // General reset works if only one widget on page
                     const widgetContainer = document.getElementById('recaptcha-container');
                     const widgetId = widgetContainer?.getAttribute('data-widget-id'); // Need to store ID if multiple widgets
                     if (widgetId) {
                         grecaptcha.reset(widgetId);
                     } else {
                         grecaptcha.reset(); // Fallback
                     }
                     // Also reset submit button state
                     const submitBtn = document.getElementById('submit-report-button');
                     if (submitBtn) submitBtn.disabled = true;
                     const recaptchaError = document.getElementById('recaptcha-error');
                     if(recaptchaError) recaptchaError.style.display = 'none';

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

    // Enhanced Popup Function with Points
    function showPopup(message, type = 'info', pointsEarned = 0, autoClose = true) {
        const popupOverlay = document.getElementById('popup-overlay');
        const popupMessage = document.getElementById('popup-message');
        const popupIcon = document.getElementById('popup-icon');
        const popup = document.getElementById('popup');
        const closeButton = document.getElementById('popup-close');

        if (!popupOverlay || !popupMessage || !popupIcon || !popup || !closeButton) return;

        // Clear previous content, especially points indicator
        popupMessage.innerHTML = ''; // Clear previous message and points
        popupMessage.textContent = message; // Set main message text

        // Add Points Indicator if points were earned
        if (pointsEarned > 0) {
            const pointsDisplay = document.createElement('span');
            pointsDisplay.textContent = `+${pointsEarned} RP`;
            pointsDisplay.className = 'popup-points-indicator';
            popupMessage.appendChild(pointsDisplay); // Append points indicator
        }

        popup.className = `popup ${type}`; // Apply type class

        // Set icon based on type
        switch (type) {
            case 'success': popupIcon.innerHTML = '✅'; break;
            case 'error': popupIcon.innerHTML = '❌'; break;
            case 'info': popupIcon.innerHTML = 'ℹ️'; break;
            case 'warning': popupIcon.innerHTML = '⚠️'; break; // Added warning
            default: popupIcon.innerHTML = '';
        }

        // Clear previous timeout if exists
        if (popupOverlay.dataset.timeoutId) {
            clearTimeout(parseInt(popupOverlay.dataset.timeoutId, 10));
            delete popupOverlay.dataset.timeoutId;
        }

        popupOverlay.classList.add('show'); // Use class to trigger fade-in
        popup.setAttribute('role', 'alert');
        popup.setAttribute('aria-live', 'assertive');
        popup.setAttribute('tabindex', '-1');
        // popup.focus(); // Focusing can be disruptive, especially for short popups

        if (autoClose) {
            const timeoutId = setTimeout(() => {
                popupOverlay.classList.remove('show');
            }, 3000);
            popupOverlay.dataset.timeoutId = timeoutId.toString();
            closeButton.style.display = 'none';
        } else {
            closeButton.style.display = 'block';
        }
    }
    // Close popup manually
    document.getElementById('popup-close')?.addEventListener('click', () => {
        document.getElementById('popup-overlay')?.classList.remove('show');
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('popup-overlay')?.classList.contains('show')) {
            document.getElementById('popup-overlay')?.classList.remove('show');
        }
    });

    // Badge Earned Popup
    function showBadgeEarnedPopup(badgeId) {
        const badge = BADGES[badgeId];
        if (!badge) return;
        const message = `Badge Earned: ${badge.icon} ${badge.name}! (${badge.description})`;
        // Show a slightly longer, non-autoclosing popup for badges
        showPopup(message, 'info', 0, false); // Set autoClose to false
    }

    // --- Gamification Functions ---

    // Initialize gamification fields in Firestore AND store display name
    async function initializeOrUpdateFirestoreUser(userId, displayName) {
        if (!userId) return;
        const userRef = doc(db, "users", userId);
        try {
            // Use set with merge: true to create doc or add/update fields without overwriting
            // Add displayName here
            await setDoc(userRef, {
                displayName: displayName, // Add/Update display name
                resolvePoints: 0,
                level: 1,
                earnedBadges: [],
                reportCount: 0,
                reportWithImageCount: 0,
                forumPostCount: 0,
                forumCommentCount: 0,
                resolvedReportCount: 0,
            }, { merge: true });
            console.log(`Initialized/Updated Firestore user data for ${userId} with name ${displayName}`);
        } catch (error) {
            console.error(`Failed to initialize/update Firestore user data for ${userId}:`, error);
        }
    }


    // Fetch and store user data from Firestore (now includes display name)
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
                // Ensure defaults if fields are missing from Firestore
                currentUserData.displayName = currentUserData.displayName ?? auth.currentUser?.displayName ?? 'User'; // Fallback chain
                currentUserData.resolvePoints = currentUserData.resolvePoints ?? 0;
                currentUserData.level = currentUserData.level ?? 1;
                currentUserData.earnedBadges = currentUserData.earnedBadges ?? [];
                currentUserData.reportCount = currentUserData.reportCount ?? 0;
                currentUserData.reportWithImageCount = currentUserData.reportWithImageCount ?? 0;
                currentUserData.forumPostCount = currentUserData.forumPostCount ?? 0;
                currentUserData.forumCommentCount = currentUserData.forumCommentCount ?? 0;
                currentUserData.resolvedReportCount = currentUserData.resolvedReportCount ?? 0;

            } else {
                console.log("User document not found in Firestore, initializing...");
                // Get display name from Auth profile IF available
                const authDisplayName = auth.currentUser?.displayName || 'User';
                await initializeOrUpdateFirestoreUser(userId, authDisplayName); // Create Firestore doc with name

                // Re-fetch after initialization
                const newUserSnap = await getDoc(userRef);
                if (newUserSnap.exists()) {
                     currentUserData = { uid: userId, ...newUserSnap.data() };
                     // Ensure defaults again after potential init
                     currentUserData.displayName = currentUserData.displayName ?? authDisplayName; // Use name used for init
                     currentUserData.resolvePoints = currentUserData.resolvePoints ?? 0;
                     currentUserData.level = currentUserData.level ?? 1;
                     currentUserData.earnedBadges = currentUserData.earnedBadges ?? [];
                     currentUserData.reportCount = currentUserData.reportCount ?? 0;
                     currentUserData.reportWithImageCount = currentUserData.reportWithImageCount ?? 0;
                     currentUserData.forumPostCount = currentUserData.forumPostCount ?? 0;
                     currentUserData.forumCommentCount = currentUserData.forumCommentCount ?? 0;
                     currentUserData.resolvedReportCount = currentUserData.resolvedReportCount ?? 0;
                } else {
                     // Fallback if initialization somehow failed
                     console.error("Failed to fetch user data even after initialization attempt.");
                     currentUserData = { uid: userId, displayName: authDisplayName, resolvePoints: 0, level: 1, earnedBadges: [], reportCount: 0, reportWithImageCount: 0, forumPostCount: 0, forumCommentCount: 0, resolvedReportCount: 0 };
                }
            }
             console.log("Fetched currentUserData:", currentUserData);
             updateGamificationUI(); // Update display elements
        } catch (error) {
            console.error("Error fetching user data:", error);
            // Provide a default structure on error to prevent crashes
            currentUserData = { uid: userId, displayName: auth.currentUser?.displayName || 'User', resolvePoints: 0, level: 1, earnedBadges: [], reportCount: 0, reportWithImageCount: 0, forumPostCount: 0, forumCommentCount: 0, resolvedReportCount: 0 };
            updateGamificationUI(); // Update UI with defaults/fallback
            showPopup("Error fetching user profile data.", "error");
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
            // Logged out state
            if (rpDisplay) rpDisplay.textContent = `RP: -`;
            if (levelDisplay) levelDisplay.textContent = `Level: -`;
        }
        // Update profile page if it's the currently shown page
        if (pages.profile && pages.profile.classList.contains('show')) { // Check using class now
             renderProfilePage();
        }
    }

    // Calculate user level based on points
    function calculateLevel(points) {
        let level = 1;
        // Iterate downwards to find the highest level threshold met
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
            return { pointsNeeded: 0, nextLevelPoints: currentPoints, currentLevelPoints: LEVELS[LEVELS.length-1] }; // Max level
        }
        const nextLevelPoints = LEVELS[currentLevel]; // Points threshold for next level
        const currentLevelPoints = LEVELS[currentLevel - 1] || 0; // Points threshold for current level
        const pointsNeeded = nextLevelPoints - currentPoints;
        return { pointsNeeded, nextLevelPoints, currentLevelPoints };
    }

    // Calculate progress percentage towards the next level
    function getLevelProgress(currentPoints) {
        const levelInfo = getPointsForNextLevel(currentPoints);
        const currentLevel = calculateLevel(currentPoints);

        if (currentLevel >= LEVELS.length) return 100; // Max level

        const pointsInCurrentLevel = currentPoints - levelInfo.currentLevelPoints;
        const pointsForThisLevel = levelInfo.nextLevelPoints - levelInfo.currentLevelPoints;

        if (pointsForThisLevel <= 0) return 100; // Avoid division by zero

        return Math.max(0, Math.min(100, (pointsInCurrentLevel / pointsForThisLevel) * 100));
    }

    // Core function to award points and check/award badges
    async function awardPointsAndCheckBadges(userId, pointsToAdd, actionType, data = {}) {
         if (!userId || !currentUser) return 0; // Ensure user is logged in

         // Prevent awarding points to admin
         if (currentUser.email === 'admin@sgresolve.com') {
             console.log("Admin actions do not earn points.");
             return 0;
         }

         if (pointsToAdd <= 0 && actionType !== 'checkOnly') return 0; // No points to add, unless just checking badges

         const userRef = doc(db, "users", userId);
         let awardedPointsActual = 0;
         let newBadgesEarnedIds = [];

         try {
             await runTransaction(db, async (transaction) => {
                 const userSnap = await transaction.get(userRef);
                 // User document SHOULD exist now due to registration/login flow
                 if (!userSnap.exists()) {
                     console.error(`User ${userId} document not found in transaction. Attempting recovery...`);
                     // As a fallback, try getting the name from auth again
                     const authDisplayName = auth.currentUser?.displayName || 'User';
                     await initializeOrUpdateFirestoreUser(userId, authDisplayName); // Try to create it NOW
                     // Re-get within transaction is tricky, might need to abort or structure differently
                     // For now, throw error to indicate state inconsistency
                     throw new Error(`User document ${userId} missing and recovery failed.`);
                 }

                 const userData = userSnap.data();
                 // Ensure defaults for calculations if fields are missing from fetched data
                 const currentPoints = userData.resolvePoints ?? 0;
                 const earnedBadges = userData.earnedBadges ?? [];
                 let reportCount = userData.reportCount ?? 0;
                 let reportWithImageCount = userData.reportWithImageCount ?? 0;
                 let forumPostCount = userData.forumPostCount ?? 0;
                 let forumCommentCount = userData.forumCommentCount ?? 0;
                 let resolvedReportCount = userData.resolvedReportCount ?? 0;

                 let pointsToAwardTotal = pointsToAdd;

                 // Badge Checking Helper
                 const hasBadge = (badgeId) => earnedBadges.includes(badgeId);
                 const checkAndStageBadge = (badgeId, condition) => {
                     if (condition && !hasBadge(badgeId) && !newBadgesEarnedIds.includes(badgeId)) {
                         newBadgesEarnedIds.push(badgeId);
                     }
                 };

                 // --- Check Badges based on actionType ---
                 switch (actionType) {
                     case 'register':
                         checkAndStageBadge('register_welcome', true);
                         break;
                     case 'submitReport':
                          reportCount++; // Increment first
                          const isFirstReport = (reportCount === 1);
                          if (isFirstReport) {
                              // Award first report points ONLY if it's actually the first
                              pointsToAwardTotal += POINT_VALUES.FIRST_REPORT; // Add bonus points
                              checkAndStageBadge('first_report', true);
                          }
                          checkAndStageBadge('reporter_5', reportCount >= 5); // Check after increment
                          if (data.hasImage) {
                            reportWithImageCount++; // Increment if has image
                            checkAndStageBadge('shutterbug', true); // Award on first image upload (will only add if not already present)
                          }
                         break;
                    case 'useAiImage':
                        checkAndStageBadge('ai_image_user', true);
                        break;
                    case 'useAiText':
                         checkAndStageBadge('ai_text_user', true);
                         break;
                     case 'reportResolved':
                          resolvedReportCount++;
                          checkAndStageBadge('resolved_1', true); // Award on first resolved
                          // Add more checks: checkAndStageBadge('resolved_5', resolvedReportCount >= 5);
                         break;
                     case 'createForumPost':
                          forumPostCount++;
                          checkAndStageBadge('forum_founder', true); // Award on first post
                         break;
                    case 'createForumComment':
                         forumCommentCount++;
                         checkAndStageBadge('commentator', true); // Award on first comment
                        break;
                     case 'giveUpvote':
                         // No specific badges for giving upvotes in this setup, but points are awarded
                         break;
                 }
                 // --- End Badge Checking ---


                 // Prepare data to update
                 const finalPoints = currentPoints + pointsToAwardTotal;
                 const finalLevel = calculateLevel(finalPoints);
                 const finalBadges = [...earnedBadges, ...newBadgesEarnedIds]; // Combine existing and new

                 const updateData = {
                     resolvePoints: finalPoints,
                     level: finalLevel,
                     earnedBadges: finalBadges,
                     // Update counters unconditionally now that we increment them before the check
                     reportCount: reportCount,
                     reportWithImageCount: reportWithImageCount,
                     forumPostCount: forumPostCount,
                     forumCommentCount: forumCommentCount,
                     resolvedReportCount: resolvedReportCount,
                     // Include displayName to ensure it's kept up-to-date if Auth changes, though unlikely needed here
                     // displayName: userData.displayName // Maintain existing name from Firestore
                 };

                  transaction.update(userRef, updateData);
                  awardedPointsActual = pointsToAwardTotal; // Store actual points awarded
             });

             console.log(`Transaction successful: Awarded ${awardedPointsActual} points to ${userId}. New badges: ${newBadgesEarnedIds.join(', ')}`);

             // Update local state AFTER successful transaction
             if (currentUser && currentUser.uid === userId) {
                  await fetchAndSetCurrentUserData(userId); // Fetch fresh data to update local currentUserData
                  // Show popups for new badges earned AFTER updating local data
                   newBadgesEarnedIds.forEach(badgeId => {
                       showBadgeEarnedPopup(badgeId); // Uses the non-auto-closing popup
                   });
             }
             return awardedPointsActual; // Return points for immediate feedback

         } catch (error) {
             console.error("Error in awardPointsAndCheckBadges transaction:", error);
             // Avoid showing generic error popup for this internal process unless critical
             if (error.message.includes("User document missing")) {
                 showPopup("Error updating profile points. Please try again later.", "error");
             }
             return 0; // Indicate failure or no points awarded
         }
    }

    // Render Profile Page Content
    function renderProfilePage() {
        const profilePage = pages.profile;
        if (!profilePage || !currentUserData || !currentUser) { // Also check currentUser for email
             console.log("Cannot render profile: Page element, user data or current user missing.");
             if (profilePage) profilePage.innerHTML = '<p class="loading-message">Loading profile...</p>';
             if (!currentUserData && currentUser) {
                 fetchAndSetCurrentUserData(currentUser.uid);
             }
             return;
        }

        // --- Ensure the FULL profile structure exists (important if it was cleared) ---
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
             // Re-add event listeners if structure was rebuilt
             attachProfileEventListeners();
        }

        // Populate Summary (as before)
        const currentDisplayName = currentUserData.displayName || currentUser.displayName || 'User'; // More robust fallback
        document.getElementById('profile-username').textContent = currentDisplayName;
        const points = currentUserData.resolvePoints || 0;
        const level = currentUserData.level || 1;
        const levelName = LEVEL_NAMES[level - 1] || 'Contributor';
        document.getElementById('profile-level').textContent = level;
        document.getElementById('profile-rp').textContent = points;
        const levelNameEl = document.getElementById('profile-level-name');
        if (levelNameEl) levelNameEl.textContent = levelName;

        // Populate Progress Bar (as before)
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

        // --- Populate NEW Profile Details ---
        const emailDisplay = document.getElementById('profile-email-display');
        const nameInput = document.getElementById('profile-new-name');
        if (emailDisplay) emailDisplay.textContent = currentUser.email || 'N/A';
        if (nameInput) nameInput.value = currentDisplayName; // Pre-fill input with current name

        // Populate Badges (as before)
        const badgesContainer = document.getElementById('badges-container');
        const noBadgesMessage = document.getElementById('no-badges-message');
        if (!badgesContainer || !noBadgesMessage) return;
        badgesContainer.innerHTML = ''; // Clear previous
        const earnedBadges = currentUserData.earnedBadges || [];
        if (earnedBadges.length === 0) {
            noBadgesMessage.style.display = 'block';
        } else {
            noBadgesMessage.style.display = 'none';
            earnedBadges.forEach(badgeId => { /* ... (badge rendering logic as before) ... */
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
        if(updateMsg) updateMsg.textContent = '';
        if(changePwMsg) changePwMsg.textContent = '';
        if(document.getElementById('change-password-form')) document.getElementById('change-password-form').reset(); // Clear password fields on render

    }


    // --- Report Fetching & Rendering Functions (Keep existing, ensure fetchReports handles errors) ---
    async function fetchReports(userId = null) { /* ... Keep existing implementation ... */
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
                // Include reports even if coords are slightly off, but log warning
                if (isNaN(latitude) || isNaN(longitude)) {
                    console.warn(`Report ${doc.id} has invalid coordinates: lat=${data.latitude}, lon=${data.longitude}`);
                 }
                reports.push({
                    id: doc.id,
                    ...data,
                    // Keep potentially NaN coords, handle in rendering if needed
                    latitude: latitude,
                    longitude: longitude,
                    // Ensure timestamp is a Date object, provide fallback
                    timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : (data.timestamp ? new Date(data.timestamp) : new Date())
                });
            });
            return reports;
        } catch (error) {
            console.error('Error fetching reports:', error);
            showPopup(`Error fetching reports: ${error.message}`, 'error');
            return [];
        }
    }
    async function fetchReportsThisMonth() { /* ... Keep existing implementation ... */
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0); // Start precisely at the beginning
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999); // End precisely at the end
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
    function applyFilters(allReports) { /* ... Keep existing implementation ... */
        const imageFilter = document.getElementById('image-filter')?.value || 'all';
        const categoryFilter = document.getElementById('category-filter')?.value || 'all';
        const urgencyFilter = document.getElementById('urgency-filter')?.value || 'all';
        const threatFilter = document.getElementById('threat-filter')?.value || 'all';

        let filteredReports = allReports.slice(); // Create a shallow copy to filter

        if (imageFilter !== 'all') {
            filteredReports = filteredReports.filter(report => {
                const hasImage = !!report.imageUrl; // Check if imageUrl exists and is not empty/null
                return imageFilter === 'with' ? hasImage : !hasImage;
            });
        }
        if (categoryFilter !== 'all') { filteredReports = filteredReports.filter(report => report.category === categoryFilter); }
        if (urgencyFilter !== 'all') { filteredReports = filteredReports.filter(report => report.urgency === urgencyFilter); }
        if (threatFilter !== 'all') { filteredReports = filteredReports.filter(report => report.threat === threatFilter); }

        return filteredReports;
    }
    function renderAdminMap(reportsToDisplay) { /* ... Keep existing implementation ... */
        if (!adminMap) return;
        // Clear existing markers
        adminReportMarkers.forEach(marker => adminMap.removeLayer(marker));
        adminReportMarkers = [];

        if (!reportsToDisplay || reportsToDisplay.length === 0) {
            // No reports to display, maybe reset view or leave as is
            // adminMap.setView([1.3521, 103.8198], 11); // Optional: Reset view
            return;
        }

        let validMarkersExist = false;
        reportsToDisplay.forEach(report => {
             // Check for valid, numeric latitude and longitude
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
                                        <img src="${report.imageUrl}" alt="Report Image" class="popup-report-image" style="max-width: 150px; height: auto; margin-top: 5px;">
                                      </a>`;
                }
                marker.bindPopup(popupContent);
                adminReportMarkers.push(marker);
                validMarkersExist = true;
             } else {
                 console.warn(`Skipping marker for report ${report.id} due to invalid coordinates.`);
             }
        });

        // Fit bounds only if there are valid markers
        if (validMarkersExist && adminReportMarkers.length > 0) {
             try {
                 const group = new L.featureGroup(adminReportMarkers);
                 adminMap.fitBounds(group.getBounds().pad(0.1));
             } catch (e) {
                 console.error("Error fitting map bounds:", e);
                 adminMap.setView([1.3521, 103.8198], 11); // Fallback view
             }
        } else if (reportsToDisplay.length > 0 && !validMarkersExist) {
            // Handle case where reports exist but none have valid coordinates
            adminMap.setView([1.3521, 103.8198], 11);
        } else {
             // Reset view if no reports at all
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
    async function renderAdminReports() { /* ... Keep existing implementation, uses createStatusDropdown ... */
        const adminReportsContainer = document.getElementById('admin-reports-container');
        if (!adminReportsContainer) return;
        adminReportsContainer.innerHTML = '<p class="loading-message">Loading reports...</p>';

        try {
            const allReports = await fetchReports();
            const filteredReports = applyFilters(allReports);
            adminReportsContainer.innerHTML = ''; // Clear loading message

            if (filteredReports.length === 0) {
                adminReportsContainer.innerHTML = '<p class="no-data-message">No reports match the current filters.</p>';
                renderAdminMap([]); // Clear map if no reports match
                return;
            }

            filteredReports.forEach(report => {
                const li = document.createElement('li');
                li.setAttribute('data-report-id', report.id);
                // Add classes for styling based on urgency/threat if needed (CSS handles this)
                // li.classList.add(`urgency-${(report.urgency || 'N/A').toLowerCase()}`, `threat-${(report.threat || 'N/A').toLowerCase()}`);

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
                         <button class="button danger-button delete-report-btn" data-report-id="${report.id}" style="margin-top: 10px;">Delete Report</button>
                    </div>`;
                adminReportsContainer.appendChild(li);
            });
            renderAdminMap(filteredReports); // Update map with filtered reports
        } catch (error) {
            console.error('Error rendering admin reports:', error);
            adminReportsContainer.innerHTML = '<p class="error-message">Error loading reports.</p>';
            renderAdminMap([]); // Clear map on error
        }
    }
    async function renderUserReports() { /* ... Keep existing implementation ... */
        if (!currentUser) return;
        const userReportsContainer = document.getElementById('user-reports-container');
        if (!userReportsContainer) return;
        userReportsContainer.innerHTML = '<p class="loading-message">Loading your reports...</p>';

        try {
            const userReports = await fetchReports(currentUser.uid);
            userReportsContainer.innerHTML = ''; // Clear loading message
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
                    : ''; // Don't show "no image" text here

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
    async function renderAdminAnalytics() { /* ... Keep existing implementation ... */
        const totalReportsEl = document.getElementById('stat-total-reports');
        const pendingReportsEl = document.getElementById('stat-pending-reports');
        const resolvedReportsEl = document.getElementById('stat-resolved-reports');
        const totalMonthEl = document.getElementById('total-reports-month');
        const statusChartCanvas = document.getElementById('status-chart');
        const noStatusDataEl = document.getElementById('no-status-data');
        const urgencyChartCanvas = document.getElementById('urgency-chart');
        const noUrgencyDataEl = document.getElementById('no-urgency-data');
        const categoryChartCanvas = document.getElementById('reports-chart'); // Original ID for monthly category chart
        const noReportsMsgEl = document.getElementById('no-reports-message');

        // Helper to destroy existing Chart instance
        const destroyChart = (instance) => {
            if (instance) {
                instance.destroy();
            }
        };

        // Destroy previous charts before fetching new data
        destroyChart(statusChartInstance); statusChartInstance = null;
        destroyChart(urgencyChartInstance); urgencyChartInstance = null;
        destroyChart(categoryChartInstance); categoryChartInstance = null;
        window.reportsChart = null; // Clear global reference if used

        // Reset visibility and message states
        if(statusChartCanvas) statusChartCanvas.style.display = 'block';
        if(noStatusDataEl) noStatusDataEl.style.display = 'none';
        if(urgencyChartCanvas) urgencyChartCanvas.style.display = 'block';
        if(noUrgencyDataEl) noUrgencyDataEl.style.display = 'none';
        if(categoryChartCanvas) categoryChartCanvas.style.display = 'block';
        if(noReportsMsgEl) noReportsMsgEl.style.display = 'none';


        try {
            // Fetch all reports and reports for the current month concurrently
            const [allReports, reportsThisMonth] = await Promise.all([
                fetchReports(),
                fetchReportsThisMonth()
            ]);

            const totalReportsCount = allReports.length;
            const totalReportsMonthCount = reportsThisMonth.length;

            // Initialize counters
            const statusCounts = { 'Pending': 0, 'In Progress': 0, 'Resolved': 0 };
            const urgencyCounts = { 'Low': 0, 'Medium': 0, 'High': 0 };
            const categoryCountsMonth = { 'Infrastructure': 0, 'Environmental': 0, 'Safety': 0, 'Others': 0 };

            // Aggregate counts from all reports
            allReports.forEach(report => {
                if (report.status && statusCounts.hasOwnProperty(report.status)) {
                    statusCounts[report.status]++;
                } else if (report.status) {
                    console.warn(`Report ${report.id} has unknown status: ${report.status}`);
                    // Optionally count under a generic 'Other Status' if needed
                }

                if (report.urgency && urgencyCounts.hasOwnProperty(report.urgency)) {
                    urgencyCounts[report.urgency]++;
                } else if (report.urgency) {
                     console.warn(`Report ${report.id} has unknown urgency: ${report.urgency}`);
                }
            });

            // Aggregate counts for the current month's reports by category
            reportsThisMonth.forEach(report => {
                const category = (report.category && categoryCountsMonth.hasOwnProperty(report.category))
                                 ? report.category
                                 : 'Others';
                categoryCountsMonth[category]++;
            });

            // Update stat cards
            if (totalReportsEl) totalReportsEl.textContent = totalReportsCount;
            if (pendingReportsEl) pendingReportsEl.textContent = statusCounts['Pending'];
            if (resolvedReportsEl) resolvedReportsEl.textContent = statusCounts['Resolved'];
            if (totalMonthEl) totalMonthEl.textContent = `Total this month: ${totalReportsMonthCount}`;

            // --- Render Status Chart (Doughnut) ---
            const statusCtx = statusChartCanvas?.getContext('2d');
            const statusDataAvailable = Object.values(statusCounts).some(count => count > 0);
            if (statusChartCanvas) statusChartCanvas.style.display = statusDataAvailable ? 'block' : 'none';
            if (noStatusDataEl) noStatusDataEl.style.display = statusDataAvailable ? 'none' : 'block';

            if (statusCtx && statusDataAvailable) {
                statusChartInstance = new Chart(statusCtx, {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(statusCounts),
                        datasets: [{
                            data: Object.values(statusCounts),
                            backgroundColor: Object.keys(statusCounts).map(status => STATUS_COLORS[status] || '#cccccc'),
                            borderColor: '#fff', // White border between segments
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom', labels: { padding: 15 } },
                            title: { display: false } // Keep title element in HTML
                        }
                    }
                });
            }

            // --- Render Urgency Chart (Bar) ---
            const urgencyCtx = urgencyChartCanvas?.getContext('2d');
            const urgencyDataAvailable = Object.values(urgencyCounts).some(count => count > 0);
             if (urgencyChartCanvas) urgencyChartCanvas.style.display = urgencyDataAvailable ? 'block' : 'none';
             if (noUrgencyDataEl) noUrgencyDataEl.style.display = urgencyDataAvailable ? 'none' : 'block';

            if (urgencyCtx && urgencyDataAvailable) {
                urgencyChartInstance = new Chart(urgencyCtx, {
                    type: 'bar', // Changed to vertical bar
                    data: {
                        labels: Object.keys(urgencyCounts),
                        datasets: [{
                            // label: '# of Reports', // Optional dataset label
                            data: Object.values(urgencyCounts),
                            backgroundColor: Object.keys(urgencyCounts).map(urg => URGENCY_COLORS[urg] || '#cccccc'),
                            borderColor: Object.keys(urgencyCounts).map(urg => (URGENCY_COLORS[urg] || '#cccccc').replace('0.7', '1')), // Make border solid
                            borderWidth: 1
                        }]
                    },
                    options: {
                        indexAxis: 'x', // Keep vertical bars
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true, title: { display: false } }, // Y-axis is count
                            x: { title: { display: false } } // X-axis is urgency level
                        },
                        plugins: {
                            legend: { display: false }, // No legend needed for single dataset
                            title: { display: false } // Keep title element in HTML
                        }
                    }
                });
            }

            // --- Render Category Chart (Monthly - Bar) ---
            const categoryCtx = categoryChartCanvas?.getContext('2d'); // Original ID
            const categoryDataAvailable = totalReportsMonthCount > 0;
            if (categoryChartCanvas) categoryChartCanvas.style.display = categoryDataAvailable ? 'block' : 'none';
            if (noReportsMsgEl) noReportsMsgEl.style.display = categoryDataAvailable ? 'none' : 'block';

            if (categoryCtx && categoryDataAvailable) {
                const allCategories = Object.keys(categoryCountsMonth);
                categoryChartInstance = new Chart(categoryCtx, {
                    type: 'bar',
                    data: {
                        labels: allCategories,
                        datasets: [{
                            // label: 'Reports This Month', // Optional dataset label
                            data: allCategories.map(cat => categoryCountsMonth[cat]),
                            backgroundColor: allCategories.map(cat => CATEGORY_COLORS_MONTHLY[cat] || '#cccccc'),
                            borderColor: allCategories.map(cat => (CATEGORY_COLORS_MONTHLY[cat] || '#cccccc').replace('0.7', '1')), // Make border solid
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: '# Reports' } },
                            x: { title: { display: false } } // Category names on x-axis
                        },
                        plugins: {
                            legend: { display: false }, // No legend needed
                            title: { display: false } // Keep title element in HTML
                        }
                    }
                });
                 window.reportsChart = categoryChartInstance; // Update global ref if needed elsewhere
            } else {
                 window.reportsChart = null; // Clear global ref if no data
            }

        } catch (error) {
            console.error("Error rendering admin analytics:", error);
            showPopup("Error loading analytics data.", "error", 0, false); // Non-auto close error
             // Optionally hide all chart areas and show generic error messages
             if(statusChartCanvas) statusChartCanvas.style.display = 'none';
             if(noStatusDataEl) { noStatusDataEl.textContent = 'Error loading status data.'; noStatusDataEl.style.display = 'block'; }
             if(urgencyChartCanvas) urgencyChartCanvas.style.display = 'none';
             if(noUrgencyDataEl) { noUrgencyDataEl.textContent = 'Error loading urgency data.'; noUrgencyDataEl.style.display = 'block'; }
             if(categoryChartCanvas) categoryChartCanvas.style.display = 'none';
             if(noReportsMsgEl) { noReportsMsgEl.textContent = 'Error loading category data.'; noReportsMsgEl.style.display = 'block'; }
        }
    }

    // --- Forum Functions (Keep existing, ensure createPostElement, renderComments, formatRichText etc. are present) ---
    function formatRichText(text) { /* ... Keep existing implementation ... */
        if (!text) return '';
        // Basic escaping first
        const escapedText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        // Apply markdown-like formatting
        return escapedText
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/\*(.*?)\*/g, '<em>$1</em>')         // Italics
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>') // Links
            .replace(/\n/g, '<br>');                      // Newlines
    }
    function getCategoryColor(category) { /* ... Keep existing implementation ... */
        const colors = { General: '#4facfe', Issues: '#ff6b6b', Ideas: '#2ea44f', Events: '#f4a261' };
        return colors[category] || '#586069'; // Default grey
    }
    async function renderComments(postId) { /* ... Keep existing implementation ... */
        const commentsList = document.querySelector(`.forum-post[data-post-id="${postId}"] .comments-list`);
        if (!commentsList) return;
        commentsList.innerHTML = '<li>Loading comments...</li>';
        try {
            const commentsQuery = query(collection(db, "forumPosts", postId, "comments"), orderBy("timestamp", "asc"));
            const querySnapshot = await getDocs(commentsQuery);
            commentsList.innerHTML = ''; // Clear loading message
            if (querySnapshot.empty) {
                commentsList.innerHTML = '<li>No comments yet. Be the first!</li>'; return;
            }
            querySnapshot.forEach((doc) => {
                const comment = doc.data();
                const commentTimestamp = comment.timestamp?.toDate ? new Date(comment.timestamp.toDate()) : new Date();
                const li = document.createElement('li');
                li.classList.add('comment-item');
                li.setAttribute('data-comment-id', doc.id); // Add comment ID attribute
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
    function formatTimeAgo(date) { /* ... Keep existing implementation ... */
        if (!(date instanceof Date) || isNaN(date)) {
            return 'Invalid date'; // Handle invalid date input
        }
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
        // Handle future dates or very recent times
        if (seconds < 0) return "in the future";
        if (seconds < 10) return "just now";
        return Math.floor(seconds) + " seconds ago";
    }
    function createPostElement(post) { /* ... Keep existing implementation ... */
        const postDiv = document.createElement('div');
        postDiv.classList.add('forum-post');
        if (post.pinned) postDiv.classList.add('pinned');
        postDiv.setAttribute('data-post-id', post.id);
        const postTimestamp = post.timestamp?.toDate ? new Date(post.timestamp.toDate()) : new Date();
        const timeAgo = formatTimeAgo(postTimestamp);

        // Determine if current user is author or admin for delete button visibility
        const canDelete = currentUser && (currentUser.email === 'admin@sgresolve.com' || currentUser.uid === post.authorId);
        const deleteButtonHtml = canDelete
            ? `<button class="delete-post-btn" data-post-id="${post.id}" title="Delete Post">🗑️ Delete</button>`
            : '';

        // Pin button for admin
        const pinButtonHtml = (currentUser && currentUser.email === 'admin@sgresolve.com')
            ? `<button class="pin-btn" data-post-id="${post.id}" data-pinned="${post.pinned ? 'true' : 'false'}" title="${post.pinned ? 'Unpin Post' : 'Pin Post'}">${post.pinned ? 'Unpin' : 'Pin'}</button>`
            : '';

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
    async function renderForumPosts(loadMore = false) { /* ... Keep existing implementation, including Load More button handling ... */
        const forumPostsContainer = document.getElementById('forum-posts');
        const loadMoreButton = document.getElementById('load-more-posts');
        if (!forumPostsContainer) return;

        // Clear "no more posts" message if loading initial batch or searching
         const existingNoMoreMsg = forumPostsContainer.querySelector('.no-more-posts-message');
         if (existingNoMoreMsg && !loadMore) {
             existingNoMoreMsg.remove();
         }

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
            // Define base constraints: Pinned first, then by timestamp descending
            const baseConstraints = [orderBy("pinned", "desc"), orderBy("timestamp", "desc")];
            const fetchLimit = 10; // Number of posts to fetch per batch

            if (loadMore && lastVisiblePost) {
                 // Fetch next batch starting after the last visible post
                 postsQuery = query(postsCollection, ...baseConstraints, startAfter(lastVisiblePost), limit(fetchLimit));
            } else {
                 // Fetch the initial batch
                 postsQuery = query(postsCollection, ...baseConstraints, limit(fetchLimit));
            }
            const querySnapshot = await getDocs(postsQuery);

            if (!loadMore) {
                 forumPostsContainer.innerHTML = ''; // Clear initial loading message only if it's the first load
            }

            if (querySnapshot.empty && !loadMore) {
                // No posts found on initial load
                forumPostsContainer.innerHTML = '<p class="no-data-message">No posts yet. Be the first to post!</p>';
                 if (loadMoreButton) loadMoreButton.style.display = 'none'; // Hide load more if nothing initially
            } else if (!querySnapshot.empty) {
                // Fetch comment counts (consider optimizing later, maybe store count in post document)
                const postPromises = querySnapshot.docs.map(async (doc) => {
                    const post = { id: doc.id, ...doc.data() };
                    try {
                        // Efficient way to get count (if stored in post doc)
                        // post.commentCount = post.commentCount || 0; // Use stored count if available

                        // Less efficient way (querying subcollection - keep for now if needed)
                        const commentsSnap = await getDocs(collection(db, "forumPosts", post.id, "comments"));
                        post.commentCount = commentsSnap.size; // Get count from subcollection size

                    } catch(e) {
                        console.warn(`Could not fetch comment count for post ${post.id}`, e);
                        post.commentCount = 0;
                    }
                    return post;
                });
                const postsWithCounts = await Promise.all(postPromises);

                postsWithCounts.forEach((post) => {
                    const postElement = createPostElement(post);
                    forumPostsContainer.appendChild(postElement);
                });
                // Update lastVisiblePost for pagination
                lastVisiblePost = querySnapshot.docs[querySnapshot.docs.length - 1];

                // Show/hide load more button based on results
                if (loadMoreButton) {
                    loadMoreButton.style.display = querySnapshot.docs.length < fetchLimit ? 'none' : 'block';
                    loadMoreButton.disabled = false;
                    loadMoreButton.textContent = 'Load More Posts';
                }
            } else if (querySnapshot.empty && loadMore) {
                // No more posts to load
                if (loadMoreButton) loadMoreButton.style.display = 'none';
                // Add "You've reached the end!" message only if it doesn't exist
                if (!forumPostsContainer.querySelector('.no-more-posts-message')) {
                   const noMoreMsg = document.createElement('p');
                   noMoreMsg.textContent = "You've reached the end!";
                   noMoreMsg.classList.add('no-more-posts-message', 'subtle-text', 'text-center');
                   forumPostsContainer.appendChild(noMoreMsg);
                }
            }

             // Fetch and render trending posts (consider limiting frequency or using Cloud Functions)
             try {
                 const allPostsSnapshot = await getDocs(query(collection(db, "forumPosts"), orderBy("timestamp", "desc"), limit(50))); // Limit initial fetch for trending
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
                 loadMoreButton.style.display = 'block'; // Keep visible to indicate error
            }
            showPopup("Error loading forum posts.", "error");
        } finally {
            isLoadingForumPosts = false;
            // Ensure button state is correct if it wasn't hidden
            if (loadMoreButton && loadMoreButton.style.display === 'block') {
                 loadMoreButton.disabled = false;
                 loadMoreButton.textContent = 'Load More Posts';
            }
        }
    }
    function renderTrendingPosts(posts) { /* ... Keep existing implementation ... */
        const trendingContainer = document.getElementById('trending-container');
        if (!trendingContainer) return;
        trendingContainer.innerHTML = ''; // Clear previous

        // Calculate score: upvotes - downvotes. Also include recent posts with 0 score.
        const scoredPosts = posts.map(post => ({
            ...post,
            score: (post.upvotes || 0) - (post.downvotes || 0),
            timestampDate: post.timestamp?.toDate ? new Date(post.timestamp.toDate()) : new Date(0) // Ensure Date object
        })).filter(post =>
            post.score > 0 || // Positive score
            (post.score === 0 && post.timestampDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Neutral score but recent (last 7 days)
        );

        // Sort by score (desc), then by date (desc) as tie-breaker
        const trending = scoredPosts.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score; // Higher score first
            return b.timestampDate - a.timestampDate; // Newer first if scores tie
        }).slice(0, 5); // Take top 5

        if (trending.length === 0) {
            trendingContainer.innerHTML = '<p>No trending posts yet.</p>';
            return;
        }

        trending.forEach(post => {
          const postDiv = document.createElement('div');
          postDiv.classList.add('trending-post');
          postDiv.setAttribute('data-post-id', post.id); // Keep ID for potential linking
          postDiv.innerHTML = `
            <h4>${post.title || 'Untitled'}</h4>
            <p><small>By ${post.author || 'Anonymous'} • ${post.score} Score</small></p>
          `;
          // Add click listener to scroll to the post if it's loaded
          postDiv.addEventListener('click', () => {
            const targetPostElement = document.querySelector(`.forum-post[data-post-id="${post.id}"]`);
            if (targetPostElement) {
                targetPostElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetPostElement.classList.add('highlight'); // Flash highlight
                setTimeout(() => {
                    targetPostElement.classList.remove('highlight');
                }, 1500); // Remove highlight after 1.5s
            } else {
                showPopup("Post might not be loaded yet. Scroll down or click 'Load More Posts'.", "info");
            }
          });
          trendingContainer.appendChild(postDiv);
        });
    }

    // --- Nearby Reports Functions (Keep existing) ---
    function getDeviceLocation() { /* ... Keep existing implementation ... */
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation is not supported by your browser."));
            } else {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        // Basic check if coords seem valid (though browser should handle this)
                        if (typeof position.coords.latitude === 'number' && typeof position.coords.longitude === 'number') {
                            resolve({
                                lat: position.coords.latitude,
                                lon: position.coords.longitude
                            });
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
                    {
                        timeout: 10000, // 10 seconds timeout
                        enableHighAccuracy: false // More likely to succeed quickly, less battery drain
                    }
                );
            }
        });
    }
    function clearNearbyMapMarkers() { /* ... Keep existing implementation ... */
        if (nearbyMap) {
             nearbyMarkers.forEach(marker => nearbyMap.removeLayer(marker));
        }
        nearbyMarkers = []; // Reset the array
    }
    function renderNearbyReportItem(report, distance) { /* ... Keep existing implementation ... */
        const li = document.createElement('li');
        li.classList.add('nearby-report-item');
        const distanceText = distance < 1000
            ? `${Math.round(distance)} m away`
            : `${(distance / 1000).toFixed(1)} km away`;

        const imageHtml = report.imageUrl
            ? `<div class="nearby-report-image"><img src="${report.imageUrl}" alt="Report Image"></div>`
            : '<div class="nearby-report-image no-image" aria-label="No image available"></div>'; // Added aria-label

        li.innerHTML = `
            <div class="nearby-report-info">
                <p><strong>Location:</strong> ${report.locationName || 'N/A'}</p>
                <p><strong>Category:</strong> ${report.category || 'N/A'} | <strong>Status:</strong> ${report.status || 'N/A'}</p>
                <p class="report-distance"><i class="icon-location" aria-hidden="true">📍</i> ${distanceText}</p>
            </div>
            ${imageHtml}
        `;
        // Add click listener to pan map to the report location
        li.addEventListener('click', () => {
            if (nearbyMap && typeof report.latitude === 'number' && typeof report.longitude === 'number') {
                nearbyMap.setView([report.latitude, report.longitude], 15); // Zoom in closer
                // Find the corresponding marker and open its popup
                const correspondingMarker = nearbyMarkers.find(m =>
                    m.getLatLng().lat === report.latitude && m.getLatLng().lng === report.longitude
                );
                if (correspondingMarker) {
                    correspondingMarker.openPopup();
                }
            }
        });
        return li;
    }
    async function displayNearbyReports() { /* ... Keep existing implementation ... */
        const locationSelector = document.getElementById('location-selector');
        const radiusSelector = document.getElementById('radius-selector');
        const container = document.getElementById('nearby-reports-container');
        const statusDiv = document.getElementById('nearby-status');
        const loadButton = document.getElementById('load-nearby-reports');

        if (!locationSelector || !radiusSelector || !container || !statusDiv || !loadButton) {
            console.error("Nearby reports elements not found."); return;
        }
        if (!nearbyMap) { // Ensure map is initialized
            initializeNearbyMap();
            if (!nearbyMap) { showPopup("Map could not be initialized.", "error"); return; }
        }

        const selectedLocationType = locationSelector.value;
        const selectedRadius = parseInt(radiusSelector.value, 10);

        // UI updates for loading state
        container.innerHTML = ''; // Clear previous results
        statusDiv.textContent = 'Loading...';
        loadButton.disabled = true;
        loadButton.textContent = 'Loading...';
        clearNearbyMapMarkers(); // Clear markers from previous searches

        let centerCoords;
        let centerName = "Selected Area";
        let userMarker = null; // To hold the marker for user's current location

        try {
            // Determine center coordinates based on selection
            if (selectedLocationType === 'current') {
                statusDiv.textContent = 'Getting your current location...';
                centerCoords = await getDeviceLocation(); // Fetch device location
                centerName = "Your Location";
                // Add a distinct marker for the user's location
                 if (nearbyMap) {
                     userMarker = L.marker([centerCoords.lat, centerCoords.lon], {
                         icon: L.icon({
                             iconUrl: 'images/user-location-marker.png', // Use a custom icon if available
                             iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -30]
                         }),
                         zIndexOffset: 1000 // Ensure user marker is on top
                     }).addTo(nearbyMap);
                     userMarker.bindPopup("Your Current Location");
                     nearbyMarkers.push(userMarker); // Add to marker array to manage bounds
                 }
            } else if (PREDEFINED_LOCATIONS[selectedLocationType]) {
                centerCoords = PREDEFINED_LOCATIONS[selectedLocationType];
                centerName = PREDEFINED_LOCATIONS[selectedLocationType].name;
            } else {
                throw new Error("Invalid location selected."); // Should not happen with dropdown
            }

            statusDiv.textContent = `Fetching reports near ${centerName}...`;
            const allReports = await fetchReports(); // Fetch all reports (consider optimizing if huge dataset)

            const nearbyReports = [];
            const centerLatLng = L.latLng(centerCoords.lat, centerCoords.lon);

            // Filter reports based on distance
            allReports.forEach(report => {
                if (typeof report.latitude === 'number' && typeof report.longitude === 'number' &&
                    !isNaN(report.latitude) && !isNaN(report.longitude)) { // Ensure valid coords
                    const reportLatLng = L.latLng(report.latitude, report.longitude);
                    const distance = centerLatLng.distanceTo(reportLatLng); // Calculate distance in meters
                    if (distance <= selectedRadius) {
                        nearbyReports.push({ ...report, distance }); // Add report with distance info
                    }
                }
            });

            // Sort nearby reports by distance (closest first)
            nearbyReports.sort((a, b) => a.distance - b.distance);

            // Display results
            if (nearbyReports.length === 0) {
                statusDiv.textContent = `No reports found within ${selectedRadius / 1000} km of ${centerName}.`;
                container.innerHTML = '<p class="no-data-message">Try selecting a larger radius or a different location.</p>';
                // Center map on the search location even if no results
                if (nearbyMap) nearbyMap.setView([centerCoords.lat, centerCoords.lon], 13);
            } else {
                statusDiv.textContent = `Showing ${nearbyReports.length} reports near ${centerName}.`;
                nearbyReports.forEach(report => {
                    // Append report item to the list
                    container.appendChild(renderNearbyReportItem(report, report.distance));
                    // Add marker to the map for each nearby report
                    if (nearbyMap && typeof report.latitude === 'number' && typeof report.longitude === 'number') {
                        const marker = L.marker([report.latitude, report.longitude]).addTo(nearbyMap);
                        const distanceText = report.distance < 1000
                            ? `${Math.round(report.distance)}m`
                            : `${(report.distance / 1000).toFixed(1)}km`;
                        marker.bindPopup(`
                            <strong>${report.locationName || 'N/A'}</strong><br>
                            (${report.category || 'N/A'}) - ${report.status || 'N/A'}<br>
                            ~${distanceText} away
                        `);
                        nearbyMarkers.push(marker); // Add report marker to array
                    }
                });

                // Fit map bounds to show all markers (including user marker if present)
                if (nearbyMap && nearbyMarkers.length > 0) {
                    try {
                        const group = new L.featureGroup(nearbyMarkers);
                        nearbyMap.fitBounds(group.getBounds().pad(0.1)); // Add slight padding
                    } catch (e) {
                        console.error("Error fitting nearby map bounds:", e);
                        // Fallback if bounds fail (e.g., single marker)
                        if (nearbyMarkers.length === 1) {
                             nearbyMap.setView(nearbyMarkers[0].getLatLng(), 15);
                        } else {
                             nearbyMap.setView([centerCoords.lat, centerCoords.lon], 12);
                        }
                    }
                } else if (nearbyMap) {
                     // If only user marker exists, center on it
                     if (userMarker) nearbyMap.setView(userMarker.getLatLng(), 15);
                     else nearbyMap.setView([centerCoords.lat, centerCoords.lon], 13); // Fallback if no markers at all
                }
            }

        } catch (error) {
            console.error("Error loading nearby reports:", error);
            statusDiv.textContent = `Error: ${error.message}`;
            container.innerHTML = '<p class="error-message">Could not load nearby reports.</p>';
            showPopup(`Could not load nearby reports: ${error.message}`, "error");
            // Center map on attempted search location if known
            if (nearbyMap && centerCoords) {
                nearbyMap.setView([centerCoords.lat, centerCoords.lon], 11);
            }
        } finally {
            // Reset button state regardless of success/failure
            loadButton.disabled = false;
            loadButton.textContent = 'Load Reports';
        }
    }

    // --- Chatbot Functions (Keep existing) ---
    function toggleChat() { /* ... Keep existing implementation ... */
        const chatContainer = document.getElementById('chat-container');
        const chatIcon = document.getElementById('chat-icon');
        chatContainer?.classList.toggle('active');
        chatIcon?.classList.toggle('active'); // Might not be needed if only container controls visibility
        if (chatContainer?.classList.contains('active')) {
            document.getElementById('user-input')?.focus(); // Focus input when opened
        }
    }
    async function sendChatMessage() { /* ... Keep existing implementation ... */
        const userInputElement = document.getElementById("user-input");
        const chatBox = document.getElementById("chat-box");
        const sendButton = document.querySelector('.send-button'); // Target button specifically

        if (!userInputElement || !chatBox || !sendButton) return; // Ensure elements exist

        const userInput = userInputElement.value.trim();
        if (!userInput) return; // Don't send empty messages

        // Disable input and button during processing
        userInputElement.disabled = true;
        sendButton.disabled = true;
        sendButton.textContent = '...'; // Indicate loading

        // Display user's message immediately
        const userMsgDiv = document.createElement('div');
        userMsgDiv.classList.add('message', 'user');
        // Sanitize user input before displaying (basic example)
        userMsgDiv.innerHTML = `<strong>You:</strong> ${userInput.replace(/</g, "&lt;").replace(/>/g, "&gt;")}`;
        chatBox.appendChild(userMsgDiv);
        userInputElement.value = ""; // Clear input field
        chatBox.scrollTop = chatBox.scrollHeight; // Scroll to bottom

        try {
            // Use your actual Chatbot API URL
            const CHATBOT_API_URL = "https://chatbot-server-production-da96.up.railway.app/chat";
            const response = await fetch(CHATBOT_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userInput }) // Send user message
            });

            if (!response.ok) {
                // Try to get more detail from the error response
                let errorDetail = '';
                try {
                    const errorData = await response.json();
                    errorDetail = errorData.error || JSON.stringify(errorData);
                } catch (e) {
                    // If response is not JSON
                    errorDetail = await response.text();
                }
                throw new Error(`Chatbot API error: ${response.status} ${response.statusText}. Detail: ${errorDetail}`);
            }

            const data = await response.json();
            // Display bot's response
            const botMsgDiv = document.createElement('div');
            botMsgDiv.classList.add('message', 'bot');
            // Use formatRichText for bot response as it might contain markdown/links
            botMsgDiv.innerHTML = `<strong>SGResolve Bot:</strong> ${formatRichText(data.response || "Sorry, I couldn't process that.")}`;
            chatBox.appendChild(botMsgDiv);

        } catch (error) {
            console.error("Chatbot error:", error);
            // Display error message in chat
            const errorMsgDiv = document.createElement('div');
            errorMsgDiv.classList.add('message', 'bot', 'error'); // Use error style
            errorMsgDiv.innerHTML = `<strong>SGResolve Bot:</strong> Sorry, an error occurred connecting to the chatbot. Please try again later.`;
            chatBox.appendChild(errorMsgDiv);
        } finally {
            // Re-enable input and button
            userInputElement.disabled = false;
            sendButton.disabled = false;
            sendButton.textContent = 'Send';
            chatBox.scrollTop = chatBox.scrollHeight; // Scroll to bottom again
            userInputElement.focus(); // Re-focus input
        }
    }

    // --- About Page Animation ---
    function initializeAboutPageObserver() { /* ... Keep existing implementation ... */
        const sections = document.querySelectorAll('#about-page .about-section .content');

        // Fallback for browsers that don't support IntersectionObserver
        if (sections.length === 0 || !('IntersectionObserver' in window)) {
            sections.forEach(section => {
                 if (section.parentElement) section.parentElement.classList.add('visible');
            });
            return;
        }

        const observer = new IntersectionObserver(
            (entries, obs) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Add 'visible' class to the PARENT .about-section for styling
                        if (entry.target.parentElement) {
                            entry.target.parentElement.classList.add('visible');
                        }
                        obs.unobserve(entry.target); // Stop observing once visible
                    }
                });
            },
            {
                threshold: 0.1, // Trigger when 10% of the element is visible
                // rootMargin: '0px 0px -50px 0px' // Optional: trigger slightly before fully entering viewport
            }
        );

        sections.forEach(section => {
            observer.observe(section);
        });
    }


    // --- Auth State Change Listener (Modified) ---
    onAuthStateChanged(auth, async (user) => { // Made async
        const wasLoggedIn = !!currentUser; // Track previous state
        currentUser = user; // Update global currentUser IMMEDIATELY

        if (user) {
            console.log("User logged in:", user.uid, user.email, user.displayName);
            // Fetch or initialize user data from Firestore (includes display name now)
            await fetchAndSetCurrentUserData(user.uid); // Ensures currentUserData is populated

            // Decide which page to show AFTER data is fetched/initialized
            if (!wasLoggedIn) { // Only change page on initial login, not on profile update refresh
                 hideAllPages(); // Hide pages before showing the correct one
                 if (user.email === 'admin@sgresolve.com') {
                     showPage('admin');
                 } else {
                     showPage('reporting'); // Default for regular users
                 }
            } else {
                // If user was already logged in (e.g., profile update), just update UI
                updateNavbar();
                // If the profile page is currently visible, refresh its content
                if (pages.profile && pages.profile.classList.contains('show')) {
                    renderProfilePage();
                }
            }
            updateNavbar(); // Update navbar for logged-in state

        } else {
            console.log("User logged out or not logged in.");
            currentUserData = null; // Clear local user data on logout
            imageDataUrl = null; // Clear image data on logout
            // Reset any reporting form state if needed
             const reportForm = document.getElementById('report-form');
             if(reportForm) reportForm.reset();
             const imgPreview = document.getElementById('imagePreview');
             if(imgPreview) imgPreview.innerHTML = '';
             const analyzeBtn = document.getElementById('analyzeImageBtn');
             if(analyzeBtn) analyzeBtn.disabled = true;
             const autoDetectBtn = document.getElementById('autoDetect');
             if(autoDetectBtn) autoDetectBtn.disabled = true;
             if (tempMarker && reportingMap) { // Clear map marker on logout
                 reportingMap.removeLayer(tempMarker);
                 tempMarker = null;
             }
             // Reset CAPTCHA on logout if it exists
             if (typeof grecaptcha !== 'undefined' && grecaptcha) {
                 try { grecaptcha.reset(); } catch(e) { console.warn("Error resetting CAPTCHA on logout:", e); }
             }
             const submitBtn = document.getElementById('submit-report-button');
             if (submitBtn) submitBtn.disabled = true; // Ensure submit is disabled


            if (wasLoggedIn) { // Only redirect to landing if they *were* logged in
                hideAllPages();
                showPage('landing');
            } else {
                 // If wasn't logged in before (e.g., initial page load, no user),
                 // ensure landing page is shown if no other logic dictates otherwise.
                 // This might be redundant if showPage('landing') is called elsewhere,
                 // but acts as a safeguard.
                 if (!document.querySelector('.page.show')) { // Only if no page is currently shown
                      showPage('landing');
                 }
            }
            updateNavbar(); // Update navbar for logged-out state
        }
    });


    // --- Event Listeners ---

    // Navigation (Add Profile Link)
    document.getElementById('nav-home')?.addEventListener('click', (e) => { e.preventDefault(); if (currentUser) { currentUser.email === 'admin@sgresolve.com' ? showPage('admin') : showPage('reporting'); } else { showPage('landing'); } });
    document.getElementById('nav-my-reports')?.addEventListener('click', (e) => { e.preventDefault(); if (currentUser) { showPage('myReports'); } else { showPage('login'); } });
    document.getElementById('nav-nearby-reports')?.addEventListener('click', (e) => { e.preventDefault(); if (currentUser) { showPage('nearbyReports'); /* displayNearbyReports(); // Load automatically? Or wait for button click */ } else { showPage('login'); } });
    document.getElementById('nav-community')?.addEventListener('click', (e) => { e.preventDefault(); showPage('community'); });
    document.getElementById('nav-about')?.addEventListener('click', (e) => { e.preventDefault(); showPage('about'); });
    document.getElementById('nav-profile')?.addEventListener('click', (e) => { e.preventDefault(); if (currentUser) { showPage('profile'); } else { showPage('login'); } }); // Profile Page Link
    document.getElementById('nav-logout')?.addEventListener('click', (e) => { e.preventDefault(); signOut(auth).then(() => { showPopup("Logged out successfully.", "success"); /* Auth listener handles UI changes */ }).catch(error => { console.error("Logout error:", error); showPopup(`Logout failed: ${error.message}`, "error"); }); });

    // Landing Page Buttons
    document.getElementById('hero-report-issue')?.addEventListener('click', (e) => { e.preventDefault(); showPage(currentUser ? 'reporting' : 'login'); }); // Go to reporting if logged in
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

        if (!email || !password) {
            showPopup("Please enter both email and password.", "warning");
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Logging in...';

        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                console.log('Login successful for:', userCredential.user.email);
                showPopup('Logged in successfully!', 'success');
                // Proactively update UI
                currentUser = userCredential.user; // Update global variable immediately
                // Auth listener will handle fetching data and showing page
                // updateNavbar(); // Show navbar right away (handled by auth listener)
                // Navigate to appropriate page based on user role (handled by auth listener)
            })
            .catch((error) => {
                console.error("Login Error:", error.code, error.message);
                let message = `Login failed. Please check credentials.`;
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    message = 'Invalid email or password.';
                } else if (error.code === 'auth/invalid-email') {
                    message = 'Invalid email format.';
                } else {
                    message = `Login error: ${error.message}`;
                }
                showPopup(message, 'error');
            })
            .finally(() => {
                submitButton.disabled = false;
                submitButton.textContent = 'Login';
            });
    });
    // Registration Form (Modified for Gamification Init & Display Name storage)
    document.getElementById('register-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('register-name'); // Get name input
        const emailInput = document.getElementById('register-email');
        const passwordInput = document.getElementById('register-password');
        const submitButton = e.target.querySelector('button[type="submit"]');

        const name = nameInput.value.trim(); // Get the name
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!name || !email || !password) { // Validate name as well
            showPopup('Please fill in all fields: Full Name, Email, and Password.', 'warning');
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Registering...';

        createUserWithEmailAndPassword(auth, email, password)
            .then(async (userCredential) => { // Make async to wait for profile updates
                const user = userCredential.user;
                console.log('Registration successful for:', user.email);

                // --- Update Auth Profile Display Name ---
                try {
                    await updateProfile(user, { displayName: name });
                    console.log('Firebase Auth profile display name updated.');
                } catch (profileError) {
                    console.error('Error updating Firebase Auth profile name:', profileError);
                    // Continue registration even if profile update fails initially
                }

                // --- Initialize Firestore User Doc (includes name and gamification) ---
                try {
                    await initializeOrUpdateFirestoreUser(user.uid, name);
                    console.log('Firestore user document initialized.');

                    // ---> Award points for registration <---
                    const pointsAwarded = await awardPointsAndCheckBadges(user.uid, POINT_VALUES.REGISTER, 'register');
                    showPopup(`Registration successful! Welcome, ${name}!`, 'success', pointsAwarded);

                } catch (firestoreError) {
                    console.error('Error initializing Firestore user data:', firestoreError);
                    showPopup('Registration successful, but failed to save profile details. Please try updating later.', 'warning');
                }

                // Auth listener will handle UI updates and navigation
                // currentUser = user; // Let auth listener set this
                // updateNavbar();
                // showPage('reporting');

            })
            .catch((error) => {
                console.error('Registration error:', error.code, error.message);
                let message = 'Registration failed. Please try again.';
                if (error.code === 'auth/email-already-in-use') {
                    message = 'Email already in use.';
                } else if (error.code === 'auth/invalid-email') {
                    message = 'Invalid email format.';
                } else if (error.code === 'auth/weak-password') {
                    message = 'Password is too weak.';
                }
                showPopup(message, 'error');
            })
            .finally(() => {
                submitButton.disabled = false;
                submitButton.textContent = 'Register';
            });
    });

    // Admin Logout
    document.getElementById('logout-admin')?.addEventListener('click', (e) => { e.preventDefault(); signOut(auth).then(() => { showPopup("Admin logged out successfully.", "success"); }).catch(error => { console.error("Admin logout error:", error); showPopup(`Logout failed: ${error.message}`, "error"); }); });

    // Reporting Page - Detect Location Button
    document.getElementById('detectLocation')?.addEventListener('click', function() { /* ... Keep existing implementation ... */
        const button = this; button.disabled = true; button.textContent = 'Detecting...';
        getDeviceLocation().then(coords => { const latLng = L.latLng(coords.lat, coords.lon); if (!singaporeLatLngBounds.contains(latLng)) { showPopup('Your detected location appears to be outside Singapore.', 'warning'); } if (!reportingMap) initializeReportingMap(); if (reportingMap) { if (tempMarker) reportingMap.removeLayer(tempMarker); tempMarker = L.marker(latLng).addTo(reportingMap); reportingMap.setView(latLng, 16); } document.getElementById('latitude').value = coords.lat.toFixed(6); document.getElementById('longitude').value = coords.lon.toFixed(6); }).catch(error => { showPopup(`Could not detect location: ${error.message}`, 'error'); }).finally(() => { button.disabled = false; button.textContent = 'Detect Location'; });
    });

    // --- Reporting Page - Image Upload & AI Analysis (FIXED) ---
    const imageUpload = document.getElementById('imageUpload');
    const imagePreview = document.getElementById('imagePreview');
    const analyzeImageBtn = document.getElementById('analyzeImageBtn');

    imageUpload?.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadstart = () => {
                 if (imagePreview) imagePreview.innerHTML = '<p>Loading preview...</p>';
                 if (analyzeImageBtn) analyzeImageBtn.disabled = true; // Disable while loading
                 imageDataUrl = null; // Reset data URL
            };
            reader.onloadend = () => {
                // reader.result contains the base64 data URL
                imageDataUrl = reader.result; // <-- Assign the result here
                if (imagePreview) {
                    imagePreview.innerHTML = `<img src="${imageDataUrl}" alt="Image Preview">`;
                }
                // *** FIX: Enable the button only AFTER imageDataUrl is set ***
                if (analyzeImageBtn) {
                     analyzeImageBtn.disabled = false;
                }
            };
            reader.onerror = () => {
                console.error("Error reading file");
                if (imagePreview) imagePreview.innerHTML = '<p class="error-message">Error loading preview.</p>';
                if (analyzeImageBtn) analyzeImageBtn.disabled = true;
                imageDataUrl = null;
                showPopup("Failed to read image file.", "error");
            };
            reader.readAsDataURL(file); // Read the file as Base64
        } else {
            // No file selected or not an image
            imageDataUrl = null;
            if (imagePreview) imagePreview.innerHTML = ''; // Clear preview
            if (analyzeImageBtn) analyzeImageBtn.disabled = true; // Disable button
            if (file) { // If a file was selected but wasn't an image
                 showPopup("Please select a valid image file (JPEG, PNG, GIF, etc.).", "warning");
            }
        }
    });


    // AI Analyze Button (Image) - Check API URL
    analyzeImageBtn?.addEventListener('click', async () => {
        if (!imageDataUrl || !currentUser) {
             // Should not happen if button enablement logic is correct, but check anyway
             showPopup("Please select an image first.", "warning"); return;
        }
        if (!IMAGE_ANALYZER_API_URL || !IMAGE_ANALYZER_API_URL.startsWith('https')) {
             showPopup("AI Image Analyzer Service URL is not configured correctly.", "error"); return;
        }

        analyzeImageBtn.disabled = true; analyzeImageBtn.textContent = 'Analyzing...';
        showPopup("Sending image for AI analysis...", "info", false); // Non-auto-close

        try {
            // Ensure imageDataUrl contains the base64 part
            const base64Data = imageDataUrl.split(',')[1];
            if (!base64Data) throw new Error("Invalid image data format.");

            const response = await fetch(IMAGE_ANALYZER_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify({ image_data: base64Data }) // Send only base64 data
            });
            document.getElementById('popup-overlay')?.classList.remove('show'); // Close sending popup

            if (!response.ok) {
                let errorMsg = `AI analysis failed: ${response.status}`;
                 try {
                     const errorData = await response.json();
                     errorMsg = errorData.error || errorMsg; // Use specific error if available
                 } catch (e) { /* Ignore if response not JSON */ }
                 throw new Error(errorMsg);
            }
            const result = await response.json();

            // --- Update dropdowns based on API result ---
            const categorySelect = document.getElementById('category');
            const urgencySelect = document.getElementById('urgency');
            const threatSelect = document.getElementById('threat');

            // Helper to safely set dropdown value
            const setSelectValue = (selectElement, value) => {
                 if (selectElement && value && [...selectElement.options].some(opt => opt.value === value)) {
                     selectElement.value = value;
                 } else if (value) {
                      console.warn(`AI suggested value "${value}" not found in dropdown "${selectElement?.id}".`);
                 }
            };

            setSelectValue(categorySelect, result.category);
            setSelectValue(urgencySelect, result.urgency);
            setSelectValue(threatSelect, result.threat);

            // ---> Award points for using AI <---
            const pointsAwarded = await awardPointsAndCheckBadges(currentUser.uid, POINT_VALUES.USE_AI_IMAGE, 'useAiImage');
            showPopup(`AI Analysis Complete: Fields updated.`, "success", pointsAwarded);

        } catch (error) {
            if (document.getElementById('popup-overlay')?.classList.contains('show')) {
                document.getElementById('popup-overlay').classList.remove('show');
            }
            console.error('AI Image Analysis Error:', error);
            showPopup(`AI Analysis Failed: ${error.message}`, 'error', false); // Show detailed error
        } finally {
            // Re-enable button even if AI fails, user might want to retry or submit manually
            analyzeImageBtn.disabled = false;
            analyzeImageBtn.textContent = 'Analyze Image with AI';
        }
    });

    // Reporting Page - Auto Detect Feature (Text Analysis - Modified)
    const autoDetectButton = document.getElementById('autoDetect');
    const problemDescInput = document.getElementById('problemDesc');
    problemDescInput?.addEventListener('input', () => { if (autoDetectButton) autoDetectButton.disabled = !problemDescInput.value.trim(); });
    autoDetectButton?.addEventListener('click', async () => {
        const description = problemDescInput?.value.trim();
        if (!description || !currentUser) { showPopup('Please enter a description first.', 'warning'); return; }
        if (!TEXT_ANALYSIS_API_URL || !TEXT_ANALYSIS_API_URL.startsWith('https')) { showPopup("Text Analysis Service URL is not configured correctly.", "error"); return; }

        autoDetectButton.disabled = true; autoDetectButton.textContent = 'Detecting...';
        showPopup("Analyzing description text...", "info", false);

        try {
            const response = await fetch(TEXT_ANALYSIS_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: description }) });
             document.getElementById('popup-overlay')?.classList.remove('show'); // Close sending popup

            if (!response.ok) { let errorMsg = `Text analysis failed: ${response.status}`; try { errorMsg = (await response.json()).error || errorMsg; } catch (e) {} throw new Error(errorMsg); }
            const data = await response.json();

            // --- Update dropdowns ---
            const categorySelect = document.getElementById('category'); const urgencySelect = document.getElementById('urgency'); const threatSelect = document.getElementById('threat');
            const predictedCategory = data.category || ''; const predictedUrgency = data.urgency || ''; const predictedThreat = data.threat || '';

            // Helper function from image analysis reused
            const setSelectValue = (selectElement, value) => {
                 if (selectElement && value && [...selectElement.options].some(opt => opt.value === value)) {
                     selectElement.value = value;
                 } else if (value) {
                      console.warn(`AI suggested value "${value}" not found in dropdown "${selectElement?.id}".`);
                 }
            };

            setSelectValue(categorySelect, predictedCategory);
            setSelectValue(urgencySelect, predictedUrgency);
            setSelectValue(threatSelect, predictedThreat);

            // ---> Award points for using AI <---
            const pointsAwarded = await awardPointsAndCheckBadges(currentUser.uid, POINT_VALUES.USE_AI_TEXT, 'useAiText');
            showPopup(`Text analysis complete! Categories suggested.`, "success", pointsAwarded);

        } catch (error) {
             if (document.getElementById('popup-overlay')?.classList.contains('show')) { document.getElementById('popup-overlay').classList.remove('show'); } // Ensure popup closes
            console.error('Text Auto Detect Error:', error);
            // document.getElementById('report-error').textContent = 'Text auto detect failed.'; // Show inline error too
            showPopup(`Text Auto-Detect Failed: ${error.message}`, 'error', false);
        } finally {
            autoDetectButton.disabled = false; autoDetectButton.textContent = 'Auto Detect (Text)';
        }
    });

    // --- Reporting Page - Form Submission (MODIFIED FOR CAPTCHA) ---
    document.getElementById('report-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        let docRef = null; // Define docRef outside try block
        // --- Get submit button reference ---
        const submitButton = document.getElementById('submit-report-button'); // Use ID

        if (!currentUser || !currentUserData) {
            showPopup("Please log in to submit a report.", "error");
            showPage('login');
            return;
        }

        // --- CAPTCHA Check (Frontend only) ---
        // Note: In a secure setup, you'd send the response token to the backend for verification using the Secret Key.
        // Here, we just check if the button is enabled (meaning CAPTCHA was checked).
        if (submitButton.disabled) {
            const recaptchaError = document.getElementById('recaptcha-error');
             if (recaptchaError) {
                recaptchaError.textContent = "Please complete the CAPTCHA verification.";
                recaptchaError.style.display = 'block';
             }
             console.warn("Attempted submission without completing CAPTCHA.");
             // Optionally shake the CAPTCHA element or show a more prominent error
             const captchaContainer = document.getElementById('recaptcha-container');
             if(captchaContainer){
                captchaContainer.parentElement?.classList.add('shake'); // Add shake to group
                setTimeout(() => {
                    captchaContainer.parentElement?.classList.remove('shake');
                }, 500);
             }
             return; // Stop submission
        }
        // --- End CAPTCHA Check ---

        const locationNameInput = document.getElementById('locationName');
        const latitudeInput = document.getElementById('latitude');
        const longitudeInput = document.getElementById('longitude');
        const descriptionInput = document.getElementById('problemDesc');
        const categorySelect = document.getElementById('category');
        const urgencySelect = document.getElementById('urgency');
        const threatSelect = document.getElementById('threat');
        const fileInput = document.getElementById('imageUpload');
        const imagePreview = document.getElementById('imagePreview'); // For clearing
        const analyzeImageBtn = document.getElementById('analyzeImageBtn'); // For disabling
        const autoDetectButton = document.getElementById('autoDetect'); // For disabling

        const locationName = locationNameInput?.value.trim() ?? '';
        const latitudeStr = latitudeInput?.value ?? '';
        const longitudeStr = longitudeInput?.value ?? '';
        const description = descriptionInput?.value.trim() ?? '';
        const category = categorySelect?.value ?? '';
        const urgency = urgencySelect?.value ?? '';
        const threat = threatSelect?.value ?? '';

        // Validation (Keep existing)
        const latitude = parseFloat(latitudeStr);
        const longitude = parseFloat(longitudeStr);
        if (!locationName || isNaN(latitude) || isNaN(longitude) || !description || !category || !urgency || !threat) {
             showPopup('Please fill all required fields (Location, Coordinates, Description, Category, Urgency, Threat).', 'warning'); return;
        }
        if (!singaporeLatLngBounds.contains([latitude, longitude])) {
             showPopup('Coordinates must be within Singapore.', 'warning'); return;
        }

        // Disable button immediately during processing
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';
        showPopup("Submitting report...", "info", false); // Non-auto close popup

        let uploadedImageUrl = null;
        const file = fileInput?.files[0];

        // --- ImgBB Upload (Conditional - Keep existing logic) ---
        if (file && imageDataUrl && IMGBB_API_KEY) {
            try {
                 console.log("Attempting image upload to ImgBB...");
                 const formData = new FormData();
                 const base64Data = imageDataUrl.split(',')[1];
                 if (!base64Data) throw new Error("Invalid base64 image data.");

                 formData.append('image', base64Data);
                 formData.append('key', IMGBB_API_KEY);

                 const imgbbResponse = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
                 const imgbbData = await imgbbResponse.json();

                 console.log("ImgBB Response:", imgbbData);

                 if (imgbbData.success && imgbbData.data && imgbbData.data.url) {
                     uploadedImageUrl = imgbbData.data.url;
                     console.log('Image Upload Success:', uploadedImageUrl);
                 } else {
                     throw new Error(imgbbData.error?.message || `ImgBB upload failed. Status: ${imgbbData.status_code || 'Unknown'}`);
                 }
            } catch (error) {
                 console.error('Image Upload Error:', error);
                 document.getElementById('popup-overlay')?.classList.remove('show');
                 showPopup(`Image upload failed: ${error.message}. Report will be submitted without image.`, 'warning', false);
            }
        } else if (file) {
            console.warn("Image file selected, but imageDataUrl or ImgBB key missing. Submitting without image.");
            if (!IMGBB_API_KEY) showPopup("ImgBB API Key not configured. Cannot upload image.", "warning");
        }
        // --- End ImgBB Upload ---

        const reporterName = currentUserData.displayName || 'Anonymous';

        const reportData = {
            userId: currentUser.uid,
            userName: reporterName,
            locationName, latitude, longitude, description, category, urgency, threat,
            imageUrl: uploadedImageUrl,
            status: 'Pending',
            timestamp: new Date() // Use client timestamp
        };

        try {
            docRef = await addDoc(collection(db, "reports"), reportData); // Assign to outer scope docRef
            console.log('Report added to Firestore with ID:', docRef.id);

            // ---> Award Points & Check Badges (Keep existing logic) <---
            let pointsToAward = POINT_VALUES.SUBMIT_REPORT;
            let actionData = { hasImage: !!uploadedImageUrl };
            if (description.length > 50) pointsToAward += POINT_VALUES.REPORT_WITH_DESCRIPTION;
            if (actionData.hasImage) pointsToAward += POINT_VALUES.REPORT_WITH_IMAGE;
            const pointsAwarded = await awardPointsAndCheckBadges(currentUser.uid, pointsToAward, 'submitReport', actionData);
            // ---> End Gamification Award <---

            document.getElementById('popup-overlay')?.classList.remove('show'); // Close submitting popup
            showPopup('Report submitted successfully!', 'success', pointsAwarded);

            // --- Reset Form (Keep existing logic) ---
            e.target.reset();
            imageDataUrl = null;
            if (imagePreview) imagePreview.innerHTML = '';
            if (analyzeImageBtn) analyzeImageBtn.disabled = true;
            if (autoDetectButton) autoDetectButton.disabled = true;
            if (tempMarker && reportingMap) {
                reportingMap.removeLayer(tempMarker);
                tempMarker = null;
            }
            // Clear coordinate fields too
            if (latitudeInput) latitudeInput.value = '';
            if (longitudeInput) longitudeInput.value = '';


            // ---> Reset CAPTCHA and Disable Submit Button <---
            if (typeof grecaptcha !== 'undefined' && grecaptcha) {
                 try {
                     grecaptcha.reset(); // Reset the CAPTCHA widget
                 } catch (captchaError) {
                      console.error("Error resetting reCAPTCHA:", captchaError);
                 }
             }
             // Ensure button is disabled after successful submission and reset
             if (submitButton) submitButton.disabled = true;
             // --- End CAPTCHA Reset ---


            // Refresh relevant views if shown (Keep existing)
            if (pages.myReports?.classList.contains('show')) renderUserReports();
            // if (currentUser.email === 'admin@sgresolve.com' && pages.admin?.classList.contains('show')) { await renderAdminReports(); await renderAdminAnalytics(); }

        } catch (error) {
            if (document.getElementById('popup-overlay')?.classList.contains('show')) { document.getElementById('popup-overlay').classList.remove('show'); } // Ensure popup closes
            console.error('Error adding report to Firestore:', error);
            showPopup(`Error submitting report: ${error.message}`, 'error', false); // Show detailed error
        } finally {
             // Re-enable button only if submission *failed* (docRef wasn't created)
             if (submitButton && !docRef) {
                 submitButton.disabled = false;
                 // Note: If CAPTCHA failed, button might already be disabled by its logic.
                 // If Firestore failed, re-enabling might be okay, but user might need to re-verify CAPTCHA.
                 // Consider resetting CAPTCHA here too on Firestore error.
                 if (typeof grecaptcha !== 'undefined' && grecaptcha) grecaptcha.reset();
             } else if (submitButton && docRef) {
                 // If submission succeeded (docRef exists), ensure button remains disabled
                 submitButton.disabled = true;
             }
             if (submitButton) submitButton.textContent = 'Submit Report';
        }
    });


    // --- Admin Page Actions (Modified for Gamification) ---
    document.getElementById('apply-filters')?.addEventListener('click', renderAdminReports);
    document.getElementById('reset-filters')?.addEventListener('click', () => {
        // Reset filter dropdowns
        const imageFilter = document.getElementById('image-filter');
        const categoryFilter = document.getElementById('category-filter');
        const urgencyFilter = document.getElementById('urgency-filter');
        const threatFilter = document.getElementById('threat-filter');
        if(imageFilter) imageFilter.value = 'all';
        if(categoryFilter) categoryFilter.value = 'all';
        if(urgencyFilter) urgencyFilter.value = 'all';
        if(threatFilter) threatFilter.value = 'all';
        // Re-render reports with default filters
        renderAdminReports();
     });
    document.getElementById('refresh-reports')?.addEventListener('click', async () => { /* ... Keep existing implementation ... */
         const button = document.getElementById('refresh-reports');
         if (!button || button.disabled) return; // Prevent double clicks
         button.disabled = true; button.textContent = 'Refreshing...';
         showPopup("Refreshing data...", "info", false);
         try {
             // Fetch and render reports and analytics concurrently
             await Promise.all([renderAdminReports(), renderAdminAnalytics()]);
             document.getElementById('popup-overlay')?.classList.remove('show'); // Close loading popup
             showPopup("Data refreshed!", "success");
         } catch (error) {
             document.getElementById('popup-overlay')?.classList.remove('show');
             console.error("Refresh Error:", error);
             showPopup("Failed to refresh data.", "error");
         } finally {
             if (button) {
                 button.disabled = false; button.textContent = 'Refresh Reports';
             }
         }
    });
    document.getElementById('export-data')?.addEventListener('click', async () => { /* ... Keep existing implementation ... */
        const button = document.getElementById('export-data');
        if (!button) return;
        button.disabled = true; button.textContent = 'Exporting...';
        showPopup("Generating CSV export...", "info", false);
        try {
            const allReports = await fetchReports(); // Fetch all reports
            if (allReports.length === 0) {
                 document.getElementById('popup-overlay')?.classList.remove('show');
                 showPopup("No reports to export.", "info"); return;
            }
            const csvRows = [];
            // Define headers
            const headers = ['ID', 'User ID', 'User Name', 'Location Name', 'Latitude', 'Longitude', 'Description', 'Category', 'Urgency', 'Threat', 'Image URL', 'Status', 'Timestamp'];
            csvRows.push(headers.join(','));

            // Helper function to escape CSV fields containing commas, quotes, or newlines
            const escapeCsvField = (field) => {
                const stringField = String(field ?? ''); // Handle null/undefined -> empty string
                if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
                    // Enclose in double quotes and escape existing double quotes
                    return `"${stringField.replace(/"/g, '""')}"`;
                }
                return stringField;
            };

            // Process each report
            allReports.forEach(report => {
                // Ensure timestamp is a consistent string format (ISO)
                const timestampStr = report.timestamp instanceof Date ? report.timestamp.toISOString() : '';
                const row = [
                    report.id, report.userId, report.userName, report.locationName, report.latitude, report.longitude,
                    report.description, report.category, report.urgency, report.threat, report.imageUrl, report.status,
                    timestampStr
                ].map(escapeCsvField); // Escape each field
                csvRows.push(row.join(','));
            });

            const csvString = csvRows.join('\n');
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');

            if (link.download !== undefined) { // Check for download attribute support
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                const formattedDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
                link.setAttribute('download', `sgresolve_reports_${formattedDate}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url); // Clean up blob URL
                document.getElementById('popup-overlay')?.classList.remove('show');
                showPopup("Export generated and download started.", "success");
            } else {
                // Fallback for browsers that don't support download attribute
                 document.getElementById('popup-overlay')?.classList.remove('show');
                showPopup("CSV generated, but auto-download not supported. Please copy the data.", "warning", false);
                // Optionally display the CSV in a new window/textarea (can be large)
                // window.open('data:text/csv;charset=utf-8,' + encodeURIComponent(csvString));
            }
        } catch (error) {
             document.getElementById('popup-overlay')?.classList.remove('show');
            console.error('Error exporting reports:', error);
            showPopup(`Export failed: ${error.message}`, 'error', false);
        } finally {
            if (button) {
                button.disabled = false; button.textContent = 'Export Data';
            }
        }
    });

    // Admin Page - Report List Actions (Status Update Modified)
    document.getElementById('admin-reports-container')?.addEventListener('click', async (e) => {
        const target = e.target;
        const reportLi = target.closest('li[data-report-id]');
        if (!reportLi) return; // Clicked outside a report item
        const reportId = reportLi.getAttribute('data-report-id');
        if (!reportId) return; // Report ID missing

        // --- Handle Status Update ---
        if (target.classList.contains('update-status-btn')) {
            const select = reportLi.querySelector('.status-update');
            const newStatus = select?.value;
            if (!newStatus) return; // No status selected

            const updateButton = target;
            if (updateButton.disabled) return; // Prevent double clicks

            updateButton.disabled = true; updateButton.textContent = 'Updating...';
            const originalStatusSpan = reportLi.querySelector('.report-status');
            const originalStatusText = originalStatusSpan?.textContent; // Store original for potential revert

            try {
                const reportRef = doc(db, "reports", reportId);
                let reporterUserId = null; // Variable to store reporter ID

                // ---> Get reporter's ID BEFORE updating <---
                const reportSnap = await getDoc(reportRef);
                if (reportSnap.exists()) {
                    reporterUserId = reportSnap.data().userId; // Get the userId who submitted the report
                    const currentStatusInDB = reportSnap.data().status;

                     // Only proceed if status is actually changing
                     if (currentStatusInDB === newStatus) {
                          showPopup("Status is already set to " + newStatus + ".", "info");
                          updateButton.disabled = false; updateButton.textContent = 'Update';
                          return; // Exit early
                     }

                } else {
                     // Report might have been deleted concurrently
                     console.warn(`Report ${reportId} not found before update.`);
                     throw new Error("Report not found.");
                }

                // Update the status in Firestore
                await updateDoc(reportRef, { status: newStatus });
                showPopup("Status updated successfully.", "success");
                if (originalStatusSpan) originalStatusSpan.textContent = newStatus; // Update UI immediately

                // ---> Award points if marked Resolved AND reporter ID found <---
                if (newStatus === 'Resolved' && reporterUserId) {
                     console.log(`Report ${reportId} marked Resolved. Awarding resolution points to user ${reporterUserId}.`);
                     // Award points and check for 'Problem Solver' badge etc.
                     await awardPointsAndCheckBadges(reporterUserId, POINT_VALUES.REPORT_RESOLVED, 'reportResolved');
                     // Note: The user receiving points won't see the popup unless they are logged in
                     // and their profile data gets refreshed (e.g., navigating to profile page).
                }

                // Refresh analytics to reflect the status change
                await renderAdminAnalytics();

            } catch (error) {
                console.error('Error updating status:', error);
                showPopup(`Failed to update status: ${error.message}`, 'error');
                // Revert UI status text on error
                if (originalStatusSpan && originalStatusText) originalStatusSpan.textContent = originalStatusText;
            } finally {
                 // Re-enable button
                 updateButton.disabled = false; updateButton.textContent = 'Update';
            }
        }

        // --- Handle Report Deletion ---
        if (target.classList.contains('delete-report-btn')) {
             // Confirmation dialog
             if (confirm(`Are you sure you want to DELETE report ${reportId}? This action cannot be undone.`)) {
                 const deleteButton = target;
                 if (deleteButton.disabled) return; // Prevent double clicks

                 deleteButton.disabled = true; deleteButton.textContent = 'Deleting...';
                try {
                    await deleteDoc(doc(db, "reports", reportId));
                    showPopup('Report deleted successfully.', 'success');
                    reportLi.remove(); // Remove the item from the list immediately

                    // Re-render map (to remove marker) and analytics (to update counts)
                    // Fetching all reports again to redraw map might be needed if filtering complexly
                    const remainingReports = await fetchReports(); // Fetch again to update map/analytics accurately
                    const filteredRemaining = applyFilters(remainingReports);
                    renderAdminMap(filteredRemaining); // Redraw map with remaining markers
                    await renderAdminAnalytics(); // Refresh counts/charts

                 } catch (error) {
                     console.error('Error deleting report:', error);
                     showPopup(`Failed to delete report: ${error.message}`, 'error');
                     // Re-enable button on failure
                     deleteButton.disabled = false; deleteButton.textContent = 'Delete Report';
                 }
             }
        }
    });


    // --- Community Forum Actions (Modified for Gamification) ---
    const forumContainer = document.getElementById('community-forum-page');
    if (forumContainer) {
        // --- New Post Form Submission ---
        document.getElementById('forum-post-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser || !currentUserData) { // Check for user data (for name)
                 showPopup("Please log in to create a post.", "error");
                 showPage('login'); return;
            }

            const titleInput = document.getElementById('post-title'); const contentInput = document.getElementById('post-content'); const categorySelect = document.getElementById('post-category'); const submitButton = document.getElementById('submit-button'); // Use specific ID
            const title = titleInput?.value.trim(); const content = contentInput?.value.trim(); const category = categorySelect?.value;

            if (!title || !content || !category) {
                 showPopup("Please fill in the title, content, and select a category.", "warning"); return;
            }

            submitButton.disabled = true; submitButton.textContent = 'Posting...';
            try {
                // Use displayName from Firestore data
                const authorName = currentUserData.displayName || 'Anonymous';

                await addDoc(collection(db, "forumPosts"), {
                    title, content, category,
                    author: authorName, // Use fetched name
                    authorId: currentUser.uid,
                    timestamp: new Date(), // Use client time for simplicity, server timestamp preferred in production
                    upvotes: 0, downvotes: 0,
                    commentCount: 0, // Initialize comment count
                    pinned: false
                });
                // ---> Award points for posting <---
                const pointsAwarded = await awardPointsAndCheckBadges(currentUser.uid, POINT_VALUES.CREATE_FORUM_POST, 'createForumPost');

                document.getElementById('forum-post-form').reset(); // Clear the form
                showPopup("Post submitted successfully!", "success", pointsAwarded);
                await renderForumPosts(); // Refresh posts list immediately

            } catch (error) {
                console.error('Error adding forum post:', error); showPopup(`Error submitting post: ${error.message}`, 'error');
            } finally {
                submitButton.disabled = false; submitButton.textContent = 'Post';
            }
        });

        // --- Event Delegation for Actions within Forum Posts ---
        const forumPostsContainer = document.getElementById('forum-posts');
        forumPostsContainer?.addEventListener('click', async (e) => {
            const target = e.target;
            const postElement = target.closest('.forum-post'); if (!postElement) return;
            const postId = postElement.getAttribute('data-post-id'); if (!postId) return;

            // --- Handle Comment Toggling ---
            if (target.classList.contains('toggle-comments-btn')) { /* ... Keep existing implementation ... */
                 const commentsSection = postElement.querySelector('.comments-section');
                 if (commentsSection) {
                     const isHidden = commentsSection.style.display === 'none';
                     commentsSection.style.display = isHidden ? 'block' : 'none';
                     if (isHidden) {
                         // Load comments when revealed and focus textarea
                         await renderComments(postId);
                         const textarea = commentsSection.querySelector('.comment-form textarea');
                         if (textarea) textarea.focus();
                     }
                 }
            }

            // --- Handle Voting (Modified for points & basic double-vote prevention idea) ---
            if (target.classList.contains('vote-btn')) {
                if (!currentUser) { showPopup("Please log in to vote.", "error"); return; }
                if (target.disabled) return; // Prevent rapid clicks

                target.disabled = true; // Disable button immediately

                const isUpvote = target.classList.contains('upvote-post') || target.classList.contains('upvote-comment');
                const isPostVote = target.classList.contains('upvote-post') || target.classList.contains('downvote-post');
                const isCommentVote = target.classList.contains('upvote-comment') || target.classList.contains('downvote-comment');
                const voteField = isUpvote ? 'upvotes' : 'downvotes';
                let docRef; let commentId = null;

                // Determine document reference (post or comment)
                if (isPostVote) { docRef = doc(db, "forumPosts", postId); }
                else if (isCommentVote) { commentId = target.getAttribute('data-comment-id'); if (!commentId) { target.disabled = false; return; } docRef = doc(db, "forumPosts", postId, "comments", commentId); }
                else { target.disabled = false; return; } // Should not happen

                 // Basic check: Don't allow voting on own post/comment (optional)
                 // const authorLink = isPostVote ? postElement.querySelector('.post-author .user-link') : target.closest('.comment-item')?.querySelector('.comment-author'); // Need to get author ID reliably
                 // if (authorLink && authorLink.getAttribute('data-user') === currentUser.uid) {
                 //    showPopup("You cannot vote on your own content.", "info");
                 //    target.disabled = false;
                 //    return;
                 // }


                try {
                    // Increment the vote count in Firestore
                    await updateDoc(docRef, { [voteField]: increment(1) });

                    // ---> Award points for GIVING an upvote <---
                    if (isUpvote) {
                        // Consider adding more complex logic later to prevent point farming
                        await awardPointsAndCheckBadges(currentUser.uid, POINT_VALUES.GIVE_UPVOTE, 'giveUpvote');
                        // No popup for this small action to avoid spam
                    }

                    // Update UI optimistically (read current count and increment)
                     const countMatch = target.textContent.match(/\d+$/);
                     const currentCount = countMatch ? parseInt(countMatch[0], 10) : 0;
                     const icon = target.textContent.split(' ')[0]; // Get the icon (👍 or 👎)
                     target.textContent = `${icon} ${currentCount + 1}`;

                    // Maybe re-enable slightly later to prevent accidental double-clicks visually
                    setTimeout(() => { target.disabled = false; }, 500); // 0.5 second delay

                } catch (error) {
                     console.error("Voting error:", error);
                     showPopup("Error recording vote.", "error");
                     target.disabled = false; // Re-enable immediately on error
                }
                // No finally block needed here as disabling/enabling is handled within try/catch
            }

            // --- Handle Post Pinning/Unpinning (Admin) ---
            if (target.classList.contains('pin-btn') && currentUser?.email === 'admin@sgresolve.com') { /* ... Keep existing implementation ... */
                const isPinned = target.getAttribute('data-pinned') === 'true';
                if (target.disabled) return;
                target.disabled = true; target.textContent = isPinned ? 'Unpinning...' : 'Pinning...';
                try {
                    await updateDoc(doc(db, "forumPosts", postId), { pinned: !isPinned });
                    showPopup(`Post successfully ${isPinned ? 'unpinned' : 'pinned'}.`, 'success');
                    // Re-render the entire list to ensure correct order
                    await renderForumPosts();
                } catch(error) {
                    console.error("Pinning error:", error);
                    showPopup("Error changing pin status.", "error");
                    // Reset button state on error
                    target.disabled = false;
                    target.textContent = isPinned ? 'Unpin' : 'Pin';
                    target.setAttribute('data-pinned', isPinned ? 'true' : 'false');
                }
            }

             // --- Handle Post Deletion (Admin or Author) ---
            if (target.classList.contains('delete-post-btn')) { /* ... Keep existing implementation ... */
                 // Get author ID from the post element reliably
                 const postAuthorId = postElement.querySelector('.post-author .user-link')?.getAttribute('data-user');
                 // Check if current user is the author OR admin
                 if (currentUser && (currentUser.email === 'admin@sgresolve.com' || currentUser.uid === postAuthorId)) {
                     if (confirm(`Are you sure you want to DELETE the post "${postElement.querySelector('h3')?.textContent}" and all its comments? This cannot be undone.`)) {
                         if (target.disabled) return;
                         target.disabled = true; target.textContent = 'Deleting...';
                         try {
                            // Delete all comments in the subcollection first (important!)
                             const commentsQuery = query(collection(db, "forumPosts", postId, "comments"));
                             const commentsSnapshot = await getDocs(commentsQuery);
                             const deletePromises = commentsSnapshot.docs.map(commentDoc => deleteDoc(commentDoc.ref));
                             await Promise.all(deletePromises); // Wait for all comments to be deleted

                             // Then delete the post document itself
                             await deleteDoc(doc(db, "forumPosts", postId));

                             showPopup('Post and comments deleted successfully.', 'success');
                             postElement.remove(); // Remove from UI
                             // Optionally re-render trending posts if the deleted one was trending
                             // await renderTrendingPosts(...)

                         } catch (error) {
                             console.error("Error deleting post:", error);
                             showPopup(`Failed to delete post: ${error.message}`, 'error');
                             target.disabled = false; target.textContent = '🗑️ Delete'; // Reset button on error
                         }
                     }
                 } else if (!currentUser) {
                      showPopup("Please log in to delete posts.", "error");
                 } else {
                      showPopup("You do not have permission to delete this post.", "error");
                 }
             }

             // --- Handle Comment Deletion (Author or Admin) ---
             if (target.classList.contains('delete-comment-btn')) {
                const commentLi = target.closest('.comment-item');
                const commentId = target.getAttribute('data-comment-id');
                // Need to fetch comment author ID - this is less efficient
                // Ideally, store authorId directly on the comment list item or fetch it
                let commentAuthorId = null;
                try { // Fetch comment data to check author - less ideal but necessary without storing ID in DOM better
                     const commentRef = doc(db, "forumPosts", postId, "comments", commentId);
                     const commentSnap = await getDoc(commentRef);
                     if (commentSnap.exists()) {
                         commentAuthorId = commentSnap.data().authorId;
                     }
                } catch (fetchError) {
                     console.error("Could not fetch comment details for deletion check:", fetchError);
                     showPopup("Error checking comment ownership.", "error");
                     return; // Stop deletion if we can't verify ownership
                }

                 if (currentUser && commentId && (currentUser.email === 'admin@sgresolve.com' || currentUser.uid === commentAuthorId)) {
                      if (confirm("Are you sure you want to delete this comment?")) {
                          if (target.disabled) return;
                          target.disabled = true; target.textContent = 'Deleting...';
                          try {
                              const commentRefToDelete = doc(db, "forumPosts", postId, "comments", commentId);
                              await deleteDoc(commentRefToDelete);
                              showPopup("Comment deleted.", "success");
                              if(commentLi) commentLi.remove(); // Remove from UI

                              // Decrement comment count on the parent post (use transaction for safety if needed)
                              await updateDoc(doc(db, "forumPosts", postId), { commentCount: increment(-1) });

                              // Update the comment count display on the post button
                              const commentBtn = postElement.querySelector('.toggle-comments-btn');
                              if (commentBtn) {
                                  const countMatch = commentBtn.textContent.match(/\((\d+)\)/);
                                  const currentCount = countMatch ? parseInt(countMatch[1], 10) : 1; // Assume at least 1 if button exists
                                  commentBtn.textContent = `💬 Comments (${Math.max(0, currentCount - 1)})`;
                              }
                          } catch (error) {
                              console.error("Error deleting comment:", error);
                              showPopup(`Failed to delete comment: ${error.message}`, 'error');
                              target.disabled = false; target.textContent = 'Delete'; // Reset button
                          }
                      }
                 } else if (!currentUser) {
                      showPopup("Please log in to delete comments.", "error");
                 } else {
                      showPopup("You do not have permission to delete this comment.", "error");
                 }
            }
        });

        // --- Handle Comment Form Submission (Modified for Gamification) ---
        forumPostsContainer?.addEventListener('submit', async (e) => {
            if (e.target.classList.contains('comment-form')) {
                e.preventDefault();
                if (!currentUser || !currentUserData) { // Check user data for name
                    showPopup("Please log in to comment.", "error");
                    showPage('login'); return;
                 }

                const postElement = e.target.closest('.forum-post'); const postId = postElement?.getAttribute('data-post-id'); const textarea = e.target.querySelector('textarea'); const submitButton = e.target.querySelector('button[type="submit"]'); const content = textarea?.value.trim();

                if (!postId || !textarea || !content || !submitButton) {
                     console.error("Comment form elements missing."); return;
                }

                submitButton.disabled = true; submitButton.textContent = 'Posting...';
                try {
                    // Use displayName from Firestore data
                    const authorName = currentUserData.displayName || 'Anonymous';

                    await addDoc(collection(db, "forumPosts", postId, "comments"), {
                        content,
                        author: authorName, // Use fetched name
                        authorId: currentUser.uid,
                        timestamp: new Date(), // Client time
                        upvotes: 0, downvotes: 0
                    });
                    textarea.value = ''; // Clear textarea

                    // ---> Award points for commenting <---
                    await awardPointsAndCheckBadges(currentUser.uid, POINT_VALUES.CREATE_FORUM_COMMENT, 'createForumComment');
                    // No success popup for comments to reduce noise

                    // Increment comment count on the parent post document
                    await updateDoc(doc(db, "forumPosts", postId), { commentCount: increment(1) });

                    // Update the comment count display on the post button
                    const commentBtn = postElement.querySelector('.toggle-comments-btn');
                     if (commentBtn) {
                         const countMatch = commentBtn.textContent.match(/\((\d+)\)/);
                         const currentCount = countMatch ? parseInt(countMatch[1], 10) : 0;
                         commentBtn.textContent = `💬 Comments (${currentCount + 1})`;
                     }

                    await renderComments(postId); // Refresh comments list for this post

                } catch (error) {
                    console.error('Error adding comment:', error); showPopup(`Failed to post comment: ${error.message}`, 'error');
                } finally {
                     submitButton.disabled = false; submitButton.textContent = 'Comment';
                }
            }
        });

        // --- Forum Search Input ---
        const searchInput = forumContainer.querySelector('.search-input');
        let searchTimeout;
        searchInput?.addEventListener('input', () => { /* ... Keep existing implementation ... */
            clearTimeout(searchTimeout); // Debounce search requests
            const searchTerm = searchInput.value.trim().toLowerCase();
            const forumPostsContainer = document.getElementById('forum-posts');
            const loadMoreButton = document.getElementById('load-more-posts');
            if (!forumPostsContainer) return;

            // Hide load more button during search
            if (loadMoreButton) loadMoreButton.style.display = 'none';
             const existingNoMoreMsg = forumPostsContainer.querySelector('.no-more-posts-message');
             if (existingNoMoreMsg) existingNoMoreMsg.remove();


            if (!searchTerm) {
                // If search is cleared, reload the initial posts
                renderForumPosts();
                return;
            }

            // Wait a bit before executing search
            searchTimeout = setTimeout(async () => {
                forumPostsContainer.innerHTML = '<p class="loading-message">Searching...</p>';
                try {
                    // Basic client-side search (inefficient for large datasets)
                    // Fetch ALL posts (or a large batch) and filter locally
                    // NOTE: For production, implement server-side search (e.g., Algolia, Firebase Search Extension)
                    const postsQuery = query(collection(db, "forumPosts"), orderBy("timestamp", "desc")); // Fetch all, sort by date
                    const querySnapshot = await getDocs(postsQuery);
                    const matchingPosts = [];
                    querySnapshot.forEach((doc) => {
                        const post = { id: doc.id, ...doc.data() };
                        // Check title, content, and author for the search term
                        if (
                            (post.title && post.title.toLowerCase().includes(searchTerm)) ||
                            (post.content && post.content.toLowerCase().includes(searchTerm)) ||
                            (post.author && post.author.toLowerCase().includes(searchTerm))
                        ) {
                            matchingPosts.push(post);
                        }
                    });

                    forumPostsContainer.innerHTML = ''; // Clear loading message
                    if (matchingPosts.length === 0) {
                        forumPostsContainer.innerHTML = '<p class="no-data-message">No posts found matching your search.</p>';
                    } else {
                        // Get comment counts for matching posts
                        const postPromises = matchingPosts.map(async (post) => {
                            try {
                                const commentsSnap = await getDocs(collection(db, "forumPosts", post.id, "comments"));
                                post.commentCount = commentsSnap.size;
                            } catch { post.commentCount = 0; }
                            return post;
                        });
                        const postsWithCounts = await Promise.all(postPromises);
                        // Display matching posts
                        postsWithCounts.forEach(post => {
                            forumPostsContainer.appendChild(createPostElement(post));
                        });
                    }
                } catch (error) {
                    console.error('Error searching posts:', error);
                    forumPostsContainer.innerHTML = '<p class="error-message">Error performing search.</p>';
                    showPopup("Search failed.", "error");
                }
            }, 500); // Delay search execution (e.g., 500ms)
        });

        // Load More Posts Button Listener
        document.getElementById('load-more-posts')?.addEventListener('click', () => {
            if (!isLoadingForumPosts) {
                renderForumPosts(true); // Pass true to indicate loading more
            }
        });

    } // --- End of forumContainer check ---


    // --- Nearby Reports Page ---
    document.getElementById('load-nearby-reports')?.addEventListener('click', displayNearbyReports);
    // Optional: Load nearby reports for 'current' location automatically when page loads if user is logged in
    // if (pages.nearbyReports && currentUser) {
    //     const locationSelector = document.getElementById('location-selector');
    //     if (locationSelector && locationSelector.value === 'current') {
    //         displayNearbyReports();
    //     }
    // }


    // --- Profile Page Event Listeners ---
    function attachProfileEventListeners() {
        // Update Profile Name Form
        document.getElementById('update-profile-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser || !currentUserData) return; // Should be logged in

            const nameInput = document.getElementById('profile-new-name');
            const updateButton = document.getElementById('update-profile-button');
            const messageArea = document.getElementById('update-profile-message');
            const newName = nameInput?.value.trim();

            if (!newName) {
                if(messageArea) messageArea.textContent = 'Display name cannot be empty.';
                if(messageArea) messageArea.className = 'form-message error';
                return;
            }

            // Optional: Check if name actually changed
            const currentName = currentUserData.displayName || currentUser.displayName || '';
            if (newName === currentName) {
                 if(messageArea) messageArea.textContent = 'Name is already set to this value.';
                 if(messageArea) messageArea.className = 'form-message info';
                return;
            }

            updateButton.disabled = true;
            updateButton.textContent = 'Updating...';
            if(messageArea) messageArea.textContent = '';
            if(messageArea) messageArea.className = 'form-message';

            try {
                // 1. Update Firebase Auth profile
                await updateProfile(auth.currentUser, { displayName: newName });
                console.log("Firebase Auth profile updated.");

                // 2. Update Firestore user document
                const userRef = doc(db, "users", currentUser.uid);
                await updateDoc(userRef, { displayName: newName });
                console.log("Firestore user document updated.");

                // 3. Refresh local data and UI
                await fetchAndSetCurrentUserData(currentUser.uid); // This will re-render parts of the UI via updateGamificationUI/renderProfilePage

                if(messageArea) messageArea.textContent = 'Display name updated successfully!';
                if(messageArea) messageArea.className = 'form-message success';
                showPopup('Display name updated!', 'success');

            } catch (error) {
                console.error("Error updating display name:", error);
                if(messageArea) messageArea.textContent = `Error updating name: ${error.message}`;
                if(messageArea) messageArea.className = 'form-message error';
                showPopup(`Error updating name: ${error.message}`, 'error');
            } finally {
                updateButton.disabled = false;
                updateButton.textContent = 'Update Name';
            }
        });

        // Change Password Form
        document.getElementById('change-password-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return; // Must be logged in

            const currentPasswordInput = document.getElementById('current-password');
            const newPasswordInput = document.getElementById('new-password');
            const confirmPasswordInput = document.getElementById('confirm-new-password');
            const changeButton = document.getElementById('change-password-button');
            const messageArea = document.getElementById('change-password-message');

            const currentPassword = currentPasswordInput?.value;
            const newPassword = newPasswordInput?.value;
            const confirmPassword = confirmPasswordInput?.value;

            if (!currentPassword || !newPassword || !confirmPassword) {
                if(messageArea) messageArea.textContent = 'Please fill in all password fields.';
                if(messageArea) messageArea.className = 'form-message error';
                return;
            }

            if (newPassword !== confirmPassword) {
                if(messageArea) messageArea.textContent = 'New passwords do not match.';
                if(messageArea) messageArea.className = 'form-message error';
                return;
            }

            if (newPassword.length < 6) {
                 if(messageArea) messageArea.textContent = 'New password must be at least 6 characters long.';
                 if(messageArea) messageArea.className = 'form-message error';
                 return;
            }

            changeButton.disabled = true;
            changeButton.textContent = 'Changing...';
            if(messageArea) messageArea.textContent = 'Re-authenticating...';
            if(messageArea) messageArea.className = 'form-message info';

            try {
                // 1. Re-authenticate the user (REQUIRED for password change)
                const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
                await reauthenticateWithCredential(currentUser, credential);
                console.log("User re-authenticated successfully.");
                if(messageArea) messageArea.textContent = 'Updating password...'; // Update message

                // 2. Update the password
                await updatePassword(currentUser, newPassword);
                console.log("Password updated successfully.");

                if(messageArea) messageArea.textContent = 'Password changed successfully!';
                if(messageArea) messageArea.className = 'form-message success';
                showPopup('Password changed successfully!', 'success');

                // Clear the form fields after success
                currentPasswordInput.value = '';
                newPasswordInput.value = '';
                confirmPasswordInput.value = '';

            } catch (error) {
                console.error("Error changing password:", error);
                let friendlyMessage = `Error: ${error.message}`;
                if (error.code === 'auth/wrong-password') {
                    friendlyMessage = 'Incorrect current password.';
                } else if (error.code === 'auth/weak-password') {
                    friendlyMessage = 'New password is too weak.';
                } else if (error.code === 'auth/requires-recent-login') {
                     friendlyMessage = 'This action requires a recent login. Please log out and log back in.';
                     // Consider forcing logout here or guiding user
                }
                if(messageArea) messageArea.textContent = friendlyMessage;
                if(messageArea) messageArea.className = 'form-message error';
                showPopup(`Password change failed: ${friendlyMessage}`, 'error');
            } finally {
                changeButton.disabled = false;
                changeButton.textContent = 'Change Password';
            }
        });
    }
    // Attach listeners initially if profile page elements exist
    attachProfileEventListeners();


    // --- Chatbot ---
    document.getElementById('chat-icon')?.addEventListener('click', toggleChat);
    document.querySelector('.send-button')?.addEventListener('click', sendChatMessage);
    document.getElementById('user-input')?.addEventListener('keypress', (e) => {
         // Send message on Enter key, unless Shift+Enter is pressed (for newline)
         if (e.key === 'Enter' && !e.shiftKey) {
             e.preventDefault(); // Prevent default Enter behavior (e.g., newline in textarea)
             sendChatMessage();
         }
    });


    // --- Initial Setup ---
    // Auth listener (onAuthStateChanged) handles the initial page determination (landing/reporting/admin)
    // and fetching initial user data.
    console.log("SGResolve App Initialized with CAPTCHA (Frontend).");
    // If no user is logged in after init, explicitly show landing page
     if (!auth.currentUser && !document.querySelector('.page.show')) {
         showPage('landing');
     }


}); // --- End DOMContentLoaded ---
