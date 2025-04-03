import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
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
    startAfter, // Import startAfter for pagination
    increment
} from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";
// Import Storage only if using Firebase Storage for image uploads
import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.5.0/firebase-storage.js";

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAgBUaMIawsOqMbLpju2mrd6kMaranT2rI", // Replace with your actual API key if different
  authDomain: "sgresolve-login-register.firebaseapp.com",
  projectId: "sgresolve-login-register",
  messagingSenderId: "564104431729",
  appId: "1:564104431729:web:57557b54673a8c18d973d0",
  measurementId: "G-R3QDN8V84C"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Initialize storage

// --- AI Image Analyzer API Endpoint ---
const IMAGE_ANALYZER_API_URL = "https://ai-photo-analyser-production.up.railway.app/analyze-image";


document.addEventListener('DOMContentLoaded', () => {
    // Singapore's Geographical Boundaries
    const SINGAPORE_BOUNDS = {
        latMin: 1.15,
        latMax: 1.47,
        lonMin: 103.6,
        lonMax: 104.0
    };
    const singaporeLatLngBounds = L.latLngBounds(
        [SINGAPORE_BOUNDS.latMin, SINGAPORE_BOUNDS.lonMin],
        [SINGAPORE_BOUNDS.latMax, SINGAPORE_BOUNDS.lonMax]
    );

    // Initialize Maps
    let reportingMap = null;
    let adminMap = null;
    let nearbyMap = null; // To hold the Leaflet map instance for this page

    function initializeReportingMap() {
        if (!reportingMap && document.getElementById('map')) {
            reportingMap = L.map('map').setView([1.3521, 103.8198], 11);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(reportingMap);

             // Reporting Page Map Interaction (moved inside initializer)
            reportingMap.on('click', function(e) {
                const { lat, lng } = e.latlng;
                if (!singaporeLatLngBounds.contains(e.latlng)) {
                    showPopup('Please select a location within Singapore.', 'error');
                    return;
                }
                if (tempMarker) reportingMap.removeLayer(tempMarker);
                tempMarker = L.marker([lat, lng]).addTo(reportingMap);
                document.getElementById('latitude').value = lat.toFixed(6); // More precision
                document.getElementById('longitude').value = lng.toFixed(6);
            });
        }
    }

    function initializeAdminMap() {
        if (!adminMap && document.getElementById('admin-map')) {
            adminMap = L.map('admin-map').setView([1.3521, 103.8198], 11);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(adminMap);
        }
    }

    function initializeNearbyMap() {
      if (!nearbyMap && document.getElementById('nearby-map')) { // Initialize only once and if element exists
          nearbyMap = L.map('nearby-map').setView([1.3521, 103.8198], 11);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors'
          }).addTo(nearbyMap);
      }
    }

    // Call map initializers when DOM is ready (but maps might not be visible yet)
    // Maps will be properly sized/invalidated when their page is shown
    initializeReportingMap();
    initializeAdminMap();
    initializeNearbyMap();


    // Global Variables
    let tempMarker;
    let adminReportMarkers = []; // Renamed for clarity
    let imageDataUrl = null; // For previewing AND sending to AI analyzer
    let currentUser = null;
    // Forum related globals
    // let forumPosts = []; // Might not be needed if always fetching
    let lastVisiblePost = null; // For pagination
    let isLoadingForumPosts = false; // Prevent multiple loads
    // Nearby reports related globals
    let nearbyMarkers = []; // To hold markers for the nearby map
    // Chart instances for Analytics
    let statusChartInstance = null;
    let urgencyChartInstance = null;
    let categoryChartInstance = null; // To manage the existing chart instance

    // Predefined Locations for Nearby Reports Dropdown
    const PREDEFINED_LOCATIONS = {
      // North-East
      punggol: { lat: 1.4051, lon: 103.9025, name: "Punggol" },
      sengkang: { lat: 1.3917, lon: 103.8954, name: "Sengkang" },
      hougang: { lat: 1.3716, lon: 103.8931, name: "Hougang" },
      serangoon: { lat: 1.3497, lon: 103.8731, name: "Serangoon" },
      // East
      tampines: { lat: 1.3544, lon: 103.9439, name: "Tampines" },
      pasir_ris: { lat: 1.3731, lon: 103.9493, name: "Pasir Ris" },
      bedok: { lat: 1.3240, lon: 103.9298, name: "Bedok" },
      changi_airport: { lat: 1.3592, lon: 103.9896, name: "Changi Airport" },
      // North
      woodlands: { lat: 1.4360, lon: 103.7860, name: "Woodlands" },
      yishun: { lat: 1.4295, lon: 103.8350, name: "Yishun" },
      sembawang: { lat: 1.4491, lon: 103.8200, name: "Sembawang" },
      // Central
      ang_mo_kio: { lat: 1.3699, lon: 103.8496, name: "Ang Mo Kio" },
      bishan: { lat: 1.3508, lon: 103.8484, name: "Bishan" },
      toa_payoh: { lat: 1.3324, lon: 103.8497, name: "Toa Payoh" },
      orchard: { lat: 1.3048, lon: 103.8318, name: "Orchard Road" },
      city_hall: { lat: 1.2931, lon: 103.8525, name: "City Hall" },
      raffles_place: { lat: 1.2839, lon: 103.8515, name: "Raffles Place" },
      // West
      jurong_east: { lat: 1.3331, lon: 103.7422, name: "Jurong East" },
      clementi: { lat: 1.3150, lon: 103.7651, name: "Clementi" },
      bukit_batok: { lat: 1.3490, lon: 103.7496, name: "Bukit Batok" },
      choa_chu_kang: { lat: 1.3854, lon: 103.7446, name: "Choa Chu Kang" },
      boon_lay: { lat: 1.3386, lon: 103.7060, name: "Boon Lay" },
      // South
      harbourfront: { lat: 1.2659, lon: 103.8214, name: "HarbourFront" },
      marina_bay: { lat: 1.2808, lon: 103.8596, name: "Marina Bay Sands" },
    };

    // Chart Color Palettes
    const STATUS_COLORS = {
        'Pending': 'rgba(255, 193, 7, 0.7)', // Yellow
        'In Progress': 'rgba(54, 162, 235, 0.7)', // Blue
        'Resolved': 'rgba(40, 167, 69, 0.7)'   // Green
    };
    const URGENCY_COLORS = {
        'Low': 'rgba(75, 192, 192, 0.7)',    // Teal
        'Medium': 'rgba(255, 159, 64, 0.7)', // Orange
        'High': 'rgba(255, 99, 132, 0.7)'    // Red
    };
    const CATEGORY_COLORS_MONTHLY = {
        'Infrastructure': 'rgba(153, 102, 255, 0.7)', // Purple
        'Environmental': 'rgba(40, 167, 69, 0.7)',    // Green
        'Safety': 'rgba(255, 99, 132, 0.7)',       // Red
        'Others': 'rgba(201, 203, 207, 0.7)'       // Grey
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
    };
    const navbar = document.getElementById('navbar');

    // --- Helper Functions ---
    function hideAllPages() {
        Object.values(pages).forEach(page => {
            if (page) { // Check if element exists
                page.style.display = 'none';
                page.classList.remove('show');
            }
        });
    }

    function showPage(page) {
        if (!page) {
            console.error("Attempted to show a null page.");
            return;
        }
        hideAllPages();
        page.classList.add('show');
        page.style.display = 'block';

        // Ensure map is initialized and invalidate size when specific pages are shown
        if (page === pages.reporting) {
            initializeReportingMap(); // Ensure map exists
            if (reportingMap) reportingMap.invalidateSize();
        } else if (page === pages.admin) {
            initializeAdminMap(); // Ensure map exists
             if (adminMap) adminMap.invalidateSize();
            renderAdminReports(); // Renders the list and map
            renderAdminAnalytics(); // Renders the charts and stats
        } else if (page === pages.nearbyReports) {
            initializeNearbyMap(); // Ensure map exists
            if (nearbyMap) nearbyMap.invalidateSize(); // Adjust map size
            // Optionally auto-load reports or wait for button click
            // displayNearbyReports(); // Example: Load reports immediately
        }
         // Trigger About page animations if showing that page
         if (page === pages.about) {
            initializeAboutPageObserver();
        }
    }

    function updateNavbar() {
        navbar.style.display = currentUser ? 'block' : 'none';
    }

    // Popup Function
    function showPopup(message, type = 'info', autoClose = true) {
      const popupOverlay = document.getElementById('popup-overlay');
      const popupMessage = document.getElementById('popup-message');
      const popupIcon = document.getElementById('popup-icon');
      const popup = document.getElementById('popup');
      const closeButton = document.getElementById('popup-close'); // Get close button

      if (!popupOverlay || !popupMessage || !popupIcon || !popup || !closeButton) return; // Safety check

      popupMessage.textContent = message;
      popup.className = `popup ${type}`; // Apply type class

      // Set icon based on type
      switch (type) {
        case 'success': popupIcon.innerHTML = '✅'; break;
        case 'error': popupIcon.innerHTML = '❌'; break;
        case 'info': popupIcon.innerHTML = 'ℹ️'; break;
        default: popupIcon.innerHTML = '';
      }

      popupOverlay.style.display = 'flex'; // Show the overlay
      popup.setAttribute('role', 'alert');
      popup.setAttribute('aria-live', 'assertive'); // Important for screen readers
      popup.setAttribute('tabindex', '-1'); // Make it focusable
      popup.focus(); // Focus the popup for accessibility

      let popupTimeout; // To store the timeout ID

      // Clear any existing auto-close timeout
      if (popup.dataset.timeoutId) {
          clearTimeout(parseInt(popup.dataset.timeoutId, 10));
      }

      if (autoClose) {
        popupTimeout = setTimeout(() => {
          popupOverlay.style.display = 'none';
        }, 3000);
        popup.dataset.timeoutId = popupTimeout.toString(); // Store the timeout ID
        closeButton.style.display = 'none'; // Hide close button if auto-closing
      } else {
        // If not auto-closing, make sure the close button is visible
        closeButton.style.display = 'block';
        // Remove any stored timeout ID
        delete popup.dataset.timeoutId;
      }
    }


    function createStatusDropdown(currentStatus) {
        // No reportId needed here, handled by event delegation ancestor
        return `
            <select class="status-update">
                <option value="Pending" ${currentStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="In Progress" ${currentStatus === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Resolved" ${currentStatus === 'Resolved' ? 'selected' : ''}>Resolved</option>
            </select>
            <button class="update-status-btn button primary-button">Update</button>
        `;
    }

    // Fetches reports from Firestore
    async function fetchReports(userId = null) {
        try {
            let reportsQuery;
            const reportsCollection = collection(db, "reports");

            if (userId) {
                // Fetch reports for a specific user, ordered by timestamp
                reportsQuery = query(reportsCollection, where("userId", "==", userId), orderBy("timestamp", "desc"));
            } else {
                 // Fetch all reports, ordered by timestamp descending
                 reportsQuery = query(reportsCollection, orderBy("timestamp", "desc"));
            }

            const querySnapshot = await getDocs(reportsQuery);
            const reports = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Basic validation and type conversion
                const latitude = parseFloat(data.latitude);
                const longitude = parseFloat(data.longitude);
                if (!isNaN(latitude) && !isNaN(longitude)) { // Only include reports with valid coordinates
                    reports.push({
                        id: doc.id,
                        ...data,
                        latitude: latitude,
                        longitude: longitude,
                        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date() // Convert timestamp
                    });
                } else {
                    console.warn(`Report ${doc.id} skipped due to invalid coordinates.`);
                }
            });
            return reports;
        } catch (error) {
            console.error('Error fetching reports:', error);
            showPopup(`Error fetching reports: ${error.message}`, 'error');
            return []; // Return empty array on error
        }
    }


    // Fetches reports specifically for the current month
    async function fetchReportsThisMonth() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        // End of month calculation needs care for timezone/daylight saving if critical
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
            querySnapshot.forEach((doc) => {
                reports.push({ id: doc.id, ...doc.data() });
            });
            return reports;
        } catch (error) {
            console.error("Error fetching reports for this month:", error);
            return []; // Return empty array on error
        }
    }

     // Applies filters based on dropdown selections
     function applyFilters(allReports) {
        const imageFilter = document.getElementById('image-filter')?.value || 'all';
        const categoryFilter = document.getElementById('category-filter')?.value || 'all';
        const urgencyFilter = document.getElementById('urgency-filter')?.value || 'all';
        const threatFilter = document.getElementById('threat-filter')?.value || 'all';

        let filteredReports = allReports.slice(); // Start with a copy of all reports

        // Apply filters sequentially
        if (imageFilter !== 'all') {
            filteredReports = filteredReports.filter(report =>
                imageFilter === 'with' ? !!report.imageUrl : !report.imageUrl
            );
        }
        if (categoryFilter !== 'all') {
            filteredReports = filteredReports.filter(report => report.category === categoryFilter);
        }
        if (urgencyFilter !== 'all') {
            filteredReports = filteredReports.filter(report => report.urgency === urgencyFilter);
        }
        if (threatFilter !== 'all') {
            filteredReports = filteredReports.filter(report => report.threat === threatFilter);
        }

        return filteredReports;
    }


    // --- Rendering Functions ---

    // Renders the Admin Map with markers
    function renderAdminMap(reportsToDisplay) {
        if (!adminMap) return; // Don't render if map not initialized

        // Clear existing markers
        adminReportMarkers.forEach(marker => adminMap.removeLayer(marker));
        adminReportMarkers = [];

        if (!reportsToDisplay || reportsToDisplay.length === 0) {
            adminMap.setView([1.3521, 103.8198], 11); // Reset view if no reports
            return;
        }

        // Add new markers for valid reports
        reportsToDisplay.forEach(report => {
             // Double check for valid coords here as well
             if (typeof report.latitude === 'number' && typeof report.longitude === 'number' && !isNaN(report.latitude) && !isNaN(report.longitude)) {
                const marker = L.marker([report.latitude, report.longitude]).addTo(adminMap);
                let popupContent = `
                    <strong>${report.locationName || 'N/A'}</strong><br>
                    Category: ${report.category || 'N/A'}<br>
                    Status: ${report.status || 'N/A'}<br>
                    Urgency: <span class="urgency-${(report.urgency || '').toLowerCase()}">${report.urgency || 'N/A'}</span><br>
                    Threat: <span class="threat-${(report.threat || '').toLowerCase()}">${report.threat || 'N/A'}</span>
                `;
                if (report.imageUrl) {
                    // Added link for easier viewing and better styling
                    popupContent += `<br><a href="${report.imageUrl}" target="_blank" rel="noopener noreferrer" title="View full image">
                                         <img src="${report.imageUrl}" alt="Report Image" class="popup-report-image">
                                     </a>`;
                }
                marker.bindPopup(popupContent);
                adminReportMarkers.push(marker);
             } else {
                 console.warn(`Skipping marker for report ${report.id} due to invalid coordinates.`);
             }
        });

         // Fit map bounds if there are markers
        if (adminReportMarkers.length > 0) {
             const group = new L.featureGroup(adminReportMarkers);
             try {
                 adminMap.fitBounds(group.getBounds().pad(0.1));
             } catch (e) {
                 console.error("Error fitting map bounds:", e);
                 adminMap.setView([1.3521, 103.8198], 11); // Fallback reset
             }
        } else {
            adminMap.setView([1.3521, 103.8198], 11); // Reset view if no valid markers added
        }
    }

    // Renders the list of reports in the Admin Dashboard
    async function renderAdminReports() {
        const adminReportsContainer = document.getElementById('admin-reports-container');
        if (!adminReportsContainer) return;
        adminReportsContainer.innerHTML = '<p class="loading-message">Loading reports...</p>'; // Use a class for styling

        try {
            const allReports = await fetchReports(); // Get all reports (already filters invalid coords)
            const filteredReports = applyFilters(allReports); // Apply current filters

            adminReportsContainer.innerHTML = ''; // Clear loading message

            if (filteredReports.length === 0) {
                adminReportsContainer.innerHTML = '<p class="no-data-message">No reports match the current filters.</p>';
                renderAdminMap([]); // Clear map
                return;
            }

            filteredReports.forEach(report => {
                const li = document.createElement('li');
                li.setAttribute('data-report-id', report.id);
                // Add classes based on urgency/threat for potential future styling
                li.classList.add(`urgency-${(report.urgency || 'N/A').toLowerCase()}`, `threat-${(report.threat || 'N/A').toLowerCase()}`);

                li.innerHTML = `
                    <div class="report-content">
                         <h3>${report.locationName || 'Unknown Location'}</h3>
                         <p><strong>Category:</strong> ${report.category || 'N/A'}</p>
                         <p><strong>Description:</strong> ${report.description || 'No description.'}</p>
                         <p><strong>Submitted:</strong> ${report.timestamp ? report.timestamp.toLocaleString() : 'N/A'}</p>
                         ${report.imageUrl ? `<a href="${report.imageUrl}" target="_blank" rel="noopener noreferrer"><img src="${report.imageUrl}" alt="Report Image" class="report-image"></a>` : '<p><em>No image submitted.</em></p>'}
                    </div>
                    <div class="report-meta">
                        <span class="category">${report.category || 'N/A'}</span>
                        <span class="urgency urgency-${(report.urgency || 'N/A').toLowerCase()}">${report.urgency || 'N/A'}</span>
                        <span class="threat threat-${(report.threat || 'N/A').toLowerCase()}">${report.threat || 'N/A'}</span>
                    </div>
                    <div class="report-actions">
                         <p><strong>Status:</strong> <span class="report-status">${report.status || 'N/A'}</span></p>
                         ${createStatusDropdown(report.status || 'Pending')}
                         <button class="button danger-button delete-report-btn" data-report-id="${report.id}">Delete</button>
                    </div>
                `;
                adminReportsContainer.appendChild(li);
            });

            renderAdminMap(filteredReports); // Update map with filtered reports

        } catch (error) {
            console.error('Error rendering admin reports:', error);
            adminReportsContainer.innerHTML = '<p class="error-message">Error loading reports. Please try again later.</p>';
            renderAdminMap([]); // Clear map on error
        }
    }


    // Renders the user's submitted reports
    async function renderUserReports() {
        if (!currentUser) return;
        const userReportsContainer = document.getElementById('user-reports-container');
        if (!userReportsContainer) return;
        userReportsContainer.innerHTML = '<p class="loading-message">Loading your reports...</p>';

        try {
            const userReports = await fetchReports(currentUser.uid); // Fetch only for current user
            userReportsContainer.innerHTML = ''; // Clear loading message
            if (userReports.length === 0) {
                userReportsContainer.innerHTML = '<p class="no-data-message">You haven\'t submitted any reports yet.</p>';
                return;
            }
            userReports.forEach(report => {
                const li = document.createElement('li');
                li.setAttribute('data-report-id', report.id);
                // Basic structure, can be enhanced like admin view if needed
                li.innerHTML = `
                    <h3>${report.locationName || 'Unknown Location'}</h3>
                    <p><strong>Category:</strong> ${report.category || 'N/A'}</p>
                    <p><strong>Description:</strong> ${report.description || 'N/A'}</p>
                    <p><strong>Urgency:</strong> ${report.urgency || 'N/A'}</p>
                    <p><strong>Threat:</strong> ${report.threat || 'N/A'}</p>
                    <p><strong>Status:</strong> ${report.status || 'N/A'}</p>
                    <p><strong>Submitted:</strong> ${report.timestamp ? report.timestamp.toLocaleString() : 'N/A'}</p>
                    ${report.imageUrl ? `<a href="${report.imageUrl}" target="_blank" rel="noopener noreferrer"><img src="${report.imageUrl}" alt="Report Image" class="user-report-image"></a>` : ''}
                `;
                userReportsContainer.appendChild(li);
            });
        } catch (error) {
             console.error('Error rendering user reports:', error);
            userReportsContainer.innerHTML = '<p class="error-message">Error loading your reports. Please try again later.</p>';
        }
    }

    // Renders the Admin Analytics section
    async function renderAdminAnalytics() {
        // Get references to DOM elements safely
        const totalReportsEl = document.getElementById('stat-total-reports');
        const pendingReportsEl = document.getElementById('stat-pending-reports');
        const resolvedReportsEl = document.getElementById('stat-resolved-reports');
        const totalMonthEl = document.getElementById('total-reports-month');
        const statusChartCanvas = document.getElementById('status-chart');
        const noStatusDataEl = document.getElementById('no-status-data');
        const urgencyChartCanvas = document.getElementById('urgency-chart');
        const noUrgencyDataEl = document.getElementById('no-urgency-data');
        const categoryChartCanvas = document.getElementById('reports-chart'); // Original ID
        const noReportsMsgEl = document.getElementById('no-reports-message');

        // Helper to destroy chart if exists
        const destroyChart = (instance) => { if (instance) instance.destroy(); };

        try {
            // Fetch ALL reports for overall stats
            const allReports = await fetchReports(); // Already filters invalid coords
            const totalReportsCount = allReports.length;

            // Fetch reports for THIS MONTH for the category chart
            const reportsThisMonth = await fetchReportsThisMonth();
            const totalReportsMonthCount = reportsThisMonth.length;

            // Process Data
            const statusCounts = { 'Pending': 0, 'In Progress': 0, 'Resolved': 0 };
            const urgencyCounts = { 'Low': 0, 'Medium': 0, 'High': 0 };
            const categoryCountsMonth = { 'Infrastructure': 0, 'Environmental': 0, 'Safety': 0, 'Others': 0 }; // Initialize all

            allReports.forEach(report => {
                if (report.status && statusCounts.hasOwnProperty(report.status)) statusCounts[report.status]++;
                if (report.urgency && urgencyCounts.hasOwnProperty(report.urgency)) urgencyCounts[report.urgency]++;
            });

            reportsThisMonth.forEach(report => {
                // Ensure category exists in our predefined list, otherwise count as 'Others'
                const category = report.category && categoryCountsMonth.hasOwnProperty(report.category) ? report.category : 'Others';
                categoryCountsMonth[category]++;
            });

            // Update Stat Cards safely
            if (totalReportsEl) totalReportsEl.textContent = totalReportsCount;
            if (pendingReportsEl) pendingReportsEl.textContent = statusCounts['Pending'];
            if (resolvedReportsEl) resolvedReportsEl.textContent = statusCounts['Resolved'];
            if (totalMonthEl) totalMonthEl.textContent = `Total this month: ${totalReportsMonthCount}`;


            // Status Chart (Doughnut)
            const statusCtx = statusChartCanvas?.getContext('2d');
            const statusDataAvailable = Object.values(statusCounts).some(count => count > 0);
            if (statusChartCanvas) statusChartCanvas.style.display = statusDataAvailable ? 'block' : 'none';
            if (noStatusDataEl) noStatusDataEl.style.display = statusDataAvailable ? 'none' : 'block';
            destroyChart(statusChartInstance);
            statusChartInstance = null; // Reset instance
            if (statusCtx && statusDataAvailable) {
                statusChartInstance = new Chart(statusCtx, {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(statusCounts),
                        datasets: [{
                            data: Object.values(statusCounts),
                            backgroundColor: Object.keys(statusCounts).map(status => STATUS_COLORS[status] || '#cccccc'), // Fallback color
                            borderColor: '#fff',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom' }, title: { display: false } }
                    }
                });
            }

            // Urgency Chart (Bar)
            const urgencyCtx = urgencyChartCanvas?.getContext('2d');
            const urgencyDataAvailable = Object.values(urgencyCounts).some(count => count > 0);
             if (urgencyChartCanvas) urgencyChartCanvas.style.display = urgencyDataAvailable ? 'block' : 'none';
             if (noUrgencyDataEl) noUrgencyDataEl.style.display = urgencyDataAvailable ? 'none' : 'block';
            destroyChart(urgencyChartInstance);
            urgencyChartInstance = null; // Reset instance
            if (urgencyCtx && urgencyDataAvailable) {
                urgencyChartInstance = new Chart(urgencyCtx, {
                    type: 'bar',
                    data: {
                        labels: Object.keys(urgencyCounts),
                        datasets: [{
                            data: Object.values(urgencyCounts),
                            backgroundColor: Object.keys(urgencyCounts).map(urg => URGENCY_COLORS[urg] || '#cccccc'), // Fallback color
                            borderColor: Object.keys(urgencyCounts).map(urg => (URGENCY_COLORS[urg] || '#cccccc').replace('0.7', '1')),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { x: { beginAtZero: true, title: { display: true, text: '# Reports' } } },
                        plugins: { legend: { display: false }, title: { display: false } }
                    }
                });
            }

            // Category Chart (Monthly - Bar)
            const categoryCtx = categoryChartCanvas?.getContext('2d'); // Original ID
            const categoryDataAvailable = totalReportsMonthCount > 0;
            if (categoryChartCanvas) categoryChartCanvas.style.display = categoryDataAvailable ? 'block' : 'none';
            if (noReportsMsgEl) noReportsMsgEl.style.display = categoryDataAvailable ? 'none' : 'block';
            destroyChart(categoryChartInstance);
            categoryChartInstance = null; // Reset instance
            if (categoryCtx && categoryDataAvailable) {
                const allCategories = Object.keys(categoryCountsMonth); // Use the keys from the initialized object
                categoryChartInstance = new Chart(categoryCtx, {
                    type: 'bar',
                    data: {
                        labels: allCategories,
                        datasets: [{
                            data: allCategories.map(cat => categoryCountsMonth[cat]), // Data directly from processed counts
                            backgroundColor: allCategories.map(cat => CATEGORY_COLORS_MONTHLY[cat] || '#cccccc'), // Fallback color
                            borderColor: allCategories.map(cat => (CATEGORY_COLORS_MONTHLY[cat] || '#cccccc').replace('0.7', '1')),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { y: { beginAtZero: true, title: { display: true, text: '# Reports' } }, x: { title: { display: true, text: 'Categories' } } },
                        plugins: { legend: { display: false }, title: { display: false } }
                    }
                });
                window.reportsChart = categoryChartInstance; // Keep global reference if needed (though maybe not necessary)
            } else {
                 window.reportsChart = null;
            }

        } catch (error) {
            console.error("Error rendering admin analytics:", error);
            showPopup("Error loading analytics data.", "error", false); // Keep error visible
             // Optionally hide charts/show error messages in the analytics section
             if (statusChartCanvas) statusChartCanvas.style.display = 'none';
             if (noStatusDataEl) { noStatusDataEl.textContent = 'Error loading data'; noStatusDataEl.style.display = 'block'; }
             // Repeat for other charts/data displays
        }
    }


    // --- Forum Functions ---

    function formatRichText(text) {
        if (!text) return '';
         // Basic sanitization first (more robust DOMPurify recommended for production)
         const escapedText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
         // Then apply formatting
         return escapedText
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
          .replace(/\*(.*?)\*/g, '<em>$1</em>')       // Italic
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>') // Links
          .replace(/\n/g, '<br>'); // Convert newlines to breaks for display
      }


    function getCategoryColor(category) {
        const colors = { General: '#4facfe', Issues: '#ff6b6b', Ideas: '#2ea44f', Events: '#f4a261' };
        return colors[category] || '#586069'; // Default color
    }

    async function renderComments(postId) {
      // Find the comments list within the specific post div (must be in the DOM)
      const commentsList = document.querySelector(`.forum-post[data-post-id="${postId}"] .comments-list`);
      if (!commentsList) {
          console.warn(`Comments list element not found for post ${postId} during renderComments.`);
          return;
      }
      commentsList.innerHTML = '<li>Loading comments...</li>'; // Loading indicator

      try {
          // Query comments subcollection, ordered by timestamp
        const commentsQuery = query(
            collection(db, "forumPosts", postId, "comments"),
            orderBy("timestamp", "asc") // Show oldest comments first
        );
        const querySnapshot = await getDocs(commentsQuery);

        commentsList.innerHTML = ''; // Clear loading/previous comments

        if (querySnapshot.empty) {
          commentsList.innerHTML = '<li>No comments yet. Be the first to comment!</li>';
          return;
        }

        querySnapshot.forEach((doc) => {
          const comment = doc.data();
          const li = document.createElement('li');
          li.classList.add('comment-item'); // Add class for styling
          li.innerHTML = `
             <div class="comment-content">
                 <span class="comment-author">${comment.author || 'Anonymous'}</span>
                 <span class="comment-timestamp">• ${new Date(comment.timestamp?.toDate()).toLocaleDateString()}</span>
                 <p>${formatRichText(comment.content)}</p>
             </div>
             <div class="comment-actions">
                 <button class="vote-btn upvote-comment" data-comment-id="${doc.id}" data-post-id="${postId}">👍 ${comment.upvotes || 0}</button>
                 <button class="vote-btn downvote-comment" data-comment-id="${doc.id}" data-post-id="${postId}">👎 ${comment.downvotes || 0}</button>
                 ${currentUser && currentUser.uid === comment.authorId ? `<button class="delete-comment-btn" data-comment-id="${doc.id}" data-post-id="${postId}">Delete</button>` : ''}
             </div>
          `;
          commentsList.appendChild(li);
        });
      } catch (error) {
        console.error(`Error fetching comments for post ${postId}:`, error);
        commentsList.innerHTML = '<li>Error loading comments. Please try again.</li>';
      }
    }


    function createPostElement(post) {
        const postDiv = document.createElement('div');
        postDiv.classList.add('forum-post');
        if (post.pinned) postDiv.classList.add('pinned');
        postDiv.setAttribute('data-post-id', post.id);

        const postTimestamp = post.timestamp?.toDate ? new Date(post.timestamp.toDate()) : new Date();
        const timeAgo = formatTimeAgo(postTimestamp); // Use a helper for relative time

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
            <p class="post-content-preview">${formatRichText(post.content)}</p> <!-- Consider showing only a preview -->
            <div class="post-actions">
                <button class="vote-btn upvote-post" data-post-id="${post.id}" title="Upvote">👍 ${post.upvotes || 0}</button>
                <button class="vote-btn downvote-post" data-post-id="${post.id}" title="Downvote">👎 ${post.downvotes || 0}</button>
                <button class="toggle-comments-btn" data-post-id="${post.id}" title="Show/Hide Comments">💬 Comments (${post.commentCount || 0})</button>
                ${currentUser && currentUser.email === 'admin@sgresolve.com' ? `
                    <button class="pin-btn" data-post-id="${post.id}" data-pinned="${post.pinned ? 'true' : 'false'}" title="${post.pinned ? 'Unpin Post' : 'Pin Post'}">
                        ${post.pinned ? 'Unpin' : 'Pin'}
                    </button>` : ''}
                ${currentUser && (currentUser.email === 'admin@sgresolve.com' || currentUser.uid === post.authorId) ? `
                    <button class="delete-post-btn" data-post-id="${post.id}" title="Delete Post">🗑️ Delete</button>
                ` : ''}
             </div>
             <div class="comments-section" style="display: none;"> <!-- Start hidden -->
                 <h4>Comments</h4>
                 <ul class="comments-list"></ul> <!-- Placeholder for comments -->
                 <form class="comment-form">
                    <textarea placeholder="Add a comment..." required></textarea>
                    <button type="submit" class="button primary-button">Comment</button>
                 </form>
            </div>
        `;
        return postDiv; // Return the created element
    }

    // Helper function for relative time (simple example)
    function formatTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    }

    async function renderForumPosts(loadMore = false) {
        const forumPostsContainer = document.getElementById('forum-posts');
        const loadMoreButton = document.getElementById('load-more-posts'); // Assuming you add a button
        if (!forumPostsContainer) return;

        if (!loadMore) {
            forumPostsContainer.innerHTML = '<p class="loading-message">Loading posts...</p>';
            lastVisiblePost = null; // Reset pagination
        } else if (loadMoreButton) {
            loadMoreButton.textContent = 'Loading...';
            loadMoreButton.disabled = true;
        }
        isLoadingForumPosts = true;

        try {
            let postsQuery;
            const postsCollection = collection(db, "forumPosts");
            const baseConstraints = [orderBy("pinned", "desc"), orderBy("timestamp", "desc")];
            const fetchLimit = 10; // Number of posts per page

            if (loadMore && lastVisiblePost) {
                 postsQuery = query(postsCollection, ...baseConstraints, startAfter(lastVisiblePost), limit(fetchLimit));
            } else {
                 postsQuery = query(postsCollection, ...baseConstraints, limit(fetchLimit));
            }

            const querySnapshot = await getDocs(postsQuery);

            if (!loadMore) forumPostsContainer.innerHTML = ''; // Clear loading/previous only if it's the initial load

            if (querySnapshot.empty && !loadMore) {
                forumPostsContainer.innerHTML = '<p class="no-data-message">No posts yet. Be the first to post!</p>';
            } else {
                // Get comment counts (consider doing this more efficiently if needed)
                // This is N+1 reads, maybe store commentCount on the post document itself via cloud functions
                const postPromises = querySnapshot.docs.map(async (doc) => {
                    const post = { id: doc.id, ...doc.data() };
                    try {
                        const commentsSnap = await getDocs(collection(db, "forumPosts", post.id, "comments"));
                        post.commentCount = commentsSnap.size; // Add comment count
                    } catch {
                         post.commentCount = 0; // Default if error
                    }
                    return post;
                });
                const postsWithCounts = await Promise.all(postPromises);

                postsWithCounts.forEach((post) => {
                    const postElement = createPostElement(post);   // 1. Create the element
                    forumPostsContainer.appendChild(postElement); // 2. Append it to the DOM
                    // DO NOT render comments here, wait for user interaction (toggle button)
                });

                lastVisiblePost = querySnapshot.docs[querySnapshot.docs.length - 1]; // Update last visible for next load

                // Handle 'Load More' button visibility/state
                 if (loadMoreButton) {
                    if (querySnapshot.docs.length < fetchLimit) {
                         loadMoreButton.style.display = 'none'; // Hide if fewer posts than limit were fetched (end reached)
                         // Optionally add a "no more posts" message
                         if (forumPostsContainer.querySelector('.no-more-posts-message') === null) { // Prevent duplicates
                            const noMoreMsg = document.createElement('p');
                            noMoreMsg.textContent = "You've reached the end!";
                            noMoreMsg.classList.add('no-more-posts-message', 'subtle-text');
                            forumPostsContainer.appendChild(noMoreMsg);
                         }
                    } else {
                         loadMoreButton.style.display = 'block'; // Show if more might exist
                         loadMoreButton.disabled = false;
                         loadMoreButton.textContent = 'Load More Posts';
                    }
                 }
            }

            // Fetch and render trending posts (this fetches ALL posts again - consider optimizing)
            const allPostsSnapshot = await getDocs(query(collection(db, "forumPosts"), orderBy("timestamp", "desc"), limit(50))); // Limit for performance
            const allPosts = [];
            allPostsSnapshot.forEach(doc => allPosts.push({ id: doc.id, ...doc.data() }));
            renderTrendingPosts(allPosts);

        } catch (error) {
            console.error('Error fetching forum posts:', error);
            if (!loadMore) forumPostsContainer.innerHTML = '<p class="error-message">Error loading posts. Please try again later.</p>';
            else if (loadMoreButton) loadMoreButton.textContent = 'Error loading';
            showPopup("Error loading forum posts.", "error");
        } finally {
            isLoadingForumPosts = false;
             // Ensure button state is correct even if error occurred during load more
             if (loadMore && loadMoreButton && !loadMoreButton.disabled) {
                  loadMoreButton.textContent = 'Load More Posts';
                  loadMoreButton.disabled = false;
             }
        }
    }


    function renderTrendingPosts(posts) {
        const trendingContainer = document.getElementById('trending-container');
        if (!trendingContainer) return;
        trendingContainer.innerHTML = ''; // Clear previous

        // Calculate score (upvotes - downvotes) and filter out potentially low-scored items
        const scoredPosts = posts
            .map(post => ({ ...post, score: (post.upvotes || 0) - (post.downvotes || 0) }))
            .filter(post => post.score > 0 || (post.upvotes === 0 && post.downvotes === 0 && post.timestamp?.toDate() > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))); // Include recent posts with 0 score

        // Sort by score (descending), then by timestamp (descending) as a tie-breaker
        const trending = scoredPosts
          .sort((a, b) => {
              if (b.score !== a.score) {
                  return b.score - a.score;
              }
              return (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0); // Newer first if scores are equal
          })
          .slice(0, 5); // Show top 5 trending

        if (trending.length === 0) {
            trendingContainer.innerHTML = '<p>No trending posts yet.</p>';
            return;
        }

        trending.forEach(post => {
          const postDiv = document.createElement('div');
          postDiv.classList.add('trending-post');
          postDiv.setAttribute('data-post-id', post.id); // Add post ID for potential linking
          postDiv.innerHTML = `
            <h4>${post.title || 'Untitled'}</h4>
            <p><small>By ${post.author || 'Anonymous'} • ${post.score} Score</small></p>
          `;
          // Make trending posts clickable to scroll to the main post
          postDiv.addEventListener('click', () => {
            const targetPostElement = document.querySelector(`.forum-post[data-post-id="${post.id}"]`);
            if (targetPostElement) {
                targetPostElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Add a temporary highlight effect
                targetPostElement.classList.add('highlight');
                setTimeout(() => { targetPostElement.classList.remove('highlight'); }, 1500);
            } else {
                 showPopup("Post might not be loaded yet. Scroll down or click 'Load More'.", "info");
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
                  (position) => resolve({
                      lat: position.coords.latitude,
                      lon: position.coords.longitude
                  }),
                  (error) => {
                      let message = `Geolocation error (Code: ${error.code}): `;
                      switch (error.code) {
                          case error.PERMISSION_DENIED: message += "Permission denied."; break;
                          case error.POSITION_UNAVAILABLE: message += "Location information unavailable."; break;
                          case error.TIMEOUT: message += "Request timed out."; break;
                          default: message += "An unknown error occurred.";
                      }
                      reject(new Error(message));
                  },
                  { timeout: 10000 } // Add a timeout
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
      li.classList.add('nearby-report-item'); // Add class for styling
      const distanceText = distance < 1000 ? `${Math.round(distance)} m away` : `${(distance / 1000).toFixed(1)} km away`;
      li.innerHTML = `
          <div class="nearby-report-info">
              <p><strong>Location:</strong> ${report.locationName || 'N/A'}</p>
              <p><strong>Category:</strong> ${report.category || 'N/A'} | <strong>Status:</strong> ${report.status || 'N/A'}</p>
              <p class="report-distance"><i class="icon-location">📍</i> ${distanceText}</p>
          </div>
          ${report.imageUrl ? `<div class="nearby-report-image"><img src="${report.imageUrl}" alt="Report Image"></div>` : '<div class="nearby-report-image no-image"></div>'}
      `;
      // Add click listener to focus map on the report
      li.addEventListener('click', () => {
        if (nearbyMap && report.latitude && report.longitude) {
            nearbyMap.setView([report.latitude, report.longitude], 15); // Zoom in
            // Find and open the corresponding marker popup
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


    async function displayNearbyReports() {
      const locationSelector = document.getElementById('location-selector');
      const radiusSelector = document.getElementById('radius-selector');
      const container = document.getElementById('nearby-reports-container');
      const statusDiv = document.getElementById('nearby-status');
      const loadButton = document.getElementById('load-nearby-reports');


      if (!locationSelector || !radiusSelector || !container || !statusDiv || !loadButton) {
        console.error("Nearby reports elements not found.");
        return;
      }
      if (!nearbyMap) {
          initializeNearbyMap(); // Try initializing again if it wasn't ready
          if (!nearbyMap) {
             showPopup("Map could not be initialized.", "error");
             return;
          }
      }


      const selectedLocationType = locationSelector.value;
      const selectedRadius = parseInt(radiusSelector.value, 10);

      container.innerHTML = ''; // Clear previous results
      statusDiv.textContent = 'Loading...';
      loadButton.disabled = true;
      loadButton.textContent = 'Loading...';
      clearNearbyMapMarkers(); // Clear markers from previous search

      let centerCoords;
      let centerName = "Selected Area";
      let userMarker = null; // To hold the user location marker

      try {
          if (selectedLocationType === 'current') {
              statusDiv.textContent = 'Getting your current location...';
              centerCoords = await getDeviceLocation(); // Fetch user location
              centerName = "Your Location";
              // Add a special marker for the user's location
              userMarker = L.marker([centerCoords.lat, centerCoords.lon], {
                 icon: L.icon({ // Example custom icon (replace with your image path)
                    iconUrl: 'images/user-location-marker.png', // Make sure this image exists
                    iconSize: [30, 30],
                    iconAnchor: [15, 30], // Point of the icon which corresponds to marker's location
                    popupAnchor: [0, -30] // Point from which the popup should open
                 })
              }).addTo(nearbyMap);
              userMarker.bindPopup("Your Current Location");
              nearbyMarkers.push(userMarker); // Add to markers array so it's included in bounds fitting
          } else if (PREDEFINED_LOCATIONS[selectedLocationType]) {
              centerCoords = PREDEFINED_LOCATIONS[selectedLocationType]; // Use predefined location
              centerName = PREDEFINED_LOCATIONS[selectedLocationType].name;
          } else {
              throw new Error("Invalid location selected.");
          }

          statusDiv.textContent = `Fetching reports near ${centerName}...`;
          const allReports = await fetchReports(); // Fetch all valid reports
          const nearbyReports = [];
          const centerLatLng = L.latLng(centerCoords.lat, centerCoords.lon);

          allReports.forEach(report => {
              // Ensure report has valid coordinates before calculating distance
              if (typeof report.latitude === 'number' && typeof report.longitude === 'number') {
                  const reportLatLng = L.latLng(report.latitude, report.longitude);
                  const distance = centerLatLng.distanceTo(reportLatLng); // Calculate distance
                  if (distance <= selectedRadius) {
                      nearbyReports.push({ ...report, distance }); // Add if within radius
                  }
              }
          });

          // Sort reports by distance (nearest first)
          nearbyReports.sort((a, b) => a.distance - b.distance);

          if (nearbyReports.length === 0) {
              statusDiv.textContent = `No reports found within ${selectedRadius / 1000} km of ${centerName}.`;
              container.innerHTML = '<p class="no-data-message">Try selecting a larger radius or a different location.</p>';
              // Center map on the search location even if no results
              nearbyMap.setView([centerCoords.lat, centerCoords.lon], 13); // Zoom level 13 is reasonable

          } else {
              statusDiv.textContent = `Showing ${nearbyReports.length} reports near ${centerName}.`;
              // Add markers and list items for each nearby report
              nearbyReports.forEach(report => {
                  container.appendChild(renderNearbyReportItem(report, report.distance));
                  // Add a standard report marker
                   if (typeof report.latitude === 'number' && typeof report.longitude === 'number') {
                        const marker = L.marker([report.latitude, report.longitude]).addTo(nearbyMap);
                        marker.bindPopup(`
                            <strong>${report.locationName || 'N/A'}</strong><br>
                            (${report.category || 'N/A'}) - ${report.status || 'N/A'}<br>
                            ~${report.distance < 1000 ? Math.round(report.distance) + 'm' : (report.distance / 1000).toFixed(1) + 'km'} away
                        `);
                        nearbyMarkers.push(marker); // Add report marker to array
                   }
              });

              // Fit map to show all markers (including user marker if present)
              if (nearbyMarkers.length > 0) {
                const group = new L.featureGroup(nearbyMarkers);
                try {
                    nearbyMap.fitBounds(group.getBounds().pad(0.1)); // Fit bounds with padding
                } catch (e) {
                    console.error("Error fitting nearby map bounds:", e);
                     nearbyMap.setView([centerCoords.lat, centerCoords.lon], 12); // Fallback view
                }
              } else {
                 // Should not happen if user marker exists or reports were found, but as a fallback:
                 nearbyMap.setView([centerCoords.lat, centerCoords.lon], 13);
              }
          }

      } catch (error) {
          console.error("Error loading nearby reports:", error);
          statusDiv.textContent = `Error: ${error.message}`;
          container.innerHTML = '<p class="error-message">Could not load nearby reports. Please check permissions or try again.</p>';
          showPopup(`Could not load nearby reports: ${error.message}`, "error");
           // Still try to center the map on the intended location if possible
           if (centerCoords) {
                nearbyMap.setView([centerCoords.lat, centerCoords.lon], 11); // Zoom out a bit on error
           }
      } finally {
          // Re-enable the load button
          loadButton.disabled = false;
          loadButton.textContent = 'Load Reports';
      }
    }


    // --- Chatbot Functions ---
    function toggleChat() {
        const chatContainer = document.getElementById('chat-container');
        const chatIcon = document.getElementById('chat-icon');
        chatContainer?.classList.toggle('active');
        chatIcon?.classList.toggle('active'); // Toggle icon state if needed for styling
        // Focus input when opening
        if (chatContainer?.classList.contains('active')) {
            document.getElementById('user-input')?.focus();
        }
    }


    async function sendChatMessage() {
        const userInputElement = document.getElementById("user-input");
        const chatBox = document.getElementById("chat-box");
        const sendButton = document.querySelector('.send-button');
        if (!userInputElement || !chatBox || !sendButton) return;

        const userInput = userInputElement.value.trim();
        if (!userInput) return;

        // Disable input and button during request
        userInputElement.disabled = true;
        sendButton.disabled = true;
        sendButton.textContent = '...';


        // Display user message immediately
        const userMsgDiv = document.createElement('div');
        userMsgDiv.classList.add('message', 'user');
        // Sanitize user input before displaying (simple example)
        userMsgDiv.innerHTML = `<strong>You:</strong> ${userInput.replace(/</g, "&lt;").replace(/>/g, "&gt;")}`;
        chatBox.appendChild(userMsgDiv);
        userInputElement.value = ""; // Clear input
        chatBox.scrollTop = chatBox.scrollHeight; // Scroll down

        try {
            // --- Use the Correct Chatbot API URL ---
            // Make sure this matches your deployed chatbot server endpoint
             const CHATBOT_API_URL = "https://chatbot-server-production-da96.up.railway.app/chat"; // Replace if needed

            const response = await fetch(CHATBOT_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userInput })
            });

            if (!response.ok) {
                 // Try to get error detail from response body
                 let errorDetail = '';
                 try {
                     const errorData = await response.json();
                     errorDetail = errorData.error || JSON.stringify(errorData);
                 } catch (e) {
                     errorDetail = await response.text(); // Fallback to raw text
                 }
                throw new Error(`Chatbot API error: ${response.status} ${response.statusText}. Detail: ${errorDetail}`);
            }

            const data = await response.json();

            // Display bot response
            const botMsgDiv = document.createElement('div');
            botMsgDiv.classList.add('message', 'bot');
             // Format the bot's response using the rich text formatter
            botMsgDiv.innerHTML = `<strong>SGResolve Bot:</strong> ${formatRichText(data.response || "Sorry, I couldn't process that.")}`;
            chatBox.appendChild(botMsgDiv);

        } catch (error) {
            console.error("Chatbot error:", error);
             // Display error message in chat
             const errorMsgDiv = document.createElement('div');
             errorMsgDiv.classList.add('message', 'bot', 'error'); // Add error class for styling
             errorMsgDiv.innerHTML = `<strong>SGResolve Bot:</strong> Sorry, I encountered an error (${error.message}). Please try again later.`;
             chatBox.appendChild(errorMsgDiv);
        } finally {
             // Re-enable input and button
             userInputElement.disabled = false;
             sendButton.disabled = false;
             sendButton.textContent = 'Send';
             chatBox.scrollTop = chatBox.scrollHeight; // Scroll down again
             userInputElement.focus(); // Set focus back to input
        }
    }

    // --- About Page Animation ---
    function initializeAboutPageObserver() {
        const sections = document.querySelectorAll('#about-page .about-section');
        if (sections.length === 0 || !('IntersectionObserver' in window)) {
             // Fallback or do nothing if no sections or Observer not supported
             sections.forEach(section => section.classList.add('visible')); // Make all visible immediately
             return;
        }

        const observer = new IntersectionObserver((entries, obs) => { // Pass observer to callback
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              // Optional: unobserve after first view to prevent re-animation
              obs.unobserve(entry.target); // Unobserve the target
            }
            // No 'else' needed if only animating on entry
          });
        }, {
            threshold: 0.1, // Trigger when 10% is visible
            // rootMargin: '0px 0px -50px 0px' // Optional: Adjust trigger point
        });

        sections.forEach(section => {
          observer.observe(section);
        });
      }


    // --- Auth State Change Listener ---
    onAuthStateChanged(auth, (user) => {
        currentUser = user; // Update global currentUser
        updateNavbar(); // Update navbar visibility based on login state
        hideAllPages(); // Hide all pages first

        if (user) {
            console.log("User logged in:", user.uid, user.email, user.displayName);
            // Check if user is admin
            if (user.email === 'admin@sgresolve.com') {
                showPage(pages.admin); // Show admin dashboard
            } else {
                showPage(pages.reporting); // Show standard reporting page for regular users
            }
            // If forum exists and is visible, possibly refresh posts or enable posting features
             if (pages.community && pages.community.style.display === 'block') {
                 renderForumPosts(); // Re-render forum posts on login/state change if needed
             }
        } else {
            console.log("User logged out or not logged in.");
            showPage(pages.landing); // Show landing page if not logged in
            currentUser = null; // Ensure currentUser is null
        }
        // Reset things that depend on user state if necessary
         if (tempMarker && reportingMap) { // Clear temporary reporting marker on logout/login change
             reportingMap.removeLayer(tempMarker);
             tempMarker = null;
         }
         // Clear image preview on logout/login change
         imageDataUrl = null;
         document.getElementById('imagePreview').innerHTML = '';
         const analyzeBtn = document.getElementById('analyzeImageBtn');
         if(analyzeBtn) analyzeBtn.disabled = true;
    });


    // --- Event Listeners ---

    // Navigation
    document.getElementById('nav-home')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentUser) {
            currentUser.email === 'admin@sgresolve.com' ? showPage(pages.admin) : showPage(pages.reporting);
        } else {
            showPage(pages.landing);
        }
    });
    document.getElementById('nav-my-reports')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentUser) {
            showPage(pages.myReports);
            renderUserReports(); // Render AFTER showing the page
        } else { showPage(pages.login); } // Redirect to login if not logged in
    });
    document.getElementById('nav-nearby-reports')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentUser) {
            showPage(pages.nearbyReports);
             // Optionally trigger initial load or wait for button
             displayNearbyReports(); // Load reports when page is navigated to
        } else { showPage(pages.login); }
    });
    document.getElementById('nav-community')?.addEventListener('click', (e) => {
        e.preventDefault();
        showPage(pages.community);
        renderForumPosts(); // Initial render when navigating to community page
         // Add Load More button listener if not already added globally
         const loadMoreButton = document.getElementById('load-more-posts');
         if (loadMoreButton && !loadMoreButton.dataset.listenerAttached) {
             loadMoreButton.addEventListener('click', () => renderForumPosts(true));
             loadMoreButton.dataset.listenerAttached = 'true'; // Prevent adding multiple listeners
         }
    });
    document.getElementById('nav-about')?.addEventListener('click', (e) => {
        e.preventDefault();
        showPage(pages.about);
    });
    document.getElementById('nav-logout')?.addEventListener('click', (e) => {
        e.preventDefault();
        signOut(auth).then(() => {
            showPopup("Logged out successfully.", "success");
            // Auth state listener will handle showing the landing page
        }).catch(error => {
            console.error("Logout error:", error);
            showPopup(`Logout failed: ${error.message}`, "error");
        });
    });


    // Landing Page Buttons
    document.getElementById('hero-report-issue')?.addEventListener('click', (e) => { e.preventDefault(); showPage(pages.login); });
    document.getElementById('hero-learn-more')?.addEventListener('click', (e) => { e.preventDefault(); showPage(pages.about); });
    document.getElementById('cta-register')?.addEventListener('click', (e) => { e.preventDefault(); showPage(pages.register); });
    document.getElementById('cta-login')?.addEventListener('click', (e) => { e.preventDefault(); showPage(pages.login); });


    // Back Links
    document.getElementById('back-to-landing-from-login')?.addEventListener('click', (e) => { e.preventDefault(); showPage(pages.landing); });
    document.getElementById('back-to-landing-from-register')?.addEventListener('click', (e) => { e.preventDefault(); showPage(pages.landing); });
    document.getElementById('back-to-landing-from-about')?.addEventListener('click', (e) => { e.preventDefault(); showPage(pages.landing); });


    // Login/Register Links
    document.getElementById('go-to-register')?.addEventListener('click', (e) => { e.preventDefault(); showPage(pages.register); });
    document.getElementById('go-to-login')?.addEventListener('click', (e) => { e.preventDefault(); showPage(pages.login); });


    // Login Form
    document.getElementById('login-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const submitButton = e.target.querySelector('button[type="submit"]');

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            showPopup("Please enter both email and password.", "error");
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Logging in...';

        signInWithEmailAndPassword(auth, email, password)
          .then((userCredential) => {
             // Auth state listener will handle page change
             showPopup('Logged in successfully!', 'success');
             // No need to manually change page here
          })
          .catch((error) => {
            console.error("Login Error:", error.code, error.message);
            let message = `Login failed. Please check your credentials.`; // Generic message first
            // Provide more specific feedback based on common errors
             if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                message = 'Invalid email or password.';
             } else if (error.code === 'auth/invalid-email') {
                message = 'Invalid email format.';
             } else {
                 message = `Login error: ${error.code}`; // Fallback for other errors
             }
            showPopup(message, 'error');
          })
          .finally(() => {
             // Re-enable button regardless of success/failure
             submitButton.disabled = false;
             submitButton.textContent = 'Login';
          });
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

        if (!name) {
            showPopup("Please enter your full name.", "error");
            nameInput.focus();
            return;
        }
         if (!email || !password) {
            showPopup("Please enter email and password.", "error");
            return;
         }
         if (password.length < 6) {
              showPopup("Password should be at least 6 characters long.", "error");
              passwordInput.focus();
              return;
         }


        submitButton.disabled = true;
        submitButton.textContent = 'Registering...';

        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Set display name IMMEDIATELY after creation
                return updateProfile(userCredential.user, { displayName: name });
            })
            .then(() => {
                showPopup('Registered successfully! You are now logged in.', 'success');
                // Auth state listener handles showing the correct page (e.g., reporting)
                // No need to manually showPage here.
            })
            .catch((error) => {
                console.error("Registration Error:", error.code, error.message);
                let message = `Registration failed.`;
                if (error.code === 'auth/weak-password') {
                    message = 'Password is too weak. Please use at least 6 characters.';
                } else if (error.code === 'auth/email-already-in-use') {
                    message = 'This email address is already registered. Please log in or use a different email.';
                } else if (error.code === 'auth/invalid-email') {
                    message = 'Invalid email format.';
                } else {
                     message = `Registration error: ${error.code}`; // Fallback
                }
                showPopup(message, 'error');
            })
            .finally(() => {
                 submitButton.disabled = false;
                 submitButton.textContent = 'Register';
            });
    });


    // Admin Logout (Specific button if needed, otherwise nav-logout handles it)
    document.getElementById('logout-admin')?.addEventListener('click', (e) => {
        e.preventDefault();
         signOut(auth).then(() => {
             showPopup("Admin logged out successfully.", "success");
         }).catch(error => {
             console.error("Admin logout error:", error);
             showPopup(`Logout failed: ${error.message}`, "error");
         });
    });


    // Reporting Page - Detect Location Button
    document.getElementById('detectLocation')?.addEventListener('click', function() {
        const button = this; // Reference the button
        button.disabled = true;
        button.textContent = 'Detecting...';

        getDeviceLocation()
            .then(coords => {
                 const latLng = L.latLng(coords.lat, coords.lon);
                if (!singaporeLatLngBounds.contains(latLng)) {
                     showPopup('Your current location appears to be outside Singapore.', 'warning');
                     // Still set the coordinates but warn the user
                 }
                if (!reportingMap) initializeReportingMap(); // Ensure map is ready

                if (reportingMap) {
                    if (tempMarker) reportingMap.removeLayer(tempMarker);
                    tempMarker = L.marker(latLng).addTo(reportingMap);
                    reportingMap.setView(latLng, 16); // Zoom in closer after detection
                }
                document.getElementById('latitude').value = coords.lat.toFixed(6);
                document.getElementById('longitude').value = coords.lon.toFixed(6);
                 // Optional: Auto-fill location name using reverse geocoding API (e.g., OpenCage, Nominatim - requires setup)
                 // fetchReverseGeocode(coords.lat, coords.lon)...
            })
            .catch(error => {
                showPopup(`Could not detect location: ${error.message}`, 'error');
            })
            .finally(() => {
                // Re-enable the button
                button.disabled = false;
                button.textContent = 'Detect Location';
            });
    });


    // --- Reporting Page - Image Upload & AI Analysis ---

    const imageUpload = document.getElementById('imageUpload');
    const imagePreview = document.getElementById('imagePreview');
    const analyzeImageBtn = document.getElementById('analyzeImageBtn'); // Get the AI analyze button

    imageUpload?.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            // Optional: Check file size or type here
            const reader = new FileReader();
            reader.onload = function(e) {
                imageDataUrl = e.target.result; // Store base64 for preview AND AI analysis
                if (imagePreview) imagePreview.innerHTML = `<img src="${imageDataUrl}" alt="Image Preview" style="max-width: 200px; height: auto; margin-top: 5px; border-radius: 4px;">`;
                if (analyzeImageBtn) analyzeImageBtn.disabled = false; // Enable AI button
            };
            reader.onerror = function(err) {
                 console.error("FileReader error:", err);
                 showPopup("Error reading image file.", "error");
                 imageDataUrl = null;
                 if (imagePreview) imagePreview.innerHTML = '';
                 if (analyzeImageBtn) analyzeImageBtn.disabled = true;
            }
            reader.readAsDataURL(file);
        } else {
            // No file selected or selection cancelled
            imageDataUrl = null; // Clear if no file selected
            if (imagePreview) imagePreview.innerHTML = '';
            if (analyzeImageBtn) analyzeImageBtn.disabled = true; // Disable AI button
        }
    });


    // Event Listener for the AI Analyze Button (Image Analysis)
    analyzeImageBtn?.addEventListener('click', async () => {
        if (!imageDataUrl) {
            showPopup("Please select an image first.", "error");
            return;
        }
        if (!IMAGE_ANALYZER_API_URL || IMAGE_ANALYZER_API_URL.includes("YOUR_RAILWAY_APP_URL_HERE")) { // Safety check
             showPopup("AI Analyzer Service URL is not configured correctly.", "error");
             console.error("Please update IMAGE_ANALYZER_API_URL in script.js");
             return;
        }


        analyzeImageBtn.disabled = true;
        analyzeImageBtn.textContent = 'Analyzing...';
        // Use non-auto-closing popup for potentially long process
        showPopup("Sending image for AI analysis... Please wait.", "info", false);

        try {
            const response = await fetch(IMAGE_ANALYZER_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Send the full base64 data URL; backend will handle the prefix
                body: JSON.stringify({ image_data: imageDataUrl })
            });

            // Close the "sending" popup first
            document.getElementById('popup-overlay').style.display = 'none';

            if (!response.ok) {
                // Try to get error message from API response body
                let errorMsg = `Analysis failed with status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    // Use the specific error message from backend if available
                    errorMsg = errorData.error || `Server error ${response.status}`;
                } catch (e) {
                    // If response is not JSON, use the status text
                    errorMsg = `Server error ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorMsg);
            }

            const result = await response.json();

            // --- Update the dropdowns based on API result ---
            const categorySelect = document.getElementById('category');
            const urgencySelect = document.getElementById('urgency');
            const threatSelect = document.getElementById('threat');

            // Check if the returned values exist as options before setting
            if (categorySelect && result.category && [...categorySelect.options].some(opt => opt.value === result.category)) {
                categorySelect.value = result.category;
            } else if (categorySelect) {
                 console.warn(`AI returned category "${result.category}" not found in dropdown. Keeping current selection.`);
            }

            if (urgencySelect && result.urgency && [...urgencySelect.options].some(opt => opt.value === result.urgency)) {
                urgencySelect.value = result.urgency;
            } else if (urgencySelect) {
                console.warn(`AI returned urgency "${result.urgency}" not found in dropdown. Keeping current selection.`);
            }

            if (threatSelect && result.threat && [...threatSelect.options].some(opt => opt.value === result.threat)) {
                threatSelect.value = result.threat;
            } else if (threatSelect) {
                console.warn(`AI returned threat "${result.threat}" not found in dropdown. Keeping current selection.`);
            }
            // --- End dropdown update ---

             // Show a success message with the results
             showPopup(`AI Analysis Complete: Category set to ${result.category}, Urgency to ${result.urgency}, Threat to ${result.threat}`, "success");


        } catch (error) {
             // Ensure "sending" popup is closed on error too
             document.getElementById('popup-overlay').style.display = 'none';
            console.error('AI Image Analysis Error:', error);
             // Show a more detailed error message
            showPopup(`AI Analysis Failed: ${error.message}`, 'error', false); // Keep error popup visible
        } finally {
            // Re-enable button regardless of success/failure
            analyzeImageBtn.disabled = false;
            analyzeImageBtn.textContent = 'Analyze Image with AI';
        }
    });


    // Reporting Page - Auto Detect Feature (Text Analysis)
    const autoDetectButton = document.getElementById('autoDetect');
    const problemDescInput = document.getElementById('problemDesc');
    problemDescInput?.addEventListener('input', () => {
         // Enable button only if there is text in the description
        if (autoDetectButton) autoDetectButton.disabled = !problemDescInput.value.trim();
    });

    autoDetectButton?.addEventListener('click', async () => {
        const description = problemDescInput?.value.trim();
        const reportErrorDiv = document.getElementById('report-error'); // Assuming this exists for errors
        const categorySelect = document.getElementById('category');
        const urgencySelect = document.getElementById('urgency');
        const threatSelect = document.getElementById('threat');


        if (!description) {
            showPopup('Please enter a description first for text analysis.', 'warning');
            return;
        }
        if (!categorySelect || !urgencySelect || !threatSelect) {
             console.error("Missing dropdown elements for text auto-detect.");
             return;
        }

        if (reportErrorDiv) reportErrorDiv.textContent = ''; // Clear previous errors
        autoDetectButton.disabled = true;
        autoDetectButton.textContent = 'Detecting...';
        showPopup("Analyzing description text...", "info", false); // Non-auto-close


        try {
            // --- Use the Correct Text Analysis API URL ---
             // Make sure this matches your deployed text analysis server endpoint
             const TEXT_ANALYSIS_API_URL = 'https://auto-detect-model-production.up.railway.app/predict'; // Replace if needed

            const response = await fetch(TEXT_ANALYSIS_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: description })
            });

            // Close popup
            document.getElementById('popup-overlay').style.display = 'none';

            if (!response.ok) {
                 let errorMsg = `Text analysis failed: ${response.status}`;
                 try { errorMsg = (await response.json()).error || errorMsg; } catch (e) {}
                 throw new Error(errorMsg);
            }

            const data = await response.json();

             // --- Update dropdowns based on TEXT analysis result ---
             // Use || '' to avoid errors if API returns null/undefined
             const predictedCategory = data.category || '';
             const predictedUrgency = data.urgency || '';
             const predictedThreat = data.threat || '';


             // Check if the returned values exist as options before setting
             if (categorySelect && predictedCategory && [...categorySelect.options].some(opt => opt.value === predictedCategory)) {
                 categorySelect.value = predictedCategory;
             } else if (categorySelect) {
                  console.warn(`Text AI returned category "${predictedCategory}" not found. Keeping current.`);
             }
             if (urgencySelect && predictedUrgency && [...urgencySelect.options].some(opt => opt.value === predictedUrgency)) {
                 urgencySelect.value = predictedUrgency;
             } else if (urgencySelect) {
                 console.warn(`Text AI returned urgency "${predictedUrgency}" not found. Keeping current.`);
             }
             if (threatSelect && predictedThreat && [...threatSelect.options].some(opt => opt.value === predictedThreat)) {
                 threatSelect.value = predictedThreat;
             } else if (threatSelect) {
                  console.warn(`Text AI returned threat "${predictedThreat}" not found. Keeping current.`);
             }
             // --- End dropdown update ---


            showPopup(`Text analysis complete! Categories suggested.`, "success");
        } catch (error) {
            // Close popup if error occurred during fetch
             document.getElementById('popup-overlay').style.display = 'none';
            console.error('Text Auto Detect Error:', error);
            if (reportErrorDiv) reportErrorDiv.textContent = 'Text auto detect failed. Please select manually.';
            showPopup(`Text Auto-Detect Failed: ${error.message}`, 'error', false); // Keep error visible
        } finally {
            autoDetectButton.disabled = false; // Re-enable button
            autoDetectButton.textContent = 'Auto Detect (Text)';
        }
    });


        // Reporting Page - Form Submission
        document.getElementById('report-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) {
                showPopup("Please log in to submit a report.", "error");
                showPage(pages.login); // Redirect to login
                return;
            }
    
            // Get form elements
            const locationNameInput = document.getElementById('locationName');
            const latitudeInput = document.getElementById('latitude');
            const longitudeInput = document.getElementById('longitude');
            const descriptionInput = document.getElementById('problemDesc');
            const categorySelect = document.getElementById('category');
            const urgencySelect = document.getElementById('urgency');
            const threatSelect = document.getElementById('threat');
            const fileInput = document.getElementById('imageUpload');
            const reportErrorDiv = document.getElementById('report-error');
            const submitButton = e.target.querySelector('button[type="submit"]');
    
    
            // Get values and trim strings
            const locationName = locationNameInput?.value.trim();
            const latitude = parseFloat(latitudeInput?.value);
            const longitude = parseFloat(longitudeInput?.value);
            const description = descriptionInput?.value.trim();
            const category = categorySelect?.value;
            const urgency = urgencySelect?.value;
            const threat = threatSelect?.value;
    
    
            if (reportErrorDiv) reportErrorDiv.textContent = ''; // Clear previous errors
    
            // Validation
            if (!locationName || isNaN(latitude) || isNaN(longitude) || !description || !category || !urgency || !threat) {
                showPopup('Please fill in all required fields (Location, Coordinates, Description, Category, Urgency, Threat).', 'error'); return;
            }
            if (!singaporeLatLngBounds.contains([latitude, longitude])) {
                 showPopup('Selected location coordinates must be within Singapore.', 'error'); return;
            }
    
            // Disable submit button during processing
            submitButton.disabled = true;
            submitButton.textContent = 'Submitting...';
            showPopup("Submitting report...", "info", false); // Non-auto-close
    
            let uploadedImageUrl = null; // Use a different variable name to avoid confusion with imageDataUrl (base64)
            const file = fileInput?.files[0];
    
                // Handle image upload IF a file is selected
                if (file) {
                    // Ensure imageDataUrl (base64 preview data) is available before trying to upload
                    if (!imageDataUrl) {
                        showPopup("Image selected but preview data is missing. Please try re-selecting the image.", "error");
                        submitButton.disabled = false;
                        submitButton.textContent = 'Submit Report';
                        document.getElementById('popup-overlay').style.display = 'none'; // Close submitting popup
                        return;
                    }
                    try {
                        // Using ImgBB
                       const formData = new FormData();
                       // Send the base64 part after the comma
                       formData.append('image', imageDataUrl.split(',')[1]);
                       formData.append('key', '8c3ac5bab399ca801e354b900052510d'); // Replace with your key
                       const imgbbResponse = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
                       const imgbbData = await imgbbResponse.json();
                       if (!imgbbData.success) throw new Error(imgbbData.error?.message || 'ImgBB upload failed');
    
                       // *** THE FIX IS HERE ***
                       uploadedImageUrl = imgbbData.data.url; // Fix: Assign to uploadedImageUrl
    
    
                    } catch (error) {
                        console.error('Image Upload Error:', error);
                        // Close the "Submitting" popup before showing the error
                        document.getElementById('popup-overlay').style.display = 'none';
                        showPopup(`Image upload failed: ${error.message}`, 'error', false); // Keep error visible
                        submitButton.disabled = false;
                        submitButton.textContent = 'Submit Report';
                        return; // Stop submission if image upload fails
                    }
                }
            // --- End Image Upload Handling ---
    
    
            // Create report object for Firestore
            const reportData = {
                userId: currentUser.uid,
                userName: currentUser.displayName || 'Anonymous', // Include user's display name
                locationName,
                latitude,
                longitude,
                description,
                category,
                urgency,
                threat,
                imageUrl: uploadedImageUrl, // Use the URL from storage/hosting (or null if no image)
                status: 'Pending', // Initial status
                timestamp: new Date() // Use server timestamp ideally, but client time is fallback
            };
    
            // Save report data to Firestore
            try {
                const docRef = await addDoc(collection(db, "reports"), reportData);
                console.log('Report added to Firestore with ID:', docRef.id);
    
                 // Close the "Submitting" popup
                 document.getElementById('popup-overlay').style.display = 'none';
                showPopup('Report submitted successfully!', 'success');
    
                // --- Reset Form After Successful Submission ---
                document.getElementById('report-form').reset(); // Reset all form fields
                imageDataUrl = null; // Clear base64 variable
                if (imagePreview) imagePreview.innerHTML = ''; // Clear preview display
                 const analyzeBtn = document.getElementById('analyzeImageBtn');
                 if(analyzeBtn) analyzeBtn.disabled = true; // Disable analyze button
                if (tempMarker && reportingMap) { // Clear map marker
                    reportingMap.removeLayer(tempMarker);
                    tempMarker = null;
                }
                // --- End Form Reset ---
    
    
                // Refresh relevant views IF they are currently displayed
                if (pages.myReports?.style.display === 'block') renderUserReports();
                 // If the current user is admin and admin page is visible, refresh admin views
                 if (currentUser.email === 'admin@sgresolve.com' && pages.admin?.style.display === 'block') {
                     await renderAdminReports();
                     await renderAdminAnalytics();
                 }
    
    
            } catch (error) {
                 // Close the "Submitting" popup
                 document.getElementById('popup-overlay').style.display = 'none';
                console.error('Error adding report to Firestore:', error);
                showPopup(`Error submitting report: ${error.message}`, 'error', false); // Keep error visible
            } finally {
                 // Re-enable submit button regardless of Firestore success/failure
                 submitButton.disabled = false;
                 submitButton.textContent = 'Submit Report';
            }
        });

    // --- Admin Page Actions ---

    // Filters, Refresh, Export
    document.getElementById('apply-filters')?.addEventListener('click', renderAdminReports); // Re-render applies filters
    document.getElementById('reset-filters')?.addEventListener('click', () => {
        // Reset dropdowns
        document.getElementById('image-filter').value = 'all';
        document.getElementById('category-filter').value = 'all';
        document.getElementById('urgency-filter').value = 'all';
        document.getElementById('threat-filter').value = 'all';
        // Re-render with default filters
        renderAdminReports();
    });
    document.getElementById('refresh-reports')?.addEventListener('click', async () => {
         const button = document.getElementById('refresh-reports');
         button.disabled = true;
         button.textContent = 'Refreshing...';
        showPopup("Refreshing reports and analytics...", "info", false);
        try {
            await Promise.all([renderAdminReports(), renderAdminAnalytics()]);
            document.getElementById('popup-overlay').style.display = 'none'; // Close info popup
            showPopup("Data refreshed!", "success");
        } catch (error) {
            document.getElementById('popup-overlay').style.display = 'none'; // Close info popup
            showPopup("Failed to refresh data.", "error");
        } finally {
             button.disabled = false;
             button.textContent = 'Refresh Reports';
        }
    });
    document.getElementById('export-data')?.addEventListener('click', async () => {
        showPopup("Generating CSV export...", "info", false);
        try {
            const allReports = await fetchReports(); // Fetch all reports
            if (allReports.length === 0) {
                 document.getElementById('popup-overlay').style.display = 'none';
                 showPopup("No reports available to export.", "info");
                 return;
            }
            const csvRows = [];
            // Define headers
             const headers = ['ID', 'User ID', 'User Name', 'Location Name', 'Latitude', 'Longitude', 'Description', 'Category', 'Urgency', 'Threat', 'Image URL', 'Status', 'Timestamp'];
            csvRows.push(headers.join(','));

            // Helper to safely format CSV fields (handle commas, quotes, newlines)
            const escapeCsvField = (field) => {
                const stringField = String(field === null || field === undefined ? '' : field);
                // If the field contains a comma, double quote, or newline, enclose in double quotes and escape existing double quotes
                if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
                    return `"${stringField.replace(/"/g, '""')}"`;
                }
                return stringField;
            };


            // Add data rows
            allReports.forEach(report => {
                const timestampStr = report.timestamp instanceof Date ? report.timestamp.toISOString() : '';
                const row = [
                    escapeCsvField(report.id),
                    escapeCsvField(report.userId),
                    escapeCsvField(report.userName),
                    escapeCsvField(report.locationName),
                    escapeCsvField(report.latitude),
                    escapeCsvField(report.longitude),
                    escapeCsvField(report.description),
                    escapeCsvField(report.category),
                    escapeCsvField(report.urgency),
                    escapeCsvField(report.threat),
                    escapeCsvField(report.imageUrl),
                    escapeCsvField(report.status),
                    escapeCsvField(timestampStr) // Use ISO string for timestamp
                ];
                csvRows.push(row.join(','));
            });

            // Combine rows into a single string
            const csvString = csvRows.join('\n');

            // Create Blob and download link
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            if (link.download !== undefined) { // Check if download attribute is supported
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                // Generate filename with date
                const formattedDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
                link.setAttribute('download', `sgresolve_reports_${formattedDate}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url); // Clean up object URL
                 document.getElementById('popup-overlay').style.display = 'none';
                showPopup("Report export generated successfully.", "success");
            } else {
                // Fallback for older browsers (might just open in new tab)
                 document.getElementById('popup-overlay').style.display = 'none';
                showPopup("CSV generated, but download attribute not supported. Please save the file manually if it opens.", "warning");
                 window.open('data:text/csv;charset=utf-8,' + encodeURIComponent(csvString));
            }

        } catch (error) {
             document.getElementById('popup-overlay').style.display = 'none';
            console.error('Error exporting reports:', error);
            showPopup(`Export failed: ${error.message}`, 'error', false);
        }
    });

    // Admin Page - Report List Actions (Status Update, Delete) - Using Event Delegation
    document.getElementById('admin-reports-container')?.addEventListener('click', async (e) => {
        const target = e.target;
        // Find the closest ancestor list item which holds the report ID
        const reportLi = target.closest('li[data-report-id]');
        if (!reportLi) return; // Click was not on a report item or its children


        const reportId = reportLi.getAttribute('data-report-id');
        if (!reportId) return; // Should not happen if data-report-id exists


        // --- Handle Status Update ---
        if (target.classList.contains('update-status-btn')) {
            const select = reportLi.querySelector('.status-update');
            const newStatus = select?.value;
            if (!newStatus) return; // No status selected

            const updateButton = target; // Reference the button
            updateButton.disabled = true; // Disable button during update
            updateButton.textContent = 'Updating...';
            const originalStatus = reportLi.querySelector('.report-status')?.textContent; // Store original for revert on error

            try {
                const reportRef = doc(db, "reports", reportId);
                await updateDoc(reportRef, { status: newStatus });

                showPopup("Status updated successfully.", "success");
                // Update status text directly in the UI for immediate feedback
                const statusSpan = reportLi.querySelector('.report-status');
                if (statusSpan) statusSpan.textContent = newStatus;

                // Refresh analytics data as status change impacts counts
                await renderAdminAnalytics();

            } catch (error) {
                console.error('Error updating status:', error);
                showPopup(`Failed to update status: ${error.message}`, 'error');
                // Revert UI optimistically on error if needed (optional)
                const statusSpan = reportLi.querySelector('.report-status');
                if (statusSpan && originalStatus) statusSpan.textContent = originalStatus;
            } finally {
                 // Re-enable button
                 updateButton.disabled = false;
                 updateButton.textContent = 'Update';
            }
        }


        // --- Handle Report Deletion ---
        if (target.classList.contains('delete-report-btn')) {
             // Confirmation dialog
             if (confirm(`Are you sure you want to permanently delete report ${reportId}? This action cannot be undone.`)) {
                 const deleteButton = target; // Reference the button
                 deleteButton.disabled = true;
                 deleteButton.textContent = 'Deleting...';

                try {
                    const reportRef = doc(db, "reports", reportId);
                    await deleteDoc(reportRef);

                    showPopup('Report deleted successfully.', 'success');
                    // Remove the list item from the UI immediately
                    reportLi.remove();

                    // Re-render map and analytics after deletion (necessary as data changed)
                    // Fetch remaining reports shown in the list to update the map correctly
                    const remainingReportElements = document.querySelectorAll('#admin-reports-container li[data-report-id]');
                    // This requires fetching full data again to be accurate for the map and analytics
                    await renderAdminReports(); // Easiest way to ensure consistency
                    await renderAdminAnalytics();

                 } catch (error) {
                     console.error('Error deleting report:', error);
                     showPopup(`Failed to delete report: ${error.message}`, 'error');
                      // Re-enable button on failure
                      deleteButton.disabled = false;
                      deleteButton.textContent = 'Delete';
                 }
             } // else: User clicked Cancel in confirmation
        }
    });



    // --- Community Forum Actions (Using Event Delegation on the container) ---
    const forumContainer = document.getElementById('community-forum-page'); // Get the main container for the forum page

    if (forumContainer) {
        // --- New Post Form Submission ---
        document.getElementById('forum-post-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) {
                showPopup("Please log in to create a post.", "error");
                showPage(pages.login); // Optionally redirect to login
                return;
            }

            const titleInput = document.getElementById('post-title');
            const contentInput = document.getElementById('post-content');
            const categorySelect = document.getElementById('post-category');
            const submitButton = document.getElementById('submit-button');


            const title = titleInput?.value.trim();
            const content = contentInput?.value.trim();
            const category = categorySelect?.value;

            if (!title || !content || !category) {
                showPopup("Please fill in the post title, content, and select a category.", "error");
                return;
            }

            // Disable button during submission
            submitButton.disabled = true;
            submitButton.textContent = 'Posting...';

            try {
                await addDoc(collection(db, "forumPosts"), {
                    title,
                    content,
                    category,
                    author: currentUser.displayName || 'Anonymous', // Use display name
                    authorId: currentUser.uid, // Store user ID
                    timestamp: new Date(), // Client-side timestamp (consider server timestamp)
                    upvotes: 0,
                    downvotes: 0,
                    commentCount: 0, // Initialize comment count
                    pinned: false // Default pinned to false
                });

                // Reset the form
                document.getElementById('forum-post-form').reset();
                showPopup("Post submitted successfully!", "success");

                // Refresh the forum posts list to show the new post at the top
                await renderForumPosts(); // This resets pagination and fetches from the start

            } catch (error) {
                console.error('Error adding forum post:', error);
                showPopup(`Error submitting post: ${error.message}`, 'error');
            } finally {
                // Re-enable button
                submitButton.disabled = false;
                submitButton.textContent = 'Post';
            }
        });

        // --- Event Delegation for Actions within Forum Posts ---
        const forumPostsContainer = document.getElementById('forum-posts');
        forumPostsContainer?.addEventListener('click', async (e) => {
            const target = e.target;
            const postElement = target.closest('.forum-post'); // Find the parent post element
            if (!postElement) return; // Click wasn't inside a post
            const postId = postElement.getAttribute('data-post-id');
            if (!postId) return; // Should have a post ID

             // --- Handle Comment Toggling ---
             if (target.classList.contains('toggle-comments-btn')) {
                 const commentsSection = postElement.querySelector('.comments-section');
                 if (commentsSection) {
                     const isHidden = commentsSection.style.display === 'none';
                     commentsSection.style.display = isHidden ? 'block' : 'none'; // Toggle visibility
                     if (isHidden) {
                          // If revealing, load/render comments
                          await renderComments(postId);
                          // Focus the comment textarea
                          const textarea = commentsSection.querySelector('.comment-form textarea');
                          if (textarea) textarea.focus();
                     }
                 }
             }


            // --- Handle Voting (Posts and Comments) ---
            if (target.classList.contains('vote-btn')) {
                if (!currentUser) { showPopup("Please log in to vote.", "error"); return; }

                target.disabled = true; // Prevent double-clicking temporarily
                const isUpvote = target.classList.contains('upvote-post') || target.classList.contains('upvote-comment');
                const isPostVote = target.classList.contains('upvote-post') || target.classList.contains('downvote-post');
                const isCommentVote = target.classList.contains('upvote-comment') || target.classList.contains('downvote-comment');

                const voteField = isUpvote ? 'upvotes' : 'downvotes';
                let docRef;
                let commentId = null;

                if (isPostVote) {
                    docRef = doc(db, "forumPosts", postId);
                } else if (isCommentVote) {
                    commentId = target.getAttribute('data-comment-id');
                    if (!commentId) { target.disabled = false; return; } // Safety check
                    docRef = doc(db, "forumPosts", postId, "comments", commentId);
                } else {
                    target.disabled = false; return; // Should not happen
                }

                try {
                    // Use Firestore transaction for potential future vote tracking (e.g., prevent double voting)
                    // For now, simple increment:
                    await updateDoc(docRef, { [voteField]: increment(1) });

                    // Update UI immediately (optimistic update)
                     const countMatch = target.textContent.match(/\d+$/); // Find number at the end
                     const currentCount = countMatch ? parseInt(countMatch[0], 10) : 0;
                     const icon = target.textContent.split(' ')[0]; // Get the icon (👍 or 👎)
                     target.textContent = `${icon} ${currentCount + 1}`;


                    // Consider fetching updated data for absolute accuracy, especially if implementing vote tracking later
                    // const updatedSnap = await getDoc(docRef);
                    // if (updatedSnap.exists()) { ... update UI from snapshot data ... }

                } catch (error) {
                    console.error("Voting error:", error);
                    showPopup("Error recording vote.", "error");
                     // Revert optimistic update on error (optional)
                     // target.textContent = `${icon} ${currentCount}`;
                } finally {
                    // Re-enable button after a short delay to prevent spamming
                     setTimeout(() => { target.disabled = false; }, 500);
                }
            }

            // --- Handle Post Pinning/Unpinning (Admin only) ---
            if (target.classList.contains('pin-btn') && currentUser?.email === 'admin@sgresolve.com') {
                const isPinned = target.getAttribute('data-pinned') === 'true';
                target.disabled = true;
                target.textContent = isPinned ? 'Unpinning...' : 'Pinning...';
                try {
                    await updateDoc(doc(db, "forumPosts", postId), { pinned: !isPinned });
                    showPopup(`Post ${isPinned ? 'unpinned' : 'pinned'} successfully.`, 'success');
                    await renderForumPosts(); // Re-render to reflect pinning order change
                } catch(error) {
                    console.error("Pinning error:", error);
                    showPopup("Error changing pin status.", "error");
                    // Reset button state on error
                     target.disabled = false;
                     target.textContent = isPinned ? 'Unpin' : 'Pin';
                     target.setAttribute('data-pinned', isPinned ? 'true' : 'false');
                }
                // No finally needed here as renderForumPosts will recreate the button state
            }

             // --- Handle Post Deletion (Admin or Author) ---
            if (target.classList.contains('delete-post-btn')) {
                 const postAuthorId = postElement.querySelector('.user-link')?.getAttribute('data-user'); // Get author ID from post data if stored
                 // Check permissions: Admin or the original author
                 if (currentUser && (currentUser.email === 'admin@sgresolve.com' || currentUser.uid === postAuthorId)) {
                     if (confirm(`Are you sure you want to delete this post: "${postElement.querySelector('h3')?.textContent}"? This will also delete all comments and cannot be undone.`)) {
                          target.disabled = true;
                          target.textContent = 'Deleting...';
                         try {
                             // TODO: Need a more robust way to delete subcollections (comments)
                             // Ideally, use a Cloud Function triggered on post deletion.
                             // Simple client-side deletion (less reliable for large comment numbers):
                             const commentsQuery = query(collection(db, "forumPosts", postId, "comments"));
                             const commentsSnapshot = await getDocs(commentsQuery);
                             const deletePromises = commentsSnapshot.docs.map(commentDoc => deleteDoc(commentDoc.ref));
                             await Promise.all(deletePromises);
                             console.log(`Deleted ${commentsSnapshot.size} comments for post ${postId}`);


                             // Delete the post itself
                             await deleteDoc(doc(db, "forumPosts", postId));


                             showPopup('Post and its comments deleted successfully.', 'success');
                             postElement.remove(); // Remove from UI
                             // Optional: Refresh trending posts if the deleted post was trending
                             // renderTrendingPosts(...)
                         } catch (error) {
                             console.error("Error deleting post:", error);
                             showPopup(`Failed to delete post: ${error.message}`, 'error');
                              target.disabled = false;
                              target.textContent = '🗑️ Delete';
                         }
                     }
                 } else {
                     showPopup("You do not have permission to delete this post.", "error");
                 }
             }


             // --- Handle Comment Deletion (Author only) ---
             if (target.classList.contains('delete-comment-btn')) {
                  const commentLi = target.closest('.comment-item');
                  const commentId = target.getAttribute('data-comment-id');
                 // We need to verify the author ID stored on the comment itself, not just rely on currentUser.uid
                 // Fetch the comment to check authorId - requires extra read but is safer
                 if (currentUser && commentId) {
                      if (confirm("Are you sure you want to delete this comment?")) {
                           target.disabled = true;
                           target.textContent = 'Deleting...';
                          try {
                              const commentRef = doc(db, "forumPosts", postId, "comments", commentId);
                               // Optional: Verify ownership before deleting
                               // const commentSnap = await getDoc(commentRef);
                               // if (commentSnap.exists() && commentSnap.data().authorId === currentUser.uid) {
                                   await deleteDoc(commentRef);
                                   showPopup("Comment deleted.", "success");
                                   if(commentLi) commentLi.remove(); // Remove from UI
                                   // Decrement comment count on post (best via Cloud Function)
                                   await updateDoc(doc(db, "forumPosts", postId), { commentCount: increment(-1) });
                                   // Update comment count button text
                                   const commentBtn = postElement.querySelector('.toggle-comments-btn');
                                   if (commentBtn) {
                                        const countMatch = commentBtn.textContent.match(/\((\d+)\)/);
                                        const currentCount = countMatch ? parseInt(countMatch[1], 10) : 0;
                                        if (currentCount > 0) {
                                             commentBtn.textContent = `💬 Comments (${currentCount - 1})`;
                                        } else {
                                            commentBtn.textContent = `💬 Comments (0)`;
                                        }
                                   }

                               // } else {
                               //    throw new Error("Permission denied or comment not found.");
                               // }
                          } catch (error) {
                               console.error("Error deleting comment:", error);
                               showPopup(`Failed to delete comment: ${error.message}`, "error");
                                target.disabled = false;
                                target.textContent = 'Delete';
                          }
                      }
                 } else if (!currentUser) {
                     showPopup("Please log in to delete comments.", "error");
                 }
            }


        }); // End forumPostsContainer click listener


        // --- Handle Comment Form Submission (Delegated from forumPostsContainer) ---
        forumPostsContainer?.addEventListener('submit', async (e) => {
            if (e.target.classList.contains('comment-form')) {
                e.preventDefault();
                if (!currentUser) {
                    showPopup("Please log in to comment.", "error");
                    showPage(pages.login);
                    return;
                }

                const postElement = e.target.closest('.forum-post');
                const postId = postElement?.getAttribute('data-post-id');
                const textarea = e.target.querySelector('textarea');
                const submitButton = e.target.querySelector('button[type="submit"]');
                const content = textarea?.value.trim();

                if (!postId || !textarea || !content || !submitButton) {
                     console.error("Comment form elements missing.");
                     return; // Should not happen
                 }

                submitButton.disabled = true;
                submitButton.textContent = 'Posting...';

                try {
                    // Add the comment to the subcollection
                    await addDoc(collection(db, "forumPosts", postId, "comments"), {
                        content,
                        author: currentUser.displayName || 'Anonymous',
                        authorId: currentUser.uid,
                        timestamp: new Date(),
                        upvotes: 0,
                        downvotes: 0
                    });

                    textarea.value = ''; // Clear the textarea

                     // Increment comment count on the post document (ideally use Cloud Functions)
                     try {
                        await updateDoc(doc(db, "forumPosts", postId), { commentCount: increment(1) });
                        // Update the comment count button immediately
                         const commentBtn = postElement.querySelector('.toggle-comments-btn');
                         if (commentBtn) {
                             const countMatch = commentBtn.textContent.match(/\((\d+)\)/);
                             const currentCount = countMatch ? parseInt(countMatch[1], 10) : 0;
                             commentBtn.textContent = `💬 Comments (${currentCount + 1})`;
                         }
                     } catch (countError) {
                         console.error("Error incrementing comment count:", countError);
                     }


                    // Refresh the comments list for this specific post
                    await renderComments(postId);

                    // Optional: Notify post owner (more complex, requires Cloud Functions)
                    // notifyPostOwner(postId, currentUser.displayName);

                } catch (error) {
                    console.error('Error adding comment:', error);
                    showPopup(`Failed to post comment: ${error.message}`, 'error');
                } finally {
                     // Re-enable the submit button
                     submitButton.disabled = false;
                     submitButton.textContent = 'Comment';
                }
            }
        }); // End comment form submission listener


         // --- Forum Search Input ---
        const searchInput = forumContainer.querySelector('.search-input');
        let searchTimeout; // To debounce search requests

        searchInput?.addEventListener('input', () => {
            clearTimeout(searchTimeout); // Clear previous timeout
            const searchTerm = searchInput.value.trim().toLowerCase();
            const forumPostsContainer = document.getElementById('forum-posts');
            const loadMoreButton = document.getElementById('load-more-posts'); // Find load more button


            if (!forumPostsContainer) return;

             // Hide load more button during search
             if (loadMoreButton) loadMoreButton.style.display = 'none';


            if (!searchTerm) {
                // If search is cleared, render initial posts and show load more button
                renderForumPosts(); // Renders the first page
                if (loadMoreButton) loadMoreButton.style.display = 'block'; // Ensure it's visible again
                return;
            }


            // Debounce: Wait 500ms after user stops typing before searching
            searchTimeout = setTimeout(async () => {
                forumPostsContainer.innerHTML = '<p class="loading-message">Searching...</p>';

                try {
                    // --- Client-Side Search (Inefficient for large datasets) ---
                    // For production, implement server-side search (e.g., Algolia, Firestore Extensions)
                    const postsQuery = query(collection(db, "forumPosts"), orderBy("timestamp", "desc")); // Fetch all (or limited subset)
                    const querySnapshot = await getDocs(postsQuery);
                    const matchingPosts = [];

                    querySnapshot.forEach((doc) => {
                        const post = { id: doc.id, ...doc.data() };
                        // Search in title, content, and author name
                        if (
                            (post.title && post.title.toLowerCase().includes(searchTerm)) ||
                            (post.content && post.content.toLowerCase().includes(searchTerm)) ||
                            (post.author && post.author.toLowerCase().includes(searchTerm))
                        ) {
                            matchingPosts.push(post);
                        }
                    });
                     // --- End Client-Side Search ---


                    forumPostsContainer.innerHTML = ''; // Clear searching message
                    if (matchingPosts.length === 0) {
                        forumPostsContainer.innerHTML = '<p class="no-data-message">No posts found matching your search term.</p>';
                    } else {
                        // Get comment counts for matched posts
                         const postPromises = matchingPosts.map(async (post) => {
                            try {
                                const commentsSnap = await getDocs(collection(db, "forumPosts", post.id, "comments"));
                                post.commentCount = commentsSnap.size;
                            } catch { post.commentCount = 0; }
                            return post;
                        });
                        const postsWithCounts = await Promise.all(postPromises);

                         postsWithCounts.forEach(post => {
                            const postElement = createPostElement(post);
                            forumPostsContainer.appendChild(postElement);
                            // Don't auto-load comments on search results
                        });
                    }
                } catch (error) {
                    console.error('Error searching posts:', error);
                    forumPostsContainer.innerHTML = '<p class="error-message">Error performing search.</p>';
                    showPopup("Search failed.", "error");
                }
            }, 500); // 500ms delay
        });


    } // --- End of forumContainer event listeners check ---


    // --- Nearby Reports Page ---
    document.getElementById('load-nearby-reports')?.addEventListener('click', displayNearbyReports);


    // --- Chatbot ---
    document.getElementById('chat-icon')?.addEventListener('click', toggleChat);
    document.querySelector('.send-button')?.addEventListener('click', sendChatMessage);
    // Allow sending message with Enter key
    document.getElementById('user-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { // Send on Enter, allow Shift+Enter for newline
            e.preventDefault(); // Prevent default newline insertion
            sendChatMessage();
        }
    });


     // --- Popup Close Button ---
     document.getElementById('popup-close')?.addEventListener('click', () => {
        const popupOverlay = document.getElementById('popup-overlay');
        if (popupOverlay) popupOverlay.style.display = 'none';
    });

    // --- Popup Close with Escape Key ---
    document.addEventListener('keydown', (e) => {
        const popupOverlay = document.getElementById('popup-overlay');
        // Check if popup is visible before closing
        if (e.key === 'Escape' && popupOverlay?.style.display === 'flex') {
            popupOverlay.style.display = 'none';
        }
    });


    // --- Initial Setup ---
    hideAllPages(); // Hide all pages initially
    // The onAuthStateChanged listener handles showing the correct initial page (landing or user/admin)

}); // --- End DOMContentLoaded ---
