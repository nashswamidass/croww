import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { saveService } from '../services/property';
import { useAuth } from './AuthContext';

const SavedItemsContext = createContext(null);

export const SavedItemsProvider = ({ children }) => {
    const { user } = useAuth();
    const uid = user?.id || user?.uid || null;
    const [listingIds, setListingIds] = useState(() => new Set());
    const [propertyIds, setPropertyIds] = useState(() => new Set());
    const [ready, setReady] = useState(false);

    const refresh = useCallback(async () => {
        if (!uid) {
            setListingIds(new Set());
            setPropertyIds(new Set());
            setReady(true);
            return;
        }
        try {
            const [listingIds, propertyIds] = await Promise.all([
                saveService.listSavedIds('savedListings', 200),
                saveService.listSavedIds('savedProperties', 200),
            ]);
            setListingIds(new Set(listingIds));
            setPropertyIds(new Set(propertyIds));
        } catch (error) {
            console.warn('[SavedItems] refresh failed', error?.message);
        } finally {
            setReady(true);
        }
    }, [uid]);

    useEffect(() => {
        setReady(false);
        refresh();
    }, [refresh]);

    const saveListing = useCallback(async (listing, extras) => {
        await saveService.saveListing(listing, extras);
        setListingIds((prev) => new Set(prev).add(listing.id || listing.listingId));
    }, []);

    const unsaveListing = useCallback(async (listingId) => {
        await saveService.unsaveListing(listingId);
        setListingIds((prev) => {
            const next = new Set(prev);
            next.delete(listingId);
            return next;
        });
    }, []);

    const saveProperty = useCallback(async (property, extras) => {
        await saveService.saveProperty(property, extras);
        setPropertyIds((prev) => new Set(prev).add(property.id || property.propertyId));
    }, []);

    const unsaveProperty = useCallback(async (propertyId) => {
        await saveService.unsaveProperty(propertyId);
        setPropertyIds((prev) => {
            const next = new Set(prev);
            next.delete(propertyId);
            return next;
        });
    }, []);

    const value = useMemo(() => ({
        ready,
        listingIds,
        propertyIds,
        isListingSaved: (id) => !!(id && listingIds.has(id)),
        isPropertySaved: (id) => !!(id && propertyIds.has(id)),
        saveListing,
        unsaveListing,
        saveProperty,
        unsaveProperty,
        refresh,
    }), [ready, listingIds, propertyIds, saveListing, unsaveListing, saveProperty, unsaveProperty, refresh]);

    return (
        <SavedItemsContext.Provider value={value}>
            {children}
        </SavedItemsContext.Provider>
    );
};

export const useSavedItems = () => {
    const ctx = useContext(SavedItemsContext);
    if (!ctx) throw new Error('useSavedItems must be used within SavedItemsProvider');
    return ctx;
};
