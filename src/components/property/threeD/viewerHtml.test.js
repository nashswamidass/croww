import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSpatialViewerHtml } from './viewerHtml.js';

describe('3D viewer contract', () => {
    it('does not embed Firestore or a splat decoder, and falls back without an asset', () => {
        const html = buildSpatialViewerHtml({
            assetUrl: '',
            posterUrl: 'https://example.com/poster.jpg',
            assetFormat: 'gaussian_splat',
        });
        assert.match(html, /3D tour unavailable/);
        assert.doesNotMatch(html, /firestore/i);
        assert.doesNotMatch(html, /THREE\.js|playcanvas|sparkjs/i);
        assert.match(html, /webgl/i);
    });

    it('does not claim Gaussian Splatting is rendered when an asset URL is present', () => {
        const html = buildSpatialViewerHtml({
            assetUrl: 'https://example.com/derived.spz',
            posterUrl: null,
            assetFormat: 'gaussian_splat',
        });
        assert.match(html, /not bundled/);
        assert.doesNotMatch(html, /Gaussian Splatting works/i);
    });
});
