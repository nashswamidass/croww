import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Modal, FlatList, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from './Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { COUNTRY_CODES, getCountryByCallingCode } from '../constants/countryCodes';

const PhoneInput = ({ label, value, onChangeText, placeholder = '98765 43210' }) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [country, setCountry] = useState(COUNTRY_CODES[0]); // Default to India
    const [phoneNumber, setPhoneNumber] = useState('');

    useEffect(() => {
        if (value) {
            // Try to split value like "+919876543210"
            const foundCountry = COUNTRY_CODES.find(c => value.startsWith(c.callingCode));
            if (foundCountry) {
                setCountry(foundCountry);
                setPhoneNumber(value.replace(foundCountry.callingCode, ''));
            } else {
                setPhoneNumber(value);
            }
        }
    }, [value]);

    const handlePhoneChange = (text) => {
        // Sanitize: only numbers
        const cleaned = text.replace(/\D/g, '');
        setPhoneNumber(cleaned);
        onChangeText(`${country.callingCode}${cleaned}`);
    };

    const selectCountry = (item) => {
        setCountry(item);
        onChangeText(`${item.callingCode}${phoneNumber}`);
        setModalVisible(false);
    };

    return (
        <View style={styles.container}>
            {label && <Typography variant="body" style={styles.label}>{label}</Typography>}

            <View style={styles.inputContainer}>
                <TouchableOpacity
                    style={styles.countrySelector}
                    onPress={() => setModalVisible(true)}
                >
                    <Typography variant="body" style={styles.flag}>{country.flag}</Typography>
                    <Typography variant="body" style={styles.callingCode}>{country.callingCode}</Typography>
                    <Ionicons name="chevron-down" size={14} color={COLORS.secondary} />
                </TouchableOpacity>

                <TextInput
                    style={styles.input}
                    value={phoneNumber}
                    onChangeText={handlePhoneChange}
                    placeholder={placeholder}
                    placeholderTextColor={COLORS.secondary}
                    keyboardType="phone-pad"
                    maxLength={country.length}
                />
            </View>

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={false}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                        <Typography variant="h2">Select Country</Typography>
                        <View style={{ width: 40 }} />
                    </View>

                    <FlatList
                        data={COUNTRY_CODES}
                        keyExtractor={(item) => item.code}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.countryItem}
                                onPress={() => selectCountry(item)}
                            >
                                <Typography variant="h3" style={styles.itemFlag}>{item.flag}</Typography>
                                <View style={styles.itemInfo}>
                                    <Typography variant="body" style={styles.itemName}>{item.name}</Typography>
                                    <Typography variant="caption" style={styles.itemCode}>{item.callingCode}</Typography>
                                </View>
                                {country.code === item.code && (
                                    <Ionicons name="checkmark" size={20} color={COLORS.accent} />
                                )}
                            </TouchableOpacity>
                        )}
                    />
                </SafeAreaView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: SPACING.m,
    },
    label: {
        fontWeight: '600',
        marginBottom: SPACING.s,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.m,
        overflow: 'hidden',
    },
    countrySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.m,
        borderRightWidth: 1,
        borderRightColor: COLORS.border,
        backgroundColor: COLORS.surfaceHighlight,
    },
    flag: {
        fontSize: 20,
        marginRight: 4,
    },
    callingCode: {
        marginRight: 4,
        fontWeight: '600',
    },
    input: {
        flex: 1,
        padding: SPACING.m,
        color: COLORS.primary,
        fontSize: 16,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    closeButton: {
        padding: 4,
    },
    countryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    itemFlag: {
        marginRight: SPACING.m,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontWeight: '500',
    },
    itemCode: {
        color: COLORS.secondary,
        marginTop: 2,
    },
});

export default PhoneInput;
