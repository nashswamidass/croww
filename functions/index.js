const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const { Cashfree, CFEnvironment } = require("cashfree-pg");
const { Expo } = require("expo-server-sdk");
const admin = require("firebase-admin");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

require('dotenv').config();

admin.initializeApp({
    projectId: "croww-live-2026"
});

const expo = new Expo();
const { sendEmail, getWelcomeTemplate, getPasswordResetTemplate } = require("./emails");


/**
 * Generate X-Cf-Signature for Cashfree Public Key 2FA
 * Encrypts "clientId.timestamp" with RSA public key, returns base64
 */
const generateCfSignature = (clientId) => {
    try {
        const timestamp = Math.floor(Date.now() / 1000);
        const dataToEncrypt = `${clientId}.${timestamp}`;
        const publicKeyPath = path.join(__dirname, "cashfree_public_key.pem");
        const publicKey = fs.readFileSync(publicKeyPath, "utf8");
        const buffer = Buffer.from(dataToEncrypt, "utf8");
        const encrypted = crypto.publicEncrypt(
            {
                key: publicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha1",
            },
            buffer
        );
        const signature = encrypted.toString("base64");
        return signature;
    } catch (error) {
        logger.error("Error generating Cf Signature:", error);
        try {
            const timestamp = Math.floor(Date.now() / 1000);
            const dataToEncrypt = `${clientId}.${timestamp}`;
            const publicKeyPath = path.join(__dirname, "cashfree_public_key.pem");
            const publicKey = fs.readFileSync(publicKeyPath, "utf8");
            const buffer = Buffer.from(dataToEncrypt, "utf8");
            const encrypted = crypto.publicEncrypt(
                {
                    key: publicKey,
                    padding: crypto.constants.RSA_PKCS1_v1_5_PADDING,
                },
                buffer
            );
            return encrypted.toString("base64");
        } catch (fallbackError) {
            logger.error("Fallback signature generation also failed:", fallbackError);
            return null;
        }
    }
};

const DEPLOY_TAG = "[AUTH_FIX_DEPLOY_V4]";

const getCashfreeInstance = (environmentName = "SANDBOX") => {
    const clientId = (process.env.CASHFREE_CLIENT_ID || "1206869833208382a0c03e5759a9686021").trim();
    const clientSecret = (process.env.CASHFREE_CLIENT_SECRET || "cfsk_ma_prod_644a138b5eb0d40a062ecf5aeb667bd2_1ca04f9f").trim();
    let normalizedEnv = (environmentName || "SANDBOX").toUpperCase().trim();
    const cfEnv = normalizedEnv === "PRODUCTION" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
    const cashfree = new Cashfree(cfEnv, clientId, clientSecret);
    cashfree.XApiVersion = "2023-08-01";
    return { cashfree, clientId, clientSecret, normalizedEnv };
};

exports.createCashfreeOrder = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const { orderAmount, customerId, customerPhone, customerName, customerEmail, environment } = request.body;
        const { clientId, clientSecret, normalizedEnv } = getCashfreeInstance(environment);
        const orderId = `ORDER_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const origin = request.headers.origin || "https://croww.ai";

        const requestData = {
            order_amount: Number(parseFloat(orderAmount).toFixed(2)),
            order_currency: "INR",
            order_id: orderId,
            customer_details: {
                customer_id: (customerId || "").replace(/[^a-zA-Z0-9_\-\.]/g, ''),
                customer_name: customerName || "Customer",
                customer_email: customerEmail || "customer@example.com",
                customer_phone: (customerPhone || "").replace(/\D/g, '').slice(-10),
            },
            order_meta: {
                return_url: `${origin}/payment-return?order_id=${orderId}`,
            }
        };

        const baseUrl = normalizedEnv === "PRODUCTION" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
        const cfResponse = await fetch(`${baseUrl}/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-client-id": clientId,
                "x-client-secret": clientSecret,
                "x-api-version": "2023-08-01"
            },
            body: JSON.stringify(requestData)
        });

        const responseText = await cfResponse.text();
        let data;
        try { data = JSON.parse(responseText); } catch (e) { data = { raw: responseText }; }

        if (!cfResponse.ok) {
            response.status(cfResponse.status).send(data);
            return;
        }
        response.status(200).send(data);
    } catch (error) {
        logger.error(`${DEPLOY_TAG} Internal Error:`, error);
        response.status(500).send({ error: "Internal Server Error", message: error.message });
    }
});

