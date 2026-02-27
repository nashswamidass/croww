import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import AntigravityButton from '../../components/AntigravityButton';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { userService } from '../../services/userService';

const ManageStaffScreen = ({ navigation }) => {
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState('');
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const user = await userService.getUser();
            if (user) {
                setCurrentUser(user);
                // Fetch fresh data from Firestore to ensure we have latest staff
                const freshUser = await userService.getUserById(user.id);
                setStaff(freshUser?.staff || []);
            }
        } catch (error) {
            console.error("Error loading staff:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddStaff = async () => {
        if (!newName || !newRole) {
            Alert.alert("Error", "Please enter both name and role.");
            return;
        }

        try {
            setAdding(true);
            const newMember = await userService.addStaff(currentUser.id, {
                name: newName,
                role: newRole
            });

            if (newMember) {
                setStaff([...staff, newMember]);
                setNewName('');
                setNewRole('');
                Alert.alert("Success", "Staff member added successfully.");
            }
        } catch (error) {
            Alert.alert("Error", "Failed to add staff member.");
        } finally {
            setAdding(false);
        }
    };

    const handleRemoveStaff = (staffId, staffName) => {
        Alert.alert(
            "Remove Staff",
            `Are you sure you want to remove ${staffName}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const success = await userService.removeStaff(currentUser.id, staffId);
                            if (success) {
                                setStaff(staff.filter(s => s.id !== staffId));
                            }
                        } catch (error) {
                            Alert.alert("Error", "Failed to remove staff member.");
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2">Manage Staff</Typography>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Add Staff Form */}
                <NotionCard style={styles.addCard}>
                    <Typography variant="h3" style={styles.cardTitle}>Add Staff Member</Typography>
                    <TextInput
                        style={styles.input}
                        placeholder="Full Name"
                        value={newName}
                        onChangeText={setNewName}
                        placeholderTextColor={COLORS.secondary}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Role (e.g. Manager, DJ, Security)"
                        value={newRole}
                        onChangeText={setNewRole}
                        placeholderTextColor={COLORS.secondary}
                    />
                    <AntigravityButton
                        title={adding ? "Adding..." : "Add Member"}
                        onPress={handleAddStaff}
                        disabled={adding}
                    />
                </NotionCard>

                {/* Staff List */}
                <Typography variant="h3" style={styles.sectionTitle}>Current Staff</Typography>
                {staff.length === 0 ? (
                    <Typography variant="body" color={COLORS.secondary} style={styles.emptyText}>
                        No staff members added yet.
                    </Typography>
                ) : (
                    staff.map((item) => (
                        <NotionCard key={item.id} style={styles.staffCard}>
                            <View style={styles.staffInfo}>
                                <Typography variant="body" style={{ fontWeight: '600' }}>{item.name}</Typography>
                                <Typography variant="caption" color={COLORS.secondary}>{item.role}</Typography>
                            </View>
                            <TouchableOpacity onPress={() => handleRemoveStaff(item.id, item.name)}>
                                <Ionicons name="trash-outline" size={20} color={COLORS.error || '#FF5252'} />
                            </TouchableOpacity>
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
    backButton: {
        padding: 4,
    },
    content: {
        padding: SPACING.m,
    },
    addCard: {
        padding: SPACING.m,
        marginBottom: SPACING.l,
    },
    cardTitle: {
        marginBottom: SPACING.m,
    },
    input: {
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 12,
        padding: SPACING.m,
        marginBottom: SPACING.m,
        color: COLORS.primary,
        fontSize: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    sectionTitle: {
        marginBottom: SPACING.m,
    },
    staffCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.m,
        marginBottom: SPACING.s,
    },
    staffInfo: {
        flex: 1,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: SPACING.l,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});

export default ManageStaffScreen;
