import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import PropertyResultCard from '../../components/property/PropertyResultCard';
import PropertyLocation from '../../components/property/PropertyLocation';
import PropertySummary from '../../components/property/PropertySummary';
import PropertyFacts from '../../components/property/PropertyFacts';
import PropertyVerification from '../../components/property/PropertyVerification';
import Property3DSection from '../../components/property/Property3DSection';
import SaveButton from '../../components/property/saved/SaveButton';
import PostChoiceChips from '../../components/property/post/PostChoiceChips';
import { useTaxonomy } from '../../hooks/useTaxonomy';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';

const MOCK_LISTING = {
    id: 'preview-listing-1',
    listingId: 'preview-listing-1',
    propertyId: 'preview-prop-1',
    title: 'Modern 3BHK Penthouse with Private Terrace',
    category: 'residential',
    subtype: 'apartment',
    transactionType: 'buy',
    askingPrice: 16500000,
    price: 16500000,
    bedrooms: 3,
    bathrooms: 3,
    builtUpAreaSqft: 1850,
    carpetAreaSqft: 1550,
    city: 'Bengaluru',
    localityName: 'Indiranagar',
    localityId: 'bengaluru_indiranagar',
    locationPrecision: 'approximate',
    locationVisibility: 'approximate',
    coverUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&auto=format&fit=crop',
    coverThumbnailUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&auto=format&fit=crop',
    publishedAt: new Date().toISOString(),
    status: 'PUBLISHED',
    representationStatus: 'owner',
    spatialTourAvailable: true,
    verification: {
        ownership: { status: 'VERIFIED' },
        physical: { status: 'VERIFIED' },
    },
};

const MOCK_PROPERTY = {
    id: 'preview-prop-1',
    title: 'Modern 3BHK Penthouse with Private Terrace',
    category: 'residential',
    subtype: 'apartment',
    bedrooms: 3,
    bathrooms: 3,
    builtUpAreaSqft: 1850,
    carpetAreaSqft: 1550,
    furnishingStatus: 'semi-furnished',
    parkingSpaces: 2,
    floorNumber: 4,
    totalFloors: 5,
    city: 'Bengaluru',
    localityName: 'Indiranagar',
    status: 'ACTIVE',
    verification: {
        ownership: { status: 'VERIFIED' },
        physical: { status: 'VERIFIED' },
    },
};