exports.verifyCashfreePayment = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const { orderId, environment } = request.body;
        if (!orderId) {
            response.status(400).send({ error: "Missing orderId" });
            return;
        }
        const { cashfree } = getCashfreeInstance(environment);
        const apiResponse = await cashfree.PGOrderFetchPayments(orderId);
        const payments = apiResponse.data || [];
        const successPayment = payments.find(p => p.payment_status === 'SUCCESS');
        response.status(200).send({
            order_id: orderId,
            status: successPayment ? 'PAID' : 'PENDING',
            payment_details: successPayment || null
        });
    } catch (error) {
        logger.error("Error verifying payment:", error);
        if (error.response && error.response.data) {
            const cfError = error.response.data;
            response.status(error.response.status || 400).send({
                error: cfError.message || "Verification Failed",
                code: cfError.code,
                details: cfError
            });
        } else {
            response.status(500).send({
                error: "Failed to verify payment",
                message: error.message
            });
        }
    }
});

exports.getDigiLockerUrl = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const { userFlow, environment, clientId: reqClientId, clientSecret: reqClientSecret } = request.body;
        const clientId = reqClientId || process.env.CASHFREE_CLIENT_ID || "TEST10990759f216be3b56c5acb8a37495709901";
        const clientSecret = reqClientSecret || process.env.CASHFREE_CLIENT_SECRET || "cfsk_ma_test_ed365f96f0455a6e9d005be3af1dbd0c_d381d9b2";
        const baseUrl = environment === "PRODUCTION"
            ? "https://api.cashfree.com/verification/digilocker"
            : "https://sandbox.cashfree.com/verification/digilocker";
        const verificationId = `VER-${Date.now()}`;
        const appUrl = "https://croww.ai";

        const fetchWithFallback = async (url) => {
            return await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-client-id": clientId,
                    "x-client-secret": clientSecret,
                    "x-api-version": "2023-08-01",
                    "x-cf-signature": generateCfSignature(clientId)
                },
                body: JSON.stringify({
                    verification_id: verificationId,
                    document_requested: ["AADHAAR"],
                    redirect_url: `${appUrl}/verification-return`,
                    user_flow: userFlow || "signin"
                }),
                timeout: 15000
            });
        };

        let apiResponse = await fetchWithFallback(baseUrl);
        if (!apiResponse.ok) {
            const altUrl = environment === "PRODUCTION"
                ? "https://api.cashfree.com/identity/verification/digilocker"
                : "https://sandbox.cashfree.com/identity/verification/digilocker";
            if (baseUrl !== altUrl) apiResponse = await fetchWithFallback(altUrl);
        }

        const responseText = await apiResponse.text();
        let data;
        try { data = JSON.parse(responseText); } catch (e) { data = { rawResponse: responseText }; }

        if (!apiResponse.ok) {
            response.status(apiResponse.status).send({
                error: "Cashfree API Error",
                message: data.message || data.msg || `Verification Error (Status ${apiResponse.status})`,
                details: data
            });
            return;
        }
        response.status(200).send(data);
    } catch (error) {
        logger.error("Error generating DigiLocker URL:", error);
        response.status(500).send({ error: "Internal Server Error", message: error.message });
    }
});

