import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { areaScorePreferenceService } from '../services/intelligence';
import { defaultWeights } from '../domain/areaScore';
import { useAuth } from './AuthContext';

const AreaScorePreferencesContext = createContext(null);

export const AreaScorePreferencesProvider = ({ children }) => {
    const { user } = useAuth();
    const uid = user?.id || user?.uid || null;
    const [weights, setWeightsState] = useState(defaultWeights);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const loaded = await areaScorePreferenceService.load();
                if (!cancelled) setWeightsState(loaded);
            } catch {
                if (!cancelled) setWeightsState(defaultWeights());
            } finally {
                if (!cancelled) setReady(true);
            }
        })();
        return () => { cancelled = true; };
    }, [uid]);

    const setWeights = useCallback(async (next) => {
        setWeightsState(next);
        try {
            await areaScorePreferenceService.save(next);
        } catch (error) {
            console.warn('[AreaScorePreferences] save failed', error?.message);
        }
    }, []);

    const setDimensionWeight = useCallback(async (id, value) => {
        const next = { ...weights, [id]: value };
        await setWeights(next);
    }, [setWeights, weights]);

    const resetWeights = useCallback(async () => {
        const next = defaultWeights();
        await setWeights(next);
    }, [setWeights]);

    const value = useMemo(() => ({
        weights,
        ready,
        setWeights,
        setDimensionWeight,
        resetWeights,
    }), [weights, ready, setWeights, setDimensionWeight, resetWeights]);

    return (
        <AreaScorePreferencesContext.Provider value={value}>
            {children}
        </AreaScorePreferencesContext.Provider>
    );
};

export const useAreaScorePreferences = () => {
    const ctx = useContext(AreaScorePreferencesContext);
    if (!ctx) {
        throw new Error('useAreaScorePreferences must be used within AreaScorePreferencesProvider');
    }
    return ctx;
};
