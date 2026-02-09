import React from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionButton from '../../components/NotionButton';
import NotionCard from '../../components/NotionCard';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { SERVICE_PROVIDERS } from '../../data/mockServiceProviders';

const ServiceDetailScreen = ({ route, navigation }) => {
    const { serviceId } = route.params;
    const service = SERVICE_PROVIDERS.find(s => s.id === serviceId);

    if (!service) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <Typography variant="h2">Service Not Found</Typography>
                    <NotionButton title="Go Back" onPress={() => navigation.goBack()} />
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.topNav}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <View style={styles.titleRow}>
                        <Typography variant="h1">{service.name}</Typography>
                        <View style={styles.verifiedBadge}>
                            <Ionicons name="checkmark-circle" size={20} color={COLORS.accent} />
                        </View>
                    </View>
                    <Typography variant="h3" color={COLORS.secondary}>{service.role}</Typography>

                    <View style={styles.ratingRow}>
                        <Ionicons name="star" size={18} color="#FFD700" />
                        <Typography variant="h3" style={{ marginLeft: 4 }}>{service.rating}</Typography>
                        <Typography variant="caption" style={{ marginLeft: SPACING.s }}>
                            ({service.reviews} reviews)
                        </Typography>
                        <View style={styles.dot} />
                        <Typography variant="caption">{service.location}</Typography>
                    </View>
                </View>

                <View style={styles.section}>
                    <Typography variant="h3">About</Typography>
                    <Typography variant="body" style={styles.text}>{service.about}</Typography>
                </View>

                <View style={styles.section}>
                    <Typography variant="h3">Pricing</Typography>
                    <NotionCard style={styles.priceCard}>
                        {service.pricingType === 'inquiry' ? (
                            <View style={styles.priceRow}>
                                <Typography variant="h2" style={{ color: COLORS.primary }}>
                                    Price upon inquiry
                                </Typography>
                            </View>
                        ) : (
                            <View style={styles.priceRow}>
                                <Typography variant="h1" style={{ color: COLORS.primary }}>
                                    ${service.price}
                                </Typography>
                                <Typography variant="h3" color={COLORS.secondary}>
                                    {service.priceUnit}
                                </Typography>
                            </View>
                        )}
                        <Typography variant="caption">
                            {service.pricingType === 'inquiry'
                                ? "Send a message to get a custom quote"
                                : "Standard rates may vary based on event size"}
                        </Typography>
                    </NotionCard>
                </View>

                <View style={styles.section}>
                    <Typography variant="h3">Portfolio</Typography>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.portfolioScroll}>
                        {service.portfolio.map((img, index) => (
                            <View key={index} style={styles.portfolioItem}>
                                <View style={[styles.placeholderImage, { backgroundColor: COLORS.surfaceHighlight }]}>
                                    <Ionicons name="image-outline" size={32} color={COLORS.secondary} />
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <View style={styles.footerButtons}>
                    <TouchableOpacity
                        style={styles.messageButton}
                        onPress={() => navigation.navigate('Chat', {
                            recipientId: service.id,
                            recipientName: service.name,
                            recipientRole: service.role
                        })}
                    >
                        <Ionicons name="chatbubble-outline" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <NotionButton
                        title="Booking Request"
                        onPress={() => console.log('Book Pressed')}
                        style={styles.bookButton}
                    />
                </View>
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    topNav: {
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.s,
    },
    content: {
        padding: SPACING.m,
        paddingBottom: 120,
    },
    header: {
        marginBottom: SPACING.l,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    verifiedBadge: {
        marginLeft: SPACING.s,
        marginTop: 4,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.s,
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.border,
        marginHorizontal: SPACING.s,
    },
    section: {
        marginBottom: SPACING.xl,
    },
    text: {
        color: COLORS.secondary,
        lineHeight: 22,
    },
    priceCard: {
        padding: SPACING.m,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 4,
    },
    portfolioScroll: {
        marginLeft: -SPACING.m,
        paddingLeft: SPACING.m,
        marginTop: SPACING.s,
    },
    portfolioItem: {
        width: 180,
        height: 135,
        marginRight: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    placeholderImage: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.surface,
        padding: SPACING.m,
        paddingBottom: SPACING.xl,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        ...SHADOWS.medium,
    },
    footerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    messageButton: {
        width: 48,
        height: 48,
        borderRadius: BORDER_RADIUS.m,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    bookButton: {
        flex: 1,
    }
});

export default ServiceDetailScreen;
