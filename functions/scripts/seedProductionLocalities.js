/**
 * Phase 7 — Production Locality Seed Script.
 * Target: croww-live-2026
 *
 * Seeds initial canonical locality records for Chennai and Bengaluru.
 * Strictly adheres to:
 * - Real, defensible geographic centroids & geohashes
 * - Existing recognized aliases from PropertySearchBar.js / posting.ts
 * - Zero fabricated metrics / zero fake 3D / zero fake Area Scores
 * - Evidence snapshot initialized to UNAVAILABLE / UNKNOWN
 * - Idempotent upsert
 *
 * Usage:
 *   Dry-run:
 *     node functions/scripts/seedProductionLocalities.js --project croww-live-2026 --dry-run
 *   Live:
 *     node functions/scripts/seedProductionLocalities.js --project croww-live-2026 --confirm-production
 */

const { assertProjectAllowed } = require("./projectGuard");
const { cliAccessToken, encodeMap, decodeMap } = require("./cliFirestore");

const TARGET_PROJECT = "croww-live-2026";

function encodeGeohash(latitude, longitude, precision = 9) {
    const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
    let idx = 0;
    let bit = 0;
    let evenBit = true;
    let geohash = "";
    let latMin = -90, latMax = 90;
    let lonMin = -180, lonMax = 180;

    while (geohash.length < precision) {
        if (evenBit) {
            const lonMid = (lonMin + lonMax) / 2;
            if (longitude > lonMid) {
                idx = idx * 2 + 1;
                lonMin = lonMid;
            } else {
                idx = idx * 2;
                lonMax = lonMid;
            }
        } else {
            const latMid = (latMin + latMax) / 2;
            if (latitude > latMid) {
                idx = idx * 2 + 1;
                latMin = latMid;
            } else {
                idx = idx * 2;
                latMax = latMid;
            }
        }
        evenBit = !evenBit;
        if (++bit === 5) {
            geohash += BASE32.charAt(idx);
            bit = 0;
            idx = 0;
        }
    }
    return geohash;
}

const LOCALITY_SEEDS = [
    // ------------------------------------------------------------
    // CHENNAI LAUNCH LOCALITIES
    // ------------------------------------------------------------
    {
        id: "chennai__adyar",
        name: "Adyar",
        city: "Chennai",
        state: "Tamil Nadu",
        country: "India",
        latitude: 13.0012,
        longitude: 80.2565,
        aliases: ["Adyar", "Adayar", "Adyar Chennai"],
    },
    {
        id: "chennai__omr",
        name: "OMR",
        city: "Chennai",
        state: "Tamil Nadu",
        country: "India",
        latitude: 12.8950,
        longitude: 80.2280,
        aliases: ["OMR", "Old Mahabalipuram Road", "IT Corridor", "Rajiv Gandhi Salai"],
    },
    {
        id: "chennai__anna-nagar",
        name: "Anna Nagar",
        city: "Chennai",
        state: "Tamil Nadu",
        country: "India",
        latitude: 13.0850,
        longitude: 80.2100,
        aliases: ["Anna Nagar", "Annanagar", "Anna Nagar West", "Anna Nagar East"],
    },
    {
        id: "chennai__chennai",
        name: "Chennai",
        city: "Chennai",
        state: "Tamil Nadu",
        country: "India",
        latitude: 13.0827,
        longitude: 80.2707,
        aliases: ["Chennai", "Chennai Central", "Madras"],
    },
    {
        id: "chennai__thiruvanmiyur",
        name: "Thiruvanmiyur",
        city: "Chennai",
        state: "Tamil Nadu",
        country: "India",
        latitude: 12.9830,
        longitude: 80.2594,
        aliases: ["Thiruvanmiyur", "Tiruvanmiyur", "Thiruvanmiyur Chennai"],
    },
    {
        id: "chennai__t-nagar",
        name: "T. Nagar",
        city: "Chennai",
        state: "Tamil Nadu",
        country: "India",
        latitude: 13.0418,
        longitude: 80.2341,
        aliases: ["T. Nagar", "T Nagar", "Thyagaraya Nagar", "T.Nagar", "T-Nagar"],
    },
    {
        id: "chennai__velachery",
        name: "Velachery",
        city: "Chennai",
        state: "Tamil Nadu",
        country: "India",
        latitude: 12.9750,
        longitude: 80.2200,
        aliases: ["Velachery", "Velacheri", "Velachery Chennai"],
    },
    {
        id: "chennai__thiruvottiyur",
        name: "Thiruvottiyur",
        city: "Chennai",
        state: "Tamil Nadu",
        country: "India",
        latitude: 13.1600,
        longitude: 80.3000,
        aliases: ["Thiruvottiyur", "Tiruvottiyur", "Thiruvottiyur Chennai"],
    },
    {
        id: "chennai__porur",
        name: "Porur",
        city: "Chennai",
        state: "Tamil Nadu",
        country: "India",
        latitude: 13.0350,
        longitude: 80.1580,
        aliases: ["Porur", "Porur Chennai"],
    },

    // ------------------------------------------------------------
    // BENGALURU LAUNCH LOCALITIES
    // ------------------------------------------------------------
    {
        id: "bengaluru__whitefield",
        name: "Whitefield",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
        latitude: 12.9698,
        longitude: 77.7500,
        aliases: ["Whitefield", "Whitefield Bengaluru", "Whitefield Bangalore"],
    },
    {
        id: "bengaluru__indiranagar",
        name: "Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
        latitude: 12.9784,
        longitude: 77.6408,
        aliases: ["Indiranagar", "Indira Nagar", "Indiranagar Bengaluru"],
    },
    {
        id: "bengaluru__koramangala",
        name: "Koramangala",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
        latitude: 12.9352,
        longitude: 77.6245,
        aliases: ["Koramangala", "Koramangala Bengaluru", "Koramangala Bangalore"],
    },
    {
        id: "bengaluru__bengaluru",
        name: "Bengaluru",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
        latitude: 12.9716,
        longitude: 77.5946,
        aliases: ["Bengaluru", "Bangalore", "Bengaluru Central", "MG Road"],
    },
];

