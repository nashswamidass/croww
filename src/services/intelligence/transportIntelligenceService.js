import {
    computeAirportDomain,
    computeConnectivityDomain,
    computeHealthcareDomain,
    computeSchoolsDomain,
    computeTransportDomain,
} from '../../domain/intelligence';

/**
 * Proximity helpers for future ingestion jobs.
 * Do not call from LocalityScreen without a sourced POI set.
 * Empty inputs return UNAVAILABLE — they do not invent coverage.
 */
export const transportIntelligenceService = {
    fromStations(origin, stations, extras) {
        return computeTransportDomain(origin, stations, extras);
    },
};

export const schoolsIntelligenceService = {
    fromPoints(origin, schools, extras) {
        return computeSchoolsDomain(origin, schools, extras);
    },
};

export const healthcareIntelligenceService = {
    fromPoints(origin, hospitals, extras) {
        return computeHealthcareDomain(origin, hospitals, extras);
    },
};

export const airportIntelligenceService = {
    fromAirports(origin, airports, extras) {
        return computeAirportDomain(origin, airports, extras);
    },
};

export const connectivityIntelligenceService = {
    fromRoads(origin, roads, extras) {
        return computeConnectivityDomain(origin, roads, extras);
    },
};
