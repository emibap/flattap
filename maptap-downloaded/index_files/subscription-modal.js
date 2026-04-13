// subscription-modal.js - MapTap+ subscription modal functionality

// Modal elements (populated after modals load)
let subscriptionModal = null;
let subscriptionCloseButton = null;
let subscriptionUpgradeSection = null;
let subscriptionStatusSection = null;
let subscriptionLoadingSection = null;
let subscriptionMonthlyButton = null;
let subscriptionYearlyButton = null;
let subscriptionRestoreButton = null;
let subscriptionLoginPrompt = null;
let subscriptionLoginButton = null;
let subscriptionSignupButton = null;
let subscriptionStatusText = null;
let subscriptionExpiry = null;

// Settings section elements
let settingsSubscriptionSection = null;
let settingsNotSubscribed = null;
let settingsSubscribed = null;
let settingsUpgradeButton = null;

/**
 * Initialize subscription modal elements after modals are loaded
 */
function initializeSubscriptionModal() {
    // Check if subscriptions are enabled first
    const subscriptionsEnabled = window.MapTapSubscription && window.MapTapSubscription.isEnabled();

    // Initialize settings section elements
    settingsSubscriptionSection = document.getElementById('settings-subscription-section');
    settingsNotSubscribed = document.getElementById('settings-not-subscribed');
    settingsSubscribed = document.getElementById('settings-subscribed');
    settingsUpgradeButton = document.getElementById('settings-upgrade-button');

    // Hide settings section if subscriptions are disabled
    if (settingsSubscriptionSection) {
        settingsSubscriptionSection.style.display = subscriptionsEnabled ? 'block' : 'none';
    }

    // Only initialize modal if subscriptions are enabled
    if (!subscriptionsEnabled) {
        console.log('[SubscriptionModal] Subscriptions disabled - skipping modal init');
        return;
    }

    // Initialize modal elements
    subscriptionModal = document.getElementById('subscriptionModal');
    subscriptionCloseButton = document.getElementById('subscription-close-button');
    subscriptionUpgradeSection = document.getElementById('subscription-upgrade');
    subscriptionStatusSection = document.getElementById('subscription-status');
    subscriptionLoadingSection = document.getElementById('subscription-loading');
    subscriptionMonthlyButton = document.getElementById('subscription-monthly-button');
    subscriptionYearlyButton = document.getElementById('subscription-yearly-button');
    subscriptionRestoreButton = document.getElementById('subscription-restore-button');
    subscriptionLoginPrompt = document.getElementById('subscription-login-prompt');
    subscriptionLoginButton = document.getElementById('subscription-login-button');
    subscriptionSignupButton = document.getElementById('subscription-signup-button');
    subscriptionStatusText = document.getElementById('subscription-status-text');
    subscriptionExpiry = document.getElementById('subscription-expiry');

    if (!subscriptionModal) {
        console.warn('[SubscriptionModal] Modal elements not found');
        return;
    }

    // Set up event listeners
    initializeSubscriptionListeners();

    // Set up settings upgrade button
    if (settingsUpgradeButton) {
        settingsUpgradeButton.addEventListener('click', () => {
            // Close settings modal first
            if (PAGE && PAGE.settingsModal) {
                PAGE.settingsModal.style.display = 'none';
            }
            openSubscriptionModal();
        });
    }

    // Update settings section state
    updateSettingsSubscriptionSection();

    console.log('[SubscriptionModal] Initialized');
}

/**
 * Set up all subscription modal event listeners
 */
