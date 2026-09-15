import { canAccessListingInventory } from './scope.ts';

export type InquiryChat = {
    id?: string | null;
    listingId?: string | null;
    propertyId?: string | null;
    participantIds?: string[] | null;
    lastMessage?: string | null;
    lastMessageTimestamp?: unknown;
    unreadCounts?: Record<string, number> | null;
};

export type InquiryListing = {
    id?: string | null;
    listedByUid?: string | null;
    title?: string | null;
    city?: string | null;
    transactionType?: string | null;
    askingPrice?: number | null;
    rentMonthly?: number | null;
};

/**
 * Keep listing-scoped inquiries from the actor’s own chat list.
 * Does not scan other users’ threads or saved collections.
 */
export function filterListingInquiries(
    chats: InquiryChat[] | null | undefined,
    {
        uid,
        listings = [],
        listingsById = {},
    }: {
        uid: string | null | undefined;
        listings?: InquiryListing[];
        listingsById?: Record<string, InquiryListing | undefined>;
    }
): InquiryChat[] {
    if (!uid || !Array.isArray(chats)) return [];
    const byId: Record<string, InquiryListing | undefined> = { ...listingsById };
    listings.forEach((row) => {
        if (row?.id) byId[row.id] = row;
    });

    return chats.filter((chat) => {
        if (!chat?.listingId) return false;
        const participants = Array.isArray(chat.participantIds) ? chat.participantIds : [];
        if (!participants.includes(uid)) return false;
        const listing = byId[chat.listingId];
        if (!listing) return false;
        return canAccessListingInventory(uid, listing);
    });
}

export function inquiryUnreadCount(chat: InquiryChat | null | undefined, uid: string | null | undefined): number {
    if (!uid || !chat?.unreadCounts) return 0;
    const value = chat.unreadCounts[uid];
    return typeof value === 'number' && value > 0 ? value : 0;
}
