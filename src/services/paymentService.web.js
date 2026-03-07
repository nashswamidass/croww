import { Platform } from 'react-native';

const loadCashfreeSdk = () => {
    if (Platform.OS !== 'web') return Promise.resolve(false);

    return new Promise((resolve, reject) => {
        if (typeof window !== 'undefined' && window.Cashfree) {
            resolve(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
        script.onload = () => {
            console.log('Cashfree SDK loaded');
            resolve(true);
        };
        script.onerror = () => {
            console.error('Failed to load Cashfree SDK');
            reject(new Error('Failed to load Cashfree SDK'));
        };
        document.body.appendChild(script);
    });
};

class PaymentService {
    constructor() {
        // Check if environment variables are loaded (env vars are baked at build time)
        let envVal = (process.env.EXPO_PUBLIC_CASHFREE_ENV || 'SANDBOX').toUpperCase();

        // --- SECURE WEB OVERRIDE (FIX V2) ---
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            console.log("[AUTH_FIX_DEPLOY_V2_WEB] Web Hostname detected:", hostname);

            // If we're not on localhost/127.0.0.1, assume PRODUCTION
            const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
            if (!isLocal || hostname === 'croww.ai' || hostname === 'croww-app.web.app' || hostname === 'croww-live-2026.web.app') {
                console.log("[AUTH_FIX_DEPLOY_V2_WEB] Production domain detected. FORCING PRODUCTION MODE.");
                envVal = 'PRODUCTION';
            }
        }

        console.log("[AUTH_FIX_DEPLOY_V2_WEB] Environment set to:", envVal);

        // Standardize normalization
        this.environment = envVal === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';

        // Final sanity check for web
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            if (this.environment === 'SANDBOX' && (hostname === 'croww.ai' || hostname === 'croww-app.web.app' || hostname === 'croww-live-2026.web.app')) {
                console.warn("[AUTH_FIX_DEPLOY_V2_WEB] CRITICAL WARNING - Domain is Production but Environment is SANDBOX.");
            }
        }

        console.log("[AUTH_FIX_DEPLOY_V2_WEB] Final environment state:", this.environment);
    }

    /**
     * Check if Native Cashfree SDK is available
     */
    isNativeAvailable() {
        return false;
    }

    /**
     * No-op on web
     */
    setCallback(onVerify, onError) { }

    /**
     * No-op on web
     */
    removeCallback() { }

    /**
     * Initiate payment
     * @param {string} paymentSessionId - Session ID from backend
     * @param {string} orderId - Order ID
     */
    async doPayment(paymentSessionId, orderId) {
        try {
            console.log('--- STARTING WEB PAYMENT FLOW ---');
            console.log('SessionID:', paymentSessionId);
            console.log('OrderID:', orderId);
            console.log('Environment:', this.environment);

            if (!paymentSessionId) {
                throw new Error('Missing Payment Session ID');
            }

            await loadCashfreeSdk();

            const cashfree = new window.Cashfree({
                mode: this.environment === 'PRODUCTION' ? "production" : "sandbox"
            });

            const appUrl = process.env.EXPO_PUBLIC_CASHFREE_APP_URL || window.location.origin;

            // Redirect via SDK
            cashfree.checkout({
                paymentSessionId: paymentSessionId,
                returnUrl: `${appUrl}/payment-return?order_id=${orderId}`,
                redirectTarget: "_modal"
            });
        } catch (error) {
            console.error('Error initiating web payment:', error);
            throw error;
        }
    }

    /**
     * Fetch payment session from backend
     */
    async createOrder(amount, customerId, customerPhone, customerName, customerEmail) {
        try {
            const API_URL = 'https://createcashfreeorder-6vktyfoeaa-uc.a.run.app';

            if (!customerId) {
                throw new Error('Customer ID is required');
            }

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    orderAmount: amount,
                    customerId: customerId,
                    customerPhone: customerPhone,
                    customerName: customerName,
                    customerEmail: customerEmail,
                    environment: this.environment === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX'
                }),
            });

            const responseText = await response.text();

            if (!response.ok) {
                console.error('Backend error status:', response.status);
                throw new Error(`Server returned ${response.status}: ${responseText}`);
            }

            const data = JSON.parse(responseText);
            console.log("PaymentServiceWeb: Backend Order JSON:", data);

            const sessionId = data.payment_session_id || data.paymentSessionId || data.payment_session || data.session_id;
            const orderId = data.order_id || data.orderId;

            return { sessionId, orderId };
        } catch (error) {
            console.error('Error creating web order:', error);
            throw error;
        }
    }

    /**
     * Verify payment with backend
     */
    async verifyPayment(orderId) {
        try {
            const API_URL = 'https://verifycashfreepayment-6vktyfoeaa-uc.a.run.app';

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    orderId,
                    environment: this.environment
                }),
            });

            const responseText = await response.text();
            if (!response.ok) {
                console.error('Verify web error status:', response.status);
                throw new Error(`Server returned ${response.status}: ${responseText}`);
            }
            const data = JSON.parse(responseText);
            return data;
        } catch (error) {
            console.error('Error verifying web payment:', error);
            throw error;
        }
    }
}

export const paymentService = new PaymentService();
