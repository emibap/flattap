/**
 * Geography Service - Handles country/state highlighting and polygon geometry
 * Manages country and state polygon data, highlighting, and distance calculations
 */

class GeographyService {
    constructor() {
        this.countriesData = [];
        this.statesData = [];
        this.miscRegionsData = [];  // For custom regions like Siberia
        this.subnationalRegionData = [];  // Subnational regions (provinces, states) loaded by RegionService
        this.highlightedCountries = new Set();
        this.highlightedStates = new Set();
        this.highlightedMiscRegions = new Set();
        this.highlightedSubnationalRegions = new Set();
        this.globe = null;

        // Lazy loading support - queue highlights until data is available
        this.isDataLoaded = false;
        this.pendingHighlights = [];  // Queue of {lat, lng, cityObject} to process when data loads
    }

    /**
     * Initialize with globe instance and load polygon data
     */
    initialize(globe) {
        this.globe = globe;
    }

    /**
     * Set polygon data
     */
    setCountriesData(data) {
        this.countriesData = data;
    }

    setStatesData(data) {
        this.statesData = data;
    }

    setMiscRegionsData(data) {
        this.miscRegionsData = data;
    }

    setSubnationalRegionData(data) {
        this.subnationalRegionData = data;
    }

    /**
     * Mark GeoJSON data as fully loaded and process any pending highlights
     * Called after all GeoJSON (countries, states, misc regions) is loaded
     */
    markDataLoaded() {
        if (this.isDataLoaded) return;  // Already processed

        this.isDataLoaded = true;
        const pendingCount = this.pendingHighlights.length;
        console.log(`[GeographyService] Data loaded. Processing ${pendingCount} pending highlights...`);

        if (pendingCount > 0) {
            // Process all pending highlights - add to Sets without animation
            const pending = this.pendingHighlights;
            this.pendingHighlights = [];  // Clear before processing to avoid re-queueing

            // Temporarily disable the per-highlight fade animation
            // by processing highlights and collecting which regions to show
            pending.forEach(request => {
                // Call highlightCountryForCity but we'll override the animation
                this.highlightCountryForCity(request.lat, request.lng, request.cityObject);
            });

            // The individual highlights have their own fade-in delays,
            // but since we're processing them all at once, they'll layer nicely
            console.log(`[GeographyService] ✓ Processed ${pendingCount} pending highlights`);
        }
    }

    /**
     * Check if a search name matches a region (by name or altNames)
     * @param {Object} region - GeoJSON feature with properties.name and optional properties.altNames
     * @param {string} searchName - The name to search for (e.g., "Lake Turkana, Kenya")
     * @returns {boolean} - True if the searchName matches name or any altName
     */
    regionNameMatches(region, searchName) {
        const regionName = region.properties.name;
        const altNames = region.properties.altNames || [];
        const search = searchName.toLowerCase();

        if (regionName && regionName.toLowerCase() === search) return true;
        return altNames.some(alt => alt.toLowerCase() === search);
    }

    /**
     * Clear all country highlights with fade-out animation
     */
    clearCountryHighlights() {
        // Quick fade-out animation (200ms total)
        let fadeOpacity = 1;
        const fadeInterval = setInterval(() => {
            fadeOpacity -= 0.5;  // Bigger steps (2 steps total)
            if (fadeOpacity <= 0) {
                fadeOpacity = 0;
                clearInterval(fadeInterval);
                this.highlightedCountries.clear();
                this.highlightedStates.clear();
                this.highlightedMiscRegions.clear();
                this.highlightedSubnationalRegions.clear();
            }
            this.updateCountryHighlights(fadeOpacity);
        }, 100); // 2 steps × 100ms = 200ms quick fade
    }

    /**
     * Check if a polygon is degenerate (flat line with no area)
     * These cause Globe.GL rendering artifacts
     */
    isDegeneratePolygon(geometry) {
        if (geometry.type !== 'Polygon') return false;

        const coords = geometry.coordinates[0];
        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;

        coords.forEach(point => {
            minLng = Math.min(minLng, point[0]);
            maxLng = Math.max(maxLng, point[0]);
            minLat = Math.min(minLat, point[1]);
            maxLat = Math.max(maxLat, point[1]);
        });

        const latSpan = maxLat - minLat;
        const lngSpan = maxLng - minLng;
        const MIN_SPAN = 0.001; // Minimum degrees for a valid polygon (~100m)

        if (latSpan < MIN_SPAN || lngSpan < MIN_SPAN) {
            console.log(`[isDegeneratePolygon] Filtering out degenerate polygon:`,
                `latSpan=${latSpan.toFixed(6)}, lngSpan=${lngSpan.toFixed(6)}, points=${coords.length}`);
            return true;
        }

        return false;
    }

