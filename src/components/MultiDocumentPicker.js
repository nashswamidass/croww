import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from './Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { showAlert } from '../utils/showAlert';

// Lazy-load native pickers to avoid crashing on web
let ImagePicker = null;
let DocumentPicker = null;
if (Platform.OS !== 'web') {
    try { ImagePicker = require('expo-image-picker'); } catch (e) {}
    try { DocumentPicker = require('expo-document-picker'); } catch (e) {}
}

const MultiDocumentPicker = ({
    onDocumentsChange,
    initialDocuments = [],
    maxDocuments = 3,
    label = "Verification Documents"
}) => {
    const [documents, setDocuments] = useState(initialDocuments);
    // Hidden file input ref for web
    const fileInputRef = useRef(null);

    const addDocuments = (newDocs) => {
        const updated = [...documents, ...newDocs].slice(0, maxDocuments);
        setDocuments(updated);
        onDocumentsChange(updated);
    };

    // ── WEB: handle file input change ────────────────────────────────────────
    const handleWebFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        const remaining = maxDocuments - documents.length;
        const toAdd = files.slice(0, remaining).map(file => ({
            uri: URL.createObjectURL(file),
            name: file.name,
            type: file.type.includes('pdf') ? 'pdf' : 'image',
            mimeType: file.type,
            // Keep original File object for direct upload on web
            _webFile: file,
        }));

        addDocuments(toAdd);
        // Reset so same file can be picked again if removed
        e.target.value = '';
    };

    // ── NATIVE: image picker ──────────────────────────────────────────────────
    const pickImageNative = async () => {
        if (!ImagePicker) return;
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showAlert('Permission Required', 'Please allow access to your photo library.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.8,
        });
        if (!result.canceled && result.assets?.length) {
            const toAdd = result.assets.map(a => ({
                uri: a.uri,
                name: a.fileName || `image_${Date.now()}.jpg`,
                type: 'image',
                mimeType: 'image/jpeg',
            }));
            addDocuments(toAdd);
        }
    };

    // ── NATIVE: document picker ───────────────────────────────────────────────
    const pickDocumentNative = async () => {
        if (!DocumentPicker) {
            showAlert('Not Available', 'Please use "Image from Gallery" instead.');
            return;
        }
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true,
                multiple: true,
            });
            if (!result.canceled && result.assets?.length) {
                const toAdd = result.assets.map(a => ({
                    uri: a.uri,
                    name: a.name,
                    type: a.mimeType?.includes('pdf') ? 'pdf' : 'image',
                    mimeType: a.mimeType || 'application/octet-stream',
                }));
                addDocuments(toAdd);
            }
        } catch (err) {
            showAlert('Error', 'Failed to pick document.');
        }
    };

    const handleAddPress = () => {
        if (Platform.OS === 'web') {
            // Trigger hidden file input
            fileInputRef.current?.click();
            return;
        }
        showAlert('Add Document', 'Choose document type', [
            { text: 'Image from Gallery', onPress: pickImageNative },
            DocumentPicker ? { text: 'PDF or Image File', onPress: pickDocumentNative } : null,
            { text: 'Cancel', style: 'cancel' },
        ].filter(Boolean));
    };

    const removeDocument = (index) => {
        const newDocs = documents.filter((_, i) => i !== index);
        setDocuments(newDocs);
        onDocumentsChange(newDocs);
    };

    return (
        <View style={styles.container}>
            {/* Hidden native file input for web */}
            {Platform.OS === 'web' && (
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleWebFileChange}
                />
            )}

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
                                    <Ionicons name="document-text" size={28} color={COLORS.accent} />
                                    <Typography variant="caption" style={styles.pdfLabel}>PDF</Typography>
                                </View>
                            )}
                        </View>
                        <View style={styles.docInfo}>
                            <Typography variant="caption" numberOfLines={1} style={styles.docName}>
                                {doc.name}
                            </Typography>
                            <Typography variant="caption" style={{ color: COLORS.secondary, fontSize: 10 }}>
                                {doc.type === 'pdf' ? 'PDF Document' : 'Image'}
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
                        <Ionicons name="cloud-upload-outline" size={32} color={COLORS.accent} />
                        <Typography variant="caption" style={{ color: COLORS.accent, marginTop: 6, fontWeight: '600' }}>
                            {Platform.OS === 'web' ? 'Click to Upload (Image or PDF)' : 'Add Document'}
                        </Typography>
                        <Typography variant="caption" style={{ color: COLORS.secondary, fontSize: 10, marginTop: 2 }}>
                            Up to {maxDocuments} files
                        </Typography>
                    </TouchableOpacity>
                )}
            </View>

            {documents.length === 0 && (
                <Typography variant="caption" style={styles.placeholderText}>
                    Upload business registration certificate, GST certificate, or trade license.
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
        width: 52,
        height: 52,
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
        marginTop: -2,
    },
    docInfo: {
        flex: 1,
        marginLeft: SPACING.m,
    },
    docName: {
        color: COLORS.primary,
        fontWeight: '500',
    },
    removeButton: {
        padding: 4,
    },
    addButton: {
        minHeight: 90,
        borderWidth: 1.5,
        borderColor: COLORS.accent + '60',
        borderStyle: 'dashed',
        borderRadius: BORDER_RADIUS.m,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.accent + '08',
        marginTop: SPACING.s,
        padding: SPACING.m,
    },
    placeholderText: {
        color: COLORS.secondary,
        textAlign: 'center',
        marginTop: SPACING.s,
        fontStyle: 'italic',
        fontSize: 11,
    },
});

export default MultiDocumentPicker;
