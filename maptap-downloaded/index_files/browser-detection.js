// Enhanced Browser Detection for Load Diagnostics
// Specifically identifies embedded browsers (Facebook, Instagram, etc.)

function detectDetailedBrowser() {
    const ua = navigator.userAgent;

    // Embedded browser detection
    if (ua.includes('FBAN') || ua.includes('FBAV')) {
        return 'Facebook App';
    }
    if (ua.includes('Instagram')) {
        return 'Instagram App';
    }
    if (ua.includes('Twitter')) {
        return 'Twitter App';
    }
    if (ua.includes('TikTok')) {
        return 'TikTok App';
    }
    if (ua.includes('Line/')) {
        return 'Line App';
    }
    if (ua.includes('WhatsApp')) {
        return 'WhatsApp';
    }
    if (ua.includes('Snapchat')) {
        return 'Snapchat';
    }
    if (ua.includes('LinkedIn')) {
        return 'LinkedIn App';
    }
    if (ua.includes('Messenger')) {
        return 'Facebook Messenger';
    }

    // Standard browsers
    if (ua.includes('CriOS')) {
        return 'Chrome iOS';
    }
    if (ua.includes('FxiOS')) {
        return 'Firefox iOS';
    }
    if (ua.includes('EdgiOS')) {
        return 'Edge iOS';
    }

    // Desktop/Android browsers
    if (ua.includes('Chrome') && !ua.includes('Edg')) {
        return 'Chrome';
    }
    if (ua.includes('Safari') && !ua.includes('Chrome')) {
        return 'Safari';
    }
    if (ua.includes('Firefox')) {
        return 'Firefox';
    }
    if (ua.includes('Edg')) {
        return 'Edge';
    }
    if (ua.includes('Samsung')) {
        return 'Samsung Browser';
    }

    return 'Other';
}

// Report detailed browser info
window.MAPTAP_DETAILED_BROWSER = detectDetailedBrowser();
console.log('Detailed browser detected:', window.MAPTAP_DETAILED_BROWSER);

// Set as GA4 user property so it's attached to ALL events (including automatic ones like first_visit)
if (typeof gtag === 'function') {
    gtag('set', 'user_properties', {
        detailed_browser: window.MAPTAP_DETAILED_BROWSER
    });
    console.log('Set detailed_browser as GA4 user property');
}
