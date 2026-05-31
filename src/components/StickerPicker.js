import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, StyleSheet, TextInput, TouchableOpacity,
    FlatList, ActivityIndicator, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Typography from './Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

// Tenor v1 — demo key documented at api.tenor.com (v2 requires a Google Cloud key)
const TENOR_KEY        = 'LIVDSRZULELA';
const TENOR_CLIENT_KEY = 'croww_app';
const TENOR_BASE       = 'https://api.tenor.com/v1';

const CATEGORIES = [
    { label: '🔥 Trending',  query: null },
    { label: '🎉 Party',     query: 'party celebration' },
    { label: '💃 Dance',     query: 'dance groove' },
    { label: '❤️ Love',     query: 'love heart' },
    { label: '😂 LOL',      query: 'funny haha' },
    { label: '🏆 Winner',   query: 'winner trophy' },
    { label: '👏 Clap',     query: 'clapping applause' },
    { label: '😎 Cool',     query: 'cool swag' },
    { label: '🚀 Hype',     query: 'hype excited' },
    { label: '✨ Magic',    query: 'magic sparkle' },
];

const fetchStickers = async (query, limit = 24) => {
    // Tenor v1 — media_filter=minimal gives only gif/tinygif/mp4 (smaller payload)
    const params = new URLSearchParams({
        key:          TENOR_KEY,
        client_key:   TENOR_CLIENT_KEY,
        limit:        String(limit),
        media_filter: 'minimal',
        contentfilter: 'medium',
        locale:       'en_US',
    });

    const endpoint = query ? 'search' : 'trending';
    const url = query
        ? `${TENOR_BASE}/${endpoint}?${params}&q=${encodeURIComponent(query)}`
        : `${TENOR_BASE}/${endpoint}?${params}`;

    const res  = await fetch(url);
    if (!res.ok) throw new Error(`Tenor ${res.status}: ${await res.text()}`);
    const json = await res.json();

    // v1 response: results[].media is an ARRAY of format objects
    return (json.results || []).map(g => {
        const media = Array.isArray(g.media) ? g.media[0] : g.media;
        const fmt   = media?.tinygif || media?.gif;
        return {
            id:     g.id,
            url:    fmt?.url,
            width:  fmt?.dims?.[0] || 200,
            height: fmt?.dims?.[1] || 200,
        };
    }).filter(g => g.url);
};

