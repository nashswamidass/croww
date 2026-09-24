import {
    SPATIAL_ASSET_FORMATS,
    SPATIAL_CAPTURE_PROVIDERS,
    SPATIAL_CAPTURE_TYPES,
    SPATIAL_MAX_SOURCE_BYTES,
    SPATIAL_MEDIA_TYPE,
    SPATIAL_SOURCE_MIME_ALLOWLIST,
    SPATIAL_SOURCE_PREFIX,
} from './constants.ts';
import type { SpatialAssetFormat } from './types.ts';

export function isKnownSpatialFormat(value: unknown): value is SpatialAssetFormat {
    return typeof value === 'string' && (SPATIAL_ASSET_FORMATS as readonly string[]).includes(value);
}

export function isAllowedSpatialSourceMime(mimeType: string | null | undefined): boolean {
    if (!mimeType) return false;
    const normalized = String(mimeType).split(';')[0].trim().toLowerCase();
    return (SPATIAL_SOURCE_MIME_ALLOWLIST as readonly string[]).includes(normalized);
}

export function filenameLooksSupported(name: string | null | undefined): boolean {
    if (!name) return false;
    return /\.(mp4|mov|webm|zip|glb|gltf|ply|spz|ksplat|sog|splat)$/i.test(name);
}

export function validateSpatialUpload(input: {
    mimeType?: string | null;
    sizeBytes?: number | null;
    originalName?: string | null;
    storagePath?: string | null;
}): string[] {
    const issues: string[] = [];
    if (typeof input.sizeBytes === 'number' && input.sizeBytes > SPATIAL_MAX_SOURCE_BYTES) {
        issues.push('File exceeds the 512 MB 3D source limit');
    }
    if (typeof input.sizeBytes === 'number' && input.sizeBytes <= 0) {
        issues.push('File is empty');
    }
    const mimeOk = isAllowedSpatialSourceMime(input.mimeType);
    const nameOk = filenameLooksSupported(input.originalName);
    if (!mimeOk && !nameOk) {
        issues.push('Unsupported 3D source type');
    }
    if (input.storagePath && !String(input.storagePath).startsWith(`${SPATIAL_SOURCE_PREFIX}/`)) {
        issues.push('Source assets must use private spatial storage');
    }
    if (input.storagePath && /property_media\//.test(String(input.storagePath))) {
        issues.push('3D source cannot use public listing media storage');
    }
    return issues;
}

export function validateClientSpatialCreate(input: Record<string, unknown>): string[] {
    const issues: string[] = [];
    if (input.mediaType !== SPATIAL_MEDIA_TYPE) {
        issues.push('mediaType must be spatial');
    }
    if (input.visibility === 'public') {
        issues.push('Clients cannot publish 3D media');
    }
    if (input.processingStatus === 'READY' || (input.processing as { status?: string } | undefined)?.status === 'READY') {
        issues.push('Clients cannot mark 3D media READY');
    }
    if (input.url) {
        issues.push('Clients cannot set a public 3D URL');
    }
    return issues;
}

export function isKnownCaptureProvider(value: unknown): boolean {
    return typeof value === 'string' && (SPATIAL_CAPTURE_PROVIDERS as readonly string[]).includes(value);
}

export function isKnownCaptureType(value: unknown): boolean {
    return typeof value === 'string' && (SPATIAL_CAPTURE_TYPES as readonly string[]).includes(value as any);
}

export function validateSpatialOutputs(outputs: unknown): string[] {
    const issues: string[] = [];
    if (!outputs || typeof outputs !== 'object') {
        return ['Missing processing outputs descriptor'];
    }
    const out = outputs as Record<string, any>;
    if (!out.mobile || (!out.mobile.storagePath && !out.mobile.url)) {
        issues.push('Missing mobile spatial output');
    }
    if (out.mobile && typeof out.mobile.bytes === 'number') {
        if (out.mobile.bytes <= 0) {
            issues.push('Mobile spatial output is empty');
        } else if (out.mobile.bytes > (25 * 1024 * 1024)) {
            issues.push('Mobile output exceeds 25MB budget');
        }
    }
    if (!out.desktop || (!out.desktop.storagePath && !out.desktop.url)) {
        issues.push('Missing desktop spatial output');
    }
    if (out.desktop && typeof out.desktop.bytes === 'number' && out.desktop.bytes <= 0) {
        issues.push('Desktop spatial output is empty');
    }
    if (!out.poster || (!out.poster.storagePath && !out.poster.url)) {
        issues.push('Missing poster output');
    }
    return issues;
}