function initializeSubscriptionListeners() {
    // Close button
    if (subscriptionCloseButton) {
        subscriptionCloseButton.addEventListener('click', closeSubscriptionModal);
    }

    // Click outside to close
    if (subscriptionModal) {
        subscriptionModal.addEventListener('click', (event) => {
            if (event.target === subscriptionModal) {
                closeSubscriptionModal();
            }
        });
    }

    // Monthly purchase button
    if (subscriptionMonthlyButton) {
        subscriptionMonthlyButton.addEventListener('click', () => handlePurchase('monthly'));
    }

    // Yearly purchase button
    if (subscriptionYearlyButton) {
        subscriptionYearlyButton.addEventListener('click', () => handlePurchase('yearly'));
    }

    // Restore purchases button
    if (subscriptionRestoreButton) {
        subscriptionRestoreButton.addEventListener('click', handleRestore);
    }

    // Login button (in modal)
    if (subscriptionLoginButton) {
        subscriptionLoginButton.addEventListener('click', () => {
            closeSubscriptionModal();
            if (typeof openAuthModal === 'function') {
                openAuthModal();
            }
        });
    }

    // Signup button (in modal)
    if (subscriptionSignupButton) {
        subscriptionSignupButton.addEventListener('click', () => {
            closeSubscriptionModal();
            if (typeof openAuthModal === 'function') {
                // Set flag to show signup form
                window.authModalShowSignup = true;
                openAuthModal();
            }
        });
    }
}

/**
 * Open the subscription modal and update its state
 */
function openSubscriptionModal() {
    if (!subscriptionModal) {
        console.warn('[SubscriptionModal] Modal not initialized');
        return;
    }

    // Check if subscriptions are enabled
    if (!window.MapTapSubscription || !window.MapTapSubscription.isEnabled()) {
        console.log('[SubscriptionModal] Subscriptions disabled');
        return;
    }

    // Update modal state based on current subscription
    updateSubscriptionModalState();

    // Show the modal
    subscriptionModal.style.display = 'block';
}

/**
 * Close the subscription modal
 */
function closeSubscriptionModal() {
    if (subscriptionModal) {
        subscriptionModal.style.display = 'none';
    }
}

/**
 * Update modal UI based on subscription state
 */
function updateSubscriptionModalState() {
    const isLoggedIn = window.currentAuthUser != null;
    const isSubscribed = window.MapTapSubscription && window.MapTapSubscription.isSubscribed();

    // Hide all sections first (including success section)
    if (subscriptionUpgradeSection) subscriptionUpgradeSection.style.display = 'none';
    if (subscriptionStatusSection) subscriptionStatusSection.style.display = 'none';
    if (subscriptionLoadingSection) subscriptionLoadingSection.style.display = 'none';
    if (subscriptionLoginPrompt) subscriptionLoginPrompt.style.display = 'none';
    const successSection = document.getElementById('subscription-success');
    if (successSection) successSection.style.display = 'none';

    if (isSubscribed) {
        // Show subscription status
        if (subscriptionStatusSection) {
            subscriptionStatusSection.style.display = 'block';

            // Update status details
            const status = window.MapTapSubscription.getStatus();
            if (status && subscriptionStatusText) {
                subscriptionStatusText.textContent = status.willRenew ? 'Active - Auto-renews' : 'Active';

                if (status.expiresDate && subscriptionExpiry) {
                    const expiryDate = new Date(status.expiresDate);
                    subscriptionExpiry.textContent = `Renews: ${expiryDate.toLocaleDateString()}`;
                    subscriptionExpiry.style.display = 'block';
                }
            }
        }
    } else {
        // Show upgrade section
        if (subscriptionUpgradeSection) {
            subscriptionUpgradeSection.style.display = 'block';
        }

        // Show login prompt if not logged in (but keep buttons enabled so alert shows)
        if (!isLoggedIn && subscriptionLoginPrompt) {
            subscriptionLoginPrompt.style.display = 'block';
        }

        // Enable purchase buttons
        if (subscriptionMonthlyButton) subscriptionMonthlyButton.disabled = false;
        if (subscriptionYearlyButton) subscriptionYearlyButton.disabled = false;
    }
}

/**
 * Handle purchase button click
 * @param {string} planType - 'monthly' or 'yearly'
 */
