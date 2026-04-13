const countryToIso = {
    "Afghanistan": "AF",
    "Albania": "AL",
    "Algeria": "DZ",
    "Andorra": "AD",
    "Angola": "AO",
    "Antigua and Barbuda": "AG",
    "Argentina": "AR",
    "Armenia": "AM",
    "Australia": "AU",
    "Austria": "AT",
    "Azerbaijan": "AZ",
    "Bahamas": "BS",
    "Bahrain": "BH",
    "Bangladesh": "BD",
    "Barbados": "BB",
    "Belarus": "BY",
    "Belgium": "BE",
    "Belize": "BZ",
    "Bermuda": "BM",
    "Benin": "BJ",
    "Bhutan": "BT",
    "Bolivia": "BO",
    "Bosnia and Herzegovina": "BA",
    "Botswana": "BW",
    "Brazil": "BR",
    "Brunei": "BN",
    "Bulgaria": "BG",
    "Burkina Faso": "BF",
    "Burundi": "BI",
    "Côte d'Ivoire": "CI",
    "Ivory Coast": "CI",
    "Cabo Verde": "CV",
    "Cambodia": "KH",
    "Cameroon": "CM",
    "Canada": "CA",
    "Central African Republic": "CF",
    "Chad": "TD",
    "Chile": "CL",
    "China": "CN",
    "Colombia": "CO",
    "Comoros": "KM",
    "Congo": "CG",
    "Congo-Brazzaville": "CG",
    "Costa Rica": "CR",
    "Croatia": "HR",
    "Cuba": "CU",
    "Cyprus": "CY",
    "Czechia": "CZ",
    "Czech Republic": "CZ",
    "Democratic Republic of the Congo": "CD",
    "Denmark": "DK",
    "Djibouti": "DJ",
    "Dominica": "DM",
    "Dominican Republic": "DO",
    "Ecuador": "EC",
    "Egypt": "EG",
    "El Salvador": "SV",
    "Equatorial Guinea": "GQ",
    "Eritrea": "ER",
    "Estonia": "EE",
    "Eswatini": "SZ",
    "Swaziland": "SZ",
    "Ethiopia": "ET",
    "Fiji": "FJ",
    "Finland": "FI",
    "France": "FR",
    "Gabon": "GA",
    "Gambia": "GM",
    "Georgia": "GE",
    "Germany": "DE",
    "Ghana": "GH",
    "Greece": "GR",
    "Grenada": "GD",
    "Guatemala": "GT",
    "Guinea": "GN",
    "Guinea-Bissau": "GW",
    "Guyana": "GY",
    "Haiti": "HT",
    "Holy See": "VA",
    "Honduras": "HN",
    "Hungary": "HU",
    "Iceland": "IS",
    "India": "IN",
    "Indonesia": "ID",
    "Iran": "IR",
    "Iraq": "IQ",
    "Ireland": "IE",
    "Israel": "IL",
    "Italy": "IT",
    "Jamaica": "JM",
    "Japan": "JP",
    "Jordan": "JO",
    "Kazakhstan": "KZ",
    "Kenya": "KE",
    "Kiribati": "KI",
    "Kuwait": "KW",
    "Kyrgyzstan": "KG",
    "Laos": "LA",
    "Latvia": "LV",
    "Lebanon": "LB",
    "Lesotho": "LS",
    "Liberia": "LR",
    "Libya": "LY",
    "Liechtenstein": "LI",
    "Lithuania": "LT",
    "Luxembourg": "LU",
    "Madagascar": "MG",
    "Malawi": "MW",
    "Malaysia": "MY",
    "Maldives": "MV",
    "Mali": "ML",
    "Malta": "MT",
    "Marshall Islands": "MH",
    "Mauritania": "MR",
    "Mauritius": "MU",
    "Mexico": "MX",
    "Micronesia": "FM",
    "Moldova": "MD",
    "Monaco": "MC",
    "Mongolia": "MN",
    "Montenegro": "ME",
    "Morocco": "MA",
    "Mozambique": "MZ",
    "Myanmar": "MM",
    "Burma": "MM",
    "Namibia": "NA",
    "Nauru": "NR",
    "Nepal": "NP",
    "Netherlands": "NL",
    "New Zealand": "NZ",
    "Nicaragua": "NI",
    "Niger": "NE",
    "Nigeria": "NG",
    "North Korea": "KP",
    "North Macedonia": "MK",
    "Macedonia": "MK",
    "Norway": "NO",
    "Oman": "OM",
    "Pakistan": "PK",
    "Palau": "PW",
    "Palestine State": "PS",
    "Panama": "PA",
    "Papua New Guinea": "PG",
    "Paraguay": "PY",
    "Peru": "PE",
    "Philippines": "PH",
    "Poland": "PL",
    "Portugal": "PT",
    "Qatar": "QA",
    "Romania": "RO",
    "Russia": "RU",
    "Rwanda": "RW",
    "Saint Kitts and Nevis": "KN",
    "Saint Lucia": "LC",
    "Saint Vincent and the Grenadines": "VC",
    "Samoa": "WS",
    "San Marino": "SM",
    "Sao Tome and Principe": "ST",
    "Saudi Arabia": "SA",
    "Senegal": "SN",
    "Serbia": "RS",
    "Seychelles": "SC",
    "Sierra Leone": "SL",
    "Singapore": "SG",
    "Slovakia": "SK",
    "Slovenia": "SI",
    "Solomon Islands": "SB",
    "Somalia": "SO",
    "South Africa": "ZA",
    "South Korea": "KR",
    "South Sudan": "SS",
    "Spain": "ES",
    "Sri Lanka": "LK",
    "Sudan": "SD",
    "Suriname": "SR",
    "Sweden": "SE",
    "Switzerland": "CH",
    "Syria": "SY",
    "Tajikistan": "TJ",
    "Tanzania": "TZ",
    "Thailand": "TH",
    "Timor-Leste": "TL",
    "Togo": "TG",
    "Tonga": "TO",
    "Trinidad and Tobago": "TT",
    "Tunisia": "TN",
    "Turkey": "TR",
    "Turkmenistan": "TM",
    "Tuvalu": "TV",
    "Uganda": "UG",
    "Ukraine": "UA",
    "United Arab Emirates": "AE",
    "United Kingdom": "GB",
    "United States of America": "US",
    "USA": "US",
    "US": "US",
    "Uruguay": "UY",
    "Uzbekistan": "UZ",
    "Vanuatu": "VU",
    "Venezuela": "VE",
    "Vietnam": "VN",
    "Yemen": "YE",
    "Zambia": "ZM",
    "Zimbabwe": "ZW"
};
function countryNameToIso(countryName) {
    const isoCode = countryToIso[countryName];
    if (!isoCode) {
        console.error('ISO code not found for:', countryName);
        return '🌐';  // Return globe emoji when country ISO code is not found
    }
    return isoToFlagEmoji(isoCode);
}
function isoToFlagEmoji(isoCode) {
    // Convert each letter in the ISO code to a regional indicator symbol
    const emoji = Array.from(isoCode).map(letter =>
        String.fromCodePoint(127397 + letter.charCodeAt(0))).join('');
    return emoji;
}

