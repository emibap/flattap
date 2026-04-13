// Globe rendering and manipulation utilities for MapTap (V2 - TileGlobe)
// V2: iOS-style multi-paragraph alignment, simplified (p) handling
console.log('📍 globe-utils-v2.js loaded - iOS-style paragraph alignment');

// ============================================================================
// MULTI-PARAGRAPH LAYOUT (shared by trivia and randomAddedText)
// ============================================================================

/**
 * Calculate positions for multi-paragraph text with (p) markup.
 * Uses pixel-based measurement for accurate left-edge alignment.
 *
 * @param {Object} options
 * @param {string} options.text - Text with (p) markup (from trivia or addText field)
 * @param {number} options.wrapWidth - Character wrap width
 * @param {number} options.baseLat - Base latitude for positioning
 * @param {number} options.baseLng - Base longitude for positioning
 * @param {string} [options.header=''] - Optional header to prepend to first paragraph
 * @param {Object} [options.itemObject=null] - Object with picture fields (showTriviaPicture, p2, c2, s2, link2, etc.)
 * @param {number} [options.focusOnMe=0] - Focus flag for camera
 * @returns {Object} { labels: [{text, lat, lng, focusOnMe}], pictures: [{lat, lng, picture, credit, ...}] }
 */
function layoutMultiParagraphText(options) {
    const {
        text,
        wrapWidth,
        baseLat,
        baseLng,
        header = '',
        itemObject = null,
        focusOnMe = 0
    } = options;

    const labels = [];
    const pictures = [];

    // Check for (p) markup - negative lookahead prevents matching "(Patent...)" etc.
    const hasParagraphMarkup = /\(p(?![a-zA-Z])([+\-][\d.]+)?(:[\d]+)?\)/.test(text);

    if (!hasParagraphMarkup) {
        // No (p) markup - return single label
        const wrappedText = header + wrapText(text, wrapWidth);
        labels.push({
            text: wrappedText,
            lat: baseLat,
            lng: baseLng,
            focusOnMe: focusOnMe
        });

        // Add picture if exists
        if (itemObject && itemObject.showTriviaPicture) {
            pictures.push({
                lat: baseLat,
                lng: baseLng,
                picture: itemObject.showTriviaPicture,
                ...(itemObject.credit && { credit: itemObject.credit }),
                ...(itemObject.s1 && { playSound: itemObject.s1 }),
                ...(itemObject.playSound && { playSound: itemObject.playSound }),
                ...(itemObject.link1 && { link: itemObject.link1 }),
                ...(itemObject.link && { link: itemObject.link })
            });
        }

        return { labels, pictures };
    }

    // Parse paragraphs - split by (p) markup, ignoring adjustment values
    const paragraphRegex = /\(p(?![a-zA-Z])([+\-][\d.]+)?(:[\d]+)?\)/;
    const parts = text.split(paragraphRegex);

    // Extract just the text parts (every 3rd element starting at 0)
    const paragraphs = [];
    for (let i = 0; i < parts.length; i += 3) {
        if (parts[i] && parts[i].trim()) {
            paragraphs.push(parts[i].trim());
        }
    }

    if (paragraphs.length === 0) {
        return { labels, pictures };
    }

    // Wrap all paragraphs
    const wrappedParagraphs = paragraphs.map(p => wrapText(p, wrapWidth));

    // Build first label with header
    const firstLabel = header + wrappedParagraphs[0];

    // Measure pixel widths and heights using canvas
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    const fontSize = 32;
    const lineHeight = fontSize * 1.2;
    measureCtx.font = `${fontSize}px Arial`;

    const pixelWidths = [];
    const pixelHeights = [];

    // First paragraph (includes header)
    const firstLines = firstLabel.split('\n');
    pixelWidths.push(Math.max(...firstLines.map(line => measureCtx.measureText(line).width)));
    pixelHeights.push(firstLines.length * lineHeight);

    // Subsequent paragraphs
    for (let i = 1; i < wrappedParagraphs.length; i++) {
        const lines = wrappedParagraphs[i].split('\n');
        pixelWidths.push(Math.max(...lines.map(line => measureCtx.measureText(line).width)));
        pixelHeights.push(lines.length * lineHeight);
    }

    // Constants for positioning
    const PIXELS_TO_LNG = 0.05;
    const PIXELS_TO_LAT = 0.05;
    const PADDING_PX = 50;
    const anchorWidth = pixelWidths[0];

    // First paragraph at original position
    labels.push({
        text: firstLabel,
        lat: baseLat,
        lng: baseLng,
        focusOnMe: focusOnMe
    });

    // Add picture for first paragraph
    if (itemObject) {
        const pic = itemObject.showTriviaPicture;
        if (pic) {
            pictures.push({
                lat: baseLat,
                lng: baseLng,
                picture: pic,
                ...(itemObject.credit && { credit: itemObject.credit }),
                ...(itemObject.s1 && { playSound: itemObject.s1 }),
                ...(itemObject.playSound && { playSound: itemObject.playSound }),
                ...(itemObject.link1 && { link: itemObject.link1 }),
                ...(itemObject.link && { link: itemObject.link })
            });
        } else if (itemObject.s1 || itemObject.playSound || itemObject.link1 || itemObject.link) {
            pictures.push({
                lat: baseLat,
                lng: baseLng,
                ...(itemObject.s1 && { playSound: itemObject.s1 }),
                ...(itemObject.playSound && { playSound: itemObject.playSound }),
                ...(itemObject.link1 && { link: itemObject.link1 }),
                ...(itemObject.link && { link: itemObject.link })
            });
        }
    }

    // Subsequent paragraphs
    let currentLat = baseLat;
    for (let i = 1; i < wrappedParagraphs.length; i++) {
        // Vertical positioning
        const prevHeight = pixelHeights[i - 1];
        const currentHeight = pixelHeights[i];
        const verticalOffset = (prevHeight / 2 + currentHeight / 2 + PADDING_PX) * PIXELS_TO_LAT;
        currentLat -= verticalOffset;

        // Horizontal alignment (anchor-based)
        const pixelDiff = anchorWidth - pixelWidths[i];
        const adjustedLng = baseLng - (pixelDiff / 2) * PIXELS_TO_LNG;

        labels.push({
            text: wrappedParagraphs[i],
            lat: currentLat,
            lng: adjustedLng,
            focusOnMe: 0
        });

        // Add picture for this paragraph (p2, p3, etc.)
        if (itemObject) {
            const pictureField = `p${i + 1}`;
            const creditField = `c${i + 1}`;
            const soundField = `s${i + 1}`;
            const linkField = `link${i + 1}`;

            const extraCreditField = `extraCredit${i + 1}`;

            if (itemObject[pictureField]) {
                pictures.push({
                    lat: currentLat,
                    lng: adjustedLng,
                    picture: itemObject[pictureField],
                    ...(itemObject[creditField] && { credit: itemObject[creditField] }),
                    ...(itemObject[soundField] && { playSound: itemObject[soundField] }),
                    ...(itemObject[linkField] && { link: itemObject[linkField] }),
                    ...(itemObject[extraCreditField] && { extraCredit: itemObject[extraCreditField] })
                });
            } else if (itemObject[soundField] || itemObject[linkField] || itemObject[extraCreditField]) {
                pictures.push({
                    lat: currentLat,
                    lng: adjustedLng,
                    ...(itemObject[soundField] && { playSound: itemObject[soundField] }),
                    ...(itemObject[linkField] && { link: itemObject[linkField] }),
                    ...(itemObject[extraCreditField] && { extraCredit: itemObject[extraCreditField] })
                });
            }
        }
    }

    return { labels, pictures };
}

