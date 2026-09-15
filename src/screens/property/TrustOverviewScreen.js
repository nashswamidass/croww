import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import NotionCard from '../../components/NotionCard';
import AntigravityButton from '../../components/AntigravityButton';
import { COLORS, SPACING } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { getPropertyRoles } from '../../navigation/propertyCapabilities';
import { propertyTrustService } from '../../services/property';
import { effectiveVerificationStatus } from '../../domain/verification';

function statusLabel(slice) {
    const status = effectiveVerificationStatus(slice);
    if (status === 'VERIFIED') return 'Verified';
    if (status === 'PENDING') return 'Pending';
    if (status === 'REJECTED') return 'Not approved';
    if (status === 'EXPIRED') return 'Expired';
    return 'Not verified';
}

const TrustOverviewScreen = ({ navigation }) => {
    const { user } = useAuth();
    const roles = getPropertyRoles(user);
    const [identity, setIdentity] = useState(null);
    const [cases, setCases] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const [id, mine] = await Promise.all([
                propertyTrustService.loadIdentity(),
                propertyTrustService.listMyCases().catch(() => []),
            ]);
            setIdentity(id);
            setCases(mine);
        } catch {
            setIdentity(null);
            setCases([]);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        load();
    }, [load]));

    const trust = useMemo(() => propertyTrustService.publicActorTrustFromUser(user), [user]);
    const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Tabs', { screen: 'Profile' }));

    const rows = [
        { key: 'identity', title: 'Identity', status: identity?.identity || trust.identity, kyc: true },
        roles.includes('owner') ? { key: 'owner', title: 'Owner', status: trust.owner } : null,
        roles.includes('agent') ? { key: 'agent', title: 'Agent', status: trust.agent } : null,
        roles.includes('builder') ? { key: 'builder', title: 'Builder', status: trust.builder } : null,
    ].filter(Boolean);

    return (
        <ScreenWrapper edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={goBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconBtn}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h3" style={styles.title}>Verification</Typography>
                <View style={styles.iconBtn} />
            </View>
            <ScrollView
                contentContainerStyle={styles.body}
                refreshControl={(
                    <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={COLORS.accent} />
                )}
            >
                <Typography variant="body" style={styles.muted}>
                    Croww reviews evidence. A verified identity is not proof of ownership, and a role is not a verified agent or builder.
                </Typography>
                {rows.map((row) => (
                    <NotionCard key={row.key} style={styles.card}>
                        <Typography variant="h3">{row.title}</Typography>
                        <Typography variant="caption" style={styles.muted}>{statusLabel(row.status)}</Typography>
                        {row.kyc ? (
                            <AntigravityButton
                                title="Verify identity"
                                variant="secondary"
                                style={styles.btn}
                                onPress={() => navigation.navigate(user?.userType === 'business' ? 'BusinessVerification' : 'VerifyIdentity')}
                                accessibilityLabel="Open identity verification"
                            />
                        ) : (
                            <AntigravityButton
                                title="Submit evidence"
                                variant="secondary"
                                style={styles.btn}
                                onPress={() => navigation.navigate('SubmitVerification', {
                                    type: row.key === 'owner' ? 'OWNER' : row.key === 'agent' ? 'AGENT' : 'BUILDER',
                                    subjectId: user?.id || user?.uid,
                                    evidenceType: row.key === 'builder' ? 'COMPANY_DOCUMENT' : 'OTHER',
                                })}
                                accessibilityLabel={`Submit ${row.title} verification`}
                            />
                        )}
                    </NotionCard>
                ))}
                {cases.length ? (
                    <Typography variant="caption" style={styles.muted}>Recent submissions</Typography>
                ) : null}
                {cases.map((row) => (
                    <Typography key={row.id} variant="caption" style={styles.muted}>
                        {row.type} · {row.status}
                    </Typography>
                ))}
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.m, paddingTop: SPACING.s },
    title: { flex: 1, textAlign: 'center' },
    iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    body: { padding: SPACING.l, paddingBottom: SPACING.xl },
    muted: { color: COLORS.secondary, marginBottom: SPACING.m },
    card: { marginBottom: SPACING.m },
    btn: { marginTop: SPACING.m },
});

export default TrustOverviewScreen;
