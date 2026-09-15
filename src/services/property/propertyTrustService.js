/**
 * Property trust submissions. Screens must not write verification_cases via raw Firestore.
 * Identity KYC remains verificationService.js (DigiLocker / Cashfree).
 */
import {
    collection,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    where,
} from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../firebaseConfig';
import {
    VERIFICATION_COLLECTION,
    buildEvidenceStoragePath,
    canSubmitVerification,
    dashboardVerificationLabel,
    hasOpenPending,
    identityStatusFromUser,
    publicActorTrustFromUser,
    publicCaseView,
    subjectKindForType,
    trustBadges,
    validateSubmitInput,
} from '../../domain/verification';
import { propertyService } from './propertyService';
import { listingService } from './listingService';
import { getVerificationStatus } from '../verificationService';

function requireUid() {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('You must be signed in');
    return uid;
}

async function blobFromDocument(docItem) {
    if (docItem?._webFile instanceof Blob) return docItem._webFile;
    const uri = typeof docItem === 'string' ? docItem : docItem?.uri;
    if (!uri) return null;
    const response = await fetch(uri);
    return response.blob();
}

export const propertyTrustService = {
    trustBadges,
    dashboardVerificationLabel,
    identityStatusFromUser,
    publicActorTrustFromUser,

    async loadIdentity() {
        const kyc = await getVerificationStatus();
        const uid = auth.currentUser?.uid;
        return {
            kyc,
            identity: identityStatusFromUser({
                aadhaarVerified: kyc?.aadhaarVerified,
                isVerified: kyc?.aadhaarVerified,
                verificationStatus: kyc?.businessPending ? null : (kyc?.aadhaarVerified ? 'verified' : null),
                verificationData: kyc?.businessPending ? { status: 'pending' } : null,
            }),
            uid: uid || null,
        };
    },

    async listMyCases() {
        const uid = requireUid();
        const q = query(
            collection(db, VERIFICATION_COLLECTION),
            where('submittedByUid', '==', uid),
            orderBy('submittedAt', 'desc'),
            limit(40)
        );
        const snap = await getDocs(q);
        return snap.docs.map((row) => publicCaseView({ id: row.id, ...row.data() }));
    },

    async submit({ type, subjectId, evidenceType, documents = [], propertyId, listingId } = {}) {
        const uid = requireUid();
        const issues = validateSubmitInput({
            type,
            subjectId,
            evidenceType,
            evidence: documents.map((item, index) => ({
                storagePath: buildEvidenceStoragePath(uid, 'pending', item?.name || `doc-${index}`),
            })),
            uid,
        }).filter((row) => row !== 'Evidence is required' && !/does not belong/.test(row) && !/private document storage/.test(row));
        if (!documents.length) throw new Error('Upload at least one document');
        if (issues.length) throw new Error(issues[0]);

        let property = null;
        let listing = null;
        if (propertyId || type === 'OWNERSHIP' || type === 'PROPERTY' || type === 'LOCATION') {
            property = await propertyService.getProperty(propertyId || subjectId);
        }
        if (listingId || type === 'REPRESENTATION') {
            listing = await listingService.getListing(listingId || subjectId);
            if (listing?.propertyId && !property) {
                property = await propertyService.getProperty(listing.propertyId);
            }
        }

        const existing = await propertyTrustService.listMyCases();
        const pending = hasOpenPending(
            existing.map((row) => ({ type: row.type, subjectId: row.subjectId, status: row.status })),
            type,
            subjectId
        );
        const allowed = canSubmitVerification(type, { uid }, {
            property,
            listing,
            openPending: pending,
            subjectId,
        });
        if (!allowed.ok) throw new Error(allowed.code === 'PENDING_EXISTS'
            ? 'This verification is already pending review'
            : 'You cannot submit this verification');

        const caseRef = doc(collection(db, VERIFICATION_COLLECTION));
        const evidence = [];
        for (let i = 0; i < documents.length; i += 1) {
            const item = documents[i];
            const name = item?.name || `document-${i}`;
            const mimeType = item?.mimeType || 'application/octet-stream';
            const storagePath = buildEvidenceStoragePath(uid, caseRef.id, `${i}-${name}`);
            const blob = await blobFromDocument(item);
            if (!blob) continue;
            await uploadBytes(ref(storage, storagePath), blob, { contentType: mimeType });
            evidence.push({ storagePath, originalName: name, mimeType });
        }
        if (!evidence.length) throw new Error('Could not upload documents');

        const payload = {
            type,
            subjectKind: subjectKindForType(type),
            subjectId,
            propertyId: property?.id || propertyId || null,
            listingId: listing?.id || listingId || null,
            submittedByUid: uid,
            status: 'PENDING',
            evidenceType,
            evidence,
            submittedAt: serverTimestamp(),
            reviewedAt: null,
            reviewedByUid: null,
            reason: null,
            notes: null,
            expiresAt: null,
            methodologyVersion: 'v1',
        };
        await setDoc(caseRef, payload);
        return publicCaseView({ id: caseRef.id, ...payload });
    },
};
