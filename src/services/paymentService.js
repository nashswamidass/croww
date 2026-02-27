import { Platform } from 'react-native';

// Dynamically import SDKs only on Native platforms to prevent web build failures
let CFPaymentGatewayService, CFSession, CFThemeBuilder, CFEnvironment, CFDropCheckoutPayment, CFPaymentComponentBuilder;

if (Platform.OS !== 'web') {
    try {
        const SDK = require('react-native-cashfree-pg-sdk');
        const Contract = require('cashfree-pg-api-contract');

        CFPaymentGatewayService = SDK.CFPaymentGatewayService;
        CFSession = Contract.CFSession;
        CFThemeBuilder = Contract.CFThemeBuilder;
        CFEnvironment = Contract.CFEnvironment;
        CFDropCheckoutPayment = Contract.CFDropCheckoutPayment;
        CFPaymentComponentBuilder = Contract.CFPaymentComponentBuilder;
    } catch (e) {
        console.warn('Cashfree SDKs not found or failed to load on native:', e.message);
    }
} else {
    // Mock environment constants for Web
    CFEnvironment = {
        PRODUCTION: 'PRODUCTION',
        SANDBOX: 'SANDBOX'
    };
}

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
        this.cfPaymentGatewayService = CFPaymentGatewayService;
        // Check if environment variables are loaded
        const env = process.env.EXPO_PUBLIC_CASHFREE_ENV || 'SANDBOX';
        // Safely access CFEnvironment - it may be undefined if native SDKs aren't installed
        if (CFEnvironment) {
            this.environment = env === 'PRODUCTION' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
        } else {
            this.environment = env === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
        }
    }

    /**
     * Check if Native Cashfree SDK is available
     */
    isNativeAvailable() {
        return Platform.OS !== 'web' && !!this.cfPaymentGatewayService && !!CFSession;
    }

    /**
     * Set the payment callback listener
     * @param {function} onVerify - Callback for verification failure/success logic (usually verifying on backend)
     * @param {function} onError - Callback for errors
     */
    setCallback(onVerify, onError) {
        if (Platform.OS === 'web' || !this.cfPaymentGatewayService) return;

        this.cfPaymentGatewayService.setCallback({
            onVerify: (orderId) => {
                console.log('Payment Verified for Order:', orderId);
                if (onVerify) onVerify(orderId);
            },
            onError: (error, orderId) => {
                console.log('Payment Failed/Error:', error, 'Order:', orderId);
                if (onError) onError(error, orderId);
            }
        });
    }

    /**
     * Remove the payment callback listener
     */
    removeCallback() {
        if (Platform.OS === 'web' || !this.cfPaymentGatewayService) return;
        this.cfPaymentGatewayService.removeCallback();
    }

    /**
     * Initiate payment
     * @param {string} paymentSessionId - Session ID from backend
     * @param {string} orderId - Order ID
     */
    async doPayment(paymentSessionId, orderId) {
        try {
            console.log('--- STARTING PAYMENT FLOW ---');
            console.log('SessionID:', paymentSessionId);
            console.log('OrderID:', orderId);
            console.log('Environment:', this.environment);

            if (!paymentSessionId) {
                throw new Error('Missing Payment Session ID');
            }

            if (Platform.OS === 'web') {
                await loadCashfreeSdk();

                const cashfree = new window.Cashfree({
                    mode: this.environment === 'PRODUCTION' ? "production" : "sandbox"
                });

                const appUrl = process.env.EXPO_PUBLIC_CASHFREE_APP_URL || window.location.origin;

                // Redirect via SDK
                cashfree.checkout({
                    paymentSessionId: paymentSessionId,
                    returnUrl: `${appUrl}/payment-return?order_id=${orderId}`,
                    redirectTarget: "_self"
                });
                return;
            }

            // --- Native Only Logic ---
            if (!this.isNativeAvailable()) {
                throw new Error('Native Payment SDK not available. Please use Web flow or custom build.');
            }

            const session = new CFSession(
                paymentSessionId,
                orderId,
                this.environment
            );

            // Optional: Customize Theme
            const theme = new CFThemeBuilder()
                .setNavigationBarBackgroundColor('#E6E6FA')
                .setNavigationBarTextColor('#000000')
                .setButtonBackgroundColor('#800080')
                .setButtonTextColor('#FFFFFF')
                .setPrimaryTextColor('#000000')
                .setSecondaryTextColor('#808080')
                .build();

            console.log('Initiating Native Payment (Drop Checkout)');
            const paymentComponent = new CFPaymentComponentBuilder()
                .build();

            const dropPayment = new CFDropCheckoutPayment(
                session,
                paymentComponent,
                theme
            );

            this.cfPaymentGatewayService.doPayment(dropPayment);
        } catch (error) {
            console.error('Error initiating payment:', error);
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
                    environment: this.environment
                }),
            });

            const responseText = await response.text();

            if (!response.ok) {
                console.error('Backend error status:', response.status);
                console.error('Backend error response:', responseText);
                throw new Error(`Server returned ${response.status}: ${responseText}`);
            }

            const data = JSON.parse(responseText);
            return {
                sessionId: data.payment_session_id,
                orderId: data.order_id
            };

        } catch (error) {
            console.error('Error creating order:', error);
            throw error;
        }
    }

    /**
     * Verify payment with backend
     * @param {string} orderId 
     */
    async verifyPayment(orderId) {
        try {
            const API_URL = 'https://verifycashfreepayment-6vktyfoeaa-uc.a.run.app';

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ orderId }),
            });

            const responseText = await response.text();
            if (!response.ok) {
                console.error('Verify error status:', response.status);
                throw new Error(`Server returned ${response.status}: ${responseText}`);
            }
            const data = JSON.parse(responseText);
            return data; // { status: 'PAID', payment_details: { ... } }
        } catch (error) {
            console.error('Error verifying payment:', error);
            throw error;
        }
    }
}

export const paymentService = new PaymentService();
