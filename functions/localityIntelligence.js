const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAdmin } = require("./httpAuth");
const { computeMarketDomain, affordabilityFromMarket } = require("./localityMarketMath");

const MARKET_SERVER_QUERY_LIMIT = 250;

function db() {
    return admin.firestore();
}

/**
 * Admin-only. Writes Croww-derived market metrics onto localities/{id}.intelligence.
 * Bounded query — does not scan all listings. Does not invent flood/schools/metro.
 * Not called from the consumer LocalityScreen. Not deployed by this change.
 */
exports.recomputeLocalityMarket = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const decoded = await requireAdmin(request, response);
        if (!decoded) return;
        const localityId = request.body?.localityId;
        if (!localityId || typeof localityId !== "string") {
            response.status(400).send({ error: "INVALID_LOCALITY", message: "localityId required" });
            return;
        }
        const localityRef = db().collection("localities").doc(localityId);
        const localitySnap = await localityRef.get();
        if (!localitySnap.exists) {
            response.status(404).send({ error: "LOCALITY_NOT_FOUND", message: "Locality not found" });
            return;
        }
        const listingSnap = await db().collection("listings")
            .where("localityId", "==", localityId)
            .where("status", "==", "PUBLISHED")
            .orderBy("publishedAt", "desc")
            .limit(MARKET_SERVER_QUERY_LIMIT)
            .get();
        const capped = listingSnap.size >= MARKET_SERVER_QUERY_LIMIT;
        const listings = listingSnap.docs.map((doc) => doc.data());
        const market = computeMarketDomain(listings, { computedAt: Date.now(), capped });
        const affordability = affordabilityFromMarket(market);
        const existing = localitySnap.data().intelligence && typeof localitySnap.data().intelligence === "object"
            ? localitySnap.data().intelligence
            : {};
        const domains = { ...(existing.domains || {}) };
        domains.market = market;
        domains.affordability = affordability;
        if (domains.flood && domains.flood.classification === "LOW" && !domains.flood.sourceClass) {
            delete domains.flood;
        }
        await localityRef.update({
            intelligence: {
                version: existing.version || "1",
                methodologyVersion: "area-intelligence-v1",
                generatedAt: admin.firestore.FieldValue.serverTimestamp(),
                sourceSummary: capped
                    ? `Croww-derived market metrics from up to ${MARKET_SERVER_QUERY_LIMIT} published listings (query cap). Other domains unchanged.`
                    : "Croww-derived market metrics from published listings. Other domains unchanged.",
                domains,
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.info("recomputeLocalityMarket", { localityId, listingCount: listings.length, capped, adminUid: decoded.uid });
        response.status(200).send({
            ok: true,
            localityId,
            listingCount: listings.length,
            capped,
            marketStatus: market.status,
        });
    } catch (error) {
        logger.error("recomputeLocalityMarket failed", error);
        response.status(500).send({ error: "INTERNAL", message: "Could not recompute locality market" });
    }
});
