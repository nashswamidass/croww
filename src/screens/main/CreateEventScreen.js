import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Switch, Alert, TouchableOpacity, Platform, TextInput } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionInput from '../../components/NotionInput';
import AntigravityButton from '../../components/AntigravityButton';
import NotionCard from '../../components/NotionCard';
import ImagePickerButton from '../../components/ImagePickerButton';
import GooglePlacesInput from '../../components/GooglePlacesInput';
import { SPACING, COLORS } from '../../constants/theme';
import { getVerificationStatus } from '../../services/verificationService';
import { userService } from '../../services/userService';
import { eventService } from '../../services/eventService';
import { storageService } from '../../services/storageService';
import { locationService } from '../../services/locationService';
const VERSION_HASH = "FIX_VER_999";

const CreateEventScreen = ({ navigation, route }) => {
    const editEvent = route.params?.event;
    const isEditMode = !!editEvent;

    const [title, setTitle] = useState(editEvent?.title || '');
    const [category, setCategory] = useState(editEvent?.category || '');
    const [description, setDescription] = useState(editEvent?.description || '');
    const [date, setDate] = useState(editEvent?.date ? new Date(editEvent.date) : new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [locationName, setLocationName] = useState(editEvent?.locationName || '');
    const [eventCoords, setEventCoords] = useState(editEvent?.coordinate || null);
    const [eventImage, setEventImage] = useState(editEvent?.imageUri || null);
    const [isPublic, setIsPublic] = useState(editEvent?.isPublic || false);
    const [verificationStatus, setVerificationStatus] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isPaid, setIsPaid] = useState(editEvent?.isPaid || false);
    const [price, setPrice] = useState(editEvent?.price?.toString() || '');
    const [maxTickets, setMaxTickets] = useState(editEvent?.maxTickets?.toString() || '');
    const [movieName, setMovieName] = useState(editEvent?.movieName || '');
    const [screenName, setScreenName] = useState(editEvent?.screenName || '');

    const eventCategories = ['Party', 'Dinner', 'Movie', 'Concert', 'Workshop', 'Sports', 'Networking', 'Art', 'Nightlife', 'Other'];

    useEffect(() => {
        const init = async () => {
            const user = await userService.getUser();
            setCurrentUser(user);

            // Removed strict business account restriction for hosting basic events
            checkVerification();

            // Fetch current location for event coordinates only if not in edit mode or if coordinates are missing
            try {
                if (!eventCoords) {
                    const cached = await locationService.getCachedLocation();
                    if (cached.coords) setEventCoords(cached.coords);

                    const { coords } = await locationService.getLocation();
                    if (coords) setEventCoords(coords);
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
        const userType = currentUser?.userType;

        // Business accounts go directly to business document verification
        if (userType === 'business' || currentUser?.isBusiness) {
            navigation.navigate('BusinessVerification', {
                onVerified: (type) => {
                    checkVerification();
                }
            });
            return;
        }

        // Providers and Individuals use Aadhaar verification
        navigation.navigate('AadhaarVerification', {
            onVerified: (type) => {
                checkVerification();
            }
        });
    };

    const handlePublicToggle = (value) => {
        if (value) {
            // Switching to public — require actual verification approval
            const isVerified = verificationStatus?.aadhaarVerified || verificationStatus?.businessVerified;
            const isPending = verificationStatus?.businessPending;

            if (isVerified) {
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

    const onDateChange = (event, selectedDate) => {
        const currentDate = selectedDate || date;
        setShowDatePicker(Platform.OS === 'ios');
        setDate(currentDate);
    };

    const onTimeChange = (event, selectedTime) => {
        const currentTime = selectedTime || date;
        setShowTimePicker(Platform.OS === 'ios');
        setDate(currentTime);
    };

    const formatDateDisplay = (date) => {
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleSave = async () => {
        // Validate
        if (!title || !date) {
            Alert.alert('Missing Information', 'Please fill in the event title and date');
            return;
        }

        // Verification Enforcement
        const isAadhaarVerified = verificationStatus?.aadhaarVerified;
        const isBusinessVerified = verificationStatus?.businessVerified;
        const isBusiness = currentUser?.userType === 'business';

        if (isPublic && !isAadhaarVerified && !isBusinessVerified) {
            Alert.alert(
                'Verification Required',
                isBusiness
                    ? 'Your business verification is pending or not yet submitted. Please complete verification to post public events.'
                    : 'Only verified users can host public events. Please verify or set to Private.',
                [{ text: 'OK' }]
            );
            return;
        }

        if (isPaid && !isBusinessVerified) {
            const message = isBusiness
                ? 'Only verified business accounts can host paid events with ticketing. Please complete business verification first.'
                : 'Only registered businesses can host paid events with ticketing. Please contact support to upgrade your account type.';

            Alert.alert(
                'Business Verification Required',
                message,
                [{ text: 'OK' }]
            );
            return;
        }

        setSaving(true);
        try {
            let uploadedUri = eventImage;

            // Handle image upload if it's a new image (local URI or blob/data)
            if (eventImage && (
                eventImage.startsWith('file://') ||
                eventImage.startsWith('content://') ||
                eventImage.startsWith('blob:') ||
                eventImage.startsWith('data:')
            )) {
                try {
                    uploadedUri = await storageService.uploadImage(eventImage, 'event_images');
                } catch (uploadError) {
                    console.error("Image upload failed:", uploadError);
                    Alert.alert("Upload Failed", "Could not upload event image. Creating event without image.");
                    uploadedUri = null;
                }
            }

            // Create Event Object with robust fallbacks
            const eventData = {
                title,
                category: category || (isEditMode ? editEvent.category : 'Party'),
                date: date.toISOString(),
                locationName: locationName || 'Nearby',
                coordinate: eventCoords || { latitude: 37.78825, longitude: -122.4324 },
                description: description || "",
                imageUri: uploadedUri || null,
                isPublic: isPublic || false,
                isOfficial: isEditMode ? (editEvent.isOfficial || false) : (isBusinessVerified || false),
                organizerId: currentUser?.id || auth.currentUser?.uid,
                organizerName: currentUser?.name || auth.currentUser?.displayName || "Organizer",
                isPaid: isPaid || false,
                price: isPaid ? (parseFloat(price) || 0) : 0,
                maxTickets: parseInt(maxTickets) || 0,
                movieName: category === 'Movie' ? (movieName || "") : null,
                screenName: category === 'Movie' ? (screenName || "") : null,
                verificationStatus: (isPublic && (isAadhaarVerified || isBusinessVerified)) ? 'verified' : 'none',
                verificationType: isPublic ? (isBusinessVerified ? 'business' : (isAadhaarVerified ? 'aadhaar' : "none")) : "none"
            };

            if (isEditMode) {
                await eventService.updateEvent(editEvent.id, eventData);
                Alert.alert('Success', 'Event updated successfully!', [
                    { text: 'OK', onPress: () => navigation.goBack() }
                ]);
            } else {
                const createdEvent = {
                    ...eventData,
                    attendees: 1,
                };
                const result = await eventService.createEvent(createdEvent);
                navigation.replace('EventDetail', { event: result });
            }

        } catch (error) {
            console.error('Error saving event:', error);
            Alert.alert('Error', `Failed to ${isEditMode ? 'update' : 'create'} event.`);
        } finally {
            setSaving(false);
        }
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
                    <Typography variant="h1">{isEditMode ? 'Edit Event' : 'Host an Event'}</Typography>
                    <Typography variant="body" style={{ color: COLORS.secondary }}>
                        {isEditMode ? 'Update your event details.' : 'Create a public or private event and invite your friends.'}
                    </Typography>
                </View>

                <ImagePickerButton
                    onImageSelected={setEventImage}
                    currentImage={eventImage}
                    aspectRatio={[3, 4]}
                />

                <NotionInput
                    label="Event Title"
                    placeholder="e.g. Summer Rooftop Party"
                    value={title}
                    onChangeText={setTitle}
                />

                {/* Category Selection */}
                <View style={styles.inputSection}>
                    <Typography variant="body" style={styles.label}>Category</Typography>
                    <View style={styles.chipContainer}>
                        {eventCategories.map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                style={[
                                    styles.chip,
                                    category === cat && styles.chipActive
                                ]}
                                onPress={() => setCategory(cat)}
                            >
                                <Typography
                                    variant="small"
                                    style={[
                                        styles.chipText,
                                        category === cat && styles.chipTextActive
                                    ]}
                                >
                                    {cat}
                                </Typography>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Date and Time Selection */}
                <View style={styles.inputSection}>
                    <Typography variant="body" style={styles.label}>When?</Typography>
                    <View style={styles.dateTimeRow}>
                        <TouchableOpacity
                            style={styles.pickerButton}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Ionicons name="calendar-outline" size={20} color={COLORS.accent} />
                            <Typography variant="body" style={styles.pickerButtonText}>
                                {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </Typography>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.pickerButton}
                            onPress={() => setShowTimePicker(true)}
                        >
                            <Ionicons name="time-outline" size={20} color={COLORS.accent} />
                            <Typography variant="body" style={styles.pickerButtonText}>
                                {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                        </TouchableOpacity>
                    </View>

                    {showDatePicker && (
                        <DateTimePicker
                            value={date}
                            mode="date"
                            display="default"
                            onChange={onDateChange}
                        />
                    )}

                    {showTimePicker && (
                        <DateTimePicker
                            value={date}
                            mode="time"
                            display="default"
                            onChange={onTimeChange}
                        />
                    )}
                </View>

                <GooglePlacesInput
                    label="Location Search"
                    placeholder="Search for a venue or place..."
                    initialValue={locationName}
                    onSelect={(location) => {
                        setLocationName(location.name);
                        setEventCoords(location.coordinate);
                    }}
                />

                <NotionInput
                    label="Description"
                    placeholder="What's the vibe?"
                    value={description}
                    onChangeText={setDescription}
                    style={{ height: 100 }}
                />

                {category === 'Movie' && (
                    <NotionCard style={styles.movieSection}>
                        <Typography variant="h3" style={{ marginBottom: SPACING.m }}>Movie Details</Typography>
                        <NotionInput
                            label="Name of Movie"
                            placeholder="e.g. Inception"
                            value={movieName}
                            onChangeText={setMovieName}
                        />
                        <NotionInput
                            label="Screen Name / Number"
                            placeholder="e.g. Screen 4 or IMAX"
                            value={screenName}
                            onChangeText={setScreenName}
                        />
                    </NotionCard>
                )}

                {/* Ticketing Section (For Verified Business Users) */}
                {verificationStatus?.businessVerified && (
                    <NotionCard style={styles.ticketingCard}>
                        <View style={styles.toggleRow}>
                            <View style={{ flex: 1 }}>
                                <Typography variant="body" style={{ fontWeight: '600' }}>
                                    Ticketing
                                </Typography>
                                <Typography variant="caption" color={COLORS.secondary}>
                                    Set price and capacity for your event
                                </Typography>
                            </View>
                            <Switch
                                value={isPaid}
                                onValueChange={setIsPaid}
                                trackColor={{ false: COLORS.border, true: COLORS.accent }}
                                thumbColor={COLORS.primary}
                            />
                        </View>

                        <View style={styles.ticketingInputs}>
                            <View style={{ flex: 1, marginRight: SPACING.s }}>
                                <Typography variant="small" style={styles.inputLabel}>
                                    {isPaid ? 'Price (₹)' : 'Type'}
                                </Typography>
                                {isPaid ? (
                                    <TextInput
                                        style={styles.miniInput}
                                        placeholder="0.00"
                                        keyboardType="numeric"
                                        value={price}
                                        onChangeText={setPrice}
                                        placeholderTextColor={COLORS.secondary}
                                    />
                                ) : (
                                    <View style={[styles.miniInput, { backgroundColor: COLORS.surfaceHighlight }]}>
                                        <Typography variant="body">Free</Typography>
                                    </View>
                                )}
                            </View>
                            <View style={{ flex: 1, marginLeft: SPACING.s }}>
                                <Typography variant="small" style={styles.inputLabel}>Capacity</Typography>
                                <TextInput
                                    style={styles.miniInput}
                                    placeholder="Total Passes"
                                    keyboardType="numeric"
                                    value={maxTickets}
                                    onChangeText={setMaxTickets}
                                    placeholderTextColor={COLORS.secondary}
                                />
                            </View>
                        </View>
                    </NotionCard>
                )}

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
                            <AntigravityButton
                                title="Get Verified"
                                variant="secondary"
                                onPress={handleVerificationChoice}
                                style={{ marginTop: SPACING.s }}
                            />
                        )}
                    </NotionCard>
                )}

                <AntigravityButton
                    title={saving ? (isEditMode ? "Updating..." : "Creating...") : (isEditMode ? "Save Changes" : "Create & Invite")}
                    disabled={saving}
                    onPress={handleSave}
                    loading={saving}
                    style={styles.button}
                />

                <AntigravityButton
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
    },
    inputSection: {
        marginBottom: SPACING.l,
    },
    label: {
        fontWeight: '600',
        marginBottom: SPACING.s,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.s,
    },
    chip: {
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    chipActive: {
        backgroundColor: COLORS.accent + '20',
        borderColor: COLORS.accent,
    },
    chipText: {
        color: COLORS.secondary,
    },
    chipTextActive: {
        color: COLORS.accent,
        fontWeight: 'bold',
    },
    dateTimeRow: {
        flexDirection: 'row',
        gap: SPACING.m,
    },
    pickerButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        padding: SPACING.m,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    pickerButtonText: {
        marginLeft: SPACING.s,
        color: COLORS.primary,
    },
    ticketingCard: {
        marginBottom: SPACING.m,
        padding: SPACING.m,
    },
    ticketingInputs: {
        flexDirection: 'row',
        marginTop: SPACING.m,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingTop: SPACING.m,
    },
    inputLabel: {
        color: COLORS.secondary,
        marginBottom: 4,
    },
    miniInput: {
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 8,
        padding: 10,
        height: 45,
        borderWidth: 1,
        borderColor: COLORS.border,
        color: COLORS.primary,
    },
    movieSection: {
        marginTop: SPACING.m,
        padding: SPACING.m,
        backgroundColor: COLORS.surfaceHighlight,
        borderColor: COLORS.accent,
        borderWidth: 1,
    },
});

export default CreateEventScreen;
