import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import NotionButton from '../../components/NotionButton';
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
                { id: 1, title: 'How to edit my profile', content: 'Go to Profile > Edit Profile to update your information.' },
                { id: 2, title: 'How to verify my account', content: 'Navigate to Settings > Verification to start the verification process.' },
                { id: 3, title: 'How to delete my account', content: 'Go to Settings > Delete Account. This action is permanent.' },
            ]
        },
        {
            id: 'events',
            icon: 'calendar-outline',
            title: 'Events & Tickets',
            articles: [
                { id: 4, title: 'How to create an event', content: 'Tap the + button on the Map screen and fill in event details.' },
                { id: 5, title: 'How to RSVP to events', content: 'Open any event and tap "I\'m Going" to RSVP.' },
                { id: 6, title: 'How to invite friends', content: 'Open an event and tap "Invite Friends" to share via your device.' },
            ]
        },
        {
            id: 'buddies',
            icon: 'people-outline',
            title: 'Event Buddies',
            articles: [
                { id: 7, title: 'What are Event Buddies?', content: 'Event Buddies help you find companions to attend events together.' },
                { id: 8, title: 'How to create a buddy request', content: 'Open an event > Find Event Buddies > Create Buddy Request.' },
                { id: 9, title: 'How to join a buddy group', content: 'Browse buddy requests and tap "Join Group" on any available request.' },
            ]
        },
        {
            id: 'privacy',
            icon: 'shield-outline',
            title: 'Privacy & Safety',
            articles: [
                { id: 10, title: 'How to block someone', content: 'Go to their profile and tap Block. They won\'t be able to see your profile.' },
                { id: 11, title: 'Privacy settings', content: 'Manage who can see your profile in Settings > Privacy.' },
                { id: 12, title: 'Safety tips for meeting buddies', content: 'Always meet in public places and let someone know where you\'re going.' },
            ]
        },
    ];

    const handleCategoryPress = (category) => {
        setSelectedCategory(selectedCategory?.id === category.id ? null : category);
    };

    const handleContactSupport = () => {
        Alert.alert(
            'Contact Support',
            'Choose how you\'d like to contact us:',
            [
                { text: 'Email', onPress: () => Alert.alert('Email', 'support@croww.app') },
                { text: 'Chat', onPress: () => Alert.alert('Chat', 'Live chat coming soon!') },
                { text: 'Cancel', style: 'cancel' }
            ]
        );
    };

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
                </View>

                {/* Categories */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>
                        Browse by Category
                    </Typography>
                    {categories.map((category) => (
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
                                            <Typography variant="body" style={{ fontWeight: '600' }}>
                                                {category.title}
                                            </Typography>
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
                                            onPress={() => Alert.alert(article.title, article.content)}
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
                    <NotionButton
                        title="Contact Support"
                        icon="chatbubble-ellipses-outline"
                        onPress={handleContactSupport}
                    />
                </View>

                {/* Quick Links */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>
                        Quick Links
                    </Typography>
                    <NotionCard style={styles.quickLinksCard}>
                        <TouchableOpacity style={styles.quickLink}>
                            <Ionicons name="document-text-outline" size={20} color={COLORS.accent} />
                            <Typography variant="body" style={{ marginLeft: SPACING.s }}>
                                Terms of Service
                            </Typography>
                        </TouchableOpacity>
                        <View style={styles.divider} />
                        <TouchableOpacity style={styles.quickLink}>
                            <Ionicons name="shield-outline" size={20} color={COLORS.accent} />
                            <Typography variant="body" style={{ marginLeft: SPACING.s }}>
                                Privacy Policy
                            </Typography>
                        </TouchableOpacity>
                        <View style={styles.divider} />
                        <TouchableOpacity style={styles.quickLink}>
                            <Ionicons name="flag-outline" size={20} color={COLORS.accent} />
                            <Typography variant="body" style={{ marginLeft: SPACING.s }}>
                                Community Guidelines
                            </Typography>
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
