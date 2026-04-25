const REGION = 'us-central1';
const PROJECT_ID = 'croww-live-2026';
const BASE_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;

/**
 * Centered mapping of all Cloud Function endpoints.
 * Using the standard .cloudfunctions.net pattern which is more stable than Cloud Run direct URLs.
 */
export const API_ENDPOINTS = {
    // Auth & User
    SEND_CUSTOM_PASSWORD_RESET: `https://sendcustompasswordreset-6vktyfoeaa-uc.a.run.app`,
    DELETE_USER_ACCOUNT: `https://deleteuseraccount-6vktyfoeaa-uc.a.run.app`,
    TOGGLE_USER_BLOCK: `https://toggleuserblock-6vktyfoeaa-uc.a.run.app`,
    TOGGLE_FOLLOW: `https://togglefollow-6vktyfoeaa-uc.a.run.app`,

    // Verification
    GET_DIGILOCKER_URL: `https://getdigilockerurl-6vktyfoeaa-uc.a.run.app`,
    GET_DIGILOCKER_STATUS: `https://getdigilockerstatus-6vktyfoeaa-uc.a.run.app`,

    // Payments
    CREATE_CASHFREE_ORDER: `https://createcashfreeorder-6vktyfoeaa-uc.a.run.app`,
    VERIFY_CASHFREE_PAYMENT: `https://verifycashfreepayment-6vktyfoeaa-uc.a.run.app`,
};

export default API_ENDPOINTS;
