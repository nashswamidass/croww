/**
 * Croww Platform Fee Calculator
 *
 * Role Structure:
 *  - Croww is a facilitator platform (not seller of record)
 *  - Organizers are responsible for event execution, ticket GST & compliance
 *
 * Fee Structure:
 *  - Convenience Fee: 2% of ticket subtotal (paid by user)
 *  - GST on Convenience Fee: 18% of convenience fee (paid by user)
 *  - Platform Commission: 7% of ticket subtotal (deducted from organizer payout)
 *  - GST on Commission: 18% of platform commission (deducted from organizer payout)
 */

const PLATFORM_COMMISSION_RATE = 0.07;       // 7%
const COMMISSION_GST_RATE = 0.18;             // 18% GST on commission
const CONVENIENCE_FEE_RATE = 0.02;           // 2% convenience fee
const CONVENIENCE_FEE_GST_RATE = 0.18;       // 18% GST on convenience fee

/**
 * Round a number to 2 decimal places
 */
const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

/**
 * Calculate all fees for a ticket purchase
 *
 * @param {number} pricePerTicket - Face value of one ticket (in INR)
 * @param {number} quantity - Number of tickets being purchased
 * @returns {Object} Full fee breakdown
 */
export const calculateFees = (pricePerTicket, quantity = 1) => {
    const subtotal = round2(pricePerTicket * quantity);

    // --- User-facing fees (added to subtotal at checkout) ---
    const convenienceFee = round2(subtotal * CONVENIENCE_FEE_RATE);
    const convenienceFeeGST = round2(convenienceFee * CONVENIENCE_FEE_GST_RATE);
    const totalPayable = round2(subtotal + convenienceFee + convenienceFeeGST);

    // --- Organizer-facing deductions (deducted before payout) ---
    const platformCommission = round2(subtotal * PLATFORM_COMMISSION_RATE);
    const platformCommissionGST = round2(platformCommission * COMMISSION_GST_RATE);
    const netOrganizerPayout = round2(subtotal - platformCommission - platformCommissionGST);

    return {
        // Core
        pricePerTicket,
        quantity,
        subtotal,

        // User pays
        convenienceFee,
        convenienceFeeGST,
        totalPayable,

        // Organizer receives
        platformCommission,
        platformCommissionGST,
        netOrganizerPayout,

        // Internal rates (for audit/display purposes)
        rates: {
            commission: `${PLATFORM_COMMISSION_RATE * 100}%`,
            convenienceFee: `${CONVENIENCE_FEE_RATE * 100}%`,
            gst: `${COMMISSION_GST_RATE * 100}%`,
        }
    };
};

/**
 * Format INR currency for display
 * @param {number} amount
 * @returns {string} e.g. "₹204.72"
 */
export const formatINR = (amount) => {
    if (amount === null || amount === undefined) return '₹0';
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Calculate settlement date (T+2 business days after event date)
 * @param {string|Date} eventDate - The event date
 * @returns {Date} Settlement date
 */
export const getSettlementDate = (eventDate) => {
    const date = new Date(eventDate);
    let businessDaysAdded = 0;
    while (businessDaysAdded < 2) {
        date.setDate(date.getDate() + 1);
        const day = date.getDay();
        if (day !== 0 && day !== 6) { // Skip weekends
            businessDaysAdded++;
        }
    }
    return date;
};
