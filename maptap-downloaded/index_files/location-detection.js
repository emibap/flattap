/**
 * Location Detection Service
 * Handles click coordinate processing, distance calculations, and region type detection
 * This service determines what type of location was clicked and calculates appropriate distances
 */

class LocationDetectionService {
    constructor() {
        this.geoService = null; // Will be set during initialization
    }

    /**
     * Initialize with geography service reference
     */
    initialize(geographyService) {
        this.geoService = geographyService;
    }

    /**
     * Detect location type and return metadata
     * @param {Object} location - Location object with name and optional lat/lng
     * @returns {Object} - { type: 'city'|'country'|'state'|'region', name: string, lat: number, lng: number }
     */
    detectLocationType(location) {
        console.log(`[LOCATION TYPE] Detecting type for location:`, location);
        console.log(`[LOCATION TYPE] Has lat: ${!!location.lat}, Has lng: ${!!location.lng}, Has name: ${!!location.name}`);

        // Check if it's a misc region clue (most specific, check first)
        if (location.isRegionOnly) {
            console.log(`[LOCATION TYPE] → Detected as MISC REGION (isRegionOnly=true)`);
            return {
                type: 'region',
                name: location.regionName || location.name,
                lat: location.lat || 0,
                lng: location.lng || 0,
                isRegionOnly: true
            };
        }

        // Check if it's a state-only clue
        if (location.isStateOnly) {
            console.log(`[LOCATION TYPE] → Detected as STATE (isStateOnly=true)`);
            return {
                type: 'state',
                name: location.stateName || location.name,
                lat: location.lat || 0,
                lng: location.lng || 0,
                isStateOnly: true
            };
        }

        // Check if it's a country-only clue (no specific coordinates)
        if (location.isCountryOnly || (!location.lat && !location.lng && location.name)) {
            console.log(`[LOCATION TYPE] → Detected as COUNTRY/REGION (no lat/lng, will check polygons)`);
            console.log(`[LOCATION TYPE] Will look for: "${location.countryName || location.name}"`);
            return {
                type: 'country',
                name: location.countryName || location.name,
                lat: location.lat || 0,
                lng: location.lng || 0,
                isCountryOnly: true
            };
        }

        // Regular city/point location
        console.log(`[LOCATION TYPE] → Detected as CITY (has coordinates)`);
        return {
            type: 'city',
            name: location.name,
            lat: location.lat,
            lng: location.lng,
            isCountryOnly: false,
            isStateOnly: false
        };
    }

    /**
     * Calculate distance from click to target location
     * Handles different location types (cities, countries, states, custom regions)
     * @param {number} clickLat - Latitude of click
     * @param {number} clickLng - Longitude of click
     * @param {Object} targetLocation - The target location object
     * @returns {Object} - { distance: number, floatScore: number, isPerfect: boolean }
     */
    calculateDistance(clickLat, clickLng, targetLocation) {
        console.log(`[SCORING FLOW] ========== Starting distance calculation ==========`);
        console.log(`[SCORING FLOW] Click at: (${clickLat}, ${clickLng})`);
        console.log(`[SCORING FLOW] Target location: "${targetLocation.name}"`);

        const locationType = this.detectLocationType(targetLocation);

        if (locationType.type === 'region') {
            console.log(`[SCORING FLOW] → Calling calculateCountryDistance() for misc region - will check misc regions first`);
            return this.calculateCountryDistance(clickLat, clickLng, targetLocation);
        } else if (locationType.type === 'state') {
            console.log(`[SCORING FLOW] → Calling calculateStateDistance()`);
            return this.calculateStateDistance(clickLat, clickLng, targetLocation);
        } else if (locationType.type === 'country') {
            console.log(`[SCORING FLOW] → Calling calculateCountryDistance() - will check misc regions first`);
            return this.calculateCountryDistance(clickLat, clickLng, targetLocation);
        } else {
            console.log(`[SCORING FLOW] → Calling calculatePointDistance()`);
            return this.calculatePointDistance(clickLat, clickLng, targetLocation);
        }
    }

    /**
     * Calculate distance to a country or region (polygon-based)
     * @private
     */
    calculateCountryDistance(clickLat, clickLng, targetLocation) {
        const countryName = targetLocation.countryName || targetLocation.name;
        const countryDistance = this.geoService.getDistanceToCountry(clickLat, clickLng, countryName);

        if (countryDistance === 0) {
            // Clicked inside the country! Perfect score
            return {
                distance: 0,
                floatScore: 1.0,
                isPerfect: true
            };
        } else if (countryDistance === -1) {
            // Country not found in polygon data - fall back to center distance
            const distance = Math.round(calculateGreatCircleDistanceKm(clickLat, clickLng, targetLocation.lat, targetLocation.lng));
            return {
                distance: distance,
                floatScore: calculateScore(distance),
                isPerfect: false
            };
        } else {
            // Clicked outside - use distance to nearest border
            const distance = Math.round(countryDistance);
            return {
                distance: distance,
                floatScore: calculateScore(distance),
                isPerfect: false
            };
        }
    }