function getCountryFromLocation(location)
{
    const regex = /\(([^)]+)\)|, ([^,]+)$/;
    // Use regex to find matches in the location string
    const matches = location.match(regex);
    let countryName;
    if (matches) {
        // Check if country name is from format 1 or 3 (inside parentheses) or format 2 (after comma)
        countryName = matches[1] ? matches[1].trim() : matches[2].trim();
        // Further processing for format 3 to handle cases like 'aka, Turkey'
        if (countryName.includes(',')) {
            return countryName.split(',')[1].trim();
        }
    } else {
        // If no matches found, log error and return globe emoji
        console.error('No country found in:', location);
        return '???';
    }
    return countryName.trim();
}
function getLocationFlag(location) {
    let countryName = getCountryFromLocation(location)
    if (countryName === "???") {
        return '🌐';
    }
    return countryNameToIso(countryName.trim());
}

// --- Country Flag Display Feature ---

const FLAGS_CDN_BASE = 'https://tiles.maptap.gg/flags';

// Inject flag-icon CSS once
(function() {
    if (document.getElementById('flag-icon-styles')) return;
    const style = document.createElement('style');
    style.id = 'flag-icon-styles';
    style.textContent = `
        .flag-icon {
            width: 18px;
            height: 14px;
            vertical-align: middle;
            margin-right: 3px;
            border-radius: 2px;
            object-fit: cover;
        }
        .flag-icon-sm {
            width: 14px;
            height: 10px;
            margin-right: 2px;
        }
        .flag-icon-lg {
            width: 24px;
            height: 18px;
            margin-right: 4px;
        }
    `;
    document.head.appendChild(style);
})();

// Reverse lookup: ISO-2 code → country name (built once from countryToIso)
const isoToCountryName = (() => {
    const map = {};
    for (const [name, code] of Object.entries(countryToIso)) {
        const upper = code.toUpperCase();
        // Prefer shorter/primary names (first entry wins)
        if (!map[upper]) map[upper] = name;
    }
    return map;
})();

// Returns an <img> tag for a country flag, or empty string if no code
function flagImg(iso2, extraClass) {
    if (!iso2) return '';
    const cls = 'flag-icon' + (extraClass ? ' ' + extraClass : '');
    const name = isoToCountryName[iso2.toUpperCase()] || iso2;
    return `<img src="${FLAGS_CDN_BASE}/${iso2.toLowerCase()}.png" class="${cls}" alt="${name}" title="${name}" loading="lazy">`;
}

// Sorted list of countries for dropdown (display name → ISO-2 code)
// Deduplicates aliases (e.g., "Burma"/"Myanmar" → only "Myanmar")
const countryListForDropdown = (() => {
    const seen = new Set();
    const list = [];
    // Preferred display names (skip aliases)
    const skipAliases = new Set([
        'USA', 'US', 'Burma', 'Ivory Coast', 'Swaziland', 'Czech Republic',
        'Macedonia', 'Congo-Brazzaville', 'Holy See'
    ]);
    for (const [name, code] of Object.entries(countryToIso)) {
        if (skipAliases.has(name)) continue;
        if (seen.has(code)) continue;
        seen.add(code);
        list.push({ name, code });
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
})();