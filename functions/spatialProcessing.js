/**
 * Spatial / 3D processing boundary.
 * Does not run Gaussian Splatting. GPU work is a future external processor.
 * Only admin/server may mark READY.
 */
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireAdmin, requireAuth, isAdminUid } = require("./httpAuth");

const MEDIA = "property_media";
const JOBS = "spatial_processing_jobs";

function processingOf(row) {
    return row?.processing?.status || row?.processingStatus || "UPLOADING";
}

async function setPropertyTourFlag(db, propertyId, available) {
    if (!propertyId) return;
    await db.collection("properties").doc(propertyId).set({
        spatialTourAvailable: Boolean(available),
    }, { merge: true });
    const listings = await db.collection("listings").where("propertyId", "==", propertyId).limit(40).get();
    await Promise.all(listings.docs.map((docSnap) => docSnap.ref.set({
        spatialTourAvailable: Boolean(available),
    }, { merge: true })));
}

exports.onSpatialJobCreated = onDocumentCreated(`${JOBS}/{jobId}`, async (event) => {
    const data = event.data?.data();
    if (!data || data.status !== "QUEUED") return;
    logger.info("[spatial] processing job queued; GPU processor is not configured", {
        jobId: event.params.jobId,
        mediaId: data.mediaId,
    });
});

exports.finalizeSpatialAsset = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const decoded = await requireAdmin(request, response);
        if (!decoded) return;

        const { mediaId, decision, derivedUrl, posterUrl, assetFormat, reason } = request.body || {};
        if (!mediaId || (decision !== "READY" && decision !== "FAILED")) {
            response.status(400).send({ error: "INVALID_ARGUMENT", message: "mediaId and decision are required" });
            return;
        }

        const db = admin.firestore();
        const ref = db.collection(MEDIA).doc(String(mediaId));
        const snap = await ref.get();
        if (!snap.exists) {
            response.status(404).send({ error: "NOT_FOUND", message: "3D media not found" });
            return;
        }
        const row = snap.data() || {};
        if (row.mediaType !== "spatial") {
            response.status(409).send({ error: "INVALID_MEDIA", message: "Not a spatial asset" });
            return;
        }
        const from = processingOf(row);
        if (decision === "READY" && from !== "PROCESSING") {
            response.status(409).send({ error: "INVALID_STATUS_TRANSITION", message: `Cannot mark READY from ${from}` });
            return;
        }
        if (decision === "READY" && !derivedUrl) {
            response.status(400).send({ error: "INVALID_ARGUMENT", message: "derivedUrl is required to mark READY" });
            return;
        }

        if (decision === "FAILED") {
            await ref.update({
                processingStatus: "FAILED",
                visibility: "private",
                url: null,
                "processing.status": "FAILED",
                "processing.publicError": "3D processing failed.",
                "processing.processingCompletedAt": FieldValue.serverTimestamp(),
                "processing.internalReason": reason || null,
            });
            await setPropertyTourFlag(db, row.propertyId, false);
            await db.collection(JOBS).add({
                mediaId,
                propertyId: row.propertyId || null,
                submittedByUid: decoded.uid,
                status: "FAILED",
                processor: "ADMIN_UPLOAD",
                publicError: "3D processing failed.",
                createdAt: FieldValue.serverTimestamp(),
            });
            response.status(200).send({ ok: true, mediaId, status: "FAILED" });
            return;
        }

        await ref.update({
            processingStatus: "READY",
            visibility: "public",
            url: String(derivedUrl),
            thumbnailUrl: posterUrl || row.thumbnailUrl || null,
            "processing.status": "READY",
            "processing.assetFormat": assetFormat || row.processing?.assetFormat || "gaussian_splat",
            "processing.derivedStoragePath": String(derivedUrl),
            "processing.processor": "ADMIN_UPLOAD",
            "processing.processingCompletedAt": FieldValue.serverTimestamp(),
            "processing.publicError": null,
        });
        await setPropertyTourFlag(db, row.propertyId, true);
        response.status(200).send({ ok: true, mediaId, status: "READY" });
    } catch (error) {
        logger.error("[spatial] finalize failed", error);
        response.status(500).send({ error: "INTERNAL", message: "Finalize failed" });
    }
});

exports.archiveSpatialAsset = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const decoded = await requireAuth(request, response);
        if (!decoded) return;
        const { mediaId } = request.body || {};
        if (!mediaId) {
            response.status(400).send({ error: "INVALID_ARGUMENT", message: "mediaId is required" });
            return;
        }
        const db = admin.firestore();
        const ref = db.collection(MEDIA).doc(String(mediaId));
        const snap = await ref.get();
        if (!snap.exists) {
            response.status(404).send({ error: "NOT_FOUND", message: "3D media not found" });
            return;
        }
        const row = snap.data() || {};
        const adminUser = await isAdminUid(decoded.uid);
        let listingListedBy = null;
        let propertyOwner = null;
        let propertyCreator = null;
        if (row.listingId) {
            const listingSnap = await db.collection("listings").doc(String(row.listingId)).get();
            listingListedBy = listingSnap.exists ? listingSnap.data()?.listedByUid : null;
        }
        if (row.propertyId) {
            const propertySnap = await db.collection("properties").doc(String(row.propertyId)).get();
            if (propertySnap.exists) {
                propertyOwner = propertySnap.data()?.ownerUid || null;
                propertyCreator = propertySnap.data()?.createdByUid || null;
            }
        }
        const canManage = row.createdByUid === decoded.uid
            || listingListedBy === decoded.uid
            || propertyOwner === decoded.uid
            || propertyCreator === decoded.uid;
        if (!canManage && !adminUser) {
            response.status(403).send({ error: "FORBIDDEN", message: "Not allowed to archive this 3D asset" });
            return;
        }
        await ref.update({
            status: "HIDDEN",
            visibility: "private",
            processingStatus: "ARCHIVED",
            url: null,
            "processing.status": "ARCHIVED",
        });
        const remaining = await db.collection(MEDIA)
            .where("propertyId", "==", row.propertyId || "__none__")
            .where("mediaType", "==", "spatial")
            .where("visibility", "==", "public")
            .where("status", "==", "ACTIVE")
            .limit(5)
            .get();
        const stillReady = remaining.docs.some((docSnap) => docSnap.data().processingStatus === "READY");
        await setPropertyTourFlag(db, row.propertyId, stillReady);
        response.status(200).send({ ok: true, mediaId, status: "ARCHIVED" });
    } catch (error) {
        logger.error("[spatial] archive failed", error);
        response.status(500).send({ error: "INTERNAL", message: "Archive failed" });
    }
});
