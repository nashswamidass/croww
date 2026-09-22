import React, { useState } from 'react';
import {
    View,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from '../Typography';
import AntigravityButton from '../AntigravityButton';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TOUCH_TARGETS } from '../../constants/theme';
import { useTaxonomy } from '../../hooks/useTaxonomy';

const BHK_OPTIONS = [
    { id: null, label: 'Any' },
    { id: 1, label: '1 BHK' },
    { id: 2, label: '2 BHK' },
    { id: 3, label: '3 BHK' },
    { id: 4, label: '4+ BHK' },
];

const BUY_BUDGETS = [
    { id: 'any', label: 'Any Budget', min: null, max: null },
    { id: 'lt50', label: '< ₹50 Lakh', min: null, max: 5000000 },
    { id: '50_1', label: '₹50L – 1 Cr', min: 5000000, max: 10000000 },
    { id: '1_2', label: '₹1 – 2 Cr', min: 10000000, max: 20000000 },
    { id: '2p', label: '₹2 Cr +', min: 20000000, max: null },
];

const RENT_BUDGETS = [
    { id: 'any', label: 'Any Rent', min: null, max: null },
    { id: 'lt20', label: '< ₹20k/mo', min: null, max: 20000 },
    { id: '20_40', label: '₹20k – 40k', min: 20000, max: 40000 },
    { id: '40_80', label: '₹40k – 80k', min: 40000, max: 80000 },
    { id: '80p', label: '₹80k +', min: 80000, max: null },
];

