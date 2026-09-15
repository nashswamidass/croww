import { DASHBOARD_PAGE_SIZE, DASHBOARD_PAGE_SIZE_MAX } from './constants.ts';

export type InventoryPage<T extends { id?: string | null } = { id?: string | null }> = {
    items: T[];
    cursor: unknown;
    hasMore: boolean;
    pageSize: number;
};

export function clampDashboardPageSize(value: unknown): number {
    const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : DASHBOARD_PAGE_SIZE;
    if (n < 1) return DASHBOARD_PAGE_SIZE;
    return Math.min(n, DASHBOARD_PAGE_SIZE_MAX);
}

export function dedupeInventoryById<T extends { id?: string | null }>(items: T[] | null | undefined): T[] {
    if (!Array.isArray(items)) return [];
    const seen = new Set<string>();
    const out: T[] = [];
    items.forEach((row) => {
        const id = row?.id;
        if (!id || seen.has(id)) return;
        seen.add(id);
        out.push(row);
    });
    return out;
}

export function normalizeInventoryPage<T extends { id?: string | null }>({
    items,
    cursor = null,
    pageSize = DASHBOARD_PAGE_SIZE,
    hasMore,
}: {
    items?: T[] | null;
    cursor?: unknown;
    pageSize?: number;
    hasMore?: boolean;
} = {}): InventoryPage<T> {
    const size = clampDashboardPageSize(pageSize);
    const unique = dedupeInventoryById(items);
    const sliced = unique.slice(0, size);
    const more = typeof hasMore === 'boolean'
        ? hasMore
        : unique.length > size || (sliced.length >= size && cursor != null);
    return {
        items: sliced,
        cursor: sliced.length ? cursor : null,
        hasMore: more && sliced.length > 0,
        pageSize: size,
    };
}

function updatedMillis(row: { updatedAt?: unknown; createdAt?: unknown }): number {
    const value = row?.updatedAt || row?.createdAt;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    if (value && typeof (value as { seconds?: number }).seconds === 'number') {
        return (value as { seconds: number }).seconds * 1000;
    }
    return 0;
}

export function mergeSortedInventory<T extends { id?: string | null; updatedAt?: unknown }>(
    pages: T[][],
    pageSize = DASHBOARD_PAGE_SIZE
): T[] {
    const merged = dedupeInventoryById(pages.flat());
    merged.sort((a, b) => updatedMillis(b) - updatedMillis(a));
    return merged.slice(0, clampDashboardPageSize(pageSize));
}
