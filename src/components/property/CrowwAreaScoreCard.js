import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Typography from '../Typography';
import NotionCard from '../NotionCard';
import AreaScorePriorityEditor from './AreaScorePriorityEditor';
import { COLORS, SPACING } from '../../constants/theme';
import { buildAreaScoreViewModel } from '../../utils/areaScoreView';

const CrowwAreaScoreCard = ({
    result,
    weights,
    onChangeWeights,
    onResetWeights,
}) => {
    const view = buildAreaScoreViewModel(result);
    const [expanded, setExpanded] = useState(false);

    const accessibility = view.showNumeric
        ? `Croww Area Score ${view.score} out of 100. ${view.personalization}. ${view.coverageText}. ${view.confidenceText}.`
        : `${view.headline}. ${view.personalization}. ${view.coverageText}. ${view.confidenceText}.`;

    return (
        <NotionCard style={styles.card} accessibilityRole="summary" accessibilityLabel={accessibility}>
            <Typography variant="caption" style={styles.kicker}>Croww Area Score</Typography>
            {view.showNumeric ? (
                <View style={styles.scoreRow} accessible accessibilityLabel={`${view.score} out of 100`}>
                    <Typography variant="h1">{view.score}</Typography>
                    <Typography variant="h3" style={styles.over}> / 100</Typography>
                </View>
            ) : (
                <Typography variant="h3" accessibilityRole="header">{view.headline}</Typography>
            )}
            <Typography variant="body" style={styles.personal}>{view.personalization}</Typography>
            <Typography variant="caption" style={styles.meta}>{view.coverageText}</Typography>
            <Typography variant="caption" style={styles.meta}>{view.confidenceText}</Typography>

            <TouchableOpacity
                onPress={() => setExpanded((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={expanded ? 'Hide score breakdown' : 'Why this score'}
                style={styles.why}
            >
                <Typography variant="caption" style={styles.whyText}>
                    {expanded ? 'Hide breakdown' : 'Why this score'}
                </Typography>
            </TouchableOpacity>

            {expanded ? (
                <View>
                    {view.dimensions.map((dim) => (
                        <View
                            key={dim.id}
                            style={styles.dim}
                            accessible
                            accessibilityLabel={`${dim.label}: ${dim.scoreText}. ${dim.priorityText}. ${dim.statusText || ''} ${dim.summary}`}
                        >
                            <Typography variant="body">{dim.label}</Typography>
                            <Typography variant="caption" style={styles.meta}>
                                {dim.scoreText}
                                {' · '}
                                {dim.priorityText}
                                {dim.statusText ? ` · ${dim.statusText}` : ''}
                            </Typography>
                            {dim.contributionText ? (
                                <Typography variant="caption" style={styles.meta}>{dim.contributionText}</Typography>
                            ) : null}
                            <Typography variant="caption" style={styles.summary}>{dim.summary}</Typography>
                        </View>
                    ))}
                    {view.notes.map((note) => (
                        <Typography key={note} variant="caption" style={styles.note}>{note}</Typography>
                    ))}
                    {view.methodologyVersion ? (
                        <Typography variant="caption" style={styles.note}>
                            Methodology {view.methodologyVersion}
                        </Typography>
                    ) : null}
                </View>
            ) : null}

            {onChangeWeights ? (
                <AreaScorePriorityEditor
                    weights={weights}
                    onChange={onChangeWeights}
                    onReset={onResetWeights}
                />
            ) : null}
        </NotionCard>
    );
};

const styles = StyleSheet.create({
    card: {
        marginBottom: SPACING.m,
    },
    kicker: {
        color: COLORS.secondary,
        textTransform: 'none',
        marginBottom: 4,
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    over: {
        color: COLORS.secondary,
    },
    personal: {
        marginTop: SPACING.s,
    },
    meta: {
        color: COLORS.secondary,
        marginTop: 2,
        textTransform: 'none',
    },
    why: {
        minHeight: 44,
        justifyContent: 'center',
        marginTop: SPACING.s,
    },
    whyText: {
        color: COLORS.accent,
        textTransform: 'none',
    },
    dim: {
        marginTop: SPACING.m,
        paddingTop: SPACING.s,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.border,
    },
    summary: {
        color: COLORS.secondary,
        marginTop: 2,
        textTransform: 'none',
    },
    note: {
        color: COLORS.secondary,
        marginTop: SPACING.s,
        textTransform: 'none',
    },
});

export default CrowwAreaScoreCard;
