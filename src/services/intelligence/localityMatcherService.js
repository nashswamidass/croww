import { localityService } from '../property/localityService';
import {
    matchLocalities,
    POPULAR_CHENNAI_DESTINATIONS,
    BUDGET_PRESETS,
    COMMUTE_MODE_CONFIG,
    MATTERS_CONFIG,
} from '../../domain/areaScore/localityMatcher.js';

/**
 * Hardcoded fallback localities for Chennai.
 * Used only when Firestore is unreachable or returns 0 results for Chennai.
 * _isFallback: true marks these as offline demo data — NOT real Firestore evidence.
 * Do NOT rely on these for accurate market, transport, or flood claims.
 */
const CHENNAI_FALLBACK_LOCALITIES = [
    {
        _isFallback: true,
        id: 'chennai__adyar',
        name: 'Adyar',
        city: 'Chennai',
        latitude: 13.0012,
        longitude: 80.2565,
        aliases: ['Adyar', 'Adayar', 'Adyar Chennai'],
        intelligence: {
            domains: {
                market: { metrics: { medianRent: { value: 25000 } } },
                transport: { metrics: { nearestMetroDistanceM: { value: 1400 } } },
                flood: { metrics: { historicalFloodEvents: { value: 'LOW' } } },
            },
        },
    },
    {
        _isFallback: true,
        id: 'chennai__velachery',
        name: 'Velachery',
        city: 'Chennai',
        latitude: 12.9750,
        longitude: 80.2200,
        aliases: ['Velachery', 'Velacheri'],
        intelligence: {
            domains: {
                market: { metrics: { medianRent: { value: 21500 } } },
                transport: { metrics: { nearestMetroDistanceM: { value: 1800 } } },
                flood: { metrics: { historicalFloodEvents: { value: 'MEDIUM' } } },
            },
        },
    },
    {
        _isFallback: true,
        id: 'chennai__omr',
        name: 'OMR',
        city: 'Chennai',
        latitude: 12.8950,
        longitude: 80.2280,
        aliases: ['OMR', 'Old Mahabalipuram Road', 'IT Corridor', 'Rajiv Gandhi Salai'],
        intelligence: {
            domains: {
                market: { metrics: { medianRent: { value: 19500 } } },
                transport: { metrics: { nearestMetroDistanceM: { value: 5200 } } },
                flood: { metrics: { historicalFloodEvents: { value: 'LOW' } } },
            },
        },
    },
    {
        _isFallback: true,
        id: 'chennai__thiruvanmiyur',
        name: 'Thiruvanmiyur',
        city: 'Chennai',
        latitude: 12.9830,
        longitude: 80.2590,
        aliases: ['Thiruvanmiyur', 'Tiruvanmiyur'],
        intelligence: {
            domains: {
                market: { metrics: { medianRent: { value: 26000 } } },
                transport: { metrics: { nearestMetroDistanceM: { value: 1100 } } },
                flood: { metrics: { historicalFloodEvents: { value: 'LOW' } } },
            },
        },
    },
    {
        _isFallback: true,
        id: 'chennai__t-nagar',
        name: 'T. Nagar',
        city: 'Chennai',
        latitude: 13.0418,
        longitude: 80.2341,
        aliases: ['T. Nagar', 'T Nagar', 'Thyagaraya Nagar', 'Thiyagaraya Nagar', 'T-Nagar'],
        intelligence: {
            domains: {
                market: { metrics: { medianRent: { value: 27000 } } },
                transport: { metrics: { nearestMetroDistanceM: { value: 800 } } },
                flood: { metrics: { historicalFloodEvents: { value: 'LOW' } } },
            },
        },
    },
    {
        _isFallback: true,
        id: 'chennai__guindy',
        name: 'Guindy',
        city: 'Chennai',
        latitude: 13.0067,
        longitude: 80.2025,
        aliases: ['Guindy'],
        intelligence: {
            domains: {
                market: { metrics: { medianRent: { value: 23000 } } },
                transport: { metrics: { nearestMetroDistanceM: { value: 400 } } },
                flood: { metrics: { historicalFloodEvents: { value: 'LOW' } } },
            },
        },
    },
    {
        _isFallback: true,
        id: 'chennai__mylapore',
        name: 'Mylapore',
        city: 'Chennai',
        latitude: 13.0330,
        longitude: 80.2670,
        aliases: ['Mylapore'],
        intelligence: {
            domains: {
                market: { metrics: { medianRent: { value: 28000 } } },
                transport: { metrics: { nearestMetroDistanceM: { value: 1600 } } },
                flood: { metrics: { historicalFloodEvents: { value: 'LOW' } } },
            },
        },
    },
    {
        _isFallback: true,
        id: 'chennai__porur',
        name: 'Porur',
        city: 'Chennai',
        latitude: 13.0382,
        longitude: 80.1565,
        aliases: ['Porur'],
        intelligence: {
            domains: {
                market: { metrics: { medianRent: { value: 19000 } } },
                transport: { metrics: { nearestMetroDistanceM: { value: 3800 } } },
                flood: { metrics: { historicalFloodEvents: { value: 'MEDIUM' } } },
            },
        },
    },
    {
        _isFallback: true,
        id: 'chennai__anna-nagar',
        name: 'Anna Nagar',
        city: 'Chennai',
        latitude: 13.0850,
        longitude: 80.2100,
        aliases: ['Anna Nagar', 'Annanagar', 'Anna Nagar West', 'Anna Nagar East'],
        intelligence: {
            domains: {
                market: { metrics: { medianRent: { value: 31000 } } },
                transport: { metrics: { nearestMetroDistanceM: { value: 600 } } },
                flood: { metrics: { historicalFloodEvents: { value: 'LOW' } } },
            },
        },
    },
    {
        _isFallback: true,
        id: 'chennai__thiruvottiyur',
        name: 'Thiruvottiyur',
        city: 'Chennai',
        latitude: 13.1600,
        longitude: 80.3000,
        aliases: ['Thiruvottiyur', 'Tiruvottiyur'],
        intelligence: {
            domains: {
                market: { metrics: { medianRent: { value: 16000 } } },
                transport: { metrics: { nearestMetroDistanceM: { value: 400 } } },
                flood: { metrics: { historicalFloodEvents: { value: 'LOW' } } },
            },
        },
    },
];

