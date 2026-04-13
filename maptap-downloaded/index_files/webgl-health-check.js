/**
 * WebGL Health Check Module
 * Detects WebGL issues before Globe.GL initialization
 *
 * Usage:
 *   const result = WebGLHealthCheck.run();
 *   if (!result.healthy) {
 *       WebGLHealthCheck.showErrorPage(result);
 *   }
 *
 * Testing URL Parameters:
 *   ?forceWebGLError=shader_precision_failed
 *   ?forceWebGLError=webgl_not_supported
 *   ?forceWebGLError=shader_compile_failed
 *   ?skipHealthCheck=1
 *   ?debugHealthCheck=1
 */

const WebGLHealthCheck = (function() {
    'use strict';

    // Parse URL parameters for testing
    const urlParams = new URLSearchParams(window.location.search);
    const FORCE_ERROR = urlParams.get('forceWebGLError');
    const SKIP_CHECK = urlParams.get('skipHealthCheck') === '1';
    const DEBUG_MODE = urlParams.get('debugHealthCheck') === '1';

    /**
     * Run WebGL health check
     * @returns {Object} Health check results
     */
    function run() {
        console.log('🔍 Running WebGL health check...');

        // Testing mode - force specific error
        if (FORCE_ERROR) {
            console.warn('⚠️ TEST MODE: Forcing error type:', FORCE_ERROR);
            return {
                healthy: false,
                error: FORCE_ERROR,
                testMode: true,
                details: { testForced: true }
            };
        }

        // Testing mode - skip check
        if (SKIP_CHECK) {
            console.warn('⚠️ TEST MODE: Skipping health check');
            return {
                healthy: true,
                error: null,
                testMode: true,
                details: { testSkipped: true }
            };
        }

        // Level 1: WebGL Context Creation
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');

        if (!gl) {
            console.error('❌ Level 1 FAILED: WebGL context creation failed');
            return {
                healthy: false,
                error: 'webgl_not_supported',
                details: {
                    webglVersion: 'none',
                    contextCreated: false
                }
            };
        }

        const webglVersion = gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl';
        console.log('✅ Level 1 PASSED: WebGL context created (' + webglVersion + ')');

        // Level 2: Shader Precision Format (Critical iOS Test)
        const precisionVertex = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT);
        const precisionFragment = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);

        if (!precisionVertex || !precisionFragment) {
            console.error('❌ Level 2 FAILED: Shader precision query returned null');
            console.error('  - Vertex precision:', precisionVertex);
            console.error('  - Fragment precision:', precisionFragment);
            return {
                healthy: false,
                error: 'shader_precision_failed',
                details: {
                    webglVersion,
                    contextCreated: true,
                    vertexPrecisionNull: !precisionVertex,
                    fragmentPrecisionNull: !precisionFragment,
                    vendor: gl.getParameter(gl.VENDOR),
                    renderer: gl.getParameter(gl.RENDERER)
                }
            };
        }

        console.log('✅ Level 2 PASSED: Shader precision queries succeeded');
        console.log('  - Vertex precision:', precisionVertex.precision);
        console.log('  - Fragment precision:', precisionFragment.precision);

        // Level 3: Shader Compilation Test - Vertex Shader
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, 'void main() { gl_Position = vec4(0.0); }');
        gl.compileShader(vertexShader);

        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            console.error('❌ Level 3 FAILED: Vertex shader compilation failed');
            console.error('  - Shader log:', gl.getShaderInfoLog(vertexShader));
            return {
                healthy: false,
                error: 'shader_compile_failed',
                details: {
                    webglVersion,
                    contextCreated: true,
                    precisionOk: true,
                    shaderType: 'vertex',
                    shaderLog: gl.getShaderInfoLog(vertexShader),
                    vendor: gl.getParameter(gl.VENDOR),
                    renderer: gl.getParameter(gl.RENDERER)
                }
            };
        }

        console.log('✅ Level 3a PASSED: Vertex shader compiled');

        // Level 3: Shader Compilation Test - Fragment Shader
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, 'void main() { gl_FragColor = vec4(1.0); }');
        gl.compileShader(fragmentShader);

        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            console.error('❌ Level 3 FAILED: Fragment shader compilation failed');
            console.error('  - Shader log:', gl.getShaderInfoLog(fragmentShader));
            return {
                healthy: false,
                error: 'shader_compile_failed',
                details: {
                    webglVersion,
                    contextCreated: true,
                    precisionOk: true,
                    shaderType: 'fragment',
                    shaderLog: gl.getShaderInfoLog(fragmentShader),
                    vendor: gl.getParameter(gl.VENDOR),
                    renderer: gl.getParameter(gl.RENDERER)
                }
            };
        }

        console.log('✅ Level 3b PASSED: Fragment shader compiled');

        // All checks passed!
        console.log('🎉 WebGL health check PASSED - All systems go!');
        return {
            healthy: true,
            error: null,
            details: {
                webglVersion,
                vendor: gl.getParameter(gl.VENDOR),
                renderer: gl.getParameter(gl.RENDERER),
                maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
                precisionVertexHigh: precisionVertex.precision,
                precisionFragmentHigh: precisionFragment.precision
            }
        };
    }

    /**
     * Get error message content for specific error type
     */
    function getErrorContent(error) {
        const messages = {
            'webgl_not_supported': {
                technicalDetail: 'WebGL is not supported or is disabled',
                context: '',
                suggestions: [
                    'Update your browser to the latest version',
                    'Check if WebGL is disabled in browser settings',
                    'Try opening MapTap in Safari, Chrome, or Firefox'
                ]
            },
            'shader_precision_failed': {
                technicalDetail: 'WebGL shader precision query failed (null return from getShaderPrecisionFormat)',
                context: 'This usually means your device\'s graphics cache is corrupted.',
                suggestions: [
                    'Settings → Safari → Clear History and Website Data',
                    'Settings → General → Reset All Settings',
                    'Restart your device and try again'
                ]
            },
            'shader_compile_failed': {
                technicalDetail: 'WebGL shader compilation failed',
                context: 'This may be due to graphics driver corruption or low device memory.',
                suggestions: [
                    'Close other tabs and apps to free up memory',
                    'Settings → Safari → Clear History and Website Data',
                    'Restart your device'
                ]
            },
            'tileglobe_load_timeout': {
                technicalDetail: 'Globe library failed to load within 10 seconds',
                context: 'This may be a network issue, or your device may have been backgrounded during loading.',
                suggestions: [
                    'Check your internet connection',
                    'Refresh the page and keep it in the foreground',
                    'Try closing other tabs to free up resources'
                ]
            }
        };

        return messages[error] || messages['webgl_not_supported'];
    }

    /**
     * Get device diagnostics for error page
     */
    function getDeviceDiagnostics() {
        const ua = navigator.userAgent;
        const platform = navigator.platform || 'Unknown';

        // Detect browser
        let browser = 'Unknown';
        if (window.MAPTAP_DETAILED_BROWSER) {
            browser = window.MAPTAP_DETAILED_BROWSER;
        } else if (ua.includes('CriOS')) {
            browser = 'Chrome iOS';
        } else if (ua.includes('FxiOS')) {
            browser = 'Firefox iOS';
        } else if (ua.includes('EdgiOS')) {
            browser = 'Edge iOS';
        } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
            browser = 'Safari';
        } else if (ua.includes('Chrome')) {
            browser = 'Chrome';
        } else if (ua.includes('Firefox')) {
            browser = 'Firefox';
        }

        // Detect device model (iOS)
        let deviceModel = null;
        if (ua.includes('iPhone')) {
            // Try to extract iPhone model from user agent
            const iPhoneMatch = ua.match(/iPhone OS (\d+)_(\d+)/);
            if (iPhoneMatch) {
                const iosVersion = `${iPhoneMatch[1]}.${iPhoneMatch[2]}`;
                deviceModel = `iPhone (iOS ${iosVersion})`;
            } else {
                deviceModel = 'iPhone';
            }

            // Enhanced detection using screen dimensions and devicePixelRatio
            const width = screen.width;
            const height = screen.height;
            const ratio = window.devicePixelRatio;

            // Common iPhone models (approximate detection)
            if (width === 430 && ratio === 3) deviceModel = 'iPhone 14 Pro Max / 15 Pro Max';
            else if (width === 393 && ratio === 3) deviceModel = 'iPhone 14 Pro / 15 Pro';
            else if (width === 390 && ratio === 3) deviceModel = 'iPhone 12/13/14';
            else if (width === 428 && ratio === 3) deviceModel = 'iPhone 12 Pro Max / 13 Pro Max / 14 Plus';
            else if (width === 414 && ratio === 3) deviceModel = 'iPhone 11 Pro Max / XS Max';
            else if (width === 414 && ratio === 2) deviceModel = 'iPhone 8 Plus / 7 Plus / 6s Plus';
            else if (width === 375 && ratio === 3) deviceModel = 'iPhone X / XS / 11 Pro';
            else if (width === 375 && ratio === 2) deviceModel = 'iPhone SE (2nd/3rd gen) / 6/7/8';
            else if (width === 320 && ratio === 2) deviceModel = 'iPhone SE (1st gen) / 5s';
        } else if (ua.includes('iPad')) {
            deviceModel = 'iPad';
        } else if (ua.includes('Android')) {
            const androidMatch = ua.match(/Android (\d+\.?\d*)/);
            if (androidMatch) {
                deviceModel = `Android ${androidMatch[1]}`;
            } else {
                deviceModel = 'Android';
            }
        }

        // Get RAM if available
        const ram = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'Unknown';

        // Get screen info
        const screenInfo = `${screen.width}×${screen.height} @${window.devicePixelRatio}x`;

        // Get WebGL version from health check results if available
        let webglVersion = 'Unknown';
        if (window.DEVICE_CAPABILITIES?.webgl_supported === true) {
            webglVersion = window.DEVICE_CAPABILITIES.webgl_type || 'WebGL 1.0';
        } else if (window.DEVICE_CAPABILITIES?.webgl_supported === false) {
            webglVersion = 'Not Supported';
        }

        return {
            platform,
            browser,
            deviceModel,
            ram,
            screenInfo,
            webglVersion,
            userAgent: ua
        };
    }

    /**
     * Show error page to user
     */
    function showErrorPage(healthCheckResult, discordLink = 'https://discord.gg/5uDkQtMw8e') {
        // Wait for DOM to be ready before inserting HTML
        function insertErrorPage() {
            const content = getErrorContent(healthCheckResult.error);
            const diagnostics = getDeviceDiagnostics();

            const errorHTML = `
            <div id="webgl-error-page" style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                color: white;
                padding: 40px 20px;
                overflow-y: auto;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            ">
                <div style="max-width: 600px; margin: 0 auto;">
                    <h1 style="font-size: 48px; margin-bottom: 20px;">🌍</h1>
                    <h2 style="font-size: 24px; margin-bottom: 10px;">Unable to Load 3D Globe</h2>

                    <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <p style="margin-top: 0; color: #fff; line-height: 1.6; margin-bottom: 20px;">
                            Hey there. If you are getting this screen, you are hitting a bug on MapTap that I've been trying (and failing) to fix. If you are on iOS, my best suggestion is to download the app.
                        </p>

                        <a href="https://apps.apple.com/us/app/maptap-gg/id6755205355" target="_blank" id="app-store-link" style="
                            display: flex;
                            align-items: center;
                            justify-content: flex-start;
                            gap: 12px;
                            background: linear-gradient(135deg, #4fc3f7 0%, #2196f3 100%);
                            color: white;
                            padding: 12px 20px;
                            border-radius: 10px;
                            text-decoration: none;
                            font-size: 16px;
                            font-weight: bold;
                            margin: 20px 0;
                            transition: transform 0.2s;
                            box-shadow: 0 4px 15px rgba(79, 195, 247, 0.3);
                            max-width: 280px;
                        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            <img src="assets/maptap_logo_glow.png" alt="MapTap Icon" style="width: 40px; height: 40px;">
                            <span>Install the MapTap App</span>
                        </a>

                        <p style="margin: 20px 0 0 0; color: #fff; line-height: 1.6;">
                            More details on the bug are below, including links to our discord. If you are on Android and running into this bug, I'd love to know - it might be a separate problem.
                        </p>
                    </div>

                    <p style="color: #aaa; margin-bottom: 5px;">
                        This device's web 3D graphics are not operating.
                    </p>
                    <p style="color: #ff6b6b; font-family: monospace; font-size: 14px; margin-bottom: 20px;">
                        Technical detail: ${content.technicalDetail}
                    </p>

                    ${content.context ? `
                        <p style="color: #ccc; margin-bottom: 20px;">
                            ${content.context}
                        </p>
                    ` : ''}

                    <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 3px solid #4fc3f7;">
                        <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 16px; color: #4fc3f7;">📱 Device Info (for screenshots/support)</h3>
                        <div style="font-family: monospace; font-size: 13px; line-height: 1.6; color: #ddd;">
                            ${diagnostics.deviceModel ? `<div><strong>Device:</strong> ${diagnostics.deviceModel}</div>` : ''}
                            <div><strong>Browser:</strong> ${diagnostics.browser}</div>
                            <div><strong>Platform:</strong> ${diagnostics.platform}</div>
                            <div><strong>Screen:</strong> ${diagnostics.screenInfo}</div>
                            <div><strong>RAM:</strong> ${diagnostics.ram}</div>
                            <div><strong>WebGL:</strong> ${diagnostics.webglVersion}</div>
                        </div>
                    </div>

                    <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                        <ul style="list-style: none; padding: 0; line-height: 1.8; margin: 0;">
                            <li>• Test if it's system-wide: visit <a href="https://get.webgl.org" target="_blank" style="color: #4fc3f7;">get.webgl.org</a></li>
                            <li style="margin-left: 20px; color: #aaa; font-size: 14px;">(If the cube doesn't render, your device needs the fixes above)</li>
                            <li>• Join our Discord for help - other players may have solutions</li>
                        </ul>
                    </div>

                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button id="try-anyway-btn" style="
                            background: #4caf50;
                            color: white;
                            border: none;
                            padding: 15px 30px;
                            border-radius: 8px;
                            font-size: 16px;
                            cursor: pointer;
                            font-weight: bold;
                        ">Try Loading Anyway →</button>

                        <a href="https://get.webgl.org" target="_blank" id="webgl-test-link" style="
                            background: #2196f3;
                            color: white;
                            border: none;
                            padding: 15px 30px;
                            border-radius: 8px;
                            font-size: 16px;
                            cursor: pointer;
                            text-decoration: none;
                            display: inline-block;
                        ">Visit get.webgl.org →</a>

                        <a href="${discordLink}" target="_blank" id="discord-link" style="
                            background: #7289da;
                            color: white;
                            border: none;
                            padding: 15px 30px;
                            border-radius: 8px;
                            font-size: 16px;
                            cursor: pointer;
                            text-decoration: none;
                            display: inline-block;
                        ">Join Discord →</a>

                        <a href="mailto:support@maptap.gg?subject=WebGL%20Error%20Feedback&body=Device%20Info:%0A${encodeURIComponent(diagnostics.deviceModel || 'Unknown')}%0ABrowser:%20${encodeURIComponent(diagnostics.browser)}%0AError:%20${encodeURIComponent(healthCheckResult.error || 'unknown')}%0A%0AFeedback:%0A" id="feedback-link" style="
                            background: #ff9800;
                            color: white;
                            border: none;
                            padding: 15px 30px;
                            border-radius: 8px;
                            font-size: 16px;
                            cursor: pointer;
                            text-decoration: none;
                            display: inline-block;
                        ">Send Feedback →</a>
                    </div>
                </div>
            </div>
        `;

            document.body.insertAdjacentHTML('afterbegin', errorHTML);

            // Set up event listeners
            document.getElementById('try-anyway-btn').addEventListener('click', handleTryAnyway);
            document.getElementById('app-store-link').addEventListener('click', handleAppStoreClick);
            document.getElementById('webgl-test-link').addEventListener('click', handleWebGLTestClick);
            document.getElementById('discord-link').addEventListener('click', handleDiscordClick);
            document.getElementById('feedback-link').addEventListener('click', handleFeedbackClick);

            // Report to analytics
            if (typeof report === 'function') {
                report("webgl_error_page_shown", "error", "WebGL Error Page", performance.now(), {
                    error_type: healthCheckResult.error,
                    error_detail: content.technicalDetail,
                    test_mode: healthCheckResult.testMode || false
                });
            }
        }

        // Check if DOM is ready
        if (document.body) {
            // DOM already ready, insert immediately
            insertErrorPage();
        } else {
            // DOM not ready yet, wait for it
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', insertErrorPage);
            } else {
                // Fallback: wait a tiny bit and try again
                setTimeout(insertErrorPage, 10);
            }
        }
    }

    /**
     * Handle "Try Loading Anyway" button click
     */
    function handleTryAnyway() {
        console.log('⚠️ User chose to try loading anyway despite health check failure');

        if (typeof report === 'function') {
            report("webgl_health_check_override", "error", "User Overrode Health Check", performance.now());
        }

        // Remove error page
        document.getElementById('webgl-error-page')?.remove();

        // Set flag to allow initialization
        window.WEBGL_HEALTHY = true;
        window.WEBGL_USER_OVERRIDE = true;

        // Show warning and reload
        const warningMsg = 'The 3D globe may not work correctly, but we\'ll try to load it...';
        if (confirm(warningMsg + '\n\nClick OK to continue.')) {
            // User confirmed, reload page without error flags
            const url = new URL(window.location.href);
            url.searchParams.delete('forceWebGLError');
            url.searchParams.set('skipHealthCheck', '1');
            window.location.href = url.toString();
        }
    }

    /**
     * Track App Store link click
     * Uses multiple methods to ensure the event is tracked before navigation
     */
    function handleAppStoreClick(event) {
        event.preventDefault();

        const appStoreUrl = event.currentTarget.href;
        console.log('[WebGL Error Page] App Store link clicked, tracking...');

        let eventSent = false;

        // Method 1: Use gtag with event_callback for reliable tracking
        if (typeof gtag === 'function') {
            try {
                gtag('event', 'app_store_link_clicked', {
                    'event_category': 'error',
                    'event_label': 'App Store Link Clicked',
                    'value': performance.now(),
                    'event_callback': function() {
                        console.log('[WebGL Error Page] gtag callback fired, navigating...');
                        if (!eventSent) {
                            eventSent = true;
                            window.location.href = appStoreUrl;
                        }
                    }
                });
            } catch (e) {
                console.warn('[WebGL Error Page] gtag error:', e);
            }
        }

        // Method 2: Also try report() for redundancy
        if (typeof report === 'function') {
            report("app_store_link_clicked", "error", "App Store Link Clicked", performance.now());
        }

        // Method 3: Fallback timeout in case callback never fires
        setTimeout(() => {
            if (!eventSent) {
                console.log('[WebGL Error Page] Fallback timeout, navigating...');
                eventSent = true;
                window.location.href = appStoreUrl;
            }
        }, 500);
    }

    /**
     * Track get.webgl.org link click
     */
    function handleWebGLTestClick() {
        if (typeof report === 'function') {
            report("webgl_test_link_clicked", "error", "Get WebGL Link Clicked", performance.now());
        }
    }

    /**
     * Track Discord link click
     */
    function handleDiscordClick() {
        if (typeof report === 'function') {
            report("webgl_discord_link_clicked", "error", "Discord Link Clicked", performance.now());
        }
    }

    /**
     * Track feedback link click
     */
    function handleFeedbackClick() {
        if (typeof report === 'function') {
            report("webgl_feedback_link_clicked", "error", "Feedback Link Clicked", performance.now());
        }
    }

    /**
     * Show debug overlay with health check results
     */
    function showDebugOverlay(healthCheckResult) {
        const debugHTML = `
            <div style="
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0,0,0,0.9);
                color: #0f0;
                padding: 20px;
                border-radius: 8px;
                font-family: monospace;
                font-size: 12px;
                z-index: 9999;
                max-width: 400px;
                border: 2px solid #0f0;
            ">
                <h3 style="margin-top: 0; color: #0ff;">WebGL Health Check Results</h3>
                <pre style="margin: 0; white-space: pre-wrap; color: #0f0;">${JSON.stringify(healthCheckResult, null, 2)}</pre>
                <button onclick="this.parentElement.remove()" style="
                    margin-top: 10px;
                    background: #f44;
                    color: white;
                    border: none;
                    padding: 8px 15px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Close</button>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', debugHTML);
    }

    // Public API
    return {
        run,
        showErrorPage,
        showDebugOverlay,
        DEBUG_MODE
    };
})();

// Export for window scope
window.WebGLHealthCheck = WebGLHealthCheck;
