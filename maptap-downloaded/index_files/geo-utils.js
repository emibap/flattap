// Geography calculation utilities for MapTap
// Note: Most geo functions delegate to geoService and remain in beta.html

// ============================================================================
// DESERT BELT DETECTION
// ============================================================================

function isLocationInDesertBelt(lat, lng) {
    // North Africa: Morocco to Egypt (15°N to 37°N, -17°W to 40°E)
    if (lat >= 15 && lat <= 37 && lng >= -17 && lng <= 40) return true;

    // Arabian Peninsula and Middle East (15°N to 35°N, 35°E to 60°E)
    if (lat >= 15 && lat <= 35 && lng >= 35 && lng <= 60) return true;

    // Iran and Central Asia desert regions (25°N to 40°N, 45°E to 70°E)
    if (lat >= 25 && lat <= 40 && lng >= 45 && lng <= 70) return true;

    // Australia central desert (15°S to 30°S, 120°E to 145°E)
    if (lat >= -30 && lat <= -15 && lng >= 120 && lng <= 145) return true;

    return false;
}
