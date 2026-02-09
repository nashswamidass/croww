import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionInput from '../../components/NotionInput';
import NotionCard from '../../components/NotionCard';
import { SPACING, COLORS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { SERVICE_PROVIDERS, SERVICE_CATEGORIES } from '../../data/mockServiceProviders';
import { getDistanceFromLatLonInKm, formatDistance } from '../../utils/distance';

// Mock User Location (Mumbai Center)
const MOCK_USER_LOCATION = { latitude: 19.0760, longitude: 72.8777 };

const SearchScreen = ({ navigation }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [sortByDistance, setSortByDistance] = useState(false);
    const [filteredProviders, setFilteredProviders] = useState(SERVICE_PROVIDERS);

    useEffect(() => {
        let results = SERVICE_PROVIDERS.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.role.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = !selectedCategory || p.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });

        if (sortByDistance) {
            results = [...results].sort((a, b) => {
                const distA = getDistanceFromLatLonInKm(
                    MOCK_USER_LOCATION.latitude, MOCK_USER_LOCATION.longitude,
                    a.coordinates.latitude, a.coordinates.longitude
                );
                const distB = getDistanceFromLatLonInKm(
                    MOCK_USER_LOCATION.latitude, MOCK_USER_LOCATION.longitude,
                    b.coordinates.latitude, b.coordinates.longitude
                );
                return distA - distB;
            });
        }

        setFilteredProviders(results);
    }, [searchQuery, selectedCategory, sortByDistance]);

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <Typography variant="h1">Marketplace</Typography>
                <NotionInput
                    placeholder="Search services..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <Typography variant="h3">Categories</Typography>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                        {SERVICE_CATEGORIES.map((cat) => (
                            <TouchableOpacity
                                key={cat.id}
                                style={[
                                    styles.categoryButton,
                                    selectedCategory === cat.name && styles.categoryButtonActive
                                ]}
                                onPress={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                            >
                                <View style={[
                                    styles.iconCircle,
                                    selectedCategory === cat.name && styles.iconCircleActive
                                ]}>
                                    <Ionicons
                                        name={cat.icon}
                                        size={20}
                                        color={selectedCategory === cat.name ? COLORS.background : COLORS.primary}
                                    />
                                </View>
                                <Typography
                                    variant="small"
                                    style={[
                                        styles.categoryText,
                                        selectedCategory === cat.name && styles.categoryTextActive
                                    ]}
                                >
                                    {cat.name}
                                </Typography>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.resultHeader}>
                    <Typography variant="h3">Results ({filteredProviders.length})</Typography>
                    <TouchableOpacity
                        style={[styles.sortButton, sortByDistance && styles.sortButtonActive]}
                        onPress={() => setSortByDistance(!sortByDistance)}
                    >
                        <Ionicons
                            name="location"
                            size={16}
                            color={sortByDistance ? COLORS.background : COLORS.accent}
                        />
                        <Typography
                            variant="small"
                            style={[styles.sortText, sortByDistance && styles.sortTextActive]}
                        >
                            Sort by Proximity
                        </Typography>
                    </TouchableOpacity>
                </View>

                {filteredProviders.map((item) => {
                    const distance = getDistanceFromLatLonInKm(
                        MOCK_USER_LOCATION.latitude, MOCK_USER_LOCATION.longitude,
                        item.coordinates.latitude, item.coordinates.longitude
                    );

                    return (
                        <NotionCard
                            key={item.id}
                            style={styles.resultCard}
                            onPress={() => navigation.navigate('ServiceDetail', { serviceId: item.id })}
                        >
                            <View style={styles.row}>
                                <View style={[styles.avatar, { backgroundColor: COLORS.surfaceHighlight }]}>
                                    <Ionicons name="person" size={20} color={COLORS.secondary} />
                                </View>
                                <View style={styles.info}>
                                    <Typography variant="h3">{item.name}</Typography>
                                    <Typography variant="caption" color={COLORS.secondary}>
                                        {item.role} • {item.location}
                                    </Typography>
                                    <Typography variant="caption" color={COLORS.accent} style={{ marginTop: 4 }}>
                                        📍 {formatDistance(distance)} away
                                    </Typography>
                                </View>
                                <View style={styles.meta}>
                                    <Typography variant="h3" style={{ color: COLORS.primary }}>
                                        ${item.price}{item.priceUnit}
                                    </Typography>
                                    <View style={styles.ratingRow}>
                                        <Ionicons name="star" size={14} color="#FFD700" />
                                        <Typography variant="caption" style={{ marginLeft: 4 }}>{item.rating}</Typography>
                                    </View>
                                </View>
                            </View>
                        </NotionCard>
                    );
                })}
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        padding: SPACING.m,
    },
    content: {
        paddingHorizontal: SPACING.m,
        paddingBottom: SPACING.xl,
    },
    section: {
        marginBottom: SPACING.l,
    },
    categoryScroll: {
        marginTop: SPACING.m,
        marginLeft: -SPACING.xs,
    },
    categoryButton: {
        alignItems: 'center',
        marginHorizontal: SPACING.s,
        width: 70,
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.xs,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    iconCircleActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    categoryText: {
        fontSize: 10,
        textAlign: 'center',
        color: COLORS.secondary,
    },
    categoryTextActive: {
        color: COLORS.primary,
        fontWeight: 'bold',
    },
    resultHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    sortButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.s,
        borderRadius: BORDER_RADIUS.s,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    sortButtonActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    sortText: {
        marginLeft: 6,
        color: COLORS.accent,
    },
    sortTextActive: {
        color: COLORS.background,
    },
    resultCard: {
        marginBottom: SPACING.m,
        padding: SPACING.m,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: SPACING.m,
        justifyContent: 'center',
        alignItems: 'center',
    },
    info: {
        flex: 1,
    },
    meta: {
        alignItems: 'flex-end',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    }
});

export default SearchScreen;
