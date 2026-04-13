// Auth Modal loader and handler
(function() {
    // Load auth modal HTML
    async function loadAuthModal() {
        try {
            const response = await fetch('/auth-modal.html?v=3');
            const modalHTML = await response.text();

            // Create a container and insert the modal
            const modalContainer = document.getElementById('auth-modal-placeholder');
            if (modalContainer) {
                modalContainer.innerHTML = modalHTML;

                // Add Enter key support for form submission
                setTimeout(() => {
                    const emailInput = document.getElementById('authEmail');
                    const passwordInput = document.getElementById('authPassword');
                    const resetEmailInput = document.getElementById('resetEmail');

                    if (emailInput && passwordInput) {
                        // Enter on email field → focus password field
                        emailInput.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                passwordInput.focus();
                            }
                        });

                        // Enter on password field → submit form with visual feedback
                        passwordInput.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();

                                // Add visual feedback to the submit button
                                const submitBtn = document.getElementById('authSubmitBtn');
                                if (submitBtn) {
                                    // Briefly flash the button to show it was "pressed"
                                    submitBtn.style.transform = 'scale(0.95)';
                                    submitBtn.style.opacity = '0.8';

                                    setTimeout(() => {
                                        submitBtn.style.transform = '';
                                        submitBtn.style.opacity = '';
                                    }, 150);
                                }

                                handleEmailAuth();
                            }
                        });
                    }

                    // Enter on reset email field → submit reset form
                    if (resetEmailInput) {
                        resetEmailInput.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();

                                const resetBtn = document.getElementById('resetSubmitBtn');
                                if (resetBtn) {
                                    resetBtn.style.transform = 'scale(0.95)';
                                    resetBtn.style.opacity = '0.8';

                                    setTimeout(() => {
                                        resetBtn.style.transform = '';
                                        resetBtn.style.opacity = '';
                                    }, 150);
                                }

                                handlePasswordReset();
                            }
                        });
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Error loading auth modal:', error);
        }
    }

    // Load modal when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAuthModal);
    } else {
        loadAuthModal();
    }
})();

// Auth modal functions (global)
let isSignUpMode = false;

function openAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.style.display = 'flex';
        // Check if we should open in signup mode
        if (window.authModalShowSignup) {
            isSignUpMode = true;
            window.authModalShowSignup = false; // Reset the flag
        } else {
            isSignUpMode = false;
        }
        updateAuthFormMode();
    }
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.style.display = 'none';
        clearAuthMessage();
    }
}

function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    updateAuthFormMode();
    clearAuthMessage();
}

function showPasswordReset() {
    const emailAuthForm = document.getElementById('emailAuthForm');
    const passwordResetForm = document.getElementById('passwordResetForm');

    if (emailAuthForm && passwordResetForm) {
        emailAuthForm.style.display = 'none';
        passwordResetForm.style.display = 'block';

        // Pre-fill email if user had entered it
        const authEmail = document.getElementById('authEmail');
        const resetEmail = document.getElementById('resetEmail');
        if (authEmail && resetEmail && authEmail.value) {
            resetEmail.value = authEmail.value;
        }

        clearAuthMessage();
    }
}

function showSignIn() {
    const emailAuthForm = document.getElementById('emailAuthForm');
    const passwordResetForm = document.getElementById('passwordResetForm');

    if (emailAuthForm && passwordResetForm) {
        emailAuthForm.style.display = 'block';
        passwordResetForm.style.display = 'none';
        clearAuthMessage();
    }
}

function updateAuthFormMode() {
    const title = document.getElementById('authFormTitle');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleLink = document.getElementById('authToggleLink');
    const emailInput = document.getElementById('authEmail');
    const passwordInput = document.getElementById('authPassword');

    if (isSignUpMode) {
        title.textContent = 'Create MapTap Account';
        submitBtn.textContent = 'Sign Up';
        toggleLink.textContent = 'Sign in';
        toggleLink.style.color = '#FF8C00';
        toggleLink.previousSibling.textContent = 'Already have an account? ';
    } else {
        title.textContent = 'Sign in to MapTap';
        submitBtn.textContent = 'Sign In';
        toggleLink.textContent = 'Create one';
        toggleLink.style.color = '#FF8C00';
        toggleLink.previousSibling.textContent = "Don't have an account? ";
    }

    // Clear inputs
    emailInput.value = '';
    passwordInput.value = '';
}

