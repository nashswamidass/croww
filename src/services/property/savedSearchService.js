import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import {
    MAX_ACTIVE_ALERTS,
    MAX_SAVED_SEARCHES,
    SAVED_SEARCHES_SUBCOLLECTION,
    canonicalizeSavedSearch,
    exploreStateToSearchInput,
    isMeaningfulSavedSearch,
} from '../../domain/property';

const withTimeout = (promise, ms = 10000, label = 'savedSearchService') =>
    Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`[${label}] timed out after ${ms}ms`)), ms)
        ),
    ]);

function requireUid() {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('You must be signed in');
    return uid;
}

function toRecord(snapshot) {
    return { id: snapshot.id, ...snapshot.data() };
}

function searchesCol(uid) {
    return collection(db, 'users', uid, SAVED_SEARCHES_SUBCOLLECTION);
}

function toWritePayload(canonical, uid) {
    return {
        kind: 'savedSearch',
        name: canonical.name,
        location: canonical.location,
        filters: canonical.filters,
        criteriaHash: canonical.criteriaHash,
        alertEnabled: canonical.alertEnabled === true,
        cityKey: canonical.location.cityKey,
        transactionType: canonical.filters.transactionType,
        ownerUid: uid,
        alert: {
            enabled: canonical.alertEnabled === true,
        },
    };
}

export const savedSearchService = {
    isMeaningful(exploreState) {
        return isMeaningfulSavedSearch(exploreStateToSearchInput(exploreState));
    },

    canonicalizeFromExplore(exploreState) {
        return canonicalizeSavedSearch(exploreStateToSearchInput(exploreState));
    },

    async list() {
        const uid = requireUid();
        const snap = await withTimeout(
            getDocs(query(searchesCol(uid), orderBy('updatedAt', 'desc'), limit(MAX_SAVED_SEARCHES))),
            10000,
            'listSavedSearches'
        );
        return snap.docs.map(toRecord);
    },

    async createFromExplore(exploreState) {
        const uid = requireUid();
        const input = exploreStateToSearchInput(exploreState);
        if (!isMeaningfulSavedSearch(input)) {
            throw new Error('Add a locality, filter, or place before saving this search');
        }
        const canonical = canonicalizeSavedSearch(input);
        const existing = await this.list();
        const duplicate = existing.find((row) => row.criteriaHash === canonical.criteriaHash);
        if (duplicate) {
            return { status: 'duplicate', search: duplicate, canonical };
        }
        if (existing.length >= MAX_SAVED_SEARCHES) {
            throw new Error(`You can save up to ${MAX_SAVED_SEARCHES} searches`);
        }
        if (canonical.alertEnabled) {
            const active = existing.filter((row) => row.alertEnabled).length;
            if (active >= MAX_ACTIVE_ALERTS) {
                throw new Error(`You can enable alerts on up to ${MAX_ACTIVE_ALERTS} searches`);
            }
        }
        const ref = doc(searchesCol(uid));
        const payload = {
            ...toWritePayload(canonical, uid),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        await withTimeout(setDoc(ref, payload), 10000, 'createSavedSearch');
        return { status: 'created', search: { id: ref.id, ...canonical }, canonical };
    },

    async update(searchId, patch = {}) {
        const uid = requireUid();
        if (!searchId) throw new Error('Search is required');
        const existing = await this.list();
        const current = existing.find((row) => row.id === searchId);
        if (!current) throw new Error('Saved search not found');
        const nextInput = {
            name: patch.name !== undefined ? patch.name : current.name,
            alertEnabled: patch.alertEnabled !== undefined ? patch.alertEnabled : current.alertEnabled,
            location: patch.location || current.location,
            filters: patch.filters || current.filters,
        };
        const canonical = canonicalizeSavedSearch(nextInput);
        if (canonical.alertEnabled && !current.alertEnabled) {
            const active = existing.filter((row) => row.alertEnabled && row.id !== searchId).length;
            if (active >= MAX_ACTIVE_ALERTS) {
                throw new Error(`You can enable alerts on up to ${MAX_ACTIVE_ALERTS} searches`);
            }
        }
        const collision = existing.find((row) => row.id !== searchId && row.criteriaHash === canonical.criteriaHash);
        if (collision && (patch.location || patch.filters)) {
            return { status: 'duplicate', search: collision, canonical };
        }
        await withTimeout(
            updateDoc(doc(db, 'users', uid, SAVED_SEARCHES_SUBCOLLECTION, searchId), {
                ...toWritePayload(canonical, uid),
                updatedAt: serverTimestamp(),
            }),
            10000,
            'updateSavedSearch'
        );
        return { status: 'updated', search: { id: searchId, ...canonical }, canonical };
    },

    async replaceWithExplore(searchId, exploreState) {
        const canonical = canonicalizeSavedSearch(exploreStateToSearchInput(exploreState));
        return this.update(searchId, {
            name: exploreState.name || canonical.name,
            location: canonical.location,
            filters: canonical.filters,
            alertEnabled: exploreState.alertEnabled,
        });
    },

    async setAlertsEnabled(searchId, enabled) {
        return this.update(searchId, { alertEnabled: !!enabled });
    },

    async rename(searchId, name) {
        return this.update(searchId, { name });
    },

    async remove(searchId) {
        const uid = requireUid();
        if (!searchId) return;
        await withTimeout(
            deleteDoc(doc(db, 'users', uid, SAVED_SEARCHES_SUBCOLLECTION, searchId)),
            8000,
            'deleteSavedSearch'
        );
    },
};