    /**
     * Calculate distance to a US state (polygon-based)
     * @private
     */
    calculateStateDistance(clickLat, clickLng, targetLocation) {
        const stateName = targetLocation.stateName || targetLocation.name;
        const stateDistance = this.geoService.getDistanceToState(clickLat, clickLng, stateName);

        if (stateDistance === 0) {
            // Clicked inside the state! Perfect score
            return {
                distance: 0,
                floatScore: 1.0,
                isPerfect: true
            };
        } else if (stateDistance === -1) {
            // State not found in polygon data - fall back to center distance
            const distance = Math.round(calculateGreatCircleDistanceKm(clickLat, clickLng, targetLocation.lat, targetLocation.lng));
            return {
                distance: distance,
                floatScore: calculateScore(distance),
                isPerfect: false
            };
        } else {
            // Clicked outside - use distance to nearest border
            const distance = Math.round(stateDistance);
            return {
                distance: distance,
                floatScore: calculateScore(distance),
                isPerfect: false
            };
        }
    }

    /**
     * Calculate distance to a specific point (city/location)
     * @private
     */
    calculatePointDistance(clickLat, clickLng, targetLocation) {
        const distance = Math.round(calculateGreatCircleDistanceKm(clickLat, clickLng, targetLocation.lat, targetLocation.lng));
        return {
            distance: distance,
            floatScore: calculateScore(distance),
            isPerfect: distance === 0
        };
    }

    /**
     * Find the closest city from a list of cities
     * Used in "top five" and "five from many" game modes
     * @param {number} lat - Click latitude
     * @param {number} lng - Click longitude
     * @param {Array} cities - Array of city objects
     * @returns {Object} - Closest city object
     */
    findClosestCity(lat, lng, cities) {
        let closestCity = null;
        let minDistance = Infinity;

        for (const city of cities) {
            if (!city.lat || !city.lng) continue; // Skip cities without coordinates

            const distance = calculateGreatCircleDistanceKm(lat, lng, city.lat, city.lng);
            if (distance < minDistance) {
                minDistance = distance;
                closestCity = city;
            }
        }

        return closestCity;
    }

    /**
     * Validate that a location has the required data for distance calculation
     * @param {Object} location - Location object to validate
     * @returns {boolean} - True if valid, false otherwise
     */
    validateLocation(location) {
        if (!location) {
            console.error('[LocationDetection] Location is null or undefined');
            return false;
        }

        if (!location.name) {
            console.error('[LocationDetection] Location has no name');
            return false;
        }

        // State-only clues are valid without lat/lng (check first, more specific)
        if (location.isStateOnly || location.stateName) {
            return true;
        }

        // Country-only clues are valid without lat/lng
        if (location.isCountryOnly || location.countryName) {
            return true;
        }

        // Regular locations need coordinates
        if (typeof location.lat !== 'number' || typeof location.lng !== 'number') {
            console.error(`[LocationDetection] Location "${location.name}" missing valid coordinates`);
            return false;
        }

        return true;
    }
}

// Create singleton instance
const locationDetectionService = new LocationDetectionService();

/**
 * Calculate great circle distance between two points on Earth
 * Uses Haversine formula
 * @param {number} lat1 - First point latitude
 * @param {number} lng1 - First point longitude
 * @param {number} lat2 - Second point latitude
 * @param {number} lng2 - Second point longitude
 * @returns {number} - Distance in kilometers
 */
function calculateGreatCircleDistanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Calculate score from distance (0 to 1, where 1 is perfect)
 * Uses exponential decay function
 * @param {number} distance - Distance in kilometers
 * @returns {number} - Score from 0 to 1
 */
function calculateScore(distance) {
    // Earth is 40,000km around. If you are 20km away you are the maximum you can be. 10km is the right hemisphere.
    const maxDistance = 16250; // Define a maximum distance for the score calculation
    if (distance >= maxDistance) {
        if (distance < 16750) {
            return 0.01;
        }
        return 0; // If the distance is greater than maxDistance, score is 0
    }

    const scaledDistance = distance / maxDistance;
    console.log("score", Math.exp(-scaledDistance * 3.5));
    return Math.exp(-scaledDistance * 3.5); // Exponential function to increase scores for closer
}
