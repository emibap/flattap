/**
 * XP Configuration - Data-driven XP values for MapTap
 *
 * This file centralizes all XP-related configuration.
 * Modify values here to adjust XP rewards across the game.
 *
 * Used by: continent-progress.js, adventures.html, index.html
 */

(function() {
    'use strict';

    const XP_CONFIG = {
        // Score thresholds for XP tiers (offset by 0.5 to account for display rounding)
        // Displayed 90% = tier 1, 98% = tier 2, 99% = tier 3, 100% = tier 4
        thresholds: {
            tier1: 89.5,   // Minimum to earn XP (displays as 90%)
            tier2: 97.5,   // Good score (displays as 98%)
            tier3: 98.5,   // Great score (displays as 99%)
            tier4: 99.5    // Perfect score (displays as 100%)
        },

        // Practice game XP values (tiered)
        practice: {
            tier1: 1,    // 90-97%
            tier2: 2,    // 98%
            tier3: 3,    // 99%
            tier4: 4     // 100%
        },

        // Personalized practice XP values (2x regular practice)
        personalized: {
            tier1: 2,    // 90-97%
            tier2: 4,    // 98%
            tier3: 6,    // 99%
            tier4: 8     // 100%
        },

        // Daily game XP values (5x practice)
        daily: {
            tier1: 5,    // 90-97%
            tier2: 10,   // 98%
            tier3: 15,   // 99%
            tier4: 20    // 100%
        },

        // Level curve constants
        // Formula: totalXpForLevel(n) = n × (n + 1) × levelMultiplier
        levelMultiplier: 50
    };

    /**
     * Calculate XP earned for a score (tiered system)
     * @param {number} score - The accuracy score (0-100)
     * @param {string|boolean} mode - 'daily', 'personalized', 'practice', or boolean (true=daily, false=practice)
     * @returns {number} XP earned
     */
    function calculateXp(score, mode) {
        const thresholds = XP_CONFIG.thresholds;

        // Support legacy boolean parameter
        let config;
        if (mode === true || mode === 'daily') {
            config = XP_CONFIG.daily;
        } else if (mode === 'personalized') {
            config = XP_CONFIG.personalized;
        } else {
            config = XP_CONFIG.practice;
        }

        // Below minimum threshold = no XP
        if (score < thresholds.tier1) return 0;

        // Tiered XP based on score
        if (score >= thresholds.tier4) return config.tier4;  // 100%
        if (score >= thresholds.tier3) return config.tier3;  // 99%+
        if (score >= thresholds.tier2) return config.tier2;  // 98%+
        return config.tier1;  // 90%+
    }

    /**
     * Check if a location type qualifies for hard location bonus
     * @deprecated Hard location bonus has been removed
     * @param {string} locationType - The location type to check
     * @returns {boolean} Always returns false
     */
    function isHardLocationType(locationType) {
        return false; // Hard location bonus removed
    }

    /**
     * Get level from total XP
     * Formula: n(n+1) × multiplier = xp
     * Solving for n: n = (-1 + sqrt(1 + 4×xp/multiplier)) / 2
     * @param {number} xp - Total XP
     * @returns {number} Level
     */
    function getLevel(xp) {
        if (xp <= 0) return 0;
        const m = XP_CONFIG.levelMultiplier;
        return Math.floor((-1 + Math.sqrt(1 + (4 * xp) / m)) / 2);
    }

    /**
     * Get total XP needed to reach a level
     * Formula: level × (level + 1) × multiplier
     * @param {number} level - Target level
     * @returns {number} XP required
     */
    function getXpForLevel(level) {
        return level * (level + 1) * XP_CONFIG.levelMultiplier;
    }

    /**
     * Get detailed progress info for a given XP amount
     * @param {number} xp - Current XP
     * @returns {Object} Progress details
     */
    function getLevelProgress(xp) {
        const level = getLevel(xp);
        const currentLevelXp = getXpForLevel(level);
        const nextLevelXp = getXpForLevel(level + 1);
        const xpIntoLevel = xp - currentLevelXp;
        const xpNeededForNext = nextLevelXp - currentLevelXp;

        return {
            level,
            currentXp: xp,
            xpIntoLevel,
            xpNeededForNext,
            xpToNextLevel: nextLevelXp - xp,
            progressPercent: xpNeededForNext > 0 ? (xpIntoLevel / xpNeededForNext) * 100 : 100
        };
    }

    // Export to window
    window.XP_CONFIG = XP_CONFIG;
    window.XpSystem = {
        config: XP_CONFIG,
        calculateXp,
        isHardLocationType,
        getLevel,
        getXpForLevel,
        getLevelProgress
    };

    console.log('[XpConfig] XP configuration loaded');
})();
