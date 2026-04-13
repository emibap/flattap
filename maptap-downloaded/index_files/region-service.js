/**
 * Region Service - Lazy-loads subnational region GeoJSON for the daily game
 *
 * Scans daily game cities to determine which countries need region data,
 * fetches only the needed GeoJSON files, and provides point-in-polygon lookup.
 *
 * Self-contained module — no dependencies on adventures code.
 */

const RegionService = (() => {
    // Country name (as it appears in city names or countriesData) → GeoJSON URL
    const SUPPORTED_COUNTRIES = {
        'Russia':    './assets/russia_regions.geojson',
        'China':     './assets/china_provinces.geojson',
        'India':     './assets/india_states.geojson',
        'Indonesia': './assets/indonesia_provinces.geojson',
        'Canada':    './assets/canada_provinces.geojson',
        'Mexico':    './assets/mexico_states.geojson',
        'Brazil':    './assets/brazil_states.geojson',
        'Australia': './assets/australia_states.geojson',
    };

    // Loaded region features keyed by country name
    // Each value is an array of GeoJSON features (Polygons, MultiPolygons split)
    const loadedRegions = new Map();

    // Track in-flight fetches to avoid duplicate requests
    const pendingFetches = new Map();

    /**
     * Split MultiPolygon features into individual Polygon features
     * (Globe.GL renders individual Polygons more reliably)
     */
    function processGeoJSON(geoData) {
        const features = [];
        geoData.features.forEach(feature => {
            if (feature.geometry.type === 'MultiPolygon') {
                feature.geometry.coordinates.forEach(polygonCoords => {
                    features.push({
                        ...feature,
                        geometry: { type: 'Polygon', coordinates: polygonCoords }
                    });
                });
            } else {
                features.push(feature);
            }
        });
        return features;
    }

    /**
     * Fetch and process a single country's region GeoJSON
     * Returns the processed features array, or [] on failure
     */
    async function fetchRegion(countryName) {
        if (loadedRegions.has(countryName)) {
            return loadedRegions.get(countryName);
        }

        // Deduplicate in-flight requests
        if (pendingFetches.has(countryName)) {
            return pendingFetches.get(countryName);
        }

        const url = SUPPORTED_COUNTRIES[countryName];
        if (!url) return [];

        const promise = (async () => {
            try {
                console.log(`[RegionService] Loading regions for ${countryName}...`);
                const response = await fetch(url);
                const geoData = await response.json();
                const features = processGeoJSON(geoData);
                loadedRegions.set(countryName, features);
                console.log(`[RegionService] Loaded ${features.length} region polygons for ${countryName}`);
                return features;
            } catch (err) {
                console.warn(`[RegionService] Failed to load regions for ${countryName}:`, err);
                return [];
            } finally {
                pendingFetches.delete(countryName);
            }
        })();

        pendingFetches.set(countryName, promise);
        return promise;
    }

    /**
     * Scan daily game cities and determine which supported countries appear.
     * Uses two strategies:
     *   1. Parse country from city name ("Guwahati, India" → "India")
     *   2. Point-in-polygon against countriesData for cities without country in name
     *
     * @param {Array} cities - Array of city objects with {name, lat, lng}
     * @param {Array} countriesData - Processed country GeoJSON features
     * @param {Function} isPointInPolygon - (lat, lng, geometry) → boolean
     * @returns {Set<string>} Set of country names that need region data
     */
    function detectNeededCountries(cities, countriesData, isPointInPolygon) {
        const needed = new Set();
        const supportedNames = new Set(Object.keys(SUPPORTED_COUNTRIES));

        for (const city of cities) {
            // Strategy 1: Check name for "City, Country" pattern
            if (city.name) {
                const parts = city.name.split(',');
                if (parts.length >= 2) {
                    const lastPart = parts[parts.length - 1].trim();
                    if (supportedNames.has(lastPart)) {
                        needed.add(lastPart);
                        continue;
                    }
                }
            }

            // Strategy 2: Point-in-polygon lookup against country boundaries
            if (city.lat != null && city.lng != null && countriesData) {
                for (const country of countriesData) {
                    const name = country.properties.name || country.properties.NAME;
                    if (name && supportedNames.has(name)) {
                        if (isPointInPolygon(city.lat, city.lng, country.geometry)) {
                            needed.add(name);
                            break;
                        }
                    }
                }
            }
        }

        return needed;
    }

    /**
     * Scan cities and load all needed region GeoJSON files.
     * Call this after both game data and countries GeoJSON are loaded.
     *
     * @param {Array} cities - Daily game cities
     * @param {Array} countriesData - Processed country GeoJSON features
     * @param {Function} isPointInPolygon - (lat, lng, geometry) → boolean
     * @returns {Promise<Map>} Map of country name → features[]
     */
    async function scanAndLoad(cities, countriesData, isPointInPolygon) {
        const needed = detectNeededCountries(cities, countriesData, isPointInPolygon);

        if (needed.size === 0) {
            console.log('[RegionService] No supported region countries in today\'s game');
            return loadedRegions;
        }

        console.log(`[RegionService] Loading regions for: ${[...needed].join(', ')}`);
        await Promise.all([...needed].map(country => fetchRegion(country)));
        return loadedRegions;
    }

    /**
     * Find which region a point falls in for a given country.
     *
     * @param {string} countryName - Country to search regions for
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {Function} isPointInPolygon - (lat, lng, geometry) → boolean
     * @returns {string|null} Region name, or null if not found
     */
    function findRegionForPoint(countryName, lat, lng, isPointInPolygon) {
        const features = loadedRegions.get(countryName);
        if (!features) return null;

        for (const feature of features) {
            if (isPointInPolygon(lat, lng, feature.geometry)) {
                return feature.properties.name;
            }
        }
        return null;
    }

    /**
     * Get all loaded features for a specific country
     */
    function getFeatures(countryName) {
        return loadedRegions.get(countryName) || [];
    }

    /**
     * Get all loaded features across all countries (for rendering)
     */
    function getAllFeatures() {
        const all = [];
        for (const features of loadedRegions.values()) {
            all.push(...features);
        }
        return all;
    }

    /**
     * Check if a country has loaded region data
     */
    function hasRegions(countryName) {
        return loadedRegions.has(countryName) && loadedRegions.get(countryName).length > 0;
    }

    /**
     * Check if a country name is in the supported list
     */
    function isSupported(countryName) {
        return SUPPORTED_COUNTRIES.hasOwnProperty(countryName);
    }

    return {
        SUPPORTED_COUNTRIES,
        detectNeededCountries,
        scanAndLoad,
        fetchRegion,
        findRegionForPoint,
        getFeatures,
        getAllFeatures,
        hasRegions,
        isSupported,
    };
})();

// Export for use
window.RegionService = RegionService;
