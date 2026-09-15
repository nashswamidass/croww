import { calculateAreaScore } from '../../domain/areaScore';

/**
 * Personalized Area Score. Consumes a Prompt 9 snapshot only.
 * Does not scan listings or write localities.
 */
export const areaScoreService = {
    calculate({ snapshot, city, weights } = {}) {
        return calculateAreaScore({ snapshot, city, weights });
    },
};
