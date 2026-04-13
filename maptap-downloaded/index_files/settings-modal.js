// settings-modal.js - Settings modal functionality
// This file handles all settings modal interactions including auth UI

// Detect if user is on mobile or tablet device
function isMobileOrTablet() {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTablet = /ipad|android(?!.*mobile)|tablet|kindle|silk|playbook/i.test(userAgent);

    // Also check for touch-only devices (no mouse)
    const isTouchOnly = ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
                        !window.matchMedia("(pointer: fine)").matches;

    return isMobile || isTablet || isTouchOnly;
}

// Update settings auth UI based on login state
function updateSettingsAuthUI() {
    if (window.currentAuthUser) {
        // User is logged in
        PAGE.settingsLoggedIn.style.display = 'block';
        PAGE.settingsLoggedOut.style.display = 'none';
        PAGE.settingsUserEmail.textContent = window.currentAuthUser.email;
        initializeVersusSettings();
    } else {
        // User is logged out
        PAGE.settingsLoggedIn.style.display = 'none';
        PAGE.settingsLoggedOut.style.display = 'block';
        const vsSection = document.getElementById('settings-versus-section');
        if (vsSection) vsSection.style.display = 'none';
    }
}

// Handle logout from settings modal
async function handleSettingsLogout() {
    try {
        await window.firebaseService.signOut();
        PAGE.settingsModal.style.display = 'none'; // Close settings modal
        console.log('User signed out from settings');
    } catch (error) {
        console.error('Error signing out:', error);
    }
}

// Initialize settings checkboxes with current values
function initializeSettings() {
    // Initialize checkboxes with current gameHistory state
    PAGE.soundCheckbox.checked = gameHistory.soundEnabled;
    PAGE.confirmTapCheckbox.checked = gameHistory.confirmTapMode;
    PAGE.utcTimeCheckbox.checked = gameHistory.useUtcTime;
    PAGE.tapAssistCheckbox.checked = gameHistory.tapAssist || false;
    PAGE.useMilesCheckbox.checked = gameHistory.useMiles || false;

    // Hide scroll sensitivity setting on mobile/tablet devices
    const scrollSensitivityContainer = document.getElementById('scroll-sensitivity-setting');
    if (scrollSensitivityContainer && isMobileOrTablet()) {
        scrollSensitivityContainer.style.display = 'none';
    } else {
        // Initialize scroll sensitivity radio buttons (desktop only)
        const scrollSensitivity = gameHistory.scrollSensitivity ?? 0;
        const radioButton = document.querySelector(`input[name="scroll-sensitivity"][value="${scrollSensitivity}"]`);
        if (radioButton) {
            radioButton.checked = true;
        }
    }

    // Hide Smart Zoom setting on mobile/tablet devices (it's a mouse wheel feature)
    const smartZoomContainer = document.getElementById('smart-zoom-setting');
    if (smartZoomContainer && isMobileOrTablet()) {
        smartZoomContainer.style.display = 'none';
    } else if (PAGE.smartZoomCheckbox) {
        // Initialize Smart Zoom checkbox (default true)
        PAGE.smartZoomCheckbox.checked = gameHistory.smartZoom !== false;
    }

    // Initialize MapTap+ Max Zoom toggle (default true = zoom benefit enabled)
    const proZoomCheckbox = document.getElementById('pro-zoom-checkbox');
    if (proZoomCheckbox) {
        proZoomCheckbox.checked = gameHistory.proZoomEnabled !== false;
    }

    // Initialize Tap Sensitivity slider
    const tapLevels = ['much-less', 'less', 'normal', 'more', 'much-more'];
    const tapLabelNames = ['Much Less', 'Less', 'Normal', 'More', 'Much More'];
    const tapSlider = document.getElementById('tap-sensitivity-slider');
    const tapSensLabel = document.getElementById('tap-sensitivity-label');
    if (tapSlider && tapSensLabel) {
        const savedTap = localStorage.getItem('tapSensitivity') || 'normal';
        const idx = tapLevels.indexOf(savedTap);
        tapSlider.value = idx >= 0 ? idx : 2;
        tapSensLabel.textContent = tapLabelNames[tapSlider.value];
        applyTapSensitivity(savedTap);
    }
}

