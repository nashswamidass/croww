import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { db, storage, auth } from './firebaseConfig';
import API_ENDPOINTS from '../constants/apiConfig';
import { authenticatedFetch } from '../utils/authenticatedFetch';
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
        const response = await authenticatedFetch(API_ENDPOINTS.GET_DIGILOCKER_URL, {
            method: 'POST',
            body: {
                userFlow,
                environment,
                redirectUrl
            }
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

        const environment = process.env.EXPO_PUBLIC_CASHFREE_ENV || 'SANDBOX';

        const response = await authenticatedFetch(API_ENDPOINTS.GET_DIGILOCKER_STATUS, {
            method: 'POST',
            body: {
                verificationId,
                environment
            }
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.message || `Server error: ${response.status}`);
        }

        if (data.status === 'SUCCESS' || data.status === 'AUTHENTICATED' || data.identityVerified) {
            await AsyncStorage.setItem('aadhaar_verified', 'true');
            if (data.displayName) {
                await AsyncStorage.setItem('aadhaar_name', String(data.displayName));
            }
            return {
                success: true,
                message: 'Aadhaar verified via DigiLocker',
                displayName: data.displayName || null,
            };
        }
        throw new Error(data.message || "Verification not successful yet. Status: " + data.status);
    } catch (error) {
        console.error("Error finalizing verification:", error);
        return { success: false, message: error.message };
    }
};

/**
 * Submit business verification documents
 * @param {Object} businessData - Business information
 * @param {Array} documents - Array of document objects {uri, name, mimeType, _webFile?}
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
            const originalName = typeof docItem === 'object' ? (docItem.name || `doc_${i}`) : `doc_${i}`;
            const mimeType = typeof docItem === 'object' ? (docItem.mimeType || 'image/jpeg') : 'image/jpeg';

            // Determine file extension from MIME type
            let extension = 'jpg';
            if (mimeType.includes('pdf')) extension = 'pdf';
            else if (mimeType.includes('png')) extension = 'png';
            else if (mimeType.includes('webp')) extension = 'webp';

            const fileName = `verification_${Date.now()}_${i}.${extension}`;
            const storageRef = ref(storage, `verification_docs/${user.uid}/${fileName}`);

            let blob;
            // On web, if we have the raw File object, use it directly (avoids cross-origin blob URL issues)
            if (docItem._webFile instanceof Blob) {
                blob = docItem._webFile;
            } else {
                // Native: fetch the file:// or blob: URI
                const fetchResponse = await fetch(uri);
                blob = await fetchResponse.blob();
            }

            // Upload with correct content type so Firebase Storage serves it properly
            await uploadBytes(storageRef, blob, { contentType: mimeType });
            const downloadURL = await getDownloadURL(storageRef);
            documentUrls.push({ url: downloadURL, name: originalName, mimeType });
        }

        // Update User Doc in Firestore
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
            verificationData: {
                businessName: businessData.businessName,
                registrationNumber: businessData.registrationNumber,
                // Store full document metadata for the admin panel
                documentUrls: documentUrls.map(d => d.url),
                documentMeta: documentUrls,
                documentUrl: documentUrls[0]?.url || null, // backward compat
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
