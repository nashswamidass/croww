import { canTransitionListing } from '../validate.ts';
import { clientMaySetListingStatus } from '../actorPolicy.ts';
import type { ListingStatus } from '../types';

export type DashboardActionKind = 'navigate' | 'status' | 'request_review';

export type DashboardAction = {
    id: string;
    label: string;
    kind: DashboardActionKind;
    toStatus?: ListingStatus;
    accessibilityLabel: string;
};

export type ActionListing = {
    status?: string | null;
    transactionType?: string | null;
    reviewRequestedAt?: unknown;
};

function clientCanApplyStatus(fromStatus: string, toStatus: string): boolean {
    if (!canTransitionListing(fromStatus as ListingStatus, toStatus as ListingStatus)) return false;
    if (!clientMaySetListingStatus(fromStatus, toStatus)) return false;
    if (toStatus === 'PUBLISHED') return false;
    return true;
}

export function isDraftListing(listing: ActionListing | null | undefined): boolean {
    return listing?.status === 'DRAFT' && !listing?.reviewRequestedAt;
}

export function isUnderReviewListing(listing: ActionListing | null | undefined): boolean {
    return listing?.status === 'DRAFT' && Boolean(listing?.reviewRequestedAt);
}

export function canContinueEditing(listing: ActionListing | null | undefined): boolean {
    return listing?.status === 'DRAFT' || listing?.status === 'PAUSED';
}

/**
 * Only valid, client-permitted actions. Never includes self-publish.
 * PAUSED → PUBLISHED exists in the domain table but is admin/publishListing only.
 * Resume is therefore “Request review”, which keeps status PAUSED until the server publishes.
 */
export function availableDashboardActions(listing: ActionListing | null | undefined): DashboardAction[] {
    if (!listing?.status) return [];
    const status = listing.status;
    const actions: DashboardAction[] = [];

    if (canContinueEditing(listing)) {
        actions.push({
            id: isDraftListing(listing) || isUnderReviewListing(listing) ? 'continue_edit' : 'edit',
            label: status === 'DRAFT' ? 'Continue editing' : 'Edit',
            kind: 'navigate',
            accessibilityLabel: status === 'DRAFT' ? 'Continue editing draft' : 'Edit listing',
        });
    }

    actions.push({
        id: 'open',
        label: 'Open',
        kind: 'navigate',
        accessibilityLabel: 'Open listing detail',
    });

    actions.push({
        id: 'media',
        label: 'Media',
        kind: 'navigate',
        accessibilityLabel: 'Manage listing photos',
    });

    if (status === 'PUBLISHED' && clientCanApplyStatus(status, 'PAUSED')) {
        actions.push({
            id: 'pause',
            label: 'Pause',
            kind: 'status',
            toStatus: 'PAUSED',
            accessibilityLabel: 'Pause listing',
        });
    }

    if ((status === 'DRAFT' || status === 'PAUSED') && !isUnderReviewListing(listing)) {
        actions.push({
            id: 'request_review',
            label: status === 'PAUSED' ? 'Request review to go live' : 'Request review',
            kind: 'request_review',
            accessibilityLabel: 'Request listing review. This does not publish the listing.',
        });
    }

    if (
        status === 'PUBLISHED'
        && listing.transactionType === 'buy'
        && clientCanApplyStatus(status, 'SOLD')
    ) {
        actions.push({
            id: 'sold',
            label: 'Mark sold',
            kind: 'status',
            toStatus: 'SOLD',
            accessibilityLabel: 'Mark listing as sold',
        });
    }

    if (
        status === 'PUBLISHED'
        && listing.transactionType === 'rent'
        && clientCanApplyStatus(status, 'RENTED')
    ) {
        actions.push({
            id: 'rented',
            label: 'Mark rented',
            kind: 'status',
            toStatus: 'RENTED',
            accessibilityLabel: 'Mark listing as rented',
        });
    }

    if (clientCanApplyStatus(status, 'ARCHIVED')) {
        actions.push({
            id: 'archive',
            label: 'Archive',
            kind: 'status',
            toStatus: 'ARCHIVED',
            accessibilityLabel: 'Archive listing',
        });
    }

    return actions;
}

export function actionById(
    listing: ActionListing | null | undefined,
    actionId: string | null | undefined
): DashboardAction | null {
    if (!actionId) return null;
    return availableDashboardActions(listing).find((row) => row.id === actionId) || null;
}

export function isSelfPublishAction(action: DashboardAction | null | undefined): boolean {
    return action?.toStatus === 'PUBLISHED' || action?.id === 'publish';
}
