const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, isAdminUid } = require("./httpAuth");

function db() {
    return admin.firestore();
}

/**
 * Caller requests exact location access for a property.
 * Derives requester UID server-side from Bearer token.
 */
exports.requestLocationShare = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const decoded = await requireAuth(request, response);
        if (!decoded) return;

        const { propertyId, listingId } = request.body || {};
        if (!propertyId || typeof propertyId !== "string") {
            response.status(400).send({ error: "INVALID_REQUEST", message: "propertyId is required" });
            return;
        }

        const propertySnap = await db().collection("properties").doc(propertyId).get();
        if (!propertySnap.exists) {
            response.status(404).send({ error: "PROPERTY_NOT_FOUND", message: "Property not found" });
            return;
        }

        const property = propertySnap.data();
        const ownerUid = property.ownerUid || property.createdByUid;

        if (ownerUid === decoded.uid) {
            response.status(400).send({ error: "CANNOT_REQUEST_OWN_PROPERTY", message: "You already own this property" });
            return;
        }

        const shareId = `${propertyId}__${decoded.uid}`;
        const shareRef = db().collection("location_shares").doc(shareId);
        const existingSnap = await shareRef.get();

        if (existingSnap.exists) {
            const existing = existingSnap.data();
            if (existing.status === "APPROVED") {
                const isExpired = existing.expiresAt && existing.expiresAt.toMillis() <= Date.now();
                if (!isExpired) {
                    response.status(200).send({ ok: true, status: "APPROVED", shareId });
                    return;
                }
            } else if (existing.status === "PENDING") {
                response.status(200).send({ ok: true, status: "PENDING", shareId });
                return;
            }
        }

        const payload = {
            id: shareId,
            propertyId,
            listingId: (typeof listingId === "string" && listingId) ? listingId : null,
            ownerUid,
            viewerUid: decoded.uid,
            requestedByUid: decoded.uid,
            reviewedByUid: null,
            status: "PENDING",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            approvedAt: null,
            declinedAt: null,
            revokedAt: null,
            expiresAt: null,
        };

        await shareRef.set(payload, { merge: true });

        // Notify property owner
        if (ownerUid) {
            await db().collection("notifications").add({
                toUserId: ownerUid,
                fromUserId: decoded.uid,
                title: "Exact location requested",
                message: "A prospective buyer requested the exact location of your property.",
                data: {
                    type: "LOCATION_SHARE_REQUEST",
                    propertyId,
                    listingId: listingId || null,
                    viewerUid: decoded.uid,
                    shareId,
                },
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }).catch((err) => logger.warn("Failed to write notification for location share request", err));
        }

        logger.info("requestLocationShare succeeded", { propertyId, viewerUid: decoded.uid, shareId });
        response.status(200).send({ ok: true, status: "PENDING", shareId });
    } catch (error) {
        logger.error("requestLocationShare failed", error);
        response.status(500).send({ error: "INTERNAL", message: "Request failed" });
    }
});

/**
 * Property owner approves or declines a location share request.
 * Derives owner UID server-side from Bearer token.
 */
