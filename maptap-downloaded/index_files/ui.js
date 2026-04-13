//🌍🌎🌏
// UI object - will be initialized after DOM loads
let UI = {
    titleBar : null,
    roundSubway: null,
    roundNumber: null,
    score: null,
    roundMeta: null,
    bottombar: null,
    dateDisplay: null,
    info : null,
    displayedScore: 0
}

// Initialize UI elements after DOM is ready
UI.init = function() {
    this.titleBar = document.getElementById('title-bar');
    this.roundSubway = document.getElementById('ui_round_subway');
    this.roundNumber = document.getElementById('ui_round_number');
    this.score = document.getElementById('ui_score');
    this.roundMeta = document.getElementById('info_header');
    this.bottombar = document.getElementById('bottombar');
    this.dateDisplay = document.getElementById('ui_date_display');
    this.info = document.getElementById('instruction');

    // Set date display if element exists
    if (this.dateDisplay && typeof month !== 'undefined' && typeof day !== 'undefined') {
        this.dateDisplay.innerHTML = `${month} ${day}, 2025`;
    }
};

UI.SetRound = function(round)
{
    let roundData = ["🔘","🔘","🔘","🔘","🔘"];
    roundData[round-1] = "⚪";
    UI.roundSubway.innerHTML = roundData.join("");
}

UI.SetScore = function(score)
{
    this._targetScore = score;
    UI.tickScore();
}

UI.tickScore = function()
{
    if (UI._targetScore === UI.displayedScore) return;

    const diff = UI._targetScore - UI.displayedScore;
    const absDiff = Math.abs(diff);

    // Bigger steps for larger differences, smoother for small differences
    const step = absDiff > 100 ? 15 : absDiff > 10 ? 3 : 1;

    if (diff > 0) {
        UI.displayedScore = Math.min(UI.displayedScore + step, UI._targetScore);
        UI.score.innerHTML = UI.displayedScore.toString().padStart(3, '0');
    } else {
        UI.displayedScore = Math.max(UI.displayedScore - step, UI._targetScore);
        UI.score.innerHTML = UI.displayedScore.toString();
    }

    if (UI.displayedScore !== UI._targetScore) {
        requestAnimationFrame(UI.tickScore);
    }
}
UI.infoFadeOut = function()
{
    UI.info.classList.remove('fade-in', 'fade-out');
    UI.info.classList.add('fade-out');
    UI.roundMeta.classList.remove('fade-in', 'fade-out');
    UI.roundMeta.classList.add('fade-out');
}
UI.infoFadeIn = function()
{
    UI.info.classList.remove('fade-out');
    UI.info.classList.add('fade-in');
    UI.roundMeta.classList.remove('fade-out');
    UI.roundMeta.classList.add('fade-in');
}

// SCORE AND VISUAL FEEDBACK FUNCTIONS

function getColorFromPercentage(percentage) {
    if (percentage < 70) {
        return ART.lerpColorHex('#FF0000','#FFFF00',percentage / 70);
    }
    return ART.lerpColorHex('#FFFF00','#00FF00', (percentage - 70) / 30);
}

function getArcDurationFromScore(floatScore) {
    // makes arcs fly at closer relative velocity
    return 1500*(1-floatScore)+500;
}

function getRoundScoreMultiplier() {
    switch (gameState.round) {
        case 3:
            return 2;
        case 4:
        case 5:
            return  3;
        default:
            return 1;
    }
}

function getEmojiFromScore(score) {
    let numEmojis = emojiScoring.length;
    let emoIndex = Math.floor((score / 100) * (numEmojis - 1)); // Map score (0-100) to index (0-numEmojis-1)
    emoIndex = Math.min(numEmojis - 1, emoIndex); // Ensure the index is within bounds
    if (emojiScoring[emoIndex] == null) {
        return "🤯";
    } else {
        return emojiScoring[emoIndex];
    }
}

function getEmojiData(round) {
    let numEmojis = emojiScoring.length;
    let emoIndex = Math.floor(round.floatScore*numEmojis);
    if (emoIndex === 0) emoIndex += ((round.round+day)%3);
    if (emojiScoring[emoIndex] == null) {
        return "🤯";
    } else {
        return emojiScoring[emoIndex];
    }
}

// TEXT ANIMATION FUNCTIONS

function generateProgressText() {
    let progressText = '';
    runtime.selectedCities.forEach((city, index) => {
        if (city.found) { progressText += `#${index + 1}: ${city.shortName}\n`;
        } else { progressText += `#${index + 1}: ?\n`; }
    });
    return progressText.trim(); // Remove the last newline for cleaner output
}

function generateProgressTextFiveFromMany() {
    let progressText = 'So far you\'ve found:\n';
    runtime.selectedCities.forEach((city, index) => {
        if (city.found) { progressText += `${city.shortName}\n`; }
    });
    return progressText.trim(); // Remove the last newline for cleaner output
}

