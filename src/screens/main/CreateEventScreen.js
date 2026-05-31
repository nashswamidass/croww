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
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { auth } from '../../services/firebaseConfig';
import { getVerificationStatus } from '../../services/verificationService';
import { userService } from '../../services/userService';
import { eventService } from '../../services/eventService';
import { storageService } from '../../services/storageService';
import { locationService } from '../../services/locationService';
import GenderPreferenceSelector from '../../components/GenderPreferenceSelector';
import { createBuddyRequest } from '../../services/buddyService';
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
    const [spotsAvailable, setSpotsAvailable] = useState(editEvent?.spotsAvailable || 2);
    const [genderPreference, setGenderPreference] = useState(editEvent?.genderPreference || 'any');
    const [eventType, setEventType] = useState(editEvent?.eventType || 'event'); // 'event' or 'table'
    const [ticketType, setTicketType] = useState(editEvent?.ticketType || 'Individual'); // 'Individual', 'Couple', 'Group'
    const [paxPerTicket, setPaxPerTicket] = useState(editEvent?.paxPerTicket?.toString() || '1');

    const spotOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
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
        navigation.navigate('VerifyIdentity', {
            onVerified: (type) => {
                checkVerification();
            }
        });
    };

    const handlePublicToggle = (value) => {
        if (value) {
            // Switching to public — require actual verification approval
            const isAadhaarVerified = verificationStatus?.aadhaarVerified;
            const isBusinessVerified = verificationStatus?.businessVerified;
            const isProviderVerified = (currentUser?.userType === 'provider' && currentUser?.isApproved);
            
            const isVerified = isAadhaarVerified || isBusinessVerified || isProviderVerified;
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
                    'Public events require verification. Would you like to verify your profile now?',
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
        if (Platform.OS === 'web') {
            const val = event.target.value; // YYYY-MM-DD
            if (!val) return;
            const [y, m, d] = val.split('-').map(Number);
            const newDate = new Date(date);
            newDate.setFullYear(y);
            newDate.setMonth(m - 1);
            newDate.setDate(d);
            setDate(newDate);
        } else {
            // Android hides it automatically upon selection, but we must update state
            if (Platform.OS === 'android') {
                setShowDatePicker(false);
            }
            // Update value if 'OK' was pressed
            if (event.type !== 'dismissed' && selectedDate) {
                setDate(selectedDate);
            }
        }
    };

    const onTimeChange = (event, selectedTime) => {
        if (Platform.OS === 'web') {
            const val = event.target.value; // HH:MM
            if (!val) return;
            const [h, m] = val.split(':').map(Number);
            const newDate = new Date(date);
            newDate.setHours(h);
            newDate.setMinutes(m);
            setDate(newDate);
        } else {
             // Android hides it automatically upon selection, but we must update state
             if (Platform.OS === 'android') {
                 setShowTimePicker(false);
             }
             // Update value if 'OK' was pressed
             if (event.type !== 'dismissed' && selectedTime) {
                 setDate(selectedTime);
             }
        }
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
        console.log("[CreateEvent] handleSave triggered", { title, date, isPublic, isPaid });
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
        console.log("[CreateEvent] Starting submission...");
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

            // Provider verification check
            const isProviderVerified = (currentUser?.userType === 'provider' && currentUser?.isApproved);
            const isOfficialAccount = isBusinessVerified || isProviderVerified;

            // Create Event Object with robust fallbacks
            const eventData = {
                title,
                category: category || (isEditMode ? editEvent.category : 'Party'),
                date: date.toISOString(),
                locationName: locationName || 'Nearby',
                coordinate: eventCoords || { latitude: 19.0760, longitude: 72.8777 }, // Mumbai Fallback
                description: description || "",
                imageUri: uploadedUri || null,
                isPublic: isOfficialAccount ? true : (isPublic || false), // Force public for business & providers
                isOfficial: isEditMode ? (editEvent.isOfficial || false) : (isOfficialAccount || false),
                organizerId: currentUser?.id || auth.currentUser?.uid,
                organizerName: currentUser?.name || auth.currentUser?.displayName || "Organizer",
                isPaid: isPaid || false,
                price: isPaid ? (parseFloat(price) || 0) : 0,
                maxTickets: parseInt(maxTickets) || 0,
                movieName: category === 'Movie' ? (movieName || "") : null,
                screenName: category === 'Movie' ? (screenName || "") : null,
                verificationStatus: (isPublic && (isAadhaarVerified || isOfficialAccount)) ? 'verified' : 'none',
                verificationType: isPublic ? (isBusinessVerified ? 'business' : (isProviderVerified ? 'provider' : (isAadhaarVerified ? 'aadhaar' : "none"))) : "none",
                eventType: isBusinessVerified ? eventType : 'event',
                ticketType: isPaid || eventType === 'table' ? ticketType : 'Individual',
                paxPerTicket: ticketType === 'Individual' ? 1 : (ticketType === 'Couple' ? 2 : parseInt(paxPerTicket) || 1)
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
                    isBuddyEvent: currentUser?.userType !== 'business',
                    spotsAvailable: spotsAvailable,
                    genderPreference: genderPreference
                };
                const result = await eventService.createEvent(createdEvent);

                if (currentUser?.userType !== 'business') {
                    await createBuddyRequest(result.id, {
                        spotsAvailable,
                        genderPreference,
                        message: description || `Join me for ${title}!`
                    });
                }

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
                            onPress={() => {
                                if (Platform.OS === 'web') {
                                    document.getElementById('web-date-picker')?.showPicker();
                                } else {
                                    setShowDatePicker(true);
                                }
                            }}
                        >
                            <Ionicons name="calendar-outline" size={20} color={COLORS.accent} />
                            <Typography variant="body" style={styles.pickerButtonText}>
                                {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </Typography>
                            {Platform.OS === 'web' && (
                                <input
                                    id="web-date-picker"
                                    type="date"
                                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                                    value={date.toISOString().split('T')[0]}
                                    onChange={onDateChange}
                                />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.pickerButton}
                            onPress={() => {
                                if (Platform.OS === 'web') {
                                    document.getElementById('web-time-picker')?.showPicker();
                                } else {
                                    setShowTimePicker(true);
                                }
                            }}
                        >
                            <Ionicons name="time-outline" size={20} color={COLORS.accent} />
                            <Typography variant="body" style={styles.pickerButtonText}>
                                {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                            {Platform.OS === 'web' && (
                                <input
                                    id="web-time-picker"
                                    type="time"
                                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                                    value={`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`}
                                    onChange={onTimeChange}
                                />
                            )}
                        </TouchableOpacity>
                    </View>

                    {showDatePicker && (
                        <View style={Platform.OS === 'ios' ? styles.iosPickerContainer : null}>
                            <DateTimePicker
                                value={date}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={onDateChange}
                            />
                            {Platform.OS === 'ios' && (
                                <TouchableOpacity
                                    style={styles.doneButton}
                                    onPress={() => setShowDatePicker(false)}
                                >
                                    <Typography variant="body" color={COLORS.accent} style={{ fontWeight: '600' }}>Done</Typography>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {showTimePicker && (
                        <View style={Platform.OS === 'ios' ? styles.iosPickerContainer : null}>
                            <DateTimePicker
                                value={date}
                                mode="time"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={onTimeChange}
                            />
                            {Platform.OS === 'ios' && (
                                <TouchableOpacity
                                    style={styles.doneButton}
                                    onPress={() => setShowTimePicker(false)}
                                >
                                    <Typography variant="body" color={COLORS.accent} style={{ fontWeight: '600' }}>Done</Typography>
                                </TouchableOpacity>
                            )}
                        </View>
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

                {/* Event Type Section (For Verified Business Users) */}
                {verificationStatus?.businessVerified && (
                    <NotionCard style={styles.ticketingCard}>
                        <Typography variant="h3" style={{ marginBottom: SPACING.m }}>Event Settings</Typography>
                        <Typography variant="body" style={styles.label}>What are you hosting?</Typography>
                        <View style={{ flexDirection: 'row', gap: SPACING.s, marginTop: SPACING.s }}>
                            <TouchableOpacity
                                style={[
                                    styles.typeOption,
                                    eventType === 'event' && styles.typeOptionSelected
                                ]}
                                onPress={() => setEventType('event')}
                            >
                                <Typography variant="body" style={[styles.spotText, eventType === 'event' && styles.spotTextSelected]}>
                                    Event
                                </Typography>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.typeOption,
                                    eventType === 'table' && styles.typeOptionSelected
                                ]}
                                onPress={() => setEventType('table')}
                            >
                                <Typography variant="body" style={[styles.spotText, eventType === 'table' && styles.spotTextSelected]}>
                                    Table Booking
                                </Typography>
                            </TouchableOpacity>
                        </View>
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

                        {(isPaid || eventType === 'table') && (
                            <View style={[styles.ticketingInputs, { borderTopWidth: 0, marginTop: SPACING.s, paddingTop: 0 }]}>
                                <View style={{ flex: 2, marginRight: SPACING.s }}>
                                    <Typography variant="small" style={styles.inputLabel}>Ticket Admits</Typography>
                                    <View style={{ flexDirection: 'row', backgroundColor: COLORS.surfaceHighlight, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border }}>
                                        {['Individual', 'Couple', 'Group'].map((type) => (
                                            <TouchableOpacity 
                                                key={type}
                                                style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: ticketType === type ? COLORS.primary : 'transparent' }}
                                                onPress={() => setTicketType(type)}
                                            >
                                                <Typography variant="small" style={{ color: ticketType === type ? COLORS.surface : COLORS.primary }}>
                                                    {type === 'Individual' ? '1 Pax' : type === 'Couple' ? '2 Pax' : 'Group'}
                                                </Typography>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                                {ticketType === 'Group' && (
                                    <View style={{ flex: 1 }}>
                                        <Typography variant="small" style={styles.inputLabel}>Pax Count</Typography>
                                        <TextInput
                                            style={styles.miniInput}
                                            placeholder="e.g. 4"
                                            keyboardType="numeric"
                                            value={paxPerTicket}
                                            onChangeText={setPaxPerTicket}
                                            placeholderTextColor={COLORS.secondary}
                                        />
                                    </View>
                                )}
                            </View>
                        )}
                    </NotionCard>
                )}

                {/* Buddy Request Section (For Individuals/Providers) */}
                {currentUser?.userType !== 'business' && (
                    <NotionCard style={styles.ticketingCard}>
                        <Typography variant="h3" style={{ marginBottom: SPACING.m }}>Find Buddies</Typography>
                        <View style={{ marginBottom: SPACING.l }}>
                            <Typography variant="body" style={styles.label}>
                                How many people can join?
                            </Typography>
                            <Typography variant="caption" style={{ color: COLORS.secondary, marginBottom: SPACING.m }}>
                                Choose the number of spots available
                            </Typography>
                            <View style={styles.spotsContainer}>
                                {spotOptions.map((num) => (
                                    <TouchableOpacity
                                        key={num}
                                        style={[
                                            styles.spotOption,
                                            spotsAvailable === num && styles.spotOptionSelected
                                        ]}
                                        onPress={() => setSpotsAvailable(num)}
                                    >
                                        <Typography
                                            variant="body"
                                            style={[
                                                styles.spotText,
                                                spotsAvailable === num && styles.spotTextSelected
                                            ]}
                                        >
                                            {num}
                                        </Typography>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                        <GenderPreferenceSelector
                            value={genderPreference}
                            onChange={setGenderPreference}
                        />
                    </NotionCard>
                )}

                {/* Public/Private Radio Buttons */}
                <NotionCard style={styles.toggleCard}>
                    <Typography variant="h3" style={{ marginBottom: SPACING.m }}>Event Privacy</Typography>
                    
                    <TouchableOpacity 
                        style={[styles.radioOption, isPublic && styles.radioOptionSelected]} 
                        onPress={() => handlePublicToggle(true)}
                        activeOpacity={0.7}
                    >
                        <Ionicons 
                            name={isPublic ? "radio-button-on" : "radio-button-off"} 
                            size={24} 
                            color={isPublic ? COLORS.primary : COLORS.secondary} 
                            style={{ marginRight: SPACING.m }}
                        />
                        <View style={{ flex: 1 }}>
                            <Typography variant="body" style={{ fontWeight: '600', color: isPublic ? COLORS.text : COLORS.secondary }}>
                                🌍 Public Event
                            </Typography>
                            <Typography variant="caption" style={{ color: COLORS.secondary, marginTop: 4 }}>
                                Visible to everyone on the global map
                            </Typography>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.radioOption, !isPublic && styles.radioOptionSelected]} 
                        onPress={() => handlePublicToggle(false)}
                        activeOpacity={0.7}
                    >
                        <Ionicons 
                            name={!isPublic ? "radio-button-on" : "radio-button-off"} 
                            size={24} 
                            color={!isPublic ? COLORS.primary : COLORS.secondary} 
                            style={{ marginRight: SPACING.m }}
                        />
                        <View style={{ flex: 1 }}>
                            <Typography variant="body" style={{ fontWeight: '600', color: !isPublic ? COLORS.text : COLORS.secondary }}>
                                🔒 Private Event
                            </Typography>
                            <Typography variant="caption" style={{ color: COLORS.secondary, marginTop: 4 }}>
                                Only visible to invited friends
                            </Typography>
                        </View>
                    </TouchableOpacity>
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
    radioOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: SPACING.s,
        backgroundColor: COLORS.surfaceHighlight,
    },
    radioOptionSelected: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.surfaceHighlight, // optional: subtle tint
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
    spotsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.s,
        justifyContent: 'space-between',
    },
    spotOption: {
        width: '18%', 
        aspectRatio: 1,
        borderRadius: 8,
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.s,
    },
    spotOptionSelected: {
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accent,
    },
    spotText: {
        color: COLORS.primary,
    },
    spotTextSelected: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    typeOption: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    typeOptionSelected: {
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accent,
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
    iosPickerContainer: {
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 12,
        marginTop: SPACING.s,
        paddingBottom: SPACING.s,
        overflow: 'hidden',
    },
    doneButton: {
        alignSelf: 'flex-end',
        paddingVertical: SPACING.s,
        paddingHorizontal: SPACING.l,
    },
});

export default CreateEventScreen;
