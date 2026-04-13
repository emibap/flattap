/**
 * Visual Effects Module
 * Handles fireworks, star animations, and other visual effects
 */

class EffectsService {
    constructor() {
        this.fireworksRunning = false;
        this.timeoutId = null;

        // Pause fireworks when tab loses focus
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.fireworksRunning) {
                // Clear pending timeout to prevent accumulation
                if (this.timeoutId) {
                    clearTimeout(this.timeoutId);
                    this.timeoutId = null;
                }
            }
        });
    }

    /**
     * Launch fireworks with specified intensity
     * @param {number} intensity - Intensity level (0-10+)
     * @param {Object} UI - UI object containing canvas and ctx references
     */
    launchFireworks(intensity, UI) {
        if (intensity <= 0) return;
        this.fireworksRunning = true;

        // full-screen canvas on top of globe
        const canvas = UI.canvas;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.pointerEvents = 'none';
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = UI.ctx;

        // interval scales from max (3000ms) → min (1500ms)
        const minInt = 1500, maxInt = 3000;
        const factor = Math.min(intensity / 10, 1);
        const baseInterval = maxInt - factor * (maxInt - minInt);

        const fireworks = [];

        const drawFrame = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = fireworks.length - 1; i >= 0; i--) {
                const particles = fireworks[i];
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';

                for (let p of particles) {
                    if (p.alpha <= 0) continue;
                    ctx.fillStyle = `hsla(${p.hue},100%,60%,${p.alpha})`;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fill();

                    p.x += p.vx;
                    p.y += p.vy;
                    p.vx *= 0.98;
                    p.vy *= 0.98;
                    p.alpha -= 0.015;
                }

                ctx.restore();
                if (particles.every(p => p.alpha <= 0)) fireworks.splice(i, 1);
            }

            if (this.fireworksRunning && fireworks.length) {
                requestAnimationFrame(drawFrame);
            }
        };

        const spawnExplosion = (x, y) => {
            const hue = Math.random() * 360;
            const count = 8 + Math.floor(factor * 12);
            const burst = [];

            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 1 + Math.random() * 2;
                burst.push({
                    x, y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: 1 + Math.random() * 2,
                    alpha: 1,
                    hue
                });
            }

            fireworks.push(burst);
            if (fireworks.length === 1) requestAnimationFrame(drawFrame);
        };

        // pick a point near one of the four screen edges
        const triggerExplosion = () => {
            const w = canvas.width, h = canvas.height;
            const edgeMargin = 0.1; // 10% in from edge
            const mx = w * edgeMargin;
            const my = h * edgeMargin;

            let x, y;
            if (Math.random() < 0.5) {
                // vertical edge
                x = Math.random() < 0.5 ? mx : w - mx;
                y = Math.random() * h;
            } else {
                // horizontal edge
                x = Math.random() * w;
                y = Math.random() < 0.5 ? my : h - my;
            }

            spawnExplosion(x, y);
        };

        const scheduleNext = () => {
            if (!this.fireworksRunning) return;
            // Don't schedule if tab is hidden
            if (document.hidden) return;

            const jitter = baseInterval * 0.5;
            const delay = baseInterval + (Math.random() - 0.5) * jitter;
            this.timeoutId = setTimeout(() => {
                triggerExplosion();
                scheduleNext();
            }, Math.max(200, delay));
        };

        scheduleNext();
    }

    /**
     * Stop fireworks animation
     */
    stopFireworks() {
        this.fireworksRunning = false;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    /**
     * Create dripping star animations
     * @param {number} count - Number of stars to create
     * @param {number} interval - Interval between stars in ms
     * @param {string} type - Star type ('gold' or 'silver')
     * @param {Object} UI - UI object containing score element
     */
    dripStars(count = 500, interval = 500, type = 'silver', UI) {
        for (let i = 0; i < count; i++) {
            setTimeout(() => this.createStar(type, UI), i * interval);
        }
    }

    /**
     * Create a single falling star
     * @param {string} type - Star type ('gold' or 'silver')
     * @param {Object} UI - UI object containing score element
     */
    createStar(type = 'silver', UI) {
        const star = document.createElement('div');
        star.className = `drip-star-${type}`; // e.g. "drip-star-silver"
        star.textContent = '★';

        // start at your score's horizontal span
        const rect = UI.score.getBoundingClientRect();
        star.style.left = `${rect.left + Math.random() * rect.width}px`;
        star.style.top = `${rect.bottom - 15}px`;

        // pick a random "halfway" drop point between 40vh and 60vh
        const endPct = 40 + Math.random() * 20;
        star.style.setProperty('--endY', `${endPct}vh`);

        // give it a slooooow fall: random 5–10 seconds
        const dur = 5 + Math.random() * 5;
        star.style.animationDuration = `${dur}s`;

        document.body.appendChild(star);
        star.addEventListener('animationend', () => star.remove());
    }
}

// Export for use in beta.html
window.EffectsService = EffectsService;