    /**
     * Update globe with currently highlighted polygons
     */
    updateCountryHighlights(opacity = 1) {
        if (!this.globe) return;

        // Only render polygons that are actually highlighted
        const visiblePolygons = [];

        // Add highlighted misc regions (highest priority - render first)
        if (this.miscRegionsData) {
            this.miscRegionsData.forEach(region => {
                if (this.highlightedMiscRegions.has(region.properties.name)) {
                    if (!this.isDegeneratePolygon(region.geometry)) {
                        visiblePolygons.push(region);
                    }
                }
            });
        }

        // Add highlighted countries
        this.countriesData.forEach(country => {
            const countryName = country.properties.name || country.properties.NAME;
            if (this.highlightedCountries.has(countryName)) {
                if (!this.isDegeneratePolygon(country.geometry)) {
                    visiblePolygons.push(country);
                }
            }
        });

        // Add highlighted states
        this.statesData.forEach(state => {
            if (this.highlightedStates.has(state.properties.name)) {
                if (!this.isDegeneratePolygon(state.geometry)) {
                    visiblePolygons.push(state);
                }
            }
        });

        // Add highlighted subnational regions (provinces, states of other countries)
        this.subnationalRegionData.forEach(region => {
            if (this.highlightedSubnationalRegions.has(region.properties.name)) {
                if (!this.isDegeneratePolygon(region.geometry)) {
                    visiblePolygons.push(region);
                }
            }
        });

        // Only send visible polygons to Globe.GL
        this.globe
            .polygonsData(visiblePolygons)
            .polygonCapColor(() => `rgba(68, 248, 251, ${0.3 * opacity})`)  // Increased from 0.1
            .polygonSideColor(() => `rgba(68, 248, 251, ${0.6 * opacity})`)  // Increased from 0.4
            .polygonStrokeColor(() => `rgba(68, 248, 251, ${0.5 * opacity})`)  // Increased from 0.3
            .polygonAltitude(() => 0.003);  // Slightly raised to avoid z-fighting
    }

