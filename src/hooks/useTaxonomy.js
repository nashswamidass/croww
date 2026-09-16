import { useState, useEffect, useCallback } from 'react';
import { taxonomyService } from '../services/property/taxonomyService';
import { DEFAULT_TAXONOMY_ITEMS } from '../domain/taxonomy/defaults';

export function useTaxonomy() {
    const [taxonomy, setTaxonomy] = useState(DEFAULT_TAXONOMY_ITEMS);
    const [loading, setLoading] = useState(true);

    const loadTaxonomy = useCallback(async (force = false) => {
        try {
            const data = await taxonomyService.getTaxonomy({ forceRefresh: force });
            if (data && data.length > 0) {
                setTaxonomy(data);
            }
        } catch (err) {
            console.warn('[useTaxonomy] failed to load', err?.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTaxonomy();
    }, [loadTaxonomy]);

    const activeTaxonomy = taxonomy.filter((t) => t.status === 'ACTIVE');
    const consumerCategories = activeTaxonomy.filter((t) => t.consumerEnabled);
    const filterTaxonomy = activeTaxonomy.filter((t) => t.filterEnabled);

    const getPostingCategories = useCallback((transactionType) => {
        return activeTaxonomy.filter((item) => {
            if (!item.postingEnabled) return false;
            if (transactionType === 'rent' && !item.rentEnabled) return false;
            if (transactionType === 'buy' && !item.saleEnabled) return false;
            return true;
        });
    }, [activeTaxonomy]);

    return {
        taxonomy,
        activeTaxonomy,
        consumerCategories,
        filterTaxonomy,
        getPostingCategories,
        postingCategories: getPostingCategories,
        loading,
        refresh: () => loadTaxonomy(true),
    };
}
