/**
 * Utility Functions Module
 * General helper functions for user IDs, game counting, data fetching, etc.
 */

class UtilsService {
    constructor() {}

    /**
     * Generate a unique user ID
     * @returns {string} Unique user ID
     */
    generateUserId() {
        // Try crypto.randomUUID() first, fallback to timestamp + random
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Get or create user ID from localStorage
     * @returns {string} User ID
     */
    getUserId() {
        let userId = localStorage.getItem('maptap_user_id');
        if (!userId) {
            userId = this.generateUserId();
            localStorage.setItem('maptap_user_id', userId);
            console.log('Generated new user ID:', userId);
        }
        return userId;
    }

    /**
     * Count number of games played (with valid scores)
     * @param {Object} runtime - Runtime object with savePrefix
     * @returns {number} Number of games played
     */
    countGames(runtime) {
        const HISTORY_KEY = runtime.savePrefix + "_history"; // "maptap_history"
        const raw = localStorage.getItem(HISTORY_KEY);
        if (!raw) return 0;

        try {
            const history = JSON.parse(raw);
            let count = 0;
            for (const date in history) {
                const entry = history[date];
                // use totalScore if present, else fall back to finalScore
                const scoreValue = entry.totalScore != null
                    ? entry.totalScore
                    : entry.finalScore != null
                        ? Number(entry.finalScore)
                        : 0;
                if (Number(scoreValue) > 0) count++;
            }
            return count;
        } catch (err) {
            console.error("Failed to parse MapTap history:", err);
            return 0;
        }
    }

    /**
     * Fetch location names for a specific date
     * @param {string} dateKey - Date key (e.g., "September01")
     * @returns {Promise<string>} Joined city names
     */
    getLocationsForDate(dateKey) {
        return fetch(`data/this_day_in_history/${dateKey}.js`)
            .then(res => {
                if (!res.ok) throw new Error(`Failed to fetch ${dateKey}.js`);
                return res.text();
            })
            .then(text => {
                // 1) pull out the array literal after "cities ="
                const m = text.match(/cities\s*=\s*(\[[\s\S]*?\]);/);
                if (!m) throw new Error(`No cities array found in ${dateKey}.js`);

                // 2) turn that JS literal into a real array
                //    using the Function constructor to avoid polluting globals
                const citiesArr = (new Function(`return ${m[1]};`))();

                // 3) map to names and join
                return citiesArr.map(c => c.name).join(' - ');
            });
    }

    /**
     * Log MapTap scores with inferred year (debug utility)
     * @param {Object} runtime - Runtime object with savePrefix
     */
    logMapTapScoresWithYear(runtime) {
        const prefix = runtime.savePrefix;
        const today = new Date();
        const thisYear = today.getFullYear();
        const monthMap = {
            January: 1,
            February: 2,
            March: 3,
            April: 4,
            May: 5,
            June: 6,
            July: 7,
            August: 8,
            September: 9,
            October: 10,
            November: 11,
            December: 12
        };

        console.log("MapTap scores by date with inferred year:");
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key.startsWith(prefix)) continue;

            const raw = localStorage.getItem(key);
            try {
                const data = JSON.parse(raw);
                if (data && typeof data.totalScore === "number") {
                    const suffixMatch = key.slice(prefix.length).match(/^([A-Za-z]+)(\d{1,2})$/);
                    if (suffixMatch) {
                        const monthName = suffixMatch[1];
                        const day = suffixMatch[2];
                        const monthNum = monthMap[monthName];
                        if (monthNum) {
                            const year = (monthNum <= 6 ? thisYear : thisYear - 1);
                            console.log(`${monthName}${day} (${year}): ${data.totalScore}`);
                            continue;
                        }
                    }
                    // fallback if parsing fails
                    console.log(`${key.slice(prefix.length)}: ${data.totalScore}`);
                }
            } catch (e) {
                // not JSON or not a MapTap entry
            }
        }
    }
}

// Export for use in beta.html
window.UtilsService = UtilsService;