exports.respondLocationShare = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const decoded = await requireAuth(request, response);
        if (!decoded) return;

        const { propertyId, viewerUid, decision, durationDays = 30 } = request.body || {};
        if (!propertyId || typeof propertyId !== "string" || !viewerUid || typeof viewerUid !== "string") {
            response.status(400).send({ error: "INVALID_REQUEST", message: "propertyId and viewerUid are required" });
            return;
        }

        if (decision !== "APPROVE" && decision !== "DECLINE") {
            response.status(400).send({ error: "INVALID_DECISION", message: "decision must be APPROVE or DECLINE" });
            return;
        }

        const shareId = `${propertyId}__${viewerUid}`;
        const shareRef = db().collection("location_shares").doc(shareId);
        const shareSnap = await shareRef.get();

        if (!shareSnap.exists) {
            response.status(404).send({ error: "SHARE_NOT_FOUND", message: "Location share record not found" });
            return;
        }

        const share = shareSnap.data();
        const isAdmin = await isAdminUid(decoded.uid);

        if (!isAdmin && share.ownerUid !== decoded.uid) {
            response.status(403).send({ error: "FORBIDDEN", message: "Not authorized to respond to this request" });
            return;
        }

        if (!isAdmin && decoded.uid === viewerUid) {
            response.status(403).send({ error: "FORBIDDEN", message: "Cannot respond to your own request" });
            return;
        }

        if (share.status !== "PENDING") {
            response.status(400).send({ error: "INVALID_STATE", message: "Only PENDING requests can be responded to" });
            return;
        }

        let expiresAt = null;
        if (decision === "APPROVE" && Number(durationDays) > 0) {
            expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + Number(durationDays) * 86400000);
        }

        const updates = {
            status: decision === "APPROVE" ? "APPROVED" : "DECLINED",
            reviewedByUid: decoded.uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...(decision === "APPROVE"
                ? { approvedAt: admin.firestore.FieldValue.serverTimestamp(), expiresAt }
                : { declinedAt: admin.firestore.FieldValue.serverTimestamp(), expiresAt: null }),
        };

        await shareRef.update(updates);

        // Notify viewer
        await db().collection("notifications").add({
            toUserId: viewerUid,
            fromUserId: decoded.uid,
            title: decision === "APPROVE" ? "Exact location shared" : "Location request declined",
            message: decision === "APPROVE"
                ? "The owner approved your request to view the exact property location."
                : "The owner declined your request to view the exact property location.",
            data: {
                type: decision === "APPROVE" ? "LOCATION_SHARE_APPROVED" : "LOCATION_SHARE_DECLINED",
                propertyId,
                listingId: share.listingId || null,
                shareId,
            },
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch((err) => logger.warn("Failed to notify viewer of location share response", err));

        logger.info("respondLocationShare succeeded", { propertyId, viewerUid, decision, reviewerUid: decoded.uid });
        response.status(200).send({ ok: true, status: updates.status, shareId });
    } catch (error) {
        logger.error("respondLocationShare failed", error);
        response.status(500).send({ error: "INTERNAL", message: "Respond failed" });
    }
});

/**
 * Property owner or viewer revokes an approved or pending location share.
 */
exports.revokeLocationShare = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const decoded = await requireAuth(request, response);
        if (!decoded) return;

        const { propertyId, viewerUid } = request.body || {};
        if (!propertyId || typeof propertyId !== "string" || !viewerUid || typeof viewerUid !== "string") {
            response.status(400).send({ error: "INVALID_REQUEST", message: "propertyId and viewerUid are required" });
            return;
        }

        const shareId = `${propertyId}__${viewerUid}`;
        const shareRef = db().collection("location_shares").doc(shareId);
        const shareSnap = await shareRef.get();

        if (!shareSnap.exists) {
            response.status(404).send({ error: "SHARE_NOT_FOUND", message: "Location share record not found" });
            return;
        }

        const share = shareSnap.data();
        const isAdmin = await isAdminUid(decoded.uid);

        if (!isAdmin && share.ownerUid !== decoded.uid) {
            response.status(403).send({ error: "FORBIDDEN", message: "Not authorized to revoke this share" });
            return;
        }

        await shareRef.update({
            status: "REVOKED",
            revokedAt: admin.firestore.FieldValue.serverTimestamp(),
            reviewedByUid: decoded.uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        logger.info("revokeLocationShare succeeded", { propertyId, viewerUid, revokedByUid: decoded.uid });
        response.status(200).send({ ok: true, status: "REVOKED", shareId });
    } catch (error) {
        logger.error("revokeLocationShare failed", error);
        response.status(500).send({ error: "INTERNAL", message: "Revoke failed" });
    }
});
