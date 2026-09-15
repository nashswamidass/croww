import {
    SPATIAL_MAX_RETRIES,
    SPATIAL_SOURCE_PREFIX,
} from './constants.ts';
import type { SpatialProcessingStatus } from './types.ts';

export function buildSpatialSourcePath(uid: string, propertyId: string, mediaId: string, filename: string): string {
    const safe = String(filename || 'source.bin').replace(/[^\w.-]/g, '_').slice(0, 80);
    return `${SPATIAL_SOURCE_PREFIX}/${uid}/${propertyId}/source/${mediaId}/${safe}`;
}

export function buildSpatialPublicPath(mediaId: string, filename: string): string {
    const safe = String(filename || 'derived.bin').replace(/[^\w.-]/g, '_').slice(0, 80);
    return `property_spatial_public/${mediaId}/${safe}`;
}

export function nextRetryCount(current: number | null | undefined): number {
    return (typeof current === 'number' ? current : 0) + 1;
}

export function retriesRemaining(retryCount: number | null | undefined): number {
    const used = typeof retryCount === 'number' ? retryCount : 0;
    return Math.max(0, SPATIAL_MAX_RETRIES - used);
}

export function actorSpatialStatusLabel(status: SpatialProcessingStatus | string | null | undefined): string {
    if (status === 'READY') return 'Ready';
    if (status === 'PROCESSING' || status === 'UPLOADING') return 'Processing';
    if (status === 'FAILED') return 'Failed';
    if (status === 'ARCHIVED') return 'Archived';
    return 'Not uploaded';
}

export function publicSpatialErrorMessage(status: SpatialProcessingStatus | string | null | undefined): string | null {
    if (status === 'FAILED') return '3D processing failed.';
    return null;
}
