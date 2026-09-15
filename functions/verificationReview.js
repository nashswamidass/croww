/**
 * Admin review + public projection for property trust cases.
 * Identity KYC is not approved here.
 */
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireAdmin } = require("./httpAuth");

const COLLECTION = "verification_cases";

const TRANSITIONS = {
    NOT_VERIFIED: ["PENDING"],
    PENDING: ["VERIFIED", "REJECTED"],
    VERIFIED: ["EXPIRED", "REJECTED"],
    REJECTED: ["PENDING"],
    EXPIRED: ["PENDING"],
};

function canTransition(from, to) {
    return (TRANSITIONS[from] || []).includes(to);
}

function decisionToStatus(decision) {
    if (decision === "APPROVED") return "VERIFIED";
    if (decision === "REJECTED") return "REJECTED";
    if (decision === "EXPIRED") return "EXPIRED";
    return null;
}

function copyFor(type, status) {
    const subject = {
        IDENTITY: "identity",
        OWNER: "owner",
        AGENT: "agent",
        BUILDER: "builder",
        OWNERSHIP: "ownership",
        REPRESENTATION: "representation",
        PROPERTY: "property",
        LOCATION: "location",
    }[type] || "verification";
    if (status === "PENDING") {
        return { title: "Verification submitted", message: `Your ${subject} verification was submitted and is pending review.` };
    }
    if (status === "VERIFIED") {
        return { title: "Verification approved", message: `Your ${subject} verification was approved.` };
    }
    if (status === "REJECTED") {
        return { title: "Verification not approved", message: `Your ${subject} verification was not approved. You can submit new evidence.` };
    }
    if (status === "EXPIRED") {
        return { title: "Verification expired", message: `Your ${subject} verification has expired.` };
    }
    return { title: "Verification update", message: `Your ${subject} verification was updated.` };
}

function publicSlice(status) {
    const verified = status === "VERIFIED";
    return {
        status,
        verifiedAt: verified ? FieldValue.serverTimestamp() : null,
        expiresAt: null,
        updatedAt: FieldValue.serverTimestamp(),
    };
}

async function applyPublicProjection(db, row, status) {
    const slice = publicSlice(status);
    if (row.type === "AGENT" || row.type === "BUILDER" || row.type === "OWNER" || row.type === "IDENTITY") {
        const key = row.type === "AGENT" ? "agent" : row.type === "BUILDER" ? "builder" : row.type === "OWNER" ? "owner" : "identity";
        if (!row.subjectId) return;
        await db.collection("users").doc(row.subjectId).set({
            trust: { [key]: slice },
        }, { merge: true });
        return;
    }
    if (row.type === "OWNERSHIP" || row.type === "PROPERTY" || row.type === "LOCATION") {
        const propertyId = row.propertyId || row.subjectId;
        if (!propertyId) return;
        const field = row.type === "OWNERSHIP" ? "ownership" : row.type === "PROPERTY" ? "property" : "location";
        await db.collection("properties").doc(propertyId).set({
            verification: { [field]: slice },
        }, { merge: true });
        return;
    }
    if (row.type === "REPRESENTATION") {
        const listingId = row.listingId || row.subjectId;
        if (!listingId) return;
        const patch = {
            verification: { representation: slice },
            representationStatus: status === "VERIFIED" ? "verified" : "unverified",
        };
        await db.collection("listings").doc(listingId).set(patch, { merge: true });
    }
}

async function notifySubmitter(db, row, status, caseId) {
    if (!row.submittedByUid) return;
    const copy = copyFor(row.type, status);
    await db.collection("notifications").add({
        toUserId: row.submittedByUid,
        fromUserId: null,
        title: copy.title,
        message: copy.message,
        data: {
            type: "property_verification",
            verificationType: row.type,
            verificationStatus: status,
            verificationId: caseId,
            subjectId: row.subjectId || null,
        },
        read: false,
        createdAt: FieldValue.serverTimestamp(),
    });
}