    /**
     * Highlight country/state for a given city location
     * If GeoJSON data isn't loaded yet, queues the request for later processing
     */
    highlightCountryForCity(lat, lng, cityObject = null) {
        // If data isn't loaded yet, queue this request for later
        if (!this.isDataLoaded) {
            console.log(`[GeographyService] Data not loaded yet, queueing highlight for ${cityObject?.name || `${lat},${lng}`}`);
            this.pendingHighlights.push({ lat, lng, cityObject });
            return;
        }

        let foundCountry = false;
        let foundCountryName = null;
        let closestCountry = null;
        let closestDistance = Infinity;
        const MAX_DISTANCE_KM = 20; // Max distance to consider for "closest country" fallback (20km for border cities and islands)

        // Priority check: If city object has explicit highlight property, use that
        if (cityObject && cityObject.highlight) {
            const highlightName = cityObject.highlight.trim();

            // Check for "none" directive to skip highlighting
            if (highlightName.toLowerCase() === 'none') {
                console.log(`Explicit highlight="none" - skipping all highlighting`);
                return; // Exit early, don't highlight anything
            }

            console.log(`Found explicit highlight directive: "${highlightName}"`);

            // First check if it's a misc region (supports altNames)
            for (const region of this.miscRegionsData) {
                if (this.regionNameMatches(region, highlightName)) {
                    this.highlightedMiscRegions.add(region.properties.name);
                    this.updateCountryHighlights(1);
                    return; // Found region, exit early
                }
            }

            // Then check if it's a country
            for (const country of this.countriesData) {
                const countryDataName = country.properties.name || country.properties.NAME;
                if (countryDataName &&
                    (countryDataName.toLowerCase() === highlightName.toLowerCase() ||
                     (highlightName.toLowerCase() === 'usa' && countryDataName.toLowerCase() === 'united states') ||
                     (highlightName.toLowerCase() === 'uk' && countryDataName.toLowerCase() === 'united kingdom') ||
                     (highlightName.toLowerCase() === 'uae' && countryDataName.toLowerCase() === 'united arab emirates'))) {
                    foundCountryName = countryDataName;
                    foundCountry = true;
                    console.log(`✓ Using explicit highlight country: ${countryDataName}`);
                    break;
                }
            }

            // If not a country, check if it's a US state (no coordinate check for explicit highlights)
            if (!foundCountry) {
                for (const state of this.statesData) {
                    const stateDataName = state.properties.name;
                    if (stateDataName &&
                        (stateDataName.toLowerCase() === highlightName.toLowerCase() ||
                         this.matchesStateAbbreviation(highlightName, stateDataName))) {
                        // Set as USA but will highlight the specific state
                        foundCountryName = 'United States';
                        foundCountry = true;
                        console.log(`✓ Using explicit highlight state: ${stateDataName}`);
                        // Store the state name for later highlighting
                        cityObject._explicitState = stateDataName;
                        break;
                    }
                }
            }
        }

        // First pass: Check if city object has country name in format "City, Country"
        if (!foundCountry && cityObject && cityObject.name) {
            const nameParts = cityObject.name.split(',');
            if (nameParts.length >= 2) {
                // Get the last part (country name) and trim whitespace
                const countryFromName = nameParts[nameParts.length - 1].trim();
                console.log(`Checking if "${countryFromName}" from target name is a valid country...`);

                // Check if this country name exists in our data
                for (const country of this.countriesData) {
                    const countryDataName = country.properties.name || country.properties.NAME;
                    // Case-insensitive comparison and handle common variations
                    if (countryDataName &&
                        (countryDataName.toLowerCase() === countryFromName.toLowerCase() ||
                         (countryFromName.toLowerCase() === 'usa' && countryDataName.toLowerCase() === 'united states') ||
                         (countryFromName.toLowerCase() === 'uk' && countryDataName.toLowerCase() === 'united kingdom') ||
                         (countryFromName.toLowerCase() === 'uae' && countryDataName.toLowerCase() === 'united arab emirates'))) {
                        foundCountryName = countryDataName;
                        foundCountry = true;
                        console.log(`✓ Using country from target name: ${countryDataName}`);
                        break;
                    }
                }
            }
        }

        // Second pass: If no name match, check if point is inside any country polygon
        if (!foundCountry) {
            for (const country of this.countriesData) {
                if (this.isPointInPolygon(lat, lng, country.geometry)) {
                    const countryName = country.properties.name || country.properties.NAME;
                    foundCountryName = countryName;
                    foundCountry = true;
                    console.log(`✓ Found country by coordinates: ${countryName}`);
                    break; // Found the country containing this point
                }
            }
        }

        // Third pass: If still no match, find closest country within threshold
        if (!foundCountry) {
            console.log(`No exact country match for ${lat}, ${lng}. Finding closest...`);

            const nearbyCountries = []; // Track all countries within 100km for debugging

            // Check ALL countries and find the closest one
            for (const country of this.countriesData) {
                // Get distance to nearest point on polygon
                const distance = this.getDistanceToPolygon(lat, lng, country.geometry);
                const countryName = country.properties.name || country.properties.NAME;

                // Log countries within 100km for debugging
                if (distance <= 100) {
                    nearbyCountries.push({name: countryName, distance: distance});
                }

                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestCountry = countryName;
                }
            }

            // Sort and log nearby countries
            if (nearbyCountries.length > 0) {
                nearbyCountries.sort((a, b) => a.distance - b.distance);
                console.log(`Countries within 100km:`);
                nearbyCountries.forEach(c => {
                    console.log(`  - ${c.name}: ${c.distance.toFixed(2)}km`);
                });
            } else {
                console.log(`No countries within 100km`);
            }

            // Only use the closest country if it's within threshold
            if (closestDistance <= MAX_DISTANCE_KM) {
                foundCountryName = closestCountry;
                foundCountry = true;
                console.log(`✓ Using closest country: ${closestCountry} (${closestDistance.toFixed(2)}km away)`);
            } else {
                console.log(`✗ Closest country ${closestCountry} is too far (${closestDistance.toFixed(1)}km), not highlighting`);
            }
        }

