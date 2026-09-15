import { localityService } from '../property/localityService';
import { emptySnapshot, normalizeSnapshot } from '../../domain/intelligence';

/**
 * UI boundary for locality intelligence.
 * One locality document read. No listing scans. No client-side market aggregation.
 */
export const localityIntelligenceService = {
    async loadPublic(localityId) {
        if (!localityId) {
            return {
                locality: null,
                snapshot: emptySnapshot(),
                identity: null,
            };
        }
        const locality = await localityService.getLocality(localityId);
        if (!locality) {
            return {
                locality: null,
                snapshot: emptySnapshot(),
                identity: null,
            };
        }
        return {
            locality,
            snapshot: normalizeSnapshot(locality.intelligence),
            identity: {
                localityId: locality.id,
                name: locality.name || null,
                city: locality.city || null,
                state: locality.state || null,
                country: locality.country || null,
                aliases: Array.isArray(locality.aliases) ? locality.aliases : [],
                status: locality.status || null,
            },
        };
    },
};
