import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AntigravityButton from '../../components/AntigravityButton';
import NotionCard from '../../components/NotionCard';
import ImagePickerButton from '../../components/ImagePickerButton';
import GooglePlacesInput from '../../components/GooglePlacesInput';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { userService } from '../../services/userService';
import { uploadService } from '../../services/uploadService';
import { auth } from '../../services/firebaseConfig';
import { SERVICE_CATEGORIES } from '../../constants/services';
import { showAlert } from '../../utils/showAlert';
import PhoneInput from '../../components/PhoneInput';
import { getCountryByCallingCode, COUNTRY_CODES } from '../../constants/countryCodes';

const EditProfileScreen = ({ navigation }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [location, setLocation] = useState('');
    const [coordinates, setCoordinates] = useState(null);
    const [avatar, setAvatar] = useState(null);
    const [photoURL, setPhotoURL] = useState(null); // Added for compatibility
    const [coverImage, setCoverImage] = useState(null);
    const [selectedInterests, setSelectedInterests] = useState([]);
    const [userType, setUserType] = useState('individual');
    const [category, setCategory] = useState('');
    const [price, setPrice] = useState('');
    const [pricingType, setPricingType] = useState('fixed'); // 'fixed' or 'inquiry'
    const [experience, setExperience] = useState('');
    const [profilePhotos, setProfilePhotos] = useState([]); // Array of photo URLs or local URIs

    // Social Links
    const [instagram, setInstagram] = useState('');
    const [soundcloud, setSoundcloud] = useState('');
    const [behance, setBehance] = useState('');
    const [googleDrive, setGoogleDrive] = useState('');
    const [youtube, setYoutube] = useState('');

    const isProvider = userType === 'provider';
    const isBusiness = userType === 'business';

    const providerCategories = SERVICE_CATEGORIES.filter(c => c.type === 'provider').map(c => c.name);
    const businessCategories = SERVICE_CATEGORIES.filter(c => c.type === 'business').map(c => c.name);

    // Dynamic Portfolio Rules
    const showSoundcloud = category === 'Music/DJ';
    const showBehance = ['Photography', 'Makeup', 'Decor', 'Mehendi'].includes(category);
    const showYoutube = ['Music/DJ', 'Planning'].includes(category) || isBusiness;
    const showGoogleDrive = true;
    const showInstagram = true;

    const allInterests = [
        'Music', 'Nightlife', 'Networking', 'Art', 'Food',
        'Sports', 'Tech', 'Photography', 'Travel', 'Gaming',
        'Fitness', 'Movies', 'Books', 'Fashion', 'Cooking'
    ];

    const INDIAN_CITIES = [
        'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad',
        'Chennai', 'Kolkata', 'Surat', 'Pune', 'Jaipur',
        'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane',
        'Bhopal', 'Visakhapatnam', 'Pimpri-Chinchwad', 'Patna', 'Vadodara',
        'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad',
        'Meerut', 'Rajkot', 'Kalyan-Dombivli', 'Vasai-Virar', 'Varanasi',
        'Srinagar', 'Aurangabad', 'Dhanbad', 'Amritsar', 'Navi Mumbai',
        'Allahabad', 'Ranchi', 'Howrah', 'Coimbatore', 'Jabalpur',
        'Gwalior', 'Vijayawada', 'Jodhpur', 'Madurai', 'Raipur',
        'Kota', 'Guwahati', 'Chandigarh', 'Solapur', 'Hubli-Dharwad'
    ];

    useEffect(() => {
        const loadInitialData = async () => {
            const userData = await userService.getUser();
            if (userData) {
                setName(userData.name || '');
                setUsername(userData.username?.replace('@', '') || '');
                setBio(userData.bio || '');
                setPhone(userData.phone || '');
                setAddress(userData.address || '');
                setLocation(userData.location || '');
                setCoordinates(userData.coordinates || null);

                // Prioritize user-set photo, otherwise null
                const currentAvatar = userData.photoURL || userData.avatar || null;
                setAvatar(currentAvatar);
                setPhotoURL(currentAvatar);

                setCoverImage(userData.coverImage || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800');
                setSelectedInterests(userData.interests || []);
                setUserType(userData.userType || 'individual');
                setCategory(userData.category || '');
                setPrice(userData.stats?.price || '');
                setPricingType(userData.stats?.pricingType || 'fixed');
                setExperience(userData.stats?.experience || '');
                setProfilePhotos(userData.profilePhotos || []);

                // Load Social Links
                setInstagram(userData.socialLinks?.instagram || '');
                setSoundcloud(userData.socialLinks?.soundcloud || '');
                setBehance(userData.socialLinks?.behance || '');
                setGoogleDrive(userData.socialLinks?.googleDrive || '');
                setYoutube(userData.socialLinks?.youtube || '');
            } else {
                // Set some defaults if no user data exists yet
                setName('Alex Johnson');
                setUsername('alexj');
                setBio('Event enthusiast | Music lover | Always down for good vibes 🎉');
                setLocation('San Francisco, CA');
                setAvatar(null);
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
                showAlert('Limit Reached', 'You can select up to 8 interests');
            }
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Please enter your name');
            return;
        }

        if (phone) {
            // Find country by calling code
            const country = COUNTRY_CODES.find(c => phone.startsWith(c.callingCode));
            if (country) {
                const numberOnly = phone.replace(country.callingCode, '');
                if (numberOnly.length !== country.length) {
                    Alert.alert('Error', `Phone number for ${country.name} must be ${country.length} digits`);
                    return;
                }
            } else if (phone.length < 8) {
                Alert.alert('Error', 'Please enter a valid phone number');
                return;
            }
        }

        setSaving(true);
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("No authenticated user found");

            let finalAvatar = avatar;
            let finalCover = coverImage;

            // Use Google Places coordinates if available, otherwise keep existing or null
            // If user typed manually (which GooglePlacesInput might allow if implementation permits text edit without selection - 
            // wait, GooglePlacesInput typically enforces selection for coords. 
            // If location is set but coordinates are null, it might be legacy or manual.
            // We'll save what we have.

            // 1. Upload Avatar if it's a local URI
            if (avatar && !avatar.startsWith('http')) {
                const avatarPath = `profile_pictures/${user.uid}/profile_${Date.now()}.jpg`;
                finalAvatar = await uploadService.uploadImage(avatar, avatarPath);
            }

            // 2. Upload Cover Image if it's a local URI
            if (coverImage && !coverImage.startsWith('http')) {
                const coverPath = `profile_covers/${user.uid}/cover_${Date.now()}.jpg`;
                finalCover = await uploadService.uploadImage(coverImage, coverPath);
            }

            // 3. Upload Business Profile Photos
            // 3. Upload Business Profile Photos
            const uploadPromises = profilePhotos.map(async (photo, index) => {
                if (!photo) return null;
                if (!photo.startsWith('http')) {
                    try {
                        const photoPath = `portfolio_photos/${user.uid}/photo_${Date.now()}_${index}.jpg`;
                        return await uploadService.uploadImage(photo, photoPath);
                    } catch (uploadError) {
                        console.error(`Failed to upload photo at index ${index}:`, uploadError);
                        return null; // Skip this photo if upload fails
                    }
                }
                return photo; // Already a remote URL
            });

            const uploadedPhotos = await Promise.all(uploadPromises);
            const finalProfilePhotos = uploadedPhotos.filter(p => p !== null);

            if (finalProfilePhotos.length < profilePhotos.length) {
                // If some photos were empty or failed, we just filter them out anyway
                console.log("Some photos were skipped during upload or were empty");
            }

            const userData = (await userService.getUser()) || {};
            const updatedData = {
                ...userData,
                id: user.uid,
                name: name.trim(),
                username: username ? `@${username.toLowerCase().trim()}` : (userData.username || ''),
                bio: bio || '',
                phone: phone || '',
                address: address || '',
                location: location || '',
                coordinates: coordinates || null,
                avatar: finalAvatar || null,
                photoURL: finalAvatar || null,
                coverImage: finalCover || null,
                interests: selectedInterests || [],
                userType: userType || 'individual',
                isProvider: userType === 'provider',
                isBusiness: userType === 'business',
                category: category || '',
                profilePhotos: finalProfilePhotos,
                socialLinks: {
                    instagram: (instagram || '').trim(),
                    soundcloud: (soundcloud || '').trim(),
                    behance: (behance || '').trim(),
                    googleDrive: (googleDrive || '').trim(),
                    youtube: (youtube || '').trim()
                },
                stats: {
                    ...(userData.stats || {}),
                    pricingType: (isProvider || isBusiness) ? pricingType : (userData.stats?.pricingType || 'fixed'),
                    price: (isProvider || isBusiness) ? price : (userData.stats?.price || ''),
                    experience: (isProvider || isBusiness) ? experience : (userData.stats?.experience || ''),
                }
            };

            const success = await userService.saveUser(updatedData);

            if (success) {
                showAlert('Success!', 'Profile updated successfully', [
                    { text: 'OK', onPress: () => navigation.goBack() }
                ]);
            } else {
                throw new Error("Failed to save user data");
            }
        } catch (error) {
            console.error("Error in handleSave:", error);
            showAlert('Error', 'Failed to save profile changes. Please try again.');
        } finally {
            setSaving(false);
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
                            placeholderIcon={isBusiness ? "business-outline" : "person-outline"}
                        />
                    </View>
                </View>

                {/* Business Profile Photos */}
                {(isBusiness || isProvider) && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Typography variant="body" style={styles.label}>
                                Portfolio Photos ({profilePhotos.length}/10)
                            </Typography>
                            <Typography variant="caption" style={{ color: COLORS.secondary }}>
                                Max 10 photos
                            </Typography>
                        </View>
                        <Typography variant="caption" style={styles.subtitle}>
                            Showcase your best work, venues, or previous events.
                        </Typography>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
                            {profilePhotos.map((photo, index) => (
                                <View key={index} style={styles.photoItemContainer}>
                                    <Image source={{ uri: photo }} style={styles.photoItem} />
                                    <TouchableOpacity
                                        style={styles.removePhotoButton}
                                        onPress={() => {
                                            const newPhotos = [...profilePhotos];
                                            newPhotos.splice(index, 1);
                                            setProfilePhotos(newPhotos);
                                        }}
                                    >
                                        <Ionicons name="close" size={14} color="#FFF" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {profilePhotos.length < 10 && (
                                <ImagePickerButton
                                    onImageSelected={(uri) => setProfilePhotos([...profilePhotos, uri])}
                                    aspectRatio={[4, 3]}
                                    style={styles.addPhotoButton}
                                >
                                    <View style={styles.addPhotoIconContainer}>
                                        <Ionicons name="add" size={24} color={COLORS.accent} />
                                        <Typography variant="small" style={{ color: COLORS.accent, marginTop: 4 }}>
                                            Add
                                        </Typography>
                                    </View>
                                </ImagePickerButton>
                            )}
                        </ScrollView>
                    </View>
                )}

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
                    <GooglePlacesInput
                        label="Location"
                        placeholder="Search for your city or venue..."
                        initialValue={location}
                        onSelect={(place) => {
                            setLocation(place.name);
                            setCoordinates(place.coordinate);
                        }}
                    />
                </View>

                {/* Phone */}
                <View style={styles.section}>
                    <PhoneInput
                        label="Phone Number"
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="98765 43210"
                    />
                </View>

                {/* Address */}
                <View style={styles.section}>
                    <Typography variant="body" style={styles.label}>
                        Full Address
                    </Typography>
                    <TextInput
                        style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                        value={address}
                        onChangeText={setAddress}
                        placeholder="Plot No, Street, Building..."
                        placeholderTextColor={COLORS.secondary}
                        multiline
                    />
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

                {(isProvider || isBusiness) && (
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

                {/* Interests / Specialties (Hidden for Businesses) */}
                {!isBusiness && (
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
                )}

                {/* Social Links Section */}
                {(isBusiness || isProvider) && (
                    <View style={styles.section}>
                        <Typography variant="body" style={styles.label}>
                            Social & Portfolio Links
                        </Typography>
                        <Typography variant="caption" style={styles.subtitle}>
                            Add links to your professional work and social media
                        </Typography>

                        {showInstagram && (
                            <View style={styles.socialInputContainer}>
                                <Ionicons name="logo-instagram" size={20} color="#E1306C" style={styles.socialIcon} />
                                <TextInput
                                    style={styles.socialInput}
                                    value={instagram}
                                    onChangeText={setInstagram}
                                    placeholder="Instagram Profile URL"
                                    placeholderTextColor={COLORS.secondary}
                                    autoCapitalize="none"
                                />
                            </View>
                        )}

                        {showSoundcloud && (
                            <View style={styles.socialInputContainer}>
                                <Ionicons name="musical-notes" size={20} color="#FF5500" style={styles.socialIcon} />
                                <TextInput
                                    style={styles.socialInput}
                                    value={soundcloud}
                                    onChangeText={setSoundcloud}
                                    placeholder="SoundCloud Profile URL"
                                    placeholderTextColor={COLORS.secondary}
                                    autoCapitalize="none"
                                />
                            </View>
                        )}

                        {showBehance && (
                            <View style={styles.socialInputContainer}>
                                <Ionicons name="color-palette" size={20} color="#1769FF" style={styles.socialIcon} />
                                <TextInput
                                    style={styles.socialInput}
                                    value={behance}
                                    onChangeText={setBehance}
                                    placeholder="Behance Portfolio URL"
                                    placeholderTextColor={COLORS.secondary}
                                    autoCapitalize="none"
                                />
                            </View>
                        )}

                        {showGoogleDrive && (
                            <View style={styles.socialInputContainer}>
                                <Ionicons name="cloud-outline" size={20} color="#4285F4" style={styles.socialIcon} />
                                <TextInput
                                    style={styles.socialInput}
                                    value={googleDrive}
                                    onChangeText={setGoogleDrive}
                                    placeholder="Google Drive / Portfolio Link"
                                    placeholderTextColor={COLORS.secondary}
                                    autoCapitalize="none"
                                />
                            </View>
                        )}

                        {showYoutube && (
                            <View style={styles.socialInputContainer}>
                                <Ionicons name="logo-youtube" size={20} color="#FF0000" style={styles.socialIcon} />
                                <TextInput
                                    style={styles.socialInput}
                                    value={youtube}
                                    onChangeText={setYoutube}
                                    placeholder="YouTube Channel URL"
                                    placeholderTextColor={COLORS.secondary}
                                    autoCapitalize="none"
                                />
                            </View>
                        )}
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Save Button */}
            <View style={styles.saveButtonContainer}>
                <AntigravityButton
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
    suggestionsList: {
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.m,
        marginTop: SPACING.xs,
        maxHeight: 200,
        overflow: 'hidden',
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    photosScroll: {
        flexDirection: 'row',
        marginBottom: SPACING.s,
    },
    photoItemContainer: {
        position: 'relative',
        marginRight: SPACING.m,
    },
    photoItem: {
        width: 120,
        height: 90,
        borderRadius: BORDER_RADIUS.m,
    },
    removePhotoButton: {
        position: 'absolute',
        top: -8,
        right: -8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 59, 48, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
        borderWidth: 2,
        borderColor: COLORS.background,
    },
    addPhotoButton: {
        width: 120,
        height: 90,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: COLORS.accent,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addPhotoIconContainer: {
        alignItems: 'center',
    },
    socialInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.m,
        marginBottom: SPACING.s,
        paddingHorizontal: SPACING.m,
    },
    socialIcon: {
        marginRight: SPACING.m,
    },
    socialInput: {
        flex: 1,
        paddingVertical: SPACING.m,
        color: COLORS.primary,
        fontSize: 14,
    },
});

export default EditProfileScreen;
