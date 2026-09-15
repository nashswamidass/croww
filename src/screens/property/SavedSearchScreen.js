import React, { useMemo, useState } from 'react';
import { View, TextInput, Switch, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import { Ionicons } from '@expo/vector-icons';
import { savedSearchService } from '../../services/property';
import { useExplore } from '../../context/ExploreContext';
import { showAlert } from '../../utils/showAlert';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';

const SavedSearchScreen = ({ route, navigation }) => {
    const incoming = route.params?.search || null;
    const searchId = route.params?.searchId || incoming?.id;
    const { applySavedSearch, city, localityId, searchLocation, viewport, filters } = useExplore();
    const [name, setName] = useState(incoming?.name || '');
    const [alerts, setAlerts] = useState(incoming?.alertEnabled === true);

    const summary = useMemo(() => {
        const loc = incoming?.location || {};
        const f = incoming?.filters || {};
        return [
            loc.searchLabel || loc.city,
            f.transactionType === 'rent' ? 'Rent' : f.transactionType === 'buy' ? 'Buy' : null,
            f.bhk ? (f.bhk >= 5 ? '5+ BHK' : `${f.bhk} BHK`) : null,
        ].filter(Boolean).join(' · ');
    }, [incoming]);

    const goBack = () => {
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('Tabs', { screen: 'Saved' });
    };

    const saveMeta = async () => {
        try {
            await savedSearchService.update(searchId, { name, alertEnabled: alerts });
            showAlert('Saved search', 'Updated.');
            navigation.navigate('Tabs', { screen: 'Saved' });
        } catch (error) {
            showAlert('Saved search', error?.message || 'Could not update.');
        }
    };

    const openExplore = () => {
        if (incoming) applySavedSearch(incoming);
        navigation.navigate('Tabs', { screen: 'Explore' });
    };

    const replaceFromExplore = async () => {
        try {
            const result = await savedSearchService.replaceWithExplore(searchId, {
                city,
                localityId,
                searchLocation,
                viewport,
                filters,
                name,
                alertEnabled: alerts,
            });
            if (result.status === 'duplicate') {
                showAlert('Saved search', 'Current Explore filters already match another saved search.');
                return;
            }
            showAlert('Saved search', 'Criteria updated from Explore.');
            navigation.navigate('Tabs', { screen: 'Saved' });
        } catch (error) {
            showAlert('Saved search', error?.message || 'Could not update criteria.');
        }
    };

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={goBack} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Back">
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h3" style={styles.title}>Saved search</Typography>
                <View style={styles.iconBtn} />
            </View>
            <ScrollView contentContainerStyle={styles.body}>
                <Typography variant="caption" style={styles.meta}>{summary}</Typography>
                <TextInput
                    value={name}
                    onChangeText={setName}
                    style={styles.input}
                    accessibilityLabel="Search name"
                    maxLength={80}
                />
                <View style={styles.row}>
                    <Typography variant="body">Alerts</Typography>
                    <Switch value={alerts} onValueChange={setAlerts} accessibilityLabel="Enable search alerts" />
                </View>
                <TouchableOpacity onPress={saveMeta} style={styles.action} accessibilityRole="button" accessibilityLabel="Save name and alerts">
                    <Typography variant="body" style={styles.link}>Save name and alerts</Typography>
                </TouchableOpacity>
                <TouchableOpacity onPress={openExplore} style={styles.action} accessibilityRole="button" accessibilityLabel="Open in Explore">
                    <Typography variant="body" style={styles.link}>Open in Explore</Typography>
                </TouchableOpacity>
                <TouchableOpacity onPress={replaceFromExplore} style={styles.action} accessibilityRole="button" accessibilityLabel="Replace criteria from current Explore filters">
                    <Typography variant="body" style={styles.link}>Replace with current Explore filters</Typography>
                </TouchableOpacity>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: SPACING.s },
    title: { flex: 1, textAlign: 'center' },
    iconBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    body: { padding: SPACING.l },
    meta: { color: COLORS.secondary, marginBottom: SPACING.m, textTransform: 'none' },
    input: {
        minHeight: 44,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.m,
        paddingHorizontal: SPACING.m,
        color: COLORS.primary,
    },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginTop: SPACING.m },
    action: { minHeight: 44, justifyContent: 'center', marginTop: SPACING.s },
    link: { color: COLORS.accent },
});

export default SavedSearchScreen;
