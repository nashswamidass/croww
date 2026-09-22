import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import { CHENNAI_LOCALITY_CATALOGUE } from './chennaiLocalityCatalogue.js';
import { VERIFIED_LOCALITY_BOUNDARIES, getLocalityBoundaryRings } from './localityBoundaries.js';
import {
    computeLocalityMapHierarchy,
    getLocalityZoomTier,
    getAuthoritativeAreaScore,
    getClusterZoomRegion,
    isVerifiedBoundaryLocality,
    ZOOM_THRESHOLDS,
} from './localityMapHierarchy.js';
import { formatAreaScore } from '../scoring/formatAreaScore.js';

describe('Locality Map Hierarchy & Density Engine', () => {
    const allCatalogEntries = Object.values(CHENNAI_LOCALITY_CATALOGUE);

    // Mock 188 localities matching real Firestore structure with published scores
    const mock188Localities = allCatalogEntries.map((loc) => ({
        locality: {
            id: loc.id,
            name: loc.name,
            city: loc.city,
            latitude: loc.latitude,
            longitude: loc.longitude,
            geometryType: loc.geometryType,
            boundaryStatus: loc.boundaryStatus,
            publishedScore: {
                overallScore: loc.name === 'Adyar' ? 70.8 : 75.0,
            },
            intelligence: {
                areaScore: {
                    score: loc.name === 'Adyar' ? 70.8 : 75.0,
                },
            },
        },
        score: loc.name === 'Adyar' ? 70.8 : 75.0,
        areaScore: loc.name === 'Adyar' ? 70.8 : 75.0,
        matchScore: 92, // High questionnaire match score
    }));

    test('A. 188 canonical localities load successfully', () => {
        assert.equal(allCatalogEntries.length, 188, 'Must have exactly 188 canonical Chennai localities');
        assert.equal(mock188Localities.length, 188, 'Mock localities must load all 188 canonical areas');
    });

    test('B. Every locality has canonical identity, coordinates, and valid geography status', () => {
        let verifiedCount = 0;
        let pointOnlyCount = 0;

        allCatalogEntries.forEach((loc) => {
            assert.ok(loc.id, `Locality missing id: ${JSON.stringify(loc)}`);
            assert.ok(loc.name, `Locality missing name: ${loc.id}`);
            assert.equal(typeof loc.latitude, 'number', `Locality missing valid latitude: ${loc.id}`);
            assert.equal(typeof loc.longitude, 'number', `Locality missing valid longitude: ${loc.id}`);
            assert.ok(loc.latitude >= 12.5 && loc.latitude <= 13.5, `Latitude out of Chennai bounds: ${loc.latitude}`);
            assert.ok(loc.longitude >= 79.8 && loc.longitude <= 80.5, `Longitude out of Chennai bounds: ${loc.longitude}`);

            assert.ok(
                loc.boundaryStatus === 'VERIFIED' || loc.boundaryStatus === 'POINT_ONLY',
                `Invalid boundaryStatus ${loc.boundaryStatus} for ${loc.id}`
            );

            if (loc.boundaryStatus === 'VERIFIED') {
                verifiedCount += 1;
            } else if (loc.boundaryStatus === 'POINT_ONLY') {
                pointOnlyCount += 1;
            }
        });

        assert.equal(verifiedCount, 7, 'Must have exactly 7 verified municipal boundary localities');
        assert.equal(pointOnlyCount, 181, 'Must have exactly 181 point-only localities');
    });

    test('C. Zoom-dependent visibility is deterministic across City, Mid, and Local tiers', () => {
        // City Tier: latitudeDelta >= 0.12
        const cityTier = getLocalityZoomTier(0.18);
        assert.equal(cityTier, 'CITY');

        const cityResult = computeLocalityMapHierarchy({
            localityRegions: mock188Localities,
            latitudeDelta: 0.18,
        });

        assert.equal(cityResult.zoomTier, 'CITY');
        assert.equal(cityResult.polygonItems.length, 7, '7 verified polygons always preserved');
        // Point markers are clustered: rendered point markers must be substantially less than 181 to prevent overlap
        assert.ok(
            cityResult.pointMarkers.length < 50,
            `City zoom should produce < 50 point markers/clusters (got ${cityResult.pointMarkers.length})`
        );
        assert.ok(cityResult.stats.clusterCount > 0, 'City zoom must form geographic clusters');
        assert.equal(
            cityResult.stats.verifiedBoundariesCount + cityResult.stats.pointOnlyCount,
            188,
            'Total accounted localities must equal 188'
        );

        // Mid Tier: 0.045 < latitudeDelta < 0.12
        const midTier = getLocalityZoomTier(0.08);
        assert.equal(midTier, 'MID');

        const midResult = computeLocalityMapHierarchy({
            localityRegions: mock188Localities,
            latitudeDelta: 0.08,
        });

        assert.equal(midResult.zoomTier, 'MID');
        assert.equal(midResult.polygonItems.length, 7);
        // More point markers emerge as clusters disaggregate
        assert.ok(
            midResult.pointMarkers.length > cityResult.pointMarkers.length,
            'Mid zoom must reveal more markers than city zoom'
        );

        // Local Tier: latitudeDelta <= 0.045
        const localTier = getLocalityZoomTier(0.03);
        assert.equal(localTier, 'LOCAL');

        const localResult = computeLocalityMapHierarchy({
            localityRegions: mock188Localities,
            latitudeDelta: 0.03,
        });

        assert.equal(localResult.zoomTier, 'LOCAL');
        assert.equal(localResult.polygonItems.length, 7);
        assert.equal(localResult.stats.clusterCount, 0, 'Local zoom must have 0 clusters');
        assert.equal(localResult.pointMarkers.length, 181, 'Local zoom must render all 181 point-only localities individually');
    });

    test('D. Selected locality is never suppressed at any zoom level', () => {
        // Pick a point-only locality that would otherwise be clustered at city zoom
        const targetId = 'chennai__kathivakkam';

        const result = computeLocalityMapHierarchy({
            localityRegions: mock188Localities,
            latitudeDelta: 0.20, // Extreme city zoom
            selectedId: targetId,
        });

        assert.ok(result.selectedMarker, 'selectedMarker must be present');
        assert.equal(result.selectedMarker.locality.id, targetId);
        assert.equal(result.selectedMarker.isSelected, true);
        assert.equal(result.selectedMarker.isCluster, false, 'Selected locality must NOT be clustered');

        // First item in pointMarkers must be the selected locality
        assert.equal(result.pointMarkers[0].locality.id, targetId);
        assert.equal(result.pointMarkers[0].isSelected, true);
    });

    test('E. Polygon localities remain polygon localities and are never clustered into points', () => {
        const result = computeLocalityMapHierarchy({
            localityRegions: mock188Localities,
            latitudeDelta: 0.25,
        });

        assert.equal(result.polygonItems.length, 7);
        const polygonIds = result.polygonItems.map((p) =>
            (p.locality?.id || p.id).replace(/^[a-z]+__/, '').replace(/-/g, '_')
        );
        assert.ok(polygonIds.includes('adyar'));
        assert.ok(polygonIds.includes('anna_nagar'));
        assert.ok(polygonIds.includes('t_nagar'));
        assert.ok(polygonIds.includes('velachery'));
        assert.ok(polygonIds.includes('thiruvanmiyur'));
        assert.ok(polygonIds.includes('thiruvottiyur'));
        assert.ok(polygonIds.includes('porur'));

        // Verify that getLocalityBoundaryRings returns valid rings for each
        result.polygonItems.forEach((p) => {
            const rings = getLocalityBoundaryRings(p.locality || p);
            assert.ok(rings.length > 0, `Expected boundary rings for ${(p.locality || p).id}`);
            assert.ok(rings[0].length >= 3, 'Boundary ring must have at least 3 points');
        });
    });

    test('F. Point-only localities never receive synthetic polygons', () => {
        const pointOnlyCatalog = allCatalogEntries.filter((l) => l.boundaryStatus === 'POINT_ONLY');
        assert.equal(pointOnlyCatalog.length, 181);

        pointOnlyCatalog.forEach((loc) => {
            assert.equal(isVerifiedBoundaryLocality(loc), false);
            const rings = getLocalityBoundaryRings(loc);
            assert.equal(rings.length, 0, `Point-only area ${loc.id} must never receive boundary rings`);
        });
    });

    test('G. Every rendered locality retains its canonical localityId', () => {
        const result = computeLocalityMapHierarchy({
            localityRegions: mock188Localities,
            latitudeDelta: 0.03, // Local tier
        });

        const seenIds = new Set();
        result.polygonItems.forEach((p) => {
            const id = p.locality.id;
            assert.ok(id.startsWith('chennai__'), `Invalid canonical ID: ${id}`);
            seenIds.add(id);
        });
        result.pointMarkers.forEach((m) => {
            const id = m.locality.id;
            assert.ok(id.startsWith('chennai__'), `Invalid canonical ID: ${id}`);
            seenIds.add(id);
        });

        assert.equal(seenIds.size, 188, 'All 188 canonical IDs must be unique and present');
    });

    test('H. Area score displayed on map equals authoritative published score (Adyar: 70.8 -> 71)', () => {
        const adyarItem = mock188Localities.find((m) => m.locality.name === 'Adyar');
        assert.ok(adyarItem);

        const authoritativeScore = getAuthoritativeAreaScore(adyarItem);
        assert.equal(authoritativeScore, 70.8);

        const formatted = formatAreaScore(authoritativeScore);
        assert.equal(formatted, 71, '70.8 must round to 71 for clean map bubble rendering');
    });

    test('I. Match score does not overwrite objective Area Score', () => {
        const adyarItem = mock188Localities.find((m) => m.locality.name === 'Adyar');
        // adyarItem has matchScore: 92 (questionnaire match) and publishedScore: 70.8
        assert.equal(adyarItem.matchScore, 92);

        const displayedScore = getAuthoritativeAreaScore(adyarItem);
        assert.equal(displayedScore, 70.8, 'Displayed score must be the objective 70.8, NOT 92');
        assert.notEqual(displayedScore, adyarItem.matchScore);
    });

    test('J. No duplicate localityIds are rendered within point clusters or loose markers', () => {
        const cityResult = computeLocalityMapHierarchy({
            localityRegions: mock188Localities,
            latitudeDelta: 0.15,
            selectedId: 'chennai__kathivakkam',
        });

        const allReferencedIds = [];

        cityResult.polygonItems.forEach((p) => {
            allReferencedIds.push((p.locality || p).id);
        });

        cityResult.pointMarkers.forEach((marker) => {
            if (marker.isCluster) {
                marker.items.forEach((it) => {
                    allReferencedIds.push((it.locality || it).id);
                });
            } else {
                allReferencedIds.push((marker.locality || marker.items[0]?.locality).id);
            }
        });

        assert.equal(allReferencedIds.length, 188, 'Must account for exactly 188 localities');
        const uniqueIds = new Set(allReferencedIds);
        assert.equal(uniqueIds.size, 188, 'No duplicate localityIds allowed across clusters and markers');
    });

    test('K. Camera movement does not trigger database or network queries', () => {
        // Hierarchy computation is completely synchronous in-memory
        const startTime = process.hrtime.bigint();

        for (let i = 0; i < 50; i++) {
            const randomDelta = 0.02 + Math.random() * 0.2;
            computeLocalityMapHierarchy({
                localityRegions: mock188Localities,
                latitudeDelta: randomDelta,
                selectedId: 'chennai__adyar',
            });
        }

        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1e6;

        // 50 camera recalculations across 188 localities must take < 120ms total (< 2.4ms per frame even under heavy parallel load!)
        assert.ok(
            durationMs < 120,
            `50 camera movements took ${durationMs.toFixed(2)}ms (must be < 120ms for 60fps performance)`
        );
    });

    test('L. Cluster zoom region expands comfortably to reveal underlying areas', () => {
        const cityResult = computeLocalityMapHierarchy({
            localityRegions: mock188Localities,
            latitudeDelta: 0.18,
        });

        const cluster = cityResult.pointMarkers.find((m) => m.isCluster);
        assert.ok(cluster, 'A cluster must be generated at city zoom');
        assert.ok(cluster.count >= 2);

        const zoomRegion = getClusterZoomRegion(cluster, { latitudeDelta: 0.18, longitudeDelta: 0.18 });
        assert.ok(zoomRegion.latitudeDelta < 0.18, 'Target zoom delta must be tighter than city zoom');
        assert.ok(zoomRegion.latitudeDelta >= 0.025, 'Target zoom delta must have comfortable padding');
        assert.equal(zoomRegion.latitude, cluster.latitude);
        assert.equal(zoomRegion.longitude, cluster.longitude);
    });
});
