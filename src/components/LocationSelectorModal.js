import React, { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, FlatList, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from './Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const POPULAR_CITIES = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad',
    'Chennai', 'Kolkata', 'Surat', 'Pune', 'Jaipur', 'Goa'
];

const LocationSelectorModal = ({ visible, onClose, onSelect, currentCity }) => {
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCities = POPULAR_CITIES.filter(city =>
        city.toLowerCase().includes(searchQuery.toLowerCase())
    );

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

                    <Typography variant="caption" style={styles.sectionTitle}>Popular Cities</Typography>

                    <FlatList
                        data={filteredCities}
                        keyExtractor={(item) => item}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[
                                    styles.cityItem,
                                    currentCity === item && styles.cityItemActive
                                ]}
                                onPress={() => {
                                    onSelect(item);
                                    onClose();
                                }}
                            >
                                <Typography
                                    variant="body"
                                    style={{ color: currentCity === item ? COLORS.primary : COLORS.secondary }}
                                >
                                    {item}
                                </Typography>
                                {currentCity === item && (
                                    <Ionicons name="checkmark-circle" size={20} color={COLORS.accent} />
                                )}
                            </TouchableOpacity>
                        )}
                        contentContainerStyle={styles.listContent}
                    />

                    <TouchableOpacity
                        style={styles.autoLocation}
                        onPress={() => {
                            onSelect(null); // Signal to use auto-detection
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: BORDER_RADIUS.l,
        borderTopRightRadius: BORDER_RADIUS.l,
        maxHeight: '80%',
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
        marginBottom: SPACING.l,
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
    sectionTitle: {
        color: COLORS.secondary,
        textTransform: 'uppercase',
        marginBottom: SPACING.s,
        letterSpacing: 1,
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
    cityItemActive: {
        backgroundColor: COLORS.accent + '05',
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