async function writeHistory(db, caseId, fromStatus, toStatus, actorUid, reason) {
    await db.collection(COLLECTION).doc(caseId).collection("history").add({
        fromStatus,
        toStatus,
        actorUid: actorUid || null,
        reason: reason || null,
        at: FieldValue.serverTimestamp(),
    });
}

async function submitterPermitted(db, row) {
    const uid = row.submittedByUid;
    if (!uid) return false;
    if (["OWNER", "AGENT", "BUILDER"].includes(row.type)) {
        return row.subjectId === uid;
    }
    if (["OWNERSHIP", "PROPERTY", "LOCATION"].includes(row.type)) {
        const propertyId = row.propertyId || row.subjectId;
        if (!propertyId) return false;
        const snap = await db.collection("properties").doc(propertyId).get();
        if (!snap.exists) return false;
        const property = snap.data() || {};
        return property.ownerUid === uid || property.createdByUid === uid;
    }
    if (row.type === "REPRESENTATION") {
        const listingId = row.listingId || row.subjectId;
        if (!listingId) return false;
        const snap = await db.collection("listings").doc(listingId).get();
        if (!snap.exists) return false;
        const listing = snap.data() || {};
        return listing.listedByUid === uid
            && (listing.listedByRole === "agent" || listing.listedByRole === "builder");
    }
    return false;
}

exports.onVerificationCaseCreated = onDocumentCreated(`${COLLECTION}/{caseId}`, async (event) => {
    const data = event.data?.data();
    if (!data || data.status !== "PENDING") return;
    try {
        const db = admin.firestore();
        const allowed = await submitterPermitted(db, data);
        if (!allowed) {
            logger.warn("[verification] skipped projection; submitter not permitted", event.params.caseId);
            return;
        }
        await applyPublicProjection(db, data, "PENDING");
        await writeHistory(db, event.params.caseId, "NOT_VERIFIED", "PENDING", data.submittedByUid, null);
        await notifySubmitter(db, data, "PENDING", event.params.caseId);
    } catch (error) {
        logger.error("[verification] onCreate failed", error);
    }
});

exports.reviewVerification = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const decoded = await requireAdmin(request, response);
        if (!decoded) return;

        const { verificationId, decision, reason } = request.body || {};
        const toStatus = decisionToStatus(decision);
        if (!verificationId || !toStatus) {
            response.status(400).send({ error: "INVALID_ARGUMENT", message: "verificationId and decision are required" });
            return;
        }

        const db = admin.firestore();
        const ref = db.collection(COLLECTION).doc(String(verificationId));
        const snap = await ref.get();
        if (!snap.exists) {
            response.status(404).send({ error: "NOT_FOUND", message: "Verification case not found" });
            return;
        }
        const row = snap.data() || {};
        const allowed = await submitterPermitted(db, row);
        if (!allowed) {
            response.status(409).send({
                error: "SUBMITTER_NOT_PERMITTED",
                message: "Case submitter is not authorized for this subject",
            });
            return;
        }
        if (!canTransition(row.status, toStatus)) {
            response.status(409).send({
                error: "INVALID_STATUS_TRANSITION",
                message: `Cannot ${decision} a ${row.status} case`,
            });
            return;
        }

        await ref.update({
            status: toStatus,
            reviewedAt: FieldValue.serverTimestamp(),
            reviewedByUid: decoded.uid,
            reason: reason || null,
        });
        await writeHistory(db, snap.id, row.status, toStatus, decoded.uid, reason || null);
        await applyPublicProjection(db, row, toStatus);
        await notifySubmitter(db, row, toStatus, snap.id);

        response.status(200).send({ ok: true, verificationId: snap.id, status: toStatus });
    } catch (error) {
        logger.error("[verification] review failed", error);
        response.status(500).send({ error: "INTERNAL", message: "Review failed" });
    }
});