const PropertyFilters = ({ filters, onChange, resultCount = 0 }) => {
    const [sheetVisible, setSheetVisible] = useState(false);
    const { consumerCategories, filterTaxonomy } = useTaxonomy();

    const budgets = filters.transactionType === 'rent' ? RENT_BUDGETS : BUY_BUDGETS;
    const currentBudgetId = budgets.find(
        (b) => b.min === filters.minPrice && b.max === filters.maxPrice
    )?.id || 'any';

    const selectedTaxonomyItem = filterTaxonomy.find(
        (item) => item.typeId === filters.listingTypeId || item.typeId === filters.subtype
    );

    const activeFilterCount = (filters.bhk ? 1 : 0)
        + (filters.subtype || filters.listingTypeId ? 1 : 0)
        + (filters.minPrice != null || filters.maxPrice != null ? 1 : 0);

    return (
        <View style={styles.container}>
            {/* Server-Driven Category Strip (Bed, Shared Room, Private Room, PG, Co-living, Roommate Replacement) */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
            >
                <TouchableOpacity
                    style={[
                        styles.categoryChip,
                        !filters.listingTypeId && !filters.subtype && styles.categoryChipActive,
                    ]}
                    onPress={() => onChange({ listingTypeId: null, subtype: null })}
                    activeOpacity={0.8}
                >
                    <Typography
                        variant="caption"
                        style={[
                            styles.categoryChipText,
                            !filters.listingTypeId && !filters.subtype && styles.categoryChipTextActive,
                        ]}
                    >
                        All Stays
                    </Typography>
                </TouchableOpacity>

                {consumerCategories && consumerCategories.map((cat) => {
                    const isSelected = filters.listingTypeId === cat.typeId || filters.subtype === cat.typeId;
                    return (
                        <TouchableOpacity
                            key={cat.typeId}
                            style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                            onPress={() => {
                                if (isSelected) {
                                    onChange({ listingTypeId: null, subtype: null });
                                } else {
                                    onChange({ listingTypeId: cat.typeId, subtype: cat.typeId });
                                }
                            }}
                            activeOpacity={0.8}
                        >
                            <Typography
                                variant="caption"
                                style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}
                            >
                                {cat.displayName}
                            </Typography>
                        </TouchableOpacity>
                    );
                })}

                <TouchableOpacity
                    style={[styles.categoryChip, activeFilterCount > 0 && styles.categoryChipActive]}
                    onPress={() => setSheetVisible(true)}
                    activeOpacity={0.8}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons
                            name="options-outline"
                            size={13}
                            color={activeFilterCount > 0 ? '#FFFFFF' : COLORS.primary}
                            style={{ marginRight: 4 }}
                        />
                        <Typography
                            variant="caption"
                            style={[styles.categoryChipText, activeFilterCount > 0 && styles.categoryChipTextActive]}
                        >
                            {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
                        </Typography>
                    </View>
                </TouchableOpacity>
            </ScrollView>

            {/* Clean Consumer Filter Bottom Sheet */}
            <Modal
                visible={sheetVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setSheetVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.sheetContainer}>
                        {/* Header */}
                        <View style={styles.sheetHeader}>
                            <View>
                                <Typography variant="titleLarge" style={styles.sheetTitle}>
                                    What are you looking for?
                                </Typography>
                                <Typography variant="caption" style={styles.sheetSubtitle}>
                                    Refine property discovery to match your lifestyle
                                </Typography>
                            </View>
                            <TouchableOpacity
                                onPress={() => setSheetVisible(false)}
                                style={styles.sheetCloseBtn}
                                hitSlop={TOUCH_TARGETS.hitSlop}
                                accessibilityLabel="Close filters"
                            >
                                <Ionicons name="close" size={24} color={COLORS.primary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.sheetContent}
                        >
                            {/* Section 1: Transaction Type */}
                            <View style={styles.filterSection}>
                                <Typography variant="titleSmall" style={styles.sectionHeader}>
                                    LOOKING TO
                                </Typography>
                                <View style={styles.chipRow}>
                                    {['buy', 'rent'].map((tx) => (
                                        <TouchableOpacity
                                            key={tx}
                                            style={[styles.sheetChip, filters.transactionType === tx && styles.sheetChipActive]}
                                            onPress={() => onChange({ transactionType: tx, minPrice: null, maxPrice: null })}
                                        >
                                            <Typography
                                                variant="bodyMedium"
                                                style={[styles.sheetChipText, filters.transactionType === tx && styles.sheetChipTextActive]}
                                            >
                                                {tx === 'buy' ? 'Buy Property' : 'Rent Home / Stay'}
                                            </Typography>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Section 2: Property / Stay Type (Server-Driven) */}
                            <View style={styles.filterSection}>
                                <Typography variant="titleSmall" style={styles.sectionHeader}>
                                    STAY & PROPERTY TYPE
                                </Typography>
                                <View style={styles.chipGrid}>
                                    <TouchableOpacity
                                        key="all"
                                        style={[styles.sheetGridChip, !filters.subtype && !filters.listingTypeId && styles.sheetChipActive]}
                                        onPress={() => onChange({ subtype: null, listingTypeId: null })}
                                    >
                                        <Typography
                                            variant="bodyMedium"
                                            style={[styles.sheetChipText, !filters.subtype && !filters.listingTypeId && styles.sheetChipTextActive]}
                                        >
                                            Any Type
                                        </Typography>
                                    </TouchableOpacity>
                                    {filterTaxonomy.map((pt) => {
                                        const isSelected = filters.listingTypeId === pt.typeId || filters.subtype === pt.typeId;
                                        return (
                                            <TouchableOpacity
                                                key={pt.typeId}
                                                style={[styles.sheetGridChip, isSelected && styles.sheetChipActive]}
                                                onPress={() => onChange({ subtype: pt.typeId, listingTypeId: pt.typeId })}
                                            >
                                                <Typography
                                                    variant="bodyMedium"
                                                    style={[styles.sheetChipText, isSelected && styles.sheetChipTextActive]}
                                                >
                                                    {pt.displayName}
                                                </Typography>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* Section 3: Bedrooms */}
                            <View style={styles.filterSection}>
                                <Typography variant="titleSmall" style={styles.sectionHeader}>
                                    BEDROOMS
                                </Typography>
                                <View style={styles.chipRow}>
                                    {BHK_OPTIONS.map((bhk) => (
                                        <TouchableOpacity
                                            key={String(bhk.id)}
                                            style={[styles.bhkChip, filters.bhk === bhk.id && styles.sheetChipActive]}
                                            onPress={() => onChange({ bhk: bhk.id })}
                                        >
                                            <Typography
                                                variant="bodyMedium"
                                                style={[styles.sheetChipText, filters.bhk === bhk.id && styles.sheetChipTextActive]}
                                            >
                                                {bhk.label}
                                            </Typography>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Section 4: Budget Range */}
                            <View style={styles.filterSection}>
                                <Typography variant="titleSmall" style={styles.sectionHeader}>
                                    BUDGET
                                </Typography>
                                <View style={styles.chipGrid}>
                                    {budgets.map((b) => (
                                        <TouchableOpacity
                                            key={b.id}
                                            style={[styles.sheetGridChip, currentBudgetId === b.id && styles.sheetChipActive]}
                                            onPress={() => onChange({ minPrice: b.min, maxPrice: b.max })}
                                        >
                                            <Typography
                                                variant="bodyMedium"
                                                style={[styles.sheetChipText, currentBudgetId === b.id && styles.sheetChipTextActive]}
                                            >
                                                {b.label}
                                            </Typography>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </ScrollView>

                        {/* Sticky Bottom CTA */}
                        <View style={styles.sheetFooter}>
                            <TouchableOpacity
                                onPress={() => onChange({ subtype: null, bhk: null, minPrice: null, maxPrice: null })}
                                style={styles.resetBtn}
                            >
                                <Typography variant="bodyMedium" style={{ color: COLORS.secondary, fontWeight: '600' }}>
                                    Reset
                                </Typography>
                            </TouchableOpacity>

                            <View style={{ flex: 1 }}>
                                <AntigravityButton
                                    title={resultCount > 0 ? `Show ${resultCount} properties` : 'Show properties'}
                                    size="large"
                                    onPress={() => setSheetVisible(false)}
                                    style={styles.showButton}
                                />
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: SPACING.l,
        marginTop: SPACING.s,
        gap: 6,
    },
    primaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
    },
    primaryPill: {
        paddingHorizontal: SPACING.l,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.round,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.subtle,
    },
    primaryPillActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    primaryPillText: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    primaryPillTextActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    categoryScroll: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 2,
    },
    categoryChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.round,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.subtle,
    },
    categoryChipActive: {
        backgroundColor: '#111827',
        borderColor: '#111827',
    },
    categoryChipText: {
        color: COLORS.primary,
        fontWeight: '600',
        fontSize: 12,
    },
    categoryChipTextActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    secondaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
    },
    refinePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.round,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        ...SHADOWS.subtle,
    },
    refinePillActive: {
        backgroundColor: '#111827',
        borderColor: '#111827',
    },
    refinePillText: {
        color: COLORS.secondary,
        fontWeight: '600',
    },
    refinePillTextActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: BORDER_RADIUS.sheet,
        borderTopRightRadius: BORDER_RADIUS.sheet,
        maxHeight: '85%',
        ...SHADOWS.floating,
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.l,
        paddingBottom: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    sheetTitle: {
        color: COLORS.primary,
        fontWeight: '800',
    },
    sheetSubtitle: {
        color: COLORS.secondary,
        marginTop: 2,
    },
    sheetCloseBtn: {
        padding: 4,
    },
    sheetContent: {
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.l,
        paddingBottom: SPACING.xl,
    },
    filterSection: {
        marginBottom: SPACING.xl,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.8,
        color: COLORS.secondary,
        marginBottom: SPACING.m,
    },
    chipRow: {
        flexDirection: 'row',
        gap: SPACING.s,
    },
    chipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.s,
    },
    sheetChip: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
    },
    sheetGridChip: {
        paddingHorizontal: SPACING.m,
        paddingVertical: 10,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
    },
    bhkChip: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
    },
    sheetChipActive: {
        backgroundColor: '#111827',
        borderColor: '#111827',
    },
    sheetChipText: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    sheetChipTextActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    sheetFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.l,
        paddingVertical: SPACING.m,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        gap: SPACING.m,
        backgroundColor: COLORS.surface,
    },
    resetBtn: {
        paddingHorizontal: SPACING.m,
        paddingVertical: 12,
    },
    showButton: {
        height: 52,
        borderRadius: BORDER_RADIUS.button,
    },
});

export default PropertyFilters;
