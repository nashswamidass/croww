const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const { Cashfree, CFEnvironment } = require("cashfree-pg");
const { Expo } = require("expo-server-sdk");
const admin = require("firebase-admin");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

admin.initializeApp();

const expo = new Expo();
const { sendEmail, getWelcomeTemplate, getPasswordResetTemplate } = require("./emails");


/**
 * Generate X-Cf-Signature for Cashfree Public Key 2FA
 * Encrypts "clientId.timestamp" with RSA public key, returns base64
 */
const generateCfSignature = (clientId) => {
    try {
        const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
        const dataToEncrypt = `${clientId}.${timestamp}`;

        // Read the public key
        const publicKeyPath = path.join(__dirname, "cashfree_public_key.pem");
        const publicKey = fs.readFileSync(publicKeyPath, "utf8");

        // RSA encrypt with public key
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
        logger.info(`Generated X-Cf-Signature for clientId ${clientId.substring(0, 8)}... at timestamp ${timestamp}`);
        return signature;
    } catch (error) {
        logger.error("Error generating Cf Signature:", error);
        // Try with PKCS1 v1.5 padding as fallback
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
            const signature = encrypted.toString("base64");
            logger.info(`Generated X-Cf-Signature (PKCS1 v1.5 fallback) for clientId ${clientId.substring(0, 8)}...`);
            return signature;
        } catch (fallbackError) {
            logger.error("Fallback signature generation also failed:", fallbackError);
            return null;
        }
    }
};

const getCashfreeInstance = (environmentName = "SANDBOX") => {
    // Priority: 1. Env Vars (Gen 2), 2. Hardcoded Sandbox Keys (Fallback)
    const clientId = process.env.CASHFREE_CLIENT_ID || "TEST10990759f216be3b56c5acb8a37495709901";
    const clientSecret = process.env.CASHFREE_CLIENT_SECRET || "cfsk_ma_test_ed365f96f0455a6e9d005be3af1dbd0c_d381d9b2";

    // SAFETY: If no production secrets are configured, FORCE sandbox mode
    // to prevent using sandbox keys against the production API (causes 500)
    let effectiveEnv = environmentName;
    if (!process.env.CASHFREE_CLIENT_ID && environmentName === "PRODUCTION") {
        logger.warn("⚠️ No production CASHFREE_CLIENT_ID set! Falling back to SANDBOX mode.");
        effectiveEnv = "SANDBOX";
    }

    const cfEnv = effectiveEnv === "PRODUCTION" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;

    logger.info(`Initializing Cashfree [${effectiveEnv}] with Client ID:`, clientId.substring(0, 8) + "...");

    // V5 SDK: Instance based
    const cashfree = new Cashfree(cfEnv, clientId, clientSecret);
    cashfree.XApiVersion = "2023-08-01"; // Required for current order schema

    return cashfree;
};

