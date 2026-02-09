import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionButton from '../../components/NotionButton';
import NotionCard from '../../components/NotionCard';
import ImagePickerButton from '../../components/ImagePickerButton';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { userService } from '../../services/userService';

const EditProfileScreen = ({ navigation }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [location, setLocation] = useState('');
    const [avatar, setAvatar] = useState(null);
    const [coverImage, setCoverImage] = useState(null);
    const [selectedInterests, setSelectedInterests] = useState([]);
    const [userType, setUserType] = useState('individual');
    const [category, setCategory] = useState('');
    const [price, setPrice] = useState('');
    const [pricingType, setPricingType] = useState('fixed'); // 'fixed' or 'inquiry'
    const [experience, setExperience] = useState('');

    const isProvider = userType === 'provider';
    const isBusiness = userType === 'business';

    const providerCategories = ['DJ', 'Photo', 'Security', 'Barman', 'Decor'];
    const businessCategories = ['Bar', 'Club', 'Cafe', 'Lounge'];

    const allInterests = [
        'Music', 'Nightlife', 'Networking', 'Art', 'Food',
        'Sports', 'Tech', 'Photography', 'Travel', 'Gaming',
        'Fitness', 'Movies', 'Books', 'Fashion', 'Cooking'
    ];

    useEffect(() => {
        const loadInitialData = async () => {
            const userData = await userService.getUser();
            if (userData) {
                setName(userData.name || '');
                setUsername(userData.username?.replace('@', '') || '');
                setBio(userData.bio || '');
                setLocation(userData.location || '');
                setAvatar(userData.avatar || 'https://i.pravatar.cc/150?img=20');
                setCoverImage(userData.coverImage || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800');
                setSelectedInterests(userData.interests || []);
                setUserType(userData.userType || 'individual');
                setCategory(userData.category || '');
                setPrice(userData.stats?.price || '');
                setPricingType(userData.stats?.pricingType || 'fixed');
                setExperience(userData.stats?.experience || '');
            } else {
                // Set some defaults if no user data exists yet
                setName('Alex Johnson');
                setUsername('alexj');
                setBio('Event enthusiast | Music lover | Always down for good vibes 🎉');
                setLocation('San Francisco, CA');
                setAvatar('https://i.pravatar.cc/150?img=20');
                setCoverImage('https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800');
                setSelectedInterests(['Music', 'Nightlife', 'Networking', 'Art', 'Food']);
            }
            setLoading(false);
        };
        loadInitialData();
    }, []);

    const toggleInterest = (interest) => {
        if (selectedInterests.includes(interest)) {
            setSelectedInterests(selectedInterests.filter(i => i !== interest));
        } else {
            if (selectedInterests.length < 8) {
                setSelectedInterests([...selectedInterests, interest]);
            } else {
                Alert.alert('Limit Reached', 'You can select up to 8 interests');
            }
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Please enter your name');
            return;
        }

        setSaving(true);
        const userData = await userService.getUser();
        const updatedData = {
            ...userData,
            name,
            username: `@${username.toLowerCase().trim()}`,
            bio,
            location,
            avatar,
            coverImage,
            interests: selectedInterests,
            userType,
            category,
            stats: {
                ...(userData?.stats || {}),
                pricingType: isProvider ? pricingType : userData?.stats?.pricingType,
                price: isProvider ? price : userData?.stats?.price,
                experience: isProvider ? experience : userData?.stats?.experience,
            }
        };

        const success = await userService.saveUser(updatedData);
        setSaving(false);

        if (success) {
            Alert.alert('Success!', 'Profile updated successfully', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } else {
            Alert.alert('Error', 'Failed to save profile changes. Please try again.');
        }
    };

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={[styles.content, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            </ScreenWrapper>
        );
    }

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
                <Typography variant="h2">Edit Profile</Typography>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Cover Image */}
                <View style={styles.section}>
                    <ImagePickerButton
                        currentImage={coverImage}
                        onImageSelected={setCoverImage}
                        aspectRatio={[16, 9]}
                        label="Cover Photo"
                    />
                </View>

                {/* Avatar */}
                <View style={styles.section}>
                    <View style={styles.avatarSection}>
                        <ImagePickerButton
                            currentImage={avatar}
                            onImageSelected={setAvatar}
                            aspectRatio={[1, 1]}
                            label="Profile Picture"
                        />
                    </View>
                </View>

                {/* Name */}
                <View style={styles.section}>
                    <Typography variant="body" style={styles.label}>
                        Full Name
                    </Typography>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Enter your name"
                        placeholderTextColor={COLORS.secondary}
                    />
                </View>

                {/* Username */}
                <View style={styles.section}>
                    <Typography variant="body" style={styles.label}>
                        Username
                    </Typography>
                    <View style={styles.usernameContainer}>
                        <Typography variant="body" style={{ color: COLORS.secondary }}>
                            @
                        </Typography>
                        <TextInput
                            style={[styles.input, styles.usernameInput]}
                            value={username}
                            onChangeText={setUsername}
                            placeholder="username"
                            placeholderTextColor={COLORS.secondary}
                            autoCapitalize="none"
                        />
                    </View>
                </View>

                {/* Bio */}
                <View style={styles.section}>
                    <Typography variant="body" style={styles.label}>
                        Bio
                    </Typography>
                    <TextInput
                        style={[styles.input, styles.bioInput]}
                        value={bio}
                        onChangeText={setBio}
                        placeholder="Tell us about yourself"
                        placeholderTextColor={COLORS.secondary}
                        multiline
                        maxLength={150}
                    />
                    <Typography variant="caption" style={styles.charCount}>
                        {bio.length}/150
                    </Typography>
                </View>

                {/* Location */}
                <View style={styles.section}>
                    <Typography variant="body" style={styles.label}>
                        Location
                    </Typography>
                    <View style={styles.locationInput}>
                        <Ionicons name="location-outline" size={20} color={COLORS.accent} />
                        <TextInput
                            style={[styles.input, { flex: 1, marginLeft: SPACING.s }]}
                            value={location}
                            onChangeText={setLocation}
                            placeholder="City, State"
                            placeholderTextColor={COLORS.secondary}
                        />
                    </View>
                </View>

                {/* Professional Fields */}
                {(isBusiness || isProvider) && (
                    <View style={styles.section}>
                        <Typography variant="body" style={styles.label}>
                            {isBusiness ? "Venue Category" : "Service Category"}
                        </Typography>
                        <View style={styles.interestsContainer}>
                            {(isBusiness ? businessCategories : providerCategories).map((cat) => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[
                                        styles.interestTag,
                                        category === cat && styles.interestTagSelected
                                    ]}
                                    onPress={() => setCategory(cat)}
                                >
                                    <Typography
                                        variant="small"
                                        style={[
                                            styles.interestText,
                                            category === cat && styles.interestTextSelected
                                        ]}
                                    >
                                        {cat}
                                    </Typography>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {isProvider && (
                    <>
                        <View style={styles.section}>
                            <Typography variant="body" style={styles.label}>
                                Pricing Model
                            </Typography>
                            <View style={styles.interestsContainer}>
                                <TouchableOpacity
                                    style={[
                                        styles.interestTag,
                                        pricingType === 'fixed' && styles.interestTagSelected
                                    ]}
                                    onPress={() => setPricingType('fixed')}
                                >
                                    <Typography
                                        variant="small"
                                        style={[
                                            styles.interestText,
                                            pricingType === 'fixed' && styles.interestTextSelected
                                        ]}
                                    >
                                        Fixed Price
                                    </Typography>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.interestTag,
                                        pricingType === 'inquiry' && styles.interestTagSelected
                                    ]}
                                    onPress={() => setPricingType('inquiry')}
                                >
                                    <Typography
                                        variant="small"
                                        style={[
                                            styles.interestText,
                                            pricingType === 'inquiry' && styles.interestTextSelected
                                        ]}
                                    >
                                        Inquire for Price
                                    </Typography>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {pricingType === 'fixed' && (
                            <View style={styles.section}>
                                <Typography variant="body" style={styles.label}>
                                    Starting Price (per hour/event)
                                </Typography>
                                <TextInput
                                    style={styles.input}
                                    value={price}
                                    onChangeText={setPrice}
                                    placeholder="$150/hr"
                                    placeholderTextColor={COLORS.secondary}
                                />
                            </View>
                        )}
                        <View style={styles.section}>
                            <Typography variant="body" style={styles.label}>
                                Years of Experience
                            </Typography>
                            <TextInput
                                style={styles.input}
                                value={experience}
                                onChangeText={setExperience}
                                placeholder="5 years"
                                placeholderTextColor={COLORS.secondary}
                            />
                        </View>
                    </>
                )}

                {/* Interests / Specialties */}
                <View style={styles.section}>
                    <Typography variant="body" style={styles.label}>
                        {isProvider ? "Professional Specialties" : "Interests"} ({selectedInterests.length}/8)
                    </Typography>
                    <Typography variant="caption" style={styles.subtitle}>
                        {isProvider ? "Select your top skills and services to stand out" : "Select up to 8 interests to help others connect with you"}
                    </Typography>
                    <View style={styles.interestsContainer}>
                        {allInterests.map((interest) => (
                            <TouchableOpacity
                                key={interest}
                                style={[
                                    styles.interestTag,
                                    selectedInterests.includes(interest) && styles.interestTagSelected
                                ]}
                                onPress={() => toggleInterest(interest)}
                            >
                                <Typography
                                    variant="small"
                                    style={[
                                        styles.interestText,
                                        selectedInterests.includes(interest) && styles.interestTextSelected
                                    ]}
                                >
                                    {interest}
                                </Typography>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Save Button */}
            <View style={styles.saveButtonContainer}>
                <NotionButton
                    title={saving ? "Saving..." : "Save Changes"}
                    onPress={handleSave}
                    disabled={saving}
                />
            </View>
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
    section: {
        marginBottom: SPACING.l,
    },
    label: {
        fontWeight: '600',
        marginBottom: SPACING.s,
    },
    subtitle: {
        color: COLORS.secondary,
        marginBottom: SPACING.m,
    },
    avatarContainer: {
        alignSelf: 'center',
        position: 'relative',
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    avatarEditButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: COLORS.background,
    },
    input: {
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.m,
        padding: SPACING.m,
        color: COLORS.primary,
        fontSize: 16,
    },
    usernameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.m,
        paddingLeft: SPACING.m,
    },
    usernameInput: {
        borderWidth: 0,
        backgroundColor: 'transparent',
    },
    bioInput: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    charCount: {
        textAlign: 'right',
        color: COLORS.secondary,
        marginTop: SPACING.xs,
    },
    locationInput: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.m,
        paddingLeft: SPACING.m,
    },
    interestsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.s,
    },
    interestTag: {
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.s,
        borderRadius: BORDER_RADIUS.m,
    },
    interestTagSelected: {
        backgroundColor: COLORS.accent + '20',
        borderColor: COLORS.accent,
    },
    interestText: {
        color: COLORS.secondary,
    },
    interestTextSelected: {
        color: COLORS.accent,
        fontWeight: '600',
    },
    saveButtonContainer: {
        position: 'absolute',
        bottom: 20,
        left: SPACING.m,
        right: SPACING.m,
    },
});

export default EditProfileScreen;