// Initialize all settings modal event listeners
function initializeSettingsListeners() {
    // Settings close button
    PAGE.settingsClose.addEventListener('click', () => {
        PAGE.settingsModal.style.display = 'none';
    });

    // Settings auth event listeners
    PAGE.settingsLoginButton.addEventListener('click', () => {
        PAGE.settingsModal.style.display = 'none'; // Close settings first
        openAuthModal(); // Open auth modal
    });
    PAGE.settingsLogoutButton.addEventListener('click', handleSettingsLogout);

    // Close settings modal when clicking outside of it
    PAGE.settingsModal.addEventListener('click', (event) => {
        if (event.target === PAGE.settingsModal) {
            PAGE.settingsModal.style.display = 'none';
        }
    });

    // Sync sound checkbox with gameHistory.soundEnabled
    PAGE.soundCheckbox.addEventListener('change', () => {
        gameHistory.soundEnabled = PAGE.soundCheckbox.checked;
        saveGameHistory();
    });

    // Sync confirm tap mode checkbox with gameHistory.confirmTapMode
    PAGE.confirmTapCheckbox.addEventListener('change', () => {
        gameHistory.confirmTapMode = PAGE.confirmTapCheckbox.checked;
        saveGameHistory();
    });

    // Sync UTC time checkbox with gameHistory.useUtcTime
    PAGE.utcTimeCheckbox.addEventListener('change', () => {
        gameHistory.useUtcTime = PAGE.utcTimeCheckbox.checked;
        saveGameHistory();

        // UTC time change requires page reload to reinitialize all date calculations
        PAGE.settingsModal.style.display = 'none';
        location.reload();
    });

    // Sync tap assist checkbox with gameHistory.tapAssist
    PAGE.tapAssistCheckbox.addEventListener('change', () => {
        gameHistory.tapAssist = PAGE.tapAssistCheckbox.checked;
        saveGameHistory();
        applyTapAssist();
    });

    // Sync use miles checkbox with gameHistory.useMiles
    PAGE.useMilesCheckbox.addEventListener('change', () => {
        gameHistory.useMiles = PAGE.useMilesCheckbox.checked;
        saveGameHistory();
    });

    // Sync tap sensitivity slider
    const tapSliderEl = document.getElementById('tap-sensitivity-slider');
    const tapSensLabelEl = document.getElementById('tap-sensitivity-label');
    if (tapSliderEl && tapSensLabelEl) {
        const levels = ['much-less', 'less', 'normal', 'more', 'much-more'];
        const labels = ['Much Less', 'Less', 'Normal', 'More', 'Much More'];
        tapSliderEl.addEventListener('input', () => {
            const level = levels[tapSliderEl.value];
            tapSensLabelEl.textContent = labels[tapSliderEl.value];
            localStorage.setItem('tapSensitivity', level);
            applyTapSensitivity(level);
        });
    }

    // Sync scroll sensitivity radio buttons with gameHistory.scrollSensitivity
    const scrollRadios = document.querySelectorAll('input[name="scroll-sensitivity"]');
    scrollRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            gameHistory.scrollSensitivity = parseFloat(radio.value);
            saveGameHistory();
            applyScrollSensitivity();
        });
    });

    // Sync Smart Zoom checkbox with gameHistory.smartZoom
    if (PAGE.smartZoomCheckbox) {
        PAGE.smartZoomCheckbox.addEventListener('change', () => {
            gameHistory.smartZoom = PAGE.smartZoomCheckbox.checked;
            saveGameHistory();
            applySmartZoom();
        });
    }

    // Sync MapTap+ Max Zoom checkbox
    const proZoomCheckbox = document.getElementById('pro-zoom-checkbox');
    if (proZoomCheckbox) {
        proZoomCheckbox.addEventListener('change', () => {
            gameHistory.proZoomEnabled = proZoomCheckbox.checked;
            saveGameHistory();
            applyProZoom();
        });
    }

    // Sync challenges enabled checkbox with user doc
    const challengesCheckbox = document.getElementById('challenges-enabled-checkbox');
    if (challengesCheckbox) {
        challengesCheckbox.addEventListener('change', () => {
            const auth = window.firebaseAuth || window.auth;
            const user = auth?.currentUser;
            if (user && window.queueFirestoreWrite) {
                window.queueFirestoreWrite(user.uid, { challengesEnabled: challengesCheckbox.checked }, true);
            }
        });
    }
}

// Initialize versus settings (challengesEnabled) from user doc
async function initializeVersusSettings() {
    const section = document.getElementById('settings-versus-section');
    const checkbox = document.getElementById('challenges-enabled-checkbox');
    if (!section || !checkbox) return;

    const auth = window.firebaseAuth || window.auth;
    const user = auth?.currentUser;
    if (!user) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    // Read from user doc
    try {
        if (window.firestore?.db && window.firestore?.doc && window.firestore?.getDoc) {
            const snap = await window.firestore.getDoc(window.firestore.doc(window.firestore.db, 'users', user.uid));
            if (snap.exists()) {
                checkbox.checked = snap.data().challengesEnabled !== false;
            }
        }
    } catch (e) {
        // Default to checked
    }
}