exports.createCashfreeOrder = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    logger.info("createCashfreeOrder hit! [DYNAMIC_ENV_FIX]", { method: request.method, body: request.body });

    try {
        const { orderAmount, customerId, customerPhone, customerName, customerEmail, environment } = request.body;

        // SANITIZE: Remove any non-numeric characters from phone
        let sanitizedPhone = (customerPhone || "").replace(/\D/g, '');
        // Cashfree usually expects 10 digits for Indian numbers. If it's 12 (with 91), take the last 10.
        if (sanitizedPhone.length > 10) {
            sanitizedPhone = sanitizedPhone.slice(-10);
        }

        // SANITIZE: Customer ID should be alphanumeric
        const sanitizedCustomerId = (customerId || "").replace(/[^a-zA-Z0-9_\-\.]/g, '');

        if (!orderAmount || !sanitizedCustomerId || sanitizedPhone.length < 10) {
            logger.warn("Validation failed:", { orderAmount, sanitizedCustomerId, sanitizedPhone });
            response.status(400).send({
                error: "Invalid request data",
                message: "Ensure orderAmount > 0, customerId is valid, and phone is exactly 10 digits."
            });
            return;
        }

        const cashfree = getCashfreeInstance(environment);
        const orderId = `ORDER_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const appUrl = "https://croww-app.web.app"; // Default production app URL

        const requestData = {
            order_amount: Number(parseFloat(orderAmount).toFixed(2)),
            order_currency: "INR",
            order_id: orderId,
            customer_details: {
                customer_id: sanitizedCustomerId,
                customer_name: customerName || "Customer",
                customer_email: customerEmail || "customer@example.com",
                customer_phone: sanitizedPhone,
            },
            order_meta: {
                return_url: `${appUrl}/payment-return?order_id=${orderId}`,
            },
            order_note: "Croww App Booking",
        };

        logger.info("Calling PGCreateOrder with:", requestData);
        // V5 SDK: method called on instance
        const apiResponse = await cashfree.PGCreateOrder(requestData);
        logger.info("Cashfree Success Response:", apiResponse.data);

        response.status(200).send(apiResponse.data);

    } catch (error) {
        logger.error("Error creating order:", error);

        // Passthrough specific Cashfree errors if available
        if (error.response && error.response.data) {
            const cfError = error.response.data;
            logger.error("Cashfree API Rejected:", cfError);
            response.status(error.response.status || 400).send({
                error: cfError.message || "Cashfree API Error",
                code: cfError.code,
                type: cfError.type,
                details: cfError
            });
        } else {
            response.status(500).send({
                error: "Failed to create order",
                message: error.message
            });
        }
    }
});

exports.verifyCashfreePayment = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    logger.info("verifyCashfreePayment hit!", { body: request.body });

    try {
        const { orderId } = request.body;

        if (!orderId) {
            logger.warn("Missing orderId in verify request");
            response.status(400).send({ error: "Missing orderId" });
            return;
        }

        const cashfree = getCashfreeInstance();
        // V5 SDK: method called on instance
        const apiResponse = await cashfree.PGOrderFetchPayments(orderId);

        // Find successful payment
        const payments = apiResponse.data || [];
        const successPayment = payments.find(p => p.payment_status === 'SUCCESS');

        response.status(200).send({
            order_id: orderId,
            status: successPayment ? 'PAID' : 'PENDING',
            payment_details: successPayment || null
        });

    } catch (error) {
        logger.error("Error verifying payment:", error);
        // Passthrough specific Cashfree errors if available
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

/**
 * [NEW] Generate DigiLocker Verification URL
 */
exports.getDigiLockerUrl = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    logger.info("getDigiLockerUrl hit!", { body: request.body });

    try {
        const { userFlow, environment, clientId: reqClientId, clientSecret: reqClientSecret } = request.body;
        const clientId = reqClientId || process.env.CASHFREE_CLIENT_ID || "TEST10990759f216be3b56c5acb8a37495709901";
        const clientSecret = reqClientSecret || process.env.CASHFREE_CLIENT_SECRET || "cfsk_ma_test_ed365f96f0455a6e9d005be3af1dbd0c_d381d9b2";
        logger.info(`DigiLocker using clientId: ${clientId.substring(0, 8)}... env: ${environment}`);

        const baseUrl = environment === "PRODUCTION"
            ? "https://api.cashfree.com/verification/digilocker"
            : "https://sandbox.cashfree.com/verification/digilocker";

        const verificationId = `VER-${Date.now()}`;
        const appUrl = "https://croww-app.web.app";

        logger.info(`Initiating DigiLocker for ${verificationId} on ${environment}`);

        const fetchWithFallback = async (url) => {
            logger.info(`Calling Cashfree: ${url}`);
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

        // FALLBACK: Try alternative path if first one fails for ANY reason
        if (!apiResponse.ok) {
            logger.info(`DigiLocker Primary URL failed [${apiResponse.status}], trying /identity fallback...`);
            const altUrl = environment === "PRODUCTION"
                ? "https://api.cashfree.com/identity/verification/digilocker"
                : "https://sandbox.cashfree.com/identity/verification/digilocker";

            if (baseUrl !== altUrl) {
                apiResponse = await fetchWithFallback(altUrl);
            }
        }

        let data;
        const responseText = await apiResponse.text();
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = { rawResponse: responseText };
        }

        if (!apiResponse.ok) {
            logger.error("Cashfree API Error Response:", {
                status: apiResponse.status,
                data: data
            });
            response.status(apiResponse.status).send({
                error: "Cashfree API Error",
                message: data.message || data.msg || `Verification Error (Status ${apiResponse.status})`,
                details: data
            });
            return;
        }

        logger.info("Cashfree Verification API success:", { verification_id: data.verification_id });
        response.status(200).send(data);

    } catch (error) {
        logger.error("Error generating DigiLocker URL:", error);
        response.status(500).send({
            error: "Internal Server Error",
            message: error.message
        });
    }
});

/**
 * [NEW] Get DigiLocker Verification Status
 */
exports.getDigiLockerStatus = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    logger.info("getDigiLockerStatus hit!", { body: request.body });

    try {
        const { verificationId, environment, clientId: reqClientId, clientSecret: reqClientSecret } = request.body;
        const clientId = reqClientId || process.env.CASHFREE_CLIENT_ID || "TEST10990759f216be3b56c5acb8a37495709901";
        const clientSecret = reqClientSecret || process.env.CASHFREE_CLIENT_SECRET || "cfsk_ma_test_ed365f96f0455a6e9d005be3af1dbd0c_d381d9b2";
        logger.info(`DigiLocker status using clientId: ${clientId.substring(0, 8)}... env: ${environment}`);

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

        const status = apiResponse.status;
        const responseText = await apiResponse.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = { rawResponse: responseText };
        }

        if (!apiResponse.ok) {
            logger.error("Cashfree API Error Response:", { status, data });
            response.status(status).send({
                error: "Cashfree API Error",
                message: data.message || data.msg || `Status Check Error (Status ${status})`,
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

/**
 * [NEW] Initiate Aadhaar Integrated OTP Verification
 */
exports.initiateAadhaarOTP = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    logger.info("initiateAadhaarOTP hit!", { body: request.body });

    try {
        const { aadhaarNumber, environment, clientId: reqClientId, clientSecret: reqClientSecret } = request.body;
        const clientId = reqClientId || process.env.CASHFREE_CLIENT_ID || "TEST10990759f216be3b56c5acb8a37495709901";
        const clientSecret = reqClientSecret || process.env.CASHFREE_CLIENT_SECRET || "cfsk_ma_test_ed365f96f0455a6e9d005be3af1dbd0c_d381d9b2";
        logger.info(`Aadhaar OTP using clientId: ${clientId.substring(0, 8)}... env: ${environment}`);

        if (!aadhaarNumber) {
            response.status(400).send({ error: "Missing aadhaarNumber" });
            return;
        }

        // [SANDBOX BYPASS] for development testing
        if (environment === "SANDBOX" && aadhaarNumber === "000000000000") {
            logger.info("Sandbox Bypass triggered for Aadhaar Verification");
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

        // Try ALL known Cashfree Aadhaar OTP endpoint paths
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

        const body = JSON.stringify({
            aadhaar_number: aadhaarNumber,
            verification_id: verificationId
        });

        let apiResponse = null;
        let lastStatus = 0;

        for (const url of urlsToTry) {
            logger.info(`Trying Aadhaar OTP endpoint: ${url}`);
            try {
                apiResponse = await fetch(url, {
                    method: "POST",
                    headers,
                    body,
                    timeout: 15000
                });
                lastStatus = apiResponse.status;
                logger.info(`Endpoint ${url} returned status: ${lastStatus}`);
                if (apiResponse.ok) {
                    logger.info(`SUCCESS with endpoint: ${url}`);
                    break;
                }
                // Read body to prevent connection issues, but don't consume it for the last attempt
                if (urlsToTry.indexOf(url) < urlsToTry.length - 1) {
                    await apiResponse.text(); // consume body
                    apiResponse = null; // reset so we don't use stale response
                }
            } catch (fetchErr) {
                logger.warn(`Fetch error for ${url}: ${fetchErr.message}`);
            }
        }

        if (!apiResponse) {
            response.status(500).send({
                error: "All Cashfree endpoints failed",
                message: `None of the ${urlsToTry.length} endpoint paths returned a successful response. Last status: ${lastStatus}`
            });
            return;
        }

        const responseText = await apiResponse.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = { rawResponse: responseText };
        }

        logger.info("Cashfree OTP Init Details:", { status: apiResponse.status, ok: apiResponse.ok, data });

        if (!apiResponse.ok) {
            response.status(apiResponse.status).send({
                error: "Cashfree API Error",
                message: data.message || data.msg || `OTP Init Error (Status ${apiResponse.status})`,
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


/**
 * [NEW] Verify Aadhaar Integrated OTP
 */
exports.verifyAadhaarOTP = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    logger.info("verifyAadhaarOTP hit!", { body: request.body });

    try {
        const { refId, otp, environment, clientId: reqClientId, clientSecret: reqClientSecret } = request.body;
        const clientId = reqClientId || process.env.CASHFREE_CLIENT_ID || "TEST10990759f216be3b56c5acb8a37495709901";
        const clientSecret = reqClientSecret || process.env.CASHFREE_CLIENT_SECRET || "cfsk_ma_test_ed365f96f0455a6e9d005be3af1dbd0c_d381d9b2";
        logger.info(`Aadhaar OTP verify using clientId: ${clientId.substring(0, 8)}... env: ${environment}`);

        if (!refId || !otp) {
            response.status(400).send({ error: "Missing refId or otp" });
            return;
        }

        // [SANDBOX BYPASS] for development testing
        if (environment === "SANDBOX" && (refId === "BYPASS-REF-ID" || otp === "000000")) {
            logger.info("Sandbox Bypass triggered for OTP Verification");
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

        // Try ALL known Cashfree Aadhaar verify endpoint paths
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

        const body = JSON.stringify({
            ref_id: refId,
            otp: otp
        });

        let apiResponse = null;
        let lastStatus = 0;

        for (const url of urlsToTry) {
            logger.info(`Trying Aadhaar Verify endpoint: ${url}`);
            try {
                apiResponse = await fetch(url, {
                    method: "POST",
                    headers,
                    body,
                    timeout: 15000
                });
                lastStatus = apiResponse.status;
                logger.info(`Endpoint ${url} returned status: ${lastStatus}`);
                if (apiResponse.ok) {
                    logger.info(`SUCCESS with endpoint: ${url}`);
                    break;
                }
                if (urlsToTry.indexOf(url) < urlsToTry.length - 1) {
                    await apiResponse.text();
                    apiResponse = null;
                }
            } catch (fetchErr) {
                logger.warn(`Fetch error for ${url}: ${fetchErr.message}`);
            }
        }

        if (!apiResponse) {
            response.status(500).send({
                error: "All Cashfree endpoints failed",
                message: `None of the ${urlsToTry.length} endpoint paths returned a successful response. Last status: ${lastStatus}`
            });
            return;
        }

        const responseText = await apiResponse.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = { rawResponse: responseText };
        }

        logger.info("Cashfree OTP Verify Details:", { status: apiResponse.status, ok: apiResponse.ok, data });

        if (!apiResponse.ok) {
            response.status(apiResponse.status).send({
                error: "Cashfree API Error",
                message: data.message || data.msg || `OTP Verify Error (Status ${apiResponse.status})`,
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


/**
 * [NEW] Trigger to send push notification when a record is added to 'notifications'
 */
exports.sendPushNotification = onDocumentCreated("notifications/{notificationId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        logger.error("No data associated with the event");
        return;
    }

    const notification = snapshot.data();
    const { toUserId, title, message, data } = notification;

    if (!toUserId) {
        logger.warn("No toUserId found in notification record:", event.params.notificationId);
        return;
    }

    try {
        // Fetch the user's push token
        const userDoc = await admin.firestore().collection("users").doc(toUserId).get();
        if (!userDoc.exists) {
            logger.warn(`User ${toUserId} not found in Firestore`);
            return;
        }

        const userData = userDoc.data();
        const pushToken = userData.pushToken;

        if (!pushToken) {
            logger.info(`User ${toUserId} does not have a pushToken registered`);
            return;
        }

        if (!Expo.isExpoPushToken(pushToken)) {
            logger.error(`Push token ${pushToken} is not a valid Expo push token`);
            return;
        }

        // Prepare the message
        const messages = [{
            to: pushToken,
            sound: 'default',
            title: title || 'New Notification',
            body: message || 'You have a new message from Croww',
            data: data || {},
        }];

        // Send the notification
        const chunks = expo.chunkPushNotifications(messages);
        const tickets = [];

        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                logger.info("Push Ticket Chunk:", ticketChunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                logger.error("Error sending push notification chunk:", error);
            }
        }

        logger.info(`Successfully processed push notification for user ${toUserId}`);

    } catch (error) {
        logger.error("Error in sendPushNotification trigger:", error);
    }
});

/**
 * [NEW] Trigger: Send Welcome Email when a new user profile is created in Firestore
 */
exports.sendWelcomeEmail = onDocumentCreated("users/{userId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const userData = snapshot.data();
    const { email, name } = userData;

    if (!email) {
        logger.warn(`No email found for user ${event.params.userId}`);
        return;
    }

    try {
        const html = getWelcomeTemplate(name || "there");
        await sendEmail({
            to: email,
            subject: `Welcome to Croww, ${name || "User"}!`,
            html: html
        });
        logger.info(`Welcome email sent to ${email}`);
    } catch (error) {
        logger.error(`Failed to send welcome email to ${email}:`, error);
    }
});

/**
 * [NEW] HTTPS Function: Send a custom, branded password reset email
 */
exports.sendCustomPasswordReset = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
    logger.info("sendCustomPasswordReset hit!", { body: request.body });

    try {
        const { email } = request.body;

        if (!email) {
            response.status(400).send({ error: "Missing email" });
            return;
        }

        // 1. Check if user exists
        let userRecord;
        try {
            userRecord = await admin.auth().getUserByEmail(email);
        } catch (e) {
            // Security best practice: Don't reveal if user exists. 
            // Just return success even if not found, or a generic message.
            logger.info(`Password reset requested for non-existent email: ${email}`);
            response.status(200).send({ message: "If an account exists with this email, a reset link has been sent." });
            return;
        }

        // 2. Generate the Firebase Auth reset link
        // This handles the security/tokens automatically
        const actionCodeSettings = {
            url: 'https://croww-live-2026.firebaseapp.com/login', // Use canonically allowlisted domain
            handleCodeInApp: false
        };
        const resetLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);

        // 3. Send the custom HTML email
        const html = getPasswordResetTemplate(userRecord.displayName || "User", resetLink);

        const emailResult = await sendEmail({
            to: email,
            subject: "Reset your Croww password",
            html: html
        });

        if (!emailResult.success) {
            logger.error(`[Auth] sendEmail failed for ${email}:`, emailResult.error);
            response.status(500).send({
                error: "SMTP Error",
                message: emailResult.error
            });
            return;
        }

        logger.info(`Successfully sent custom reset email to ${email}`);

        response.status(200).send({
            success: true,
            message: "Custom reset email sent successfully."
        });

    } catch (error) {
        logger.error("Error in sendCustomPasswordReset:", error);

        // Handle specific Firebase Auth errors
        if (error.code === 'auth/quota-exceeded' || error.message?.includes('EXCEED_LIMIT')) {
            response.status(429).send({
                error: "Rate Limit Exceeded",
                message: "Too many password reset requests. Please wait a few minutes and try again."
            });
            return;
        }

        response.status(500).send({
            error: "Internal Server Error",
            message: error.message
        });
    }
});


/**
 * Automatically delete events that are older than 24 hours.
 * Runs every day at midnight (UTC).
 */
exports.cleanupExpiredEvents = onSchedule("0 0 * * *", async (event) => {
    logger.info("[Cleanup] Starting cleanupExpiredEvents job");
    const now = new Date();
    // Delete events that started more than 24 hours ago
    const cutoffDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const cutoffISO = cutoffDate.toISOString();

    const eventsRef = admin.firestore().collection("events");
    // Filter for events where the date field is less than the cutoff
    const q = eventsRef.where("date", "<", cutoffISO);

    try {
        const snapshot = await q.get();
        if (snapshot.empty) {
            logger.info("[Cleanup] No expired events found to clean up.");
            return;
        }

        logger.info(`[Cleanup] Found ${snapshot.size} expired events. Preparing batch delete...`);

        // Firestore batch delete (limited to 500 documents per batch)
        const batch = admin.firestore().batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        logger.info(`[Cleanup] Successfully deleted ${snapshot.size} expired events.`);
    } catch (error) {
        logger.error("[Cleanup] Error in cleanupExpiredEvents:", error);
    }
});