        if (foundCountryName) {
            // If it's the United States, highlight the state instead
            if (foundCountryName === 'United States' || foundCountryName === 'USA') {
                let foundState = false;
                let foundStateName = null;
                let closestState = null;
                let closestStateDistance = Infinity;
                const MAX_STATE_DISTANCE_KM = 20; // Same threshold for states

                // Priority: Check if we already identified an explicit state
                if (cityObject && cityObject._explicitState) {
                    foundStateName = cityObject._explicitState;
                    foundState = true;
                    console.log(`✓ Using previously identified explicit state: ${foundStateName}`);
                }

                // First: Check if city object exists and has state name in format "City, State"
                if (!foundState && cityObject && cityObject.name) {
                    const nameParts = cityObject.name.split(',');
                    // For US states, format is "City, State" (no country)
                    if (nameParts.length === 2) {
                        const stateFromName = nameParts[1].trim();
                        console.log(`Checking if "${stateFromName}" from target name is a valid US state...`);

                        // Check if this state name exists in our data
                        for (const state of this.statesData) {
                            const stateDataName = state.properties.name;
                            // Handle state name variations and abbreviations
                            if (stateDataName &&
                                (stateDataName.toLowerCase() === stateFromName.toLowerCase() ||
                                 this.matchesStateAbbreviation(stateFromName, stateDataName))) {
                                foundStateName = stateDataName;
                                foundState = true;
                                console.log(`✓ Using state from target name: ${stateDataName}`);
                                break;
                            }
                        }
                    }
                }

                // Second: If no name match, check if point is inside any state polygon
                if (!foundState) {
                    for (const state of this.statesData) {
                        if (this.isPointInPolygon(lat, lng, state.geometry)) {
                            foundStateName = state.properties.name;
                            foundState = true;
                            console.log(`✓ Found state by coordinates: ${foundStateName}`);
                            break;
                        }
                    }
                }

                // Third: If still no match, find closest state within threshold
                if (!foundState) {
                    console.log(`No exact state match for ${lat}, ${lng}. Finding closest state...`);
                    const nearbyStates = [];

                    for (const state of this.statesData) {
                        const distance = this.getDistanceToPolygon(lat, lng, state.geometry);
                        const stateName = state.properties.name;

                        if (distance <= 100) {
                            nearbyStates.push({name: stateName, distance: distance});
                        }

                        if (distance < closestStateDistance) {
                            closestStateDistance = distance;
                            closestState = stateName;
                        }
                    }

                    // Log nearby states
                    if (nearbyStates.length > 0) {
                        nearbyStates.sort((a, b) => a.distance - b.distance);
                        console.log(`States within 100km:`);
                        nearbyStates.forEach(s => {
                            console.log(`  - ${s.name}: ${s.distance.toFixed(2)}km`);
                        });
                    }

                    // Use closest state if within threshold
                    if (closestStateDistance <= MAX_STATE_DISTANCE_KM) {
                        foundStateName = closestState;
                        foundState = true;
                        console.log(`✓ Using closest state: ${closestState} (${closestStateDistance.toFixed(2)}km away)`);
                    } else {
                        console.log(`✗ Closest state ${closestState} is too far (${closestStateDistance.toFixed(1)}km), not highlighting`);
                    }
                }

                // Add the state if found
                if (foundState && foundStateName) {
                    this.highlightedStates.add(foundStateName);
                }
            } else {
                // For all other countries, add the country name
                // updateCountryHighlights will highlight ALL polygons with this name
                this.highlightedCountries.add(foundCountryName);

                // Also highlight subnational region if RegionService has data for this country
                if (typeof RegionService !== 'undefined' && RegionService.hasRegions(foundCountryName)) {
                    const regionName = RegionService.findRegionForPoint(
                        foundCountryName, lat, lng,
                        (rlat, rlng, geom) => this.isPointInPolygon(rlat, rlng, geom)
                    );
                    if (regionName) {
                        console.log(`✓ Found subnational region: ${regionName} (${foundCountryName})`);
                        this.highlightedSubnationalRegions.add(regionName);
                    }
                }
            }
        }

