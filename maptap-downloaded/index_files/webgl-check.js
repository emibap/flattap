// === Early WebGL Detection ===
// Check if device supports WebGL before loading the game
// This prevents users without WebGL from waiting through loading only to see nothing

// DISABLED FOR NOW - Uncomment when ready to enable WebGL blocking
/*
(function() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    // TESTING: Change "if (true ||" to "if (" when done testing
    if (true || !gl) {
        // Report WebGL not supported to analytics
        if (typeof gtag !== 'undefined') {
            gtag('event', 'webgl_not_supported', {
                event_category: 'error',
                event_label: 'WebGL Not Supported',
                user_agent: navigator.userAgent || 'unknown',
                platform: navigator.platform || 'unknown'
            });
        }

        // Wait for DOM to be ready, then show error
        const showError = function() {
            // Add styles to head
            const style = document.createElement('style');
            style.textContent = `
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    padding: 20px;
                    box-sizing: border-box;
                }
                .webgl-error-container {
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    padding: 40px;
                    max-width: 600px;
                    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
                    border: 1px solid rgba(255, 255, 255, 0.18);
                }
                .webgl-error-container h1 {
                    margin-top: 0;
                    font-size: 2em;
                    margin-bottom: 20px;
                }
                .webgl-error-container p {
                    line-height: 1.6;
                    margin-bottom: 15px;
                    font-size: 1.1em;
                }
                .webgl-suggestions {
                    background: rgba(255, 255, 255, 0.1);
                    border-left: 4px solid #fff;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 5px;
                }
                .webgl-suggestions strong {
                    display: block;
                    margin-bottom: 10px;
                }
                .webgl-error-container a {
                    color: #fff;
                    text-decoration: underline;
                    font-weight: 600;
                }
                .webgl-error-container a:hover {
                    color: #ffd700;
                }
            `;
            document.head.appendChild(style);

            // Replace body content
            document.body.innerHTML = `
                <div class="webgl-error-container">
                    <h1>🌍 Hey there!</h1>
                    <p>Thank you so much for trying to play MapTap!</p>
                    <p>It looks like your device doesn't support 3D graphics (WebGL) which this game needs to display the globe... ugh.</p>
                    <p>I don't have a fallback solution to this problem.</p>

                    <div class="webgl-suggestions">
                        <strong>You could try:</strong>
                        • A different device?<br>
                        • Your desktop browser?<br>
                        • Updating your browser or operating system?
                    </div>

                    <p>If you think you've gotten this message in error, please <a href="https://discord.gg/5uDkQtMw8e" target="_blank">join our Discord</a> and let me know!</p>

                    <p style="margin-top: 30px; font-size: 0.95em; opacity: 0.9;">Anyway, I'm sorry this won't work today. 😔</p>
                </div>
            `;
        };

        // Show error immediately if DOM is ready, otherwise wait
        if (document.body) {
            showError();
        } else {
            document.addEventListener('DOMContentLoaded', showError);
        }
    }
})();
*/
