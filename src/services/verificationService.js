import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { db, storage, auth } from './firebaseConfig';
import API_ENDPOINTS from '../constants/apiConfig';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Verification Service
 */

/**
 * Step 1: Get DigiLocker Session URL from Backend
 */
export const getDigiLockerUrl = async (userFlow = 'signin', redirectUrl = 'https://croww.ai/kyc-complete') => {
    try {
        const environment = process.env.EXPO_PUBLIC_CASHFREE_ENV || 'SANDBOX';
        const response = await fetch(API_ENDPOINTS.GET_DIGILOCKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userFlow,
                environment,
                redirectUrl
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        const data = await response.json();
        return data; // contains url and verification_id
    } catch (error) {
        console.error("Error getting DigiLocker URL:", error);
        throw error;
    }
};

/**
 * Step 2: Update User Status after DigiLocker Success
 */
export const finalizeAadhaarVerification = async (verificationId) => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("User not authenticated");

        // Fetch details from Cashfree to confirm success
        const environment = process.env.EXPO_PUBLIC_CASHFREE_ENV || 'SANDBOX';

        const response = await fetch(API_ENDPOINTS.GET_DIGILOCKER_STATUS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                verificationId,
                userId: user.uid,
                environment
            })
        });
        const data = await response.json();

        if (data.status === 'SUCCESS' || data.status === 'AUTHENTICATED') {
            await AsyncStorage.setItem('aadhaar_verified', 'true');
            
            // Persist to Firestore so Admin Panel can see details
            const userRef = doc(db, 'users', user.uid);
            const verificationPayload = {
                aadhaarVerified: true,
                isVerified: true,
                aadhaarVerifiedAt: serverTimestamp(),
                verificationData: {
                    type: data.type || 'aadhaar_otp',
                    status: 'verified',
                    aadhaarVerifiedAt: serverTimestamp(),
                    data: data.data || data // Store the full result including full_name, dob, gender, address
                }
            };
            
            // Also update kycDetails for backward compatibility/redundancy if needed
            if (data.data?.full_name || data.full_name) {
                verificationPayload.kycDetails = {
                    name: data.data?.full_name || data.full_name,
                    verifiedAt: serverTimestamp()
                };
            }

            await updateDoc(userRef, verificationPayload);

            return { success: true, message: 'Aadhaar verified via DigiLocker', data: data };
        } else {
            throw new Error(data.message || "Verification not successful yet. Status: " + data.status);
        }
    } catch (error) {
        console.error("Error finalizing verification:", error);
        return { success: false, message: error.message };
    }
};

/**
 * Submit business verification documents
 * @param {Object} businessData - Business information
 * @param {Array} documents - Array of document URIs or objects {uri, name}
 * @returns {Promise<{success: boolean, message: string, verificationId?: string}>}
 */
export const submitBusinessVerification = async (businessData, documents = []) => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("User not authenticated");

        const verificationId = `BIZ-${Date.now()}`;
        const documentUrls = [];

        // Upload all documents
        for (let i = 0; i < documents.length; i++) {
            const docItem = documents[i];
            const uri = typeof docItem === 'string' ? docItem : docItem.uri;
            const originalName = typeof docItem === 'object' ? docItem.name : `doc_${i}`;

            // Extract extension
            const extension = uri.includes('.pdf') ? 'pdf' : 'jpg';
            const fileName = `verification_${Date.now()}_${i}.${extension}`;
            const storageRef = ref(storage, `verification_docs/${user.uid}/${fileName}`);

            // Convert URI to Blob for Firebase Storage
            const response = await fetch(uri);
            const blob = await response.blob();

            // Upload to Storage
            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);
            documentUrls.push(downloadURL);
        }

        // Update User Doc in Firestore
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
            verificationData: {
                businessName: businessData.businessName,
                registrationNumber: businessData.registrationNumber,
                documentUrls: documentUrls,
                documentUrl: documentUrls[0] || null, // Keep singular for backward compatibility
                status: 'pending',
                submittedAt: serverTimestamp(),
                verificationId
            }
        });

        // Store status locally
        await AsyncStorage.setItem('business_verification_status', 'pending');
        await AsyncStorage.setItem('business_verification_id', verificationId);

        return {
            success: true,
            message: 'Business verification submitted for review',
            verificationId: verificationId
        };
    } catch (error) {
        console.error('Error submitting business verification:', error);
        return {
            success: false,
            message: error.message || 'Failed to submit verification'
        };
    }
};

/**
 * Check verification status from Firestore and sync locally
 * @returns {Promise<{aadhaarVerified: boolean, businessVerified: boolean, businessPending: boolean}>}
 */
export const getVerificationStatus = async () => {
    try {
        const user = auth.currentUser;
        if (!user) {
            const aadhaarVerified = await AsyncStorage.getItem('aadhaar_verified') === 'true';
            const businessStatus = await AsyncStorage.getItem('business_verification_status');
            return {
                aadhaarVerified,
                businessVerified: businessStatus === 'approved',
                businessPending: businessStatus === 'pending'
            };
        }

        // Fetch latest from Firestore
        const userRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
            const userData = docSnap.data();
            const isApproved = userData.isApproved === true;
            const status = userData.verificationData?.status || null;
            const isVerified = userData.aadhaarVerified || userData.isVerified === true;
            const fullName = userData.kycDetails?.name || 
                userData.verificationData?.data?.full_name ||
                userData.verificationData?.full_name || "";

            // Sync with local storage
            await AsyncStorage.setItem('business_verification_status', isApproved ? 'approved' : (status || 'none'));
            if (isVerified) {
                await AsyncStorage.setItem('aadhaar_verified', 'true');
                if (fullName) await AsyncStorage.setItem('aadhaar_name', fullName);
            }

            return {
                aadhaarVerified: isVerified,
                aadhaarName: fullName,
                businessVerified: (isApproved || userData.kycStatus === 'VERIFIED') && userData.userType === 'business',
                businessPending: status === 'pending' && userData.userType === 'business'
            };
        }

        return {
            aadhaarVerified: false,
            businessVerified: false,
            businessPending: false
        };
    } catch (error) {
        console.error("Error fetching verification status:", error);
        // Fallback to local storage
        const aadhaarVerified = await AsyncStorage.getItem('aadhaar_verified') === 'true';
        const businessStatus = await AsyncStorage.getItem('business_verification_status');

        return {
            aadhaarVerified,
            businessVerified: businessStatus === 'approved',
            businessPending: businessStatus === 'pending'
        };
    }
};
