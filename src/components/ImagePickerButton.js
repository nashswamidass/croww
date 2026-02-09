import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Typography from './Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

const ImagePickerButton = ({ onImageSelected, currentImage, label = "Event Image", aspectRatio = [16, 9] }) => {
    const [image, setImage] = useState(currentImage);

    const pickImage = async () => {
        // Request permissions
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please allow access to your photo library to selection images.');
            return;
        }

        // Launch image picker
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: aspectRatio,
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            const selectedImage = result.assets[0].uri;
            setImage(selectedImage);
            onImageSelected(selectedImage);
        }
    };

    return (
        <View style={styles.container}>
            {label && <Typography variant="body" style={styles.label}>{label}</Typography>}

            <TouchableOpacity
                style={styles.imageContainer}
                onPress={pickImage}
                activeOpacity={0.8}
            >
                {image ? (
                    <>
                        <Image source={{ uri: image }} style={styles.image} />
                        <View style={styles.overlay}>
                            <Ionicons name="camera" size={24} color={COLORS.primary} />
                            <Typography variant="small" style={{ color: COLORS.primary, marginTop: 4 }}>
                                Change {label.replace(' Photo', '').replace(' Picture', '')}
                            </Typography>
                        </View>
                    </>
                ) : (
                    <View style={styles.placeholder}>
                        <Ionicons name="image-outline" size={48} color={COLORS.secondary} />
                        <Typography variant="body" style={{ color: COLORS.secondary, marginTop: SPACING.s }}>
                            Tap to add {label.toLowerCase()}
                        </Typography>
                    </View>
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: SPACING.l,
    },
    label: {
        marginBottom: SPACING.s,
        color: COLORS.primary,
        fontWeight: '600',
    },
    imageContainer: {
        width: '100%',
        height: 200,
        borderRadius: BORDER_RADIUS.m,
        overflow: 'hidden',
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderStyle: 'dashed',
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: 0,
    },
    placeholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default ImagePickerButton;