function showAuthMessage(message, isError = false) {
    const messageDiv = document.getElementById('authMessage');
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.className = `auth-message ${isError ? 'error' : 'success'}`;
    }
}

function clearAuthMessage() {
    const messageDiv = document.getElementById('authMessage');
    if (messageDiv) {
        messageDiv.textContent = '';
        messageDiv.className = 'auth-message';
    }
}

async function handleEmailAuth() {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;

    if (!email || !password) {
        showAuthMessage('Please enter email and password', true);
        return;
    }

    // Check if Firebase is available
    if (!window.firebaseAuth && !window.auth) {
        showAuthMessage('Authentication not available', true);
        return;
    }

    const auth = window.firebaseAuth || window.auth;

    try {
        let userCredential;
        if (isSignUpMode) {
            // Sign up with Firebase Auth
            if (auth.createUserWithEmailAndPassword) {
                // Firebase v8 compat
                userCredential = await auth.createUserWithEmailAndPassword(email, password);
            } else if (window.authFunctions && window.authFunctions.createUserWithEmailAndPassword) {
                // Firebase v9 modular
                userCredential = await window.authFunctions.createUserWithEmailAndPassword(auth, email, password);
            }
            showAuthMessage('Account created successfully!');
        } else {
            // Sign in with Firebase Auth
            if (auth.signInWithEmailAndPassword) {
                // Firebase v8 compat
                userCredential = await auth.signInWithEmailAndPassword(email, password);
            } else if (window.authFunctions && window.authFunctions.signInWithEmailAndPassword) {
                // Firebase v9 modular
                userCredential = await window.authFunctions.signInWithEmailAndPassword(auth, email, password);
            }
            showAuthMessage('Login successful!');
        }

        // Update UI if function exists
        if (window.updateNavAuth) {
            window.updateNavAuth(userCredential.user);
        }

        // Close modal after successful auth
        setTimeout(() => {
            closeAuthModal();
        }, 1000);

    } catch (error) {
        showAuthMessage(getAuthErrorMessage(error), true);
    }
}

function getAuthErrorMessage(error) {
    switch (error.code) {
        case 'auth/email-already-in-use':
            return 'Email already registered. Please sign in.';
        case 'auth/weak-password':
            return 'Password must be at least 6 characters.';
        case 'auth/invalid-email':
            return 'Invalid email address.';
        case 'auth/user-not-found':
            return 'No account found with this email.';
        case 'auth/wrong-password':
            return 'Incorrect password.';
        case 'auth/invalid-credential':
            return 'Invalid email or password.';
        case 'auth/network-request-failed':
            return 'Network error. Please try again.';
        default:
            return error.message || 'An error occurred';
    }
}

