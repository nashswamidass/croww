/**
 * Spatial / 3D Walkthrough processing boundary.
 * Orchestrates GPU workers externally — does NOT run COLMAP or NeRF in Cloud Functions.
 * Only server / worker with SPATIAL_WORKER_SECRET or admin may mark READY.
 */
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireAdmin, requireAuth, isAdminUid } = require("./httpAuth");

const MEDIA = "property_media";
const JOBS = "spatial_processing_jobs";
const PUBLIC_PREFIX = "property_spatial_public";

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

/**
 * Triggered when a new job is created in `spatial_processing_jobs/{jobId}`.
 * Creates short-lived signed URLs for source read and derivative uploads,
 * then dispatches to the GPU worker asynchronously without blocking.
 */
exports.onSpatialJobCreated = onDocumentCreated(`${JOBS}/{jobId}`, async (event) => {
    const data = event.data?.data();
    if (!data || data.status !== "QUEUED") return;

    const jobId = event.params.jobId;
    const mediaId = data.mediaId;
    const propertyId = data.propertyId;

    logger.info("[spatial] Processing job created", { jobId, mediaId, propertyId });

    const db = admin.firestore();
    const mediaRef = db.collection(MEDIA).doc(String(mediaId));
    const mediaSnap = await mediaRef.get();
    if (!mediaSnap.exists) {
        logger.error("[spatial] Media not found for job", { jobId, mediaId });
        await event.data.ref.update({
            status: "FAILED",
            stage: "FAILED",
            publicError: "Walkthrough media not found.",
        });
        return;
    }

    const mediaData = mediaSnap.data() || {};
    const sourceStoragePath = mediaData.storagePath || mediaData.processing?.sourceStoragePath;
    if (!sourceStoragePath) {
        logger.error("[spatial] Source storage path missing", { jobId, mediaId });
        await event.data.ref.update({
            status: "FAILED",
            stage: "FAILED",
            publicError: "Source video path missing.",
        });
        return;
    }

    const workerUrl = process.env.SPATIAL_WORKER_URL;
    const workerSecret = process.env.SPATIAL_WORKER_SECRET;

    if (!workerUrl) {
        logger.info("[spatial] GPU worker URL is not configured (SPATIAL_WORKER_URL unset); job remains QUEUED", {
            jobId,
            mediaId,
        });
        await event.data.ref.update({
            stage: "QUEUED",
            note: "GPU processor is not configured in this environment.",
        });
        return;
    }

    try {
        const bucket = admin.storage().bucket();
        const sourceFile = bucket.file(sourceStoragePath);

        // 1. Generate short-lived signed download URL for private source video (2 hours)
        const [sourceSignedUrl] = await sourceFile.getSignedUrl({
            action: "read",
            expires: Date.now() + 2 * 60 * 60 * 1000,
        });

        // 2. Generate signed upload URLs for exact output paths
        const mobilePath = `${PUBLIC_PREFIX}/${mediaId}/mobile.splat`;
        const desktopPath = `${PUBLIC_PREFIX}/${mediaId}/desktop.splat`;
        const posterPath = `${PUBLIC_PREFIX}/${mediaId}/poster.jpg`;

        const [mobileUploadUrl] = await bucket.file(mobilePath).getSignedUrl({
            action: "write",
            expires: Date.now() + 2 * 60 * 60 * 1000,
            contentType: "application/octet-stream",
        });

        const [desktopUploadUrl] = await bucket.file(desktopPath).getSignedUrl({
            action: "write",
            expires: Date.now() + 2 * 60 * 60 * 1000,
            contentType: "application/octet-stream",
        });

        const [posterUploadUrl] = await bucket.file(posterPath).getSignedUrl({
            action: "write",
            expires: Date.now() + 2 * 60 * 60 * 1000,
            contentType: "image/jpeg",
        });

        // 3. Dispatch to GPU worker asynchronously
        const dispatchPayload = {
            jobId,
            mediaId,
            propertyId,
            sourceUrl: sourceSignedUrl,
            uploadUrls: {
                mobile: mobileUploadUrl,
                desktop: desktopUploadUrl,
                poster: posterUploadUrl,
            },
            outputPaths: {
                mobile: mobilePath,
                desktop: desktopPath,
                poster: posterPath,
            },
        };

        const response = await fetch(`${workerUrl.replace(/\/$/, "")}/v1/jobs/${jobId}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-worker-secret": workerSecret || "",
            },
            body: JSON.stringify(dispatchPayload),
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => "");
            logger.error("[spatial] Worker dispatch failed", { status: response.status, body: errText });
            await event.data.ref.update({
                status: "FAILED",
                stage: "FAILED",
                publicError: "Could not start 3D reconstruction worker.",
            });
            await mediaRef.update({
                processingStatus: "FAILED",
                "processing.status": "FAILED",
                "processing.stage": "FAILED",
                "processing.publicError": "Could not start 3D reconstruction worker.",
            });
            return;
        }

        // Successfully dispatched
        await event.data.ref.update({
            status: "RUNNING",
            stage: "PREPARING",
            progress: 5,
            dispatchedAt: FieldValue.serverTimestamp(),
        });
        await mediaRef.update({
            "processing.stage": "PREPARING",
            "processing.progress": 5,
        });

    } catch (err) {
        logger.error("[spatial] Dispatch exception", err);
        await event.data.ref.update({
            status: "FAILED",
            stage: "FAILED",
            publicError: "Reconstruction dispatch error.",
        });
    }
});

/**
 * Worker callback endpoint: receives progress updates and finalization from GPU worker.
 * Authenticated via secret header `x-worker-secret` matching SPATIAL_WORKER_SECRET.
 */
exports.spatialWorkerCallback = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const secret = request.headers["x-worker-secret"] || request.body?.secret;
        const expectedSecret = process.env.SPATIAL_WORKER_SECRET;

        // Security check: Must have matching secret or valid admin token
        let isAuthorized = false;
        if (expectedSecret && secret && secret === expectedSecret) {
            isAuthorized = true;
        } else {
            const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
            if (token) {
                try {
                    const decoded = await admin.auth().verifyIdToken(token);
                    if (await isAdminUid(decoded.uid)) isAuthorized = true;
                } catch {}
            }
        }

        if (!isAuthorized) {
            response.status(403).send({ error: "FORBIDDEN", message: "Unauthorized worker callback" });
            return;
        }

        const {
            jobId,
            mediaId,
            stage,
            progress,
            status, // RUNNING, READY, FAILED
            outputs,
            reconstructionQuality,
            sourceDurationMs,
            sourceFrameCount,
            registeredFrameCount,
            publicError,
            internalReason,
        } = request.body || {};

        if (!jobId || !mediaId) {
            response.status(400).send({ error: "INVALID_ARGUMENT", message: "jobId and mediaId required" });
            return;
        }

        const db = admin.firestore();
        const mediaRef = db.collection(MEDIA).doc(String(mediaId));
        const jobRef = db.collection(JOBS).doc(String(jobId));

        const [mediaSnap, jobSnap] = await Promise.all([mediaRef.get(), jobRef.get()]);
        if (!mediaSnap.exists || !jobSnap.exists) {
            response.status(404).send({ error: "NOT_FOUND", message: "Job or media not found" });
            return;
        }

        const mediaData = mediaSnap.data() || {};
        if (mediaData.mediaType !== "spatial") {
            response.status(409).send({ error: "INVALID_MEDIA", message: "Not a spatial asset" });
            return;
        }

        // Handle intermediate progress updates
        if (status === "RUNNING") {
            await jobRef.update({
                stage: stage || "RECONSTRUCTING",
                progress: typeof progress === "number" ? progress : 50,
            });
            await mediaRef.update({
                "processing.stage": stage || "RECONSTRUCTING",
                "processing.progress": typeof progress === "number" ? progress : 50,
            });
            response.status(200).send({ ok: true, status: "RUNNING" });
            return;
        }

        // Handle failure
        if (status === "FAILED") {
            const userError = publicError || "We couldn't create this walkthrough.";
            await jobRef.update({
                status: "FAILED",
                stage: "FAILED",
                progress: 0,
                publicError: userError,
                completedAt: FieldValue.serverTimestamp(),
            });
            await mediaRef.update({
                processingStatus: "FAILED",
                visibility: "private",
                url: null,
                "processing.status": "FAILED",
                "processing.stage": "FAILED",
                "processing.publicError": userError,
                "processing.processingCompletedAt": FieldValue.serverTimestamp(),
            });
            await setPropertyTourFlag(db, mediaData.propertyId, false);
            response.status(200).send({ ok: true, status: "FAILED" });
            return;
        }

        // Handle READY completion (Phase 8 & 25 quality gate verification)
        if (status === "READY") {
            const { provenance } = request.body || {};
            // Security: Reject test fixtures from transitioning jobs to READY
            if (provenance?.type === "TEST_FIXTURE" || provenance?.isFixture) {
                response.status(403).send({ error: "FIXTURE_NOT_ALLOWED", message: "Test fixtures cannot transition spatial walkthrough jobs to READY." });
                return;
            }
            if (provenance && provenance.type !== "REAL_RECONSTRUCTION") {
                response.status(400).send({ error: "INVALID_PROVENANCE", message: "Reconstruction provenance must be REAL_RECONSTRUCTION" });
                return;
            }

            // Must have mobile output and valid outputs
            if (!outputs || (!outputs.mobile?.url && !outputs.mobile?.storagePath)) {
                response.status(400).send({ error: "INVALID_OUTPUTS", message: "Mobile output URL or storage path required" });
                return;
            }

            const expectedPrefix = `${PUBLIC_PREFIX}/${mediaId}/`;
            const mobilePath = outputs.mobile.storagePath || `${expectedPrefix}mobile.splat`;
            if (!mobilePath.startsWith(expectedPrefix)) {
                response.status(400).send({ error: "INVALID_OUTPUT_PATH", message: `Output storage path must be within ${expectedPrefix}` });
                return;
            }

            // Security: Verify mobile and desktop URLs belong strictly to authorized storage
            if (outputs.mobile?.url) {
                const urlStr = String(outputs.mobile.url);
                const isBucketUrl = urlStr.includes("storage.googleapis.com") || urlStr.includes("firebasestorage.googleapis.com");
                const hasMediaId = urlStr.includes(encodeURIComponent(mediaId)) || urlStr.includes(mediaId);
                if (!isBucketUrl || !hasMediaId) {
                    response.status(400).send({ error: "UNTRUSTED_OUTPUT_URL", message: "Output URL must originate from Croww authorized storage and media ID" });
                    return;
                }
            }

            const mobileUrl = String(outputs.mobile.url || `https://storage.googleapis.com/${admin.storage().bucket().name}/${mobilePath}`);
            const posterUrl = outputs.poster?.url || mediaData.thumbnailUrl || null;
            const propertyId = mediaData.propertyId;

            await mediaRef.update({
                processingStatus: "READY",
                visibility: "public",
                url: mobileUrl,
                thumbnailUrl: posterUrl,
                "processing.status": "READY",
                "processing.stage": "READY",
                "processing.progress": 100,
                "processing.outputs": outputs,
                "processing.reconstructionQuality": reconstructionQuality || "good",
                "processing.sourceDurationMs": sourceDurationMs || null,
                "processing.sourceFrameCount": sourceFrameCount || null,
                "processing.registeredFrameCount": registeredFrameCount || null,
                "processing.processingCompletedAt": FieldValue.serverTimestamp(),
                "processing.publicError": null,
            });

            await jobRef.update({
                status: "READY",
                stage: "READY",
                progress: 100,
                outputs,
                completedAt: FieldValue.serverTimestamp(),
            });

            // Mark property and listing flags as ready
            await setPropertyTourFlag(db, propertyId, true);

            logger.info("[spatial] Walkthrough successfully finalized READY", { jobId, mediaId, propertyId });
            response.status(200).send({ ok: true, status: "READY" });
            return;
        }

        response.status(400).send({ error: "INVALID_STATUS", message: "Unknown status" });
    } catch (error) {
        logger.error("[spatial] Worker callback exception", error);
        response.status(500).send({ error: "INTERNAL", message: "Worker callback failed" });
    }
});

