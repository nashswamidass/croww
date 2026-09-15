/**
 * Role-aware dashboard copy. Do not hardcode “Broker Dashboard” for every actor.
 * userType business/provider is never treated as builder/agent.
 */

export type DashboardCopy = {
    title: string;
    subtitle: string;
    profileEntry: string;
    listingsSection: string;
    propertiesSection: string;
    actorLabel: string | null;
};

export function dashboardCopy(roles: string[] | null | undefined): DashboardCopy {
    const list = Array.isArray(roles) ? roles : [];
    const isBuilder = list.includes('builder');
    const isAgent = list.includes('agent');
    const isOwner = list.includes('owner');

    if (isBuilder) {
        return {
            title: 'Your inventory',
            subtitle: 'Manage properties and listings you are bringing to market.',
            profileEntry: 'Property inventory',
            listingsSection: 'Listings',
            propertiesSection: 'Properties',
            actorLabel: 'Builder account',
        };
    }
    if (isAgent) {
        return {
            title: 'Your listings',
            subtitle: 'Manage listings you created or represent. Representation is unverified until Croww reviews it.',
            profileEntry: 'Property inventory',
            listingsSection: 'Your listings',
            propertiesSection: 'Properties',
            actorLabel: 'Agent account',
        };
    }
    if (isOwner) {
        return {
            title: 'Your properties',
            subtitle: 'Manage the properties you own and the listings on them.',
            profileEntry: 'Property inventory',
            listingsSection: 'Listings',
            propertiesSection: 'Your properties',
            actorLabel: null,
        };
    }
    return {
        title: 'Your properties',
        subtitle: 'Manage listings you have added. Anyone signed in can list their own property.',
        profileEntry: 'Property inventory',
        listingsSection: 'Listings',
        propertiesSection: 'Properties',
        actorLabel: null,
    };
}

export const DASHBOARD_FILTER_LABELS: Record<string, string> = {
    all: 'All',
    draft: 'Draft',
    review: 'Under review',
    published: 'Published',
    paused: 'Paused',
    sold_rented: 'Sold/Rented',
    archived: 'Archived',
};

export const ANALYTICS_UNAVAILABLE_COPY = 'Analytics unavailable';
