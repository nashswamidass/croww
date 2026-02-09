import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionButton from '../../components/NotionButton';
import NotionCard from '../../components/NotionCard';
import GenderPreferenceSelector from '../../components/GenderPreferenceSelector';
import { SPACING, COLORS, BORDER_RADIUS } from '../../constants/theme';
import { createBuddyRequest } from '../../services/buddyService';
import { Ionicons } from '@expo/vector-icons';

const CreateBuddyRequestScreen = ({ route, navigation }) => {
    const { event } = route.params || {};
    const [spotsAvailable, setSpotsAvailable] = useState(2);
    const [genderPreference, setGenderPreference] = useState('any');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (spotsAvailable < 1) {
            Alert.alert('Invalid Spots', 'Please select at least 1 spot');
            return;
        }

        setLoading(true);
        try {
            const result = await createBuddyRequest(event.id, {
                spotsAvailable,
                genderPreference,
                message: message.trim()
            });

            if (result.success) {
                Alert.alert(
                    'Success!',
                    'Your buddy request has been created',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.goBack()
                        }
                    ]
                );
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to create buddy request');
        } finally {
            setLoading(false);
        }
    };

    const spotOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    return (
        <ScreenWrapper edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="close" size={28} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2">Create Buddy Request</Typography>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Event Info */}
                <NotionCard style={styles.eventCard}>
                    <Typography variant="caption" style={{ color: COLORS.secondary }}>
                        Event
                    </Typography>
                    <Typography variant="h3" style={{ marginTop: 4 }}>
                        {event?.title}
                    </Typography>
                    <Typography variant="small" style={{ color: COLORS.accent, marginTop: 4 }}>
                        {event?.date}
                    </Typography>
                </NotionCard>

                {/* Number of Spots */}
                <View style={styles.section}>
                    <Typography variant="body" style={styles.label}>
                        How many people can join?
                    </Typography>
                    <Typography variant="caption" style={styles.subtitle}>
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

                {/* Gender Preference */}
                <GenderPreferenceSelector
                    value={genderPreference}
                    onChange={setGenderPreference}
                />

                {/* Message */}
                <View style={styles.section}>
                    <Typography variant="body" style={styles.label}>
                        Message (Optional)
                    </Typography>
                    <Typography variant="caption" style={styles.subtitle}>
                        Tell people about your group or what you're looking for
                    </Typography>

                    <TextInput
                        style={styles.textInput}
                        placeholder="e.g., Looking for chill people to grab drinks with! 🍻"
                        placeholderTextColor={COLORS.secondary}
                        value={message}
                        onChangeText={setMessage}
                        multiline
                        maxLength={200}
                    />
                    <Typography variant="caption" style={styles.charCount}>
                        {message.length}/200
                    </Typography>
                </View>

                {/* Preview */}
                <View style={styles.section}>
                    <Typography variant="body" style={styles.label}>
                        Preview
                    </Typography>
                    <NotionCard style={styles.previewCard}>
                        <View style={styles.previewHeader}>
                            <View style={styles.previewAvatar} />
                            <Typography variant="body" style={{ fontWeight: '600' }}>
                                You
                            </Typography>
                        </View>
                        <View style={styles.previewSpots}>
                            <Ionicons name="people" size={16} color={COLORS.accent} />
                            <Typography variant="small" style={{ color: COLORS.accent, marginLeft: 4 }}>
                                0/{spotsAvailable} spots filled
                            </Typography>
                        </View>
                        {message && (
                            <Typography variant="small" style={{ color: COLORS.secondary, marginTop: SPACING.s }}>
                                "{message}"
                            </Typography>
                        )}
                    </NotionCard>
                </View>

                {/* Safety Notice */}
                <View style={styles.safetyNotice}>
                    <Ionicons name="shield-checkmark" size={20} color={COLORS.accent} />
                    <Typography variant="caption" style={styles.safetyText}>
                        Always meet in public places and let someone know where you're going. Stay safe!
                    </Typography>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Create Button */}
            <View style={styles.createButtonContainer}>
                <NotionButton
                    title="Create Buddy Request"
                    onPress={handleCreate}
                    loading={loading}
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
    eventCard: {
        padding: SPACING.m,
        marginBottom: SPACING.l,
    },
    section: {
        marginBottom: SPACING.l,
    },
    label: {
        fontWeight: '600',
        marginBottom: SPACING.xs,
    },
    subtitle: {
        color: COLORS.secondary,
        marginBottom: SPACING.m,
    },
    spotsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.s,
    },
    spotOption: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: COLORS.surface,
        borderWidth: 2,
        borderColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    spotOptionSelected: {
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accent + '20',
    },
    spotText: {
        color: COLORS.secondary,
        fontWeight: '600',
    },
    spotTextSelected: {
        color: COLORS.accent,
    },
    textInput: {
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.m,
        padding: SPACING.m,
        color: COLORS.primary,
        fontSize: 16,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    charCount: {
        textAlign: 'right',
        color: COLORS.secondary,
        marginTop: SPACING.xs,
    },
    previewCard: {
        padding: SPACING.m,
    },
    previewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.s,
    },
    previewAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.accent,
        marginRight: SPACING.s,
    },
    previewSpots: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    safetyNotice: {
        flexDirection: 'row',
        backgroundColor: COLORS.accent + '10',
        padding: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        gap: SPACING.s,
    },
    safetyText: {
        flex: 1,
        color: COLORS.accent,
        lineHeight: 18,
    },
    createButtonContainer: {
        position: 'absolute',
        bottom: 20,
        left: SPACING.m,
        right: SPACING.m,
    },
});

export default CreateBuddyRequestScreen;