// Apply MapTap+ zoom setting — reapplies subscription limits with toggle considered
function applyProZoom() {
    if (typeof window.MapTapSubscription !== 'undefined' && window.MapTapSubscription.isSubscribed()) {
        // Re-run applySubscriptionLimits which now checks proZoomEnabled
        const isPro = gameHistory.proZoomEnabled !== false;
        const limits = isPro ?
            { maxZoom: 1.05, maxTileDetail: 7 } :
            { maxZoom: 1.12, maxTileDetail: 5 };

        if (typeof GlobeCamera !== 'undefined' && GlobeCamera.MIN_ZOOM !== undefined) {
            GlobeCamera.MIN_ZOOM = limits.maxZoom;
        }
        window.subscriptionLimits = limits;

        if (typeof window.myGlobe !== 'undefined' && window.myGlobe.setMaxTileZoom) {
            window.myGlobe.setMaxTileZoom(limits.maxTileDetail);
        }
        if (typeof window.adventuresGlobe !== 'undefined' && window.adventuresGlobe.getGlobe) {
            const g = window.adventuresGlobe.getGlobe();
            if (g && g.setMaxTileZoom) g.setMaxTileZoom(limits.maxTileDetail);
        }
        console.log(`[Settings] Pro zoom ${isPro ? 'enabled' : 'disabled'}: zoom=${limits.maxZoom}, tiles=z${limits.maxTileDetail}`);
    }
}

// Show/hide MapTap+ zoom toggle based on subscription status
function updateProZoomVisibility() {
    const container = document.getElementById('pro-zoom-setting');
    if (container) {
        const isPro = typeof window.MapTapSubscription !== 'undefined' && window.MapTapSubscription.isSubscribed();
        container.style.display = isPro ? 'flex' : 'none';
    }
}

// Apply Smart Zoom setting to globe zoom-to-cursor behavior
function applySmartZoom() {
    const enabled = gameHistory.smartZoom !== false;
    window.ZOOM_TO_CURSOR_ENABLED = enabled;
    console.log(`Smart Zoom: ${enabled ? 'enabled' : 'disabled'}`);
}

// Apply scroll sensitivity to globe controls
function applyScrollSensitivity() {
    if (typeof myGlobe !== 'undefined' && myGlobe.controls) {
        const sensitivity = gameHistory.scrollSensitivity ?? 0; // Use ?? to handle 0 correctly

        // Remove any existing listener first
        if (window.scrollSensitivityWheelListener) {
            const globeContainer = document.getElementById('globeViz');
            if (globeContainer) {
                globeContainer.removeEventListener('wheel', window.scrollSensitivityWheelListener);
            }
            window.scrollSensitivityWheelListener = null;
        }

        // If Normal (0), set to 0.4 for smooth transition, then let Globe.GL handle it naturally
        if (sensitivity === 0) {
            const controls = myGlobe.controls();
            controls.zoomSpeed = 0.4;  // Set to Globe.GL's approximate default for smoother transition
            console.log('Scroll sensitivity: Normal (set to 0.4, letting Globe.GL handle naturally)');
            return;
        }

        // For Fast/Very Fast, set up intervention using the value directly as zoomSpeed
        const controls = myGlobe.controls();
        const targetZoomSpeed = sensitivity;

        // Set the zoom speed initially
        controls.zoomSpeed = targetZoomSpeed;
        console.log(`Scroll sensitivity set to ${sensitivity} (zoomSpeed: ${controls.zoomSpeed})`);

        // Set up wheel event listener to reapply after scroll (Globe.GL resets it)
        let wheelTimeout = null;
        window.scrollSensitivityWheelListener = () => {
            // Clear any pending reapplication
            if (wheelTimeout) {
                clearTimeout(wheelTimeout);
            }

            // Wait 50ms after wheel event, then reapply (gives Globe.GL time to reset it)
            wheelTimeout = setTimeout(() => {
                if (typeof myGlobe !== 'undefined' && myGlobe.controls) {
                    const currentControls = myGlobe.controls();
                    const currentSensitivity = gameHistory.scrollSensitivity ?? 0;

                    // Double-check we're still in Fast/Very Fast mode (not Normal)
                    if (currentSensitivity > 0) {
                        currentControls.zoomSpeed = currentSensitivity;
                        console.log(`Reapplied scroll sensitivity after wheel: ${currentSensitivity}`);
                    }
                }
            }, 50);
        };

        // Attach listener to globe container
        const globeContainer = document.getElementById('globeViz');
        if (globeContainer) {
            globeContainer.addEventListener('wheel', window.scrollSensitivityWheelListener);
        }
    }
}

// Apply tap sensitivity to globe drag threshold
function applyTapSensitivity(level) {
    const thresholds = {
        'much-less': 5,
        'less': 8,
        'normal': 12,
        'more': 20,
        'much-more': 30,
    };
    const pixels = thresholds[level] || 12;
    if (typeof myGlobe !== 'undefined' && myGlobe.setDragThreshold) {
        myGlobe.setDragThreshold(pixels);
        console.log(`Tap sensitivity: ${level} (drag threshold: ${pixels}px)`);
    }
}

// Apply tap assist setting to globe interaction
function applyTapAssist() {
    if (typeof myGlobe !== 'undefined' && myGlobe.setTapAssist) {
        const tapAssist = gameHistory.tapAssist || false;
        myGlobe.setTapAssist(tapAssist);
        console.log(`Tap assist: ${tapAssist ? 'enabled' : 'disabled'}`);
    }
}

