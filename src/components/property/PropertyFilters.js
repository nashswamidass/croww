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

const PROPERTY_TYPES = [
    { id: null, label: 'Any Type' },
    { id: 'apartment', label: 'Apartment' },
    { id: 'villa', label: 'Villa' },
    { id: 'independent_house', label: 'Independent House' },
    { id: 'plot', label: 'Land / Plot' },
    { id: 'commercial', label: 'Commercial' },
];

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

    const budgets = filters.transactionType === 'rent' ? RENT_BUDGETS : BUY_BUDGETS;
    const currentBudgetId = budgets.find(
        (b) => b.min === filters.minPrice && b.max === filters.maxPrice
    )?.id || 'any';

    const activeFilterCount = (filters.bhk ? 1 : 0)
        + (filters.subtype ? 1 : 0)
        + (filters.minPrice != null || filters.maxPrice != null ? 1 : 0);

    return (
        <View style={styles.container}>
            {/* Row 1: Primary Intent [ Buy ] [ Rent ] [ Commercial ] */}
            <View style={styles.primaryRow}>
                <TouchableOpacity
                    style={[styles.primaryPill, filters.transactionType === 'buy' && styles.primaryPillActive]}
                    onPress={() => onChange({ transactionType: 'buy', category: 'residential', minPrice: null, maxPrice: null })}
                    activeOpacity={0.8}
                >
                    <Typography
                        variant="bodyMedium"
                        style={[styles.primaryPillText, filters.transactionType === 'buy' && styles.primaryPillTextActive]}
                    >
                        Buy
                    </Typography>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.primaryPill, filters.transactionType === 'rent' && styles.primaryPillActive]}
                    onPress={() => onChange({ transactionType: 'rent', category: 'residential', minPrice: null, maxPrice: null })}
                    activeOpacity={0.8}
                >
                    <Typography
                        variant="bodyMedium"
                        style={[styles.primaryPillText, filters.transactionType === 'rent' && styles.primaryPillTextActive]}
                    >
                        Rent
                    </Typography>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.primaryPill, filters.category === 'commercial' && styles.primaryPillActive]}
                    onPress={() => onChange({ category: filters.category === 'commercial' ? 'residential' : 'commercial', subtype: null })}
                    activeOpacity={0.8}
                >
                    <Typography
                        variant="bodyMedium"
                        style={[styles.primaryPillText, filters.category === 'commercial' && styles.primaryPillTextActive]}
                    >
                        Commercial
                    </Typography>
                </TouchableOpacity>
            </View>

            {/* Row 2: Calm Refinements [ 2 BHK ] [ Budget ] [ More Filters ▾ ] */}
            <View style={styles.secondaryRow}>
                <TouchableOpacity
                    style={[styles.refinePill, filters.bhk === 2 && styles.refinePillActive]}
                    onPress={() => onChange({ bhk: filters.bhk === 2 ? null : 2 })}
                    activeOpacity={0.8}
                >
                    <Typography
                        variant="caption"
                        style={[styles.refinePillText, filters.bhk === 2 && styles.refinePillTextActive]}
                    >
                        {filters.bhk ? `${filters.bhk} BHK` : '2 BHK'}
                    </Typography>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.refinePill, (filters.minPrice != null || filters.maxPrice != null) && styles.refinePillActive]}
                    onPress={() => setSheetVisible(true)}
                    activeOpacity={0.8}
                >
                    <Typography
                        variant="caption"
                        style={[styles.refinePillText, (filters.minPrice != null || filters.maxPrice != null) && styles.refinePillTextActive]}
                    >
                        {currentBudgetId !== 'any' ? budgets.find(b => b.id === currentBudgetId)?.label : 'Budget'}
                    </Typography>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.refinePill, activeFilterCount > 0 && styles.refinePillActive]}
                    onPress={() => setSheetVisible(true)}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name="options-outline"
                        size={14}
                        color={activeFilterCount > 0 ? '#FFFFFF' : COLORS.secondary}
                        style={{ marginRight: 4 }}
                    />
                    <Typography
                        variant="caption"
                        style={[styles.refinePillText, activeFilterCount > 0 && styles.refinePillTextActive]}
                    >
                        {activeFilterCount > 0 ? `${activeFilterCount} Active` : 'Filters'}
                    </Typography>
                </TouchableOpacity>
            </View>

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
                                                {tx === 'buy' ? 'Buy Property' : 'Rent Home'}
                                            </Typography>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Section 2: Property Type */}
                            <View style={styles.filterSection}>
                                <Typography variant="titleSmall" style={styles.sectionHeader}>
                                    PROPERTY TYPE
                                </Typography>
                                <View style={styles.chipGrid}>
                                    {PROPERTY_TYPES.map((pt) => (
                                        <TouchableOpacity
                                            key={String(pt.id)}
                                            style={[styles.sheetGridChip, filters.subtype === pt.id && styles.sheetChipActive]}
                                            onPress={() => onChange({ subtype: pt.id })}
                                        >
                                            <Typography
                                                variant="bodyMedium"
                                                style={[styles.sheetChipText, filters.subtype === pt.id && styles.sheetChipTextActive]}
                                            >
                                                {pt.label}
                                            </Typography>
                                        </TouchableOpacity>
                                    ))}
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
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    primaryPillText: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    primaryPillTextActive: {
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
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
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
        backgroundColor: COLORS.accentMuted,
        borderColor: COLORS.accent,
    },
    sheetChipText: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    sheetChipTextActive: {
        color: COLORS.accent,
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
