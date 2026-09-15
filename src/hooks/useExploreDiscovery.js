import { useEffect, useMemo, useRef, useState } from 'react';
import { discoveryService, filterDiscoveryResults } from '../services/property';
import { EXPLORE_DEBOUNCE_MS } from '../constants/explore';
import { useExplore } from '../context/ExploreContext';

export function useExploreDiscovery() {
    const { viewport, filters } = useExplore();
    const [rawResults, setRawResults] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const loadedOnce = useRef(false);
    const requestId = useRef(0);
    const transactionType = filters.transactionType;

    useEffect(() => {
        if (!viewport) return undefined;
        const id = ++requestId.current;
        const timer = setTimeout(async () => {
            const isRefresh = loadedOnce.current;
            if (isRefresh) setRefreshing(true);
            else setLoading(true);
            setError(null);
            try {
                const rows = await discoveryService.discoverPublishedInViewport({
                    viewport,
                    transactionType,
                });
                if (requestId.current !== id) return;
                setRawResults(rows);
                loadedOnce.current = true;
            } catch (err) {
                console.warn('[Explore] discovery failed', err?.message);
                if (requestId.current !== id) return;
                setError('Could not load listings for this area.');
                setRawResults([]);
            } finally {
                if (requestId.current === id) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        }, loadedOnce.current ? EXPLORE_DEBOUNCE_MS : 80);

        return () => clearTimeout(timer);
    }, [viewport, transactionType]);

    const results = useMemo(
        () => filterDiscoveryResults(rawResults, filters),
        [rawResults, filters]
    );

    return { results, error, loading, refreshing };
}
