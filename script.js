document.addEventListener('DOMContentLoaded', () => {
    // **Define Singapore's Geographical Boundaries**
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

    // **Initialize Maps without maxBounds**
    let reportingMap = L.map('map').setView([1.3521, 103.8198], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(reportingMap);

    let adminMap = L.map('admin-map').setView([1.3521, 103.8198], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(adminMap);

    // **Global Variables**
    let tempMarker;
    let reportMarkers = [];
    let imageDataUrl = null; // For image preview and storage

    let currentUser = null;
    let users = [];
    let reports = [
        {
            id: 1,
            userEmail: 'user@example.com',
            locationName: 'Punggol',
            latitude: 1.3984,
            longitude: 103.9072,
            description: 'Broken Traffic Light',
            category: 'Infrastructure',
            urgency: 'High',
            threat: 'Moderate',
            imageDataUrl: 'images/broken-traffic-light.jpg',
            status: 'Pending'
        }
    ];
    let forumPosts = [];
    let reportIdCounter = 2;
    let forumPostIdCounter = 1;
    let userIdCounter = 1;

    // **Page Elements**
    const landingPage = document.getElementById('landing-page');
    const loginPage = document.getElementById('login-page');
    const registerPage = document.getElementById('register-page');
    const adminPage = document.getElementById('admin-page');
    const reportingPage = document.getElementById('reporting-page');
    const myReportsPage = document.getElementById('my-reports-page');
    const communityForumPage = document.getElementById('community-forum-page');
    const aboutPage = document.getElementById('about-page');
    const contactPage = document.getElementById('contact-page');
    const navbar = document.getElementById('navbar');

    // **Helper Functions**
    function hideAllPages() {
        [landingPage, loginPage, registerPage, adminPage, reportingPage, myReportsPage, communityForumPage, aboutPage, contactPage].forEach(page => {
            page.style.display = 'none';
            page.classList.remove('show');
        });
    }

    function showPage(page) {
        hideAllPages();
        page.classList.add('show');
        page.style.display = 'block';
        if (page.id === 'reporting-page') reportingMap.invalidateSize();
        else if (page.id === 'admin-page') {
            adminMap.invalidateSize();
            renderAdminReports(reports); // Initially render all reports
        }
    }

    function updateNavbar() {
        navbar.style.display = currentUser ? 'block' : 'none';
    }

    function createStatusDropdown(currentStatus) {
        return `
            <select class="status-update">
                <option value="Pending" ${currentStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="In Progress" ${currentStatus === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Resolved" ${currentStatus === 'Resolved' ? 'selected' : ''}>Resolved</option>
            </select>
            <button class="update-status-btn">Update Status</button>
        `;
    }

    // **Rendering Functions**
    // Function to delete a report
function deleteReport(reportId) {
    if (confirm('Are you sure you want to delete this report?')) {
        const index = reports.findIndex(report => report.id === reportId);
        if (index !== -1) {
            reports.splice(index, 1); // Remove the report from the array
            const filteredReports = getFilteredReports(); // Get the updated filtered list
            renderAdminReports(filteredReports); // Re-render the reports
        }
    }
}

// Modified renderAdminReports function to include a delete button
function renderAdminReports(filteredReports) {
    const adminReportsContainer = document.getElementById('admin-reports-container');
    adminReportsContainer.innerHTML = ''; // Clear existing content
    filteredReports.forEach(report => {
        const li = document.createElement('li');
        li.setAttribute('data-report-id', report.id);
        li.innerHTML = `
            <p><strong>Location:</strong> ${report.locationName}</p>
            <p><strong>Category:</strong> ${report.category}</p>
            <p><strong>Description:</strong> ${report.description}</p>
            <p><strong>Urgency:</strong> ${report.urgency}</p>
            <p><strong>Threat:</strong> ${report.threat}</p>
            <p><strong>Status:</strong> <span class="report-status">${report.status}</span></p>
            ${report.imageDataUrl ? `<img src="${report.imageDataUrl}" alt="Report Image">` : ''}
            ${createStatusDropdown(report.status)} <!-- Assuming this function exists -->
            <button class="button danger-button delete-report-btn" data-report-id="${report.id}">Delete</button>
        `;
        adminReportsContainer.appendChild(li);
    });
    renderAdminMap(filteredReports); // Update the map with the current reports
}

// Event listener for delete buttons using event delegation
document.getElementById('admin-reports-container').addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-report-btn')) {
        const reportId = parseInt(e.target.getAttribute('data-report-id'));
        deleteReport(reportId);
    }
});

    function renderAdminMap(filteredReports) {
        reportMarkers.forEach(marker => adminMap.removeLayer(marker));
        reportMarkers = [];
        filteredReports.forEach(report => {
            if (report.latitude && report.longitude) {
                const marker = L.marker([report.latitude, report.longitude]).addTo(adminMap);
                const popupContent = `
                    <b>${report.locationName}</b><br>
                    Category: ${report.category}<br>
                    Description: ${report.description}<br>
                    Urgency: ${report.urgency}<br>
                    Threat: ${report.threat}<br>
                    Status: <select class="status-update" data-report-id="${report.id}">
                        <option value="Pending" ${report.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="In Progress" ${report.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Resolved" ${report.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                    </select><br>
                    ${report.imageDataUrl ? `<img src="${report.imageDataUrl}" alt="Report Image">` : ''}
                `;
                marker.bindPopup(popupContent);
                reportMarkers.push(marker);
            }
        });
    }

    function renderUserReports() {
        const userReportsContainer = document.getElementById('user-reports-container');
        userReportsContainer.innerHTML = '';
        const userReports = reports.filter(report => report.userEmail === currentUser.email);
        if (userReports.length === 0) {
            userReportsContainer.innerHTML = 'No reports submitted yet.';
            return;
        }
        userReports.forEach(report => {
            const li = document.createElement('li');
            li.setAttribute('data-report-id', report.id);
            li.innerHTML = `
                <p><strong>Location:</strong> ${report.locationName}</p>
                <p><strong>Category:</strong> ${report.category}</p>
                <p><strong>Description:</strong> ${report.description}</p>
                <p><strong>Urgency:</strong> ${report.urgency}</p>
                <p><strong>Threat:</strong> ${report.threat}</p>
                <p><strong>Status:</strong> ${report.status}</p>
                ${report.imageDataUrl ? `<img src="${report.imageDataUrl}" alt="Report Image">` : ''}
            `;
            userReportsContainer.appendChild(li);
        });
    }

    function renderForumPosts() {
        const forumPostsContainer = document.getElementById('forum-posts');
        forumPostsContainer.innerHTML = forumPosts.length === 0 ? 'No posts yet. Be the first to post!' : '';
        forumPosts.forEach(post => {
            const postDiv = document.createElement('div');
            postDiv.classList.add('forum-post');
            postDiv.setAttribute('data-post-id', post.id);
            postDiv.innerHTML = `
                <h3>${post.title}</h3>
                <p>${post.content}</p>
                <p>Posted by ${post.author} on ${post.date}</p>
            `;
            forumPostsContainer.appendChild(postDiv);
        });
    }

    // **Filter Function**
    function getFilteredReports() {
        const imageFilter = document.getElementById('image-filter').value;
        const categoryFilter = document.getElementById('category-filter').value;
        const urgencyFilter = document.getElementById('urgency-filter').value;
        const threatFilter = document.getElementById('threat-filter').value;
        
        let filteredReports = reports.slice(); // Create a copy of the reports array
        
        if (imageFilter !== 'all') {
            filteredReports = filteredReports.filter(report => {
                if (imageFilter === 'with') return report.imageDataUrl != null;
                else return report.imageDataUrl == null;
            });
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

    // **Navigation Event Listeners**
    document.getElementById('nav-home').addEventListener('click', (e) => {
        e.preventDefault();
        if (currentUser) {
            if (currentUser.role === 'admin') {
                renderAdminReports(reports); // Render all reports initially
                showPage(adminPage);
            } else showPage(reportingPage);
        } else showPage(landingPage);
    });

    document.getElementById('nav-my-reports').addEventListener('click', (e) => {
        e.preventDefault();
        if (currentUser) {
            renderUserReports();
            showPage(myReportsPage);
        }
    });

    document.getElementById('nav-community').addEventListener('click', (e) => {
        e.preventDefault();
        renderForumPosts();
        showPage(communityForumPage);
    });

    document.getElementById('nav-about').addEventListener('click', (e) => {
        e.preventDefault();
        showPage(aboutPage);
    });

    document.getElementById('nav-contact').addEventListener('click', (e) => {
        e.preventDefault();
        showPage(contactPage);
    });

    document.getElementById('nav-logout').addEventListener('click', (e) => {
        e.preventDefault();
        currentUser = null;
        updateNavbar();
        showPage(landingPage);
    });

    // **Landing Page Buttons**
    document.getElementById('hero-report-issue').addEventListener('click', (e) => {
        e.preventDefault();
        showPage(loginPage);
    });

    document.getElementById('hero-learn-more').addEventListener('click', (e) => {
        e.preventDefault();
        showPage(aboutPage);
    });

    document.getElementById('cta-register').addEventListener('click', (e) => {
        e.preventDefault();
        showPage(registerPage);
    });

    document.getElementById('cta-login').addEventListener('click', (e) => {
        e.preventDefault();
        showPage(loginPage);
    });

    // **Login & Registration**
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();
        const errorDiv = document.getElementById('login-error');
        errorDiv.textContent = '';
        if (email.toLowerCase() === 'admin@sgresolve.com' && password === 'admin') {
            let adminUser = users.find(u => u.email.toLowerCase() === 'admin@sgresolve.com');
            if (!adminUser) {
                adminUser = { id: userIdCounter++, name: 'Admin', email: 'admin@sgresolve.com', password: 'admin', role: 'admin' };
                users.push(adminUser);
            }
            currentUser = adminUser;
            updateNavbar();
            document.getElementById('login-form').reset();
            renderAdminReports(reports); // Render all reports initially
            showPage(adminPage);
            return;
        }
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (user && user.password === password) {
            currentUser = user;
            updateNavbar();
            document.getElementById('login-form').reset();
            if (currentUser.role === 'admin') {
                renderAdminReports(reports); // Render all reports initially
                showPage(adminPage);
            } else showPage(reportingPage);
        } else errorDiv.textContent = 'Invalid email or password.';
    });

    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value.trim();
        const errorDiv = document.getElementById('register-error');
        errorDiv.textContent = '';
        if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
            errorDiv.textContent = 'A user with that email already exists.';
            return;
        }
        const role = email.toLowerCase() === 'admin@sgresolve.com' ? 'admin' : 'user';
        const newUser = { id: userIdCounter++, name, email, password, role };
        users.push(newUser);
        currentUser = newUser;
        updateNavbar();
        document.getElementById('register-form').reset();
        if (currentUser.role === 'admin') {
            renderAdminReports(reports); // Render all reports initially
            showPage(adminPage);
        } else showPage(reportingPage);
    });

    document.getElementById('go-to-register').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-error').textContent = '';
        showPage(registerPage);
    });

    document.getElementById('go-to-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-error').textContent = '';
        showPage(loginPage);
    });

    // **Reporting Map Click Event**
    reportingMap.on('click', function(e) {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        if (lat < SINGAPORE_BOUNDS.latMin || lat > SINGAPORE_BOUNDS.latMax ||
            lon < SINGAPORE_BOUNDS.lonMin || lon > SINGAPORE_BOUNDS.lonMax) {
            alert('Please select a location within Singapore.');
            return;
        }
        if (tempMarker) reportingMap.removeLayer(tempMarker);
        tempMarker = L.marker([lat, lon]).addTo(reportingMap);
        document.getElementById('latitude').value = lat.toFixed(4);
        document.getElementById('longitude').value = lon.toFixed(4);
    });

    // **Detect Location Button**
    document.getElementById('detectLocation').addEventListener('click', function() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                if (lat < SINGAPORE_BOUNDS.latMin || lat > SINGAPORE_BOUNDS.latMax ||
                    lon < SINGAPORE_BOUNDS.lonMin || lon > SINGAPORE_BOUNDS.lonMax) {
                    alert('Your current location is not within Singapore. Please select a location within Singapore on the map.');
                    return;
                }
                if (tempMarker) reportingMap.removeLayer(tempMarker);
                tempMarker = L.marker([lat, lon]).addTo(reportingMap);
                document.getElementById('latitude').value = lat.toFixed(4);
                document.getElementById('longitude').value = lon.toFixed(4);
                reportingMap.setView([lat, lon], 14);
            }, function(error) {
                alert('Error retrieving location: ' + error.message);
            });
        } else alert('Geolocation is not supported by your browser.');
    });

    // **Image Upload Preview**
    const imageUpload = document.getElementById('imageUpload');
    const imagePreview = document.getElementById('imagePreview');
    imageUpload.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                imageDataUrl = e.target.result;
                imagePreview.innerHTML = `<img src="${imageDataUrl}" alt="Image Preview">`;
            };
            reader.readAsDataURL(file);
        } else {
            imageDataUrl = null;
            imagePreview.innerHTML = '';
        }
    });

    // **Auto Detect Feature**
    const autoDetectButton = document.getElementById('autoDetect');
    const problemDesc = document.getElementById('problemDesc');
    const categorySelect = document.getElementById('category');
    const urgencySelect = document.getElementById('urgency');
    const threatSelect = document.getElementById('threat');
    const reportError = document.getElementById('report-error');

    problemDesc.addEventListener('input', () => {
        autoDetectButton.disabled = !problemDesc.value.trim();
    });

    function mockPredict(description) {
        // Convert description to lowercase and split into words
        const lowerDesc = description.toLowerCase();
        const words = lowerDesc.split(/\s+/);

        // Define keyword lists
        const categoryKeywords = {
            Infrastructure: [
                'road', 'pothole', 'traffic', 'light', 'sidewalk', 'bridge', 'street', 'pavement', 'sewer', 'drain',
                'utility', 'power', 'water', 'gas', 'construction', 'building', 'facility', 'maintenance',
                'transport', 'mrt', 'bus', 'lrt', 'train', 'station', 'expressway', 'carpark', 'hdb', 'housing',
                'town council', 'lift', 'escalator', 'town', 'planning', 'cycle path', 'pedestrian crossing',
                'traffic congestion', 'roadworks', 'public transport', 'thomson east coast line', 'circle line',
                'north south line', 'east west line', 'north east line', 'sengkang lrt', 'punggol lrt', 'bus interchange',
                'mrt station', 'bus stop', 'taxi stand', 'erp', 'coe', 'ura', 'bto', 'srs', 'pr', 'foreign worker',
                'infrastructure project', 'development', 'upgrading', 'woodlands checkpoint', 'tuas checkpoint', 'johor bahru',
                'causeway', 'second link'
            ],
            Environmental: [
                'pollution', 'waste', 'recycling', 'green', 'park', 'tree', 'air', 'water', 'flood', 'trash', 'litter',
                'noise', 'contamination', 'ecology', 'sustainability', 'conservation', 'environment', 'nature',
                'climate', 'sea level', 'carbon', 'emission', 'clean', 'energy', 'biodiversity', 'green building',
                'carbon footprint', 'nature reserve', 'green space', 'urban heat island', 'water quality',
                'air quality', 'nea', 'national environment agency', 'zero waste', 'circular economy',
                'climate change', 'rising sea levels', 'flash flood', 'drainage', 'reservoir', 'water conservation',
                'tree planting', 'park connector', 'community garden', 'eco link', 'green plan', '30 by 30'
            ],
            Safety: [
                'crime', 'hazard', 'emergency', 'accident', 'fire', 'police', 'ambulance', 'dark', 'safety', 'theft',
                'vandalism', 'assault', 'danger', 'risk', 'security', 'protection', 'threat', 'peril', 'cctv',
                'patrol', 'incident', 'rescue', 'first aid', 'disaster', 'crisis', 'terrorism', 'public order',
                'road safety', 'fire safety', 'workplace safety', 'nparks', 'spf', 'singapore police force', 'scdf',
                'singapore civil defence force', 'sars', 'dengue', 'zika', 'covid', 'pandemic', 'outbreak',
                'health crisis', 'food poisoning', 'haze', 'pm2.5', 'psi', 'singapore alerts'
            ],
            Others: [
                'public health', 'healthcare', 'education', 'employment', 'poverty', 'homeless', 'community',
                'social issue', 'elderly', 'youth', 'family', 'wellbeing', 'amenity', 'feedback', 'complaint',
                'accessibility', 'inconvenience', 'nuisance', 'governance', 'regulation', 'policy', 'planning',
                'social mobility', 'cost of living', 'income inequality', 'ageing population', 'cpf', 'medisave',
                'mediShield', 'fairprice', 'ntuc', 'hdb living', 'singaporean', 'foreigner', 'expat', 'immigrant',
                'migrant worker', 'lgbtq', 'mental health', 'special needs', 'inclusivity', 'meritocracy',
                'racial harmony', 'religious harmony', 'multiculturalism', 'kampong spirit', 'kiasu', 'kiasi',
                'pa', 'people association', 'grassroots', 'rc', 'residents committee', 'ncc', 'national day parade',
                'general election', 'by election', 'parliament', 'white paper', 'budget', 'ndr', 'national day rally',
                'noise complaint', 'odor complaint', 'pest control', 'littering', 'vandalism', 'antisocial behaviour',
                'smoking ban', 'illegal parking', 'loan shark', 'ah long', 'disturbing the peace', 'minor dispute',
                'neighbourhood dispute', 'community mediation', 'town council feedback'
            ]
        };

        const urgencyKeywords = {
            High: [
                'urgent', 'immediate', 'critical', 'emergency', 'asap', 'now', 'quick', 'fast', 'pressing', 'vital', 'imperative',
                'time-sensitive', 'rapid', 'swift', 'expedite', 'exigent', 'dire', 'crucial', 'essential', 'need immediately',
                'requires immediate attention', 'on fire', 'cannot wait', 'no delay', 'act now', 'red alert', 'code red',
                'stat', 'right away', 'forthwith', 'instantly', 'without delay', 'at once', 'immediately', 'urgently',
                'most urgent', 'top priority', 'highest priority', 'most critical', 'most pressing', 'most vital',
                'absolute necessity', 'burning issue', 'crisis', 'demands action', 'exigent circumstances', 'first priority',
                'high-priority situation', 'most important', 'paramount', 'pressing need', 'requires action now',
                'time is of the essence', 'zero delay', 'alarm', 'alert', 'rush', 'hasten', 'accelerate', 'precipitate',
                'get it done now', 'move quickly', 'time critical', 'every second counts', 'mission critical', 'cannot be delayed',
                'needs resolving immediately', 'needs addressing urgently', 'situation critical', 'grave situation', 'alarming situation',
                'fire', 'explosion', 'collapse', 'active shooter', 'nuclear', 'biohazard', 'chemical spill', 'attack', 'breach',
                'hostage', 'bomb', 'evacuate', 'mayday', 'meltdown', 'tsunami', 'earthquake', 'severe bleeding', 'cardiac arrest',
                'unconscious', 'stroke', 'seizure', 'anaphylaxis'
            ],
            Medium: [
                'soon', 'timely', 'important', 'prompt', 'today', 'shortly', 'expedient', 'relatively soon', 'in a timely manner',
                'not urgent but important', 'needs attention', 'within a reasonable time', 'fairly quickly', 'decently fast',
                'in due course', 'when possible', 'as soon as possible', 'before long', 'in the near future', 'not right now',
                'need to address', 'should be handled', 'worth addressing', 'not critical', 'not life threatening',
                'moderately urgent', 'reasonably urgent', 'somewhat urgent', 'important but not critical', 'needs prompt attention',
                'needs addressing soon', 'should be handled promptly', 'worth addressing soon', 'not an emergency but important',
                'not a crisis but needs attention', 'not a red alert but needs action', 'not a code red but needs addressing',
                'not a stat situation but needs handling', 'not right away but needs to be done', 'not forthwith but needs action',
                'not instantly but needs addressing', 'not without delay but needs attention', 'not at once but needs handling',
                'not immediately but needs to be taken care of', 'not urgently but needs to be dealt with', 'requires attention in the short term',
                'needs to be looked at soon', 'should be taken care of in a timely manner', 'merits attention soon',
                'deserves attention soon', 'not a top priority but needs action', 'not the highest priority but needs addressing',
                'not the most urgent but needs handling', 'not the most critical but needs attention', 'not the most pressing but needs addressing',
                'power outage', 'broken gas line', 'water main break', 'serious injury', 'vandalism', 'theft', 'protest', 'riot',
                'severe weather', 'blocked road', 'train derailment', 'plane crash', 'building collapse'
            ],
            Low: [
                'not urgent', 'later', 'minor', 'eventually', 'whenever', 'non-critical', 'non-urgent', 'not a big issue', 'not pressing',
                'low priority', 'can wait', 'no rush', 'take your time', 'at your convenience', 'no immediate action',
                'when you get around to it', 'if you have time', 'no need to hurry', 'no stress', 'no worries', 'in the future',
                'when convenient', 'no big deal', 'not an emergency', 'can be delayed', 'of little importance', 'least urgent',
                'lowest priority', 'minimal urgency', 'negligible urgency', 'not a priority', 'not an issue of concern',
                'not a cause for concern', 'not a problem', 'not a significant issue', 'not a major issue', 'not a serious issue',
                'not a pressing issue', 'not a vital issue', 'not an imperative issue', 'not a time-sensitive issue',
                'not a rapid issue', 'not a swift issue', 'not an expedite issue', 'not an exigent issue', 'not a dire issue',
                'not a crucial issue', 'not an essential issue', 'not a need immediately issue', 'not a requires immediate attention issue',
                'not an on fire issue', 'not a cannot wait issue', 'not a no delay issue', 'not an act now issue',
                'not a red alert issue', 'not a code red issue', 'not a stat issue', 'not a right away issue',
                'not a forthwith issue', 'not an instantly issue', 'not a without delay issue', 'not an at once issue',
                'not an immediately issue', 'not an urgently issue', 'can be postponed', 'can be deferred', 'can be put off',
                'can be rescheduled', 'can be delayed indefinitely', 'can be addressed later', 'can be handled later',
                'can be dealt with later', 'can be taken care of later', 'can be resolved later', 'can be settled later',
                'can be alleviated later', 'can be mitigated later', 'can be reduced later', 'can be lessened later',
                'can be diminished later', 'can be abated later', 'can be eased later', 'can be relieved later',
                'can be addressed at leisure', 'can be handled at leisure', 'can be dealt with at leisure',
                'can be taken care of at leisure', 'can be resolved at leisure', 'can be settled at leisure',
                'can be alleviated at leisure', 'can be mitigated at leisure', 'can be reduced at leisure',
                'can be lessened at leisure', 'can be diminished at leisure', 'can be abated later',
                'can be eased at leisure', 'can be relieved at leisure',
                'noise complaint', 'minor flooding', 'small leak', 'lost item', 'parking violation', 'graffiti', 'littering',
                'broken appliance', 'internet outage', 'cable outage'
            ]
        };

        const threatKeywords = {
            Severe: [
                'dangerous', 'hazardous', 'life-threatening', 'severe', 'critical', 'fatal', 'serious', 'grave', 'perilous',
                'high risk', 'extreme danger', 'imminent threat', 'catastrophic', 'disastrous', 'lethal', 'deadly', 'deadliest',
                'highly dangerous', 'extremely hazardous', 'life threatening', 'severe damage', 'critical condition', 'fatal outcome',
                'serious injury', 'grave consequences', 'perilous situation', 'dire straits', 'major incident', 'substantial risk',
                'utter destruction', 'mass casualties', 'existential threat', 'total loss', 'complete annihilation', 'wipeout',
                'extinction level event', 'unrecoverable', 'irreversible', 'beyond repair', 'no hope', 'worst case scenario',
                'code black', 'level 5 threat', 'maximum threat', 'highest threat level', 'most severe threat', 'extreme hazard',
                'deadly hazard', 'lethal danger', 'fatal danger', 'critical hazard', 'severe risk', 'extreme risk',
                'imminent danger', 'catastrophic damage', 'disastrous consequences', 'lethal outcome', 'deadly result',
                'deadliest consequences', 'highly dangerous situation', 'extremely hazardous condition', 'life-threatening situation',
                'severe impact', 'critical impact', 'fatal impact', 'serious impact', 'grave impact', 'perilous impact',
                'dire consequences', 'major crisis', 'substantial danger', 'utter devastation', 'mass destruction',
                'existential risk', 'total ruin', 'complete obliteration', 'total destruction', 'complete devastation',
                'absolute destruction', 'absolute devastation', 'irreparable damage', 'irreparable harm', 'irreparable loss',
                'hopeless situation', 'hopeless case', 'worst possible scenario', 'worst-case scenario', 'code red situation',
                'code red alert', 'level 5 emergency', 'level 5 crisis', 'maximum danger', 'highest level of threat',
                'most severe danger', 'most extreme danger', 'most critical danger', 'most fatal danger', 'most serious danger',
                'most grave danger', 'most perilous danger', 'most hazardous danger', 'most life-threatening danger',
                'most severe hazard', 'most extreme hazard', 'most critical hazard', 'most fatal hazard', 'most serious hazard',
                'most grave hazard', 'most perilous hazard', 'most dangerous hazard', 'most hazardous hazard',
                'most life-threatening hazard', 'most severe risk', 'most extreme risk', 'most critical risk',
                'most fatal risk', 'most serious risk', 'most grave risk', 'most perilous risk', 'most dangerous risk',
                'most hazardous risk', 'most life-threatening risk', 'most catastrophic risk', 'most disastrous risk',
                'most lethal risk', 'most deadly risk', 'most lethal danger', 'most deadly danger',
                'fire', 'explosion', 'collapse', 'active shooter', 'nuclear', 'biohazard', 'chemical spill', 'attack', 'breach',
                'hostage', 'bomb', 'meltdown', 'tsunami', 'earthquake', 'severe bleeding', 'cardiac arrest', 'unconscious',
                'stroke', 'seizure', 'anaphylaxis', 'poisoning', 'radiation', 'terrorism', 'war', 'famine', 'pandemic',
                'system failure', 'infrastructure collapse'
            ],
            Moderate: [
                'concerning', 'problematic', 'significant', 'moderate', 'issue', 'troublesome', 'worrisome', 'substantial',
                'considerable', 'notable', 'marked', 'material', 'weighty', 'alarming', 'disquieting', 'disturbing',
                'of concern', 'presents a problem', 'significant impact', 'moderate damage', 'moderate risk', 'issue of concern',
                'troublesome situation', 'worrisome development', 'worth noting', 'worth considering', 'not insignificant',
                'potential problem', 'possible danger', 'some risk', 'bears watching', 'raises concerns', 'needs attention',
                'could escalate', 'not ideal', 'sub-optimal', 'less than perfect', 'room for improvement', 'not the best',
                'concerning trend', 'problem area', 'significant issue', 'moderate problem', 'medium threat',
                'intermediate threat', 'noticeable threat', 'appreciable threat', 'detectable threat', 'perceptible threat',
                'visible threat', 'evident threat', 'manifest threat', 'palpable threat', 'tangible threat', 'real threat',
                'credible threat', 'believable threat', 'plausible threat', 'conceivable threat', 'imaginable threat',
                'thinkable threat', 'possible threat', 'potential hazard', 'possible hazard', 'some danger', 'some hazard',
                'some risk involved', 'some risk present', 'some risk exists', 'not negligible risk', 'not trivial risk',
                'not insignificant risk', 'not minor risk', 'not small risk', 'not slight risk', 'not minimal risk',
                'not a minor issue', 'not a small issue', 'not a slight issue', 'not a minimal issue', 'not a trivial issue',
                'not an insignificant issue', 'not a negligible issue', 'not a petty issue', 'not a piddling issue',
                'not a trifling issue', 'not a small matter', 'not of little consequence', 'not unworthy of attention',
                'not undeserving of attention', 'not unworthy of consideration', 'not undeserving of consideration',
                'not unworthy of notice', 'not undeserving of notice', 'not unworthy of regard', 'not undeserving of regard',
                'not unworthy of respect', 'not undeserving of respect', 'not unworthy of concern', 'not undeserving of concern',
                'not unworthy of worry', 'not undeserving of worry', 'not unworthy of anxiety', 'not undeserving of anxiety',
                'not unworthy of apprehension', 'not undeserving of apprehension', 'not unworthy of alarm', 'not undeserving of alarm',
                'not unworthy of disquiet', 'not undeserving of disquiet', 'not unworthy of disturbance', 'not undeserving of disturbance',
                'power outage', 'broken gas line', 'water main break', 'serious injury', 'vandalism', 'theft', 'protest', 'riot',
                'severe weather', 'blocked road', 'train derailment', 'plane crash', 'building collapse', 'gas leak',
                'chemical exposure', 'radiation exposure', 'food poisoning', 'large crowd', 'public disturbance',
                'cyberattack', 'data breach', 'equipment failure', 'structural damage'
            ],
            Minor: [
                'small', 'insignificant', 'negligible', 'minor', 'tiny', 'trivial', 'slight', 'minimal', 'not a big issue', 'not serious',
                'low risk', 'minimal impact', 'inconsequential', 'unimportant', 'petty', 'piddling', 'trifling', 'small matter',
                'of little consequence', 'not worth worrying about', 'hardly noticeable', 'scarcely any', 'a drop in the bucket',
                'no cause for alarm', 'nothing to worry about', 'not a major concern', 'not a threat', 'not dangerous',
                'presents no danger', 'poses no threat', 'no harm', 'no foul', 'all clear', 'safe', 'secure', 'under control',
                'contained', 'handled', 'dealt with', 'taken care of', 'resolved', 'settled', 'alleviated', 'mitigated',
                'reduced', 'lessened', 'diminished', 'abated', 'eased', 'relieved', 'alleviated', 'mitigated', 'minimal threat',
                'very low threat', 'extremely low threat', 'almost no threat', 'virtually no threat', 'practically no threat',
                'scarcely any threat', 'hardly any threat', 'barely any threat', 'just about no threat', 'next to no threat',
                'as good as no threat', 'tantamount to no threat', 'equivalent to no threat', 'amounting to no threat',
                'approaching no threat', 'bordering on no threat', 'verging on no threat', 'akin to no threat', 'similar to no threat',
                'comparable to no threat', 'analogous to no threat', 'parallel to no threat', 'corresponding to no threat',
                'resembling no threat', 'like no threat', 'as if no threat', 'as though no threat', 'as it were no threat',
                'in effect no threat', 'in essence no threat', 'in substance no threat', 'in reality no threat', 'in fact no threat',
                'in truth no threat', 'in actuality no threat', 'in practice no threat', 'for all intents and purposes no threat',
                'to all intents and purposes no threat', 'on the face of it no threat', 'at first glance no threat',
                'at first sight no threat', 'on initial inspection no threat', 'on preliminary examination no threat',
                'on cursory review no threat', 'on superficial analysis no threat', 'on brief consideration no threat',
                'on slight acquaintance no threat', 'on casual observation no threat', 'on passing notice no threat',
                'on a quick look no threat', 'on a short view no threat', 'on a limited perspective no threat',
                'on a narrow outlook no threat', 'on a restricted viewpoint no threat', 'on a small scale no threat',
                'on a reduced scale no threat', 'on a limited scale no threat', 'on a minor scale no threat',
                'on a negligible scale no threat', 'on an insignificant scale no threat', 'on a trivial scale no threat',
                'on a slight scale no threat', 'on a minimal scale no threat', 'on a petty scale no threat',
                'on a piddling scale no threat', 'on a trifling scale no threat', 'on a small matter scale no threat',
                'on an of little consequence scale no threat', 'on a not worth worrying about scale no threat',
                'on a hardly noticeable scale no threat', 'on a scarcely any scale no threat', 'on a drop in the bucket scale no threat',
                'on a no cause for alarm scale no threat', 'on a nothing to worry about scale no threat',
                'on a not a major concern scale no threat', 'on a not a threat scale no threat', 'on a not dangerous scale no threat',
                'on a presents no danger scale no threat', 'on a poses no threat scale no threat', 'on a no harm scale no threat',
                'on a no foul scale no threat', 'on an all clear scale no threat', 'on a safe scale no threat', 'on a secure scale no threat',
                'on an under control scale no threat', 'on a contained scale no threat', 'on a handled scale no threat',
                'on a dealt with scale no threat', 'on a taken care of scale no threat', 'on a resolved scale no threat',
                'on a settled scale no threat', 'on an alleviated scale no threat', 'on a mitigated scale no threat',
                'on a reduced scale no threat', 'on a lessened scale no threat', 'on a diminished scale no threat',
                'on an abated scale no threat', 'on an eased scale no threat', 'on a relieved scale no threat',
                'on an alleviated scale no threat', 'on a mitigated scale no threat',
                'noise complaint', 'minor flooding', 'small leak', 'lost item', 'parking violation', 'graffiti', 'littering',
                'broken appliance', 'internet outage', 'cable outage', 'power flicker', 'dripping faucet', 'clogged drain',
                'burnt out lightbulb', 'dead battery', 'low tire pressure', 'minor cut', 'headache', 'stomachache',
                'feeling unwell', 'slightly ill', 'a bit under the weather'
            ]
        };

        const negationWords = ['not', 'no', 'isn\'t', 'aren\'t', 'doesn\'t', 'don\'t', 'never', 'none', 'nothing', 'nobody', 'nowhere'];

        // Predict Category
        const categoryScores = {};
        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            categoryScores[category] = keywords.reduce((score, keyword) => {
                return score + (words.includes(keyword) ? 1 : 0);
            }, 0);
        }
        const maxCategoryScore = Math.max(...Object.values(categoryScores));
        let category = Object.entries(categoryScores).find(([cat, score]) => score === maxCategoryScore)[0];
        if (maxCategoryScore === 0) category = 'Others';

        // Predict Urgency
        const urgencyScores = { High: 0, Medium: 0, Low: 0 };
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const prevWord = i > 0 ? words[i - 1] : '';
            if (urgencyKeywords.High.includes(word)) {
                if (!negationWords.includes(prevWord)) {
                    urgencyScores.High++;
                } else {
                    urgencyScores.Low++;
                }
            } else if (urgencyKeywords.Medium.includes(word)) {
                urgencyScores.Medium++;
            }
            // Check for Low urgency phrases in the full description
            if (urgencyKeywords.Low.some(keyword => lowerDesc.includes(keyword))) {
                urgencyScores.Low++;
            }
        }
        const maxUrgencyScore = Math.max(...Object.values(urgencyScores));
        let urgency = Object.entries(urgencyScores).find(([level, score]) => score === maxUrgencyScore)[0];
        if (maxUrgencyScore === 0) urgency = 'Medium';

        // Predict Threat
        const threatScores = { Severe: 0, Moderate: 0, Minor: 0 };
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const prevWord = i > 0 ? words[i - 1] : '';
            if (threatKeywords.Severe.includes(word)) {
                if (!negationWords.includes(prevWord)) {
                    threatScores.Severe++;
                } else {
                    threatScores.Minor++;
                }
            } else if (threatKeywords.Moderate.includes(word)) {
                threatScores.Moderate++;
            }
            // Check for Minor threat phrases in the full description
            if (threatKeywords.Minor.some(keyword => lowerDesc.includes(keyword))) {
                threatScores.Minor++;
            }
        }
        const maxThreatScore = Math.max(...Object.values(threatScores));
        let threat = Object.entries(threatScores).find(([level, score]) => score === maxThreatScore)[0];
        if (maxThreatScore === 0) threat = 'Moderate';

        return { category, urgency, threat };
    }

    autoDetectButton.addEventListener('click', () => {
        const description = problemDesc.value.trim();
        if (!description) {
            reportError.textContent = 'Please enter a description before using auto detect.';
            return;
        }
        reportError.textContent = '';
        autoDetectButton.disabled = true;
        autoDetectButton.textContent = 'Detecting...';
        setTimeout(() => {
            const prediction = mockPredict(description);
            categorySelect.value = prediction.category;
            urgencySelect.value = prediction.urgency;
            threatSelect.value = prediction.threat;
            autoDetectButton.disabled = false;
            autoDetectButton.textContent = 'Auto Detect';
        }, 1000); // Simulate processing delay
    });

    // **Report Submission**
    document.getElementById('report-form').addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentUser) return;
        const locationName = document.getElementById('locationName').value.trim();
        const latitude = parseFloat(document.getElementById('latitude').value);
        const longitude = parseFloat(document.getElementById('longitude').value);
        const description = document.getElementById('problemDesc').value.trim();
        const category = document.getElementById('category').value;
        const urgency = document.getElementById('urgency').value;
        const threat = document.getElementById('threat').value;
        const errorDiv = document.getElementById('report-error');
        errorDiv.textContent = '';
        if (!locationName || isNaN(latitude) || isNaN(longitude) || !description || !category || !urgency || !threat) {
            errorDiv.textContent = 'Please fill in all required fields.';
            return;
        }
        if (latitude < SINGAPORE_BOUNDS.latMin || latitude > SINGAPORE_BOUNDS.latMax ||
            longitude < SINGAPORE_BOUNDS.lonMin || longitude > SINGAPORE_BOUNDS.lonMax) {
            errorDiv.textContent = 'The selected location is not within Singapore.';
            return;
        }
        const report = {
            id: reportIdCounter++,
            userEmail: currentUser.email,
            locationName,
            latitude,
            longitude,
            description,
            category,
            urgency,
            threat,
            imageDataUrl,
            status: 'Pending'
        };
        reports.push(report);
        document.getElementById('report-form').reset();
        imageDataUrl = null;
        imagePreview.innerHTML = '';
        if (tempMarker) {
            reportingMap.removeLayer(tempMarker);
            tempMarker = null;
        }
        alert('Report submitted successfully!');
        renderUserReports();
        if (currentUser.role === 'admin') {
            renderAdminReports(getFilteredReports()); // Update admin reports with current filters
        }
    });

    // **Admin Status Updates**
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('status-update')) {
            const reportId = parseInt(e.target.getAttribute('data-report-id'));
            const newStatus = e.target.value;
            const report = reports.find(r => r.id === reportId);
            if (report) {
                report.status = newStatus;
                const filteredReports = getFilteredReports();
                renderAdminReports(filteredReports);
                if (currentUser && currentUser.role !== 'admin') renderUserReports();
            }
        }
    });

    document.getElementById('admin-reports-container').addEventListener('click', (e) => {
        if (e.target.classList.contains('update-status-btn')) {
            const li = e.target.closest('li');
            const reportId = parseInt(li.getAttribute('data-report-id'));
            const select = li.querySelector('.status-update');
            const newStatus = select.value;
            const report = reports.find(r => r.id === reportId);
            if (report) {
                report.status = newStatus;
                const filteredReports = getFilteredReports();
                renderAdminReports(filteredReports);
                if (currentUser && currentUser.role !== 'admin') renderUserReports();
            }
        }
    });

    document.getElementById('refresh-reports').addEventListener('click', (e) => {
        e.preventDefault();
        renderAdminReports(reports); // Show all reports on refresh
    });

    // **Forum Post Submission**
    document.getElementById('forum-post-form').addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentUser) return;
        const title = document.getElementById('post-title').value.trim();
        const content = document.getElementById('post-content').value.trim();
        if (!title || !content) {
            alert('Please provide both a title and content for your post.');
            return;
        }
        const post = {
            id: forumPostIdCounter++,
            title,
            content,
            author: currentUser.name,
            date: new Date().toLocaleDateString()
        };
        forumPosts.push(post);
        document.getElementById('forum-post-form').reset();
        renderForumPosts();
    });

    // **Export Reports as CSV**
    function exportReports() {
        const csvRows = [];
        const headers = ['ID', 'User Email', 'Location Name', 'Latitude', 'Longitude', 'Description', 'Category', 'Urgency', 'Threat', 'Image Data URL', 'Status'];
        csvRows.push(headers.join(','));
        reports.forEach(report => {
            const row = [
                report.id,
                report.userEmail,
                report.locationName,
                report.latitude,
                report.longitude,
                `"${report.description.replace(/"/g, '""')}"`,
                report.category,
                report.urgency,
                report.threat,
                report.imageDataUrl || '',
                report.status
            ];
            csvRows.push(row.join(','));
        });
        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sgresolve-reports.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    document.getElementById('export-data').addEventListener('click', (e) => {
        e.preventDefault();
        exportReports();
    });

    // **Filter Controls**
    document.getElementById('apply-filters').addEventListener('click', (e) => {
        e.preventDefault();
        const filteredReports = getFilteredReports();
        renderAdminReports(filteredReports);
    });

    document.getElementById('reset-filters').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('image-filter').value = 'all';
        document.getElementById('category-filter').value = 'all';
        document.getElementById('urgency-filter').value = 'all';
        document.getElementById('threat-filter').value = 'all';
        renderAdminReports(reports);
    });

    // **Initialize the App**
    updateNavbar();
    hideAllPages();
    showPage(landingPage);
});

// **Chatbot Functions**
function toggleChat() {
    const chatContainer = document.getElementById('chat-container');
    chatContainer.classList.toggle('active');
}

async function sendMessage() {
    const userInput = document.getElementById("user-input").value;
    if (!userInput) return;
    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML += `<div class="message user"><strong>You:</strong> ${userInput}</div>`;
    const response = await fetch("https://test-server-naisc-production.up.railway.app/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userInput })
    });
    const data = await response.json();
    chatBox.innerHTML += `<div class="message bot"><strong>SGResolve Bot:</strong> ${data.response}</div>`;
    chatBox.scrollTop = chatBox.scrollHeight;
    document.getElementById("user-input").value = "";
}
