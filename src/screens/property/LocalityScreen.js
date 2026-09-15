import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AntigravityButton from '../../components/AntigravityButton';
import LocalityEvidenceSection from '../../components/property/LocalityEvidenceSection';
import CrowwAreaScoreCard from '../../components/property/CrowwAreaScoreCard';
import { localityIntelligenceService, areaScoreService } from '../../services/intelligence';
import { useExplore } from '../../context/ExploreContext';
import { useAreaScorePreferences } from '../../context/AreaScorePreferencesContext';
import { viewportFromLocality } from '../../domain/intelligence';
import { buildLocalityViewModel } from '../../utils/localityIntelligenceView';
import { COLORS, SPACING } from '../../constants/theme';

const LocalityScreen = ({ route, navigation }) => {
    const localityId = route.params?.localityId || route.params?.id || null;
    const { focusLocality } = useExplore();
    const { weights, setWeights, resetWeights } = useAreaScorePreferences();
    const [locality, setLocality] = useState(null);
    const [snapshot, setSnapshot] = useState(null);
    const [loading, setLoading] = useState(!!localityId);

    const goBack = useCallback(() => {
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('Tabs', { screen: 'Explore' });
    }, [navigation]);

    useEffect(() => {
        let cancelled = false;
        if (!localityId) {
            setLoading(false);
            return undefined;
        }
        (async () => {
            try {
                const result = await localityIntelligenceService.loadPublic(localityId);
                if (!cancelled) {
                    setLocality(result.locality);
                    setSnapshot(result.snapshot);
                }
            } catch {
                if (!cancelled) {
                    setLocality(null);
                    setSnapshot(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [localityId]);

    const view = useMemo(() => buildLocalityViewModel(snapshot), [snapshot]);
    const scoreResult = useMemo(
        () => areaScoreService.calculate({
            snapshot,
            city: locality?.city || null,
            weights,
        }),
        [snapshot, locality?.city, weights]
    );
    const camera = useMemo(() => viewportFromLocality(locality), [locality]);
    const canExplore = !!camera;

    const openExplore = useCallback(() => {
        if (!locality || !camera) return;
        focusLocality({
            id: locality.id,
            city: locality.city,
            name: locality.name,
            viewport: camera,
        });
        navigation.navigate('Tabs', { screen: 'Explore' });
    }, [camera, focusLocality, locality, navigation]);

    const headline = locality?.name || 'Area';
    const place = [locality?.city, locality?.state].filter(Boolean).join(', ');

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={goBack}
                    style={styles.iconBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                >
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h3" style={styles.headerTitle}>Area</Typography>
                <View style={styles.iconBtn} />
            </View>
            <ScrollView contentContainerStyle={styles.body}>
                {loading ? <ActivityIndicator color={COLORS.accent} /> : null}
                <Typography variant="h1" accessibilityRole="header">{headline}</Typography>
                {place ? (
                    <Typography variant="body" style={styles.subtitle}>{place}</Typography>
                ) : null}
                {!loading && !locality ? (
                    <Typography variant="body" style={styles.subtitle}>
                        {localityId
                            ? 'This area is not in the Croww locality catalog, or it is not public. Intelligence is not invented for unknown areas.'
                            : 'Open this screen with a locality id.'}
                    </Typography>
                ) : null}

                {canExplore ? (
                    <View style={styles.actions}>
                        <AntigravityButton
                            title="Explore this area"
                            onPress={openExplore}
                            accessibilityLabel="Explore this area on the map"
                        />
                        <AntigravityButton
                            title="View properties in this area"
                            variant="secondary"
                            onPress={openExplore}
                            accessibilityLabel="View properties in this area"
                            style={styles.secondaryBtn}
                        />
                    </View>
                ) : null}

                {!loading ? (
                    <>
                        <CrowwAreaScoreCard
                            result={scoreResult}
                            weights={weights}
                            onChangeWeights={setWeights}
                            onResetWeights={resetWeights}
                        />
                        <LocalityEvidenceSection
                            title={view.market.title}
                            statusLabel={view.market.statusLabel}
                            footnote={view.market.footnote}
                            rows={view.market.rows}
                        />
                        <LocalityEvidenceSection
                            title={view.mobility.title}
                            statusLabel={view.mobility.statusLabel}
                            footnote={view.mobility.footnote}
                            rows={view.mobility.rows}
                        />
                        <LocalityEvidenceSection
                            title={view.essentials.title}
                            statusLabel={view.essentials.statusLabel}
                            footnote={view.essentials.footnote}
                            rows={view.essentials.rows}
                        />
                        <LocalityEvidenceSection
                            title={view.environment.title}
                            statusLabel={view.environment.statusLabel}
                            rows={view.environment.rows}
                        />
                        <LocalityEvidenceSection
                            title={view.notes.title}
                            rows={[
                                { label: 'Confidence', value: view.notes.confidenceLabel, meta: view.notes.sourceSummary },
                                { label: 'Freshness', value: view.notes.freshnessText, meta: view.notes.sampleHint },
                            ]}
                        />
                    </>
                ) : null}
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.s,
        minHeight: 48,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
    },
    iconBtn: {
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: {
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.s,
        paddingBottom: SPACING.xxl,
    },
    subtitle: {
        color: COLORS.secondary,
        marginTop: 4,
        marginBottom: SPACING.m,
    },
    actions: {
        marginBottom: SPACING.l,
        gap: SPACING.s,
    },
    secondaryBtn: {
        marginTop: 0,
    },
});

export default LocalityScreen;
