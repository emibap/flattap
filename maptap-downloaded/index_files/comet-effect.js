/**
 * Comet Effect Module
 * Shooting star/comet celebration effect ported from iOS
 * Comets streak across the sky with glowing tails and sparkles
 */

class CometEffect {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.comets = [];
        this.animationId = null;
        this.lastTime = 0;
        this.isRunning = false;
        this.onComplete = null;
        this.endTime = null;

        // Configuration (can be adjusted via debug panel)
        this.config = {
            count: 5,
            duration: 2.5,
            speedMin: 400,
            speedMax: 700,
            intensity: 'high' // 'low', 'medium', 'high'
        };
    }

    /**
     * Initialize the canvas overlay
     */
    initCanvas() {
        if (this.canvas) return;

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'comet-canvas';
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9999;
        `;
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.resize();

        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    /**
     * Get intensity settings
     */
    getIntensitySettings(intensity) {
        const settings = {
            low: { brightness: 0.6, glowRadius: 8 },
            medium: { brightness: 0.8, glowRadius: 12 },
            high: { brightness: 1.0, glowRadius: 16 }
        };
        return settings[intensity] || settings.high;
    }

    /**
     * Create a single comet
     */
    createComet() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const intensitySettings = this.getIntensitySettings(this.config.intensity);

        // Trajectory patterns (matching iOS)
        // 60% upper-right to lower-left, 20% upper-left to lower-right, 20% top-center to sides
        const trajectory = Math.random();

        let startX, startY, targetX, targetY;

        if (trajectory < 0.6) {
            // Best angle: upper-right to lower-left
            startX = w * 0.7 + Math.random() * (w * 0.3 + 100);
            startY = -100 + Math.random() * (h * 0.2 + 100);
            targetX = -100 + Math.random() * (w * 0.3 + 100);
            targetY = h * 0.7 + Math.random() * (h * 0.3 + 50);
        } else if (trajectory < 0.8) {
            // Upper-left to lower-right
            startX = -100 + Math.random() * (w * 0.3 + 100);
            startY = -100 + Math.random() * (h * 0.2 + 100);
            targetX = w * 0.7 + Math.random() * (w * 0.3 + 100);
            targetY = h * 0.7 + Math.random() * (h * 0.3 + 50);
        } else {
            // Top-center to lower sides
            startX = w * 0.3 + Math.random() * (w * 0.4);
            startY = -100 + Math.random() * 100;
            targetX = Math.random() < 0.5
                ? -50 + Math.random() * (w * 0.3)
                : w * 0.7 + Math.random() * (w * 0.3 + 50);
            targetY = h * 0.6 + Math.random() * (h * 0.4 + 50);
        }

        // Calculate velocity
        const dx = targetX - startX;
        const dy = targetY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = this.config.speedMin + Math.random() * (this.config.speedMax - this.config.speedMin);

        // 15% chance of "hero" comet (larger, brighter)
        const isHero = Math.random() < 0.15;

        return {
            id: Math.random().toString(36).substr(2, 9),
            x: startX,
            y: startY,
            velocityX: (dx / distance) * speed,
            velocityY: (dy / distance) * speed,
            length: isHero ? 50 + Math.random() * 20 : 30 + Math.random() * 20,
            width: isHero ? 2.5 + Math.random() * 1 : 1.5 + Math.random() * 1,
            brightness: intensitySettings.brightness * (isHero ? 1.0 : 0.7 + Math.random() * 0.2),
            glowRadius: intensitySettings.glowRadius,
            opacity: 0,
            age: 0,
            // Lifetime scales with duration: base of 60% of duration, plus some randomness
            lifetime: (this.config.duration * 0.6) + Math.random() * (this.config.duration * 0.3),
            fadeInTime: Math.min(0.15 * (this.config.duration / 2.5), 0.4),  // Scale fade, cap at 0.4s
            fadeOutTime: Math.min(0.3 * (this.config.duration / 2.5), 0.8),  // Scale fade, cap at 0.8s
            sparkles: [],
            isHero
        };
    }

    /**
     * Update a comet's position and state
     */
    updateComet(comet, deltaTime) {
        comet.age += deltaTime;

        // Update position
        comet.x += comet.velocityX * deltaTime;
        comet.y += comet.velocityY * deltaTime;

        // Update opacity based on lifecycle
        if (comet.age < comet.fadeInTime) {
            comet.opacity = comet.age / comet.fadeInTime;
        } else if (comet.age > comet.lifetime - comet.fadeOutTime) {
            const fadeProgress = (comet.age - (comet.lifetime - comet.fadeOutTime)) / comet.fadeOutTime;
            comet.opacity = 1.0 - fadeProgress;
        } else {
            comet.opacity = 1.0;
        }

        // Create sparkles along the tail (every ~2 frames at 60fps)
        if (Math.floor(comet.age * 60) % 2 === 0 && comet.opacity > 0.5) {
            const tailPercent = 0.2 + Math.random() * 0.6;
            comet.sparkles.push({
                x: comet.x - comet.velocityX * tailPercent * 0.15,
                y: comet.y - comet.velocityY * tailPercent * 0.15,
                size: 1.5 + Math.random() * 2,
                lifetime: 0.5 + Math.random() * 0.5,
                age: 0
            });
        }

        // Update and prune sparkles
        comet.sparkles = comet.sparkles.filter(sparkle => {
            sparkle.age += deltaTime;
            return sparkle.age < sparkle.lifetime;
        });
    }

    /**
     * Draw a single comet
     */
    drawComet(comet) {
        const ctx = this.ctx;
        const angle = Math.atan2(comet.velocityY, comet.velocityX);

        // Calculate tail position
        const tailX = comet.x - Math.cos(angle) * comet.length;
        const tailY = comet.y - Math.sin(angle) * comet.length;

        ctx.save();
        ctx.globalAlpha = comet.opacity;

        // Draw glow layers (yellow outer, white inner)
        ctx.shadowColor = 'rgba(255, 255, 0, 0.3)';
        ctx.shadowBlur = comet.glowRadius * 1.5;

        // Draw tail gradient
        const gradient = ctx.createLinearGradient(tailX, tailY, comet.x, comet.y);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(0.3, `rgba(255, 204, 102, ${comet.brightness * 0.3})`);
        gradient.addColorStop(0.7, `rgba(255, 242, 179, ${comet.brightness * 0.6})`);
        gradient.addColorStop(1, `rgba(255, 255, 255, ${comet.brightness})`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = comet.width;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(comet.x, comet.y);
        ctx.stroke();

        // Draw brighter core with white glow
        ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
        ctx.shadowBlur = comet.glowRadius;

        const coreGradient = ctx.createLinearGradient(tailX, tailY, comet.x, comet.y);
        coreGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
        coreGradient.addColorStop(1, `rgba(255, 255, 255, ${comet.brightness})`);

        ctx.strokeStyle = coreGradient;
        ctx.lineWidth = comet.width * 0.5;
        ctx.stroke();

        // Draw sparkles
        ctx.shadowBlur = 0;
        for (const sparkle of comet.sparkles) {
            const sparkleOpacity = 1 - (sparkle.age / sparkle.lifetime);
            ctx.fillStyle = `rgba(255, 255, 255, ${sparkleOpacity * 0.8})`;
            ctx.beginPath();
            ctx.arc(sparkle.x, sparkle.y, sparkle.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    /**
     * Animation loop
     */
    animate(currentTime) {
        if (!this.isRunning) return;

        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update and draw all comets
        for (const comet of this.comets) {
            this.updateComet(comet, deltaTime);
            this.drawComet(comet);
        }

        // Remove dead or off-screen comets
        this.comets = this.comets.filter(comet => {
            const isDead = comet.age >= comet.lifetime;
            const isOffScreen = comet.x < -200 || comet.x > this.canvas.width + 200 ||
                               comet.y < -200 || comet.y > this.canvas.height + 200;
            return !isDead && !isOffScreen;
        });

        // Check if effect is complete
        if (this.endTime && Date.now() > this.endTime && this.comets.length === 0) {
            this.stop();
            if (this.onComplete) this.onComplete();
            return;
        }

        this.animationId = requestAnimationFrame((t) => this.animate(t));
    }

    /**
     * Start the comet effect
     * @param {Object} options - Configuration options
     * @param {Function} onComplete - Callback when effect completes
     */
    start(options = {}, onComplete = null) {
        // Merge options with defaults
        this.config = { ...this.config, ...options };
        this.onComplete = onComplete;

        this.initCanvas();
        this.comets = [];
        this.isRunning = true;
        this.lastTime = performance.now();
        this.endTime = Date.now() + (this.config.duration * 1000);

        // Spawn comets with staggered timing
        const spawnInterval = (this.config.duration * 1000) / this.config.count;
        for (let i = 0; i < this.config.count; i++) {
            setTimeout(() => {
                if (this.isRunning) {
                    this.comets.push(this.createComet());
                }
            }, i * spawnInterval);
        }

        // Start animation loop
        this.animationId = requestAnimationFrame((t) => this.animate(t));

        console.log(`🌠 Comet effect started: ${this.config.count} comets, ${this.config.duration}s, ${this.config.intensity} intensity`);
    }

    /**
     * Stop the effect immediately
     */
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        this.comets = [];
    }

    /**
     * Trigger a single comet (for free players)
     */
    triggerSingle() {
        this.start({
            count: 1,
            duration: 3.0,
            speedMin: 400,
            speedMax: 600,
            intensity: 'medium'
        });
    }

    /**
     * Trigger a small shower (for premium players)
     */
    triggerSmallShower() {
        this.start({
            count: 1 + Math.floor(Math.random() * 2), // 1-2 comets
            duration: 3.5,
            speedMin: 400,
            speedMax: 700,
            intensity: 'high'
        });
    }

    /**
     * Trigger a large shower (for testing/special events)
     */
    triggerLargeShower() {
        this.start({
            count: 8 + Math.floor(Math.random() * 5), // 8-12 comets
            duration: 4.5,
            speedMin: 350,
            speedMax: 750,
            intensity: 'high'
        });
    }
}

/**
 * Comet Manager - handles trigger logic during gameplay
 * Determines when to show comets based on player status
 */
class CometManager {
    constructor() {
        // localStorage keys
        this.FIRST_COMET_KEY = 'maptap_hasSeenFirstComet';
        this.LAST_COMET_KEY = 'maptap_lastCometDate';
        this.LAST_PLAY_KEY = 'maptap_lastPlayDate';

        // Probability config (per game)
        // Free: 25% = roughly every 4 games
        // Premium: 35% = roughly every 3 games
        this.FREE_PROBABILITY = 0.25;
        this.PREMIUM_PROBABILITY = 0.35;

        // Returning user config
        this.RETURNING_USER_DAYS = 3;  // Days away to qualify as "returning"

        // Session state
        this.shouldTriggerThisGame = false;
        this.triggerAfterRound = null;  // Which round (1-5) to trigger after
        this.hasTriggeredThisGame = false;
        this.triggerReason = null;  // 'first_game', 'returning', 'random'
    }

    /**
     * Check if this is the player's first game ever
     */
    isFirstGame() {
        return !localStorage.getItem(this.FIRST_COMET_KEY);
    }

    /**
     * Check if user is returning after being away for a while
     */
    isReturningUser() {
        const lastPlayStr = localStorage.getItem(this.LAST_PLAY_KEY);
        if (!lastPlayStr) return false;  // No record means first game (handled separately)

        const lastPlay = new Date(lastPlayStr);
        const now = new Date();
        const daysSinceLastPlay = (now - lastPlay) / (1000 * 60 * 60 * 24);

        return daysSinceLastPlay > this.RETURNING_USER_DAYS;
    }

    /**
     * Get days since last play (for debugging)
     */
    getDaysSinceLastPlay() {
        const lastPlayStr = localStorage.getItem(this.LAST_PLAY_KEY);
        if (!lastPlayStr) return null;

        const lastPlay = new Date(lastPlayStr);
        const now = new Date();
        return ((now - lastPlay) / (1000 * 60 * 60 * 24)).toFixed(1);
    }

    /**
     * Mark that player has seen their first comet
     */
    markFirstCometSeen() {
        localStorage.setItem(this.FIRST_COMET_KEY, 'true');
    }

    /**
     * Record when a comet was shown
     */
    recordCometShown() {
        localStorage.setItem(this.LAST_COMET_KEY, new Date().toISOString());
    }

    /**
     * Record that user played today
     */
    recordPlayDate() {
        localStorage.setItem(this.LAST_PLAY_KEY, new Date().toISOString());
    }

    /**
     * Get the last comet date (for debugging)
     */
    getLastCometDate() {
        const dateStr = localStorage.getItem(this.LAST_COMET_KEY);
        return dateStr ? new Date(dateStr) : null;
    }

    /**
     * Initialize at game start - decide if we'll show a comet this game
     * @param {boolean} isPremium - Is the player a MapTap+ subscriber
     * @param {number} totalRounds - Total rounds in the game (default 5)
     * @param {boolean} isBestOf - Is this a best-of practice map (reduced frequency)
     */
    initGame(isPremium = false, totalRounds = 5, isBestOf = false) {
        this.hasTriggeredThisGame = false;
        this.triggerAfterRound = null;
        this.triggerReason = null;

        // Check returning user BEFORE recording play date
        const isReturning = this.isReturningUser();
        const daysSince = this.getDaysSinceLastPlay();

        // Record that user is playing now (skip for best-of maps)
        if (!isBestOf) {
            this.recordPlayDate();
        }

        // First game ever? Always show a comet (but not for best-of)
        if (this.isFirstGame() && !isBestOf) {
            this.shouldTriggerThisGame = true;
            this.triggerReason = 'first_game';
            // Pick a round in the middle (rounds 2-4) for first-timers
            this.triggerAfterRound = 2 + Math.floor(Math.random() * 3);
            console.log(`🌠 [CometManager] First game ever! Will trigger after round ${this.triggerAfterRound}`);
            return;
        }

        // Returning user (>3 days away)? Welcome back with a comet! (but not for best-of)
        if (isReturning && !isBestOf) {
            this.shouldTriggerThisGame = true;
            this.triggerReason = 'returning';
            // Pick a round in the middle (rounds 2-4) for returning users
            this.triggerAfterRound = 2 + Math.floor(Math.random() * 3);
            console.log(`🌠 [CometManager] Welcome back! ${daysSince} days since last play. Will trigger after round ${this.triggerAfterRound}`);
            return;
        }

        // Roll probability based on subscription (reduced to 1/3 for best-of maps)
        let probability = isPremium ? this.PREMIUM_PROBABILITY : this.FREE_PROBABILITY;
        if (isBestOf) {
            probability = probability / 3;
            console.log(`🌠 [CometManager] Best-of map: reduced probability to ${(probability * 100).toFixed(1)}%`);
        }
        const roll = Math.random();

        this.shouldTriggerThisGame = roll < probability;

        if (this.shouldTriggerThisGame) {
            this.triggerReason = 'random';
            // Pick a random round (1 to totalRounds-1, not after the last round)
            this.triggerAfterRound = 1 + Math.floor(Math.random() * (totalRounds - 1));
            console.log(`🌠 [CometManager] Will trigger after round ${this.triggerAfterRound} (roll: ${roll.toFixed(3)}, threshold: ${probability})`);
        } else {
            console.log(`🌠 [CometManager] No comet this game (roll: ${roll.toFixed(3)}, threshold: ${probability})`);
        }
    }

    /**
     * Call after each round completes to check if we should trigger
     * @param {number} roundJustCompleted - The round number that just finished (1-indexed)
     * @param {boolean} isPremium - Is the player a MapTap+ subscriber
     * @param {number} delayMs - Delay before showing comet (default 1500ms)
     */
    onRoundComplete(roundJustCompleted, isPremium = false, delayMs = 1500) {
        if (!this.shouldTriggerThisGame || this.hasTriggeredThisGame) {
            return;
        }

        if (roundJustCompleted === this.triggerAfterRound) {
            this.hasTriggeredThisGame = true;

            // Mark first comet seen if applicable
            if (this.isFirstGame()) {
                this.markFirstCometSeen();
            }

            this.recordCometShown();

            console.log(`🌠 [CometManager] Triggering comet after round ${roundJustCompleted}!`);

            // Trigger with delay
            setTimeout(() => {
                if (isPremium) {
                    window.cometEffect.triggerSmallShower();
                } else {
                    window.cometEffect.triggerSingle();
                }
            }, delayMs);
        }
    }

    /**
     * Force a comet on the next round (for testing)
     */
    forceNextRound() {
        this.shouldTriggerThisGame = true;
        this.triggerAfterRound = 1;  // Will check on next onRoundComplete call
        this.hasTriggeredThisGame = false;
        console.log('🌠 [CometManager] Forced: will trigger on next round complete');
    }

    /**
     * Reset all tracking (for testing)
     */
    resetAll() {
        localStorage.removeItem(this.FIRST_COMET_KEY);
        localStorage.removeItem(this.LAST_COMET_KEY);
        localStorage.removeItem(this.LAST_PLAY_KEY);
        this.shouldTriggerThisGame = false;
        this.triggerAfterRound = null;
        this.hasTriggeredThisGame = false;
        this.triggerReason = null;
        console.log('🌠 [CometManager] All tracking reset');
    }

    /**
     * Simulate being away for X days (for testing returning user)
     */
    simulateDaysAway(days) {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - days);
        localStorage.setItem(this.LAST_PLAY_KEY, pastDate.toISOString());
        console.log(`🌠 [CometManager] Simulated ${days} days away (last play: ${pastDate.toLocaleDateString()})`);
    }

    /**
     * Get debug status
     */
    getDebugStatus() {
        const lastComet = this.getLastCometDate();
        const daysSince = this.getDaysSinceLastPlay();
        return {
            isFirstGame: this.isFirstGame(),
            daysSinceLastPlay: daysSince ? `${daysSince} days` : 'Never played',
            isReturningUser: this.isReturningUser(),
            lastCometDate: lastComet ? lastComet.toLocaleString() : 'Never',
            shouldTriggerThisGame: this.shouldTriggerThisGame,
            triggerReason: this.triggerReason || 'N/A',
            triggerAfterRound: this.triggerAfterRound,
            hasTriggeredThisGame: this.hasTriggeredThisGame
        };
    }
}

/**
 * Debug Panel for testing comet effects
 * Only shows when ?debugComet=1 is in the URL
 */
class CometDebugPanel {
    constructor(cometEffect) {
        this.comet = cometEffect;
        this.panel = null;
    }

    init() {
        // Only show if debugComet param is present
        const params = new URLSearchParams(window.location.search);
        if (!params.has('debugComet')) return;

        this.createPanel();
        console.log('🌠 Comet debug panel initialized');
    }

    createPanel() {
        this.panel = document.createElement('div');
        this.panel.id = 'comet-debug-panel';
        this.panel.innerHTML = `
            <style>
                #comet-debug-panel {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: rgba(0, 0, 0, 0.85);
                    border: 1px solid #444;
                    border-radius: 12px;
                    padding: 16px;
                    z-index: 10001;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    color: white;
                    min-width: 200px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                }
                #comet-debug-panel h3 {
                    margin: 0 0 12px 0;
                    font-size: 14px;
                    color: #ffd700;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                #comet-debug-panel .btn-row {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                #comet-debug-panel button {
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    border: 1px solid #0f3460;
                    color: white;
                    padding: 10px 16px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.2s;
                    text-align: left;
                }
                #comet-debug-panel button:hover {
                    background: linear-gradient(135deg, #0f3460 0%, #1a1a2e 100%);
                    border-color: #ffd700;
                }
                #comet-debug-panel button:active {
                    transform: scale(0.98);
                }
                #comet-debug-panel .btn-desc {
                    font-size: 10px;
                    opacity: 0.6;
                    margin-top: 2px;
                }
                #comet-debug-panel .config-section {
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px solid #333;
                }
                #comet-debug-panel label {
                    display: block;
                    font-size: 11px;
                    margin-bottom: 4px;
                    opacity: 0.8;
                }
                #comet-debug-panel input, #comet-debug-panel select {
                    width: 100%;
                    padding: 6px 8px;
                    border-radius: 4px;
                    border: 1px solid #333;
                    background: #1a1a2e;
                    color: white;
                    font-size: 12px;
                    margin-bottom: 8px;
                    box-sizing: border-box;
                }
                #comet-debug-panel .close-btn {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: none;
                    border: none;
                    color: #666;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    line-height: 24px;
                }
                #comet-debug-panel .close-btn:hover {
                    color: white;
                }
            </style>
            <button class="close-btn" onclick="this.parentElement.remove()">&times;</button>
            <h3>🌠 Comet Debug</h3>
            <div class="btn-row">
                <button id="comet-single">
                    Single Comet
                    <div class="btn-desc">Free player experience</div>
                </button>
                <button id="comet-shower">
                    Small Shower (3-5)
                    <div class="btn-desc">Premium player experience</div>
                </button>
                <button id="comet-large">
                    Large Shower (8-12)
                    <div class="btn-desc">Special events</div>
                </button>
            </div>
            <div class="config-section">
                <label>Count</label>
                <input type="number" id="comet-count" value="5" min="1" max="20">

                <label>Duration (seconds)</label>
                <input type="number" id="comet-duration" value="2.5" min="1" max="10" step="0.5">

                <label>Speed Range</label>
                <input type="text" id="comet-speed" value="400-700" placeholder="min-max">

                <label>Intensity</label>
                <select id="comet-intensity">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high" selected>High</option>
                </select>

                <button id="comet-custom" style="width: 100%; margin-top: 8px;">
                    Launch Custom
                </button>
            </div>
            <div class="config-section">
                <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #ffd700;">Manager Controls</h4>
                <button id="comet-force-next" style="width: 100%; margin-bottom: 6px;">
                    Force on Next Round
                    <div class="btn-desc">Trigger after next onRoundComplete()</div>
                </button>
                <button id="comet-simulate-round" style="width: 100%; margin-bottom: 6px;">
                    Simulate Round Complete
                    <div class="btn-desc">Call onRoundComplete(1)</div>
                </button>
                <button id="comet-reset" style="width: 100%; margin-bottom: 6px;">
                    Reset All Tracking
                    <div class="btn-desc">Clear localStorage, reset state</div>
                </button>
                <button id="comet-simulate-away" style="width: 100%; margin-bottom: 6px;">
                    Simulate 4 Days Away
                    <div class="btn-desc">Test returning user flow</div>
                </button>
                <div id="comet-status" style="font-size: 10px; opacity: 0.7; margin-top: 8px; white-space: pre-line;"></div>
            </div>
        `;

        document.body.appendChild(this.panel);

        // Bind events
        document.getElementById('comet-single').addEventListener('click', () => {
            this.comet.triggerSingle();
        });

        document.getElementById('comet-shower').addEventListener('click', () => {
            this.comet.triggerSmallShower();
        });

        document.getElementById('comet-large').addEventListener('click', () => {
            this.comet.triggerLargeShower();
        });

        document.getElementById('comet-custom').addEventListener('click', () => {
            const count = parseInt(document.getElementById('comet-count').value) || 5;
            const duration = parseFloat(document.getElementById('comet-duration').value) || 2.5;
            const speedStr = document.getElementById('comet-speed').value || '400-700';
            const [speedMin, speedMax] = speedStr.split('-').map(s => parseInt(s.trim()));
            const intensity = document.getElementById('comet-intensity').value;

            this.comet.start({
                count,
                duration,
                speedMin: speedMin || 400,
                speedMax: speedMax || 700,
                intensity
            });
        });

        // Manager controls
        document.getElementById('comet-force-next').addEventListener('click', () => {
            window.cometManager.forceNextRound();
            this.updateStatus();
        });

        document.getElementById('comet-simulate-round').addEventListener('click', () => {
            // Simulate completing round 1 as a non-premium user
            window.cometManager.onRoundComplete(1, false, 500);
            this.updateStatus();
        });

        document.getElementById('comet-reset').addEventListener('click', () => {
            window.cometManager.resetAll();
            this.updateStatus();
        });

        document.getElementById('comet-simulate-away').addEventListener('click', () => {
            window.cometManager.simulateDaysAway(4);
            this.updateStatus();
        });

        // Initial status update
        this.updateStatus();
    }

    updateStatus() {
        const statusEl = document.getElementById('comet-status');
        if (!statusEl || !window.cometManager) return;

        const status = window.cometManager.getDebugStatus();
        statusEl.textContent = `First game: ${status.isFirstGame}
Days since play: ${status.daysSinceLastPlay}
Returning user: ${status.isReturningUser}
Trigger reason: ${status.triggerReason}
Trigger round: ${status.triggerAfterRound || 'N/A'}
Triggered: ${status.hasTriggeredThisGame}`;
    }
}

// Create global instances
window.cometEffect = new CometEffect();
window.cometManager = new CometManager();
window.CometDebugPanel = CometDebugPanel;

// Auto-init debug panel when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new CometDebugPanel(window.cometEffect).init();
    });
} else {
    new CometDebugPanel(window.cometEffect).init();
}
