/**
 * matchLocalities — annotates import rows with match status against the
 * canonical locality catalog and verified map geometry.
 *
 * Match strategy (in order):
 * 1. Exact canonical locality ID / name (case-insensitive, trimmed)
 * 2. Existing canonical alias in catalog (locality.aliases[])
 * 3. Normalized name (strip non-alphanumeric, lowercase)
 * 4. Configured spelling/abbreviation alias & slash/parenthesis sub-variants
 * 5. Geographic catalog resolution via CHENNAI_LOCALITY_CATALOGUE
 * 6. Manual review required
 *
 * Status values:
 * MATCHED   — exact unambiguous match with existing active locality
 * ALIASED   — matched via known alias or spelling variant with existing locality
 * NEW       — high-confidence new locality resolved from canonical catalogue (ready to create)
 * AMBIGUOUS — multiple distinct localities match the same name
 * DUPLICATE — same canonical locality already appeared earlier in the import
 * REVIEW_REQUIRED — unresolved or ambiguous area requiring admin review
 */

import { VERIFIED_LOCALITY_BOUNDARIES } from '../intelligence/localityBoundaries.js';
import { CHENNAI_LOCALITY_CATALOGUE } from '../intelligence/chennaiLocalityCatalogue.js';

function normalizeForMatch(str) {
    return String(str || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '');
}

/**
 * Build index for catalog lookups.
 */
function buildIndex(localities) {
    const index = new Map();
    const addToIndex = (key, locality) => {
        const k = normalizeForMatch(key);
        if (!k) return;
        if (!index.has(k)) index.set(k, []);
        const existing = index.get(k);
        if (!existing.find((l) => l.id === locality.id)) {
            existing.push(locality);
        }
    };

    localities.forEach((loc) => {
        addToIndex(loc.name, loc);
        (loc.aliases || []).forEach((alias) => addToIndex(alias, loc));
        if (loc.id && loc.id.includes('__')) {
            const shortSlug = loc.id.split('__')[1].replace(/-/g, ' ');
            addToIndex(shortSlug, loc);
            addToIndex(loc.id, loc);
        }
        if (loc.rawName) {
            addToIndex(loc.rawName, loc);
        }
    });

    return index;
}

/**
 * Resolves a name against an index with sub-variant splitting.
 */
