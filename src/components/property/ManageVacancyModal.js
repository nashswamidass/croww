import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from '../Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { inventoryDashboardService } from '../../services/property/inventoryDashboardService';
import { validateAvailabilityInput } from '../../domain/property';

export default function ManageVacancyModal({
    visible,
    listing,
    onClose,
    onSaved,
}) {
    const existing = listing?.availability || null;
    const mode = existing?.availabilityMode || listing?.availabilityMode || (listing?.subtype?.includes('room') ? 'UNIT' : 'BED');
    const initialCapacity = existing?.totalCapacity ?? (mode === 'BED' ? 10 : 4);
    const initialAvailable = existing?.availableCount ?? listing?.availableCount ?? 1;
    const initialOccupied = existing?.occupiedCount ?? Math.max(0, initialCapacity - initialAvailable);
    const initialFrom = existing?.availableFrom || listing?.availableFrom || '';

    const [totalCapacity, setTotalCapacity] = useState(initialCapacity);
    const [availableCount, setAvailableCount] = useState(initialAvailable);
    const [occupiedCount, setOccupiedCount] = useState(initialOccupied);
    const [availableFrom, setAvailableFrom] = useState(initialFrom);
    const [isFuture, setIsFuture] = useState(Boolean(initialFrom));
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (visible && listing) {
            const cur = listing.availability || null;
            const curCapacity = cur?.totalCapacity ?? (cur?.availabilityMode === 'UNIT' ? 4 : 10);
            const curAvailable = cur?.availableCount ?? listing.availableCount ?? 0;
            const curOccupied = cur?.occupiedCount ?? Math.max(0, curCapacity - curAvailable);
            const curFrom = cur?.availableFrom || listing.availableFrom || '';
            setTotalCapacity(curCapacity);
            setAvailableCount(curAvailable);
            setOccupiedCount(curOccupied);
            setAvailableFrom(curFrom);
            setIsFuture(Boolean(curFrom));
            setErrorMessage('');
            setLoading(false);
        }
    }, [visible, listing]);

    const handleIncrement = () => {
        setErrorMessage('');
        if (availableCount < totalCapacity) {
            const next = availableCount + 1;
            setAvailableCount(next);
            setOccupiedCount(Math.max(0, totalCapacity - next));
        }
    };

    const handleDecrement = () => {
        setErrorMessage('');
        if (availableCount > 0) {
            const next = availableCount - 1;
            setAvailableCount(next);
            setOccupiedCount(Math.min(totalCapacity, totalCapacity - next));
        }
    };

    const handleMarkFull = () => {
        setErrorMessage('');
        setAvailableCount(0);
        // Preserves realistic occupancy rather than fabricating 100% headcount
        setAvailableFrom('');
        setIsFuture(false);
    };

    const handleAddOne = () => {
        handleIncrement();
    };

    const handleReduceOne = () => {
        handleDecrement();
    };

    const handleReopen = () => {
        setErrorMessage('');
        if (availableCount === 0) {
            const next = 1;
            setAvailableCount(next);
            setOccupiedCount(Math.min(occupiedCount, Math.max(0, totalCapacity - next)));
        }
    };

    const handleSave = async () => {
        if (loading) return;
        setErrorMessage('');
        const payload = {
            availabilityMode: mode,
            totalCapacity: Number(totalCapacity),
            occupiedCount: Number(occupiedCount),
            availableCount: Number(availableCount),
            availableFrom: isFuture && availableFrom.trim() ? availableFrom.trim() : null,
        };

        const issues = validateAvailabilityInput(payload);
        if (issues.length) {
            setErrorMessage(issues.map((i) => i.message).join('. '));
            return;
        }

        setLoading(true);
        try {
            const updated = await inventoryDashboardService.updateListingAvailability(listing.id, payload);
            if (onSaved) onSaved(updated);
            if (onClose) onClose();
        } catch (err) {
            setErrorMessage(err?.message || 'Could not update availability');
        } finally {
            setLoading(false);
        }
    };

    if (!visible || !listing) return null;

    const unitLabel = mode === 'BED' ? 'beds' : 'rooms';
    const singleUnitLabel = mode === 'BED' ? 'bed' : 'room';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.overlay}
            >
                <View style={styles.sheet}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerTitles}>
                            <Typography variant="h3">Manage Vacancy</Typography>
                            <Typography variant="caption" style={styles.subTitle} numberOfLines={1}>
                                {listing.title || 'Listing Inventory'} · {mode} mode
                            </Typography>
                        </View>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Close manage vacancy"
                        >
                            <Ionicons name="close" size={22} color={COLORS.primary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                        {/* Current Availability Status Banner */}
                        <View style={styles.statusBanner}>
                            <Typography variant="caption" style={styles.statusHeader}>
                                CURRENT AVAILABILITY
                            </Typography>
                            <Typography variant="h2" style={styles.statusCount}>
                                {availableCount === 0
                                    ? 'Currently Full'
                                    : `${availableCount} ${availableCount === 1 ? singleUnitLabel : unitLabel} available`}
                            </Typography>
                            <Typography variant="caption" style={styles.statusSub}>
                                {occupiedCount} occupied of {totalCapacity} total {unitLabel}
                            </Typography>
                        </View>

                        {/* Stepper Controls */}
                        <View style={styles.stepperContainer}>
                            <TouchableOpacity
                                onPress={handleDecrement}
                                disabled={availableCount <= 0 || loading}
                                style={[styles.stepBtn, availableCount <= 0 && styles.stepBtnDisabled]}
                                accessibilityRole="button"
                                accessibilityLabel="Reduce vacancy"
                            >
                                <Ionicons name="remove" size={24} color={availableCount <= 0 ? COLORS.tertiary : COLORS.primary} />
                            </TouchableOpacity>

                            <View style={styles.stepValueContainer}>
                                <Typography variant="h1" style={styles.stepValue}>
                                    {availableCount}
                                </Typography>
                                <Typography variant="caption" style={styles.stepUnit}>
                                    {availableCount === 1 ? singleUnitLabel : unitLabel}
                                </Typography>
                            </View>

                            <TouchableOpacity
                                onPress={handleIncrement}
                                disabled={availableCount >= totalCapacity || loading}
                                style={[styles.stepBtn, availableCount >= totalCapacity && styles.stepBtnDisabled]}
                                accessibilityRole="button"
                                accessibilityLabel="Increase vacancy"
                            >
                                <Ionicons name="add" size={24} color={availableCount >= totalCapacity ? COLORS.tertiary : COLORS.primary} />
                            </TouchableOpacity>
                        </View>

                        {/* Quick Action Chips */}
                        <View style={styles.actionChipsRow}>
                            <TouchableOpacity
                                onPress={handleAddOne}
                                disabled={availableCount >= totalCapacity || loading}
                                style={styles.chip}
                            >
                                <Typography variant="caption" style={styles.chipText}>+ Add Vacancy</Typography>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleReduceOne}
                                disabled={availableCount <= 0 || loading}
                                style={styles.chip}
                            >
                                <Typography variant="caption" style={styles.chipText}>− Reduce Vacancy</Typography>
                            </TouchableOpacity>
                            {availableCount > 0 ? (
                                <TouchableOpacity
                                    onPress={handleMarkFull}
                                    disabled={loading}
                                    style={[styles.chip, styles.chipDestructive]}
                                >
                                    <Typography variant="caption" style={styles.chipDestructiveText}>Mark Full</Typography>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    onPress={handleReopen}
                                    disabled={loading}
                                    style={[styles.chip, styles.chipReopen]}
                                >
                                    <Typography variant="caption" style={styles.chipReopenText}>Reopen Listing</Typography>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Available From Date */}
                        <View style={styles.dateSection}>
                            <View style={styles.dateHeaderRow}>
                                <Typography variant="caption" style={styles.dateHeading}>
                                    AVAILABILITY DATE
                                </Typography>
                                <TouchableOpacity
                                    onPress={() => {
                                        if (isFuture) {
                                            setIsFuture(false);
                                            setAvailableFrom('');
                                        } else {
                                            setIsFuture(true);
                                            // default tomorrow or empty
                                            const d = new Date();
                                            d.setDate(d.getDate() + 1);
                                            const yyyy = d.getFullYear();
                                            const mm = String(d.getMonth() + 1).padStart(2, '0');
                                            const dd = String(d.getDate()).padStart(2, '0');
                                            setAvailableFrom(`${yyyy}-${mm}-${dd}`);
                                        }
                                    }}
                                >
                                    <Typography variant="caption" style={styles.dateToggle}>
                                        {isFuture ? 'Available Immediately' : 'Set Future Date'}
                                    </Typography>
                                </TouchableOpacity>
                            </View>

                            {isFuture ? (
                                <View style={styles.dateInputContainer}>
                                    <TextInput
                                        style={styles.dateInput}
                                        placeholder="YYYY-MM-DD (e.g. 2026-10-15)"
                                        value={availableFrom}
                                        onChangeText={setAvailableFrom}
                                        placeholderTextColor={COLORS.tertiary}
                                        autoCapitalize="none"
                                    />
                                    <Typography variant="caption" style={styles.dateHint}>
                                        Listing will indicate &quot;Available from [Date]&quot; until this date arrives.
                                    </Typography>
                                </View>
                            ) : (
                                <Typography variant="caption" style={styles.nowNotice}>
                                    ✓ Available immediately for new occupants.
                                </Typography>
                            )}
                        </View>

                        {/* Error Message */}
                        {errorMessage ? (
                            <View style={styles.errorBox}>
                                <Ionicons name="alert-circle" size={16} color={COLORS.error} style={{ marginRight: 6 }} />
                                <Typography variant="caption" style={styles.errorText}>
                                    {errorMessage}
                                </Typography>
                            </View>
                        ) : null}
                    </ScrollView>

                    {/* Footer Buttons */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.cancelBtn}
                            disabled={loading}
                        >
                            <Typography variant="body" style={styles.cancelBtnText}>Cancel</Typography>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={loading}
                            style={styles.saveBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Update Availability"
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Typography variant="body" style={styles.saveBtnText}>Update Availability</Typography>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.l,
        paddingBottom: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    headerTitles: {
        flex: 1,
    },
    subTitle: {
        color: COLORS.secondary,
        marginTop: 2,
    },
    closeBtn: {
        padding: SPACING.xs,
        marginLeft: SPACING.s,
    },
    body: {
        padding: SPACING.l,
    },
    statusBanner: {
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: BORDER_RADIUS.card,
        padding: SPACING.m,
        alignItems: 'center',
        marginBottom: SPACING.l,
    },
    statusHeader: {
        color: COLORS.secondary,
        fontWeight: '700',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    statusCount: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    statusSub: {
        color: COLORS.secondary,
        marginTop: 4,
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.l,
    },
    stepBtn: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    stepBtnDisabled: {
        opacity: 0.4,
    },
    stepValueContainer: {
        alignItems: 'center',
        minWidth: 100,
        marginHorizontal: SPACING.xl,
    },
    stepValue: {
        fontSize: 38,
        fontWeight: '700',
        color: COLORS.primary,
    },
    stepUnit: {
        color: COLORS.secondary,
        marginTop: -4,
    },
    actionChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.s,
        justifyContent: 'center',
        marginBottom: SPACING.l,
    },
    chip: {
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    chipText: {
        fontWeight: '600',
        color: COLORS.primary,
    },
    chipDestructive: {
        backgroundColor: '#FEE2E2',
        borderColor: '#FCA5A5',
    },
    chipDestructiveText: {
        fontWeight: '600',
        color: COLORS.error,
    },
    chipReopen: {
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
    },
    chipReopenText: {
        fontWeight: '600',
        color: COLORS.success,
    },
    dateSection: {
        backgroundColor: COLORS.surfaceSubtle,
        borderRadius: BORDER_RADIUS.card,
        padding: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: SPACING.m,
    },
    dateHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.xs,
    },
    dateHeading: {
        color: COLORS.secondary,
        fontWeight: '700',
    },
    dateToggle: {
        color: '#2563EB',
        fontWeight: '600',
    },
    dateInputContainer: {
        marginTop: SPACING.xs,
    },
    dateInput: {
        height: 42,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        paddingHorizontal: SPACING.m,
        fontSize: 14,
        color: COLORS.primary,
    },
    dateHint: {
        color: COLORS.secondary,
        marginTop: 4,
        fontSize: 11,
    },
    nowNotice: {
        color: COLORS.success,
        marginTop: 4,
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        borderRadius: 8,
        padding: SPACING.s,
        marginTop: SPACING.xs,
    },
    errorText: {
        color: COLORS.error,
        flex: 1,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.m,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        gap: SPACING.m,
    },
    cancelBtn: {
        flex: 1,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surfaceHighlight,
    },
    cancelBtnText: {
        fontWeight: '600',
        color: COLORS.primary,
    },
    saveBtn: {
        flex: 2,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
    },
    saveBtnText: {
        fontWeight: '600',
        color: '#FFFFFF',
    },
});
