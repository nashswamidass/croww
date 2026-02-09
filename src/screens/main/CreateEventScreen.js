import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionInput from '../../components/NotionInput';
import NotionButton from '../../components/NotionButton';
import NotionCard from '../../components/NotionCard';
import ImagePickerButton from '../../components/ImagePickerButton';
import { SPACING, COLORS } from '../../constants/theme';
import { getVerificationStatus } from '../../services/verificationService';
import { userService } from '../../services/userService';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CreateEventScreen = ({ navigation }) => {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState('');
    const [locationName, setLocationName] = useState('');
    const [eventCoords, setEventCoords] = useState(null);
    const [eventImage, setEventImage] = useState(null);
    const [isPublic, setIsPublic] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const init = async () => {
            const user = await userService.getUser();
            setCurrentUser(user);
            if (user?.userType === 'business') {
                setIsPublic(true);
            }
            checkVerification();

            // Fetch current location for event coordinates
            try {
                const cached = await AsyncStorage.getItem('userLocation');
                if (cached) setEventCoords(JSON.parse(cached));

                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    setEventCoords(loc.coords);
                }
            } catch (err) {
                console.log("CreateEvent location error:", err);
            }
        };
        init();
    }, []);

    const checkVerification = async () => {
        const status = await getVerificationStatus();
        setVerificationStatus(status);
    };

    const handleVerificationChoice = () => {
        Alert.alert(
            'Choose Verification Method',
            'Public events require verification to prevent spam',
            [
                {
                    text: 'Aadhaar OTP',
                    onPress: () => navigation.navigate('AadhaarVerification', {
                        onVerified: (type) => {
                            checkVerification();
                        }
                    })
                },
                {
                    text: 'Business Verification',
                    onPress: () => navigation.navigate('BusinessVerification', {
                        onVerified: (type) => {
                            checkVerification();
                        }
                    })
                },
                {
                    text: 'Cancel',
                    style: 'cancel'
                }
            ]
        );
    };

    const handlePublicToggle = (value) => {
        if (value) {
            // Switching to public
            const isVerified = verificationStatus?.aadhaarVerified || verificationStatus?.businessVerified;
            const isPending = verificationStatus?.businessPending;
            const isBusiness = currentUser?.userType === 'business';

            if (isVerified || isBusiness) {
                setIsPublic(true);
            } else if (isPending) {
                Alert.alert(
                    'Verification Pending',
                    'Your business verification is under review. You can create public events once approved.',
                    [{ text: 'OK' }]
                );
            } else {
                Alert.alert(
                    'Verification Required',
                    'Public events require verification. Would you like to verify now?',
                    [
                        { text: 'Later', style: 'cancel' },
                        { text: 'Verify Now', onPress: handleVerificationChoice }
                    ]
                );
            }
        } else {
            setIsPublic(false);
        }
    };

    const handleCreate = () => {
        // Validate
        if (!title || !date) {
            Alert.alert('Missing Information', 'Please fill in the event title and date');
            return;
        }

        const isBusiness = currentUser?.userType === 'business';
        const isVerified = verificationStatus?.aadhaarVerified || verificationStatus?.businessVerified;

        if (isPublic && !isBusiness) {
            if (!isVerified) {
                Alert.alert('Verification Required', 'Please complete verification to create public events');
                return;
            }
        }

        // Create Event Object
        const newEvent = {
            id: 'event-' + Date.now(),
            title,
            category: category || (isBusiness ? currentUser.category : 'Party'),
            date,
            locationName: locationName || 'Nearby',
            coordinate: eventCoords || { latitude: 37.78825, longitude: -122.4324 },
            description,
            attendees: 1,
            imageUri: eventImage,
            isPublic,
            isOfficial: isBusiness,
            organizerId: currentUser?.id,
            organizerName: currentUser?.name,
            verificationStatus: (isPublic && (isVerified || isBusiness)) ? 'verified' : 'none',
            verificationType: isPublic ? (isBusiness ? 'business' : (verificationStatus?.aadhaarVerified ? 'aadhaar' : 'business')) : null
        };

        // Navigate to Detail
        navigation.replace('EventDetail', { event: newEvent });
    };

    const getVerificationText = () => {
        if (verificationStatus?.aadhaarVerified) {
            return '✓ Aadhaar Verified';
        }
        if (verificationStatus?.businessVerified) {
            return '✓ Business Verified';
        }
        if (verificationStatus?.businessPending) {
            return '⏱️ Business Verification Pending';
        }
        return 'Not Verified';
    };

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Typography variant="h1">Host an Event</Typography>
                    <Typography variant="body" style={{ color: COLORS.secondary }}>
                        Create a public or private event and invite your friends.
                    </Typography>
                </View>

                <ImagePickerButton
                    onImageSelected={setEventImage}
                    currentImage={eventImage}
                />

                <NotionInput
                    label="Event Title"
                    placeholder="e.g. Summer Rooftop Party"
                    value={title}
                    onChangeText={setTitle}
                />

                <NotionInput
                    label="Category"
                    placeholder="Party, Dinner, Hike..."
                    value={category}
                    onChangeText={setCategory}
                />

                <NotionInput
                    label="When?"
                    placeholder="Tomorrow at 8 PM"
                    value={date}
                    onChangeText={setDate}
                />

                <NotionInput
                    label="Location Name"
                    placeholder="e.g. The Grand Hotel or Central Park"
                    value={locationName}
                    onChangeText={setLocationName}
                />

                <NotionInput
                    label="Description"
                    placeholder="What's the vibe?"
                    value={description}
                    onChangeText={setDescription}
                    style={{ height: 100 }}
                />

                {/* Public/Private Toggle */}
                <NotionCard style={styles.toggleCard}>
                    <View style={styles.toggleRow}>
                        <View style={{ flex: 1 }}>
                            <Typography variant="body" style={{ fontWeight: '600' }}>
                                {isPublic ? '🌍 Public Event' : '🔒 Private Event'}
                            </Typography>
                            <Typography variant="caption" style={{ color: COLORS.secondary, marginTop: 4 }}>
                                {isPublic
                                    ? 'Visible to everyone on the map'
                                    : 'Only visible to invited friends'}
                            </Typography>
                        </View>
                        <Switch
                            value={isPublic}
                            onValueChange={handlePublicToggle}
                            trackColor={{ false: COLORS.border, true: COLORS.accent }}
                            thumbColor={COLORS.primary}
                        />
                    </View>
                </NotionCard>

                {/* Verification Status */}
                {isPublic && (
                    <NotionCard style={styles.verificationCard}>
                        <Typography variant="small" style={{ color: COLORS.secondary }}>
                            Verification Status: {getVerificationText()}
                        </Typography>
                        {!verificationStatus?.aadhaarVerified && !verificationStatus?.businessVerified && (
                            <NotionButton
                                title="Get Verified"
                                variant="secondary"
                                onPress={handleVerificationChoice}
                                style={{ marginTop: SPACING.s }}
                            />
                        )}
                    </NotionCard>
                )}

                <NotionButton
                    title="Create & Invite"
                    onPress={handleCreate}
                    style={styles.button}
                />

                <NotionButton
                    title="Cancel"
                    variant="secondary"
                    onPress={() => navigation.goBack()}
                    style={styles.cancelButton}
                />

            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: SPACING.m,
    },
    header: {
        marginBottom: SPACING.xl,
        marginTop: SPACING.l,
    },
    toggleCard: {
        marginBottom: SPACING.m,
        padding: SPACING.m,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    verificationCard: {
        marginBottom: SPACING.l,
        padding: SPACING.m,
        backgroundColor: COLORS.surfaceHighlight,
    },
    button: {
        marginTop: SPACING.l,
    },
    cancelButton: {
        marginTop: SPACING.m,
        borderWidth: 0,
    }
});

export default CreateEventScreen;