function lookupName(rawName, index) {
    const key = normalizeForMatch(rawName);
    let matches = index.get(key) || [];

    if (matches.length === 0 && rawName && (rawName.includes('/') || rawName.includes('(') || rawName.includes(','))) {
        const parts = rawName
            .split(/[/,(]/)
            .map((p) => p.replace(/[)]/g, '').trim())
            .filter(Boolean);
        for (const part of parts) {
            const subMatches = index.get(normalizeForMatch(part)) || [];
            if (subMatches.length > 0) {
                matches = subMatches;
                break;
            }
        }
    }

    // Deduplicate by ID
    return matches.filter(
        (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i
    );
}

/**
 * @param {import('./types.ts').ImportRow[]} rows
 * @param {Array<{ id: string; name: string; aliases?: string[]; city?: string; latitude?: number; longitude?: number; boundaryGeoJSON?: any; boundary?: any }>} canonicalLocalities
 * @returns {import('./types.ts').ImportRow[]}
 */
export function matchLocalities(rows, canonicalLocalities = []) {
    // 1. Build lookup for existing active canonical localities in Firestore
    const existingIndex = buildIndex(canonicalLocalities);

    // 2. Build lookup for comprehensive Chennai canonical catalogue
    const catalogueList = Object.values(CHENNAI_LOCALITY_CATALOGUE || {});
    const catalogueIndex = buildIndex(catalogueList);

    // Track which locality IDs have been matched already in this import (for DUPLICATE detection)
    const seenLocalityIds = new Map(); // localityId → first rowIndex that matched it

    return rows.map((row) => {
        // Step A: Check against existing active localities
        const existingMatches = lookupName(row.rawName, existingIndex);

        if (existingMatches.length > 1) {
            return {
                ...row,
                matchStatus: 'AMBIGUOUS',
                matchedLocalityId: null,
                ambiguousMatches: existingMatches.map((m) => m.id),
                hasGeometry: false,
                geometryType: 'None',
                geometryStatus: 'REVIEW_REQUIRED',
                boundarySource: 'None',
            };
        }

        if (existingMatches.length === 1) {
            const matchedLocality = existingMatches[0];
            const matchedId = matchedLocality.id;

            // Map geometry resolution
            const idKey = (matchedId || '').toLowerCase().replace(/-/g, '_');
            const nameKey = (matchedLocality.name || '').toLowerCase().replace(/\s+/g, '_');
            const verifiedGeo = (VERIFIED_LOCALITY_BOUNDARIES && (
                VERIFIED_LOCALITY_BOUNDARIES[matchedId] ||
                VERIFIED_LOCALITY_BOUNDARIES[idKey] ||
                VERIFIED_LOCALITY_BOUNDARIES[nameKey]
            )) || matchedLocality.boundaryGeoJSON || matchedLocality.boundary || null;

            const hasGeometry = Boolean(verifiedGeo && verifiedGeo.coordinates);
            let geometryType = 'POINT';
            let geometryStatus = 'POINT_ONLY';
            let boundarySource = 'Chennai Municipal Survey Centroid';

            if (hasGeometry) {
                geometryType = verifiedGeo.type || 'Polygon';
                geometryStatus = geometryType === 'MultiPolygon' ? 'MULTIPOLYGON' : 'POLYGON';
                boundarySource = 'GCC Municipal Spatial Dataset (localityBoundaries.js)';
            } else if (matchedLocality.latitude && matchedLocality.longitude) {
                geometryType = 'POINT';
                geometryStatus = 'POINT_ONLY';
                boundarySource = 'Chennai Municipal Survey Centroid';
            } else {
                geometryType = 'None';
                geometryStatus = 'UNAVAILABLE';
                boundarySource = 'None';
            }

            // Exact vs Aliased
            const isExact = normalizeForMatch(row.rawName) === normalizeForMatch(matchedLocality.name) ||
                            normalizeForMatch(row.rawName) === normalizeForMatch(matchedLocality.id);
            const matchStatus = isExact ? 'MATCHED' : 'ALIASED';

            if (seenLocalityIds.has(matchedId)) {
                return {
                    ...row,
                    matchStatus: 'DUPLICATE',
                    matchedLocalityId: matchedId,
                    canonicalName: matchedLocality.name,
                    duplicateOfRow: seenLocalityIds.get(matchedId),
                    hasGeometry,
                    geometryType,
                    geometryStatus,
                    boundarySource,
                    latitude: matchedLocality.latitude,
                    longitude: matchedLocality.longitude,
                };
            }

            seenLocalityIds.set(matchedId, row.rowIndex);
            return {
                ...row,
                matchStatus,
                matchedLocalityId: matchedId,
                canonicalName: matchedLocality.name,
                hasGeometry,
                geometryType,
                geometryStatus,
                boundarySource,
                latitude: matchedLocality.latitude,
                longitude: matchedLocality.longitude,
            };
        }

        // Step B: Not yet in active Firestore localities -> check canonical catalogue
        const catalogueMatches = lookupName(row.rawName, catalogueIndex);

        if (catalogueMatches.length === 1) {
            const catLoc = catalogueMatches[0];
            const hasGeometry = Boolean(catLoc.latitude && catLoc.longitude);
            const verified = catLoc.boundaryStatus === 'VERIFIED';
            const geometryStatus = verified
                ? (catLoc.geometryType === 'MultiPolygon' ? 'MULTIPOLYGON' : 'POLYGON')
                : 'POINT_ONLY';

            return {
                ...row,
                matchStatus: 'NEW',
                matchedLocalityId: null,
                suggestedLocalityId: catLoc.id,
                suggestedName: catLoc.name,
                canonicalName: catLoc.name,
                confidence: 'HIGH',
                hasGeometry,
                geometryType: catLoc.geometryType || 'POINT',
                geometryStatus,
                boundarySource: catLoc.boundarySource,
                latitude: catLoc.latitude,
                longitude: catLoc.longitude,
                region: catLoc.region,
                aliases: catLoc.aliases,
            };
        }

        if (catalogueMatches.length > 1) {
            return {
                ...row,
                matchStatus: 'AMBIGUOUS',
                matchedLocalityId: null,
                confidence: 'LOW',
                ambiguousMatches: catalogueMatches.map((m) => m.id),
                hasGeometry: false,
                geometryType: 'None',
                geometryStatus: 'REVIEW_REQUIRED',
                boundarySource: 'None',
            };
        }

        // Step C: Completely unknown -> REVIEW_REQUIRED
        return {
            ...row,
            matchStatus: 'REVIEW_REQUIRED',
            matchedLocalityId: null,
            confidence: 'LOW',
            hasGeometry: false,
            geometryType: 'None',
            geometryStatus: 'REVIEW_REQUIRED',
            boundarySource: 'None',
        };
    });
}