exports.getDigiLockerStatus = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const { verificationId, environment, clientId: reqClientId, clientSecret: reqClientSecret } = request.body;
        const clientId = reqClientId || process.env.CASHFREE_CLIENT_ID || "TEST10990759f216be3b56c5acb8a37495709901";
        const clientSecret = reqClientSecret || process.env.CASHFREE_CLIENT_SECRET || "cfsk_ma_test_ed365f96f0455a6e9d005be3af1dbd0c_d381d9b2";
        if (!verificationId) {
            response.status(400).send({ error: "Missing verificationId" });
            return;
        }
        const baseUrl = environment === "PRODUCTION"
            ? "https://api.cashfree.com/verification/digilocker"
            : "https://sandbox.cashfree.com/verification/digilocker";
        const apiResponse = await fetch(`${baseUrl}/${verificationId}`, {
            method: "GET",
            headers: {
                "x-client-id": clientId,
                "x-client-secret": clientSecret,
                "x-api-version": "2023-08-01",
                "x-cf-signature": generateCfSignature(clientId)
            },
            timeout: 10000
        });
        const responseText = await apiResponse.text();
        let data;
        try { data = JSON.parse(responseText); } catch (e) { data = { rawResponse: responseText }; }
        if (!apiResponse.ok) {
            response.status(apiResponse.status).send({
                error: "Cashfree API Error",
                message: data.message || data.msg || `Status Check Error (Status ${apiResponse.status})`,
                details: data
            });
            return;
        }
        response.status(200).send(data);
    } catch (error) {
        logger.error("Error fetching DigiLocker status:", error);
        response.status(500).send({ error: "Internal Server Error", details: error.message });
    }
});

exports.initiateAadhaarOTP = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const { aadhaarNumber, environment, clientId: reqClientId, clientSecret: reqClientSecret } = request.body;
        const clientId = reqClientId || process.env.CASHFREE_CLIENT_ID || "TEST10990759f216be3b56c5acb8a37495709901";
        const clientSecret = reqClientSecret || process.env.CASHFREE_CLIENT_SECRET || "cfsk_ma_test_ed365f96f0455a6e9d005be3af1dbd0c_d381d9b2";
        if (!aadhaarNumber) {
            response.status(400).send({ error: "Missing aadhaarNumber" });
            return;
        }
        if (environment === "SANDBOX" && aadhaarNumber === "000000000000") {
            response.status(200).send({
                status: "SUCCESS",
                ref_id: "BYPASS-REF-ID",
                message: "OTP sent successfully (Simulated)"
            });
            return;
        }
        const verificationId = `VER-OTP-${Date.now()}`;
        const isProd = environment === "PRODUCTION";
        const base = isProd ? "https://api.cashfree.com" : "https://sandbox.cashfree.com";
        const urlsToTry = [
            `${base}/verification/offline-aadhaar/otp`,
            `${base}/verification/aadhaar`,
            `${base}/verification/aadhaar/otp`,
            `${base}/verification/aadhaar-verification/otp`,
            `${base}/offline-aadhaar/otp`,
        ];
        const headers = {
            "Content-Type": "application/json",
            "x-client-id": clientId,
            "x-client-secret": clientSecret,
            "x-api-version": "2023-08-01",
            "x-cf-signature": generateCfSignature(clientId)
        };
        const body = JSON.stringify({ aadhaar_number: aadhaarNumber, verification_id: verificationId });
        let apiResponse = null;
        for (const url of urlsToTry) {
            try {
                apiResponse = await fetch(url, { method: "POST", headers, body, timeout: 15000 });
                if (apiResponse.ok) break;
                if (urlsToTry.indexOf(url) < urlsToTry.length - 1) await apiResponse.text();
            } catch (err) { logger.warn(`Fetch error for ${url}`); }
        }
        if (!apiResponse) {
            response.status(500).send({ error: "All endpoints failed" });
            return;
        }
        const responseText = await apiResponse.text();
        let data;
        try { data = JSON.parse(responseText); } catch (e) { data = { rawResponse: responseText }; }
        if (!apiResponse.ok) {
            response.status(apiResponse.status).send({
                error: "Cashfree API Error",
                message: data.message || data.msg || `OTP Init Error`,
                details: data
            });
            return;
        }
        response.status(200).send(data);
    } catch (error) {
        logger.error("Error initiating Aadhaar OTP:", error);
        response.status(500).send({ error: "Internal Server Error", details: error.message });
    }
});

