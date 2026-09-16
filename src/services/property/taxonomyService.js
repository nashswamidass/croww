import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { DEFAULT_TAXONOMY_ITEMS, mapLegacyToTaxonomy } from '../../domain/taxonomy/defaults';

const CACHE_KEY = '@croww_taxonomy_cache_v1';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

let inMemoryCache = null;
let lastFetchTime = 0;
let inflightPromise = null;

function sortItems(items) {
    return [...items].sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999));
}

export const taxonomyService = {
    /**
     * Load full taxonomy from cache or server.
     * Guaranteed never to throw; falls back to bundled safe defaults on failure.
     */
    async getTaxonomy({ forceRefresh = false } = {}) {
        const now = Date.now();
        if (!forceRefresh && inMemoryCache && (now - lastFetchTime < CACHE_TTL_MS)) {
            return inMemoryCache;
        }

        if (inflightPromise) {
            return inflightPromise;
        }

        inflightPromise = (async () => {
            try {
                // Try reading from AsyncStorage if in-memory is empty
                if (!inMemoryCache) {
                    const cachedStr = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
                    if (cachedStr) {
                        try {
                            const parsed = JSON.parse(cachedStr);
                            if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
                                inMemoryCache = sortItems(parsed.items);
                                lastFetchTime = parsed.timestamp || 0;
                                if (!forceRefresh && (now - lastFetchTime < CACHE_TTL_MS)) {
                                    return inMemoryCache;
                                }
                            }
                        } catch (_) {}
                    }
                }

                // Query Firestore collection 'listingTaxonomy'
                const q = query(collection(db, 'listingTaxonomy'), orderBy('displayOrder', 'asc'));
                const snap = await getDocs(q);

                let serverItems = [];
                if (!snap.empty) {
                    serverItems = snap.docs.map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                    }));
                }

                if (serverItems.length > 0) {
                    inMemoryCache = sortItems(serverItems);
                    lastFetchTime = Date.now();
                    AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
                        items: inMemoryCache,
                        timestamp: lastFetchTime,
                    })).catch(() => {});
                    return inMemoryCache;
                }

                // If Firestore collection is empty or not yet seeded, use defaults
                if (!inMemoryCache || inMemoryCache.length === 0) {
                    inMemoryCache = sortItems(DEFAULT_TAXONOMY_ITEMS);
                    lastFetchTime = Date.now();
                }
                return inMemoryCache;
            } catch (err) {
                console.warn('[taxonomyService] fetch failed, falling back to cached/defaults', err?.message);
                if (!inMemoryCache || inMemoryCache.length === 0) {
                    inMemoryCache = sortItems(DEFAULT_TAXONOMY_ITEMS);
                }
                return inMemoryCache;
            } finally {
                inflightPromise = null;
            }
        })();

        return inflightPromise;
    },

    /**
     * Clear cache and force re-fetch on next access.
     */
    async invalidateCache() {
        inMemoryCache = null;
        lastFetchTime = 0;
        await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
    },

    /**
     * Return all currently active taxonomy records.
     */
    async getActiveTaxonomy() {
        const all = await this.getTaxonomy();
        return all.filter((item) => item.status === 'ACTIVE');
    },

    /**
     * Return listing types enabled for consumer discovery (Explore pills, primary cards).
     */
    async getConsumerCategories() {
        const active = await this.getActiveTaxonomy();
        return active.filter((item) => item.consumerEnabled);
    },

    /**
     * Return listing types enabled for creating new listings.
     * @param {'buy' | 'rent'} transactionType
     */
    async getPostingCategories(transactionType) {
        const active = await this.getActiveTaxonomy();
        return active.filter((item) => {
            if (!item.postingEnabled) return false;
            if (transactionType === 'rent' && !item.rentEnabled) return false;
            if (transactionType === 'buy' && !item.saleEnabled) return false;
            return true;
        });
    },

    /**
     * Return listing types enabled for filter sheets and refinement.
     */
    async getFilterTaxonomy() {
        const active = await this.getActiveTaxonomy();
        return active.filter((item) => item.filterEnabled);
    },

    /**
     * Lookup a single taxonomy item by ID or legacy mapping.
     */
    async getTaxonomyItem(typeId, fallbackCategory, fallbackSubtype) {
        const all = await this.getTaxonomy();
        let match = all.find((item) => item.id === typeId || item.typeId === typeId);
        if (!match && typeId) {
            match = all.find((item) =>
                item.id === `stay_${typeId}` ||
                item.id === `res_${typeId}` ||
                item.id === `sale_${typeId}` ||
                item.id === `commercial_${typeId}` ||
                (item.typeId && (
                    item.typeId === `stay_${typeId}` ||
                    item.typeId === `res_${typeId}` ||
                    item.typeId === `sale_${typeId}` ||
                    item.typeId === `commercial_${typeId}`
                ))
            );
        }
        if (!match && (fallbackCategory || fallbackSubtype)) {
            const mappedId = mapLegacyToTaxonomy(fallbackCategory, fallbackSubtype);
            match = all.find((item) => item.id === mappedId || item.typeId === mappedId);
        }
        return match || all.find((item) => item.id === 'stay_pg' || item.id === 'pg') || DEFAULT_TAXONOMY_ITEMS[3];
    },

    /**
     * Clear cached taxonomy both in-memory and in persistent storage.
     */
    async clearCache() {
        inMemoryCache = null;
        lastFetchTime = 0;
        await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
    },
};
