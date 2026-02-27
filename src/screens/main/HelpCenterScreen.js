import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, Linking } from 'react-native';
import { showAlert } from '../../utils/showAlert';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import AntigravityButton from '../../components/AntigravityButton';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const HelpCenterScreen = ({ navigation }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);

    const categories = [
        {
            id: 'account',
            icon: 'person-outline',
            title: 'Account & Profile',
            articles: [
                {
                    id: 1,
                    title: 'How to edit my profile',
                    content: 'Go to your Profile tab, then tap the gear icon to open Settings. Select "Edit Profile" to update your name, bio, avatar, and other information.'
                },
                {
                    id: 2,
                    title: 'How to verify my account',
                    content: 'Navigate to Settings > Verification. You can verify your identity through Aadhaar verification using DigiLocker or through the OTP-based verification method. Verified accounts get a verification badge on their profile.'
                },
                {
                    id: 3,
                    title: 'How to delete my account',
                    content: 'Go to Settings and scroll to the bottom. Tap "Delete Account". Please note that this action is permanent and all your data including event history, tickets, and messages will be removed.'
                },
                {
                    id: 4,
                    title: 'How to change my password',
                    content: 'Currently, you can reset your password from the login screen by tapping "Forgot Password?" and entering your registered email address. A password reset link will be sent to your email.'
                },
            ]
        },
        {
            id: 'events',
            icon: 'calendar-outline',
            title: 'Events & Tickets',
            articles: [
                {
                    id: 5,
                    title: 'How to discover events near me',
                    content: 'Open the Home tab to see events near your location. You can also use the Map view to browse events geographically. Make sure Location Services are enabled in Settings for the best experience.'
                },
                {
                    id: 6,
                    title: 'How to create an event',
                    content: 'Tap the "+" button on the Home screen. Fill in event details including title, description, date, time, location, and ticket pricing. You can add images and set the event capacity. Your event will be live once published.'
                },
                {
                    id: 7,
                    title: 'How to buy tickets',
                    content: 'Open any event and tap "Buy Ticket" or "Book Now". Select your ticket type and quantity, then proceed to payment. You\'ll receive a digital ticket with a QR code that can be scanned at the venue.'
                },
                {
                    id: 8,
                    title: 'Where are my tickets?',
                    content: 'All your purchased tickets are available in the Tickets tab at the bottom of the app. Tap any ticket to view its QR code and event details.'
                },
                {
                    id: 9,
                    title: 'How to manage my events',
                    content: 'If you\'re an event organizer, go to your Profile and access the Business Dashboard. From there you can manage your events, view ticket sales, scan tickets at the door, and check event statistics.'
                },
            ]
        },
        {
            id: 'marketplace',
            icon: 'storefront-outline',
            title: 'Marketplace & Services',
            articles: [
                {
                    id: 10,
                    title: 'How to find service providers',
                    content: 'Go to the Search tab to browse the Marketplace. You can search for DJs, photographers, caterers, venues, and other event service providers. Filter by category and sort by distance to find providers near you.'
                },
                {
                    id: 11,
                    title: 'How to list my services',
                    content: 'Register as a Service Provider during signup or update your profile type in Edit Profile. Once registered, you can add your services, set pricing, upload portfolio images, and manage inquiries from potential clients.'
                },
                {
                    id: 12,
                    title: 'How to contact a service provider',
                    content: 'Open a provider\'s profile and use the "Message" or "Inquire" button to start a conversation. For providers with fixed pricing, you can book directly. For inquiry-based pricing, discuss your requirements through chat.'
                },
            ]
        },
        {
            id: 'buddies',
            icon: 'people-outline',
            title: 'Event Buddies',
            articles: [
                {
                    id: 13,
                    title: 'What are Event Buddies?',
                    content: 'Event Buddies is a feature that helps you find companions to attend events together. You can create or join buddy groups for any event. Once you join a group, a group chat is automatically created so you can coordinate plans.'
                },
                {
                    id: 14,
                    title: 'How to create a buddy request',
                    content: 'Open an event, then tap "Find Event Buddies". Tap "Create Buddy Request" and set the group size and add a description about what kind of group you\'re looking for. Others can then join your group.'
                },
                {
                    id: 15,
                    title: 'How to join a buddy group',
                    content: 'Browse buddy requests on any event page. Tap "Join Group" on a request that interests you. Once joined, you\'ll be added to the group chat automatically. You can leave a group at any time.'
                },
            ]
        },
        {
            id: 'payments',
            icon: 'card-outline',
            title: 'Payments & Refunds',
            articles: [
                {
                    id: 16,
                    title: 'What payment methods are supported?',
                    content: 'Croww uses Cashfree as our payment gateway. You can pay using UPI, credit/debit cards, net banking, and popular wallets. All payments are processed securely through certified payment processors.'
                },
                {
                    id: 17,
                    title: 'How do refunds work?',
                    content: 'Refund eligibility depends on the event organizer\'s policy. Generally, refunds are available for cancelled or rescheduled events. To request a refund, contact us at info@pixwik.com with your booking details. Approved refunds are processed within 5-15 business days.'
                },
                {
                    id: 18,
                    title: 'I was charged but didn\'t receive my ticket',
                    content: 'If your payment was debited but you didn\'t receive a ticket, wait a few minutes and check the Tickets tab. If the ticket still doesn\'t appear, contact our support at info@pixwik.com with your transaction details.'
                },
            ]
        },
        {
            id: 'safety',
            icon: 'shield-outline',
            title: 'Privacy & Safety',
            articles: [
                {
                    id: 19,
                    title: 'How to block someone',
                    content: 'Go to the user\'s profile, tap the menu icon, and select "Block". Blocked users cannot see your profile, send you messages, or invite you to events. You can manage blocked users in Settings > Blocked Users.'
                },
                {
                    id: 20,
                    title: 'How to report inappropriate content',
                    content: 'If you encounter inappropriate content or behaviour, you can report it by contacting our support team at info@pixwik.com. Please include screenshots and details of the incident. We review all reports promptly.'
                },
                {
                    id: 21,
                    title: 'Safety tips for attending events',
                    content: 'When meeting people through Croww:\n\n• Always meet in public, well-lit places\n• Let a friend or family member know where you\'re going\n• Keep your phone charged\n• Trust your instincts — leave if you feel uncomfortable\n• Use the in-app chat to communicate before meeting\n• Don\'t share personal financial information with strangers'
                },
            ]
        },
    ];

    const handleCategoryPress = (category) => {
        setSelectedCategory(selectedCategory?.id === category.id ? null : category);
    };

    const handleContactSupport = () => {
        showAlert(
            'Contact Support',
            'Choose how you\'d like to reach us:',
            [
                {
                    text: 'Email Us',
                    onPress: () => {
                        Linking.openURL('mailto:info@pixwik.com?subject=Croww App Support').catch(() => {
                            showAlert('Email', 'Send your query to: info@pixwik.com');
                        });
                    }
                },
                { text: 'Cancel', style: 'cancel' }
            ]
        );
    };

    // Filter articles based on search
    const filteredCategories = searchQuery.length >= 2
        ? categories.map(cat => ({
            ...cat,
            articles: cat.articles.filter(
                article =>
                    article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    article.content.toLowerCase().includes(searchQuery.toLowerCase())
            )
        })).filter(cat => cat.articles.length > 0)
        : categories;

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2">Help Center</Typography>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Search */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search-outline" size={20} color={COLORS.secondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search for help..."
                        placeholderTextColor={COLORS.secondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={20} color={COLORS.secondary} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Categories */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>
                        {searchQuery.length >= 2 ? `Results for "${searchQuery}"` : 'Browse by Category'}
                    </Typography>

                    {filteredCategories.length === 0 && (
                        <View style={styles.emptyState}>
                            <Ionicons name="search-outline" size={48} color={COLORS.secondary} />
                            <Typography variant="body" style={{ color: COLORS.secondary, marginTop: SPACING.m, textAlign: 'center' }}>
                                No results found. Try a different search or contact our support team.
                            </Typography>
                        </View>
                    )}

                    {filteredCategories.map((category) => (
                        <View key={category.id}>
                            <TouchableOpacity
                                onPress={() => handleCategoryPress(category)}
                            >
                                <NotionCard style={styles.categoryCard}>
                                    <View style={styles.categoryHeader}>
                                        <View style={styles.categoryLeft}>
                                            <View style={styles.iconContainer}>
                                                <Ionicons name={category.icon} size={22} color={COLORS.accent} />
                                            </View>
                                            <View>
                                                <Typography variant="body" style={{ fontWeight: '600' }}>
                                                    {category.title}
                                                </Typography>
                                                <Typography variant="caption" style={{ color: COLORS.secondary }}>
                                                    {category.articles.length} {category.articles.length === 1 ? 'article' : 'articles'}
                                                </Typography>
                                            </View>
                                        </View>
                                        <Ionicons
                                            name={selectedCategory?.id === category.id ? 'chevron-up' : 'chevron-down'}
                                            size={20}
                                            color={COLORS.secondary}
                                        />
                                    </View>
                                </NotionCard>
                            </TouchableOpacity>

                            {/* Articles */}
                            {selectedCategory?.id === category.id && (
                                <View style={styles.articlesContainer}>
                                    {category.articles.map((article) => (
                                        <TouchableOpacity
                                            key={article.id}
                                            style={styles.articleItem}
                                            onPress={() => showAlert(article.title, article.content)}
                                        >
                                            <View style={styles.articleDot} />
                                            <Typography variant="body" style={styles.articleTitle}>
                                                {article.title}
                                            </Typography>
                                            <Ionicons name="chevron-forward" size={16} color={COLORS.secondary} />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    ))}
                </View>

                {/* Contact Support */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>
                        Still Need Help?
                    </Typography>
                    <AntigravityButton
                        title="Contact Support"
                        icon="chatbubble-ellipses-outline"
                        onPress={handleContactSupport}
                    />
                    <View style={styles.contactInfo}>
                        <View style={styles.contactRow}>
                            <Ionicons name="mail-outline" size={16} color={COLORS.secondary} />
                            <Typography variant="caption" style={{ color: COLORS.secondary, marginLeft: SPACING.xs }}>
                                info@pixwik.com
                            </Typography>
                        </View>
                        <Typography variant="caption" style={{ color: COLORS.secondary, marginTop: SPACING.xs }}>
                            Pixwik Technologies Private Limited
                        </Typography>
                    </View>
                </View>

                {/* Quick Links */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>
                        Quick Links
                    </Typography>
                    <NotionCard style={styles.quickLinksCard}>
                        <TouchableOpacity
                            style={styles.quickLink}
                            onPress={() => navigation.navigate('LegalPolicy', { type: 'terms' })}
                        >
                            <Ionicons name="document-text-outline" size={20} color={COLORS.accent} />
                            <Typography variant="body" style={{ marginLeft: SPACING.s, flex: 1 }}>
                                Terms of Service
                            </Typography>
                            <Ionicons name="chevron-forward" size={16} color={COLORS.secondary} />
                        </TouchableOpacity>
                        <View style={styles.divider} />
                        <TouchableOpacity
                            style={styles.quickLink}
                            onPress={() => navigation.navigate('LegalPolicy', { type: 'privacy' })}
                        >
                            <Ionicons name="shield-outline" size={20} color={COLORS.accent} />
                            <Typography variant="body" style={{ marginLeft: SPACING.s, flex: 1 }}>
                                Privacy Policy
                            </Typography>
                            <Ionicons name="chevron-forward" size={16} color={COLORS.secondary} />
                        </TouchableOpacity>
                        <View style={styles.divider} />
                        <TouchableOpacity
                            style={styles.quickLink}
                            onPress={() => navigation.navigate('LegalPolicy', { type: 'security' })}
                        >
                            <Ionicons name="lock-closed-outline" size={20} color={COLORS.accent} />
                            <Typography variant="body" style={{ marginLeft: SPACING.s, flex: 1 }}>
                                Security Policy
                            </Typography>
                            <Ionicons name="chevron-forward" size={16} color={COLORS.secondary} />
                        </TouchableOpacity>
                        <View style={styles.divider} />
                        <TouchableOpacity
                            style={styles.quickLink}
                            onPress={() => navigation.navigate('LegalPolicy', { type: 'refund' })}
                        >
                            <Ionicons name="card-outline" size={20} color={COLORS.accent} />
                            <Typography variant="body" style={{ marginLeft: SPACING.s, flex: 1 }}>
                                Refund Policy
                            </Typography>
                            <Ionicons name="chevron-forward" size={16} color={COLORS.secondary} />
                        </TouchableOpacity>
                    </NotionCard>
                </View>

                <View style={{ height: 100 }} />
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
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backButton: {
        padding: 4,
    },
    content: {
        padding: SPACING.m,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.m,
        paddingHorizontal: SPACING.m,
        marginBottom: SPACING.l,
    },
    searchInput: {
        flex: 1,
        padding: SPACING.m,
        color: COLORS.primary,
        fontSize: 16,
    },
    section: {
        marginBottom: SPACING.l,
    },
    sectionTitle: {
        marginBottom: SPACING.m,
    },
    categoryCard: {
        padding: SPACING.m,
        marginBottom: SPACING.s,
    },
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    categoryLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.accent + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
    },
    articlesContainer: {
        marginLeft: SPACING.m,
        marginBottom: SPACING.m,
    },
    articleItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.s,
        paddingHorizontal: SPACING.m,
    },
    articleDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.accent,
        marginRight: SPACING.s,
    },
    articleTitle: {
        flex: 1,
        color: COLORS.secondary,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: SPACING.xxl,
    },
    contactInfo: {
        marginTop: SPACING.m,
        alignItems: 'center',
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    quickLinksCard: {
        padding: 0,
        overflow: 'hidden',
    },
    quickLink: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
    },
});

export default HelpCenterScreen;
