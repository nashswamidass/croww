import { SPATIAL_PROCESSING_TRANSITIONS } from './constants.ts';
import type { SpatialProcessingStatus } from './types.ts';

export function canTransitionSpatialProcessing(
    from: SpatialProcessingStatus | string,
    to: SpatialProcessingStatus | string
): boolean {
    return (SPATIAL_PROCESSING_TRANSITIONS[from as SpatialProcessingStatus] || []).includes(
        to as SpatialProcessingStatus
    );
}

/** Clients may start upload/processing or archive. They never write READY. */
export function clientMaySetSpatialProcessing(
    fromStatus: SpatialProcessingStatus | string | null | undefined,
    toStatus: SpatialProcessingStatus | string
): boolean {
    if (toStatus === 'READY') return false;
    const from = fromStatus || 'UPLOADING';
    return canTransitionSpatialProcessing(from, toStatus);
}

export function adminMayFinalizeSpatial(
    fromStatus: SpatialProcessingStatus | string | null | undefined,
    decision: 'READY' | 'FAILED'
): boolean {
    const from = fromStatus || 'UPLOADING';
    return canTransitionSpatialProcessing(from, decision);
}

export function canRetrySpatial(input: {
    status?: SpatialProcessingStatus | string | null;
    retryCount?: number | null;
    maxRetries?: number;
}): boolean {
    if (input.status !== 'FAILED') return false;
    const count = typeof input.retryCount === 'number' ? input.retryCount : 0;
    const max = input.maxRetries ?? 3;
    return count < max;
}
