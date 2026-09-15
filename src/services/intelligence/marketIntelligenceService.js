import { computeMarketDomain } from '../../domain/intelligence';

/**
 * Croww-derived market metrics.
 *
 * LocalityScreen must not call this against live Firestore inventory.
 * A bounded admin/server job (`recomputeLocalityMarket`) writes the snapshot.
 */
export const marketIntelligenceService = {
    computeFromListings(listings, options = {}) {
        return computeMarketDomain(listings, options);
    },
};
