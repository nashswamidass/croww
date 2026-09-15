import { formatInrCompact } from './propertyFormat.js';
import { MARKET_MEDIAN_MIN_SAMPLE } from '../domain/intelligence/constants.ts';
import { freshnessState, toMillis } from '../domain/intelligence/metric.ts';

function formatDistanceMeters(meters) {
    const value = Number(meters);
    if (!Number.isFinite(value) || value < 0) return null;
    if (value < 1000) return `${Math.round(value)} m`;
    const km = value / 1000;
    const rounded = km >= 10 ? Math.round(km) : Math.round(km * 10) / 10;
    return `${rounded} km`;
}

function formatWhen(value) {
    const ms = toMillis(value);
    if (ms == null) return null;
    return new Date(ms).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function statusLabel(status) {
    if (status === 'INSUFFICIENT_SAMPLE') return 'Insufficient data';
    if (status === 'UNAVAILABLE') return 'Data unavailable';
    if (status === 'STALE') return 'May be out of date';
    if (status === 'PARTIAL') return 'Partial data';
    return null;
}

function sampleCaption(metric) {
    const n = metric?.coverage?.sampleSize;
    const min = metric?.coverage?.minimumSampleThreshold;
    if (!Number.isFinite(n)) return null;
    if (metric.status === 'INSUFFICIENT_SAMPLE' && Number.isFinite(min)) {
        return `Based on ${n} listing${n === 1 ? '' : 's'} (need ${min} for a median)`;
    }
    if (n >= 1 && (metric.key || '').toLowerCase().includes('median')) {
        return `Based on ${n} Croww listing${n === 1 ? '' : 's'}`;
    }
    if ((metric.key || '').includes('Count') || metric.unit === 'count') {
        return 'Croww published listings';
    }
    return null;
}

function sourceCaption(metric) {
    if (!metric?.sourceLabel) return null;
    const when = formatWhen(metric.sourceUpdatedAt || metric.computedAt || metric.fetchedAt);
    return when ? `${metric.sourceLabel} · ${when}` : metric.sourceLabel;
}

function presentMetric(metric, formatter) {
    if (!metric) {
        return {
            display: 'Data unavailable',
            meta: null,
            status: 'UNAVAILABLE',
            available: false,
        };
    }
    if (metric.status === 'UNAVAILABLE') {
        return { display: 'Data unavailable', meta: sourceCaption(metric), status: metric.status, available: false };
    }
    if (metric.status === 'INSUFFICIENT_SAMPLE') {
        return {
            display: 'Insufficient data',
            meta: sampleCaption(metric) || sourceCaption(metric),
            status: metric.status,
            available: false,
        };
    }
    const formatted = formatter ? formatter(metric.value) : metric.value;
    if (formatted == null || formatted === '') {
        return { display: 'Data unavailable', meta: sourceCaption(metric), status: 'UNAVAILABLE', available: false };
    }
    return {
        display: String(formatted),
        meta: sampleCaption(metric) || sourceCaption(metric),
        status: metric.status,
        available: true,
    };
}

function moneyFormatter(value) {
    return formatInrCompact(value);
}

function psfFormatter(value) {
    const compact = formatInrCompact(value);
    return compact ? `${compact} / sq ft` : null;
}

function rentFormatter(value) {
    const compact = formatInrCompact(value);
    return compact ? `${compact} / month` : null;
}

function row(label, metric, formatter) {
    const presented = presentMetric(metric, formatter);
    return {
        label,
        value: presented.display,
        meta: presented.meta,
        status: presented.status,
        available: presented.available,
    };
}

function domainHasEvidence(domain) {
    if (!domain) return false;
    if (domain.status === 'AVAILABLE' || domain.status === 'PARTIAL' || domain.status === 'STALE') return true;
    return Object.values(domain.metrics || {}).some((m) => (
        m.status === 'AVAILABLE' || m.status === 'PARTIAL' || m.status === 'STALE' || m.status === 'INSUFFICIENT_SAMPLE'
    ));
}

function floodLabel(classification) {
    if (classification === 'LOW') return 'Low';
    if (classification === 'MODERATE') return 'Moderate';
    if (classification === 'HIGH') return 'High';
    return 'Unknown';
}

/**
 * Evidence-only view model. Never emits "excellent", "safe", or Area Score.
 */
export function buildLocalityViewModel(snapshot) {
    const market = snapshot?.domains?.market;
    const transport = snapshot?.domains?.transport;
    const connectivity = snapshot?.domains?.connectivity;
    const airport = snapshot?.domains?.airport;
    const schools = snapshot?.domains?.schools;
    const healthcare = snapshot?.domains?.healthcare;
    const flood = snapshot?.domains?.flood;
    const freshness = freshnessState(snapshot?.generatedAt);
    const generatedLabel = formatWhen(snapshot?.generatedAt);

    const marketRows = [
        row('Active listings', market?.metrics?.activeListingCount, (v) => Number.isFinite(Number(v)) ? String(v) : null),
        row('For sale', market?.metrics?.activeSaleCount, (v) => Number.isFinite(Number(v)) ? String(v) : null),
        row('For rent', market?.metrics?.activeRentCount, (v) => Number.isFinite(Number(v)) ? String(v) : null),
        row('Median asking price', market?.metrics?.medianSalePrice, moneyFormatter),
        row('Median rent', market?.metrics?.medianRent, rentFormatter),
        row('Median price / sq ft', market?.metrics?.medianPricePerSqft, psfFormatter),
    ];

    const mobilityRows = [
        row('Nearest metro', transport?.metrics?.nearestMetroName, (v) => v),
        row('Metro distance', transport?.metrics?.nearestMetroDistanceM, formatDistanceMeters),
        row('Metro stations nearby', transport?.metrics?.metroStationsWithinRadius, (v) => Number.isFinite(Number(v)) ? String(v) : null),
        row('Nearest major road', connectivity?.metrics?.nearestMajorRoadName, (v) => v),
        row('Major-road distance', connectivity?.metrics?.nearestMajorRoadDistanceM, formatDistanceMeters),
        row('Airport', airport?.metrics?.nearestAirportName, (v) => v),
        row('Airport (straight-line)', airport?.metrics?.nearestAirportDistanceM, formatDistanceMeters),
    ];

    const essentialRows = [
        row('Schools nearby', schools?.metrics?.schoolsWithinRadius, (v) => Number.isFinite(Number(v)) ? String(v) : null),
        row('Nearest school', schools?.metrics?.nearestSchoolDistanceM, formatDistanceMeters),
        row('Hospitals nearby', healthcare?.metrics?.hospitalsWithinRadius, (v) => Number.isFinite(Number(v)) ? String(v) : null),
        row('Nearest hospital', healthcare?.metrics?.nearestHospitalDistanceM, formatDistanceMeters),
    ];

    const floodMetric = flood?.metrics?.floodClassification;
    const floodSourced = flood?.status === 'AVAILABLE' || flood?.status === 'PARTIAL' || flood?.status === 'STALE';
    const environmentRows = [
        {
            label: 'Flood-risk data',
            value: floodSourced ? floodLabel(flood.classification) : 'Data unavailable',
            meta: floodSourced
                ? (sourceCaption(floodMetric) || 'Classification from a sourced flood dataset. Unknown means the dataset did not assign Low/Moderate/High.')
                : 'No credible flood dataset for this area',
            status: flood?.status || 'UNAVAILABLE',
            available: floodSourced,
        },
    ];

    const confidenceLabel = snapshot?.confidence && snapshot.confidence !== 'UNKNOWN'
        ? snapshot.confidence.charAt(0) + snapshot.confidence.slice(1).toLowerCase()
        : 'Unknown';

    let freshnessText = 'No published snapshot yet';
    if (freshness === 'stale' && generatedLabel) freshnessText = `Last updated ${generatedLabel} · may be out of date`;
    else if (freshness === 'current' && generatedLabel) freshnessText = `Last updated ${generatedLabel}`;
    else if (generatedLabel) freshnessText = `Last updated ${generatedLabel}`;
    else if (snapshot?.status && snapshot.status !== 'UNAVAILABLE') freshnessText = 'Date unknown';

    return {
        market: {
            title: 'Market',
            statusLabel: statusLabel(market?.status) || (domainHasEvidence(market) ? null : 'Data unavailable'),
            footnote: domainHasEvidence(market) ? 'Croww-derived from published listings, not an external price index.' : null,
            rows: domainHasEvidence(market) ? marketRows : [row('Active listings', null)],
        },
        mobility: {
            title: 'Getting around',
            statusLabel: [
                transport?.status,
                connectivity?.status,
                airport?.status,
            ].some((s) => s && s !== 'UNAVAILABLE')
                ? statusLabel(
                    [transport?.status, connectivity?.status, airport?.status].includes('STALE')
                        ? 'STALE'
                        : null
                )
                : 'Data unavailable',
            footnote: airport?.metrics?.nearestAirportDistanceM?.status === 'AVAILABLE'
                ? 'Airport figure is straight-line distance, not travel time.'
                : null,
            rows: [
                transport,
                connectivity,
                airport,
            ].some(domainHasEvidence)
                ? mobilityRows.filter((r) => r.available || r.status === 'INSUFFICIENT_SAMPLE')
                : [],
        },
        essentials: {
            title: 'Everyday essentials',
            statusLabel: [schools?.status, healthcare?.status].some((s) => s && s !== 'UNAVAILABLE')
                ? null
                : 'Data unavailable',
            footnote: 'Proximity only. School or hospital quality is not ranked.',
            rows: [schools, healthcare].some(domainHasEvidence)
                ? essentialRows.filter((r) => r.available || r.status === 'INSUFFICIENT_SAMPLE')
                : [],
        },
        environment: {
            title: 'Environment',
            statusLabel: floodSourced ? statusLabel(flood?.status) : 'Data unavailable',
            footnote: null,
            rows: environmentRows,
        },
        notes: {
            title: 'Data notes',
            confidenceLabel,
            freshnessText,
            sourceSummary: snapshot?.sourceSummary || 'No published intelligence snapshot',
            methodologyVersion: snapshot?.methodologyVersion || null,
            sampleHint: `Medians need at least ${MARKET_MEDIAN_MIN_SAMPLE} published listings.`,
        },
    };
}

export { formatDistanceMeters, MARKET_MEDIAN_MIN_SAMPLE };