const PropertyVisualQAScreen = () => {
    const [saved, setSaved] = useState(false);
    const { postingCategories, loading: taxonomyLoading } = useTaxonomy();
    const activePosting = postingCategories('rent');
    const [selectedType, setSelectedType] = useState(activePosting[0]?.typeId || 'pg');

    const shareStates = [
        { label: '1. Approximate (Default Unshared)', shareStatus: 'NONE', precision: 'approximate', isExactShared: false },
        { label: '2. Requesting (Loading)', shareStatus: 'NONE', precision: 'approximate', isExactShared: false, isRequestingLocation: true },
        { label: '3. Pending (Awaiting Owner)', shareStatus: 'PENDING', precision: 'approximate', isExactShared: false },
        { label: '4. Approved (Exact Coordinates Shared)', shareStatus: 'APPROVED', precision: 'approximate', isExactShared: true },
        { label: '5. Declined by Owner', shareStatus: 'DECLINED', precision: 'approximate', isExactShared: false },
        { label: '6. Revoked / Expired', shareStatus: 'REVOKED', precision: 'approximate', isExactShared: false },
    ];

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.header}>
                    <Typography variant="h2">Product Visual QA Showcase</Typography>
                    <Typography variant="body" style={styles.subtitle}>
                        Real rendered components for Property Card, Detail, and Location Privacy flows
                    </Typography>
                </View>

                {/* Section 0: Live Server-Driven Taxonomy Post Categories */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>
                        Post Wizard: Select Accommodation Type ({activePosting.length} Enabled)
                    </Typography>
                    <Typography variant="bodyMedium" style={{ color: COLORS.secondary, marginBottom: SPACING.m }}>
                        Live options driven by Firestore listingTaxonomy collection:
                    </Typography>
                    <PostChoiceChips
                        accessibilityLabel="Listing type"
                        value={selectedType}
                        onChange={setSelectedType}
                        options={activePosting.map((item) => ({
                            value: item.typeId,
                            label: item.displayName,
                            hint: item.description,
                        }))}
                    />
                </View>

                {/* Section 1: Property Cards */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>1. Property Cards (Explore Carousel)</Typography>
                    <View style={styles.cardRow}>
                        <PropertyResultCard
                            item={MOCK_LISTING}
                            selected={false}
                            onPress={() => {}}
                        />
                        <PropertyResultCard
                            item={{
                                ...MOCK_LISTING,
                                id: 'preview-listing-2',
                                listingId: 'preview-listing-2',
                                title: 'Spacious 2BHK Apartment in Koramangala',
                                bedrooms: 2,
                                askingPrice: 9200000,
                                price: 9200000,
                                localityName: 'Koramangala',
                                spatialTourAvailable: false,
                                locationPrecision: 'exact',
                            }}
                            selected={true}
                            onPress={() => {}}
                        />
                    </View>
                </View>

                {/* Section 2: Property Detail Screen Sections */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>2. Property Detail Sections</Typography>
                    
                    {/* Header Action Row */}
                    <View style={styles.detailActionRow}>
                        <Typography variant="titleMedium">Header Actions</Typography>
                        <SaveButton
                            isSaved={saved}
                            onPress={() => setSaved(!saved)}
                        />
                    </View>

                    {/* Summary */}
                    <View style={styles.detailCard}>
                        <PropertySummary
                            listing={MOCK_LISTING}
                            property={MOCK_PROPERTY}
                            localityName="Indiranagar"
                        />
                    </View>

                    {/* Facts */}
                    <View style={styles.detailCard}>
                        <PropertyFacts
                            property={MOCK_PROPERTY}
                            listing={MOCK_LISTING}
                        />
                    </View>

                    {/* Verification Badges */}
                    <View style={styles.detailCard}>
                        <Typography variant="titleMedium" style={{ paddingHorizontal: SPACING.l, paddingTop: SPACING.m }}>
                            Verification & Trust
                        </Typography>
                        <PropertyVerification
                            property={MOCK_PROPERTY}
                            listing={MOCK_LISTING}
                            actorTrust={{ identity: 'VERIFIED', owner: 'VERIFIED' }}
                        />
                    </View>

                    {/* 3D Tour Section */}
                    <View style={styles.detailCard}>
                        <Property3DSection
                            propertyId="preview-prop-1"
                            listingId="preview-listing-1"
                        />
                    </View>
                </View>

                {/* Section 3: Location Privacy & Request Flow States */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>3. Location Privacy & Request States (All 6 States)</Typography>
                    
                    {shareStates.map((st, idx) => (
                        <View key={st.label} style={styles.stateWrapper}>
                            <View style={styles.stateHeader}>
                                <Typography variant="titleSmall" style={styles.stateLabel}>{st.label}</Typography>
                            </View>
                            <PropertyLocation
                                precision={st.precision}
                                city="Bengaluru"
                                state="Karnataka"
                                localityName="Indiranagar"
                                localityId="bengaluru_indiranagar"
                                address="Near 100 Feet Road"
                                isExactShared={st.isExactShared}
                                shareStatus={st.shareStatus}
                                isOwner={false}
                                onRequestExactLocation={() => {}}
                                isRequestingLocation={st.isRequestingLocation}
                            />
                        </View>
                    ))}
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingBottom: 60,
        backgroundColor: COLORS.background,
    },
    header: {
        padding: SPACING.l,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.surface,
    },
    subtitle: {
        color: COLORS.secondary,
        marginTop: 4,
    },
    section: {
        marginTop: SPACING.xl,
        paddingHorizontal: SPACING.l,
    },
    sectionTitle: {
        marginBottom: SPACING.m,
        color: COLORS.primary,
    },
    cardRow: {
        flexDirection: 'row',
        gap: SPACING.m,
        flexWrap: 'wrap',
    },
    detailActionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        padding: SPACING.l,
        borderRadius: BORDER_RADIUS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: SPACING.m,
    },
    detailCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: SPACING.m,
        overflow: 'hidden',
        paddingBottom: SPACING.m,
    },
    stateWrapper: {
        marginBottom: SPACING.l,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
        paddingBottom: SPACING.m,
    },
    stateHeader: {
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: SPACING.l,
        paddingVertical: SPACING.s,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    stateLabel: {
        color: COLORS.accent,
        fontWeight: '700',
    },
});

export default PropertyVisualQAScreen;
