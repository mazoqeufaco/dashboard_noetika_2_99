// ============================================
// USER TRACKING SYSTEM - Noetika Dashboard
// ============================================

// Session tracking object
const trackingSession = {
    sessionId: generateSessionId(),
    startTime: new Date().toISOString(),
    userAgent: navigator.userAgent,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language,
    referrer: document.referrer,
    events: [],
    ip: null,
    location: null
};

// Generate unique session ID
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Get user's IP and location (via backend to avoid CORS issues)
async function getUserLocation() {
    try {
        // First try to get location via backend (avoids CORS)
        const response = await fetch('/api/get-location');
        if (response.ok) {
            const data = await response.json();
            if (data.ip) {
                trackingSession.ip = data.ip;
                trackingSession.location = {
                    city: data.city || '',
                    region: data.region || '',
                    country: data.country || '',
                    country_code: data.country_code || '',
                    latitude: data.latitude || '',
                    longitude: data.longitude || '',
                    timezone: data.timezone || ''
                };
                
                console.log('✅ User location tracked via backend:', trackingSession.location);
                
                // Update session on server with location data
                await updateSessionWithLocation();
                
                // Save to localStorage
                saveTrackingData();
                return;
            }
        }
        
        // Fallback: try direct API (may fail due to CORS, but worth trying)
        try {
            const directResponse = await fetch('https://ipapi.co/json/');
            if (directResponse.ok) {
                const data = await directResponse.json();
                if (data.ip && !data.error) {
                    trackingSession.ip = data.ip;
                    trackingSession.location = {
                        city: data.city || '',
                        region: data.region || '',
                        country: data.country_name || '',
                        country_code: data.country_code || '',
                        latitude: data.latitude || '',
                        longitude: data.longitude || '',
                        timezone: data.timezone || ''
                    };
                    
                    console.log('✅ User location tracked via direct API:', trackingSession.location);
                    await updateSessionWithLocation();
                    saveTrackingData();
                    return;
                }
            }
        } catch (directError) {
            console.warn('⚠️ Direct API failed (expected due to CORS):', directError.message);
        }
        
        // If all fails, at least try to get IP
        console.warn('⚠️ Could not get full location data');
        trackingSession.location = { error: 'Location not available' };
        
    } catch (error) {
        console.error('❌ Failed to get user location:', error);
        trackingSession.location = { error: 'Location not available' };
    }
}

// Track page view
function trackPageView(page) {
    trackEvent('page_view', { page });
}

// Track any event
function trackEvent(eventType, eventData = {}) {
    const event = {
        type: eventType,
        timestamp: new Date().toISOString(),
        data: eventData,
        page: getCurrentPage()
    };
    
    trackingSession.events.push(event);
    
    // Log to console for debugging (only in dev)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('📊 Event tracked:', event);
    }
    
    // Save to localStorage
    saveTrackingData();
    
    // Send to server (if available)
    sendToServer(event);
}

// Get current page/section identifier
function getCurrentPage() {
    const rankingSection = document.getElementById('rankingSection');
    const treeSection = document.getElementById('treeSection');
    const podium = document.querySelector('.podium');
    
    if (treeSection && treeSection.style.display !== 'none') {
        return 'tree';
    }
    if (rankingSection && rankingSection.style.display !== 'none') {
        return 'ranking';
    }
    if (podium) {
        return 'podium';
    }
    return 'input';
}

// Save tracking data to localStorage
function saveTrackingData() {
    try {
        localStorage.setItem('noetika_tracking_session', JSON.stringify(trackingSession));
    } catch (error) {
        console.error('Failed to save tracking data:', error);
    }
}

// Load tracking data from localStorage
function loadTrackingData() {
    try {
        const saved = localStorage.getItem('noetika_tracking_session');
        if (saved) {
            const data = JSON.parse(saved);
            // Only load if it's from today
            const savedDate = new Date(data.startTime).toDateString();
            const today = new Date().toDateString();
            if (savedDate === today) {
                return data;
            }
        }
    } catch (error) {
        console.error('Failed to load tracking data:', error);
    }
    return null;
}

// Send tracking data to server
async function sendToServer(event) {
    try {
        // Send to backend API
        const response = await fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                session: trackingSession, 
                event: event 
            })
        });
        
        if (!response.ok) {
            console.error('Server response not OK:', response.status);
        }
    } catch (error) {
        // If backend is not running, just log locally
        // Silent fail - don't spam console
    }
}

