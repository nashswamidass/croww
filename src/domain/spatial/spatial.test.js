import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    adminMayFinalizeSpatial,
    buildSpatialPublicPath,
    buildSpatialSourcePath,
    canManageSpatialAsset,
    canRetrySpatial,
    canTransitionSpatialProcessing,
    clientMaySetSpatialProcessing,
    dashboardSpatialLabel,
    exploreSpatialHint,
    filenameLooksSupported,
    isAllowedSpatialSourceMime,
    isKnownSpatialFormat,
    isCurrentlyReadySpatial,
    isPrivateSourcePath,
    isPublicDerivedPath,
    pickReusablePropertyAsset,
    preferPropertyAttachment,
    publicSpatialErrorMessage,
    publicSpatialHasPrivateLeak,
    retriesRemaining,
    toPublicSpatialTour,
    toViewerDescriptor,
    validateClientSpatialCreate,
    validateSpatialUpload,
    SPATIAL_MAX_SOURCE_BYTES,
    SPATIAL_MEDIA_TYPE,
} from './index.ts';

describe('media type and asset format validation', () => {
    it('keeps spatial as the media type and validates source MIME/size', () => {
        assert.equal(SPATIAL_MEDIA_TYPE, 'spatial');
        assert.equal(isKnownSpatialFormat('gaussian_splat'), true);
        assert.equal(isKnownSpatialFormat('webgl'), false);
        assert.equal(isAllowedSpatialSourceMime('video/mp4'), true);
        assert.equal(isAllowedSpatialSourceMime('image/jpeg'), false);
        assert.equal(filenameLooksSupported('walkthrough.mp4'), true);
        const tooBig = validateSpatialUpload({
            mimeType: 'video/mp4',
            sizeBytes: SPATIAL_MAX_SOURCE_BYTES + 1,
            originalName: 'walk.mp4',
            storagePath: 'property_spatial/u1/p1/source/m1/walk.mp4',
        });
        assert.ok(tooBig.some((row) => /512/.test(row)));
        const publicPrefix = validateSpatialUpload({
            mimeType: 'video/mp4',
            sizeBytes: 12,
            originalName: 'walk.mp4',
            storagePath: 'property_media/u1/photo.jpg',
        });
        assert.ok(publicPrefix.some((row) => /cannot use public/.test(row)));
    });
});

describe('processing state transitions', () => {
    it('allows upload → process → ready/fail and blocks client READY', () => {
        assert.equal(canTransitionSpatialProcessing('UPLOADING', 'PROCESSING'), true);
        assert.equal(canTransitionSpatialProcessing('PROCESSING', 'READY'), true);
        assert.equal(canTransitionSpatialProcessing('FAILED', 'PROCESSING'), true);
        assert.equal(canTransitionSpatialProcessing('ARCHIVED', 'READY'), false);
        assert.equal(clientMaySetSpatialProcessing('PROCESSING', 'READY'), false);
        assert.equal(clientMaySetSpatialProcessing('FAILED', 'PROCESSING'), true);
        assert.equal(adminMayFinalizeSpatial('PROCESSING', 'READY'), true);
        assert.equal(adminMayFinalizeSpatial('UPLOADING', 'READY'), false);
    });
});

describe('public visibility and ready-only projection', () => {
    it('exposes public tours only when READY, public, and url is set', () => {
        const processing = {
            id: 'm1',
            mediaType: 'spatial',
            status: 'ACTIVE',
            visibility: 'private',
            processingStatus: 'PROCESSING',
            url: null,
            processing: { status: 'PROCESSING', sourceStoragePath: 'property_spatial/u1/secret' },
        };
        assert.equal(isCurrentlyReadySpatial(processing), false);
        assert.equal(toPublicSpatialTour(processing).available, false);

        const ready = {
            id: 'm1',
            mediaType: 'spatial',
            status: 'ACTIVE',
            visibility: 'public',
            url: 'https://cdn.example/derived.spz',
            thumbnailUrl: 'https://cdn.example/poster.jpg',
            sizeBytes: 1200,
            parentType: 'property',
            propertyId: 'p1',
            processing: { status: 'READY', assetFormat: 'gaussian_splat' },
        };
        const tour = toPublicSpatialTour(ready);
        assert.equal(tour.available, true);
        assert.equal(tour.assetUrl, ready.url);
        assert.equal(publicSpatialHasPrivateLeak(tour), false);
        assert.ok(toViewerDescriptor(tour)?.assetUrl);
        assert.equal(toViewerDescriptor({ available: false }), null);
    });
});

