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
    increment 
} from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAgBUaMIawsOqMbLpju2mrd6kMaranT2rI",
  authDomain: "sgresolve-login-register.firebaseapp.com",
  projectId: "sgresolve-login-register",
  storageBucket: "sgresolve-login-register.firebasestorage.app",
  messagingSenderId: "564104431729",
  appId: "1:564104431729:web:57557b54673a8c18d973d0",
  measurementId: "G-R3QDN8V84C"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
    let reportingMap = L.map('map').setView([1.3521, 103.8198], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(reportingMap);

    let adminMap = L.map('admin-map').setView([1.3521, 103.8198], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(adminMap);

    // Global Variables
    let tempMarker;
    let adminReportMarkers = []; // Renamed for clarity
    let imageDataUrl = null; // For previewing before upload
    let currentUser = null;
    // Forum related globals
    let forumPosts = []; // Might not be needed if always fetching
    let lastVisiblePost = null; // For pagination
    let isLoadingForumPosts = false; // Prevent multiple loads
    // Nearby reports related globals
    let nearbyMap = null; // To hold the Leaflet map instance for this page
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

        // Invalidate map size when specific pages are shown
        if (page === pages.reporting && reportingMap) reportingMap.invalidateSize();
        else if (page === pages.admin && adminMap) {
            adminMap.invalidateSize();
            renderAdminReports(); // Renders the list and map
            renderAdminAnalytics(); // Renders the charts and stats
        } else if (page === pages.nearbyReports) {
            initializeNearbyMap(); // Make sure map is initialized
            if (nearbyMap) nearbyMap.invalidateSize(); // Adjust map size
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

      if (!popupOverlay || !popupMessage || !popupIcon || !popup) return; // Safety check

      popupMessage.textContent = message;
      popup.className = `popup ${type}`;

      switch (type) {
        case 'success': popupIcon.innerHTML = '✅'; break;
        case 'error': popupIcon.innerHTML = '❌'; break;
        case 'info': popupIcon.innerHTML = 'ℹ️'; break;
        default: popupIcon.innerHTML = '';
      }

      popupOverlay.style.display = 'flex';
      popup.setAttribute('role', 'alert');
      popup.setAttribute('tabindex', '-1');
      popup.focus();

      if (autoClose) {
        setTimeout(() => {
          popupOverlay.style.display = 'none';
        }, 3000);
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
                reportsQuery = query(reportsCollection, where("userId", "==", userId), orderBy("timestamp", "desc"));
            } else {
                 // Fetch all reports, ordered by timestamp descending
                 reportsQuery = query(reportsCollection, orderBy("timestamp", "desc"));
            }

            const querySnapshot = await getDocs(reportsQuery);
            const reports = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                reports.push({
                    id: doc.id,
                    ...data,
                    latitude: parseFloat(data.latitude),
                    longitude: parseFloat(data.longitude),
                    timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date() // Convert timestamp
                 });
            });
            return reports;
        } catch (error) {
            console.error('Error fetching reports:', error);
            showPopup(`Error fetching reports: ${error.message}`, 'error');
            throw error;
        }
    }

    // Fetches reports specifically for the current month
    async function fetchReportsThisMonth() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

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
            return [];
        }
    }

     // Applies filters based on dropdown selections
     function applyFilters(allReports) {
        const imageFilter = document.getElementById('image-filter')?.value || 'all';
        const categoryFilter = document.getElementById('category-filter')?.value || 'all';
        const urgencyFilter = document.getElementById('urgency-filter')?.value || 'all';
        const threatFilter = document.getElementById('threat-filter')?.value || 'all';

        let filteredReports = allReports.slice(); // Start with all reports

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

        // Add new markers
        reportsToDisplay.forEach(report => {
             if (report.latitude && report.longitude) { // Check for valid coords
                const marker = L.marker([report.latitude, report.longitude]).addTo(adminMap);
                let popupContent = `
                    <strong>${report.locationName || 'N/A'}</strong><br>
                    Category: ${report.category}<br>
                    Status: ${report.status}<br>
                    Urgency: <span class="urgency-${report.urgency.toLowerCase()}">${report.urgency}</span><br>
                    Threat: <span class="threat-${report.threat.toLowerCase()}">${report.threat}</span>
                `;
                if (report.imageUrl) {
                    popupContent += `<br><img src="${report.imageUrl}" alt="Report Image" style="max-width: 150px; height: auto; margin-top: 5px;">`;
                }
                marker.bindPopup(popupContent);
                adminReportMarkers.push(marker);
             }
        });

         // Fit map bounds if there are markers
        if (adminReportMarkers.length > 0) {
             const group = new L.featureGroup(adminReportMarkers);
             adminMap.fitBounds(group.getBounds().pad(0.1));
        } else {
            adminMap.setView([1.3521, 103.8198], 11); // Reset view if no valid markers
        }
    }

    // Renders the list of reports in the Admin Dashboard
    async function renderAdminReports() {
        const adminReportsContainer = document.getElementById('admin-reports-container');
        if (!adminReportsContainer) return;
        adminReportsContainer.innerHTML = '<p>Loading reports...</p>';

        try {
            const allReports = await fetchReports(); // Get all reports
            const filteredReports = applyFilters(allReports); // Apply current filters

            adminReportsContainer.innerHTML = ''; // Clear loading message

            if (filteredReports.length === 0) {
                adminReportsContainer.innerHTML = '<p>No reports match the current filters.</p>';
                renderAdminMap([]); // Clear map
                return;
            }

            filteredReports.forEach(report => {
                const li = document.createElement('li');
                li.setAttribute('data-report-id', report.id);
                // Add classes based on urgency/threat for potential future styling
                li.classList.add(`urgency-${report.urgency?.toLowerCase()}`, `threat-${report.threat?.toLowerCase()}`);

                li.innerHTML = `
                    <div class="report-content">
                         <h3>${report.locationName || 'Unknown Location'}</h3>
                         <p><strong>Category:</strong> ${report.category || 'N/A'}</p>
                         <p><strong>Description:</strong> ${report.description || 'No description.'}</p>
                         <p><strong>Submitted:</strong> ${report.timestamp ? report.timestamp.toLocaleDateString() : 'N/A'}</p>
                         ${report.imageUrl ? `<img src="${report.imageUrl}" alt="Report Image" class="report-image">` : '<p><em>No image submitted.</em></p>'}
                    </div>
                    <div class="report-meta">
                        <span class="category">${report.category || 'N/A'}</span>
                        <span class="urgency urgency-${report.urgency?.toLowerCase()}">${report.urgency || 'N/A'}</span>
                        <span class="threat threat-${report.threat?.toLowerCase()}">${report.threat || 'N/A'}</span>
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
            adminReportsContainer.innerHTML = '<p>Error loading reports. Please try again later.</p>';
            renderAdminMap([]); // Clear map on error
        }
    }


    // Renders the user's submitted reports
    async function renderUserReports() {
        if (!currentUser) return;
        const userReportsContainer = document.getElementById('user-reports-container');
        if (!userReportsContainer) return;
        userReportsContainer.innerHTML = '<p>Loading your reports...</p>';

        try {
            const userReports = await fetchReports(currentUser.uid);
            userReportsContainer.innerHTML = '';
            if (userReports.length === 0) {
                userReportsContainer.innerHTML = '<p>You haven\'t submitted any reports yet.</p>';
                return;
            }
            userReports.forEach(report => {
                const li = document.createElement('li');
                li.setAttribute('data-report-id', report.id);
                li.innerHTML = `
                    <h3>${report.locationName || 'Unknown Location'}</h3>
                    <p><strong>Category:</strong> ${report.category || 'N/A'}</p>
                    <p><strong>Description:</strong> ${report.description || 'N/A'}</p>
                    <p><strong>Urgency:</strong> ${report.urgency || 'N/A'}</p>
                    <p><strong>Threat:</strong> ${report.threat || 'N/A'}</p>
                    <p><strong>Status:</strong> ${report.status || 'N/A'}</p>
                    <p><strong>Submitted:</strong> ${report.timestamp ? report.timestamp.toLocaleDateString() : 'N/A'}</p>
                    ${report.imageUrl ? `<img src="${report.imageUrl}" alt="Report Image" style="max-width: 200px; height: auto; margin-top: 10px; border-radius: 5px;">` : ''}
                `;
                userReportsContainer.appendChild(li);
            });
        } catch (error) {
            userReportsContainer.innerHTML = '<p>Error loading your reports. Please try again later.</p>';
        }
    }

    // Renders the Admin Analytics section
    async function renderAdminAnalytics() {
        try {
            // Fetch ALL reports for overall stats
            const allReports = await fetchReports();
            const totalReportsCount = allReports.length;

            // Fetch reports for THIS MONTH for the category chart
            const reportsThisMonth = await fetchReportsThisMonth();
            const totalReportsMonthCount = reportsThisMonth.length;

            // Process Data
            const statusCounts = { 'Pending': 0, 'In Progress': 0, 'Resolved': 0 };
            const urgencyCounts = { 'Low': 0, 'Medium': 0, 'High': 0 };
            const categoryCountsMonth = {};

            allReports.forEach(report => {
                if (statusCounts.hasOwnProperty(report.status)) statusCounts[report.status]++;
                if (urgencyCounts.hasOwnProperty(report.urgency)) urgencyCounts[report.urgency]++;
            });

            reportsThisMonth.forEach(report => {
                const category = report.category;
                categoryCountsMonth[category] = (categoryCountsMonth[category] || 0) + 1;
            });

            // Update Stat Cards
            document.getElementById('stat-total-reports').textContent = totalReportsCount;
            document.getElementById('stat-pending-reports').textContent = statusCounts['Pending'];
            document.getElementById('stat-resolved-reports').textContent = statusCounts['Resolved'];
            document.getElementById('total-reports-month').textContent = `Total this month: ${totalReportsMonthCount}`;

            // Helper to destroy chart if exists
            const destroyChart = (instance) => { if (instance) instance.destroy(); };

            // Status Chart (Doughnut)
            const statusCtx = document.getElementById('status-chart')?.getContext('2d');
            const statusDataAvailable = Object.values(statusCounts).some(count => count > 0);
            document.getElementById('status-chart').style.display = statusDataAvailable ? 'block' : 'none';
            document.getElementById('no-status-data').style.display = statusDataAvailable ? 'none' : 'block';
            destroyChart(statusChartInstance);
            if (statusCtx && statusDataAvailable) {
                statusChartInstance = new Chart(statusCtx, {
                    type: 'doughnut', data: { labels: Object.keys(statusCounts), datasets: [{ data: Object.values(statusCounts), backgroundColor: Object.keys(statusCounts).map(status => STATUS_COLORS[status]), borderColor: '#fff', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, title: { display: false } } }
                });
            }

            // Urgency Chart (Bar)
            const urgencyCtx = document.getElementById('urgency-chart')?.getContext('2d');
            const urgencyDataAvailable = Object.values(urgencyCounts).some(count => count > 0);
            document.getElementById('urgency-chart').style.display = urgencyDataAvailable ? 'block' : 'none';
            document.getElementById('no-urgency-data').style.display = urgencyDataAvailable ? 'none' : 'block';
            destroyChart(urgencyChartInstance);
            if (urgencyCtx && urgencyDataAvailable) {
                urgencyChartInstance = new Chart(urgencyCtx, {
                    type: 'bar', data: { labels: Object.keys(urgencyCounts), datasets: [{ data: Object.values(urgencyCounts), backgroundColor: Object.keys(urgencyCounts).map(urg => URGENCY_COLORS[urg]), borderColor: Object.keys(urgencyCounts).map(urg => URGENCY_COLORS[urg].replace('0.7', '1')), borderWidth: 1 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { beginAtZero: true, title: { display: true, text: '# Reports' } } }, plugins: { legend: { display: false }, title: { display: false } } }
                });
            }

            // Category Chart (Monthly - Bar)
            const categoryCtx = document.getElementById('reports-chart')?.getContext('2d'); // Original ID
            const categoryDataAvailable = totalReportsMonthCount > 0;
            document.getElementById('reports-chart').style.display = categoryDataAvailable ? 'block' : 'none';
            document.getElementById('no-reports-message').style.display = categoryDataAvailable ? 'none' : 'block';
            destroyChart(categoryChartInstance);
            if (categoryCtx && categoryDataAvailable) {
                const allCategories = ['Infrastructure', 'Environmental', 'Safety', 'Others'];
                categoryChartInstance = new Chart(categoryCtx, {
                    type: 'bar', data: { labels: allCategories, datasets: [{ data: allCategories.map(cat => categoryCountsMonth[cat] || 0), backgroundColor: allCategories.map(cat => CATEGORY_COLORS_MONTHLY[cat]), borderColor: allCategories.map(cat => CATEGORY_COLORS_MONTHLY[cat].replace('0.7', '1')), borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: '# Reports' } }, x: { title: { display: true, text: 'Categories' } } }, plugins: { legend: { display: false }, title: { display: false } } }
                });
                window.reportsChart = categoryChartInstance; // Keep global reference if needed
            } else {
                 window.reportsChart = null;
            }

        } catch (error) {
            console.error("Error rendering admin analytics:", error);
            showPopup("Error loading analytics data.", "error", false); // Keep error visible
        }
    }


    // --- Forum Functions ---

    function formatRichText(text) {
        if (!text) return '';
        return text
          .replace(/</g, "<") // Basic XSS prevention
          .replace(/>/g, ">")
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
          .replace(/\*(.*?)\*/g, '<em>$1</em>')       // Italic
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'); // Links
      }

    function getCategoryColor(category) {
        const colors = { General: '#4facfe', Issues: '#ff6b6b', Ideas: '#2ea44f', Events: '#f4a261' };
        return colors[category] || '#586069';
    }

    async function renderComments(postId) {
      // Find the comments list within the specific post div that should NOW be in the DOM
      const commentsList = document.querySelector(`.forum-post[data-post-id="${postId}"] .comments-list`);
      if (!commentsList) {
          // Add a check/warning in case it's still not found for some reason
          console.warn(`Comments list element not found for post ${postId} during renderComments.`);
          return;
      }
      commentsList.innerHTML = '<li>Loading comments...</li>';
      try {
        const commentsQuery = query(collection(db, "forumPosts", postId, "comments"), orderBy("timestamp", "asc"));
        const querySnapshot = await getDocs(commentsQuery);
        commentsList.innerHTML = ''; // Clear loading/previous
        if (querySnapshot.empty) {
          commentsList.innerHTML = '<li>No comments yet.</li>';
          return;
        }
        querySnapshot.forEach((doc) => {
          const comment = doc.data();
          const li = document.createElement('li');
          li.innerHTML = `
            <p>${formatRichText(comment.content)}</p>
            <small>By ${comment.author || 'Anonymous'} on ${new Date(comment.timestamp?.toDate()).toLocaleDateString()}</small>
            <div class="comment-actions">
                <button class="vote-btn upvote-comment" data-comment-id="${doc.id}" data-post-id="${postId}">👍 ${comment.upvotes || 0}</button>
                <button class="vote-btn downvote-comment" data-comment-id="${doc.id}" data-post-id="${postId}">👎 ${comment.downvotes || 0}</button>
            </div>
          `;
          commentsList.appendChild(li);
        });
      } catch (error) {
        console.error(`Error fetching comments for post ${postId}:`, error);
        commentsList.innerHTML = '<li>Error loading comments.</li>';
      }
  }
  
  function createPostElement(post) {
      const postDiv = document.createElement('div');
      postDiv.classList.add('forum-post');
      if (post.pinned) postDiv.classList.add('pinned');
      postDiv.setAttribute('data-post-id', post.id);
      postDiv.innerHTML = `
          <div class="post-header">
              <span class="post-author">${post.pinned ? '📌 ' : ''}<a href="#" class="user-link" data-user="${post.author}">${post.author || 'Anonymous'}</a></span>
              <span class="post-meta"> • ${new Date(post.timestamp?.toDate()).toLocaleDateString()} •
                  <span class="post-category" style="background-color: ${getCategoryColor(post.category)}">${post.category}</span>
              </span>
          </div>
          <h3>${post.title || 'Untitled Post'}</h3>
          <p>${formatRichText(post.content)}</p>
          <div class="post-actions">
              <button class="vote-btn upvote-post" data-post-id="${post.id}">👍 ${post.upvotes || 0}</button>
              <button class="vote-btn downvote-post" data-post-id="${post.id}">👎 ${post.downvotes || 0}</button>
              ${currentUser && currentUser.email === 'admin@sgresolve.com' ? `
                  <button class="pin-btn" data-post-id="${post.id}" data-pinned="${post.pinned ? 'true' : 'false'}">
                      ${post.pinned ? 'Unpin' : 'Pin'}
                  </button>` : ''}
           </div>
           <div class="comments-section">
               <h4>Comments</h4>
               <ul class="comments-list"></ul> <!-- Placeholder for comments -->
               <form class="comment-form">
                  <textarea placeholder="Add a comment..." required></textarea>
                  <button type="submit" class="button primary-button">Comment</button>
               </form>
          </div>
      `;
      // REMOVED from here: renderComments(post.id); // Don't call it yet!
      return postDiv; // Return the created element
  }
  
  async function renderForumPosts(loadMore = false) {
      const forumPostsContainer = document.getElementById('forum-posts');
      if (!forumPostsContainer) return;
  
      if (!loadMore) {
          forumPostsContainer.innerHTML = '<p>Loading posts...</p>';
          lastVisiblePost = null; // Reset pagination
      }
      isLoadingForumPosts = true;
  
      try {
          let postsQuery;
          const baseQuery = query(collection(db, "forumPosts"), orderBy("pinned", "desc"), orderBy("timestamp", "desc"));
  
          if (loadMore && lastVisiblePost) {
              postsQuery = query(baseQuery, startAfter(lastVisiblePost), limit(10));
          } else {
              postsQuery = query(baseQuery, limit(10));
          }
  
          const querySnapshot = await getDocs(postsQuery);
  
          if (!loadMore) forumPostsContainer.innerHTML = ''; // Clear loading/previous
  
          if (querySnapshot.empty && !loadMore) {
              forumPostsContainer.innerHTML = '<p>No posts yet. Be the first to post!</p>';
          } else {
              querySnapshot.forEach((doc) => {
                  const post = { id: doc.id, ...doc.data() };
                  const postElement = createPostElement(post);   // 1. Create the element
                  forumPostsContainer.appendChild(postElement); // 2. Append it to the DOM
                  renderComments(post.id);                      // 3. NOW render its comments
              });
              lastVisiblePost = querySnapshot.docs[querySnapshot.docs.length - 1];
              if (querySnapshot.empty && loadMore) {
                   const noMoreMsg = document.createElement('p');
                   noMoreMsg.textContent = "No more posts to load.";
                   noMoreMsg.style.textAlign = 'center';
                   noMoreMsg.style.color = 'var(--muted-color)';
                   forumPostsContainer.appendChild(noMoreMsg);
              }
          }
          // Fetch and render trending posts (remains the same)
          const allPostsSnapshot = await getDocs(query(collection(db, "forumPosts"), orderBy("timestamp", "desc")));
          const allPosts = [];
          allPostsSnapshot.forEach(doc => allPosts.push({ id: doc.id, ...doc.data() }));
          renderTrendingPosts(allPosts);
  
      } catch (error) {
          console.error('Error fetching forum posts:', error);
          if (!loadMore) forumPostsContainer.innerHTML = '<p>Error loading posts. Please try again later.</p>';
          showPopup("Error loading forum posts.", "error");
      } finally {
          isLoadingForumPosts = false;
      }
  }
  

    function renderTrendingPosts(posts) {
        const trendingContainer = document.getElementById('trending-container');
        if (!trendingContainer) return;
        trendingContainer.innerHTML = '';
        const trending = posts
          .sort((a, b) => ((b.upvotes || 0) - (b.downvotes || 0)) - ((a.upvotes || 0) - (a.downvotes || 0))) // Sort by net score
          .slice(0, 3); // Top 3

        if (trending.length === 0) {
            trendingContainer.innerHTML = '<p>No trending posts yet.</p>';
            return;
        }

        trending.forEach(post => {
          const postDiv = document.createElement('div');
          postDiv.classList.add('trending-post');
          postDiv.innerHTML = `
            <h3>${post.title || 'Untitled'}</h3>
            <p><small>By ${post.author || 'Anonymous'} • ${ (post.upvotes || 0) - (post.downvotes || 0)} Score</small></p>
          `;
          // Make trending posts clickable (optional)
          postDiv.addEventListener('click', () => {
            const targetPostElement = document.querySelector(`.forum-post[data-post-id="${post.id}"]`);
            if (targetPostElement) {
                targetPostElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetPostElement.style.outline = '2px solid var(--accent-color)'; // Highlight briefly
                setTimeout(() => { targetPostElement.style.outline = 'none'; }, 1500);
            } else {
                 showPopup("Post might not be loaded yet.", "info");
            }
          });
          trendingContainer.appendChild(postDiv);
        });
      }

    // --- Nearby Reports Functions ---

    function initializeNearbyMap() {
      if (!nearbyMap && document.getElementById('nearby-map')) { // Initialize only once and if element exists
          nearbyMap = L.map('nearby-map').setView([1.3521, 103.8198], 11);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors'
          }).addTo(nearbyMap);
      }
    }

    function getDeviceLocation() {
      return new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
              reject(new Error("Geolocation is not supported."));
          } else {
              navigator.geolocation.getCurrentPosition(
                  (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
                  (error) => reject(new Error(`Geolocation error: ${error.message} (Code: ${error.code})`))
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
      const distanceText = distance < 1000 ? `${Math.round(distance)} m away` : `${(distance / 1000).toFixed(1)} km away`;
      li.innerHTML = `
          <p><strong>Location:</strong> ${report.locationName || 'N/A'}</p>
          <p><strong>Category:</strong> ${report.category || 'N/A'}</p>
          <p><strong>Status:</strong> ${report.status || 'N/A'}</p>
          <p class="report-distance">${distanceText}</p>
          ${report.imageUrl ? `<img src="${report.imageUrl}" alt="Report Image" style="max-width: 100px; height: auto; margin-top: 5px; border-radius: 4px;">` : ''}
      `;
      // Add click listener to focus map on the report
      li.addEventListener('click', () => {
        if (nearbyMap && report.latitude && report.longitude) {
            nearbyMap.setView([report.latitude, report.longitude], 15); // Zoom in
            // Optional: Find and open the corresponding marker popup
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

      if (!locationSelector || !radiusSelector || !container || !statusDiv || !nearbyMap) {
        console.error("Nearby reports elements not found.");
        return;
      }

      const selectedLocationType = locationSelector.value;
      const selectedRadius = parseInt(radiusSelector.value, 10);

      container.innerHTML = '';
      statusDiv.textContent = 'Loading...';
      clearNearbyMapMarkers();

      let centerCoords;
      let centerName = "Selected Area";
      let userMarker = null; // To hold the user location marker

      try {
          if (selectedLocationType === 'current') {
              statusDiv.textContent = 'Getting your current location...';
              centerCoords = await getDeviceLocation();
              centerName = "Your Location";
              // Add user marker
              userMarker = L.marker([centerCoords.lat, centerCoords.lon], {
                 icon: L.icon({ // Custom user icon
                    iconUrl: 'images/user-location-marker.png', // Provide a path to a user marker image
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                    popupAnchor: [0, -15]
                 })
              }).addTo(nearbyMap);
              userMarker.bindPopup("Your Current Location");
              nearbyMarkers.push(userMarker); // Add to markers array
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
              if (report.latitude && report.longitude) {
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
              container.innerHTML = '<p>No nearby reports found.</p>';
               if (userMarker) {
                   nearbyMap.setView(centerLatLng, 13); // Center on user if no reports
               } else {
                  nearbyMap.setView([centerCoords.lat, centerCoords.lon], 13); // Center on predefined loc
               }

          } else {
              statusDiv.textContent = `Showing ${nearbyReports.length} reports near ${centerName}.`;
              nearbyReports.forEach(report => {
                  container.appendChild(renderNearbyReportItem(report, report.distance));
                  // Add report marker
                  const marker = L.marker([report.latitude, report.longitude]).addTo(nearbyMap);
                  marker.bindPopup(`
                      <strong>${report.locationName}</strong><br>
                      (${report.category}) - ${report.status}<br>
                      ~${report.distance < 1000 ? Math.round(report.distance) + 'm' : (report.distance / 1000).toFixed(1) + 'km'} away
                  `);
                  nearbyMarkers.push(marker);
              });

              // Fit map to show all markers (including user marker if present)
              const group = new L.featureGroup(nearbyMarkers);
              nearbyMap.fitBounds(group.getBounds().pad(0.1));
          }

      } catch (error) {
          console.error("Error loading nearby reports:", error);
          statusDiv.textContent = `Error: ${error.message}`;
          container.innerHTML = '<p>Could not load nearby reports.</p>';
          showPopup(`Could not load nearby reports: ${error.message}`, "error");
      }
    }

    // --- Chatbot Functions ---
    function toggleChat() {
        const chatContainer = document.getElementById('chat-container');
        chatContainer?.classList.toggle('active');
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
        userMsgDiv.innerHTML = `<strong>You:</strong> ${userInput}`; // No need for formatRichText on user input
        chatBox.appendChild(userMsgDiv);
        userInputElement.value = ""; // Clear input
        chatBox.scrollTop = chatBox.scrollHeight; // Scroll down

        try {
            const response = await fetch("https://chatbot-server-production-da96.up.railway.app/chat", { // Ensure this URL is correct
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userInput })
            });

            if (!response.ok) {
                throw new Error(`Chatbot API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Display bot response
            const botMsgDiv = document.createElement('div');
            botMsgDiv.classList.add('message', 'bot');
            botMsgDiv.innerHTML = `<strong>SGResolve Bot:</strong> ${formatRichText(data.response || "Sorry, I couldn't process that.")}`; // Format bot response
            chatBox.appendChild(botMsgDiv);

        } catch (error) {
            console.error("Chatbot error:", error);
             // Display error message in chat
             const errorMsgDiv = document.createElement('div');
             errorMsgDiv.classList.add('message', 'bot', 'error'); // Add error class for styling if needed
             errorMsgDiv.innerHTML = `<strong>SGResolve Bot:</strong> Sorry, I encountered an error. Please try again later.`;
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
        if (sections.length === 0) return; // Only run if sections exist

        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              // Optional: unobserve after first view to prevent re-animation
              // observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.1 }); // Trigger when 10% is visible

        sections.forEach(section => {
          observer.observe(section);
        });
      }


    // --- Auth State Change Listener ---
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        updateNavbar();
        hideAllPages(); // Hide all first
        if (user) {
            if (user.email === 'admin@sgresolve.com') {
                showPage(pages.admin); // This calls renderAdminReports and renderAdminAnalytics internally
            } else {
                showPage(pages.reporting); // Show reporting page for regular users
            }
        } else {
            showPage(pages.landing); // Show landing page if not logged in
        }
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
            renderUserReports(); // Render after showing page
        } else { showPage(pages.login); }
    });
    document.getElementById('nav-nearby-reports')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentUser) {
            showPage(pages.nearbyReports);
        } else { showPage(pages.login); }
    });
    document.getElementById('nav-community')?.addEventListener('click', (e) => {
        e.preventDefault();
        showPage(pages.community);
        renderForumPosts(); // Initial render
    });
    document.getElementById('nav-about')?.addEventListener('click', (e) => {
        e.preventDefault();
        showPage(pages.about);
    });
    document.getElementById('nav-logout')?.addEventListener('click', (e) => {
        e.preventDefault();
        signOut(auth).catch(error => console.error("Logout error:", error));
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
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();
        signInWithEmailAndPassword(auth, email, password)
          .then(() => { showPopup('Logged in successfully!', 'success'); })
          .catch((error) => {
            let message = `Login failed: ${error.code}`; // Provide code for debugging
            showPopup(message, 'error');
          });
    });

    // Registration Form
    document.getElementById('register-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value.trim();
        if (!name) {
            showPopup("Please enter your name.", "error");
            return;
        }
        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => updateProfile(userCredential.user, { displayName: name }))
            .then(() => { showPopup('Registered successfully!', 'success'); })
            .catch((error) => {
                let message = `Registration failed: ${error.code}`;
                if (error.code === 'auth/weak-password') message = 'Password should be at least 6 characters.';
                if (error.code === 'auth/email-already-in-use') message = 'Email already registered.';
                showPopup(message, 'error');
            });
    });

    // Admin Logout
    document.getElementById('logout-admin')?.addEventListener('click', (e) => {
        e.preventDefault();
        signOut(auth).catch(error => console.error("Admin logout error:", error));
    });

    // Reporting Page Map Interaction
    if (reportingMap) {
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

    // Reporting Page - Detect Location Button
    document.getElementById('detectLocation')?.addEventListener('click', function() {
        getDeviceLocation()
            .then(coords => {
                 const latLng = L.latLng(coords.lat, coords.lon);
                if (!singaporeLatLngBounds.contains(latLng)) {
                     showPopup('Your current location appears outside Singapore.', 'error');
                     return;
                 }
                if (tempMarker) reportingMap.removeLayer(tempMarker);
                tempMarker = L.marker(latLng).addTo(reportingMap);
                document.getElementById('latitude').value = coords.lat.toFixed(6);
                document.getElementById('longitude').value = coords.lon.toFixed(6);
                reportingMap.setView(latLng, 15); // Zoom in closer
            })
            .catch(error => {
                showPopup(error.message, 'error');
            });
    });

    // Reporting Page - Image Upload Preview
    const imageUpload = document.getElementById('imageUpload');
    const imagePreview = document.getElementById('imagePreview');
    imageUpload?.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                imageDataUrl = e.target.result; // Store base64 for potential upload
                if (imagePreview) imagePreview.innerHTML = `<img src="${imageDataUrl}" alt="Image Preview">`;
            };
            reader.readAsDataURL(file);
        } else {
            imageDataUrl = null;
            if (imagePreview) imagePreview.innerHTML = '';
        }
    });

    // Reporting Page - Auto Detect Feature
    const autoDetectButton = document.getElementById('autoDetect');
    const problemDescInput = document.getElementById('problemDesc');
    problemDescInput?.addEventListener('input', () => {
        if (autoDetectButton) autoDetectButton.disabled = !problemDescInput.value.trim();
    });

    autoDetectButton?.addEventListener('click', async () => {
        const description = problemDescInput.value.trim();
        const reportErrorDiv = document.getElementById('report-error');
        const categorySelect = document.getElementById('category');
        const urgencySelect = document.getElementById('urgency');
        const threatSelect = document.getElementById('threat');

        if (!description) {
            if (reportErrorDiv) reportErrorDiv.textContent = 'Please enter a description first.';
            return;
        }
        if (!categorySelect || !urgencySelect || !threatSelect || !reportErrorDiv) return; // Elements missing

        reportErrorDiv.textContent = '';
        autoDetectButton.disabled = true;
        autoDetectButton.textContent = 'Detecting...';

        try {
            const response = await fetch('https://auto-detect-model-production.up.railway.app/predict', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: description })
            });
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const data = await response.json();
            // Set values ONLY if they exist in the dropdown options
            if ([...categorySelect.options].some(opt => opt.value === data.category)) categorySelect.value = data.category;
            if ([...urgencySelect.options].some(opt => opt.value === data.urgency)) urgencySelect.value = data.urgency;
            if ([...threatSelect.options].some(opt => opt.value === data.threat)) threatSelect.value = data.threat;
            showPopup("AI detection complete!", "success");
        } catch (error) {
            console.error('Auto Detect Error:', error);
            reportErrorDiv.textContent = 'Auto detect failed. Please select manually.';
            showPopup('Auto detect failed.', 'error');
        } finally {
            autoDetectButton.disabled = false;
            autoDetectButton.textContent = 'Auto Detect';
        }
    });

    // Reporting Page - Form Submission
    document.getElementById('report-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) {
            showPopup("Please log in to submit a report.", "error");
            showPage(pages.login);
            return;
        }

        const locationName = document.getElementById('locationName').value.trim();
        const latitude = parseFloat(document.getElementById('latitude').value);
        const longitude = parseFloat(document.getElementById('longitude').value);
        const description = document.getElementById('problemDesc').value.trim();
        const category = document.getElementById('category').value;
        const urgency = document.getElementById('urgency').value;
        const threat = document.getElementById('threat').value;
        const fileInput = document.getElementById('imageUpload');
        const reportErrorDiv = document.getElementById('report-error');
        const submitButton = e.target.querySelector('button[type="submit"]');


        if (reportErrorDiv) reportErrorDiv.textContent = ''; // Clear previous errors

        // Validation
        if (!locationName || isNaN(latitude) || isNaN(longitude) || !description || !category || !urgency || !threat) {
            showPopup('Please fill in all required fields.', 'error'); return;
        }
        if (!singaporeLatLngBounds.contains([latitude, longitude])) {
             showPopup('Location must be within Singapore.', 'error'); return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';

        let imageUrl = null;
        const file = fileInput?.files[0];

        // Handle image upload IF a file is selected
        if (file) {
            try {
                // Option 1: Use ImgBB (as before) - Requires enabling CORS on ImgBB or using a backend proxy if needed
               const formData = new FormData();
               formData.append('image', imageDataUrl.split(',')[1]); // Assumes imageDataUrl is populated from preview
                formData.append('key', '8c3ac5bab399ca801e354b900052510d'); // Replace with your key
               const imgbbResponse = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
                const imgbbData = await imgbbResponse.json();
               if (!imgbbData.success) throw new Error(imgbbData.error?.message || 'ImgBB upload failed');
               imageUrl = imgbbData.data.url;


            } catch (error) {
                console.error('Image Upload Error:', error);
                showPopup(`Image upload failed: ${error.message}`, 'error');
                submitButton.disabled = false;
                submitButton.textContent = 'Submit Report';
                return; // Stop submission if image upload fails
            }
        }

        // Create report object for Firestore
        const report = {
            userId: currentUser.uid,
            userName: currentUser.displayName || 'Anonymous', // Store user name
            locationName, latitude, longitude, description, category, urgency, threat, imageUrl,
            status: 'Pending',
            timestamp: new Date()
        };

        // Save to Firestore
        try {
            const docRef = await addDoc(collection(db, "reports"), report);
            console.log('Report added with ID:', docRef.id);
            document.getElementById('report-form').reset(); // Reset form fields
            imageDataUrl = null; // Clear preview variable
            if (imagePreview) imagePreview.innerHTML = ''; // Clear preview display
            if (tempMarker) { reportingMap.removeLayer(tempMarker); tempMarker = null; } // Clear map marker
            showPopup('Report submitted successfully!', 'success');

            // Refresh relevant views
            if (pages.myReports.style.display === 'block') renderUserReports();
            if (currentUser.email === 'admin@sgresolve.com' && pages.admin.style.display === 'block') {
                 renderAdminReports();
                 renderAdminAnalytics();
            }

        } catch (error) {
            console.error('Error adding report to Firestore:', error);
            showPopup(`Error submitting report: ${error.message}`, 'error');
        } finally {
             submitButton.disabled = false;
             submitButton.textContent = 'Submit Report';
        }
    });


    // Admin Page - Filters, Refresh, Export
    document.getElementById('apply-filters')?.addEventListener('click', renderAdminReports); // Re-render applies filters
    document.getElementById('reset-filters')?.addEventListener('click', () => {
        document.getElementById('image-filter').value = 'all';
        document.getElementById('category-filter').value = 'all';
        document.getElementById('urgency-filter').value = 'all';
        document.getElementById('threat-filter').value = 'all';
        renderAdminReports(); // Re-render with default filters
    });
    document.getElementById('refresh-reports')?.addEventListener('click', async () => {
        showPopup("Refreshing data...", "info");
        await renderAdminReports();
        await renderAdminAnalytics();
        showPopup("Data refreshed!", "success");
    });
    document.getElementById('export-data')?.addEventListener('click', async () => {
        showPopup("Generating CSV...", "info");
        try {
            const allReports = await fetchReports();
            if (allReports.length === 0) {
                 showPopup("No reports to export.", "info");
                 return;
            }
            const csvRows = [];
            const headers = ['ID', 'User ID', 'User Name', 'Location Name', 'Latitude', 'Longitude', 'Description', 'Category', 'Urgency', 'Threat', 'Image URL', 'Status', 'Timestamp'];
            csvRows.push(headers.join(','));
            allReports.forEach(report => {
                const row = [
                    report.id,
                    report.userId || '',
                    `"${(report.userName || '').replace(/"/g, '""')}"`, // Escape quotes in name
                    `"${(report.locationName || '').replace(/"/g, '""')}"`,
                    report.latitude || '',
                    report.longitude || '',
                    `"${(report.description || '').replace(/"/g, '""')}"`, // Escape quotes
                    report.category || '',
                    report.urgency || '',
                    report.threat || '',
                    report.imageUrl || '',
                    report.status || '',
                    report.timestamp ? report.timestamp.toISOString() : ''
                ];
                csvRows.push(row.join(','));
            });
            const csvString = csvRows.join('\n');
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `sgresolve_reports_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showPopup("Export complete.", "success");
        } catch (error) {
            console.error('Error exporting reports:', error);
            showPopup(`Export failed: ${error.message}`, 'error');
        }
    });

    // Admin Page - Report List Actions (Status Update, Delete) - Event Delegation
    document.getElementById('admin-reports-container')?.addEventListener('click', async (e) => {
        const target = e.target;
        const reportLi = target.closest('li[data-report-id]');
        if (!reportLi) return; // Click was not on a report item or its children

        const reportId = reportLi.getAttribute('data-report-id');

        // Handle Status Update
        if (target.classList.contains('update-status-btn')) {
            const select = reportLi.querySelector('.status-update');
            const newStatus = select?.value;
            if (!newStatus) return;

            target.disabled = true; // Disable button during update
            target.textContent = 'Updating...';
            try {
                await updateDoc(doc(db, "reports", reportId), { status: newStatus });
                showPopup("Status updated successfully.", "success");
                // Update status text directly in the UI for immediate feedback
                const statusSpan = reportLi.querySelector('.report-status');
                if (statusSpan) statusSpan.textContent = newStatus;
                // No need to call full re-render unless absolutely necessary
                // await renderAdminReports(); // Avoid full re-render if possible
                await renderAdminAnalytics(); // Update analytics as status changed
            } catch (error) {
                console.error('Error updating status:', error);
                showPopup(`Failed to update status: ${error.message}`, 'error');
            } finally {
                 target.disabled = false;
                 target.textContent = 'Update';
            }
        }

        // Handle Delete
        if (target.classList.contains('delete-report-btn')) {
             if (confirm('Are you sure you want to delete this report permanently?')) {
                 target.disabled = true;
                 target.textContent = 'Deleting...';
                try {
                    await deleteDoc(doc(db, "reports", reportId));
                    showPopup('Report deleted successfully.', 'success');
                    reportLi.remove(); // Remove from UI immediately
                    // Re-render map and analytics after deletion
                    const currentReports = Array.from(document.querySelectorAll('#admin-reports-container li')).map(li => ({
                         id: li.dataset.reportId
                         // Note: We don't have full report data here, need refetch for map/analytics
                     }));
                     // Simple approach: refetch all data
                     await renderAdminReports();
                     await renderAdminAnalytics();
                 } catch (error) {
                     console.error('Error deleting report:', error);
                     showPopup(`Failed to delete report: ${error.message}`, 'error');
                     target.disabled = false;
                     target.textContent = 'Delete';
                 }
             }
        }
    });


    // Community Forum Actions (Post, Comment, Vote) - Event Delegation
    const forumPage = document.getElementById('community-forum-page');
    if (forumPage) {
        // New Post Form
        document.getElementById('forum-post-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) { showPopup("Please log in to post.", "error"); return; }

            const title = document.getElementById('post-title').value.trim();
            const content = document.getElementById('post-content').value.trim();
            const category = document.getElementById('post-category').value;
            const submitButton = document.getElementById('submit-button');


            if (!title || !content || !category) {
                showPopup("Please fill in title, content, and category.", "error"); return;
            }

            submitButton.disabled = true;
            submitButton.textContent = 'Posting...';


            try {
                await addDoc(collection(db, "forumPosts"), {
                    title, content, category,
                    author: currentUser.displayName || 'Anonymous',
                    authorId: currentUser.uid,
                    timestamp: new Date(),
                    upvotes: 0, downvotes: 0, pinned: false // Default pinned to false
                });
                document.getElementById('forum-post-form').reset();
                showPopup("Post submitted!", "success");
                await renderForumPosts(); // Refresh posts
            } catch (error) {
                console.error('Error adding post:', error);
                showPopup(`Error submitting post: ${error.message}`, 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Post';
            }
        });

        // Actions within Forum Posts (Comments, Votes, Pinning)
        document.getElementById('forum-posts')?.addEventListener('click', async (e) => {
            const target = e.target;
            const postElement = target.closest('.forum-post');
            if (!postElement) return;
            const postId = postElement.getAttribute('data-post-id');

            // Handle Voting (Posts and Comments)
            if (target.classList.contains('vote-btn')) {
                if (!currentUser) { showPopup("Please log in to vote.", "error"); return; }
                target.disabled = true; // Prevent double-clicking

                const isUpvote = target.classList.contains('upvote-post') || target.classList.contains('upvote-comment');
                const isPostVote = target.classList.contains('upvote-post') || target.classList.contains('downvote-post');
                const commentId = isPostVote ? null : target.getAttribute('data-comment-id');

                const voteField = isUpvote ? 'upvotes' : 'downvotes';
                const docRef = commentId
                  ? doc(db, "forumPosts", postId, "comments", commentId)
                  : doc(db, "forumPosts", postId);

                try {
                    // Simple increment, no check for previous votes yet
                    await updateDoc(docRef, { [voteField]: increment(1) });

                    // Update UI immediately (optimistic update)
                    const currentCount = parseInt(target.textContent.match(/\d+$/)[0] || '0');
                    target.textContent = target.textContent.replace(/\d+$/, currentCount + 1);

                     // Fetch updated data for accurate count (optional, but safer)
                    // const updatedSnap = await getDoc(docRef);
                    // if (updatedSnap.exists()) {
                    //    const updatedData = updatedSnap.data();
                    //    const icon = isUpvote ? '👍' : '👎';
                    //    target.textContent = `${icon} ${updatedData[voteField] || 0}`;
                    // }

                } catch (error) {
                    console.error("Voting error:", error);
                    showPopup("Error recording vote.", "error");
                } finally {
                    target.disabled = false; // Re-enable button
                }
            }

            // Handle Pinning (Admin only)
            if (target.classList.contains('pin-btn') && currentUser?.email === 'admin@sgresolve.com') {
                const isPinned = target.getAttribute('data-pinned') === 'true';
                target.disabled = true;
                target.textContent = isPinned ? 'Unpinning...' : 'Pinning...';
                try {
                    await updateDoc(doc(db, "forumPosts", postId), { pinned: !isPinned });
                    showPopup(`Post ${isPinned ? 'unpinned' : 'pinned'}.`, 'success');
                    await renderForumPosts(); // Re-render to show change at top
                } catch(error) {
                    console.error("Pinning error:", error);
                    showPopup("Error changing pin status.", "error");
                    target.disabled = false;
                    target.textContent = isPinned ? 'Unpin' : 'Pin'; // Reset button text
                }
            }
        });

        // Handle Comment Submission
        document.getElementById('forum-posts')?.addEventListener('submit', async (e) => {
            if (e.target.classList.contains('comment-form')) {
                e.preventDefault();
                if (!currentUser) { showPopup("Please log in to comment.", "error"); return; }

                const postElement = e.target.closest('.forum-post');
                const postId = postElement?.getAttribute('data-post-id');
                const textarea = e.target.querySelector('textarea');
                const submitButton = e.target.querySelector('button[type="submit"]');
                const content = textarea?.value.trim();

                if (!postId || !textarea || !content || !submitButton) return;

                submitButton.disabled = true;
                submitButton.textContent = 'Posting...';

                try {
                    await addDoc(collection(db, "forumPosts", postId, "comments"), {
                        content,
                        author: currentUser.displayName || 'Anonymous',
                        authorId: currentUser.uid,
                        timestamp: new Date(),
                        upvotes: 0, downvotes: 0
                    });
                    textarea.value = ''; // Clear textarea
                    await renderComments(postId); // Refresh comments for this post
                    // Optional: Notify post owner (requires more complex backend/cloud functions)
                    // notifyPostOwner(postId);
                } catch (error) {
                    console.error('Error adding comment:', error);
                    showPopup(`Failed to post comment: ${error.message}`, 'error');
                } finally {
                     submitButton.disabled = false;
                     submitButton.textContent = 'Comment';
                }
            }
        });

         // Forum Search Input
        const searchInput = forumPage.querySelector('.search-input'); // Should exist if HTML is correct
        searchInput?.addEventListener('input', async () => {
            const searchTerm = searchInput.value.trim().toLowerCase();
            const forumPostsContainer = document.getElementById('forum-posts');
            if (!forumPostsContainer) return;

            forumPostsContainer.innerHTML = '<p>Searching...</p>';

            if (!searchTerm) {
                renderForumPosts(); // Show all if search is cleared
                return;
            }

            try {
                // Firestore doesn't support efficient text search directly.
                // Fetch all and filter client-side (inefficient for large datasets).
                // For production, use a dedicated search service like Algolia or Elasticsearch.
                const postsQuery = query(collection(db, "forumPosts"), orderBy("timestamp", "desc"));
                const querySnapshot = await getDocs(postsQuery);
                const matchingPosts = [];
                querySnapshot.forEach((doc) => {
                    const post = { id: doc.id, ...doc.data() };
                    if (
                        post.title?.toLowerCase().includes(searchTerm) ||
                        post.content?.toLowerCase().includes(searchTerm) ||
                        post.author?.toLowerCase().includes(searchTerm)
                    ) {
                        matchingPosts.push(post);
                    }
                });

                forumPostsContainer.innerHTML = ''; // Clear searching message
                if (matchingPosts.length === 0) {
                    forumPostsContainer.innerHTML = '<p>No posts found matching your search.</p>';
                } else {
                    matchingPosts.forEach(post => {
                        forumPostsContainer.appendChild(createPostElement(post));
                    });
                }
            } catch (error) {
                console.error('Error searching posts:', error);
                forumPostsContainer.innerHTML = '<p>Error performing search.</p>';
                showPopup("Search failed.", "error");
            }
        });


    } // End of forumPage event listeners


    // Nearby Reports Page
    document.getElementById('load-nearby-reports')?.addEventListener('click', displayNearbyReports);

    // Chatbot
    document.getElementById('chat-icon')?.addEventListener('click', toggleChat);
    document.querySelector('.send-button')?.addEventListener('click', sendChatMessage);
    document.getElementById('user-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

     // Popup Close Button
     document.getElementById('popup-close')?.addEventListener('click', () => {
        const popupOverlay = document.getElementById('popup-overlay');
        if (popupOverlay) popupOverlay.style.display = 'none';
    });
    // Popup Close with Escape Key
    document.addEventListener('keydown', (e) => {
        const popupOverlay = document.getElementById('popup-overlay');
        if (e.key === 'Escape' && popupOverlay?.style.display === 'flex') {
            popupOverlay.style.display = 'none';
        }
    });


    // --- Initial Setup ---
    hideAllPages(); // Hide all pages initially
    // Auth state listener handles showing the correct initial page
    // showPage(pages.landing); // Redundant due to auth listener

}); // End DOMContentLoaded
