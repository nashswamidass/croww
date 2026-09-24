import type {
    SPATIAL_ASSET_FORMATS,
    SPATIAL_CAPTURE_PROVIDERS,
    SPATIAL_CAPTURE_TYPES,
    SPATIAL_JOB_STATUSES,
    SPATIAL_PROCESSING_STAGES,
    SPATIAL_PROCESSING_STATUSES,
    SPATIAL_PROCESSORS,
    SPATIAL_VARIANT_KEYS,
} from './constants.ts';

export type SpatialAssetFormat = (typeof SPATIAL_ASSET_FORMATS)[number];
export type SpatialProcessingStatus = (typeof SPATIAL_PROCESSING_STATUSES)[number];
export type SpatialJobStatus = (typeof SPATIAL_JOB_STATUSES)[number];
export type SpatialProcessor = (typeof SPATIAL_PROCESSORS)[number];
export type SpatialCaptureProvider = (typeof SPATIAL_CAPTURE_PROVIDERS)[number];
export type SpatialCaptureType = (typeof SPATIAL_CAPTURE_TYPES)[number];
export type SpatialProcessingStage = (typeof SPATIAL_PROCESSING_STAGES)[number];
export type SpatialVariantKey = (typeof SPATIAL_VARIANT_KEYS)[number];
export type TimestampLike = { toDate?: () => Date; seconds?: number } | string | Date | number | null;

export type SpatialAssetVariant = {
    key: SpatialVariantKey;
    url?: string | null;
    fileSizeBytes?: number | null;
};

export type SpatialOutputItem = {
    storagePath?: string | null;
    url?: string | null;
    format?: string | null;
    bytes?: number | null;
};

export type SpatialOutputs = {
    mobile?: SpatialOutputItem | null;
    desktop?: SpatialOutputItem | null;
    poster?: SpatialOutputItem | null;
};

/** Public-safe 3D availability. No source paths, job ids, or processor internals. */
export type PublicSpatialTour = {
    available: boolean;
    mediaId?: string | null;
    assetFormat?: SpatialAssetFormat | null;
    posterUrl?: string | null;
    assetUrl?: string | null;
    fileSizeBytes?: number | null;
    parentType?: 'property' | 'listing' | null;
    propertyId?: string | null;
    stage?: SpatialProcessingStage | null;
    outputs?: SpatialOutputs | null;
};

export type SpatialViewerDescriptor = {
    assetUrl: string | null;
    posterUrl: string | null;
    assetFormat: SpatialAssetFormat | string | null;
    fileSizeBytes?: number | null;
};

export type SpatialProcessingSlice = {
    status: SpatialProcessingStatus;
    stage?: SpatialProcessingStage | null;
    progress?: number | null;
    assetFormat?: SpatialAssetFormat | null;
    intendedFormat?: SpatialAssetFormat | null;
    processor?: SpatialProcessor | null;
    processorVersion?: string | null;
    captureProvider?: SpatialCaptureProvider | null;
    captureType?: SpatialCaptureType | null;
    sourceStoragePath?: string | null;
    derivedStoragePath?: string | null;
    assetVersion?: number | null;
    processingVersion?: string | null;
    processingStartedAt?: TimestampLike;
    processingCompletedAt?: TimestampLike;
    retryCount?: number;
    sourceDurationMs?: number | null;
    sourceFrameCount?: number | null;
    registeredFrameCount?: number | null;
    reconstructionQuality?: string | null;
    outputs?: SpatialOutputs | null;
    errorCode?: string | null;
    publicError?: string | null;
    variants?: Partial<Record<SpatialVariantKey, SpatialAssetVariant>> | null;
};

export type SpatialJobRecord = {
    id?: string;
    mediaId: string;
    propertyId: string;
    listingId?: string | null;
    submittedByUid: string;
    status: SpatialJobStatus;
    stage?: SpatialProcessingStage | null;
    progress?: number | null;
    processor: SpatialProcessor;
    processorVersion?: string | null;
    retryOf?: string | null;
    outputs?: SpatialOutputs | null;
    errorCode?: string | null;
    publicError?: string | null;
    createdAt?: TimestampLike;
};