// Typewriter effect for 'more maptap' link
let typewriterInterval = null;
let hasShared = false;
let typewriterCount = 0;
const MAX_TYPEWRITER_ANIMATIONS = 5; // CPU OPTIMIZATION: Limit animations instead of running forever

function animateTypewriter() {
    const moreMaptapLink = document.getElementById('bar_left_text');
    if (!moreMaptapLink) return;

    // CPU OPTIMIZATION: Stop after max animations reached
    typewriterCount++;
    if (typewriterCount > MAX_TYPEWRITER_ANIMATIONS) {
        if (typewriterInterval) {
            clearInterval(typewriterInterval);
            typewriterInterval = null;
        }
        return;
    }

    const originalText = moreMaptapLink.textContent;
    const chars = originalText.split('');
    moreMaptapLink.innerHTML = '';

    chars.forEach((char, index) => {
        const span = document.createElement('span');
        span.textContent = char;
        span.style.opacity = '0';
        span.style.transition = 'opacity 0.1s ease-in';
        span.style.transitionDelay = `${index * 100}ms`;
        moreMaptapLink.appendChild(span);
    });

    // Trigger the forward animation (left to right)
    setTimeout(() => {
        const spans = moreMaptapLink.querySelectorAll('span');
        spans.forEach((span, index) => {
            span.style.opacity = '1';
            span.style.color = '#ffffff';
            span.style.textShadow = '0 0 4px rgba(255, 255, 255, 0.6)';
            setTimeout(() => {
                span.style.transition = 'all 0.3s ease-out';
                span.style.color = '';
                span.style.textShadow = '';
            }, (index * 100) + 500);
        });
    }, 50);

    // Trigger the reverse animation (right to left)
    const totalForwardTime = chars.length * 100 + 1000;
    setTimeout(() => {
        const spans = moreMaptapLink.querySelectorAll('span');
        spans.forEach((span, index) => {
            const reverseIndex = chars.length - 1 - index;
            setTimeout(() => {
                span.style.transition = 'all 0.1s ease-in';
                span.style.color = '#ffffff';
                span.style.textShadow = '0 0 4px rgba(255, 255, 255, 0.6)';
                setTimeout(() => {
                    span.style.transition = 'all 0.3s ease-out';
                    span.style.color = '';
                    span.style.textShadow = '';
                }, 500);
            }, reverseIndex * 100);
        });
    }, totalForwardTime);

    // Reset to original after both animations
    setTimeout(() => {
        moreMaptapLink.textContent = originalText;
    }, totalForwardTime + chars.length * 100 + 1000);
}

function triggerTypewriterEffect() {
    if (!hasShared) {
        hasShared = true;
        typewriterCount = 0; // Reset counter
        // First animation after 10 seconds
        setTimeout(() => {
            animateTypewriter();
            // Then repeat every 20 seconds (but will auto-stop after MAX_TYPEWRITER_ANIMATIONS)
            typewriterInterval = setInterval(animateTypewriter, 20000);
        }, 10000);
    }
}

// Typewriter effect for scoring display
// Add line breaks after end-of-sentence punctuation
function addSentenceBreaks(text) {
    // Don't break after "..." but do break after "." or "!"
    // First protect "..." by temporarily replacing it
    let protectedText = text.replace(/\.\.\./g, '§§§');
    // Now add breaks after . or ! followed by space
    let brokenText = protectedText.replace(/([.!])\s+(\S)/g, '$1\n$2');
    // Restore the "..."
    return brokenText.replace(/§§§/g, '...');
}

function typewriterScore(element, text, isSlowText = false) {
    // Process text to add line breaks after sentences
    const processedText = addSentenceBreaks(text);

    // Replace newlines with <br> tags for HTML
    const htmlText = processedText.split('\n').map(line => {
        // Escape HTML characters for safety
        const div = document.createElement('div');
        div.textContent = line;
        return div.innerHTML;
    }).join('<br>');

    // Set the complete text immediately
    element.innerHTML = htmlText;

    // Add CSS animation class
    element.classList.add(isSlowText ? 'typewriter-slow' : 'typewriter-effect');
}

