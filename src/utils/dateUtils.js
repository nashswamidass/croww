/**
 * Utility functions for handling dates without timezone headaches
 */

/**
 * Returns a YYYY-MM-DD string for a given Date object in LOCAL time
 */
export const formatDateToKey = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Returns a Date object from a YYYY-MM-DD string, set to 00:00:00 local time
 */
export const parseKeyToDate = (dateKey) => {
    if (!dateKey) return new Date();
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
};

/**
 * Get today's date as YYYY-MM-DD string in local time
 */
export const getTodayKey = () => formatDateToKey(new Date());
