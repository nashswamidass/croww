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
const fetch = require("node-fetch");

require("dotenv").config({ path: path.join(__dirname, ".env") });

admin.initializeApp();

const expo = new Expo();
const { sendEmail, getWelcomeTemplate, getPasswordResetTemplate, getCancellationTemplate } = require("./emails");

const DEPLOY_TAG = "[CROWW_BACKEND_V5]";

logger.info(`${DEPLOY_TAG} Loaded! SMTP_USER present: ${!!process.env.SMTP_USER}. CASHFREE_PG present: ${!!process.env.CASHFREE_PG_CLIENT_ID}. CASHFREE_VERIFY present: ${!!process.env.CASHFREE_VERIFY_CLIENT_ID}`);

/*
----------------------------------
CASHFREE HELPERS
----------------------------------
*/

const getCashfreeInstance = (environmentName = "SANDBOX") => {
    const clientId = (process.env.CASHFREE_PG_CLIENT_ID || "").trim();
    const clientSecret = (process.env.CASHFREE_PG_CLIENT_SECRET || "").trim();
    let normalizedEnv = (environmentName || "SANDBOX").toUpperCase().trim();
    const cfEnv = normalizedEnv === "PRODUCTION" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
    const cashfree = new Cashfree(cfEnv, clientId, clientSecret);
    cashfree.XApiVersion = "2023-08-01";
    return { cashfree, clientId, clientSecret, normalizedEnv };
};

const generateCfSignature = (clientId) => {
    try {
        const timestamp = Math.floor(Date.now() / 1000);
        const dataToEncrypt = `${clientId}.${timestamp}`;
        const publicKeyPath = path.join(__dirname, "cashfree_public_key.pem");
        const publicKey = fs.readFileSync(publicKeyPath, "utf8");
        const buffer = Buffer.from(dataToEncrypt, "utf8");
        const encrypted = crypto.publicEncrypt(
            { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" },
            buffer
        );
        return encrypted.toString("base64");
    } catch (error) {
        logger.error("Error generating Cf Signature:", error);
        return null;
    }
};

/*
----------------------------------
CASHFREE PAYMENT
----------------------------------
*/

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
            response.status(500).send({ error: "Failed to verify payment", message: error.message });
        }
    }
});

/*
----------------------------------
DIGILOCKER - CREATE URL
----------------------------------
*/

exports.getDigiLockerUrl = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const { userFlow, environment, redirectUrl } = request.body;
        const clientId = process.env.CASHFREE_VERIFY_CLIENT_ID;
        const clientSecret = process.env.CASHFREE_VERIFY_CLIENT_SECRET;
        const signature = generateCfSignature(clientId);

        const baseUrl = environment === "PRODUCTION"
            ? "https://api.cashfree.com/verification/digilocker"
            : "https://sandbox.cashfree.com/verification/digilocker";

        const verificationId = `kyc_${Date.now()}`;

        const headers = {
            "Content-Type": "application/json",
            "x-client-id": clientId,
            "x-client-secret": clientSecret
        };
        if (signature) headers["x-cf-signature"] = signature;

        const finalRedirectUrl = redirectUrl || "https://croww.ai/kyc-complete";
        const redirectWithId = finalRedirectUrl.includes("?") 
            ? `${finalRedirectUrl}&verification_id=${verificationId}`
            : `${finalRedirectUrl}?verification_id=${verificationId}`;

        const apiResponse = await fetch(baseUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({
                verification_id: verificationId,
                document_requested: ["AADHAAR"],
                redirect_url: redirectWithId,
                user_flow: userFlow || "signup"
            })
        });

        const responseText = await apiResponse.text();
        let data;
        try { data = JSON.parse(responseText); } catch (e) { data = { rawResponse: responseText }; }

        if (!apiResponse.ok) {
            console.error("Cashfree error:", data);
            response.status(502).send({ error: "Cashfree API Error", details: data });
            return;
        }

        response.status(200).send({ verification_id: verificationId, url: data.url });
    } catch (error) {
        console.error("Error generating DigiLocker URL:", error);
        response.status(500).send({ error: "Internal Server Error", message: error.message });
    }
});

