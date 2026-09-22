import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';

/**
 * High-performance pulsing skeleton placeholder.
 * Runs on the native driver to eliminate JS thread load.
 */
export const SkeletonBox = ({
    width = '100%',
    height = 20,
    borderRadius = BORDER_RADIUS.m,
    style,
}) => {
    const opacity = useRef(new Animated.Value(0.35)).current;

    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.85,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.35,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [opacity]);

    return (
        <Animated.View
            style={[
                styles.skeletonBase,
                {
                    width,
                    height,
                    borderRadius,
                    opacity,
                },
                style,
            ]}
        />
    );
};

/**
 * Structural Skeleton for Property Result Card in Carousel / Feed
 */
export const SkeletonCard = ({ style }) => (
    <View style={[styles.cardContainer, style]}>
        <SkeletonBox width="100%" height={120} borderRadius={BORDER_RADIUS.l} style={styles.cardImage} />
        <View style={styles.cardBody}>
            <SkeletonBox width="45%" height={20} borderRadius={BORDER_RADIUS.s} />
            <SkeletonBox width="70%" height={14} borderRadius={BORDER_RADIUS.s} style={{ marginTop: 8 }} />
            <SkeletonBox width="55%" height={12} borderRadius={BORDER_RADIUS.s} style={{ marginTop: 6 }} />
        </View>
    </View>
);

/**
 * Structural Skeleton for Listing Detail Screen
 * Renders immediately when opening a property so there is zero white flash.
 */
export const ListingDetailSkeleton = () => (
    <View style={styles.detailContainer}>
        {/* Hero Media Shell */}
        <SkeletonBox width="100%" height={260} borderRadius={0} style={styles.heroSkeleton} />

        <View style={styles.detailContent}>
            {/* Price & Title Shell */}
            <View style={styles.rowBetween}>
                <SkeletonBox width="40%" height={28} borderRadius={BORDER_RADIUS.s} />
                <SkeletonBox width="20%" height={24} borderRadius={BORDER_RADIUS.pill} />
            </View>
            <SkeletonBox width="80%" height={18} borderRadius={BORDER_RADIUS.s} style={{ marginTop: 12 }} />
            <SkeletonBox width="50%" height={14} borderRadius={BORDER_RADIUS.s} style={{ marginTop: 8 }} />

            {/* Facts Grid Shell */}
            <View style={styles.factsGrid}>
                <SkeletonBox width="30%" height={48} borderRadius={BORDER_RADIUS.m} />
                <SkeletonBox width="30%" height={48} borderRadius={BORDER_RADIUS.m} />
                <SkeletonBox width="30%" height={48} borderRadius={BORDER_RADIUS.m} />
            </View>

            {/* Map Preview Shell */}
            <SkeletonBox width="100%" height={140} borderRadius={BORDER_RADIUS.card} style={{ marginTop: 20 }} />

            {/* Actor Card Shell */}
            <View style={[styles.rowBetween, { marginTop: 24 }]}>
                <SkeletonBox width="60%" height={40} borderRadius={BORDER_RADIUS.m} />
                <SkeletonBox width="30%" height={40} borderRadius={BORDER_RADIUS.m} />
            </View>
        </View>
    </View>
);

const styles = StyleSheet.create({
    skeletonBase: {
        backgroundColor: '#E5E7EB',
    },
    cardContainer: {
        width: 240,
        backgroundColor: '#FFFFFF',
        borderRadius: BORDER_RADIUS.card,
        padding: SPACING.s,
        marginRight: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
    },
    cardImage: {
        marginBottom: SPACING.s,
    },
    cardBody: {
        paddingHorizontal: SPACING.xs,
    },
    detailContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    heroSkeleton: {
        width: '100%',
        height: 260,
    },
    detailContent: {
        padding: SPACING.l,
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    factsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
    },
});

export default SkeletonBox;