const StickerPicker = ({ onSend, style }) => {
    const [activeCat, setActiveCat]     = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [stickers, setStickers]       = useState([]);
    const [loading, setLoading]         = useState(false);
    const [error, setError]             = useState(null);
    const debounceRef = useRef(null);

    const load = useCallback(async (query) => {
        setLoading(true);
        setError(null);
        setStickers([]);
        try {
            const results = await fetchStickers(query);
            setStickers(results);
        } catch (e) {
            console.warn('Tenor error:', e);
            setError('Could not load stickers. Check your connection.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Load on category change
    useEffect(() => {
        if (searchQuery.trim()) return;
        load(CATEGORIES[activeCat].query);
    }, [activeCat]);

    // Debounced search
    useEffect(() => {
        if (!searchQuery.trim()) {
            load(CATEGORIES[activeCat].query);
            return;
        }
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            load(searchQuery.trim());
        }, 450);
        return () => clearTimeout(debounceRef.current);
    }, [searchQuery]);

    const renderSticker = ({ item }) => {
        const aspect = item.height / (item.width || 1);
        const cellW  = 108;
        const cellH  = Math.min(Math.round(cellW * aspect), 130);
        return (
            <TouchableOpacity
                style={[styles.stickerCell, { height: Math.max(cellH, 80) }]}
                onPress={() => onSend(item.url)}
                activeOpacity={0.75}
            >
                <Image
                    source={{ uri: item.url }}
                    style={styles.stickerImg}
                    contentFit="contain"
                    autoplay
                    cachePolicy="memory-disk"
                />
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, style]}>
            {/* Search bar */}
            <View style={styles.searchRow}>
                <Ionicons name="search" size={16} color={COLORS.secondary} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search GIFs & stickers..."
                    placeholderTextColor={COLORS.secondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity
                        onPress={() => setSearchQuery('')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="close-circle" size={16} color={COLORS.secondary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Category chips */}
            {!searchQuery.trim() && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.catRow}
                    contentContainerStyle={styles.catRowContent}
                >
                    {CATEGORIES.map((cat, idx) => (
                        <TouchableOpacity
                            key={idx}
                            style={[styles.catChip, activeCat === idx && styles.catChipActive]}
                            onPress={() => setActiveCat(idx)}
                        >
                            <Typography
                                style={[styles.catChipText, activeCat === idx && styles.catChipTextActive]}
                            >
                                {cat.label}
                            </Typography>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* Grid / states */}
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={COLORS.accent} size="large" />
                    <Typography variant="caption" style={{ color: COLORS.secondary, marginTop: 8 }}>
                        Loading stickers...
                    </Typography>
                </View>
            ) : error ? (
                <View style={styles.centered}>
                    <Typography style={{ fontSize: 36 }}>😶‍🌫️</Typography>
                    <Typography variant="caption" style={{ color: COLORS.secondary, marginTop: 8, textAlign: 'center' }}>
                        {error}
                    </Typography>
                    <TouchableOpacity
                        style={styles.retryBtn}
                        onPress={() => load(searchQuery.trim() || CATEGORIES[activeCat].query)}
                    >
                        <Typography style={styles.retryText}>Retry</Typography>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    style={{ flex: 1 }}
                    data={stickers}
                    renderItem={renderSticker}
                    keyExtractor={item => item.id}
                    numColumns={3}
                    contentContainerStyle={styles.grid}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <Typography style={{ fontSize: 36 }}>🔍</Typography>
                            <Typography variant="caption" style={{ color: COLORS.secondary, marginTop: 8 }}>
                                No results found
                            </Typography>
                        </View>
                    }
                />
            )}

            {/* Tenor attribution — required by Tenor ToS */}
            <View style={styles.attribution}>
                <Typography style={styles.attributionText}>Powered by Tenor</Typography>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: BORDER_RADIUS.m,
        marginHorizontal: SPACING.m,
        marginTop: SPACING.s,
        marginBottom: SPACING.xs,
        paddingHorizontal: SPACING.s,
        borderWidth: 1,
        borderColor: COLORS.border,
        height: 38,
    },
    searchIcon: {
        marginRight: 6,
    },
    searchInput: {
        flex: 1,
        color: COLORS.primary,
        fontSize: 13,
        height: '100%',
    },
    catRow: {
        height: 38,
        minHeight: 38,
        maxHeight: 38,
        marginBottom: SPACING.xs,
    },
    catRowContent: {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'center',
        paddingHorizontal: SPACING.s,
    },
    catChip: {
        paddingHorizontal: SPACING.m,
        paddingVertical: 6,
        borderRadius: 20,
        marginRight: SPACING.xs,
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    catChipActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    catChipText: {
        fontSize: 12,
        color: COLORS.secondary,
        fontWeight: '600',
    },
    catChipTextActive: {
        color: COLORS.background,
    },
    grid: {
        paddingHorizontal: SPACING.xs,
        paddingBottom: SPACING.xs,
    },
    stickerCell: {
        flex: 1,
        margin: 3,
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: BORDER_RADIUS.s,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    stickerImg: {
        width: '100%',
        height: '100%',
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.xl,
    },
    retryBtn: {
        marginTop: SPACING.s,
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.xs,
        backgroundColor: COLORS.accent,
        borderRadius: BORDER_RADIUS.m,
    },
    retryText: {
        color: COLORS.background,
        fontWeight: '700',
        fontSize: 13,
    },
    attribution: {
        alignItems: 'center',
        paddingVertical: 4,
    },
    attributionText: {
        fontSize: 9,
        color: COLORS.secondary,
        opacity: 0.6,
        letterSpacing: 0.5,
    },
});

export default StickerPicker;