/*
----------------------------------
DIGILOCKER - CHECK STATUS
----------------------------------
*/

exports.getDigiLockerStatus = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const { verificationId, userId, environment } = request.body;
        const clientId = process.env.CASHFREE_VERIFY_CLIENT_ID;
        const clientSecret = process.env.CASHFREE_VERIFY_CLIENT_SECRET;
        const signature = generateCfSignature(clientId);

        if (!verificationId) {
            response.status(400).send({ error: "Missing verificationId" });
            return;
        }

        const baseUrl = environment === "PRODUCTION"
            ? "https://api.cashfree.com/verification/digilocker"
            : "https://sandbox.cashfree.com/verification/digilocker";

        const authHeaders = { "x-client-id": clientId, "x-client-secret": clientSecret };
        if (signature) authHeaders["x-cf-signature"] = signature;

        const apiResponse = await fetch(`${baseUrl}?verification_id=${verificationId}`, {
            method: "GET",
            headers: authHeaders
        });

        const responseText = await apiResponse.text();
        let data;
        try { data = JSON.parse(responseText); } catch (e) { data = { rawResponse: responseText }; }

        if (!apiResponse.ok) {
            console.error("Cashfree error:", data);
            response.status(502).send({ error: "Cashfree API Error", details: data });
            return;
        }

        if ((data.status === "SUCCESS" || data.status === "AUTHENTICATED") && userId) {
            try {
                const docResponse = await fetch(`${baseUrl}/document/AADHAAR?verification_id=${verificationId}`, {
                    method: "GET",
                    headers: authHeaders
                });

                if (docResponse.ok) {
                    const docData = await docResponse.json();
                    await admin.firestore().collection("users").doc(userId).update({
                        kycStatus: "VERIFIED",
                        aadhaarVerified: true,
                        kycProvider: "cashfree_digilocker",
                        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
                        kycDetails: {
                            name: docData.name || "",
                            dob: docData.dob || "",
                            gender: docData.gender || "",
                            masked_aadhaar: docData.uid || docData.masked_aadhaar || "",
                            address: docData.split_address || docData.address || {}
                        }
                    });
                    data.kyc_updated = true;
                } else {
                    console.error("Cashfree document error:", await docResponse.text());
                }
            } catch (firestoreError) {
                console.error("Error updating KYC in Firestore:", firestoreError);
                data.kyc_error = firestoreError.message;
            }
        }

        response.status(200).send(data);
    } catch (error) {
        console.error("Error fetching DigiLocker status:", error);
        response.status(500).send({ error: "Internal Server Error", details: error.message });
    }
});

/*
----------------------------------
PUSH NOTIFICATION
----------------------------------
*/

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
        const messages = [{ to: pushToken, sound: 'default', title: title || 'New Notification', body: message || 'You have a new message from Croww', data: data || {} }];
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
            try { await expo.sendPushNotificationsAsync(chunk); } catch (error) { logger.error("Error sending push chunk:", error); }
        }
    } catch (error) { logger.error("Error in sendPushNotification trigger:", error); }
});

