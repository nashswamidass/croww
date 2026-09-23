import React, { useMemo, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AuthPromptModal from '../../components/auth/AuthPromptModal';
import CrowwScreenHeader from '../../components/CrowwScreenHeader';
import {
    BORDER_RADIUS,
    COLORS,
    FONT_SIZES,
    SHADOWS,
    SPACING,
    TOUCH_TARGETS,
} from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useTaxonomy } from '../../hooks/useTaxonomy';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

// Robust icon mapper for accommodation categories
const getCategoryIcon = (item) => {
    const id = (item.typeId || item.id || '').toLowerCase();
    const name = (item.displayName || '').toLowerCase();
    if (id.includes('bed') || name.includes('bed')) return 'bed-outline';
    if (id.includes('shared') || name.includes('shared')) return 'people-outline';
    if (id.includes('private') || name.includes('private')) return 'person-outline';
    if (id.includes('pg') || name.includes('pg')) return 'business-outline';
    if (id.includes('coliving') || name.includes('co-living') || name.includes('coliving')) return 'people-circle-outline';
    if (id.includes('roommate') || name.includes('roommate')) return 'swap-horizontal-outline';
    if (item.icon && item.icon !== 'key-outline') return item.icon;
    return 'home-outline';
};

// Concise 1-line descriptions that fit without truncation
const getCategoryDesc = (item) => {
    const id = (item.typeId || item.id || '').toLowerCase();
    const name = (item.displayName || '').toLowerCase();
    if (id.includes('bed') || name.includes('bed')) return 'Single bed space';
    if (id.includes('shared') || name.includes('shared')) return 'Shared with roommates';
    if (id.includes('private') || name.includes('private')) return 'Independent private room';
    if (id.includes('pg') || name.includes('pg')) return 'Food & housekeeping stay';
    if (id.includes('coliving') || name.includes('coliving')) return 'Managed community living';
    if (id.includes('roommate') || name.includes('roommate')) return 'Take over an existing room';
    return item.shortDescription || item.description || 'Accommodation space';
};

const normalizeId = (id) => (id || '').replace(/^stay_/, '').toLowerCase();