// Add HTML scoring element to globe
function addScoreDisplay(lat, lng, cityName, distance, score, multiplier, skipSnarkyText = false, fadeOutDelay = 6000) {
    const id = Date.now();
    const scoreString = multiplier === 1 ? `${score}` : `${score} (x${multiplier})`;
    const snarkyComment = rewardText(distance);

    const scoreCard = {
        lat: lat - 1.5,
        lng: lng + 10,
        id: id,  // Store ID for later removal
        html: `
            <div class="score-display" id="score-display-${id}">
                <div class="score-display-line city-name" id="city-${id}"></div>
                <div class="score-display-line" id="distance-${id}"></div>
                <div class="score-display-line" id="score-${id}"></div>
                <div class="score-display-line snarky-text" id="snarky-${id}"></div>
                <div class="score-display-line snarky-text" id="snarky2-${id}" style="display:none;"></div>
            </div>
        `
    };

    // Get current HTML elements and add the new one
    const currentElements = myGlobe.htmlElementsData();
    myGlobe.htmlElementsData([...currentElements, scoreCard]);

    // Animate the text appearing
    setTimeout(() => {
        const cityEl = document.getElementById(`city-${id}`);
        if (cityEl) {
            cityEl.style.opacity = '1';
            typewriterScore(cityEl, cityName);
        }
    }, 100);

    setTimeout(() => {
        const distEl = document.getElementById(`distance-${id}`);
        if (distEl) {
            distEl.style.opacity = '1';
            const useMiles = gameHistory.useMiles;
            const displayDist = useMiles ? Math.round(distance * 0.621371) : Math.round(distance);
            const unit = useMiles ? ' miles' : 'km';
            typewriterScore(distEl, `Distance: ${displayDist.toLocaleString()}${unit}`);
        }
    }, 400);

    setTimeout(() => {
        const scoreEl = document.getElementById(`score-${id}`);
        if (scoreEl) {
            scoreEl.style.opacity = '1';
            typewriterScore(scoreEl, `Score: ${scoreString}`);
        }
    }, 700);

    // Progressive reveal of snarky text (skip in tutorial mode)
    if (!skipSnarkyText) {
        setTimeout(() => {
            const snarkyEl = document.getElementById(`snarky-${id}`);
            const snarkyEl2 = document.getElementById(`snarky2-${id}`);

            // Split text if it's too long (roughly 35 chars per line with 250px width)
            if (snarkyComment.length > 35) {
            // Find a good break point near the middle
            const midpoint = Math.floor(snarkyComment.length / 2);

            // First, check for a comma near the midpoint (within 10 chars)
            let commaPoint = snarkyComment.indexOf(',', midpoint - 10);
            if (commaPoint === -1 || commaPoint > midpoint + 10) {
                commaPoint = snarkyComment.lastIndexOf(',', midpoint + 10);
            }

            let breakPoint;
            if (commaPoint !== -1 && commaPoint > 5 && commaPoint < snarkyComment.length - 5) {
                // Found a comma in a reasonable position - break after it
                breakPoint = commaPoint + 1;
            } else {
                // No comma found, look for space closest to midpoint
                let beforeSpace = snarkyComment.lastIndexOf(' ', midpoint);
                let afterSpace = snarkyComment.indexOf(' ', midpoint);

                if (beforeSpace === -1) breakPoint = afterSpace;
                else if (afterSpace === -1) breakPoint = beforeSpace;
                else {
                    // Choose the space closest to midpoint
                    breakPoint = (midpoint - beforeSpace < afterSpace - midpoint) ? beforeSpace : afterSpace;
                }
                if (breakPoint === -1) breakPoint = midpoint;
            }

            const line1 = snarkyComment.substring(0, breakPoint).trim();
            const line2 = snarkyComment.substring(breakPoint).trim();

            if (snarkyEl) {
                snarkyEl.style.opacity = '1';
                // Skip sentence breaks for manually split text
                snarkyEl.innerHTML = line1;
                snarkyEl.classList.add('typewriter-effect');
            }

            // Animate second line after first completes
            if (line2 && snarkyEl2) {
                setTimeout(() => {
                    snarkyEl2.style.display = 'block';
                    snarkyEl2.style.opacity = '1';
                    // Skip sentence breaks for manually split text
                    snarkyEl2.innerHTML = line2;
                    snarkyEl2.classList.add('typewriter-effect');
                }, 400); // Reduced delay between lines
            }
            } else {
                // Short text - single line
                if (snarkyEl) {
                    snarkyEl.style.opacity = '1';
                    typewriterScore(snarkyEl, snarkyComment);
                }
            }
        }, 2000);
    }

    // Auto-remove after configured delay
    setTimeout(() => {
        // Fade out all the lines
        const cityEl = document.getElementById(`city-${id}`);
        const distEl = document.getElementById(`distance-${id}`);
        const scoreEl = document.getElementById(`score-${id}`);
        const snarkyEl = document.getElementById(`snarky-${id}`);
        const snarkyEl2 = document.getElementById(`snarky2-${id}`);

        [cityEl, distEl, scoreEl, snarkyEl, snarkyEl2].forEach(el => {
            if (el) {
                el.style.transition = 'opacity 0.5s ease-out';
                el.style.opacity = '0';
            }
        });

        // Remove from globe data after fade
        setTimeout(() => {
            const currentElements = myGlobe.htmlElementsData();
            const filtered = currentElements.filter(el => el.id !== id);
            myGlobe.htmlElementsData(filtered);
        }, 500);
    }, fadeOutDelay);
}