describe('authorization, attachment, and reuse', () => {
    it('lets owners and listers manage their assets and prefers property attachment', () => {
        const actor = { uid: 'u1' };
        assert.equal(canManageSpatialAsset(actor, { property: { id: 'p1', ownerUid: 'u1' } }), true);
        assert.equal(canManageSpatialAsset(actor, { listing: { id: 'l1', listedByUid: 'u1' } }), true);
        assert.equal(canManageSpatialAsset(actor, { property: { id: 'p1', ownerUid: 'other' } }), false);
        assert.equal(preferPropertyAttachment({ propertyId: 'p1' }), 'property');
        assert.equal(preferPropertyAttachment(null, 'p1'), 'property');
        assert.equal(preferPropertyAttachment(null), 'listing');
        const reused = pickReusablePropertyAsset([
            {
                id: 'm1',
                mediaType: 'spatial',
                status: 'ACTIVE',
                visibility: 'public',
                url: 'https://cdn.example/a.spz',
                parentType: 'property',
                propertyId: 'p1',
                processing: { status: 'READY' },
            },
        ], 'p1');
        assert.equal(reused?.id, 'm1');
        assert.equal(pickReusablePropertyAsset([], 'p1'), null);
    });
});

describe('archive, retry, private source, and client READY', () => {
    it('archives without READY, limits retries, and keeps source private', () => {
        assert.equal(canTransitionSpatialProcessing('READY', 'ARCHIVED'), true);
        assert.equal(canRetrySpatial({ status: 'FAILED', retryCount: 0 }), true);
        assert.equal(canRetrySpatial({ status: 'FAILED', retryCount: 3 }), false);
        assert.equal(canRetrySpatial({ status: 'READY', retryCount: 0 }), false);
        assert.equal(retriesRemaining(1), 2);
        assert.equal(isPrivateSourcePath('property_spatial/u1/p1/source/m1/a.mp4'), true);
        assert.equal(isPublicDerivedPath('property_spatial_public/m1/out.spz'), true);
        assert.equal(isPrivateSourcePath('property_media/u1/a.jpg'), false);
        assert.deepEqual(
            validateClientSpatialCreate({
                mediaType: 'spatial',
                visibility: 'public',
                processingStatus: 'READY',
                url: 'https://evil.example/fake.spz',
            }).sort(),
            [
                'Clients cannot mark 3D media READY',
                'Clients cannot publish 3D media',
                'Clients cannot set a public 3D URL',
            ].sort()
        );
        assert.equal(publicSpatialErrorMessage('FAILED'), "We couldn't create this walkthrough.");
        assert.equal(publicSpatialErrorMessage('READY'), null);
        assert.match(buildSpatialSourcePath('u1', 'p1', 'm1', 'Walk Through.mp4'), /^property_spatial\/u1\/p1\/source\/m1\//);
        assert.match(buildSpatialPublicPath('m1', 'out.spz'), /^property_spatial_public\/m1\//);
        assert.equal(dashboardSpatialLabel({ spatialTourAvailable: true }), 'Spatial Walkthrough Ready');
        assert.equal(dashboardSpatialLabel({ processingStatus: 'FAILED' }), "We couldn't create this walkthrough");
        assert.equal(dashboardSpatialLabel({ processingStatus: 'PROCESSING' }), 'Creating your Spatial Walkthrough');
        assert.equal(dashboardSpatialLabel({}), 'Not uploaded');
        assert.equal(exploreSpatialHint({ spatialTourAvailable: true }), '3D');
        assert.equal(exploreSpatialHint({}), null);
    });
});

describe('capture quality and validation', () => {
    it('validates duration, file size, empty file, and format deterministically', async () => {
        const { evaluateCaptureQuality, isKnownCaptureType } = await import('./index.ts');
        
        assert.equal(isKnownCaptureType('VIDEO'), true);
        assert.equal(isKnownCaptureType('MODEL'), true);
        assert.equal(isKnownCaptureType('AUDIO'), false);

        // Empty input
        const emptyRes = evaluateCaptureQuality({});
        assert.equal(emptyRes.valid, false);

        // Too short (< 15s)
        const shortRes = evaluateCaptureQuality({
            uri: 'file:///walk.mp4',
            sizeBytes: 1024 * 1024,
            durationSeconds: 10,
            mimeType: 'video/mp4',
        });
        assert.equal(shortRes.valid, false);
        assert.match(shortRes.userFacingMessage, /recording more slowly/);

        // Exceeds hard cap (> 120s)
        const longRes = evaluateCaptureQuality({
            uri: 'file:///walk.mp4',
            sizeBytes: 1024 * 1024,
            durationSeconds: 125,
            mimeType: 'video/mp4',
        });
        assert.equal(longRes.valid, false);

        // Valid walkthrough (e.g. 45 seconds, 20 MB)
        const validRes = evaluateCaptureQuality({
            uri: 'file:///walk.mp4',
            sizeBytes: 20 * 1024 * 1024,
            durationSeconds: 45,
            mimeType: 'video/mp4',
        });
        assert.equal(validRes.valid, true);
        assert.equal(validRes.issues.length, 0);
        assert.equal(validRes.userFacingMessage, null);
    });
});
