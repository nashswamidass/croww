const REGION = 'us-central1';
const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
    || (process.env.APP_ENV === 'staging' ? 'croww-staging-2026' : 'croww-live-2026');
if (process.env.APP_ENV === 'staging' && PROJECT_ID !== 'croww-staging-2026') {
    throw new Error('Staging client refusing a non-staging Firebase project.');
}
if (process.env.APP_ENV === 'production-preview' && PROJECT_ID !== 'croww-live-2026') {
    throw new Error('Production-preview client refusing a non-production Firebase project.');
}
const BASE_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;
const IS_STAGING = PROJECT_ID === 'croww-staging-2026';

function httpFunctionUrl(functionName, productionCloudRunUrl) {
    if (IS_STAGING) {
        return `${BASE_URL}/${functionName}`;
    }
    return productionCloudRunUrl || `${BASE_URL}/${functionName}`;
}

/**
 * Centered mapping of all Cloud Function endpoints.
 * Staging always uses this project's cloudfunctions.net host so a staging
 * client cannot silently call production Cloud Run.
 * Production keeps existing Cloud Run URLs.
 */
export const API_ENDPOINTS = {
    // Auth & User
    SEND_CUSTOM_PASSWORD_RESET: httpFunctionUrl(
        'sendCustomPasswordReset',
        'https://sendcustompasswordreset-6vktyfoeaa-uc.a.run.app'
    ),
    DELETE_USER_ACCOUNT: httpFunctionUrl(
        'deleteUserAccount',
        'https://deleteuseraccount-6vktyfoeaa-uc.a.run.app'
    ),
    TOGGLE_USER_BLOCK: httpFunctionUrl(
        'toggleUserBlock',
        'https://toggleuserblock-6vktyfoeaa-uc.a.run.app'
    ),
    TOGGLE_FOLLOW: httpFunctionUrl(
        'toggleFollow',
        'https://togglefollow-6vktyfoeaa-uc.a.run.app'
    ),

    // Verification
    GET_DIGILOCKER_URL: httpFunctionUrl(
        'getDigiLockerUrl',
        'https://getdigilockerurl-6vktyfoeaa-uc.a.run.app'
    ),
    GET_DIGILOCKER_STATUS: httpFunctionUrl(
        'getDigiLockerStatus',
        'https://getdigilockerstatus-6vktyfoeaa-uc.a.run.app'
    ),
    REVIEW_VERIFICATION: `${BASE_URL}/reviewVerification`,
    PUBLISH_LISTING: `${BASE_URL}/publishListing`,
    FINALIZE_SPATIAL_ASSET: `${BASE_URL}/finalizeSpatialAsset`,
    ARCHIVE_SPATIAL_ASSET: `${BASE_URL}/archiveSpatialAsset`,

    // Payments
    CREATE_CASHFREE_ORDER: httpFunctionUrl(
        'createCashfreeOrder',
        'https://createcashfreeorder-6vktyfoeaa-uc.a.run.app'
    ),
    VERIFY_CASHFREE_PAYMENT: httpFunctionUrl(
        'verifyCashfreePayment',
        'https://verifycashfreepayment-6vktyfoeaa-uc.a.run.app'
    ),
};

export default API_ENDPOINTS;
