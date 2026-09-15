import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import {
    AREA_SCORE_PREFERENCE_DOC_ID,
    AREA_SCORE_PREFERENCE_STORAGE_KEY,
    AREA_SCORE_PREFERENCE_VERSION,
    USER_PREFERENCES_SUBCOLLECTION,
    defaultWeights,
    sanitizeWeights,
    validateWeights,
} from '../../domain/areaScore';

const USERS = 'users';

function prefRef(uid) {
    return doc(db, USERS, uid, USER_PREFERENCES_SUBCOLLECTION, AREA_SCORE_PREFERENCE_DOC_ID);
}

async function readLocal() {
    try {
        const raw = await AsyncStorage.getItem(AREA_SCORE_PREFERENCE_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.weights) return null;
        const issues = validateWeights(parsed.weights);
        if (issues.length) return null;
        return sanitizeWeights(parsed.weights);
    } catch {
        return null;
    }
}

async function writeLocal(weights) {
    await AsyncStorage.setItem(
        AREA_SCORE_PREFERENCE_STORAGE_KEY,
        JSON.stringify({
            preferenceVersion: AREA_SCORE_PREFERENCE_VERSION,
            weights,
            updatedAt: Date.now(),
        })
    );
}

/**
 * Private user Area Score priorities. Never written to localities.
 * Firestore path is owner-only; AsyncStorage is a local cache.
 */
export const areaScorePreferenceService = {
    defaults() {
        return defaultWeights();
    },

    async load() {
        const local = await readLocal();
        const uid = auth.currentUser?.uid;
        if (!uid) return local || defaultWeights();
        try {
            const snap = await getDoc(prefRef(uid));
            if (snap.exists() && snap.data()?.weights) {
                const issues = validateWeights(snap.data().weights);
                if (!issues.length) {
                    const weights = sanitizeWeights(snap.data().weights);
                    await writeLocal(weights);
                    return weights;
                }
            }
        } catch (error) {
            console.warn('[areaScorePreferenceService] load failed', error?.code || error?.message);
        }
        return local || defaultWeights();
    },

    async save(weights) {
        const issues = validateWeights(weights);
        if (issues.length) throw new Error(issues.map((i) => i.message).join('; '));
        const next = sanitizeWeights(weights);
        await writeLocal(next);
        const uid = auth.currentUser?.uid;
        if (!uid) return next;
        try {
            await setDoc(prefRef(uid), {
                kind: 'areaScore',
                preferenceVersion: AREA_SCORE_PREFERENCE_VERSION,
                weights: next,
                updatedAt: serverTimestamp(),
                updatedByUid: uid,
            }, { merge: true });
        } catch (error) {
            console.warn('[areaScorePreferenceService] save remote failed', error?.code || error?.message);
        }
        return next;
    },

    async reset() {
        return areaScorePreferenceService.save(defaultWeights());
    },
};
