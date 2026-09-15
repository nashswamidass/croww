const admin = require("firebase-admin");

/**
 * Application-layer auth for HTTP functions.
 * IAM invoker stays public so the mobile/web clients can call these URLs;
 * identity must come from a verified Firebase ID token, not the request body.
 */

function getBearerToken(request) {
    const header = request.headers.authorization || request.headers.Authorization || "";
    const match = String(header).match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : null;
}

async function requireAuth(request, response) {
    const token = getBearerToken(request);
    if (!token) {
        response.status(401).send({ error: "UNAUTHENTICATED", message: "Missing Bearer token" });
        return null;
    }
    try {
        return await admin.auth().verifyIdToken(token);
    } catch (error) {
        response.status(401).send({ error: "UNAUTHENTICATED", message: "Invalid or expired token" });
        return null;
    }
}

async function isAdminUid(uid) {
    if (!uid) return false;
    const db = admin.firestore();
    const adminDoc = await db.collection("admins").doc(uid).get();
    if (adminDoc.exists) return true;
    const userDoc = await db.collection("users").doc(uid).get();
    return userDoc.exists && userDoc.data().userType === "admin";
}

async function requireAdmin(request, response) {
    const decoded = await requireAuth(request, response);
    if (!decoded) return null;
    const adminUser = await isAdminUid(decoded.uid);
    if (!adminUser) {
        response.status(403).send({ error: "FORBIDDEN", message: "Admin access required" });
        return null;
    }
    return decoded;
}

module.exports = {
    requireAuth,
    requireAdmin,
    isAdminUid,
};
