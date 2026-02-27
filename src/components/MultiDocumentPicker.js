import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Typography from './Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

// Lazy-load DocumentPicker to avoid crashing in Expo Go
let DocumentPicker = null;
try {
    DocumentPicker = require('expo-document-picker');
} catch (e) {
    console.warn('expo-document-picker not available:', e.message);
}

const MultiDocumentPicker = ({
    onDocumentsChange,
    initialDocuments = [],
    maxDocuments = 3,
    label = "Verification Documents"
}) => {
    const [documents, setDocuments] = useState(initialDocuments);

    useEffect(() => {
        onDocumentsChange(documents);
    }, [documents]);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please allow access to your photo library to select images.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            const newDoc = {
                uri: result.assets[0].uri,
                name: result.assets[0].fileName || `image_${Date.now()}.jpg`,
                type: 'image'
            };
            setDocuments([...documents, newDoc]);
        }
    };

    const pickDocument = async () => {
        if (!DocumentPicker) {
            Alert.alert('Not Available', 'PDF picking is not available in Expo Go. Please use "Image from Gallery" instead, or use a development build.');
            return;
        }
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets[0]) {
                const newDoc = {
                    uri: result.assets[0].uri,
                    name: result.assets[0].name,
                    type: result.assets[0].mimeType?.includes('pdf') ? 'pdf' : 'image'
                };
                setDocuments([...documents, newDoc]);
            }
        } catch (err) {
            console.error('Error picking document:', err);
            Alert.alert('Error', 'Failed to pick document');
        }
    };

    const handleAddPress = () => {
        const options = [
            { text: 'Image from Gallery', onPress: pickImage },
        ];
        if (DocumentPicker) {
            options.push({ text: 'PDF or Image File', onPress: pickDocument });
        }
        options.push({ text: 'Cancel', style: 'cancel' });

        Alert.alert('Add Document', 'Choose document type', options);
    };


    const removeDocument = (index) => {
        const newDocs = [...documents];
        newDocs.splice(index, 1);
        setDocuments(newDocs);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Typography variant="body" style={styles.label}>{label}</Typography>
                <Typography variant="caption" style={{ color: COLORS.secondary }}>
                    {documents.length} / {maxDocuments}
                </Typography>
            </View>

            <View style={styles.docList}>
                {documents.map((doc, index) => (
                    <View key={index} style={styles.docItem}>
                        <View style={styles.docPreview}>
                            {doc.type === 'image' ? (
                                <Image source={{ uri: doc.uri }} style={styles.previewImage} />
                            ) : (
                                <View style={styles.pdfPlaceholder}>
                                    <Ionicons name="document-text" size={32} color={COLORS.accent} />
                                    <Typography variant="caption" style={styles.pdfLabel}>PDF</Typography>
                                </View>
                            )}
                        </View>
                        <View style={styles.docInfo}>
                            <Typography variant="caption" numberOfLines={1} style={styles.docName}>
                                {doc.name}
                            </Typography>
                        </View>
                        <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => removeDocument(index)}
                        >
                            <Ionicons name="close-circle" size={24} color="#FF4D4D" />
                        </TouchableOpacity>
                    </View>
                ))}

                {documents.length < maxDocuments && (
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={handleAddPress}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="add-circle-outline" size={32} color={COLORS.accent} />
                        <Typography variant="caption" style={{ color: COLORS.accent, marginTop: 4 }}>
                            Add Document
                        </Typography>
                    </TouchableOpacity>
                )}
            </View>

            {documents.length === 0 && (
                <Typography variant="caption" style={styles.placeholderText}>
                    Upload up to 3 documents (Images or PDFs) for verification.
                </Typography>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: SPACING.l,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.s,
    },
    label: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    docList: {
        gap: SPACING.s,
    },
    docItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: BORDER_RADIUS.s,
        padding: SPACING.s,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    docPreview: {
        width: 50,
        height: 50,
        borderRadius: BORDER_RADIUS.s,
        overflow: 'hidden',
        backgroundColor: COLORS.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    pdfPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    pdfLabel: {
        fontSize: 8,
        color: COLORS.accent,
        fontWeight: 'bold',
        marginTop: -4,
    },
    docInfo: {
        flex: 1,
        marginLeft: SPACING.m,
    },
    docName: {
        color: COLORS.primary,
    },
    removeButton: {
        padding: 4,
    },
    addButton: {
        height: 80,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderStyle: 'dashed',
        borderRadius: BORDER_RADIUS.s,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        marginTop: SPACING.s,
    },
    placeholderText: {
        color: COLORS.secondary,
        textAlign: 'center',
        marginTop: SPACING.s,
        fontStyle: 'italic',
    },
});

export default MultiDocumentPicker;
