/**
 * Deterministic client-side capture quality checks.
 * Note: App-level checks only catch obvious issues (duration, empty file, size, format).
 * The backend GPU pipeline remains authoritative for full reconstruction feasibility.
 */
import {
    SPATIAL_HARD_STOP_DURATION_SECONDS,
    SPATIAL_MAX_SOURCE_BYTES,
    SPATIAL_MIN_DURATION_SECONDS,
} from './constants.ts';
import { filenameLooksSupported, isAllowedSpatialSourceMime } from './validate.ts';

export interface CaptureQualityInput {
    uri?: string | null;
    sizeBytes?: number | null;
    durationSeconds?: number | null;
    mimeType?: string | null;
    name?: string | null;
}

export interface CaptureQualityResult {
    valid: boolean;
    issues: string[];
    userFacingMessage: string | null;
}

export function evaluateCaptureQuality(input: CaptureQualityInput): CaptureQualityResult {
    const issues: string[] = [];

    // Empty or missing
    if (!input.uri && typeof input.sizeBytes !== 'number') {
        issues.push('No video file provided');
        return {
            valid: false,
            issues,
            userFacingMessage: 'Please record or select a walkthrough video before submitting.',
        };
    }

    // Size checks
    if (typeof input.sizeBytes === 'number') {
        if (input.sizeBytes <= 0) {
            issues.push('Video file is empty (0 bytes)');
        } else if (input.sizeBytes > SPATIAL_MAX_SOURCE_BYTES) {
            issues.push(`File exceeds the 512 MB limit (${Math.round(input.sizeBytes / (1024 * 1024))} MB)`);
        }
    }

    // Duration checks (if available from player/metadata)
    if (typeof input.durationSeconds === 'number' && input.durationSeconds > 0) {
        if (input.durationSeconds < SPATIAL_MIN_DURATION_SECONDS) {
            issues.push(`Walkthrough is too short (${Math.round(input.durationSeconds)}s). Minimum is ${SPATIAL_MIN_DURATION_SECONDS}s.`);
        } else if (input.durationSeconds > SPATIAL_HARD_STOP_DURATION_SECONDS) {
            issues.push(`Walkthrough exceeds the maximum limit (${Math.round(input.durationSeconds)}s > ${SPATIAL_HARD_STOP_DURATION_SECONDS}s).`);
        }
    }

    // MIME and format check
    const mimeOk = isAllowedSpatialSourceMime(input.mimeType);
    const nameOk = filenameLooksSupported(input.name || input.uri);
    if (!mimeOk && !nameOk && (input.mimeType || input.name)) {
        issues.push('Unsupported video format. Please upload MP4, MOV, or WEBM.');
    }

    if (issues.length > 0) {
        return {
            valid: false,
            issues,
            userFacingMessage: issues[0].includes('too short')
                ? 'We couldn\'t use this walkthrough. Try recording more slowly and include each room from several angles.'
                : issues[0],
        };
    }

    return {
        valid: true,
        issues: [],
        userFacingMessage: null,
    };
}
