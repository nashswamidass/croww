import type { RangeThreshold } from './types.ts';

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function roundScore(value: number): number {
    return Math.round(value * 10) / 10;
}

/**
 * Lower raw value is more favorable (price, distance).
 * At `favorable` or better → 100. At `unfavorable` or worse → 0. Linear between.
 */
export function invertLinear(value: number, range: RangeThreshold): number {
    const { favorable, unfavorable } = range;
    if (!(Number.isFinite(value) && Number.isFinite(favorable) && Number.isFinite(unfavorable))) {
        return 0;
    }
    if (favorable === unfavorable) {
        return value <= favorable ? 100 : 0;
    }
    const low = Math.min(favorable, unfavorable);
    const high = Math.max(favorable, unfavorable);
    const t = clamp((value - low) / (high - low), 0, 1);
    const score = favorable < unfavorable ? 100 * (1 - t) : 100 * t;
    return roundScore(score);
}

/**
 * Higher count is more favorable. 0 → 0. At `favorable` or above → 100.
 */
export function countLinear(value: number, favorable: number): number {
    if (!(Number.isFinite(value) && value >= 0) || !(favorable > 0)) return 0;
    return roundScore(clamp((value / favorable) * 100, 0, 100));
}

/**
 * Croww listing activity is not "good area". Cap below 100 so volume never reads as perfect.
 */
export function marketActivityScore(listingCount: number, favorable: number): number {
    const raw = countLinear(listingCount, favorable);
    return roundScore(Math.min(raw, 90));
}

export function averageScores(scores: number[]): number | null {
    const valid = scores.filter((n) => Number.isFinite(n));
    if (!valid.length) return null;
    return roundScore(valid.reduce((a, b) => a + b, 0) / valid.length);
}

export function floodClassScore(classification: string | null | undefined): number | null {
    if (classification === 'LOW') return 100;
    if (classification === 'MODERATE') return 50;
    if (classification === 'HIGH') return 15;
    return null;
}
