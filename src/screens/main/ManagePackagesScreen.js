import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionInput from '../../components/NotionInput';
import AntigravityButton from '../../components/AntigravityButton';
import NotionCard from '../../components/NotionCard';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { userService } from '../../services/userService';

const ManagePackagesScreen = ({ navigation }) => {
    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);

    // Form State
    const [isAdding, setIsAdding] = useState(false);
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');
    const [features, setFeatures] = useState(''); // Comma separated for MVP

    useEffect(() => {
        loadPackages();
    }, []);

    const loadPackages = async () => {
        try {
            const user = await userService.getUser();
            if (user) {
                setUserId(user.id);
                setPackages(user.packages || []);
            }
        } catch (error) {
            console.error("Error loading packages:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddPackage = async () => {
        if (!title.trim() || !price.trim()) {
            Alert.alert("Missing Information", "Please enter a title and price.");
            return;
        }

        try {
            const packageData = {
                title,
                price: parseFloat(price),
                description,
                features: features.split(',').map(f => f.trim()).filter(f => f)
            };

            const newPackage = await userService.addPackage(userId, packageData);
            if (newPackage) {
                setPackages([...packages, newPackage]);
                setIsAdding(false);
                resetForm();
                Alert.alert("Success", "Package added successfully!");
            }
        } catch (error) {
            Alert.alert("Error", "Failed to add package.");
        }
    };

    const handleDeletePackage = async (packageId) => {
        Alert.alert(
            "Delete Package",
            "Are you sure you want to delete this package?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const success = await userService.removePackage(userId, packageId);
                            if (success) {
                                setPackages(packages.filter(p => p.id !== packageId));
                            }
                        } catch (error) {
                            Alert.alert("Error", "Failed to delete package.");
                        }
                    }
                }
            ]
        );
    };

    const resetForm = () => {
        setTitle('');
        setPrice('');
        setDescription('');
        setFeatures('');
    };

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2">Manage Packages</Typography>
                <TouchableOpacity onPress={() => setIsAdding(!isAdding)}>
                    <Ionicons name={isAdding ? "close" : "add"} size={28} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {isAdding && (
                    <NotionCard style={styles.formCard}>
                        <Typography variant="h3" style={{ marginBottom: SPACING.m }}>
                            New Package
                        </Typography>
                        <NotionInput
                            label="Package Title"
                            placeholder="e.g., Gold Wedding Package"
                            value={title}
                            onChangeText={setTitle}
                        />
                        <NotionInput
                            label="Price (₹)"
                            placeholder="e.g., 50000"
                            value={price}
                            onChangeText={setPrice}
                            keyboardType="numeric"
                        />
                        <NotionInput
                            label="Description"
                            placeholder="Brief description of what's included"
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={3}
                            style={{ height: 80 }}
                        />
                        <NotionInput
                            label="Features (comma separated)"
                            placeholder="e.g., 4 Hours, Lighting, MC"
                            value={features}
                            onChangeText={setFeatures}
                        />
                        <AntigravityButton
                            title="Save Package"
                            onPress={handleAddPackage}
                            style={{ marginTop: SPACING.m }}
                        />
                    </NotionCard>
                )}

                <Typography variant="h3" style={{ marginVertical: SPACING.m }}>
                    Your Packages
                </Typography>

                {packages.length === 0 ? (
                    <Typography variant="body" color={COLORS.secondary} style={{ textAlign: 'center', marginTop: SPACING.xl }}>
                        No packages created yet. Tap + to add one.
                    </Typography>
                ) : (
                    packages.map((pkg) => (
                        <NotionCard key={pkg.id} style={styles.packageCard}>
                            <View style={styles.packageHeader}>
                                <View style={{ flex: 1 }}>
                                    <Typography variant="h3">{pkg.title}</Typography>
                                    <Typography variant="h2" color={COLORS.accent} style={{ marginTop: 4 }}>
                                        ₹{pkg.price.toLocaleString()}
                                    </Typography>
                                </View>
                                <TouchableOpacity onPress={() => handleDeletePackage(pkg.id)}>
                                    <Ionicons name="trash-outline" size={24} color={COLORS.error || '#FF5252'} />
                                </TouchableOpacity>
                            </View>
                            {pkg.description ? (
                                <Typography variant="body" color={COLORS.secondary} style={{ marginTop: SPACING.s }}>
                                    {pkg.description}
                                </Typography>
                            ) : null}
                            <View style={styles.featuresList}>
                                {pkg.features && pkg.features.map((feature, index) => (
                                    <View key={index} style={styles.featureItem}>
                                        <Ionicons name="checkmark" size={16} color={COLORS.success || '#4CAF50'} />
                                        <Typography variant="caption" style={{ marginLeft: 4 }}>{feature}</Typography>
                                    </View>
                                ))}
                            </View>
                        </NotionCard>
                    ))
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    content: {
        padding: SPACING.m,
        paddingBottom: SPACING.xl,
    },
    formCard: {
        marginBottom: SPACING.l,
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    packageCard: {
        marginBottom: SPACING.m,
    },
    packageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    featuresList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: SPACING.m,
        gap: SPACING.s,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    }
});

export default ManagePackagesScreen;