        if (foundCountry) {
            // Delay fade-in by 500ms, then animate
            setTimeout(() => {
                let fadeOpacity = 0;
                const fadeInterval = setInterval(() => {
                    fadeOpacity += 0.2;  // Bigger steps (5 steps total)
                    if (fadeOpacity >= 1) {
                        fadeOpacity = 1;
                        clearInterval(fadeInterval);
                    }
                    this.updateCountryHighlights(fadeOpacity);
                }, 100);  // 5 steps × 100ms = 500ms fade-in
            }, 400); // 0.4 second delay before fade-in starts
        }
    }

    /**
     * Helper function to get distance from point to polygon edge
     */
    getDistanceToPolygon(lat, lng, geometry) {
        if (geometry.type !== 'Polygon') return Infinity;

        let minDistance = Infinity;
        const ring = geometry.coordinates[0];

        // Check distance to each edge of the polygon
        for (let i = 0; i < ring.length - 1; i++) {
            const distance = this.distanceToLineSegment(lat, lng, ring[i][1], ring[i][0], ring[i+1][1], ring[i+1][0]);
            if (distance < minDistance) {
                minDistance = distance;
            }
        }

        return minDistance;
    }

    /**
     * Find the center of the largest polygon for a country (handles multi-polygon countries)
     */
    getCountryCenter(countryName) {
        const lowerName = countryName.toLowerCase();

        // First check our comprehensive center_of.js data
        if (typeof centerOf !== 'undefined' && centerOf.countries && centerOf.countries[lowerName]) {
            return centerOf.countries[lowerName];
        }

        // If centerOf data not available, fall back to calculating from countriesData
        if (!this.countriesData) {
            return null;
        }

        // Find all polygons for this country
        let largestPolygon = null;
        let largestArea = 0;
        let polygonCount = 0;

        for (const country of this.countriesData) {
            const name = country.properties.name || country.properties.NAME;
            if (name) {
                if (name.toLowerCase() === countryName.toLowerCase()) {
                    if (country.geometry.type === 'Polygon') {
                        // Single polygon - calculate its area
                        polygonCount = 1;
                        const area = this.getPolygonArea(country.geometry.coordinates[0]);
                        if (area > largestArea) {
                            largestArea = area;
                            largestPolygon = country.geometry.coordinates[0];
                        }
                    } else if (country.geometry.type === 'MultiPolygon') {
                        // Multiple polygons - find the largest one
                        polygonCount = country.geometry.coordinates.length;
                        for (const polygon of country.geometry.coordinates) {
                            const area = this.getPolygonArea(polygon[0]);
                            if (area > largestArea) {
                                largestArea = area;
                                largestPolygon = polygon[0];
                            }
                        }
                    }
                }
            }
        }

        if (largestPolygon) {
            const center = this.getPolygonCentroid(largestPolygon);

            // Sanity check - if center seems way off, use a fallback
            if (Math.abs(center.lat) > 85 || Math.abs(center.lng) > 180) {
                console.warn(`Invalid center calculated for ${countryName}, using bounding box center instead`);
                // Calculate bounding box center as fallback
                let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
                for (const point of largestPolygon) {
                    minLng = Math.min(minLng, point[0]);
                    maxLng = Math.max(maxLng, point[0]);
                    minLat = Math.min(minLat, point[1]);
                    maxLat = Math.max(maxLat, point[1]);
                }
                return {
                    lat: (minLat + maxLat) / 2,
                    lng: (minLng + maxLng) / 2
                };
            }

            return center;
        }

        return null;
    }

    /**
     * Find the center of the largest polygon for a US state (handles multi-polygon states)
     */
    getStateCenter(stateName) {
        const lowerName = stateName.toLowerCase();

        // First check our comprehensive center_of.js data
        if (typeof centerOf !== 'undefined' && centerOf.states && centerOf.states[lowerName]) {
            return centerOf.states[lowerName];
        }

        // If centerOf data not available, fall back to calculating from statesData
        if (!this.statesData || this.statesData.length === 0) {
            return null;
        }

        // Find all polygons for this state
        let largestPolygon = null;
        let largestArea = 0;
        let polygonCount = 0;

        for (const state of this.statesData) {
            const name = state.properties.name;
            if (name) {
                if (name.toLowerCase() === stateName.toLowerCase() ||
                    this.matchesStateAbbreviation(stateName, name)) {

                    if (state.geometry.type === 'Polygon') {
                        // Single polygon - calculate its area
                        polygonCount = 1;
                        const area = this.getPolygonArea(state.geometry.coordinates[0]);
                        if (area > largestArea) {
                            largestArea = area;
                            largestPolygon = state.geometry.coordinates[0];
                        }
                    } else if (state.geometry.type === 'MultiPolygon') {
                        // Multiple polygons - find the largest one
                        polygonCount = state.geometry.coordinates.length;
                        for (const polygon of state.geometry.coordinates) {
                            const area = this.getPolygonArea(polygon[0]);
                            if (area > largestArea) {
                                largestArea = area;
                                largestPolygon = polygon[0];
                            }
                        }
                    }
                    break; // State names are unique, no need to continue
                }
            }
        }

        if (largestPolygon) {
            const center = this.getPolygonCentroid(largestPolygon);

            // Sanity check - if center seems way off, use a fallback
            if (Math.abs(center.lat) > 85 || Math.abs(center.lng) > 180) {
                // Calculate bounding box center as fallback
                let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
                for (const point of largestPolygon) {
                    minLng = Math.min(minLng, point[0]);
                    maxLng = Math.max(maxLng, point[0]);
                    minLat = Math.min(minLat, point[1]);
                    maxLat = Math.max(maxLat, point[1]);
                }
                return {
                    lat: (minLat + maxLat) / 2,
                    lng: (minLng + maxLng) / 2
                };
            }

            return center;
        }

        return null;
    }

    /**
     * Find the center of a misc region by name (supports altNames)
     * @param {string} regionName - Name to search for (e.g., "Lake Turkana, Kenya")
     * @returns {Object|null} - { lat, lng } or null if not found
     */
    getMiscRegionCenter(regionName) {
        if (!this.miscRegionsData || this.miscRegionsData.length === 0) {
            return null;
        }

        // Find the matching region (supports altNames)
        let matchedRegion = null;
        for (const region of this.miscRegionsData) {
            if (this.regionNameMatches(region, regionName)) {
                matchedRegion = region;
                break;
            }
        }

        if (!matchedRegion) {
            return null;
        }

        // Calculate center from the polygon
        const geometry = matchedRegion.geometry;
        let largestPolygon = null;
        let largestArea = 0;

        if (geometry.type === 'Polygon') {
            largestPolygon = geometry.coordinates[0];
        } else if (geometry.type === 'MultiPolygon') {
            // Find the largest polygon
            for (const polygon of geometry.coordinates) {
                const area = this.getPolygonArea(polygon[0]);
                if (area > largestArea) {
                    largestArea = area;
                    largestPolygon = polygon[0];
                }
            }
        }

        if (largestPolygon) {
            return this.getPolygonCentroid(largestPolygon);
        }

        return null;
    }

    /**
     * Calculate approximate area of a polygon (for finding largest landmass)
     * Using Shoelace formula adapted for geographic coordinates
     */
    getPolygonArea(ring) {
        let area = 0;
        const n = ring.length - 1; // Exclude duplicate last point

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            // Use longitude for x, latitude for y
            const xi = ring[i][0]; // longitude
            const yi = ring[i][1]; // latitude
            const xj = ring[j][0];
            const yj = ring[j][1];

            area += xi * yj - xj * yi;
        }

        return Math.abs(area / 2);
    }

    /**
     * Calculate centroid of a polygon
     * Using proper centroid formula that accounts for polygon shape
     */
    getPolygonCentroid(ring) {
        const n = ring.length - 1; // Exclude duplicate last point
        let area = 0;
        let centroidLat = 0;
        let centroidLng = 0;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const xi = ring[i][0]; // longitude
            const yi = ring[i][1]; // latitude
            const xj = ring[j][0];
            const yj = ring[j][1];

            const a = xi * yj - xj * yi;
            area += a;
            centroidLng += (xi + xj) * a;
            centroidLat += (yi + yj) * a;
        }

        area = area / 2;

        // Avoid division by zero for degenerate polygons
        if (Math.abs(area) < 0.000001) {
            // Fall back to simple average for very small or degenerate polygons
            let sumLat = 0, sumLng = 0;
            for (let i = 0; i < n; i++) {
                sumLng += ring[i][0];
                sumLat += ring[i][1];
            }
            return {
                lat: sumLat / n,
                lng: sumLng / n
            };
        }

        centroidLng = centroidLng / (6 * area);
        centroidLat = centroidLat / (6 * area);

        return {
            lat: centroidLat,
            lng: centroidLng
        };
    }

    /**
     * Check if a city is actually just a country name (no lat/lng)
     */
    isCountryOnlyClue(city) {
        return !city.lat && !city.lng && city.name;
    }

    /**
     * Get distance to nearest edge of misc region (e.g., Strait of Magellan)
     */
    getDistanceToMiscRegion(lat, lng, regionName) {
        console.log(`[MISC REGION] getDistanceToMiscRegion called for "${regionName}" at (${lat}, ${lng})`);
        let minDistance = Infinity;
        let foundRegionPolygons = 0;

        for (const region of this.miscRegionsData) {
            if (this.regionNameMatches(region, regionName)) {
                foundRegionPolygons++;
                console.log(`[MISC REGION] Found polygon #${foundRegionPolygons} for "${regionName}" (matched: ${region.properties.name})`);

                // Check if point is inside this polygon
                if (this.isPointInPolygon(lat, lng, region.geometry)) {
                    console.log(`[MISC REGION] ✓ Point IS inside "${regionName}"! Returning distance 0 (100% score)`);
                    return 0; // Inside the region!
                }

                // Otherwise get distance to edge
                const distance = this.getDistanceToPolygon(lat, lng, region.geometry);
                console.log(`[MISC REGION] Point is outside polygon, distance to edge: ${distance}km`);
                if (distance < minDistance) {
                    minDistance = distance;
                }
            }
        }

        // If no polygons found, return -1 to signal we should try other methods
        if (foundRegionPolygons === 0) {
            console.log(`[MISC REGION] ✗ No polygons found for "${regionName}" - returning -1`);
            return -1; // Signal that we couldn't find the region
        }

        console.log(`[MISC REGION] Final result: Found ${foundRegionPolygons} polygon(s), min distance: ${minDistance}km`);
        return minDistance;
    }

    /**
     * Get distance to nearest edge of country for country-only clues
     */
    getDistanceToCountry(lat, lng, countryName) {
        // FIRST: Check if this might be a misc region
        const miscRegionDistance = this.getDistanceToMiscRegion(lat, lng, countryName);
        if (miscRegionDistance !== -1) {
            return miscRegionDistance;
        }

        let minDistance = Infinity;
        let foundCountryPolygons = 0;

        for (const country of this.countriesData) {
            const name = country.properties.name || country.properties.NAME;
            if (name && name.toLowerCase() === countryName.toLowerCase()) {
                foundCountryPolygons++;

                // Check if point is inside this polygon
                if (this.isPointInPolygon(lat, lng, country.geometry)) {
                    return 0; // Inside the country!
                }

                // Otherwise get distance to edge
                const distance = this.getDistanceToPolygon(lat, lng, country.geometry);
                if (distance < minDistance) {
                    minDistance = distance;
                }
            }
        }

        // If no polygons found, fall back to distance from center
        if (foundCountryPolygons === 0) {
            return -1; // Signal that we couldn't find the country
        }

        return minDistance;
    }

    /**
     * Get distance to nearest edge of US state for state-only clues
     */
    getDistanceToState(lat, lng, stateName) {
        let minDistance = Infinity;
        let foundStatePolygons = 0;

        for (const state of this.statesData) {
            const name = state.properties.name;
            if (name && (name.toLowerCase() === stateName.toLowerCase() ||
                         this.matchesStateAbbreviation(stateName, name))) {
                foundStatePolygons++;

                // Check if point is inside this polygon
                if (this.isPointInPolygon(lat, lng, state.geometry)) {
                    return 0; // Inside the state!
                }

                // Otherwise get distance to edge
                const distance = this.getDistanceToPolygon(lat, lng, state.geometry);
                if (distance < minDistance) {
                    minDistance = distance;
                }
            }
        }

        // If no polygons found, fall back to distance from center
        if (foundStatePolygons === 0) {
            return -1; // Signal that we couldn't find the state
        }

        return minDistance;
    }

    /**
     * Calculate distance from point to line segment in km
     */
    distanceToLineSegment(lat, lng, lat1, lng1, lat2, lng2) {
        // Simple approximation - for more accuracy, use great circle distance
        const R = 6371; // Earth radius in km

        // Convert to radians
        const φ = lat * Math.PI / 180;
        const λ = lng * Math.PI / 180;
        const φ1 = lat1 * Math.PI / 180;
        const λ1 = lng1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const λ2 = lng2 * Math.PI / 180;

        // Calculate distances using simplified formula (good enough for small distances)
        const dLat1 = (lat - lat1) * 111; // 1 degree latitude ≈ 111km
        const dLng1 = (lng - lng1) * 111 * Math.cos(φ);
        const dLat2 = (lat - lat2) * 111;
        const dLng2 = (lng - lng2) * 111 * Math.cos(φ);

        // Distance to first point
        const d1 = Math.sqrt(dLat1*dLat1 + dLng1*dLng1);
        // Distance to second point
        const d2 = Math.sqrt(dLat2*dLat2 + dLng2*dLng2);

        // Return minimum (simplified - doesn't project onto line segment)
        return Math.min(d1, d2);
    }

    /**
     * Helper function to match state abbreviations to full names
     */
    matchesStateAbbreviation(input, fullStateName) {
        const stateAbbreviations = {
            'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
            'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
            'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
            'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
            'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
            'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
            'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
            'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
            'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
            'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
            'District of Columbia': 'DC'
        };

        return stateAbbreviations[fullStateName] &&
               stateAbbreviations[fullStateName].toLowerCase() === input.toLowerCase();
    }

    /**
     * Helper function to check if a point is inside a polygon using ray casting
     */
    isPointInPolygon(lat, lng, geometry) {
        if (geometry.type !== 'Polygon') return false;

        // Get the outer ring of the polygon (first element in coordinates)
        const ring = geometry.coordinates[0];

        // Ray casting algorithm
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i][0], yi = ring[i][1];
            const xj = ring[j][0], yj = ring[j][1];

            const intersect = ((yi > lat) !== (yj > lat))
                && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }

        return inside;
    }

    /**
     * Highlight a region by name (for ?show=RegionName parameter)
     * @param {string} regionName - Name of region to highlight (e.g., "Siberia", "France", "California")
     * @returns {boolean} - True if region was found and highlighted
     */
    highlightRegionByName(regionName) {
        console.log(`[highlightRegionByName] Attempting to highlight: "${regionName}"`);

        // Check misc regions first (Siberia, etc.) - supports altNames
        if (this.miscRegionsData) {
            for (const region of this.miscRegionsData) {
                if (this.regionNameMatches(region, regionName)) {
                    console.log(`✓ Found misc region: ${region.properties.name} (searched: ${regionName})`);
                    this.highlightedMiscRegions.add(region.properties.name);
                    this.updateCountryHighlights(1);
                    return true;
                }
            }
        }

        // Check countries
        for (const country of this.countriesData) {
            const name = country.properties.name || country.properties.NAME;
            if (name && name.toLowerCase() === regionName.toLowerCase()) {
                console.log(`✓ Found country: ${name}`);
                this.highlightedCountries.add(name);
                this.updateCountryHighlights(1);
                return true;
            }
        }

        // Check US states
        for (const state of this.statesData) {
            const name = state.properties.name;
            if (name && (name.toLowerCase() === regionName.toLowerCase() ||
                         this.matchesStateAbbreviation(regionName, name))) {
                console.log(`✓ Found US state: ${name}`);
                this.highlightedStates.add(name);
                this.updateCountryHighlights(1);
                return true;
            }
        }

        // Check subnational regions (provinces, states of other countries)
        for (const region of this.subnationalRegionData) {
            const name = region.properties.name;
            if (name && name.toLowerCase() === regionName.toLowerCase()) {
                console.log(`✓ Found subnational region: ${name}`);
                this.highlightedSubnationalRegions.add(name);
                this.updateCountryHighlights(1);
                return true;
            }
        }

        console.log(`✗ Region "${regionName}" not found`);
        return false;
    }
}

// Export for use in beta.html
window.GeographyService = GeographyService;