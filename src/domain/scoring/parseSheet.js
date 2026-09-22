/**
 * parseSheet — converts a raw 2D array (from SheetJS or test fixtures) into a
 * structured ParsedSheet.
 *
 * Rules:
 * - First non-empty row = header row.
 * - localityColumnIdx (default 0) = locality name column.
 * - Every other column with a non-empty header = criterion column.
 * - Empty cell → null (MISSING, not 0).
 * - Numeric cell → raw value (not rescaled).
 * - Non-numeric, non-empty cell → 'INVALID'.
 * - Completely empty data rows are skipped.
 */

export function normalizeCriterionId(name) {
    return String(name)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

export const METADATA_COLUMN_PATTERN = /^(region|zone|state|city|district|country|pincode|zip|postal|notes|comments|id|s\.?no|serial)$/i;
export const COMPOSITE_COLUMN_PATTERN = /^(composite\s*average|composite|overall\s*average|source\s*composite)$/i;

export function detectLocalityColumnIdx(headers) {
    if (!Array.isArray(headers) || headers.length === 0) return 0;
    const idx = headers.findIndex((h) => {
        const s = String(h || '').toLowerCase();
        return s.includes('area') || s.includes('neighbour') || s.includes('neighbor') || s.includes('locality');
    });
    return idx !== -1 ? idx : 0;
}

/**
 * @param {(string|number|null)[][]} rawRows  2-D array from SheetJS sheet_to_json({header:1})
 * @param {{ localityColumnIdx?: number, excludedColumnIndices?: number[] }} [opts]
 * @returns {import('./types.ts').ParsedSheet}
 */
export function parseSheet(rawRows, { localityColumnIdx, excludedColumnIndices = [] } = {}) {
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
        return { headers: [], localityColumnIdx: 0, criteriaColumns: [], criteriaIds: [], criteriaNames: {}, rows: [] };
    }

    // Find first non-empty row as header
    const headerRowIdx = rawRows.findIndex(
        (row) => Array.isArray(row) && row.some((cell) => cell != null && cell !== '')
    );
    if (headerRowIdx === -1) {
        return { headers: [], localityColumnIdx: 0, criteriaColumns: [], criteriaIds: [], criteriaNames: {}, rows: [] };
    }

    const headerRow = rawRows[headerRowIdx];
    const headers = headerRow.map((cell) =>
        cell == null ? '' : String(cell).trim()
    );

    const actualLocalityIdx = typeof localityColumnIdx === 'number'
        ? localityColumnIdx
        : detectLocalityColumnIdx(headers);

    const excludedSet = new Set(excludedColumnIndices);

    // Build criteria columns: all columns except locality, excluded/metadata, and composite average
    const criteriaColumns = [];
    let compositeAverageColumnIdx = -1;

    headers.forEach((h, i) => {
        if (i === actualLocalityIdx || h === '' || excludedSet.has(i)) return;
        if (METADATA_COLUMN_PATTERN.test(h)) return;
        if (COMPOSITE_COLUMN_PATTERN.test(h) || normalizeCriterionId(h) === 'composite_average') {
            compositeAverageColumnIdx = i;
            return;
        }
        criteriaColumns.push({ idx: i, name: h, id: normalizeCriterionId(h) });
    });

    const criteriaIds = criteriaColumns.map((c) => c.id);
    const criteriaNames = Object.fromEntries(criteriaColumns.map((c) => [c.id, c.name]));

    // Parse data rows
    const rows = [];
    for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
        const rawRow = rawRows[i] || [];
        const rawNameCell = rawRow[actualLocalityIdx];

        // Skip completely empty rows
        if (rawNameCell == null || String(rawNameCell).trim() === '') continue;

        const rawName = String(rawNameCell).trim();
        const criteriaScores = {};
        const validationIssues = [];

        // Check reference sourceCompositeAverage if present
        let sourceCompositeAverage = null;
        if (compositeAverageColumnIdx !== -1 && compositeAverageColumnIdx < rawRow.length) {
            const compCell = rawRow[compositeAverageColumnIdx];
            if (compCell != null && compCell !== '') {
                const parsedComp = parseFloat(String(compCell));
                if (!isNaN(parsedComp) && Number.isFinite(parsedComp)) {
                    sourceCompositeAverage = Math.round(parsedComp * 10) / 10;
                }
            }
        }

        criteriaColumns.forEach(({ idx, id }) => {
            const cell = idx < rawRow.length ? rawRow[idx] : null;
            if (cell == null || cell === '') {
                criteriaScores[id] = null; // MISSING — not 0
            } else if (typeof cell === 'number' && Number.isFinite(cell)) {
                criteriaScores[id] = cell;
            } else {
                const parsed = parseFloat(String(cell));
                if (!isNaN(parsed) && Number.isFinite(parsed)) {
                    criteriaScores[id] = parsed;
                } else {
                    criteriaScores[id] = 'INVALID';
                    validationIssues.push({
                        criterionId: id,
                        value: cell,
                        message: `Non-numeric value: "${cell}"`,
                    });
                }
            }
        });

        rows.push({
            rowIndex: i,
            rawName,
            matchStatus: null,
            matchedLocalityId: null,
            criteriaScores,
            overallScore: null,
            coverage: 0,
            availableCriteria: [],
            missingCriteria: [],
            sourceCompositeAverage,
            validationIssues,
        });
    }

    return {
        headers,
        localityColumnIdx: actualLocalityIdx,
        compositeAverageColumnIdx,
        criteriaColumns,
        criteriaIds,
        criteriaNames,
        rows,
    };
}
