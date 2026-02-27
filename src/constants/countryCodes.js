export const COUNTRY_CODES = [
    { code: 'IN', name: 'India', callingCode: '+91', flag: '🇮🇳', length: 10 },
    { code: 'US', name: 'United States', callingCode: '+1', flag: '🇺🇸', length: 10 },
    { code: 'GB', name: 'United Kingdom', callingCode: '+44', flag: '🇬🇧', length: 10 },
    { code: 'AE', name: 'United Arab Emirates', callingCode: '+971', flag: '🇦🇪', length: 9 },
    { code: 'AU', name: 'Australia', callingCode: '+61', flag: '🇦🇺', length: 9 },
    { code: 'CA', name: 'Canada', callingCode: '+1', flag: '🇨🇦', length: 10 },
    { code: 'SG', name: 'Singapore', callingCode: '+65', flag: '🇸🇬', length: 8 },
    { code: 'DE', name: 'Germany', callingCode: '+49', flag: '🇩🇪', length: 11 },
    { code: 'FR', name: 'France', callingCode: '+33', flag: '🇫🇷', length: 9 },
    { code: 'ES', name: 'Spain', callingCode: '+34', flag: '🇪🇸', length: 9 },
];

export const getCountryByCallingCode = (callingCode) => {
    return COUNTRY_CODES.find(c => c.callingCode === callingCode) || COUNTRY_CODES[0];
};

export const getCountryByCode = (code) => {
    return COUNTRY_CODES.find(c => c.code === code) || COUNTRY_CODES[0];
};
