/**
 * 3D / spatial media contracts.
 * mediaType remains `spatial` — it describes the asset, not the renderer.
 * Gaussian Splatting is an assetFormat, not a separate collection.
 */

export const SPATIAL_MEDIA_TYPE = 'spatial' as const;

export const SPATIAL_ASSET_FORMATS = ['gaussian_splat', 'glb', 'panorama'] as const;

export const SPATIAL_PROCESSING_STATUSES = [
    'UPLOADING',
    'PROCESSING',
    'READY',
    'FAILED',
    'ARCHIVED',
] as const;

export const SPATIAL_JOB_STATUSES = ['QUEUED', 'RUNNING', 'READY', 'FAILED', 'CANCELLED'] as const;

export const SPATIAL_PROCESSORS = ['INTERNAL', 'EXTERNAL', 'ADMIN_UPLOAD'] as const;

export const SPATIAL_CAPTURE_PROVIDERS = [
    'PHONE',
    'LIDAR',
    'EXTERNAL_CAMERA',
    'PROCESSED_UPLOAD',
] as const;

export const SPATIAL_VARIANT_KEYS = ['mobile', 'high', 'desktop'] as const;

export const SPATIAL_PROCESSING_TRANSITIONS: Record<
    (typeof SPATIAL_PROCESSING_STATUSES)[number],
    readonly (typeof SPATIAL_PROCESSING_STATUSES)[number][]
> = {
    UPLOADING: ['PROCESSING', 'FAILED', 'ARCHIVED'],
    PROCESSING: ['READY', 'FAILED', 'ARCHIVED'],
    READY: ['ARCHIVED', 'FAILED'],
    FAILED: ['PROCESSING', 'ARCHIVED'],
    ARCHIVED: [],
};

/** Application-level source upload cap. Firebase object limits are higher. */
export const SPATIAL_MAX_SOURCE_BYTES = 512 * 1024 * 1024;
export const SPATIAL_MAX_RETRIES = 3;
export const SPATIAL_METHODOLOGY_VERSION = 'v1';

export const SPATIAL_JOBS_COLLECTION = 'spatial_processing_jobs';
export const SPATIAL_SOURCE_PREFIX = 'property_spatial';
export const SPATIAL_PUBLIC_PREFIX = 'property_spatial_public';

export const SPATIAL_SOURCE_MIME_ALLOWLIST = [
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'application/zip',
    'application/octet-stream',
    'model/gltf-binary',
    'model/gltf+json',
] as const;

export const DEFAULT_SPATIAL_FORMAT = 'gaussian_splat' as const;
