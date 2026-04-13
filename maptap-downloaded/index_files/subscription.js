// js/subscription.js - MapTap+ Subscription Management
// Handles Stripe integration for web subscriptions

// =============================================================================
// KILL SWITCH - Set to false to disable all subscription features
// When disabled: Everyone gets free tier, no subscription UI shown
// =============================================================================
const SUBSCRIPTIONS_ENABLED = true;

let isProUser = false;
let subscriptionStatus = null;

// =============================================================================
// CONFETTI CELEBRATION
// =============================================================================
function launchConfetti() {
    const canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10001';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#44f8fb', '#28a745', '#ffb86c', '#ff6b6b', '#a855f7', '#ffd700', '#ff69b4'];
    const confettiCount = 150;
    const confetti = [];

    // Create confetti particles
    for (let i = 0; i < confettiCount; i++) {
        confetti.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 200,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 20,
            vy: -Math.random() * 20 - 10,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 8 + 4,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 15,
            shape: Math.random() > 0.5 ? 'rect' : 'circle'
        });
    }

    let frame = 0;
    const maxFrames = 180; // 3 seconds at 60fps

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        confetti.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.5; // gravity
            p.vx *= 0.99; // air resistance
            p.rotation += p.rotationSpeed;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, 1 - frame / maxFrames);

            if (p.shape === 'rect') {
                ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        });

        frame++;
        if (frame < maxFrames) {
            requestAnimationFrame(animate);
        } else {
            canvas.remove();
        }
    }

    animate();
}

// Stripe publishable key (safe for frontend)
const STRIPE_PUBLISHABLE_KEY = "pk_live_51Se2Qi8UQe2i6ViLoLdEvcqxxCdHdjzSMmBsZWb4dz4YnWKuDBvxi3eiDa6cZb2iTYc4F7V9Oi9r8cZyz7pFQoiC00q8SATNNE";

// Feature limits
const PRO_LIMITS = {
    maxZoom: 1.05,
    maxTileDetail: 7
};
const FREE_LIMITS = {
    maxZoom: 1.12,
    maxTileDetail: 5
};

/**
 * Get localStorage key for subscription cache
 * @param {string} userId - Firebase user ID
 * @returns {string} Cache key
 */
function getSubscriptionCacheKey(userId) {
    return `maptap_subscription_${userId}`;
}

/**
 * Save subscription status to localStorage
 * @param {string} userId - Firebase user ID
 * @param {Object} status - Subscription status object
 */
function cacheSubscriptionStatus(userId, status) {
    // Skip caching in devmode (e.g., when using ?letmeplay=1)
    if (typeof PARAMS !== 'undefined' && PARAMS.devmode === "1") {
        console.log('[Subscription] Skipping cache in devmode');
        return;
    }

    try {
        const cacheData = {
            ...status,
            cachedAt: Date.now()
        };
        localStorage.setItem(getSubscriptionCacheKey(userId), JSON.stringify(cacheData));
        console.log('[Subscription] Status cached locally');
    } catch (e) {
        console.warn('[Subscription] Failed to cache status:', e);
    }
}

/**
 * Load subscription status from localStorage
 * @param {string} userId - Firebase user ID
 * @returns {Object|null} Cached status or null
 */
function loadCachedSubscriptionStatus(userId) {
    try {
        const cached = localStorage.getItem(getSubscriptionCacheKey(userId));
        if (cached) {
            const data = JSON.parse(cached);
            // Cache is valid for 30 days (backup fallback)
            const cacheAge = Date.now() - (data.cachedAt || 0);
            if (cacheAge < 30 * 24 * 60 * 60 * 1000) {
                console.log('[Subscription] Loaded from cache (age:', Math.round(cacheAge / 1000 / 60), 'min)');
                return data;
            }
            console.log('[Subscription] Cache expired');
        }
    } catch (e) {
        console.warn('[Subscription] Failed to load cache:', e);
    }
    return null;
}

/**
 * Initialize subscriptions after Firebase Auth is ready
 * Checks Firestore for subscription status, falls back to cache on error
 */
