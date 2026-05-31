import React, { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, SectionList, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from './Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Cities where the app is fully live
export const AVAILABLE_CITIES = ['Bengaluru', 'Trivandrum'];

const ALL_CITIES = [
    'Mumbai', 'Delhi', 'Hyderabad', 'Ahmedabad',
    'Chennai', 'Kolkata', 'Pune', 'Jaipur', 'Goa', 'Kochi', 'Surat',
];

const LocationSelectorModal = ({ visible, onClose, onSelect, currentCity }) => {
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');

    const query = searchQuery.toLowerCase();

    const filteredAvailable = AVAILABLE_CITIES.filter(c => c.toLowerCase().includes(query));
    const filteredOther = ALL_CITIES.filter(c => c.toLowerCase().includes(query));

    const sections = [
        ...(filteredAvailable.length > 0 ? [{ title: 'available', data: filteredAvailable }] : []),
        ...(filteredOther.length > 0 ? [{ title: 'comingsoon', data: filteredOther }] : []),
    ];

    return (
        <Modal visible={visible} animationType="slide" transparent={true}>
            <View style={styles.overlay}>
                <View style={[styles.container, { paddingBottom: insets.bottom + SPACING.l }]}>
                    <View style={styles.header}>
                        <Typography variant="h3">Select Location</Typography>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color={COLORS.secondary} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search city..."
                            placeholderTextColor={COLORS.secondary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    <SectionList
                        sections={sections}
                        keyExtractor={(item) => item}
                        renderSectionHeader={({ section }) => (
                            <View style={styles.sectionHeaderRow}>
                                {section.title === 'available' ? (
                                    <>
                                        <Typography variant="caption" style={styles.sectionTitle}>Available Now</Typography>
                                        <View style={styles.liveBadge}>
                                            <View style={styles.liveDot} />
                                            <Typography style={styles.liveBadgeText}>LIVE</Typography>
                                        </View>
                                    </>
                                ) : (
                                    <Typography variant="caption" style={[styles.sectionTitle, { color: COLORS.secondary }]}>Coming Soon</Typography>
                                )}
                            </View>
                        )}
                        renderItem={({ item, section }) => {
                            const isAvailable = section.title === 'available';
                            const isSelected = currentCity === item;
                            return (
                                <TouchableOpacity
                                    style={[
                                        styles.cityItem,
                                        isSelected && styles.cityItemActive,
                                        !isAvailable && styles.cityItemDimmed,
                                    ]}
                                    onPress={() => {
                                        onSelect(item, isAvailable);
                                        onClose();
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.cityItemLeft}>
                                        <Ionicons
                                            name={isAvailable ? 'location' : 'lock-closed-outline'}
                                            size={18}
                                            color={isAvailable ? COLORS.accent : COLORS.secondary}
                                            style={{ marginRight: SPACING.s }}
                                        />
                                        <Typography
                                            variant="body"
                                            style={{
                                                color: isSelected ? COLORS.primary : isAvailable ? COLORS.primary : COLORS.secondary,
                                                fontWeight: isSelected ? '700' : '400',
                                            }}
                                        >
                                            {item}
                                        </Typography>
                                    </View>
                                    {isSelected ? (
                                        <Ionicons name="checkmark-circle" size={20} color={COLORS.accent} />
                                    ) : !isAvailable ? (
                                        <Typography style={styles.soonTag}>Soon</Typography>
                                    ) : null}
                                </TouchableOpacity>
                            );
                        }}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />

                    <TouchableOpacity
                        style={styles.autoLocation}
                        onPress={() => {
                            onSelect(null, false); // Signal to use auto-detection
                            onClose();
                        }}
                    >
                        <Ionicons name="locate" size={20} color={COLORS.accent} />
                        <Typography variant="body" style={{ color: COLORS.accent, marginLeft: SPACING.s }}>
                            Use Current Location
                        </Typography>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: BORDER_RADIUS.l,
        borderTopRightRadius: BORDER_RADIUS.l,
        maxHeight: '85%',
        padding: SPACING.m,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.l,
        paddingTop: SPACING.s,
    },
    closeButton: {
        padding: SPACING.xs,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: BORDER_RADIUS.m,
        paddingHorizontal: SPACING.m,
        marginBottom: SPACING.m,
    },
    searchIcon: {
        marginRight: SPACING.s,
    },
    searchInput: {
        flex: 1,
        height: 48,
        color: COLORS.primary,
        fontSize: 16,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: COLORS.surface,
        paddingVertical: SPACING.xs,
        marginTop: SPACING.s,
    },
    sectionTitle: {
        color: COLORS.accent,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontSize: 11,
        fontWeight: '700',
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#00C853' + '20',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#00C853',
    },
    liveBadgeText: {
        color: '#00C853',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    listContent: {
        paddingBottom: SPACING.m,
    },
    cityItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    cityItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cityItemActive: {
        backgroundColor: COLORS.accent + '10',
    },
    cityItemDimmed: {
        opacity: 0.55,
    },
    soonTag: {
        fontSize: 10,
        color: COLORS.secondary,
        fontWeight: '600',
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
    },
    autoLocation: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.m,
        marginTop: SPACING.s,
        borderWidth: 1,
        borderColor: COLORS.accent,
        borderRadius: BORDER_RADIUS.m,
    },
});

export default LocationSelectorModal;