// Update session with location data when it becomes available
async function updateSessionWithLocation() {
    // If location is now available, send an update to the backend
    if (trackingSession.ip && trackingSession.location && !trackingSession.location.error) {
        try {
            await fetch('/api/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    session: trackingSession, 
                    event: { 
                        type: 'location_updated',
                        timestamp: new Date().toISOString(),
                        page: getCurrentPage(),
                        data: { ip: trackingSession.ip, location: trackingSession.location }
                    }
                })
            });
        } catch (error) {
            // Silent fail
        }
    }
}

// Track time spent on page
let pageStartTime = Date.now();
let totalTimeSpent = 0;

function updateTimeSpent() {
    const currentTime = Date.now();
    const timeOnPage = (currentTime - pageStartTime) / 1000; // seconds
    totalTimeSpent += timeOnPage;
    pageStartTime = currentTime;
    
    trackEvent('time_update', { 
        timeOnPage: Math.round(timeOnPage),
        totalTime: Math.round(totalTimeSpent)
    });
}

// Update time spent every 30 seconds
setInterval(updateTimeSpent, 30000);

// Track when user leaves page
window.addEventListener('beforeunload', () => {
    updateTimeSpent();
    trackEvent('session_end', { 
        totalDuration: Math.round(totalTimeSpent),
        totalEvents: trackingSession.events.length
    });
    
    // Try to send final data synchronously
    try {
        navigator.sendBeacon('/api/track', JSON.stringify({ 
            session: trackingSession, 
            event: { type: 'session_end', timestamp: new Date().toISOString() }
        }));
    } catch (e) {
        // Ignore errors on page unload
    }
});

// Track visibility changes (user switches tabs)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        updateTimeSpent();
        trackEvent('page_hidden');
    } else {
        pageStartTime = Date.now();
        trackEvent('page_visible');
    }
});

// Track scroll depth
let maxScrollDepth = 0;

window.addEventListener('scroll', () => {
    const scrollPercentage = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    
    if (scrollPercentage > maxScrollDepth) {
        maxScrollDepth = Math.round(scrollPercentage);
        
        // Track milestones: 25%, 50%, 75%, 100%
        if ([25, 50, 75, 100].includes(maxScrollDepth)) {
            trackEvent('scroll_depth', { depth: maxScrollDepth });
        }
    }
});

// Track clicks on buttons and interactive elements
document.addEventListener('click', (e) => {
    const target = e.target;
    const tagName = target.tagName.toLowerCase();
    
    // Track button clicks
    if (tagName === 'button' || target.classList.contains('btn')) {
        const buttonId = target.id || 'no-id';
        const buttonText = target.textContent.trim().substring(0, 50);
        trackEvent('button_click', {
            text: buttonText,
            id: buttonId,
            classes: target.className
        });
    }
    
    // Track triangle clicks
    if (target.id === 'tri' || target.closest('#tri')) {
        trackEvent('triangle_interaction', {
            element: 'canvas'
        });
    }
    
    // Track input changes (when clicking on number inputs)
    if (tagName === 'input' && target.type === 'number') {
        trackEvent('input_focus', {
            id: target.id,
            value: target.value
        });
    }
});

// Track input changes on triangle values
const inputElements = ['r', 'g', 'b'];
inputElements.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', () => {
            trackEvent('priority_change', {
                field: id,
                value: parseFloat(el.value) || 0
            });
        });
    }
});

// Export tracking data as CSV
function exportTrackingDataCSV() {
    const headers = ['Session ID', 'Event Type', 'Timestamp', 'Page', 'Data'];
    const rows = trackingSession.events.map(event => [
        trackingSession.sessionId,
        event.type,
        event.timestamp,
        event.page,
        JSON.stringify(event.data)
    ]);
    
    const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    
    return csv;
}

// Export tracking data as JSON
function exportTrackingDataJSON() {
    return JSON.stringify(trackingSession, null, 2);
}

// Download tracking data
function downloadTrackingData(format = 'csv') {
    const data = format === 'csv' ? exportTrackingDataCSV() : exportTrackingDataJSON();
    const blob = new Blob([data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noetika-tracking-${trackingSession.sessionId}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================
// INITIALIZE TRACKING
// ============================================

// Load existing session or create new one
const existingSession = loadTrackingData();
if (existingSession) {
    Object.assign(trackingSession, existingSession);
    console.log('📊 Loaded existing session:', trackingSession.sessionId);
}

// Get user location
getUserLocation();

// Track initial page view
trackPageView('input');

console.log('✅ Tracking initialized. Session ID:', trackingSession.sessionId);

// Export functions to window for debugging (only in dev)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.tracking = {
        session: trackingSession,
        exportCSV: () => downloadTrackingData('csv'),
        exportJSON: () => downloadTrackingData('json'),
        trackEvent: trackEvent
    };
    console.log('💡 Debug: Use window.tracking to access tracking functions');
}

