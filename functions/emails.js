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
            <img src="https://croww-app.web.app/croww-logo.png" alt="${APP_NAME}" style="height: 60px; width: auto; display: block; margin: 0 auto;">
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
    <a href="https://croww-app.web.app" class="button">Start Exploring</a>
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
const sendEmail = async ({ to, subject, html }) => {
    const fromEmail = process.env.SMTP_USER || 'support@croww.ai';
    const pass = process.env.SMTP_PASS || '44342a1d35fc27b39434a4020157f912-58d4d6a2-213f82c8';

    logger.info(`[EmailService] Preparing to send email to: ${to} | Subject: ${subject}`);
    logger.info(`[EmailService] SMTP Config - User: ${fromEmail}, PassLength: ${pass ? pass.length : 0}`);

    try {
        if (!fromEmail || !pass) {
            logger.warn("[EmailService] No SMTP credentials available. Check .env or process.env.");
            return { success: false, error: "Missing SMTP credentials" };
        }

        // Initialize transporter locally to ensure env vars are fresh
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.mailgun.org',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
                user: fromEmail,
                pass: pass,
            },
        });

        // 1. Verify connection configuration
        try {
            await transporter.verify();
            logger.info("[EmailService] SMTP connection verified successfully.");
        } catch (verifyError) {
            logger.error("[EmailService] SMTP verification failed (535 usually means bad user/pass):", verifyError);
            throw verifyError;
        }

        // Display a more professional "From" name even if using postmaster
        const senderAddress = process.env.SMTP_FROM || `support@mg.croww.ai`;

        const info = await transporter.sendMail({
            from: `"${APP_NAME}" <${senderAddress}>`,
            to,
            subject,
            html,
        });

        logger.info(`[EmailService] Email sent successfully! MessageId: ${info.messageId}`);
        return { success: true };
    } catch (error) {
        logger.error("[EmailService] Critical error in sendEmail:", error);
        return { success: false, error: error.message || error.code || "Unknown SMTP Error" };
    }
};

module.exports = {
    sendEmail,
    getWelcomeTemplate,
    getPasswordResetTemplate,
};
