import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { reviewService } from '../../services/reviewService';

const StarRating = ({ rating, size = 16 }) => {
    return (
        <View style={{ flexDirection: 'row', gap: 2 }}>
            {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                    key={star}
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={size}
                    color={star <= rating ? '#FFD700' : COLORS.border}
                />
            ))}
        </View>
    );
};

const ReviewListScreen = ({ route, navigation }) => {
    const { businessId, businessName } = route.params || {};
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReviews = async () => {
            if (!businessId) {
                setLoading(false);
                return;
            }
            try {
                const data = await reviewService.getBusinessReviews(businessId);
                setReviews(data);
            } catch (error) {
                console.error('Error fetching all reviews:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchReviews();
    }, [businessId]);

    const renderReviewItem = ({ item }) => (
        <NotionCard style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
                <View style={{ flex: 1 }}>
                    <Typography variant="body" style={{ fontWeight: '600' }}>
                        {item.userName || 'Anonymous'}
                    </Typography>
                    <StarRating rating={item.rating} />
                </View>
                {item.createdAt && (
                    <Typography variant="small" color={COLORS.secondary}>
                        {item.createdAt.toDate
                            ? item.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : ''}
                    </Typography>
                )}
            </View>
            {item.comment ? (
                <Typography variant="body" color={COLORS.secondary} style={styles.comment}>
                    {item.comment}
                </Typography>
            ) : null}
        </NotionCard>
    );

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <View style={styles.headerTitle}>
                    <Typography variant="h2">Reviews</Typography>
                    {businessName && (
                        <Typography variant="caption" color={COLORS.secondary} numberOfLines={1}>
                            for {businessName}
                        </Typography>
                    )}
                </View>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={reviews}
                keyExtractor={(item) => item.id}
                renderItem={renderReviewItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="chatbubbles-outline" size={64} color={COLORS.border} />
                        <Typography variant="body" color={COLORS.secondary} style={{ marginTop: SPACING.m }}>
                            No reviews found yet.
                        </Typography>
                    </View>
                }
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: {
        flex: 1,
        alignItems: 'center',
    },
    listContent: {
        padding: SPACING.m,
        paddingBottom: 40,
    },
    reviewCard: {
        padding: SPACING.m,
        marginBottom: SPACING.m,
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.s,
    },
    comment: {
        marginTop: SPACING.s,
        lineHeight: 20,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
    },
});

export default ReviewListScreen;
