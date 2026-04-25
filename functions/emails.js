const nodemailer = require('nodemailer');
const logger = require("firebase-functions/logger");

// Configuration constants
const APP_NAME = 'Croww';
const APP_COLOR = '#800080'; // Purple accent used in the app
const BG_COLOR = '#000000';
const TEXT_COLOR = '#FFFFFF';

/**
 * Base Email Wrapper
 */
const getBaseHtml = (content) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: ${BG_COLOR};
            color: ${TEXT_COLOR};
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .logo {
            font-size: 32px;
            font-weight: bold;
            color: ${APP_COLOR};
            letter-spacing: 2px;
            text-transform: uppercase;
        }
        .content {
            background-color: #111111;
            padding: 40px;
            border-radius: 16px;
            border: 1px solid #222222;
            line-height: 1.6;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            font-size: 12px;
            color: #666666;
        }
        .button {
            display: inline-block;
            padding: 16px 32px;
            background-color: ${APP_COLOR};
            color: #FFFFFF !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            margin-top: 24px;
        }
        h1 { margin-top: 0; color: #FFFFFF; font-size: 24px; }
        p { margin-bottom: 20px; color: #CCCCCC; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://croww.ai/croww-logo.png" alt="${APP_NAME}" style="height: 60px; width: auto; display: block; margin: 0 auto;">
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            &copy; 2026 ${APP_NAME}. All rights reserved.<br>
            Premium Experiences & Events
        </div>
    </div>
</body>
</html>
`;

/**
 * Welcome Email Template
 */
const getWelcomeTemplate = (name) => getBaseHtml(`
    <h1>Welcome to ${APP_NAME}, ${name}!</h1>
    <p>We're thrilled to have you join our exclusive community of event enthusiasts and service providers.</p>
    <p>Start exploring the most premium events and services curated just for you.</p>
    <a href="https://croww.ai" class="button">Start Exploring</a>
    <p style="margin-top: 30px; font-size: 14px;">If you have any questions, feel free to reply to this email.</p>
`);

/**
 * Password Reset Template
 */
const getPasswordResetTemplate = (name, resetLink) => getBaseHtml(`
    <h1>Reset Your Password</h1>
    <p>Hi ${name},</p>
    <p>We received a request to reset your password for your ${APP_NAME} account.</p>
    <p>Click the button below to choose a new password. This link will expire in 1 hour.</p>
    <a href="${resetLink}" class="button">Reset Password</a>
    <p style="margin-top: 30px; font-size: 14px; color: #888;">If you didn't request a password reset, you can safely ignore this email.</p>
`);

/**
 * Generic Email Sending Utility
 */
const sendEmail = async ({ to, subject, html, text }) => {
    const apiKey = process.env.MAILGUN_API_KEY;
    const fromAddress = process.env.SMTP_FROM || 'support@croww.ai';
    const domain = fromAddress.split('@')[1] || 'croww.ai';

    logger.info(`[EmailService-V2-HTTP] Preparing email to: ${to} | Subject: ${subject}`);

    try {
        if (!apiKey) {
            logger.error("[EmailService] MAILGUN_API_KEY is missing in env.");
            return { success: false, error: "Missing API Key" };
        }

        // Mailgun API uses Basic Auth with 'api:API_KEY'
        const auth = Buffer.from(`api:${apiKey}`).toString('base64');
        const endpoint = `https://api.mailgun.net/v3/${domain}/messages`;

        // We use URLSearchParams for the form-data body required by Mailgun
        const params = new URLSearchParams();
        params.append('from', `"${APP_NAME}" <${fromAddress}>`);
        params.append('to', to);
        params.append('subject', subject);
        params.append('html', html);
        if (text) params.append('text', text);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok) {
            logger.info(`[EmailService] Sent! ID: ${data.id}. Message: ${data.message}`);
            return { success: true };
        } else {
            logger.error(`[EmailService] Mailgun API Error: ${response.status}`, data);
            return { success: false, error: data.message || "Mailgun API Error" };
        }
    } catch (error) {
        logger.error("[EmailService] Fetch Error:", error);
        return { success: false, error: error.message || "Unknown error" };
    }
};

/**
 * Event Cancellation Email Template
 */
const getCancellationTemplate = (attendeeName, eventTitle, eventDate) => getBaseHtml(`
    <h1>Event Cancelled: ${eventTitle}</h1>
    <p>Hi ${attendeeName},</p>
    <p>We're sorry to let you know that the following event has been <strong style="color: #cc3333;">cancelled</strong> by the organizer:</p>
    <p style="font-size: 20px; font-weight: bold; color: #fff; padding: 16px; background: #1a1a1a; border-radius: 8px; border-left: 4px solid #800080;">
        ${eventTitle}
    </p>
    <p style="color: #888;">Originally scheduled for: ${eventDate}</p>
    <p>If you purchased a paid ticket, please contact the organizer or our support team at <a href="mailto:support@croww.ai" style="color: #800080;">support@croww.ai</a> for a refund.</p>
    <p style="margin-top: 30px; font-size: 14px;">We're sorry for the inconvenience. The Croww team will do our best to keep you informed of new events in your area.</p>
    <a href="https://croww.ai" class="button">Browse Other Events</a>
`);

module.exports = {
    sendEmail,
    getWelcomeTemplate,
    getPasswordResetTemplate,
    getCancellationTemplate,
};
