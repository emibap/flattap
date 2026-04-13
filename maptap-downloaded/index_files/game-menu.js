/**
 * Game Menu Module
 * Shared hamburger menu for beta.html and adventures.html
 */

(function() {
    'use strict';

    const MENU_HTML = `
        <button id="game-menu-button" class="game-menu-button">
            <span class="hamburger-icon">☰</span>
            <span class="menu-label">Menu</span>
        </button>
        <div id="game-menu-dropdown" class="game-menu-dropdown">
            <a href="/home.html" class="game-menu-item">Home</a>
            <a href="/prior-days.html" class="game-menu-item">Best of MapTap</a>
            <a href="/practice.html" class="game-menu-item">Practice Levels</a>
            <button id="game-menu-maptap-plus" class="game-menu-item game-menu-plus" style="display: none;">Get MapTap+</button>
            <a href="/profile.html" class="game-menu-item">My Profile</a>
            <a href="/groups.html" class="game-menu-item" id="menu-groups">Groups<span id="groups-unread-badge" class="menu-badge" style="display: none;"></span></a>
            <a href="/versus.html" class="game-menu-item" id="menu-versus">Versus<span id="versus-unread-badge" class="menu-badge" style="display: none;"></span></a>
            <a href="/prior-days.html" class="game-menu-item">Play Prior Days</a>
            <button id="game-menu-settings" class="game-menu-item">Settings</button>
        </div>
    `;

    let initialized = false;

    /**
     * Initialize the game menu
     * @param {Object} options - Configuration options
     * @param {string} options.containerId - ID of the container element to inject menu into
     * @param {Function} options.onSettingsClick - Callback when settings is clicked
     * @param {Function} options.onMapTapPlusClick - Callback when MapTap+ button is clicked
     * @param {boolean} options.hideDailyPractice - Hide the daily practice menu item
     */
    function init(options = {}) {
        if (initialized) return;

        const containerId = options.containerId || 'topbar_left';
        const container = document.getElementById(containerId);

        if (!container) {
            console.warn('[GameMenu] Container not found:', containerId);
            return;
        }

        // Inject menu HTML
        container.innerHTML = MENU_HTML;

        // Get references
        const menuButton = document.getElementById('game-menu-button');
        const menuDropdown = document.getElementById('game-menu-dropdown');
        const settingsButton = document.getElementById('game-menu-settings');
        const mapTapPlusButton = document.getElementById('game-menu-maptap-plus');

        if (!menuButton || !menuDropdown) {
            console.warn('[GameMenu] Menu elements not found after injection');
            return;
        }

        // Menu toggle
        menuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            menuDropdown.classList.toggle('open');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!menuButton.contains(e.target) && !menuDropdown.contains(e.target)) {
                menuDropdown.classList.remove('open');
            }
        });

        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                menuDropdown.classList.remove('open');
            }
        });

        // Settings button callback
        if (settingsButton && options.onSettingsClick) {
            settingsButton.addEventListener('click', () => {
                menuDropdown.classList.remove('open');
                options.onSettingsClick();
            });
        }

        // MapTap+ button callback
        if (mapTapPlusButton && options.onMapTapPlusClick) {
            mapTapPlusButton.addEventListener('click', () => {
                menuDropdown.classList.remove('open');
                options.onMapTapPlusClick();
            });
        }

        // Daily practice link - intercept clicks to handle premium/non-premium
        const dailyPracticeLink = document.getElementById('menu-daily-practice');
        if (dailyPracticeLink) {
            // Hide if requested (e.g., on adventures.html)
            if (options.hideDailyPractice) {
                dailyPracticeLink.style.display = 'none';
            } else {
                dailyPracticeLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    menuDropdown.classList.remove('open');

                    // Check if user is premium
                    const isPremium = window.MapTapSubscription && window.MapTapSubscription.isSubscribed();
                    if (isPremium) {
                        // Navigate to personalized practice
                        window.location.href = '/adventures.html?gametype=personalized';
                    } else if (options.onMapTapPlusClick) {
                        // Show upsell modal
                        options.onMapTapPlusClick();
                    }
                });
            }
        }

        // Update daily practice link for premium users
        updateDailyPracticeLink();

        initialized = true;
        console.log('[GameMenu] Initialized');
    }

    /**
     * Check if user is on iOS
     * Use ?simulateIOS=1 URL param to test iOS behavior on desktop
     */
    function isIOS() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('simulateIOS') === '1') {
            return true;
        }
        return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    /**
     * Update menu items based on premium status
     * - Daily Practice link: upsell for non-premium, practice for premium
     * - MapTap+ button: show for non-premium, hide for premium
     * - Missed days item: show based on missed days count
     */
    async function updateDailyPracticeLink() {
        const menuItem = document.getElementById('menu-daily-practice');
        const mapTapPlusButton = document.getElementById('game-menu-maptap-plus');

        // Default: show MapTap+ button (for non-logged-in or non-premium users)
        if (mapTapPlusButton) {
            mapTapPlusButton.style.display = 'block';
        }

        if (!window.LocationProgress) return;

        try {
            const { user, isPremium } = await window.LocationProgress.init();

            // Allow simulating non-premium for testing: ?simulateNonPremium=1
            const urlParams = new URLSearchParams(window.location.search);
            const simulateNonPremium = urlParams.get('simulateNonPremium') === '1';

            if (isPremium && !simulateNonPremium) {
                // Premium user: update daily practice link, hide MapTap+ button
                if (menuItem) {
                    menuItem.href = '/adventures.html?gametype=personalized';
                }
                if (mapTapPlusButton) {
                    mapTapPlusButton.style.display = 'none';
                }
                console.log('[GameMenu] Updated for premium user');
            } else {
                // Non-premium user: show MapTap+ option
                if (mapTapPlusButton) {
                    mapTapPlusButton.style.display = 'block';
                }
                // For iOS users, change daily practice link to App Store prompt
                if (isIOS() && menuItem) {
                    menuItem.textContent = 'Get the iOS app!';
                    menuItem.href = 'https://apps.apple.com/us/app/maptap-gg/id6755205355';
                    menuItem.classList.add('game-menu-plus');
                }
                console.log('[GameMenu] Non-premium user, showing MapTap+ option');
            }

            // Update missed days item after auth status is known
            await updateMissedDaysItem();

            // Update groups badge for unread comments (don't await - fire and forget)
            updateGroupsBadge().catch(err => {
                console.warn('[GameMenu] Groups badge update failed:', err.message);
            });

            // Update versus badge for pending challenges
            updateVersusBadge().catch(err => {
                console.warn('[GameMenu] Versus badge update failed:', err.message);
            });

        } catch (error) {
            console.warn('[GameMenu] Error checking premium status:', error.message);
        }
    }

    /**
     * Update the missed days menu item based on user data
     * - Subscriber with missed days: "You have X missed days!" → profile.html#missedDaysSection
     * - Non-subscriber: hidden (duplicative with "Try MapTap+" button)
     */
    async function updateMissedDaysItem() {
        const missedDaysButton = document.getElementById('game-menu-missed-days');
        if (!missedDaysButton) return;

        try {
            // Check if user is logged in
            const user = window.firebaseAuth?.currentUser;
            if (!user) {
                missedDaysButton.style.display = 'none';
                return;
            }

            // Get user's game history
            let gameHistory = {};

            if (window.cachedUserDocument && typeof window.cachedUserDocument === 'object') {
                if (typeof window.cachedUserDocument.data === 'function') {
                    const userData = window.cachedUserDocument.data();
                    gameHistory = userData?.gameHistory || {};
                }
            } else if (window.getCachedUserDocument) {
                const userDoc = await window.getCachedUserDocument(user.uid);
                if (userDoc && userDoc.exists()) {
                    gameHistory = userDoc.data().gameHistory || {};
                }
            } else if (window.firestore && window.firestore.doc && window.firestore.getDoc) {
                // Fallback: fetch directly from Firestore (for index.html)
                try {
                    const userDocRef = window.firestore.doc(window.firestore.db, 'users', user.uid);
                    const userDoc = await window.firestore.getDoc(userDocRef);
                    if (userDoc.exists()) {
                        gameHistory = userDoc.data().gameHistory || {};
                    }
                } catch (err) {
                    console.warn('[GameMenu] Error fetching from Firestore:', err);
                }
            }

            // Calculate missed days (only current month, up to yesterday)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let missedDays = 0;
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

            // Count from day 1 of current month up to yesterday
            const dayOfMonth = today.getDate();
            for (let d = 1; d < dayOfMonth; d++) {
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const monthDayStr = `${monthNames[currentMonth]}${d}`; // Legacy format: "December15"

                // Check both date formats - games can be stored in either format
                const gameData = gameHistory[dateStr] || gameHistory[monthDayStr];
                const hasPlayed = gameData && gameData.finalScore > 0;

                if (!hasPlayed) {
                    missedDays++;
                }
            }

            // Check subscription status
            const isSubscriber = window.MapTapSubscription && window.MapTapSubscription.isSubscribed();

            if (isSubscriber && missedDays > 0) {
                // Subscriber with missed days
                missedDaysButton.textContent = `You have ${missedDays} missed day${missedDays !== 1 ? 's' : ''}!`;
                missedDaysButton.style.display = 'block';
                missedDaysButton.style.color = '#44f8fb';
                missedDaysButton.onclick = () => {
                    window.location.href = '/profile.html#missedDaysSection';
                };
            } else {
                // Non-subscribers: don't show (duplicative with "Try MapTap+" button)
                missedDaysButton.style.display = 'none';
            }

        } catch (error) {
            console.warn('[GameMenu] Error updating missed days:', error.message);
            missedDaysButton.style.display = 'none';
        }
    }

    /**
     * Show the MapTap+ upsell button for non-premium users
     */
    function showMapTapPlusButton() {
        const button = document.getElementById('game-menu-maptap-plus');
        if (button) {
            button.style.display = 'block';
        }
    }

    /**
     * Hide the MapTap+ upsell button
     */
    function hideMapTapPlusButton() {
        const button = document.getElementById('game-menu-maptap-plus');
        if (button) {
            button.style.display = 'none';
        }
    }

    /**
     * Update the Groups menu badge with unread comment count
     * Checks across all user's groups for new chat messages since last visit
     */
    async function updateGroupsBadge() {
        const badge = document.getElementById('groups-unread-badge');
        if (!badge) return;

        try {
            // Check if user is logged in
            const user = window.firebaseAuth?.currentUser;
            if (!user) {
                badge.style.display = 'none';
                return;
            }

            // Check if groups service is available
            if (!window.groupsService || !window.groupsService.getUnreadGroupComments) {
                console.log('[GameMenu] Groups service not available for unread check');
                badge.style.display = 'none';
                return;
            }

            // Get unread count from backend
            const result = await window.groupsService.getUnreadGroupComments();
            const totalUnread = result?.totalUnread || 0;

            if (totalUnread > 0) {
                badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
                badge.style.display = 'inline-block';
                console.log('[GameMenu] Groups unread badge:', totalUnread);
            } else {
                badge.style.display = 'none';
            }

        } catch (error) {
            console.warn('[GameMenu] Error checking unread comments:', error.message);
            badge.style.display = 'none';
        }
    }

    /**
     * Update the Versus menu badge with pending challenge count
     */
    async function updateVersusBadge() {
        const badge = document.getElementById('versus-unread-badge');
        if (!badge) return;

        try {
            const user = window.firebaseAuth?.currentUser;
            if (!user) {
                badge.style.display = 'none';
                return;
            }

            if (!window.versusService || !window.versusService.getMyPendingChallenges) {
                badge.style.display = 'none';
                return;
            }

            const result = await window.versusService.getMyPendingChallenges(true);
            const count = result?.incomingCount || 0;

            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        } catch (error) {
            console.warn('[GameMenu] Error checking versus challenges:', error.message);
            badge.style.display = 'none';
        }
    }

    /**
     * Close the menu programmatically
     */
    function close() {
        const menuDropdown = document.getElementById('game-menu-dropdown');
        if (menuDropdown) {
            menuDropdown.classList.remove('open');
        }
    }

    /**
     * Open the menu programmatically
     */
    function open() {
        const menuDropdown = document.getElementById('game-menu-dropdown');
        if (menuDropdown) {
            menuDropdown.classList.add('open');
        }
    }

    // Export API
    window.GameMenu = {
        init,
        close,
        open,
        showMapTapPlusButton,
        hideMapTapPlusButton,
        updateDailyPracticeLink,
        updateMissedDaysItem,
        updateGroupsBadge,
        updateVersusBadge
    };

})();