// ============================================================================
// GLOBE CONTROL FUNCTIONS
// ============================================================================

function centerGlobeOn(lat, lng, time) {
    myGlobe.pointOfView({ lat: lat, lng: lng, altitude: planetAltitude }, time);
}

// ============================================================================
// GLOBE DATA CLEARING FUNCTIONS
// ============================================================================

function clearArcs() {
    myGlobe.arcsData([]);
}

function clearPoints() {
    myGlobe.pointsData([]);
}

function clearLabels() {
    myGlobe.labelsData([]);
}

function clearRipples() {
    myGlobe.ringsData([]);
}

function clearHtmlElements() {
    myGlobe.htmlElementsData([]);
}

function clearCountryHighlights() {
    geoService.clearCountryHighlights();
}

function updateCountryHighlights(opacity = 1) {
    geoService.updateCountryHighlights(opacity);
}

// ============================================================================
// GLOBE DATA ADDITION FUNCTIONS
// ============================================================================

function addArc(lat1, lng1, lat2, lng2, color, duration) {
    const currentArcs = myGlobe.arcsData();
    const newArc = {
        startLat: lat1,
        startLng: lng1,
        endLat: lat2,
        endLng: lng2,
        color: color,
        duration: duration,
    };
    myGlobe.arcsData([...currentArcs, newArc]);
}

