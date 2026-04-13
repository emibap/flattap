// Google Analytics Configuration
const version = "2604071";  // Format: YYMMDDV (year, month, day, version# that day)
const startTime = performance.now();  // Capture start time

function allowReporting() {
    if (window.location.hostname.includes("localhost")) return false;
    if (window.location.hostname.includes("10.")) return false;
    if (window.location.hostname.includes("192.")) return false;
    if (window.location.port.includes("8000")) return false;
    if (window.location.search.includes("letmeplay")) return false;
    if (window.location.search.includes("overrideday")) return false;
    if (window.location.search.includes("tutorial")) return false;
    if (window.location.pathname.includes("nextversion")) return false;
    return true;
}

window._ALLOW_REPORTING = allowReporting();

if (window._ALLOW_REPORTING) {
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-M0H6SPLEBJ');
}

// Export for use elsewhere if needed
window.MAPTAP_VERSION = version;
window.MAPTAP_START_TIME = startTime;