async function fsIam(projectId, method, docPath, body) {
    const token = cliAccessToken();
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${docPath}`;
    const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    };
    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (_) { json = { raw: text.slice(0, 200) }; }
    return { status: res.status, ok: res.ok, json };
}

function buildCanonicalLocalityDoc(seed) {
    const geohash = encodeGeohash(seed.latitude, seed.longitude, 9);
    return {
        id: seed.id,
        name: seed.name,
        city: seed.city,
        state: seed.state,
        country: seed.country,
        aliases: seed.aliases,
        latitude: seed.latitude,
        longitude: seed.longitude,
        geohash,
        geo: {
            latitude: seed.latitude,
            longitude: seed.longitude,
        },
        bounds: null,
        status: "ACTIVE",
        source: {
            type: "admin",
            channel: "ADMIN_SEED",
            authoritative: true,
            externalId: null,
            importedAt: "2026-09-14T09:15:00.000Z",
        },
        stats: null,
        intelligence: {
            version: "1",
            methodologyVersion: "area-intelligence-v1",
            generatedAt: null,
            sourceSummary: "Initial canonical locality seed. No quantitative metrics published.",
            confidence: "UNKNOWN",
            coverage: { percent: 0, geographic: null },
            status: "UNAVAILABLE",
            domains: {
                market: { status: "UNAVAILABLE", confidence: "UNKNOWN", metrics: {} },
                transport: { status: "UNAVAILABLE", confidence: "UNKNOWN", metrics: {} },
                schools: { status: "UNAVAILABLE", confidence: "UNKNOWN", metrics: {} },
                healthcare: { status: "UNAVAILABLE", confidence: "UNKNOWN", metrics: {} },
                airport: { status: "UNAVAILABLE", confidence: "UNKNOWN", metrics: {} },
                connectivity: { status: "UNAVAILABLE", confidence: "UNKNOWN", metrics: {} },
                flood: { status: "UNAVAILABLE", confidence: "UNKNOWN", classification: "UNKNOWN", metrics: {} },
                affordability: { status: "UNAVAILABLE", confidence: "UNKNOWN", metrics: {} },
            },
            market: { status: "UNAVAILABLE", confidence: "UNKNOWN", metrics: {} },
            flood: { status: "UNAVAILABLE", confidence: "UNKNOWN", classification: "UNKNOWN", metrics: {} },
        },
        createdAt: "2026-09-14T09:15:00.000Z",
        updatedAt: "2026-09-14T09:15:00.000Z",
    };
}

async function main() {
    const isDryRun = process.argv.includes("--dry-run");
    const guard = assertProjectAllowed({ apply: !isDryRun });

    if (guard.projectId !== TARGET_PROJECT) {
        throw new Error(`Invalid target project ${guard.projectId}. This script must only target ${TARGET_PROJECT}.`);
    }

    console.log("============================================================");
    console.log(`Phase 7: Locality Seed Script`);
    console.log(`Target Project : ${guard.projectId}`);
    console.log(`Mode           : ${isDryRun ? "DRY-RUN (No writes)" : "APPLY (Confirmed Production)"}`);
    console.log(`Total Seeds    : ${LOCALITY_SEEDS.length}`);
    console.log("============================================================\n");

    // Fetch existing localities to compare
    const existingSnap = await fsIam(guard.projectId, "GET", "localities");
    const existingDocs = (existingSnap.json.documents || []).map((d) => {
        const id = d.name.split("/").pop();
        return { id, data: decodeMap(d.fields || {}) };
    });
    const existingMap = new Map(existingDocs.map((e) => [e.id, e.data]));

    console.log(`Currently existing localities in ${guard.projectId}: ${existingMap.size}\n`);

    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    const manifest = [];

    for (const seed of LOCALITY_SEEDS) {
        const canonical = buildCanonicalLocalityDoc(seed);
        const existing = existingMap.get(seed.id);
        const exists = Boolean(existing);

        const recordInfo = {
            id: seed.id,
            name: seed.name,
            city: seed.city,
            coordinates: `${seed.latitude}, ${seed.longitude}`,
            geohash: canonical.geohash,
            aliases: seed.aliases.join(", "),
            exists,
            action: exists ? "UPDATE" : "CREATE",
        };

        manifest.push(recordInfo);

        console.log(`- [${recordInfo.action}] ID: ${seed.id}`);
        console.log(`  Name: ${seed.name} (${seed.city}, ${seed.state})`);
        console.log(`  Centroid: ${seed.latitude}, ${seed.longitude} (Geohash: ${canonical.geohash})`);
        console.log(`  Aliases: ${recordInfo.aliases}`);
        console.log(`  Pre-existing: ${exists}`);

        if (isDryRun) {
            if (exists) updatedCount++;
            else createdCount++;
            console.log(`  [DRY RUN] Would write doc localities/${seed.id}\n`);
            continue;
        }

        // Live write: PATCH
        const res = await fsIam(guard.projectId, "PATCH", `localities/${seed.id}`, {
            fields: encodeMap(canonical),
        });

        if (!res.ok) {
            throw new Error(`Failed to write locality ${seed.id}: HTTP ${res.status} ${JSON.stringify(res.json)}`);
        }

        if (exists) {
            updatedCount++;
            console.log(`  [OK] Updated doc localities/${seed.id} (HTTP ${res.status})\n`);
        } else {
            createdCount++;
            console.log(`  [OK] Created doc localities/${seed.id} (HTTP ${res.status})\n`);
        }
    }

    console.log("============================================================");
    console.log("SEED SUMMARY");
    console.log("============================================================");
    console.log(`Target Project  : ${guard.projectId}`);
    console.log(`Mode            : ${isDryRun ? "DRY-RUN" : "APPLIED"}`);
    console.log(`Total Locality Seeds: ${LOCALITY_SEEDS.length}`);
    console.log(`Chennai Seeds   : ${LOCALITY_SEEDS.filter((s) => s.city === "Chennai").length}`);
    console.log(`Bengaluru Seeds : ${LOCALITY_SEEDS.filter((s) => s.city === "Bengaluru").length}`);
    console.log(`Created         : ${createdCount}`);
    console.log(`Updated         : ${updatedCount}`);
    console.log(`Unchanged       : ${unchangedCount}`);
    console.log(`Pre-existing    : ${existingMap.size}`);
    console.log("============================================================");

    return {
        mode: isDryRun ? "DRY_RUN" : "APPLIED",
        total: LOCALITY_SEEDS.length,
        created: createdCount,
        updated: updatedCount,
        manifest,
    };
}

main().catch((err) => {
    console.error("Seed execution failed:", err);
    process.exit(1);
});
