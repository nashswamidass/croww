import { haversineMeters } from './geo.ts';
import { normalizeAddress, normalizeProjectName } from './address.ts';

export type DuplicateCandidate = {
    propertyId: string;
    score: number;
    reasons: string[];
};

type PropertyLike = {
    id: string;
    localityId?: string | null;
    category?: string | null;
    subtype?: string | null;
    projectName?: string | null;
    address?: Record<string, unknown> | null;
    addressNormalized?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    bedrooms?: number | null;
    floor?: number | null;
    builtUpAreaSqft?: number | null;
    plotAreaSqft?: number | null;
};

/**
 * Bounded in-memory scoring. Callers must pass a small candidate set
 * (same locality, ACTIVE). Never auto-merge.
 */
export function scoreDuplicateCandidates(
    input: PropertyLike,
    existing: PropertyLike[],
    { minScore = 40 } = {}
): DuplicateCandidate[] {
    const inputNorm = input.addressNormalized || normalizeAddress(input.address as never);
    const inputProject = normalizeProjectName(input.projectName);
    const results: DuplicateCandidate[] = [];

    existing.forEach((row) => {
        if (!row?.id || row.id === input.id) return;
        const reasons: string[] = [];
        let score = 0;
        const rowNorm = row.addressNormalized || normalizeAddress(row.address as never);
        if (inputNorm && rowNorm && inputNorm === rowNorm) {
            score += 70;
            reasons.push('normalized_address');
        }
        if (inputProject && normalizeProjectName(row.projectName) === inputProject) {
            score += 25;
            reasons.push('project_name');
        }
        if (input.category && row.category && input.category === row.category) {
            score += 5;
        }
        if (input.subtype && row.subtype && input.subtype === row.subtype) {
            score += 8;
            reasons.push('subtype');
        }
        if (
            input.bedrooms != null && row.bedrooms != null && input.bedrooms === row.bedrooms
        ) {
            score += 8;
            reasons.push('bedrooms');
        }
        if (input.floor != null && row.floor != null && input.floor === row.floor) {
            score += 8;
            reasons.push('floor');
        }
        const areaA = input.builtUpAreaSqft || input.plotAreaSqft;
        const areaB = row.builtUpAreaSqft || row.plotAreaSqft;
        if (areaA && areaB && Math.abs(areaA - areaB) / Math.max(areaA, areaB) <= 0.05) {
            score += 10;
            reasons.push('area');
        }
        if (
            Number.isFinite(Number(input.latitude))
            && Number.isFinite(Number(input.longitude))
            && Number.isFinite(Number(row.latitude))
            && Number.isFinite(Number(row.longitude))
        ) {
            const meters = haversineMeters(
                { latitude: Number(input.latitude), longitude: Number(input.longitude) },
                { latitude: Number(row.latitude), longitude: Number(row.longitude) }
            );
            if (meters <= 75) {
                score += 40;
                reasons.push('public_pin_lt_75m');
            } else if (meters <= 250) {
                score += 15;
                reasons.push('public_pin_lt_250m');
            }
        }
        if (score >= minScore && reasons.length) {
            results.push({ propertyId: row.id, score, reasons });
        }
    });

    return results.sort((a, b) => b.score - a.score).slice(0, 8);
}
