import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Typography from '../Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { actorRoleLabel } from '../../utils/propertyDetailView';

const ListingActorCard = ({ role, actor }) => {
    const roleText = actorRoleLabel(role);
    if (!roleText && !actor) return null;
    const name = actor?.displayName || null;

    return (
        <View style={styles.wrap} accessibilityLabel={roleText || 'Listing contact'}>
            <Typography variant="h3" style={styles.heading}>Listed by</Typography>
            <View style={styles.row}>
                {actor?.photoURL ? (
                    <Image source={{ uri: actor.photoURL }} style={styles.avatar} />
                ) : (
                    <View style={styles.avatarFallback} />
                )}
                <View style={styles.body}>
                    {name ? <Typography variant="body" style={styles.name}>{name}</Typography> : null}
                    {roleText ? (
                        <Typography variant="caption" style={styles.role}>{roleText}</Typography>
                    ) : null}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.l,
    },
    heading: {
        marginBottom: SPACING.m,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.m,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.m,
        gap: SPACING.m,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.surfaceHighlight,
    },
    avatarFallback: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.surfaceHighlight,
    },
    body: {
        flex: 1,
    },
    name: {
        fontWeight: '600',
    },
    role: {
        color: COLORS.secondary,
        marginTop: 2,
        textTransform: 'none',
    },
});

export default ListingActorCard;