async function handlePasswordReset() {
    const email = document.getElementById('resetEmail').value.trim();

    if (!email) {
        showAuthMessage('Please enter your email address', true);
        return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showAuthMessage('Please enter a valid email address', true);
        return;
    }

    const submitBtn = document.getElementById('resetSubmitBtn');
    const originalText = submitBtn.textContent;

    try {
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;

        const auth = window.firebaseAuth || window.auth;

        if (!auth) {
            showAuthMessage('Authentication not available. Please refresh the page.', true);
            return;
        }

        // Configure action code settings to redirect to maptap.gg
        const actionCodeSettings = {
            url: 'https://maptap.gg/reset-password',
            handleCodeInApp: false
        };

        // Check if Firebase v9 modular or v8
        if (window.authFunctions && window.authFunctions.sendPasswordResetEmail) {
            // Firebase v9 modular
            await window.authFunctions.sendPasswordResetEmail(auth, email, actionCodeSettings);
        } else if (auth.sendPasswordResetEmail) {
            // Firebase v8 compat
            await auth.sendPasswordResetEmail(email, actionCodeSettings);
        } else {
            throw new Error('Password reset not available');
        }

        showAuthMessage('Password reset email sent! Check your inbox.', false);

        // Switch back to sign in after 3 seconds
        setTimeout(() => {
            showSignIn();
        }, 3000);

    } catch (error) {
        console.error('Password reset error:', error);
        let errorMessage = 'Failed to send reset email. Please try again.';

        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email address.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many requests. Please try again later.';
        }

        showAuthMessage(errorMessage, true);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Apple Sign-In function (for iOS cross-play users)
async function handleAppleSignIn() {
    const appleBtn = document.getElementById('appleSignInBtn');
    if (!appleBtn) return;

    // Prevent double-clicks
    if (appleBtn.dataset.busy) return;
    appleBtn.dataset.busy = 'true';
    const originalText = appleBtn.textContent;
    appleBtn.textContent = 'Signing in...';
    appleBtn.style.pointerEvents = 'none';

    try {
        const auth = window.firebaseAuth || window.auth;
        const { OAuthProvider, signInWithPopup } = window.authFunctions;

        if (!auth || !OAuthProvider || !signInWithPopup) {
            showAuthMessage('Apple Sign-In not available. Please try again later.', true);
            return;
        }

        const provider = new OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');

        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Check if user already has a nickname
        const userData = await window.firebaseService.getUserData(user.uid);
        if (!userData || !userData.nickname) {
            await promptForNickname();
        }

        showAuthMessage('Signed in with Apple!');

        if (window.updateNavAuth) {
            window.updateNavAuth(user);
        }

        setTimeout(() => {
            closeAuthModal();
        }, 1000);

    } catch (error) {
        console.error('Apple Sign-In error:', error);

        switch (error.code) {
            case 'auth/popup-closed-by-user':
                // User closed the popup — no error message needed
                break;
            case 'auth/popup-blocked':
                showAuthMessage('Popup was blocked. Please allow popups for this site.', true);
                break;
            case 'auth/account-exists-with-different-credential':
                showAuthMessage('An account already exists with this email using a different sign-in method.', true);
                break;
            case 'auth/cancelled-popup-request':
                break;
            default:
                showAuthMessage('Apple Sign-In failed. Please try again.', true);
        }
    } finally {
        if (appleBtn) {
            delete appleBtn.dataset.busy;
            appleBtn.textContent = originalText;
            appleBtn.style.pointerEvents = '';
        }
    }
}

// Logout function
async function handleLogout() {
    try {
        console.log('Logging out user...');

        // Check which auth system is available
        const auth = window.firebaseAuth || window.auth;

        if (auth) {
            if (auth.signOut) {
                // Firebase v8 compat
                await auth.signOut();
            } else if (window.authFunctions && window.authFunctions.signOut) {
                // Firebase v9 modular
                await window.authFunctions.signOut(auth);
            }
        }

        // Clear any cached user data
        window.currentAuthUser = null;

        // Update UI
        if (window.updateNavAuth) {
            window.updateNavAuth(null);
        }

        console.log('User logged out successfully');

    } catch (error) {
        console.error('Error during logout:', error);
    }
}

// Nickname prompt function
async function promptForNickname() {
    return new Promise((resolve) => {
        // Create nickname modal
        const modal = document.createElement('div');
        modal.className = 'nickname-modal';
        modal.innerHTML = `
            <div class="nickname-modal-content">
                <h3>Welcome to MapTap!</h3>
                <p>Choose a nickname to display on leaderboards and when sharing scores:</p>
                <div class="nickname-error" id="nicknameError"></div>
                <input type="text" id="nicknameInput" placeholder="Enter nickname (3-15 characters)" maxlength="15">
                <div class="nickname-buttons">
                    <button class="nickname-btn save" id="saveNicknameBtn">Save Nickname</button>
                    <button class="nickname-btn skip" id="skipNicknameBtn">Skip for Now</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const nicknameInput = document.getElementById('nicknameInput');
        const saveBtn = document.getElementById('saveNicknameBtn');
        const skipBtn = document.getElementById('skipNicknameBtn');
        const errorDiv = document.getElementById('nicknameError');

        // Validate nickname
        function validateNickname(nickname) {
            if (nickname.length < 3) {
                return 'Nickname must be at least 3 characters';
            }
            if (nickname.length > 15) {
                return 'Nickname must be 15 characters or less';
            }
            if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
                return 'Only letters, numbers, and underscores allowed';
            }
            return null;
        }

        // Update save button state
        nicknameInput.addEventListener('input', () => {
            const error = validateNickname(nicknameInput.value);
            if (error && nicknameInput.value.length > 0) {
                errorDiv.textContent = error;
                errorDiv.classList.add('show');
                saveBtn.disabled = true;
            } else {
                errorDiv.classList.remove('show');
                saveBtn.disabled = nicknameInput.value.length < 3;
            }
        });

        // Save nickname
        saveBtn.addEventListener('click', async () => {
            const nickname = nicknameInput.value.trim();
            const error = validateNickname(nickname);

            if (error) {
                errorDiv.textContent = error;
                errorDiv.classList.add('show');
                return;
            }

            // Use Cloud Function to set nickname with server-side validation
            if (window.firebaseFunctions) {
                try {
                    // Dynamically import httpsCallable
                    const { httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js');
                    const setNicknameFunction = httpsCallable(window.firebaseFunctions, 'setNickname');

                    saveBtn.textContent = 'Setting...';
                    saveBtn.disabled = true;

                    const result = await setNicknameFunction({ nickname: nickname });

                    if (result.data.success) {
                        document.body.removeChild(modal);
                        resolve(result.data.nickname);
                    } else {
                        errorDiv.textContent = result.data.message || 'This nickname is already taken';
                        errorDiv.classList.add('show');
                        saveBtn.textContent = 'Save Nickname';
                        saveBtn.disabled = false;
                    }
                } catch (error) {
                    console.error('Error setting nickname:', error);
                    errorDiv.textContent = error.message || 'Failed to set nickname. Please try again.';
                    errorDiv.classList.add('show');
                    saveBtn.textContent = 'Save Nickname';
                    saveBtn.disabled = false;
                }
            } else {
                // Fallback if Firebase Functions not available (shouldn't happen in production)
                console.warn('Firebase Functions not available, using legacy flow');
                document.body.removeChild(modal);
                resolve(nickname);
            }
        });

        // Skip for now
        skipBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(null);
        });

        // Focus input
        nicknameInput.focus();
    });
}

// Custom alert function
function showAlert(title, message) {
    return new Promise((resolve) => {
        const alertModal = document.getElementById('alertModal');
        const titleEl = document.getElementById('alertTitle');
        const messageEl = document.getElementById('alertMessage');
        const okBtn = document.getElementById('alertOkBtn');

        if (alertModal && titleEl && messageEl && okBtn) {
            titleEl.textContent = title;
            messageEl.textContent = message;
            alertModal.style.display = 'flex';

            const handleOk = () => {
                alertModal.style.display = 'none';
                okBtn.removeEventListener('click', handleOk);
                resolve();
            };

            okBtn.addEventListener('click', handleOk);
        } else {
            // Fallback to browser alert
            alert(`${title}\n\n${message}`);
            resolve();
        }
    });
}

// Custom confirm function
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const confirmModal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const yesBtn = document.getElementById('confirmYesBtn');
        const noBtn = document.getElementById('confirmNoBtn');

        if (confirmModal && titleEl && messageEl && yesBtn && noBtn) {
            titleEl.textContent = title;
            messageEl.textContent = message;
            confirmModal.style.display = 'flex';

            const handleYes = () => {
                confirmModal.style.display = 'none';
                yesBtn.removeEventListener('click', handleYes);
                noBtn.removeEventListener('click', handleNo);
                resolve(true);
            };

            const handleNo = () => {
                confirmModal.style.display = 'none';
                yesBtn.removeEventListener('click', handleYes);
                noBtn.removeEventListener('click', handleNo);
                resolve(false);
            };

            yesBtn.addEventListener('click', handleYes);
            noBtn.addEventListener('click', handleNo);
        } else {
            // Fallback to browser confirm
            resolve(confirm(`${title}\n\n${message}`));
        }
    });
}

// Make functions globally available
window.authModalFunctions = {
    openAuthModal,
    closeAuthModal,
    toggleAuthMode,
    handleEmailAuth,
    handleAppleSignIn,
    handleLogout,
    promptForNickname,
    showAlert,
    showConfirm,
    showAuthMessage,
    clearAuthMessage,
    showPasswordReset,
    showSignIn,
    handlePasswordReset
};

// Also make commonly used functions directly available
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.toggleAuthMode = toggleAuthMode;
window.handleEmailAuth = handleEmailAuth;
window.handleLogout = handleLogout;
window.promptForNickname = promptForNickname;
window.showAlert = showAlert;
window.showConfirm = showConfirm;
window.handleAppleSignIn = handleAppleSignIn;
window.showPasswordReset = showPasswordReset;
window.showSignIn = showSignIn;
window.handlePasswordReset = handlePasswordReset;