function addPoint(lat, lng, size, color) {
    const existingPoints = myGlobe.pointsData();
    // Don't set 'size' so height defaults to radius (normal pole behavior)
    const newPoint = {
        lat: lat,
        lng: lng,
        radius: 0.25,
        color: color
    };
    const newPoint2 = {
        lat: lat,
        lng: lng,
        radius: 0.2,
        color: ART.lerpColorHex(color,'#000000',0.5)
    };
    myGlobe.pointsData([...existingPoints, newPoint2, newPoint]);
}

// Default glow settings for label readability
const LABEL_GLOW_COLOR = 'rgba(0, 0, 0, 0.85)';
const LABEL_GLOW_BLUR = 32;

function addLabel(lat, lng, text) {
    let currentLabels = myGlobe.labelsData();
    let labelColor = "#FADADD";
    const newLabel = {
        lat: lat,
        lng: lng,
        color: labelColor,
        text: text,
        font: 'Arial Black',
        glowColor: LABEL_GLOW_COLOR,
        glowBlur: LABEL_GLOW_BLUR
    };
    myGlobe.labelsData([...currentLabels, newLabel]);
}

function addLabelWithAutoParagraphs(location, wrapWidth = 50) {
    // Degrees of latitude offset per line of text (adjusted through testing)
    const DEGREES_PER_LINE = 1.8;

    const lat = location.lat;
    const lng = location.lng;
    const text = location.addText;
    const sound = location.playSound || null;

    // Split text by (p) markup (ignore adjustment values - TileGlobe handles alignment)
    const paragraphRegex = /\(p[^)]*\)/;
    const paragraphs = text.split(paragraphRegex).filter(p => p.trim());

    // Wrap all paragraphs
    const wrappedParagraphs = paragraphs.map(p => wrapText(p.trim(), wrapWidth));

    // iOS approach: Find the WIDEST paragraph across ALL paragraphs
    // This becomes the shared alignment width
    let sharedMaxWidth = 0;
    wrappedParagraphs.forEach(wrapped => {
        const lines = wrapped.split('\n');
        const maxLineLen = Math.max(...lines.map(line => line.length));
        sharedMaxWidth = Math.max(sharedMaxWidth, maxLineLen);
    });


    let currentLat = lat;

    paragraphs.forEach((paragraph, index) => {
        // Calculate vertical offset for subsequent paragraphs
        if (index > 0) {
            const prevLineCount = wrappedParagraphs[index - 1].split('\n').length;
            const currentLineCount = wrappedParagraphs[index].split('\n').length;
            currentLat -= ((prevLineCount + currentLineCount) / 2 + 1.25) * DEGREES_PER_LINE;
        }

        // Calculate this paragraph's width
        const lines = wrappedParagraphs[index].split('\n');
        const thisMaxWidth = Math.max(...lines.map(line => line.length));

        // iOS approach: Offset longitude so left edges align to shared width
        // Each paragraph shifts left by (sharedWidth - myWidth) / 2
        // This puts all left edges at the same position
        const widthDiff = sharedMaxWidth - thisMaxWidth;
        const CHARS_TO_LNG = 0.12;  // Degrees per character (tuned for TileGlobe)
        const lngOffset = (widthDiff / 2) * CHARS_TO_LNG;
        const adjustedLng = lng - lngOffset;


        // Add the label
        addLabel(currentLat, adjustedLng, wrappedParagraphs[index], sound);

        // Add picture for this paragraph if it exists
        let pictureField, creditField;
        if (index === 0) {
            pictureField = 'showTriviaPicture';
            creditField = 'credit';
        } else {
            pictureField = `p${index + 1}`;
            creditField = `c${index + 1}`;
        }

        if (location[pictureField]) {
            pictureLocations.push({
                lat: currentLat,
                lng: adjustedLng,
                picture: location[pictureField],
                ...(location[creditField] && { credit: location[creditField] }),
                ...(location.playSound && index === 0 && { playSound: location.playSound })
            });
        }
    });
}