async function initializeSubscriptions() {
    // Check kill switch first
    if (!SUBSCRIPTIONS_ENABLED) {
        console.log('[Subscription] Subscriptions disabled via kill switch');
        applySubscriptionLimits(false);
        return;
    }

    // Check if user is logged in via Firebase
    const user = window.currentAuthUser;
    if (!user) {
        console.log('[Subscription] No user logged in, applying free limits');
        applySubscriptionLimits(false);
        return;
    }

    try {
        // Dynamically import Firebase functions
        const { httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js');
        const getSubscriptionStatusFn = httpsCallable(window.firebaseFunctions, 'getSubscriptionStatus');
        const result = await getSubscriptionStatusFn();

        console.log(`[Subscription] API response:`, result.data);
        console.log(`[Subscription] isSubscribed=${result.data.isSubscribed}, isGifted=${result.data.isGifted}, status=${result.data.status}`);

        // Check if we need auto-restore:
        // 1. Cache says Pro but API says not subscribed (webhook may have failed)
        // 2. API says subscribed but missing currentPeriodEnd (incomplete data)
        const cached = loadCachedSubscriptionStatus(user.uid);
        const needsAutoRestore = (
            (cached && cached.isActive && !result.data.isSubscribed) ||
            (result.data.isSubscribed && !result.data.currentPeriodEnd)
        );

        if (needsAutoRestore) {
            console.log('[Subscription] Data mismatch detected, attempting auto-restore...');
            try {
                const restoreSubscriptionFn = httpsCallable(window.firebaseFunctions, 'restoreSubscription');
                const restoreResult = await restoreSubscriptionFn();
                console.log('[Subscription] Auto-restore result:', restoreResult.data);

                if (restoreResult.data.success && restoreResult.data.isSubscribed) {
                    isProUser = true;
                    subscriptionStatus = {
                        isActive: true,
                        status: restoreResult.data.status,
                        currentPeriodEnd: restoreResult.data.currentPeriodEnd,
                        cancelAtPeriodEnd: restoreResult.data.cancelAtPeriodEnd
                    };
                    console.log('[Subscription] Auto-restore successful, Pro limits applied');
                    cacheSubscriptionStatus(user.uid, subscriptionStatus);
                    applySubscriptionLimits(true);
                    return;
                }
            } catch (restoreError) {
                console.warn('[Subscription] Auto-restore failed:', restoreError.message);
            }
        }

        // Normal flow - use API result
        isProUser = result.data.isSubscribed;
        subscriptionStatus = {
            isActive: result.data.isSubscribed,
            status: result.data.status,
            currentPeriodEnd: result.data.currentPeriodEnd,
            cancelAtPeriodEnd: result.data.cancelAtPeriodEnd
        };

        console.log(`[Subscription] Status for user ${user.uid}:`, subscriptionStatus);

        // Cache the result for fallback
        cacheSubscriptionStatus(user.uid, subscriptionStatus);

        // Apply feature gates
        applySubscriptionLimits(isProUser);

    } catch (error) {
        console.error('[Subscription] Failed to check subscription:', error);

        // Try to load from cache as fallback
        const cached = loadCachedSubscriptionStatus(user.uid);
        if (cached && cached.isActive) {
            console.log('[Subscription] Using cached Pro status');
            isProUser = true;
            subscriptionStatus = cached;
            applySubscriptionLimits(true);
        } else {
            // Apply free limits if no valid cache
            applySubscriptionLimits(false);
        }
    }
}

/**
 * Check subscription status (alias for initialize)
 */
async function checkSubscriptionStatus() {
    return initializeSubscriptions();
}

/**
 * Apply zoom/detail limits based on subscription status
 * @param {boolean} isPro - Whether user has pro subscription
 */
function applySubscriptionLimits(isPro) {
    // Respect the MapTap+ Max Zoom toggle in settings
    const proZoomEnabled = isPro && (typeof gameHistory !== 'undefined' ? gameHistory.proZoomEnabled !== false : true);
    const limits = proZoomEnabled ? PRO_LIMITS : FREE_LIMITS;

    // Update camera zoom limits if GlobeCamera is available
    if (typeof GlobeCamera !== 'undefined' && GlobeCamera.MIN_ZOOM !== undefined) {
        GlobeCamera.MIN_ZOOM = limits.maxZoom;
        console.log(`[Subscription] Camera MIN_ZOOM set to ${limits.maxZoom}`);
    }

    // Store limits globally for TileGlobe config (BEFORE checking globe)
    window.subscriptionLimits = limits;

    // Update TileGlobe max tile zoom if globe instance exists
    // Check both beta.html (window.myGlobe) and adventures.html (window.adventuresGlobe)
    let globeUpdated = false;

    if (typeof window.myGlobe !== 'undefined' && window.myGlobe.setMaxTileZoom) {
        console.log(`[Subscription] Updating TileGlobe maxZoom to ${limits.maxTileDetail}`);
        window.myGlobe.setMaxTileZoom(limits.maxTileDetail);
        globeUpdated = true;

        // Moon is now enabled for all users via tileglobe-setup.js config.
        // These calls are redundant but harmless (enable() on already-enabled is a no-op).
        if (isPro && window.myGlobe.showMoon) {
            window.myGlobe.showMoon(true);
            console.log(`[Subscription] Moon enabled for Pro user`);
        }
    }

    console.log(`[Subscription] Checking for adventuresGlobe:`, {
        adventuresGlobeExists: typeof window.adventuresGlobe !== 'undefined',
        hasGetGlobe: typeof window.adventuresGlobe !== 'undefined' && !!window.adventuresGlobe.getGlobe
    });
    if (typeof window.adventuresGlobe !== 'undefined' && window.adventuresGlobe.getGlobe) {
        const adventuresGlobeInstance = window.adventuresGlobe.getGlobe();
        console.log(`[Subscription] adventuresGlobe.getGlobe() returned:`, adventuresGlobeInstance);
        console.log(`[Subscription] Has setMaxTileZoom:`, adventuresGlobeInstance && !!adventuresGlobeInstance.setMaxTileZoom);
        if (adventuresGlobeInstance && adventuresGlobeInstance.setMaxTileZoom) {
            console.log(`[Subscription] Updating Adventures TileGlobe maxZoom to ${limits.maxTileDetail}`);
            adventuresGlobeInstance.setMaxTileZoom(limits.maxTileDetail);
            globeUpdated = true;

            // Enable moon for Pro users on adventures
            if (isPro && adventuresGlobeInstance.showMoon) {
                adventuresGlobeInstance.showMoon(true);
                console.log(`[Subscription] Moon enabled for Pro user (adventures)`);
            }
        }
    }

    if (!globeUpdated) {
        console.log(`[Subscription] Globe not ready yet, limits stored in window.subscriptionLimits`);
    }

    // Backup: Apply limits again after 3 seconds in case of timing issues
    if (isPro) {
        console.log(`[Subscription] Scheduling 3-second backup for Pro user`);
        setTimeout(() => {
            console.log(`[Subscription] Backup timer fired - checking globes...`);
            if (typeof window.myGlobe !== 'undefined' && window.myGlobe.setMaxTileZoom) {
                console.log(`[Subscription] Backup: Setting maxZoom to ${limits.maxTileDetail}`);
                window.myGlobe.setMaxTileZoom(limits.maxTileDetail);

                // Enable moon for Pro users (backup)
                if (window.myGlobe.showMoon) {
                    window.myGlobe.showMoon(true);
                    console.log(`[Subscription] Backup: Moon enabled for Pro user`);
                }
            }
            console.log(`[Subscription] Backup: adventuresGlobe exists:`, typeof window.adventuresGlobe !== 'undefined');
            if (typeof window.adventuresGlobe !== 'undefined' && window.adventuresGlobe.getGlobe) {
                const adventuresGlobeInstance = window.adventuresGlobe.getGlobe();
                console.log(`[Subscription] Backup: getGlobe() returned:`, adventuresGlobeInstance);
                if (adventuresGlobeInstance && adventuresGlobeInstance.setMaxTileZoom) {
                    console.log(`[Subscription] Backup: Setting Adventures maxZoom to ${limits.maxTileDetail}`);
                    adventuresGlobeInstance.setMaxTileZoom(limits.maxTileDetail);

                    // Enable moon for Pro users (adventures backup)
                    if (adventuresGlobeInstance.showMoon) {
                        adventuresGlobeInstance.showMoon(true);
                        console.log(`[Subscription] Backup: Moon enabled for Pro user (adventures)`);
                    }
                } else {
                    console.log(`[Subscription] Backup: No setMaxTileZoom on adventures globe`);
                }
            }
        }, 3000);
    }

    // Update settings UI if available
    if (typeof window.updateSettingsSubscriptionSection === 'function') {
        window.updateSettingsSubscriptionSection();
    }

    console.log(`[Subscription] ${isPro ? 'Pro' : 'Free'} limits applied: zoom=${limits.maxZoom}, tiles=z${limits.maxTileDetail}`);
}

/**
 * Get current subscription limits
 * @returns {Object} Current limits based on subscription status
 */
function getSubscriptionLimits() {
    return isProUser ? PRO_LIMITS : FREE_LIMITS;
}

/**
 * Start Stripe Checkout for subscription
 * @param {string} priceType - 'monthly' or 'yearly'
 * @param {boolean} withTrial - If true, includes 7-day free trial (default: false)
 * @returns {Promise<Object>} Result with success status
 */
async function startCheckout(priceType, withTrial = false) {
    // Check if user is logged in
    const user = window.currentAuthUser;
    if (!user) {
        console.warn('[Subscription] User must be logged in to subscribe');
        return { success: false, error: 'Please sign in first' };
    }

    try {
        // Get current page URL for redirect
        const currentUrl = window.location.href.split('?')[0];
        const successUrl = currentUrl + '?subscription=success';
        const cancelUrl = currentUrl + '?subscription=cancelled';

        console.log(`[Subscription] Starting checkout: ${priceType}${withTrial ? ' with 7-day trial' : ''}`);

        // Dynamically import Firebase functions
        const { httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js');
        const createCheckoutSessionFn = httpsCallable(window.firebaseFunctions, 'createCheckoutSession');
        const result = await createCheckoutSessionFn({
            priceType: priceType,
            successUrl: successUrl,
            cancelUrl: cancelUrl,
            withTrial: withTrial
        });

        // Redirect to Stripe Checkout
        if (result.data.url) {
            window.location.href = result.data.url;
            return { success: true };
        } else {
            throw new Error('No checkout URL returned');
        }

    } catch (error) {
        console.error('[Subscription] Checkout failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Handle subscription success (called after redirect back from Stripe)
 */
function handleSubscriptionSuccess() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('subscription') === 'success') {
        console.log('[Subscription] Purchase successful! Refreshing status...');
        // Remove query param from URL
        window.history.replaceState({}, '', window.location.pathname);
        // Refresh subscription status
        initializeSubscriptions();
        // Show thank you modal after a brief delay (allow modals to load)
        setTimeout(() => {
            showSubscriptionThankYou();
        }, 500);
        return true;
    }
    return false;
}

/**
 * Show the thank you modal after successful subscription
 */
function showSubscriptionThankYou() {
    // Wait for modals to be loaded
    if (window.modalsLoaded) {
        window.modalsLoaded.then(() => {
            _displayThankYouModal();
        });
    } else {
        // Fallback if modalsLoaded promise isn't available
        _displayThankYouModal();
    }
}

/**
 * Internal function to display the thank you modal
 */
function _displayThankYouModal() {
    const modal = document.getElementById('subscriptionModal');
    const successSection = document.getElementById('subscription-success');
    const upgradeSection = document.getElementById('subscription-upgrade');
    const statusSection = document.getElementById('subscription-status');
    const loadingSection = document.getElementById('subscription-loading');
    const closeButton = document.getElementById('subscription-success-close');

    if (!modal || !successSection) {
        console.warn('[Subscription] Thank you modal elements not found');
        return;
    }

    // Hide all other sections
    if (upgradeSection) upgradeSection.style.display = 'none';
    if (statusSection) statusSection.style.display = 'none';
    if (loadingSection) loadingSection.style.display = 'none';

    // Show success section
    successSection.style.display = 'block';

    // Show modal
    modal.style.display = 'block';

    // Launch confetti celebration!
    setTimeout(() => launchConfetti(), 100);

    // Set up close button
    if (closeButton) {
        closeButton.onclick = () => {
            modal.style.display = 'none';
            // Reset to normal state for future opens
            successSection.style.display = 'none';
        };
    }

    console.log('[Subscription] Thank you modal displayed');
}

/**
 * Check if user is a pro subscriber
 * @returns {boolean} Whether user has active subscription
 */
function isSubscribed() {
    return isProUser;
}

/**
 * Get current subscription status details
 * @returns {Object|null} Subscription status or null if not subscribed
 */
function getSubscriptionStatus() {
    return subscriptionStatus;
}

/**
 * Check if subscriptions feature is enabled (kill switch)
 * @returns {boolean} Whether subscriptions are enabled
 */
function isSubscriptionsEnabled() {
    return SUBSCRIPTIONS_ENABLED;
}

// Export functions for use in other scripts
window.MapTapSubscription = {
    isEnabled: isSubscriptionsEnabled,
    initialize: initializeSubscriptions,
    checkStatus: checkSubscriptionStatus,
    isSubscribed: isSubscribed,
    getStatus: getSubscriptionStatus,
    getLimits: getSubscriptionLimits,
    startCheckout: startCheckout,
    handleSuccess: handleSubscriptionSuccess,
    showThankYou: showSubscriptionThankYou  // For testing: MapTapSubscription.showThankYou()
};

// Check for subscription success on page load
document.addEventListener('DOMContentLoaded', () => {
    handleSubscriptionSuccess();
});

console.log('[Subscription] subscription.js loaded (Stripe mode)');
