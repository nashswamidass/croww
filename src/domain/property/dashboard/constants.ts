/**
 * Inventory dashboard product constants.
 * Thresholds are documented product rules, not a freshness worker.
 */

export const DASHBOARD_PAGE_SIZE = 25;
export const DASHBOARD_PAGE_SIZE_MAX = 50;
export const DASHBOARD_INQUIRY_CHAT_LIMIT = 40;
export const DASHBOARD_PROPERTY_PAGE_SIZE = 25;
export const DASHBOARD_UNDER_REVIEW_SCAN_LIMIT = 50;

/** PUBLISHED / PAUSED listings with no update in this window surface “Needs update”. */
export const DASHBOARD_STALE_UPDATE_MS = 14 * 24 * 60 * 60 * 1000;

/** expiresAt within this window surfaces “Expires soon”. */
export const DASHBOARD_EXPIRES_SOON_MS = 7 * 24 * 60 * 60 * 1000;

export const DASHBOARD_FILTERS = [
    'all',
    'draft',
    'review',
    'published',
    'paused',
    'sold_rented',
    'archived',
] as const;

export type DashboardFilter = (typeof DASHBOARD_FILTERS)[number];
