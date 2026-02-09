import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { MOCK_ANALYTICS } from '../../data/mockAnalytics';

const { width } = Dimensions.get('window');

const MetricCard = ({ title, value, change, icon, color }) => (
    <NotionCard style={styles.metricCard}>
        <View style={styles.metricHeader}>
            <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
                <Ionicons name={icon} size={18} color={color} />
            </View>
            <Typography variant="caption" style={styles.changeText}>
                {change}
            </Typography>
        </View>
        <Typography variant="h2" style={styles.metricValue}>{value}</Typography>
        <Typography variant="caption" color={COLORS.secondary}>{title}</Typography>
    </NotionCard>
);

const BusinessDashboardScreen = ({ navigation }) => {
    const stats = MOCK_ANALYTICS;

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <View>
                    <Typography variant="h1">Dashboard</Typography>
                    <Typography variant="body" color={COLORS.secondary}>Welcome back, Business Owner</Typography>
                </View>
                <TouchableOpacity
                    style={styles.profileButton}
                    onPress={() => navigation.navigate('Profile')}
                >
                    <Ionicons name="person-circle" size={28} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Key Metrics */}
                <View style={styles.metricsGrid}>
                    <MetricCard
                        title="Profile Views"
                        value={stats.profileViews.total}
                        change={stats.profileViews.change}
                        icon="eye-outline"
                        color={COLORS.primary}
                    />
                    <MetricCard
                        title="Total Earnings"
                        value={stats.bookings.earnings}
                        change="+8%"
                        icon="cash-outline"
                        color={COLORS.success || '#4CAF50'}
                    />
                </View>

                <View style={styles.metricsGrid}>
                    <MetricCard
                        title="New Bookings"
                        value={stats.bookings.pending}
                        change="5 Pending"
                        icon="calendar-outline"
                        color={COLORS.accent}
                    />
                    <MetricCard
                        title="Avg Rating"
                        value={stats.engagement.rating}
                        change="★ 4.8"
                        icon="star-outline"
                        color="#FFD700"
                    />
                </View>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>Quick Actions</Typography>
                    <View style={styles.actionGrid}>
                        <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('CreateEvent')}>
                            <Ionicons name="add-circle" size={28} color={COLORS.primary} />
                            <Typography variant="caption">Post Event</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionItem}>
                            <Ionicons name="people" size={28} color={COLORS.primary} />
                            <Typography variant="caption">Manage Staff</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionItem}>
                            <Ionicons name="chatbubbles" size={28} color={COLORS.primary} />
                            <Typography variant="caption">Inquiries</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('Settings')}>
                            <Ionicons name="settings" size={28} color={COLORS.primary} />
                            <Typography variant="caption">Settings</Typography>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Recent Activity */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>Recent Activity</Typography>
                    {stats.recentActivity.map((activity) => (
                        <View key={activity.id} style={styles.activityItem}>
                            <View style={styles.activityIcon}>
                                <Ionicons
                                    name={activity.type === 'booking' ? 'calendar' : (activity.type === 'review' ? 'star' : 'eye')}
                                    size={16}
                                    color={COLORS.secondary}
                                />
                            </View>
                            <View style={styles.activityContent}>
                                <Typography variant="body">
                                    <Typography variant="body" style={{ fontWeight: '600' }}>{activity.user}</Typography>
                                    {activity.type === 'booking' ? ' requested a booking' : (activity.type === 'review' ? ` left a ${activity.rating}★ review` : ' viewed your profile')}
                                </Typography>
                                <Typography variant="caption" color={COLORS.secondary}>{activity.time}</Typography>
                            </View>
                            {activity.status && (
                                <View style={[styles.statusBadge, { backgroundColor: activity.status === 'pending' ? COLORS.accent + '20' : COLORS.success + '20' }]}>
                                    <Typography variant="small" style={{ color: activity.status === 'pending' ? COLORS.accent : COLORS.success }}>
                                        {activity.status}
                                    </Typography>
                                </View>
                            )}
                        </View>
                    ))}
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.m,
    },
    profileButton: {
        padding: SPACING.xs,
    },
    content: {
        padding: SPACING.m,
        paddingBottom: SPACING.xl,
    },
    metricsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.m,
    },
    metricCard: {
        width: (width - SPACING.m * 3) / 2,
        padding: SPACING.m,
    },
    metricHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.s,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    metricValue: {
        color: COLORS.primary,
        marginBottom: 2,
    },
    changeText: {
        color: COLORS.success || '#4CAF50',
        fontWeight: '600',
    },
    section: {
        marginTop: SPACING.l,
    },
    sectionTitle: {
        marginBottom: SPACING.m,
    },
    actionGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: COLORS.surface,
        padding: SPACING.m,
        borderRadius: BORDER_RADIUS.l,
        ...SHADOWS.small,
    },
    actionItem: {
        alignItems: 'center',
        flex: 1,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    activityIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
    },
    activityContent: {
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: SPACING.s,
        paddingVertical: 2,
        borderRadius: 4,
    }
});

export default BusinessDashboardScreen;