function addRipple(lat, lng, color, maxR, propagationSpeed, repeatPeriod) {
    const currentRings = myGlobe.ringsData();
    const newRing = {
        lat,
        lng,
        maxR,
        propagationSpeed,
        repeatPeriod,
        color
    };
    myGlobe.ringsData([...currentRings, newRing]);
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

function addPolesToMap(mapLocations) {
    for (var i = 0; i < mapLocations.length; i++) {
        // Use optional color parameter, default to orange (#FFA500)
        const color = mapLocations[i].color || '#FFA500';
        addPoint(mapLocations[i].lat, mapLocations[i].lng, 0.1, color);
    }
}

function addLabelsToMap(mapLocations) {
    for (var i = 0; i < mapLocations.length; i++) {
        var thisLocation = mapLocations[i];
        const textToDisplay = thisLocation.addText;
        const wrapWidthToUse = thisLocation.specialWrap > 0 ? thisLocation.specialWrap : wrapWidth;

        // Use shared layout function (handles both with and without (p) markup)
        const layout = layoutMultiParagraphText({
            text: textToDisplay,
            wrapWidth: wrapWidthToUse,
            baseLat: thisLocation.lat,
            baseLng: thisLocation.lng,
            header: '',
            itemObject: thisLocation,
            focusOnMe: 0
        });

        // Add all labels from layout
        layout.labels.forEach(labelItem => {
            addLabel(labelItem.lat, labelItem.lng, labelItem.text, thisLocation.playSound || null);
        });

        // Add all pictures from layout
        layout.pictures.forEach(pic => {
            pictureLocations.push(pic);
        });
    }
}

function markFoundCities() {
    // Iterate over each city in runtime.selectedCities
    runtime.selectedCities.forEach(city => {
        if (gameState.foundCities.includes(city.name)) {
            city.found = true; // Set found to true if the city is in the foundCities list
        }
    });
}

// ============================================================================
// ARC ANIMATIONS
// ============================================================================

function arcThisList(myPoints) {
    myPoints.forEach(function(addedPoint) {
        addPoint(addedPoint.lat, addedPoint.lng, 0.1, '#FFFFFF');
    });
    let arcIndex = 0;
    showNextArc(); // Start the animation loop

    function showNextArc() {
        if (arcIndex >= myPoints.length - 1) {
            arcIndex = 0; // Reset to start when we reach the end
        }
        clearArcs(); // Clear previous arcs

        // Fetch the current and next point
        const currentPoint = myPoints[arcIndex];
        const nextPoint = myPoints[arcIndex + 1];

        // Draw the arc between current and next point
        addArc(currentPoint.lat, currentPoint.lng, nextPoint.lat, nextPoint.lng, ["green", "cyan", "green"], 750);

        setTimeout(() => {
            arcIndex++;
            showNextArc();
        }, 1500);
    }
}

function animateArcs(arcs) {
    let arcIndex = 0;
    showNextArc(); // Start the animation loop

    function showNextArc() {
        if (arcIndex >= arcs.length) { arcIndex = 0; } // if we're at the end, start over!

        clearArcs();
        const currentArc = arcs[arcIndex];
        addArc(currentArc.startLat, currentArc.startLng, currentArc.endLat, currentArc.endLng, ["green", "cyan", "green"], 1250);

        setTimeout(() => {
            arcIndex++;
            showNextArc();
        }, 2500); // 2.5 seconds delay before showing the next arc
    }
}

// ============================================================================
// GLOBE CENTER CHECKING (for image display)
// ============================================================================

var currentDisplayedExtraCredit = null;

function checkGlobeCenter(locations, titleMsg, scoreMsg) {
    const currentView = myGlobe.pointOfView();
    let anyLocationMatched = false;

    for (const location of locations) {
        // Skip entries with no picture, no link, no sound, and no extraCredit
        if (!location.picture && !location.link && !location.playSound && !location.extraCredit) continue;

        if (
            Math.abs(currentView.lat - location.lat) <= 12 &&
            Math.abs(currentView.lng - location.lng) <= 12
        ) {
            // Only update picture if this entry has one and it changed
            if (location.picture && currentDisplayedImageURL !== location.picture) {
                const newContent = `<img src="${location.picture}" style="max-width:283px;height:auto;"/>`;
                UI.info.innerHTML = newContent;
                UI.info.style.paddingLeft = "0";
                UI.info.style.paddingRight = "0";
                UI.roundMeta.style.display = 'none'; // Hide header when showing picture
                currentDisplayedImageURL = location.picture;
                currentDisplayedCredit = null; // Reset credit when image changes

                // Animate share button when new image shows
                const shareBtn = document.getElementById('share-button');
                if (shareBtn && shareBtn.style.display !== 'none') {
                    shareBtn.classList.remove('animate-in');
                    // Force reflow to restart animation
                    shareBtn.offsetHeight;
                    shareBtn.classList.add('animate-in');
                }
            }

            // Only update credit caption if it changed
            if (location.picture && currentDisplayedCredit !== (location.credit || null)) {
                const oldCap = UI.info.querySelector('.image-credit');
                if (oldCap) oldCap.remove();

                if (location.credit) {
                    const cap = document.createElement('div');
                    cap.className = 'image-credit';
                    cap.textContent = location.credit;
                    UI.info.appendChild(cap);
                }
                currentDisplayedCredit = location.credit || null;
            }

            // Show/hide bottom-of-page link when location has a link
            const storyLink = document.getElementById('story-link');
            if (storyLink && currentDisplayedLink !== (location.link || null)) {
                if (location.link) {
                    storyLink.href = location.link;
                    storyLink.classList.add('visible');
                } else {
                    storyLink.classList.remove('visible');
                }
                currentDisplayedLink = location.link || null;
            }

            // Show/hide sound play button when location has a sound
            const soundBtn = document.getElementById('sound-button');
            if (soundBtn && currentDisplayedSound !== (location.playSound || null)) {
                if (location.playSound) {
                    soundBtn.dataset.sound = location.playSound;
                    soundBtn.classList.add('visible');
                } else {
                    soundBtn.classList.remove('visible');
                }
                currentDisplayedSound = location.playSound || null;
            }

            // Show/hide extra credit text at bottom of screen
            const extraCreditEl = document.getElementById('extra-credit');
            if (extraCreditEl && currentDisplayedExtraCredit !== (location.extraCredit || null)) {
                if (location.extraCredit) {
                    extraCreditEl.textContent = location.extraCredit;
                    extraCreditEl.classList.add('visible');
                } else {
                    extraCreditEl.classList.remove('visible');
                }
                currentDisplayedExtraCredit = location.extraCredit || null;
            }

            anyLocationMatched = true;
            break;  // stop after first match
        }
    }

    // if nothing matched, restore text UI and clear caption
    if (!anyLocationMatched && (currentDisplayedImageURL !== null || currentDisplayedLink !== null || currentDisplayedSound !== null || currentDisplayedExtraCredit !== null)) {
        // Restore text UI only if an image was being shown
        if (currentDisplayedImageURL !== null) {
            if (isGameOver()) {
                UI.SetInfo(titleMsg, scoreMsg, '#00FFFF', false);
                UI.infoShowInstant();
            } else {
                UI.SetInfo(titleMsg, scoreMsg, '#00FFFF', false);
                UI.infoFadeIn();
            }
            const oldCap = UI.info.querySelector('.image-credit');
            if (oldCap) oldCap.remove();
        }
        currentDisplayedImageURL = null;
        currentDisplayedCredit = null;
        currentDisplayedLink = null;
        currentDisplayedSound = null;
        currentDisplayedExtraCredit = null;
        const storyLink = document.getElementById('story-link');
        if (storyLink) storyLink.classList.remove('visible');
        const soundBtn = document.getElementById('sound-button');
        if (soundBtn) soundBtn.classList.remove('visible');
        const extraCreditEl = document.getElementById('extra-credit');
        if (extraCreditEl) extraCreditEl.classList.remove('visible');
    }
}