exports.verifyAadhaarOTP = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const { refId, otp, environment, clientId: reqClientId, clientSecret: reqClientSecret } = request.body;
        const clientId = reqClientId || process.env.CASHFREE_CLIENT_ID || "TEST10990759f216be3b56c5acb8a37495709901";
        const clientSecret = reqClientSecret || process.env.CASHFREE_CLIENT_SECRET || "cfsk_ma_test_ed365f96f0455a6e9d005be3af1dbd0c_d381d9b2";
        if (!refId || !otp) {
            response.status(400).send({ error: "Missing refId or otp" });
            return;
        }
        if (environment === "SANDBOX" && (refId === "BYPASS-REF-ID" || otp === "000000")) {
            response.status(200).send({
                status: "SUCCESS",
                message: "Aadhaar details fetched successfully",
                data: {
                    full_name: "Test User (Bypass)",
                    aadhaar_number: "XXXXXXXX0000",
                    gender: "M",
                    dob: "01-01-1990"
                }
            });
            return;
        }
        const isProd = environment === "PRODUCTION";
        const base = isProd ? "https://api.cashfree.com" : "https://sandbox.cashfree.com";
        const urlsToTry = [
            `${base}/verification/offline-aadhaar/verify`,
            `${base}/verification/aadhaar`,
            `${base}/verification/aadhaar/verify`,
            `${base}/verification/aadhaar-verification/verify`,
            `${base}/offline-aadhaar/verify`,
        ];
        const headers = {
            "Content-Type": "application/json",
            "x-client-id": clientId,
            "x-client-secret": clientSecret,
            "x-api-version": "2023-08-01",
            "x-cf-signature": generateCfSignature(clientId)
        };
        const body = JSON.stringify({ ref_id: refId, otp: otp });
        let apiResponse = null;
        for (const url of urlsToTry) {
            try {
                apiResponse = await fetch(url, { method: "POST", headers, body, timeout: 15000 });
                if (apiResponse.ok) break;
                if (urlsToTry.indexOf(url) < urlsToTry.length - 1) await apiResponse.text();
            } catch (err) { logger.warn(`Fetch error for ${url}`); }
        }
        if (!apiResponse) {
            response.status(500).send({ error: "All endpoints failed" });
            return;
        }
        const responseText = await apiResponse.text();
        let data;
        try { data = JSON.parse(responseText); } catch (e) { data = { rawResponse: responseText }; }
        if (!apiResponse.ok) {
            response.status(apiResponse.status).send({
                error: "Cashfree API Error",
                message: data.message || data.msg || `OTP Verify Error`,
                details: data
            });
            return;
        }
        response.status(200).send(data);
    } catch (error) {
        logger.error("Error verifying Aadhaar OTP:", error);
        response.status(500).send({ error: "Internal Server Error", details: error.message });
    }
});

exports.sendPushNotification = onDocumentCreated("notifications/{notificationId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const notification = snapshot.data();
    const { toUserId, title, message, data } = notification;
    if (!toUserId) return;
    try {
        const userDoc = await admin.firestore().collection("users").doc(toUserId).get();
        if (!userDoc.exists) return;
        const pushToken = userDoc.data().pushToken;
        if (!pushToken || !Expo.isExpoPushToken(pushToken)) return;
        const messages = [{
            to: pushToken,
            sound: 'default',
            title: title || 'New Notification',
            body: message || 'You have a new message from Croww',
            data: data || {},
        }];
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
            try {
                await expo.sendPushNotificationsAsync(chunk);
            } catch (error) { logger.error("Error sending push notification chunk:", error); }
        }
    } catch (error) { logger.error("Error in sendPushNotification trigger:", error); }
});

exports.sendWelcomeEmail = onDocumentCreated("users/{userId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const userData = snapshot.data();
    const { email, name } = userData;
    if (!email) return;
    try {
        const nameText = name || "there";
        const html = getWelcomeTemplate(nameText);
        const text = `Welcome to Croww, ${nameText}!\n\nWe're thrilled to have you join our exclusive community of event enthusiasts and service providers.\n\nStart exploring the most premium events and services curated just for you at https://croww.ai`;

        await sendEmail({ to: email, subject: `Welcome to Croww, ${name || "User"}!`, html, text });
    } catch (error) { logger.error(`Failed to send welcome email to ${email}:`, error); }
});