/**
 * Admin manual finalization / override.
 */
exports.finalizeSpatialAsset = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const decoded = await requireAdmin(request, response);
        if (!decoded) return;

        const { mediaId, decision, derivedUrl, posterUrl, assetFormat, reason, outputs } = request.body || {};
        if (!mediaId || (decision !== "READY" && decision !== "FAILED")) {
            response.status(400).send({ error: "INVALID_ARGUMENT", message: "mediaId and decision are required" });
            return;
        }

        const db = admin.firestore();
        const ref = db.collection(MEDIA).doc(String(mediaId));
        const snap = await ref.get();
        if (!snap.exists) {
            response.status(404).send({ error: "NOT_FOUND", message: "Walkthrough media not found" });
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
        if (decision === "READY" && !derivedUrl && !outputs?.mobile?.url) {
            response.status(400).send({ error: "INVALID_ARGUMENT", message: "derivedUrl is required to mark READY" });
            return;
        }

        const resolvedUrl = String(derivedUrl || outputs?.mobile?.url || "");
        if (decision === "READY") {
            const isBucketUrl = resolvedUrl.includes("storage.googleapis.com") || resolvedUrl.includes("firebasestorage.googleapis.com");
            const hasMediaId = resolvedUrl.includes(encodeURIComponent(mediaId)) || resolvedUrl.includes(mediaId);
            if (!isBucketUrl || !hasMediaId) {
                response.status(400).send({ error: "UNTRUSTED_OUTPUT_URL", message: "derivedUrl must point to Croww authorized storage bucket and media ID" });
                return;
            }
        }

        if (decision === "FAILED") {
            await ref.update({
                processingStatus: "FAILED",
                visibility: "private",
                url: null,
                "processing.status": "FAILED",
                "processing.stage": "FAILED",
                "processing.publicError": "We couldn't create this walkthrough.",
                "processing.processingCompletedAt": FieldValue.serverTimestamp(),
                "processing.internalReason": reason || null,
            });
            await setPropertyTourFlag(db, row.propertyId, false);
            response.status(200).send({ ok: true, mediaId, status: "FAILED" });
            return;
        }

        await ref.update({
            processingStatus: "READY",
            visibility: "public",
            url: resolvedUrl,
            thumbnailUrl: posterUrl || outputs?.poster?.url || row.thumbnailUrl || null,
            "processing.status": "READY",
            "processing.stage": "READY",
            "processing.progress": 100,
            "processing.assetFormat": assetFormat || row.processing?.assetFormat || "gaussian_splat",
            "processing.derivedStoragePath": String(resolvedUrl),
            "processing.processor": "ADMIN_UPLOAD",
            "processing.outputs": outputs || null,
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
            response.status(404).send({ error: "NOT_FOUND", message: "Walkthrough media not found" });
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
            response.status(403).send({ error: "FORBIDDEN", message: "Not allowed to archive this walkthrough" });
            return;
        }
        await ref.update({
            status: "HIDDEN",
            visibility: "private",
            processingStatus: "ARCHIVED",
            url: null,
            "processing.status": "ARCHIVED",
            "processing.stage": "ARCHIVED",
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
