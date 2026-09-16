import React from 'react';
import { View, StyleSheet } from 'react-native';
import CrowwRive from './CrowwRive';
import { LOCATION_SHARE_RIVE_SPEC } from './specs/locationShare.spec';
import Typography from '../Typography';
import { COLORS } from '../../constants/theme';

/**
 * Priority #3: Exact Location Request & Access State Machine
 * 
 * Maps backend shareStatus & precision to Rive state machine:
 *   0: idle (approximate location)
 *   1: requesting (in-flight request)
 *   2: pending (awaiting owner approval)
 *   3: approved (exact coordinates unlocked)
 *   4: declined (owner declined)
 *   5: revoked (owner revoked)
 */
export const CrowwLocationShareState = ({
    shareStatus = 'NONE',
    precision = 'approximate',
    isExactShared = false,
    isRequesting = false,
    size = 28,
    showLabel = true,
    style,
}) => {
    // Determine canonical state number
    let statusCode = 0; // idle
    let label = 'Approximate';
    let textColor = COLORS.secondary;

    const isExact = isExactShared || precision === 'exact';

    if (isExact) {
        statusCode = 3; // approved
        label = 'Exact location';
        textColor = COLORS.success;
    } else if (isRequesting) {
        statusCode = 1; // requesting
        label = 'Submitting request...';
        textColor = COLORS.accent;
    } else if (shareStatus === 'PENDING') {
        statusCode = 2; // pending
        label = 'Pending approval';
        textColor = COLORS.accent;
    } else if (shareStatus === 'DECLINED') {
        statusCode = 4; // declined
        label = 'Declined';
        textColor = COLORS.secondary;
    } else if (shareStatus === 'REVOKED') {
        statusCode = 5; // revoked
        label = 'Access revoked';
        textColor = COLORS.secondary;
    }

    const inputs = {
        status: statusCode,
        triggerRequest: isRequesting ? 'trigger' : undefined,
    };

    return (
        <View style={[styles.container, style]}>
            <CrowwRive
                artboard={LOCATION_SHARE_RIVE_SPEC.artboard}
                artboardName={LOCATION_SHARE_RIVE_SPEC.artboard}
                stateMachineName={LOCATION_SHARE_RIVE_SPEC.stateMachine}
                inputs={inputs}
                fallbackType="location-share"
                fallbackState={{ status: statusCode }}
                fallbackSize={size}
                style={{ width: size, height: size }}
            />
            {showLabel ? (
                <Typography variant="micro" style={[styles.label, { color: textColor }]}>
                    {label}
                </Typography>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    label: {
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});

export default CrowwLocationShareState;