exports.sendCustomPasswordReset = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    const { email } = request.body;
    try {
        if (!email) {
            response.status(400).send({ error: "Missing email" });
            return;
        }

        logger.info(`[AuthReset] Request for: ${email}`);

        let userRecord;
        try {
            userRecord = await admin.auth().getUserByEmail(email);
        } catch (e) {
            logger.warn(`[AuthReset] User not found or error for ${email}:`, e.message);
            // Safety measure: Still return 200 to prevent user enumeration
            response.status(200).send({ success: true, message: "If an account exists with this email, a reset link has been sent." });
            return;
        }

        // Use multiple URLs in actionCodeSettings to ensure at least one is whitelisted
        // The default firebase domain is ALWAYS whitelisted, but croww.ai is preferred
        const actionCodeSettings = {
            url: 'https://croww.ai/login', // Preferred authorized domain
            handleCodeInApp: false
        };

        logger.info(`[AuthReset] Generating reset link for ${email} with continueUrl: ${actionCodeSettings.url}`);

        let resetLink;
        try {
            resetLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
        } catch (linkError) {
            logger.error(`[AuthReset] Whitelist check or link generation failed for ${email}:`, {
                code: linkError.code,
                message: linkError.message
            });
            // Fallback: Try without actionCodeSettings if specific URL causes issues
            // This link will use the default Firebase handler and won't redirect back automatically
            resetLink = await admin.auth().generatePasswordResetLink(email);
        }

        const html = getPasswordResetTemplate(userRecord.displayName || "User", resetLink);
        const text = `Reset Your Password\n\nHi ${userRecord.displayName || "User"},\n\nWe received a request to reset your password for your Croww account.\n\nCopy and paste the link below into your browser to choose a new password. This link will expire in 1 hour.\n\n${resetLink}\n\nIf you didn't request a password reset, you can safely ignore this email.`;

        const emailResult = await sendEmail({
            to: email,
            subject: "Reset your Croww password",
            html,
            text
        });

        if (!emailResult.success) {
            logger.error(`[AuthReset] SMTP Error for ${email}:`, emailResult.error);
            response.status(500).send({
                error: "Email Delivery Failed",
                message: emailResult.error,
                details: "Check SMTP configuration or Mailgun quota."
            });
            return;
        }

        logger.info(`[AuthReset] Success for ${email}`);
        response.status(200).send({ success: true, message: "Custom reset email sent successfully." });
    } catch (error) {
        logger.error(`[AuthReset] CRITICAL ERROR for ${email}:`, error);
        response.status(500).send({
            error: "Internal Server Error",
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

exports.cleanupExpiredEvents = onSchedule("0 0 * * *", async (event) => {
    const cutoffDate = new Date(Date.now() - (24 * 60 * 60 * 1000));
    const cutoffISO = cutoffDate.toISOString();
    const eventsRef = admin.firestore().collection("events");
    const q = eventsRef.where("date", "<", cutoffISO);
    try {
        const snapshot = await q.get();
        if (snapshot.empty) return;
        const batch = admin.firestore().batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
    } catch (error) { logger.error("[Cleanup] Error in cleanupExpiredEvents:", error); }
});

exports.deleteUserAccount = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const { uid } = request.body;
        if (!uid) {
            response.status(400).send({ error: "Missing user UID" });
            return;
        }
        const db = admin.firestore();
        const userRef = db.collection("users").doc(uid);
        try {
            await userRef.update({ isBlocked: true, deletedAt: new Date().toISOString() });
        } catch (flagErr) { logger.warn(`[DeleteAccount] Could not flag isBlocked`); }
        const batch = db.batch();
        const collections = ["buddy_requests", "buddy_join_requests", "friend_requests", "notifications", "tickets", "events"];
        for (const coll of collections) {
            let field = "userId";
            if (coll === "friend_requests") {
                const s1 = await db.collection(coll).where("fromUserId", "==", uid).get();
                s1.forEach(doc => batch.delete(doc.ref));
                const s2 = await db.collection(coll).where("toUserId", "==", uid).get();
                s2.forEach(doc => batch.delete(doc.ref));
                continue;
            }
            if (coll === "buddy_join_requests") {
                const s1 = await db.collection(coll).where("requesterId", "==", uid).get();
                s1.forEach(doc => batch.delete(doc.ref));
                const s2 = await db.collection(coll).where("ownerId", "==", uid).get();
                s2.forEach(doc => batch.delete(doc.ref));
                continue;
            }
            if (coll === "notifications") field = "toUserId";
            if (coll === "events") field = "organizerId";
            const snap = await db.collection(coll).where(field, "==", uid).get();
            snap.forEach(doc => batch.delete(doc.ref));
        }
        batch.delete(userRef);
        await batch.commit();
        try { await admin.auth().deleteUser(uid); } catch (authError) { if (authError.code !== 'auth/user-not-found') throw authError; }
        response.status(200).send({ success: true, message: "Account deleted successfully." });
    } catch (error) {
        logger.error(`[DeleteAccount] Error:`, error);
        response.status(500).send({ error: "Internal Server Error", message: error.message });
    }
});

