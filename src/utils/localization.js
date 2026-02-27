/**
 * Utility for Indian localization helpers
 */

/**
 * Formats a date string or object to Indian format DD/MM/YYYY
 * @param {string|Date} date 
 * @returns {string} 
 */
export const formatIndianDate = (date) => {
    if (!date) return 'Date TBD';
    const d = new Date(date);
    if (isNaN(d.getTime())) return date; // Return original if not a valid date

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return `${day}/${month}/${year}`;
};

/**
 * Common Indian cities for localization
 */
export const INDIAN_CITIES = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad',
    'Chennai', 'Kolkata', 'Surat', 'Pune', 'Jaipur', 'Goa'
];
