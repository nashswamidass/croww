/**
 * Read-only locality intelligence snapshot audit.
 *
 *   cd functions
 *   node scripts/auditLocalityIntelligence.js --project croww-staging-2026
 *
 * Does not fabricate missing metrics. Does not write.
 */
const { assertProjectAllowed } = require("./projectGuard");
const { listCollection } = require("./cliFirestore");

const CONFIDENCE = new Set(["UNKNOWN", "LOW", "MEDIUM", "HIGH"]);
const FLOOD = new Set(["LOW", "MODERATE", "HIGH", "UNKNOWN"]);
const FLOOD_SOURCES = new Set(["GOVERNMENT", "OFFICIAL", "OPEN_DATASET"]);

function issue(code, id, detail) {
    return { code, id, detail };
}

async function run() {
    const guard = assertProjectAllowed({ apply: false });
    const findings = [];
    const localities = await listCollection(guard.projectId, "localities");

    localities.forEach((docSnap) => {
        const row = docSnap.data || {};
        const intelligence = row.intelligence;
        if (!intelligence || typeof intelligence !== "object") {
            findings.push(issue("NO_INTELLIGENCE_SNAPSHOT", docSnap.id, null));
            return;
        }
        if (intelligence.personalScore != null || intelligence.bestAreaRank != null) {
            findings.push(issue("PERSONAL_SCORE_ON_PUBLIC_DOC", docSnap.id, null));
        }
        const flood = intelligence.flood || {};
        const classification = flood.classification || flood.metrics?.floodClassification?.value;
        if (classification && !FLOOD.has(String(classification).toUpperCase())) {
            findings.push(issue("INVALID_FLOOD_CLASS", docSnap.id, classification));
        }
        if (String(classification).toUpperCase() === "LOW") {
            const source = flood.metrics?.floodClassification?.sourceClass || flood.sourceClass;
            if (!FLOOD_SOURCES.has(source)) {
                findings.push(issue("UNSUPPORTED_FLOOD_SOURCE_FOR_LOW", docSnap.id, source || null));
            }
        }
        const market = intelligence.market || {};
        const sample = Number(market.sampleSize ?? market.metrics?.medianPricePerSqft?.sampleSize);
        if (Number.isFinite(sample) && sample > 0 && sample < 8 && market.metrics?.medianPricePerSqft?.value != null) {
            findings.push(issue("INSUFFICIENT_MARKET_SAMPLE_PUBLISHED", docSnap.id, sample));
        }
        const confidence = intelligence.confidence || market.confidence || flood.confidence;
        if (confidence && !CONFIDENCE.has(confidence)) {
            findings.push(issue("INVALID_CONFIDENCE", docSnap.id, confidence));
        }
        if (!intelligence.methodologyVersion && !flood.methodologyVersion && !market.methodologyVersion) {
            findings.push(issue("MISSING_METHODOLOGY_VERSION", docSnap.id, null));
        }
    });

    const summary = findings.reduce((acc, row) => {
        acc[row.code] = (acc[row.code] || 0) + 1;
        return acc;
    }, {});

    console.log(JSON.stringify({
        mode: "read-only",
        projectId: guard.projectId,
        processed: localities.length,
        findingCount: findings.length,
        summary,
        sample: findings.slice(0, 50),
    }, null, 2));
}

run().catch((error) => {
    console.error("audit_failed", error.message);
    process.exit(1);
});