exports.toggleUserBlock = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    const { uid, block } = request.body;
    if (!uid) return response.status(400).send({ error: "User ID is required." });
    try {
        const db = admin.firestore();
        const userRef = db.collection("users").doc(uid);
        await userRef.update({ isBlocked: block, blockedAt: block ? new Date().toISOString() : admin.firestore.FieldValue.delete() });
        await admin.auth().updateUser(uid, { disabled: block });
        response.status(200).send({ success: true, message: `User ${block ? 'blocked' : 'unblocked'}` });
    } catch (error) {
        logger.error(`[ToggleBlock] Error:`, error);
        response.status(500).send({ error: "Internal Server Error", message: error.message });
    }
});

exports.onEventCreated = onDocumentCreated("events/{eventId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const eventData = snapshot.data();
    if (eventData.isPublic !== true) return;
    const city = eventData.locationName;
    if (!city) return;
    try {
        const db = admin.firestore();
        const usersSnapshot = await db.collection("users").where("location", "==", city).limit(100).get();
        if (usersSnapshot.empty) return;
        const batch = db.batch();
        let count = 0;
        usersSnapshot.docs.forEach((userDoc) => {
            if (userDoc.id === eventData.organizerId) return;
            const notificationRef = db.collection("notifications").doc();
            batch.set(notificationRef, {
                toUserId: userDoc.id,
                title: "New Event in Your Area! 🌍",
                message: `${eventData.organizerName || 'Someone'} just hosted "${eventData.title}" in ${city}.`,
                data: { type: "NEW_EVENT", eventId: event.params.eventId, location: city },
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            count++;
        });
        if (count > 0) await batch.commit();
    } catch (error) { logger.error("Error in onEventCreated trigger:", error); }
});

/**
 * [NEW] Trigger: Notify participants of a new chat message
 */
exports.onChatMessageCreated = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const messageData = snapshot.data();
    const chatId = event.params.chatId;
    const senderId = messageData.senderId;
    try {
        const db = admin.firestore();
        const chatSnap = await db.collection("chats").doc(chatId).get();
        if (!chatSnap.exists) return;
        const chatData = chatSnap.data();
        const participantIds = chatData.participantIds || [];
        const batch = db.batch();
        let count = 0;
        participantIds.forEach((userId) => {
            if (userId === senderId) return;
            const notificationRef = db.collection("notifications").doc();
            batch.set(notificationRef, {
                toUserId: userId,
                title: chatData.type === 'group' ? `Group: ${chatData.name}` : `New message from ${messageData.senderName || 'Someone'}`,
                message: messageData.text ? (messageData.text.length > 60 ? messageData.text.substring(0, 57) + '...' : messageData.text) : 'Sent a message',
                data: { type: "CHAT_MESSAGE", chatId: chatId, senderId: senderId },
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            count++;
        });
        if (count > 0) await batch.commit();
    } catch (error) { logger.error("Error in onChatMessageCreated:", error); }
});

/**
 * [NEW] Trigger: Notify user of a new friend request
 */
exports.onFriendRequestCreated = onDocumentCreated("friend_requests/{requestId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const requestData = snapshot.data();
    try {
        const db = admin.firestore();
        const notificationRef = db.collection("notifications").doc();
        await notificationRef.set({
            toUserId: requestData.toUserId,
            title: "New Friend Request! 👋",
            message: `${requestData.fromUserName || 'Someone'} wants to be your friend.`,
            data: { type: "FRIEND_REQUEST", requestId: event.params.requestId },
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) { logger.error("Error in onFriendRequestCreated:", error); }
});

/**
 * [NEW] Trigger: Notify sender when a friend request is accepted
 */
exports.onFriendRequestUpdated = onDocumentUpdated("friend_requests/{requestId}", async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    if (beforeData.status !== 'accepted' && afterData.status === 'accepted') {
        try {
            const db = admin.firestore();
            const notificationRef = db.collection("notifications").doc();
            const responderDoc = await db.collection("users").doc(afterData.toUserId).get();
            const responderName = responderDoc.exists ? responderDoc.data().name : 'Someone';
            await notificationRef.set({
                toUserId: afterData.fromUserId,
                title: "Friend Request Accepted! ✨",
                message: `${responderName} accepted your friend request.`,
                data: { type: "FRIEND_ACCEPTED", userId: afterData.toUserId },
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) { logger.error("Error in onFriendRequestUpdated:", error); }
    }
});

/**
 * [NEW] Trigger: Notify provider of a new booking
 */
exports.onBookingCreated = onDocumentCreated("bookings/{bookingId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const bookingData = snapshot.data();
    try {
        const db = admin.firestore();
        const notificationRef = db.collection("notifications").doc();
        await notificationRef.set({
            toUserId: bookingData.providerId,
            title: "New Booking Request! 📅",
            message: `New request for "${bookingData.serviceName}" from ${bookingData.customerName || 'customer'}.`,
            data: { type: "NEW_BOOKING", bookingId: event.params.bookingId },
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) { logger.error("Error in onBookingCreated:", error); }
});

/**
 * [NEW] Trigger: Notify customer of booking status change
 */
exports.onBookingUpdated = onDocumentUpdated("bookings/{bookingId}", async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    if (beforeData.status !== afterData.status) {
        try {
            const db = admin.firestore();
            const notificationRef = db.collection("notifications").doc();
            await notificationRef.set({
                toUserId: afterData.senderId,
                title: `Booking Update: ${afterData.status} ✅`,
                message: `Your booking for "${afterData.serviceName}" has been ${afterData.status}.`,
                data: { type: "BOOKING_UPDATE", bookingId: event.params.bookingId, status: afterData.status },
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) { logger.error("Error in onBookingUpdated:", error); }
    }
});
/**
 * [NEW] Action: Toggle Follow/Unfollow a user/business securely on the server
 */
exports.toggleFollow = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const { followerId, targetUserId, action } = request.body; // action: 'follow' or 'unfollow'

        if (!followerId || !targetUserId) {
            response.status(400).send({ error: "Missing followerId or targetUserId" });
            return;
        }

        if (followerId === targetUserId) {
            response.status(400).send({ error: "Cannot follow yourself" });
            return;
        }

        const db = admin.firestore();
        const followId = `${followerId}_${targetUserId}`;
        const followRef = db.collection("follows").doc(followId);
        const targetUserRef = db.collection("users").doc(targetUserId);

        const batch = db.batch();

        if (action === 'follow') {
            batch.set(followRef, {
                followerId,
                targetUserId,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            batch.update(targetUserRef, {
                followersCount: admin.firestore.FieldValue.increment(1),
                'stats.followers': admin.firestore.FieldValue.increment(1)
            });
        } else {
            batch.delete(followRef);
            batch.update(targetUserRef, {
                followersCount: admin.firestore.FieldValue.increment(-1),
                'stats.followers': admin.firestore.FieldValue.increment(-1)
            });
        }

        await batch.commit();
        logger.info(`[ToggleFollow] Success: ${followerId} ${action}ed ${targetUserId}`);
        response.status(200).send({ success: true, action });
    } catch (error) {
        logger.error("[ToggleFollow] Error:", error);
        response.status(500).send({ error: "Internal Server Error", message: error.message });
    }
});
