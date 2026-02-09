import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Mock Verification Service
 * In production, this would integrate with real APIs
 */

// Mock OTP Storage
let mockOTPStore = {};

/**
 * Generate and send OTP for Aadhaar verification
 * @param {string} aadhaarNumber - Masked Aadhaar number
 * @returns {Promise<{success: boolean, message: string, otp?: string}>}
 */
export const sendAadhaarOTP = async (aadhaarNumber) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Generate random 6-digit OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            mockOTPStore[aadhaarNumber] = otp;

            console.log(`[MOCK OTP] Aadhaar: ${aadhaarNumber} | OTP: ${otp}`);

            resolve({
                success: true,
                message: 'OTP sent successfully',
                otp: otp // In production, this would NOT be returned
            });
        }, 1000);
    });
};

/**
 * Verify OTP for Aadhaar
 * @param {string} aadhaarNumber - Masked Aadhaar number
 * @param {string} otp - OTP entered by user
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const verifyAadhaarOTP = async (aadhaarNumber, otp) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const storedOTP = mockOTPStore[aadhaarNumber];

            if (!storedOTP) {
                resolve({
                    success: false,
                    message: 'No OTP found. Please request a new one.'
                });
                return;
            }

            if (storedOTP === otp) {
                // Clear OTP after successful verification
                delete mockOTPStore[aadhaarNumber];

                // Store verification status
                AsyncStorage.setItem('aadhaar_verified', 'true');

                resolve({
                    success: true,
                    message: 'Aadhaar verified successfully!'
                });
            } else {
                resolve({
                    success: false,
                    message: 'Invalid OTP. Please try again.'
                });
            }
        }, 500);
    });
};

/**
 * Submit business verification documents
 * @param {Object} businessData - Business information
 * @returns {Promise<{success: boolean, message: string, verificationId?: string}>}
 */
export const submitBusinessVerification = async (businessData) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const verificationId = `BIZ-${Date.now()}`;

            // Store pending verification
            AsyncStorage.setItem('business_verification_status', 'pending');
            AsyncStorage.setItem('business_verification_id', verificationId);

            console.log('[MOCK] Business verification submitted:', businessData);

            resolve({
                success: true,
                message: 'Business verification submitted for review',
                verificationId: verificationId
            });
        }, 1000);
    });
};

/**
 * Check verification status
 * @returns {Promise<{aadhaarVerified: boolean, businessVerified: boolean, businessPending: boolean}>}
 */
export const getVerificationStatus = async () => {
    const aadhaarVerified = await AsyncStorage.getItem('aadhaar_verified') === 'true';
    const businessStatus = await AsyncStorage.getItem('business_verification_status');

    return {
        aadhaarVerified,
        businessVerified: businessStatus === 'approved',
        businessPending: businessStatus === 'pending'
    };
};

/**
 * Clear all verification data (for testing)
 */
export const clearVerificationData = async () => {
    await AsyncStorage.removeItem('aadhaar_verified');
    await AsyncStorage.removeItem('business_verification_status');
    await AsyncStorage.removeItem('business_verification_id');
    mockOTPStore = {};
};