/*
----------------------------------
EMAIL
----------------------------------
*/

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
        logger.info(`[AuthReset] Request for: ${email}. SMTP_USER: ${process.env.SMTP_USER || 'MISSING'}`);
        let userRecord;
        try {
            userRecord = await admin.auth().getUserByEmail(email);
            logger.info(`[AuthReset] Found user: ${userRecord.uid}`);
        } catch (e) {
            logger.warn(`[AuthReset] User not found for ${email}:`, e.message);
            response.status(200).send({ success: true, message: "If an account exists with this email, a reset link has been sent." });
            return;
        }
        const actionCodeSettings = { url: 'https://croww.ai/login', handleCodeInApp: false };
        let resetLink;
        try {
            resetLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
        } catch (linkError) {
            logger.error(`[AuthReset] Link generation failed for ${email}:`, { code: linkError.code, message: linkError.message });
            resetLink = await admin.auth().generatePasswordResetLink(email);
        }
        logger.info(`[AuthReset] Generated reset link`);
        const html = getPasswordResetTemplate(userRecord.displayName || "User", resetLink);
        const text = `Reset Your Password\n\nHi ${userRecord.displayName || "User"},\n\nWe received a request to reset your password for your Croww account.\n\nCopy and paste the link below into your browser to choose a new password. This link will expire in 1 hour.\n\n${resetLink}\n\nIf you didn't request a password reset, you can safely ignore this email.`;
        const emailResult = await sendEmail({ to: email, subject: "Reset your Croww password", html, text });
        if (!emailResult.success) {
            logger.error(`[AuthReset] SMTP Error for ${email}:`, emailResult.error);
            response.status(500).send({ error: "Email Delivery Failed", message: emailResult.error });
            return;
        }
        logger.info(`[AuthReset] Success for ${email}`);
        response.status(200).send({ success: true, message: "Custom reset email sent successfully." });
    } catch (error) {
        logger.error(`[AuthReset] CRITICAL ERROR for ${email}:`, error);
        response.status(500).send({ error: "Internal Server Error", message: error.message });
    }
});

/*
----------------------------------
CRON CLEANUP
----------------------------------
*/

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

/*
----------------------------------
USER MANAGEMENT
----------------------------------
*/

exports.deleteUserAccount = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const { uid } = request.body;
        if (!uid) { response.status(400).send({ error: "Missing user UID" }); return; }
        const db = admin.firestore();
        const userRef = db.collection("users").doc(uid);
        try { await userRef.update({ isBlocked: true, deletedAt: new Date().toISOString() }); } catch (flagErr) { logger.warn(`[DeleteAccount] Could not flag isBlocked`); }
        const batch = db.batch();
        const collections = ["buddy_requests", "buddy_join_requests", "friend_requests", "notifications", "tickets", "events"];
        for (const coll of collections) {
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
            let field = "userId";
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
        await db.collection("users").doc(uid).update({
            isBlocked: block,
            blockedAt: block ? new Date().toISOString() : admin.firestore.FieldValue.delete()
        });
        await admin.auth().updateUser(uid, { disabled: block });
        response.status(200).send({ success: true, message: `User ${block ? 'blocked' : 'unblocked'}` });
    } catch (error) {
        logger.error(`[ToggleBlock] Error:`, error);
        response.status(500).send({ error: "Internal Server Error", message: error.message });
    }
});

exports.toggleFollow = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    try {
        const { followerId, targetUserId, action } = request.body;
        if (!followerId || !targetUserId) { response.status(400).send({ error: "Missing followerId or targetUserId" }); return; }
        if (followerId === targetUserId) { response.status(400).send({ error: "Cannot follow yourself" }); return; }
        const db = admin.firestore();
        const followId = `${followerId}_${targetUserId}`;
        const followRef = db.collection("follows").doc(followId);
        const targetUserRef = db.collection("users").doc(targetUserId);
        const batch = db.batch();
        if (action === 'follow') {
            batch.set(followRef, { followerId, targetUserId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            batch.update(targetUserRef, { followersCount: admin.firestore.FieldValue.increment(1), 'stats.followers': admin.firestore.FieldValue.increment(1) });
        } else {
            batch.delete(followRef);
            batch.update(targetUserRef, { followersCount: admin.firestore.FieldValue.increment(-1), 'stats.followers': admin.firestore.FieldValue.increment(-1) });
        }
        await batch.commit();

        // Send new-follower notification when someone follows (not unfollow)
        if (action === 'follow') {
            try {
                const followerSnap = await db.collection("users").doc(followerId).get();
                const followerData = followerSnap.data() || {};
                const followerName = followerData.name || 'Someone';

                // Create in-app notification
                await db.collection("notifications").add({
                    userId: targetUserId,
                    toUserId: targetUserId,
                    title: "New Follower! 🎉",
                    message: `${followerName} started following you.`,
                    data: { type: "NEW_FOLLOWER", followerId },
                    read: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });

                // Send push notification if the target user has an Expo push token
                const targetSnap = await db.collection("users").doc(targetUserId).get();
                const targetData = targetSnap.data() || {};
                const expoPushToken = targetData.expoPushToken;
                if (expoPushToken && expoPushToken.startsWith('ExponentPushToken')) {
                    const { Expo } = require('expo-server-sdk');
                    const expo = new Expo();
                    const messages = [{
                        to: expoPushToken,
                        sound: 'default',
                        title: 'New Follower! 🎉',
                        body: `${followerName} started following you.`,
                        data: { type: 'NEW_FOLLOWER', followerId }
                    }];
                    const chunks = expo.chunkPushNotifications(messages);
                    for (const chunk of chunks) {
                        await expo.sendPushNotificationsAsync(chunk);
                    }
                }
            } catch (notifErr) {
                logger.warn("[ToggleFollow] Failed to send follow notification:", notifErr.message);
            }
        }

        response.status(200).send({ success: true, action });
    } catch (error) {
        logger.error("[ToggleFollow] Error:", error);
        response.status(500).send({ error: "Internal Server Error", message: error.message });
    }
});


