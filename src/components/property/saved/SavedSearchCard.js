import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Typography from '../../Typography';
import NotionCard from '../../NotionCard';
import { COLORS, SPACING } from '../../../constants/theme';

function filterSummary(filters = {}) {
    const parts = [];
    if (filters.transactionType === 'rent') parts.push('Rent');
    else if (filters.transactionType === 'buy') parts.push('Buy');
    if (filters.bhk) parts.push(filters.bhk >= 5 ? '5+ BHK' : `${filters.bhk} BHK`);
    if (filters.subtype || filters.category) parts.push(filters.subtype || filters.category);
    return parts.join(' · ') || 'No extra filters';
}

function locationSummary(location = {}) {
    if (location.searchLabel) return location.searchLabel;
    if (location.mode === 'LOCALITY') return location.city ? `${location.city} · Area` : 'Saved area';
    if (location.mode === 'VIEWPORT') return location.city ? `${location.city} · Map area` : 'Map area';
    return location.city || 'City search';
}

const SavedSearchCard = ({ search, onOpen, onEdit, onToggleAlerts, onDelete }) => {
    const alertsOn = search?.alertEnabled === true;
    return (
        <NotionCard style={styles.card}>
            <TouchableOpacity
                onPress={onOpen}
                accessibilityRole="button"
                accessibilityLabel={`Open search ${search?.name}`}
            >
                <Typography variant="h3">{search?.name || 'Saved search'}</Typography>
                <Typography variant="caption" style={styles.meta}>{locationSummary(search?.location)}</Typography>
                <Typography variant="caption" style={styles.meta}>{filterSummary(search?.filters)}</Typography>
                <Typography variant="caption" style={styles.meta}>
                    {alertsOn ? 'Alerts on' : 'Alerts are off for this search'}
                </Typography>
            </TouchableOpacity>
            <View style={styles.actions}>
                <TouchableOpacity onPress={onOpen} accessibilityRole="button" accessibilityLabel="Open this search in Explore" style={styles.action}>
                    <Typography variant="caption" style={styles.link}>Open</Typography>
                </TouchableOpacity>
                <TouchableOpacity onPress={onEdit} accessibilityRole="button" accessibilityLabel="Edit saved search" style={styles.action}>
                    <Typography variant="caption" style={styles.link}>Edit</Typography>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={onToggleAlerts}
                    accessibilityRole="button"
                    accessibilityLabel={alertsOn ? 'Turn alerts off' : 'Turn alerts on'}
                    style={styles.action}
                >
                    <Typography variant="caption" style={styles.link}>{alertsOn ? 'Disable alerts' : 'Enable alerts'}</Typography>
                </TouchableOpacity>
                <TouchableOpacity onPress={onDelete} accessibilityRole="button" accessibilityLabel="Delete saved search" style={styles.action}>
                    <Typography variant="caption" style={styles.danger}>Delete</Typography>
                </TouchableOpacity>
            </View>
        </NotionCard>
    );
};

const styles = StyleSheet.create({
    card: { marginBottom: SPACING.m },
    meta: { color: COLORS.secondary, marginTop: 2, textTransform: 'none' },
    actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: SPACING.s },
    action: { minHeight: 44, justifyContent: 'center', marginRight: SPACING.m },
    link: { color: COLORS.accent, textTransform: 'none' },
    danger: { color: COLORS.secondary, textTransform: 'none' },
});

export default SavedSearchCard;
