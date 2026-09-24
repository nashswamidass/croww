import {
    SPATIAL_MEDIA_TYPE,
    SPATIAL_PUBLIC_PREFIX,
    SPATIAL_SOURCE_PREFIX,
} from './constants.ts';
import type { PublicSpatialTour, SpatialProcessingStatus, SpatialViewerDescriptor } from './types.ts';

const PRIVATE_KEYS = [
    'sourceStoragePath', 'derivedStoragePath', 'processor', 'processorVersion',
    'jobId', 'gpu', 'stack', 'logs', 'errorPrivate', 'captureProvider',
    'workerUrl', 'credentials', 'internalReason', 'secret',
];

export function isCurrentlyReadySpatial(
    row: Record<string, unknown> | null | undefined
): row is Record<string, unknown> {
    if (!row) return false;
    if (row.mediaType !== SPATIAL_MEDIA_TYPE) return false;
    if (row.status !== 'ACTIVE') return false;
    if (row.visibility !== 'public') return false;
    const processing = spatialProcessingOf(row);
    return processing === 'READY' && typeof row.url === 'string' && Boolean(row.url);
}

export function spatialProcessingOf(row: Record<string, unknown> | null | undefined): SpatialProcessingStatus {
    const slice = row?.processing;
    if (slice && typeof slice === 'object' && typeof (slice as { status?: string }).status === 'string') {
        return (slice as { status: SpatialProcessingStatus }).status;
    }
    if (typeof row?.processingStatus === 'string') return row.processingStatus as SpatialProcessingStatus;
    return 'UPLOADING';
}

export function toPublicSpatialTour(
    row: Record<string, unknown> | null | undefined,
    fallbackPoster: string | null = null
): PublicSpatialTour {
    if (!isCurrentlyReadySpatial(row)) {
        return { available: false };
    }
    const processing = (row?.processing && typeof row.processing === 'object')
        ? row.processing as Record<string, unknown>
        : {};
    return {
        available: true,
        mediaId: (row.id as string) || null,
        assetFormat: (processing.assetFormat as PublicSpatialTour['assetFormat']) || 'gaussian_splat',
        posterUrl: (row.thumbnailUrl as string) || fallbackPoster,
        assetUrl: (row.url as string) || null,
        fileSizeBytes: typeof row.sizeBytes === 'number' ? row.sizeBytes : null,
        parentType: (row.parentType as 'property' | 'listing') || null,
        propertyId: (row.propertyId as string) || null,
    };
}

export function toViewerDescriptor(tour: PublicSpatialTour | null | undefined): SpatialViewerDescriptor | null {
    if (!tour?.available || !tour.assetUrl) return null;
    return {
        assetUrl: tour.assetUrl,
        posterUrl: tour.posterUrl || null,
        assetFormat: tour.assetFormat || 'gaussian_splat',
        fileSizeBytes: tour.fileSizeBytes || null,
    };
}

export function publicSpatialHasPrivateLeak(value: Record<string, unknown> | null | undefined): boolean {
    if (!value) return false;
    const blob = JSON.stringify(value).toLowerCase();
    return PRIVATE_KEYS.some((key) => blob.includes(key.toLowerCase()));
}

export function dashboardSpatialLabel(row: {
    spatialTourAvailable?: boolean | null;
    processingStatus?: string | null;
} | null | undefined): string {
    if (row?.spatialTourAvailable) return 'Spatial Walkthrough Ready';
    const status = row?.processingStatus;
    if (status === 'PROCESSING' || status === 'UPLOADING') return 'Creating your Spatial Walkthrough';
    if (status === 'FAILED') return "We couldn't create this walkthrough";
    return 'Not uploaded';
}

export function pickReusablePropertyAsset(
    rows: (Record<string, unknown> | null | undefined)[],
    propertyId: string
): Record<string, unknown> | null {
    const ready = (rows || []).filter((row) => (
        row
        && row.propertyId === propertyId
        && row.parentType === 'property'
        && isCurrentlyReadySpatial(row)
    ));
    return ready[0] || null;
}

export function isPrivateSourcePath(path: string | null | undefined): boolean {
    return typeof path === 'string' && path.startsWith(`${SPATIAL_SOURCE_PREFIX}/`);
}

export function isPublicDerivedPath(path: string | null | undefined): boolean {
    return typeof path === 'string' && path.startsWith(`${SPATIAL_PUBLIC_PREFIX}/`);
}

export function exploreSpatialHint(listing: { spatialTourAvailable?: boolean | null } | null | undefined): string | null {
    return listing?.spatialTourAvailable ? '3D' : null;
}