/*
----------------------------------
FIRESTORE TRIGGERS
----------------------------------
*/

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

exports.onEventUpdated = onDocumentUpdated("events/{eventId}", async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    // Only act when status changes TO 'cancelled'
    if (beforeData.status === 'cancelled' || afterData.status !== 'cancelled') return;

    const eventId = event.params.eventId;
    const eventTitle = afterData.title || 'Your Event';
    const eventDate = afterData.date || 'N/A';

    logger.info(`[onEventUpdated] Event "${eventTitle}" (${eventId}) was cancelled. Notifying attendees.`);

    try {
        const db = admin.firestore();

        // Get all valid ticket holders (not pending/cancelled tickets)
        const ticketsSnapshot = await db.collection("tickets")
            .where("eventId", "==", eventId)
            .where("status", "in", ["valid", "scanned"])
            .get();

        if (ticketsSnapshot.empty) {
            logger.info(`[onEventUpdated] No attendees to notify for event ${eventId}.`);
            return;
        }

        // Collect unique userIds
        const userIdSet = new Set();
        ticketsSnapshot.docs.forEach(doc => {
            const uid = doc.data().userId;
            if (uid) userIdSet.add(uid);
        });

        logger.info(`[onEventUpdated] Notifying ${userIdSet.size} unique attendees.`);

        const notificationBatch = db.batch();
        const emailPromises = [];

        for (const userId of userIdSet) {
            // 1. In-app notification (triggers push via sendPushNotification trigger)
            const notifRef = db.collection("notifications").doc();
            notificationBatch.set(notifRef, {
                toUserId: userId,
                title: `Event Cancelled: ${eventTitle} ❌`,
                message: `We're sorry, "${eventTitle}" has been cancelled by the organizer.`,
                data: { type: "EVENT_CANCELLED", eventId },
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 2. Email notification
            emailPromises.push(
                (async () => {
                    try {
                        const userDoc = await db.collection("users").doc(userId).get();
                        if (!userDoc.exists) return;
                        const { email, name } = userDoc.data();
                        if (!email) return;

                        const html = getCancellationTemplate(name || 'Attendee', eventTitle, eventDate);
                        const text = `Hi ${name || 'Attendee'},\n\nWe're sorry to inform you that "${eventTitle}" (scheduled for ${eventDate}) has been cancelled by the organizer.\n\nIf you purchased a paid ticket, please contact support@croww.ai for assistance with a refund.\n\nThe Croww Team`;
                        await sendEmail({
                            to: email,
                            subject: `Event Cancelled: ${eventTitle}`,
                            html,
                            text
                        });
                        logger.info(`[onEventUpdated] Cancellation email sent to ${email}`);
                    } catch (emailErr) {
                        logger.warn(`[onEventUpdated] Email failed for userId ${userId}:`, emailErr);
                    }
                })()
            );
        }

        // Commit all notifications and await all emails in parallel
        await Promise.all([notificationBatch.commit(), ...emailPromises]);
        logger.info(`[onEventUpdated] Done notifying attendees of event ${eventId} cancellation.`);
    } catch (error) {
        logger.error("Error in onEventUpdated trigger:", error);
    }
});

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