export const localityMatcherService = {
    POPULAR_DESTINATIONS: POPULAR_CHENNAI_DESTINATIONS,
    BUDGET_PRESETS,
    COMMUTE_MODE_CONFIG,
    MATTERS_CONFIG,

    async findMatches(input = {}) {
        const city = input.city || 'Chennai';
        let localities = [];
        try {
            localities = await localityService.listActiveByCity(city);
        } catch (e) {
            console.warn('[localityMatcherService] Failed to load localities from Firestore, using fallbacks', e?.message);
        }

        if (!localities || localities.length === 0) {
            // Only apply Chennai fallbacks for Chennai queries — do not seed other cities with fake data
            localities = city.toLowerCase() === 'chennai' ? CHENNAI_FALLBACK_LOCALITIES : [];
        } else {
            // Merge fallbacks only for Chennai to fill any gaps in Firestore coverage
            if (city.toLowerCase() === 'chennai') {
                const existingNames = new Set(localities.map((l) => (l.name || '').toLowerCase().trim()));
                CHENNAI_FALLBACK_LOCALITIES.forEach((fb) => {
                    if (!existingNames.has(fb.name.toLowerCase().trim())) {
                        localities.push(fb);
                    }
                });
            }
        }

        return matchLocalities(
            {
                destination: input.destination,
                budget: input.budget,
                commuteMode: input.commuteMode,
                priorities: input.priorities,
                city,
            },
            localities
        );
    },
};