const PostScreen = () => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { isDesktop } = useResponsiveLayout();
    const [authModalVisible, setAuthModalVisible] = useState(false);
    const [authContext, setAuthContext] = useState('post');

    // Server-driven listing taxonomy
    const { activeTaxonomy, postingCategories } = useTaxonomy();

    // Dynamically retrieve all categories where posting is enabled, ordered by displayOrder
    const postingItems = useMemo(() => {
        const fromActive = activeTaxonomy
            .filter((item) => item.postingEnabled && item.rentEnabled)
            .sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999));

        if (fromActive.length > 0) return fromActive;
        return postingCategories('rent');
    }, [activeTaxonomy, postingCategories]);

    const [selectedType, setSelectedType] = useState('private_room');

    const handleContinue = () => {
        if (!user) {
            setAuthContext('post');
            setAuthModalVisible(true);
            return;
        }
        navigation.navigate('PostListing', { initialType: selectedType });
    };

    return (
        <ScreenWrapper edges={isDesktop ? [] : ['top']}>
            {!isDesktop && <CrowwScreenHeader navigation={navigation} withTopInset={false} />}
            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    isDesktop && styles.desktopScrollContent,
                    { paddingBottom: Math.max(insets.bottom, 16) + 120 },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* 1. Header — Launch-Oriented Focus */}
                <View style={styles.header}>
                    <View style={styles.badge}>
                        <Ionicons name="flash" size={13} color={COLORS.primary} />
                        <Text style={styles.badgeText}>COMMUNITY SHARING</Text>
                    </View>
                    <Typography variant="display" style={styles.title}>
                        Have a space to share?
                    </Typography>
                    <Typography variant="bodyLarge" style={styles.subtitle}>
                        List your bed, room, PG or co-living space on Croww.
                    </Typography>
                </View>

                {/* 2. Category Selection — "What are you offering?" */}
                <View style={styles.sectionWrap}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionQuestion}>What are you offering?</Text>
                        <Text style={styles.sectionHelp}>
                            Select the format that best matches your space.
                        </Text>
                    </View>

                    {/* 3. Compact Responsive Card Grid */}
                    <View style={[styles.gridContainer, isDesktop && styles.desktopGridContainer]}>
                        {postingItems.map((item, index) => {
                            const itemId = item.typeId || item.id;
                            const isSelected = normalizeId(selectedType) === normalizeId(itemId);
                            const isRoommate = itemId?.toLowerCase().includes('roommate') || item.displayName?.toLowerCase().includes('roommate');
                            const isOddLast = index === postingItems.length - 1 && postingItems.length % 2 !== 0;
                            const isFullWidth = isRoommate || isOddLast;

                            return (
                                <TouchableOpacity
                                    key={itemId}
                                    style={[
                                        styles.categoryCard,
                                        isDesktop
                                            ? styles.desktopCardWidth
                                            : (isFullWidth ? styles.cardFullWidth : styles.cardHalfWidth),
                                        isSelected && styles.categoryCardSelected,
                                    ]}
                                    activeOpacity={0.82}
                                    onPress={() => setSelectedType(itemId)}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: isSelected }}
                                    accessibilityLabel={item.displayName}
                                >
                                    <View style={styles.cardTopRow}>
                                        <View
                                            style={[
                                                styles.iconWrap,
                                                isSelected && styles.iconWrapSelected,
                                            ]}
                                        >
                                            <Ionicons
                                                name={getCategoryIcon(item)}
                                                size={20}
                                                color={COLORS.primary}
                                            />
                                        </View>

                                        <View
                                            style={[
                                                styles.radioCircle,
                                                isSelected && styles.radioCircleSelected,
                                            ]}
                                        >
                                            {isSelected && (
                                                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                                            )}
                                        </View>
                                    </View>

                                    <Text
                                        style={[
                                            styles.cardTitle,
                                            isSelected && styles.cardTitleSelected,
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {item.displayName}
                                    </Text>

                                    <Text style={styles.cardDesc} numberOfLines={1}>
                                        {getCategoryDesc(item)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* 5. Primary Continue CTA */}
                    <TouchableOpacity
                        style={styles.continueBtn}
                        activeOpacity={0.88}
                        onPress={handleContinue}
                        accessibilityRole="button"
                        accessibilityLabel="Continue to listing details"
                    >
                        <Text style={styles.continueBtnText}>Continue</Text>
                        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                    </TouchableOpacity>

                    {/* Secondary Access: Existing inventory */}
                    <TouchableOpacity
                        style={styles.inventoryLink}
                        activeOpacity={0.7}
                        onPress={() => {
                            if (!user) {
                                setAuthContext('inventory');
                                setAuthModalVisible(true);
                                return;
                            }
                            navigation.navigate('InventoryDashboard');
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Manage existing listings"
                    >
                        <Ionicons name="briefcase-outline" size={16} color={COLORS.secondary} style={{ marginRight: 6 }} />
                        <Text style={styles.inventoryLinkText}>
                            Manage existing listings
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <AuthPromptModal
                visible={authModalVisible}
                onClose={() => setAuthModalVisible(false)}
                navigation={navigation}
                title="Post your space"
                subtitle="Sign in to publish listings to verified home seekers and manage your space inventory."
                icon="home-outline"
                actionContext={authContext}
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    scrollContent: {
        paddingTop: SPACING.s,
    },
    header: {
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.s,
        paddingBottom: SPACING.m,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.round,
        gap: 4,
        marginBottom: 8,
    },
    badgeText: {
        color: COLORS.primary,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.6,
    },
    title: {
        color: COLORS.primary,
        fontWeight: '900',
        letterSpacing: -0.8,
        fontSize: 28,
        lineHeight: 34,
    },
    subtitle: {
        color: COLORS.secondary,
        marginTop: 4,
        fontSize: FONT_SIZES.m,
        lineHeight: 22,
    },
    sectionWrap: {
        paddingHorizontal: SPACING.l,
        marginBottom: SPACING.s,
    },
    sectionHeaderRow: {
        marginBottom: 12,
    },
    sectionQuestion: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.primary,
        letterSpacing: -0.3,
    },
    sectionHelp: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.secondary,
        marginTop: 2,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 16,
    },
    categoryCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.l,
        padding: 14,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        minHeight: 96,
        justifyContent: 'space-between',
        ...SHADOWS.subtle,
    },
    cardHalfWidth: {
        width: '48.2%',
        flexGrow: 1,
    },
    cardFullWidth: {
        width: '100%',
    },
    categoryCardSelected: {
        backgroundColor: COLORS.surface,
        borderColor: COLORS.primary,
        borderWidth: 2,
        ...SHADOWS.soft,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapSelected: {
        backgroundColor: COLORS.surfaceHighlight,
    },
    radioCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: COLORS.borderLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioCircleSelected: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.primary,
        letterSpacing: -0.2,
    },
    cardTitleSelected: {
        color: COLORS.primary,
        fontWeight: '800',
    },
    cardDesc: {
        fontSize: 11,
        color: COLORS.secondary,
        marginTop: 2,
    },
    continueBtn: {
        height: TOUCH_TARGETS.button,
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.button,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
        marginBottom: 12,
        ...SHADOWS.medium,
    },
    continueBtnText: {
        color: '#FFFFFF',
        fontSize: FONT_SIZES.m,
        fontWeight: '700',
        marginRight: 8,
    },
    inventoryLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
    },
    inventoryLinkText: {
        color: COLORS.secondary,
        fontWeight: '600',
        fontSize: FONT_SIZES.s,
    },
    desktopScrollContent: {
        maxWidth: 880,
        width: '100%',
        alignSelf: 'center',
        paddingTop: SPACING.l,
    },
    desktopGridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    desktopCardWidth: {
        width: '31.8%',
        minWidth: 240,
    },
});

export default PostScreen;
