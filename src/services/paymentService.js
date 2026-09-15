import { Platform } from 'react-native';
import { CFPaymentGatewayService } from 'react-native-cashfree-pg-sdk';
import { CFSession, CFThemeBuilder, CFDropCheckoutPayment, CFPaymentComponentBuilder } from 'cashfree-pg-api-contract';
import API_ENDPOINTS from '../constants/apiConfig';
import { authenticatedFetch } from '../utils/authenticatedFetch';

class PaymentService {
    constructor() {
        this.cfPaymentGatewayService = CFPaymentGatewayService;

        // Check if environment variables are loaded (env vars are baked at build time)
        let envVal = (process.env.EXPO_PUBLIC_CASHFREE_ENV || 'SANDBOX').toUpperCase();

        console.log("[AUTH_FIX_DEPLOY_V2_NATIVE] Initial Environment:", envVal);

        // Standardize normalization
        this.environment = envVal === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
    }

    /**
     * Check if Native Cashfree SDK is available
     */
    isNativeAvailable() {
        return !!this.cfPaymentGatewayService && !!CFSession;
    }

    /**
     * Set the payment callback listener
     */
    setCallback(onVerify, onError) {
        if (!this.cfPaymentGatewayService) return;

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
        if (!this.cfPaymentGatewayService) return;
        this.cfPaymentGatewayService.removeCallback();
    }

    /**
     * Initiate payment
     * @param {string} paymentSessionId - Session ID from backend
     * @param {string} orderId - Order ID
     */
    async doPayment(paymentSessionId, orderId) {
        try {
            console.log('Initiating Native Payment (Drop Checkout)');

            if (!paymentSessionId) {
                throw new Error('Missing Payment Session ID');
            }

            if (!this.isNativeAvailable()) {
                throw new Error('Native Payment SDK not available.');
            }

            const session = new CFSession(
                paymentSessionId,
                orderId,
                this.environment
            );

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
            console.error('Error initiating native payment:', error);
            throw error;
        }
    }

    /**
     * Fetch payment session from backend
     */
    async createOrder(amount, customerId, customerPhone, customerName, customerEmail) {
        try {
            const API_URL = API_ENDPOINTS.CREATE_CASHFREE_ORDER;

            if (!customerId) {
                throw new Error('Customer ID is required');
            }

            const response = await authenticatedFetch(API_URL, {
                method: 'POST',
                body: {
                    orderAmount: amount,
                    customerId: customerId,
                    customerPhone: customerPhone,
                    customerName: customerName,
                    customerEmail: customerEmail,
                    environment: this.environment === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX'
                },
            });

            const responseText = await response.text();

            if (!response.ok) {
                console.error('Backend error status:', response.status);
                throw new Error(`Server returned ${response.status}: ${responseText}`);
            }

            const data = JSON.parse(responseText);

            const sessionId = data.payment_session_id || data.paymentSessionId || data.payment_session || data.session_id;
            const orderId = data.order_id || data.orderId;

            return { sessionId, orderId };
        } catch (error) {
            console.error('Error creating native order:', error);
            throw error;
        }
    }

    /**
     * Verify payment with backend
     */
    async verifyPayment(orderId) {
        try {
            const API_URL = API_ENDPOINTS.VERIFY_CASHFREE_PAYMENT;

            const response = await authenticatedFetch(API_URL, {
                method: 'POST',
                body: {
                    orderId,
                    environment: this.environment
                },
            });

            const responseText = await response.text();
            if (!response.ok) {
                console.error('Verify native error status:', response.status);
                throw new Error(`Server returned ${response.status}: ${responseText}`);
            }
            const data = JSON.parse(responseText);
            return data;
        } catch (error) {
            console.error('Error verifying native payment:', error);
            throw error;
        }
    }
}

export const paymentService = new PaymentService();