async function handlePurchase(planType) {
    if (!window.MapTapSubscription) {
        console.error('[SubscriptionModal] MapTapSubscription not available');
        return;
    }

    // Check if user is logged in
    if (!window.currentAuthUser) {
        // Scroll to and highlight the login prompt
        if (subscriptionLoginPrompt) {
            subscriptionLoginPrompt.style.animation = 'none';
            subscriptionLoginPrompt.offsetHeight; // Trigger reflow
            subscriptionLoginPrompt.style.animation = 'pulse-highlight 0.5s ease-out';
        }
        return;
    }

    // Show loading state
    showSubscriptionLoading(true);

    try {
        // Start Stripe checkout - this will redirect to Stripe
        const result = await window.MapTapSubscription.startCheckout(planType);

        if (!result.success) {
            showSubscriptionLoading(false);
            alert('Checkout failed: ' + (result.error || 'Unknown error'));
        }
        // If successful, user is redirected to Stripe - no need to hide loading

    } catch (error) {
        showSubscriptionLoading(false);
        console.error('[SubscriptionModal] Checkout error:', error);
        alert('An error occurred. Please try again.');
    }
}

/**
 * Handle restore purchases button click
 * Queries Stripe directly to sync subscription status
 */
async function handleRestore() {
    if (!window.MapTapSubscription) {
        console.error('[SubscriptionModal] MapTapSubscription not available');
        return;
    }

    if (!window.currentAuthUser) {
        alert('Please sign in to check your subscription status.');
        return;
    }

    showSubscriptionLoading(true);

    try {
        // Call restoreSubscription to sync with Stripe
        const { httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js');
        const restoreSubscriptionFn = httpsCallable(window.firebaseFunctions, 'restoreSubscription');
        const result = await restoreSubscriptionFn();

        console.log('[SubscriptionModal] Restore result:', result.data);

        if (result.data.success) {
            // Clear local cache so it gets refreshed
            const userId = window.currentAuthUser.uid;
            localStorage.removeItem(`maptap_subscription_${userId}`);

            // Re-initialize to apply the restored status
            await window.MapTapSubscription.initialize();

            showSubscriptionLoading(false);
            updateSubscriptionModalState();

            if (result.data.isSubscribed) {
                alert('Subscription restored! Your MapTap+ benefits are now active.');
            } else {
                alert('No active subscription found for this account.');
            }
        } else {
            showSubscriptionLoading(false);
            alert(result.data.error || 'No subscription found for this account.');
        }
    } catch (error) {
        showSubscriptionLoading(false);
        console.error('[SubscriptionModal] Restore error:', error);
        alert('Failed to restore subscription. Please try again.');
    }
}

/**
 * Show or hide loading state
 * @param {boolean} show - Whether to show loading
 */
function showSubscriptionLoading(show) {
    if (subscriptionUpgradeSection) subscriptionUpgradeSection.style.display = show ? 'none' : 'block';
    if (subscriptionStatusSection) subscriptionStatusSection.style.display = 'none';
    if (subscriptionLoadingSection) subscriptionLoadingSection.style.display = show ? 'flex' : 'none';
    const successSection = document.getElementById('subscription-success');
    if (successSection) successSection.style.display = 'none';
}

/**
 * Update the settings modal subscription section based on current state
 */
function updateSettingsSubscriptionSection() {
    if (!settingsSubscriptionSection) return;

    const isSubscribed = window.MapTapSubscription && window.MapTapSubscription.isSubscribed();

    if (settingsNotSubscribed) {
        settingsNotSubscribed.style.display = isSubscribed ? 'none' : 'block';
    }
    if (settingsSubscribed) {
        settingsSubscribed.style.display = isSubscribed ? 'block' : 'none';
    }

    // Show/hide MapTap+ zoom toggle
    if (typeof updateProZoomVisibility === 'function') {
        updateProZoomVisibility();
    }
}

// Export functions globally
window.openSubscriptionModal = openSubscriptionModal;
window.closeSubscriptionModal = closeSubscriptionModal;
window.initializeSubscriptionModal = initializeSubscriptionModal;
window.updateSettingsSubscriptionSection = updateSettingsSubscriptionSection;
