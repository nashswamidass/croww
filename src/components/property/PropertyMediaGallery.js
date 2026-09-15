import React, { useMemo, useState } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    Pressable,
    useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import Typography from '../Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';

const GALLERY_TYPES = { photo: 'Photo', floor_plan: 'Floor plan', video: 'Video' };

const PropertyMediaGallery = ({ media = [] }) => {
    const { width, height } = useWindowDimensions();
    const items = Array.isArray(media) ? media : [];
    const [index, setIndex] = useState(0);
    const [open, setOpen] = useState(false);
    const heroHeight = Math.min(320, Math.max(220, Math.round(width * 0.62)));
    const current = items[index] || null;

    const heroUri = useMemo(() => {
        if (!current) return null;
        return current.thumbnailUrl || current.url || null;
    }, [current]);

    if (!items.length) {
        return (
            <View
                style={[styles.empty, { height: heroHeight }]}
                accessibilityRole="image"
                accessibilityLabel="No photos for this listing"
            >
                <Ionicons name="image-outline" size={36} color={COLORS.secondary} />
                <Typography variant="body" style={styles.emptyText}>No photos yet</Typography>
            </View>
        );
    }

    const openCurrent = () => {
        if (current?.mediaType === 'video' && current.url) {
            Linking.openURL(current.url).catch(() => {});
            return;
        }
        setOpen(true);
    };

    return (
        <View>
            <TouchableOpacity
                onPress={openCurrent}
                activeOpacity={0.92}
                accessibilityRole="image"
                accessibilityLabel={current?.mediaType === 'video' ? 'Play listing video' : 'Open listing photo'}
            >
                {heroUri ? (
                    <Image
                        source={{ uri: heroUri }}
                        style={{ width: '100%', height: heroHeight }}
                        contentFit="cover"
                    />
                ) : (
                    <View style={[styles.empty, { height: heroHeight }]}>
                        <Ionicons name="image-outline" size={36} color={COLORS.secondary} />
                    </View>
                )}
                {current?.mediaType === 'video' ? (
                    <View style={styles.playWrap} pointerEvents="none">
                        <View style={styles.playBadge}>
                            <Ionicons name="play" size={28} color={COLORS.background} />
                        </View>
                    </View>
                ) : null}
                <View style={styles.countBadge} pointerEvents="none">
                    <Typography variant="caption" style={styles.countText}>
                        {index + 1} / {items.length}
                    </Typography>
                </View>
            </TouchableOpacity>

            {items.length > 1 ? (
                <FlatList
                    data={items}
                    horizontal
                    keyExtractor={(item) => item.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.thumbs}
                    renderItem={({ item, index: thumbIndex }) => {
                        const uri = item.thumbnailUrl || item.url;
                        const selected = thumbIndex === index;
                        return (
                            <TouchableOpacity
                                onPress={() => setIndex(thumbIndex)}
                                style={[styles.thumb, selected && styles.thumbOn]}
                                accessibilityRole="button"
                                accessibilityLabel={`${GALLERY_TYPES[item.mediaType] || 'Photo'} ${thumbIndex + 1} of ${items.length}`}
                            >
                                {uri ? (
                                    <Image source={{ uri }} style={styles.thumbImage} contentFit="cover" />
                                ) : (
                                    <View style={styles.thumbFallback}>
                                        <Ionicons name="image-outline" size={16} color={COLORS.secondary} />
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    }}
                />
            ) : null}

            <Modal visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
                <View style={[styles.modal, { paddingTop: 48, minHeight: height }]}>
                    <Pressable
                        onPress={() => setOpen(false)}
                        style={styles.close}
                        accessibilityRole="button"
                        accessibilityLabel="Close photo"
                    >
                        <Ionicons name="close" size={28} color={COLORS.primary} />
                    </Pressable>
                    {current?.url || current?.thumbnailUrl ? (
                        <Image
                            source={{ uri: current.url || current.thumbnailUrl }}
                            style={styles.full}
                            contentFit="contain"
                            accessibilityLabel="Full-size listing photo"
                        />
                    ) : null}
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    empty: {
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.s,
    },
    emptyText: {
        color: COLORS.secondary,
    },
    playWrap: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playBadge: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    countBadge: {
        position: 'absolute',
        right: SPACING.m,
        bottom: SPACING.m,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: SPACING.s,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.s,
    },
    countText: {
        color: COLORS.primary,
    },
    thumbs: {
        paddingHorizontal: SPACING.l,
        paddingVertical: SPACING.s,
        gap: SPACING.s,
    },
    thumb: {
        width: 64,
        height: 64,
        borderRadius: BORDER_RADIUS.s,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
        marginRight: SPACING.s,
    },
    thumbOn: {
        borderColor: COLORS.accent,
    },
    thumbImage: {
        width: '100%',
        height: '100%',
    },
    thumbFallback: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surfaceHighlight,
    },
    modal: {
        flex: 1,
        backgroundColor: '#000',
    },
    close: {
        position: 'absolute',
        top: 48,
        right: SPACING.l,
        zIndex: 2,
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    full: {
        flex: 1,
        width: '100%',
    },
});

export default PropertyMediaGallery;
