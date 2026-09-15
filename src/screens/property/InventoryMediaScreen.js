import React, { useCallback, useState } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    Image,
    RefreshControl,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AntigravityButton from '../../components/AntigravityButton';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { inventoryDashboardService } from '../../services/property';
import { inventoryErrorMessage } from '../../domain/property';
import { showAlert } from '../../utils/showAlert';

const InventoryMediaScreen = ({ route, navigation }) => {
    const listingId = route.params?.listingId || null;
    const [bundle, setBundle] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        if (!listingId) {
            setError('Listing not found');
            return;
        }
        setError('');
        try {
            const next = await inventoryDashboardService.loadPublicMedia(listingId);
            setBundle(next);
        } catch (err) {
            setBundle(null);
            setError(inventoryErrorMessage(err?.code, err?.message));
        }
    }, [listingId]);

    React.useEffect(() => {
        load();
    }, [load]);

    const goBack = () => {
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('InventoryDashboard');
    };

    const run = async (fn) => {
        setBusy(true);
        try {
            await fn();
            await load();
        } catch (err) {
            showAlert('Media', inventoryErrorMessage(err?.code, err?.message));
        } finally {
            setBusy(false);
        }
    };

    const addPhotos = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showAlert('Photos', 'Photo library permission is required to add listing photos.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.8,
        });
        if (result.canceled) return;
        const photos = (result.assets || []).map((asset, index) => ({
            uri: asset.uri,
            localId: `picked-${index}`,
        }));
        await run(() => inventoryDashboardService.addListingPhotos(listingId, photos));
    };

    const media = bundle?.media || [];

    const move = (index, direction) => {
        const next = [...media];
        const target = index + direction;
        if (target < 0 || target >= next.length) return;
        const [row] = next.splice(index, 1);
        next.splice(target, 0, row);
        run(() => inventoryDashboardService.reorderListingMedia(listingId, next.map((item) => item.id)));
    };

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={goBack} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Back">
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h3" style={styles.title}>Listing photos</Typography>
                <View style={styles.iconBtn} />
            </View>
            <ScrollView
                contentContainerStyle={styles.body}
                refreshControl={(
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={async () => {
                            setRefreshing(true);
                            await load();
                            setRefreshing(false);
                        }}
                        tintColor={COLORS.accent}
                    />
                )}
            >
                <Typography variant="caption" style={styles.muted}>
                    Public listing photos only. Ownership and verification documents are not shown here. 3D tours are separate media.
                </Typography>
                {error ? <Typography variant="body" style={styles.error}>{error}</Typography> : null}
                <AntigravityButton
                    title="Add photos"
                    icon="image-outline"
                    onPress={addPhotos}
                    disabled={busy || !listingId}
                    accessibilityLabel="Add photos"
                    style={styles.addBtn}
                />
                <AntigravityButton
                    title="3D tour"
                    variant="secondary"
                    onPress={() => navigation.navigate('SpatialTour', {
                        listingId,
                        propertyId: bundle?.listing?.propertyId || bundle?.property?.id,
                    })}
                    disabled={!listingId}
                    accessibilityLabel="Manage 3D tour"
                    style={styles.addBtn}
                />
                {busy ? <ActivityIndicator color={COLORS.accent} style={styles.spinner} /> : null}
                {media.length === 0 && !error ? (
                    <Typography variant="body" style={styles.muted}>No public photos yet.</Typography>
                ) : null}
                {media.map((item, index) => (
                    <View key={item.id} style={styles.row}>
                        <Image source={{ uri: item.thumbnailUrl || item.url }} style={styles.thumb} />
                        <View style={styles.rowText}>
                            <Typography variant="body">{index === 0 ? 'Cover' : `Photo ${index + 1}`}</Typography>
                            <View style={styles.rowActions}>
                                <TouchableOpacity
                                    onPress={() => run(() => inventoryDashboardService.setListingCover(listingId, item.id))}
                                    accessibilityRole="button"
                                    accessibilityLabel="Set as cover"
                                    disabled={busy || index === 0}
                                >
                                    <Typography variant="caption" style={styles.link}>Cover</Typography>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => move(index, -1)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Move photo earlier"
                                    disabled={busy || index === 0}
                                >
                                    <Typography variant="caption" style={styles.link}>Up</Typography>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => move(index, 1)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Move photo later"
                                    disabled={busy || index === media.length - 1}
                                >
                                    <Typography variant="caption" style={styles.link}>Down</Typography>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => showAlert('Hide photo', 'Hide this photo from the public gallery?', [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Confirm',
                                            onPress: () => run(() => inventoryDashboardService.hideListingMedia(listingId, item.id)),
                                        },
                                    ])}
                                    accessibilityRole="button"
                                    accessibilityLabel="Hide photo"
                                    disabled={busy}
                                >
                                    <Typography variant="caption" style={styles.danger}>Hide</Typography>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                ))}
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        paddingTop: SPACING.s,
    },
    title: {
        flex: 1,
        textAlign: 'center',
    },
    iconBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: {
        padding: SPACING.l,
        paddingBottom: SPACING.xl,
    },
    muted: {
        color: COLORS.secondary,
        marginBottom: SPACING.m,
    },
    addBtn: {
        marginBottom: SPACING.m,
    },
    spinner: {
        marginBottom: SPACING.m,
    },
    row: {
        flexDirection: 'row',
        gap: SPACING.m,
        marginBottom: SPACING.m,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.m,
        padding: SPACING.s,
    },
    thumb: {
        width: 72,
        height: 72,
        borderRadius: BORDER_RADIUS.s,
        backgroundColor: COLORS.surfaceHighlight,
    },
    rowText: {
        flex: 1,
        justifyContent: 'center',
    },
    rowActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.m,
        marginTop: SPACING.s,
    },
    link: {
        color: COLORS.accent,
    },
    danger: {
        color: COLORS.error,
    },
    error: {
        color: COLORS.error,
        marginBottom: SPACING.s,
    },
});

export default InventoryMediaScreen;
