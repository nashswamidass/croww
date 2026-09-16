import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import CrowwRive from './CrowwRive';
import { SUCCESS_RIVE_SPEC } from './specs/success.spec';
import Typography from '../Typography';
import { COLORS, SPACING, SHADOWS, BORDER_RADIUS } from '../../constants/theme';

/**
 * Priority #6: Compact Contextual Success Notification
 * 
 * Non-disruptive, floating pill/toast confirmation for saved items, location requests,
 * and listing submissions.
 */
export const CrowwSuccessNotification = ({
    visible = false,
    title = 'Saved',
    subtitle,
    onDismiss,
    autoHideDuration = 2500,
    style,
}) => {
    const [animOpacity] = useState(new Animated.Value(0));

    useEffect(() => {
        if (visible) {
            Animated.timing(animOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();

            if (autoHideDuration > 0 && onDismiss) {
                const timer = setTimeout(() => {
                    Animated.timing(animOpacity, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                    }).start(() => onDismiss());
                }, autoHideDuration);
                return () => clearTimeout(timer);
            }
        } else {
            animOpacity.setValue(0);
        }
    }, [visible, autoHideDuration, onDismiss, animOpacity]);

    if (!visible) return null;

    return (
        <Animated.View style={[styles.toast, { opacity: animOpacity }, style]}>
            <CrowwRive
                artboard={SUCCESS_RIVE_SPEC.artboard}
                artboardName={SUCCESS_RIVE_SPEC.artboard}
                stateMachineName={SUCCESS_RIVE_SPEC.stateMachine}
                inputs={{ triggerSuccess: 'trigger' }}
                fallbackType="success"
                fallbackSize={28}
                style={{ width: 28, height: 28 }}
            />
            <View style={styles.textWrap}>
                <Typography variant="bodyMedium" style={styles.title}>
                    {title}
                </Typography>
                {subtitle ? (
                    <Typography variant="caption" style={styles.subtitle}>
                        {subtitle}
                    </Typography>
                ) : null}
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    toast: {
        position: 'absolute',
        bottom: 84,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.circle,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: 10,
        paddingHorizontal: SPACING.l,
        gap: SPACING.s,
        ...SHADOWS.floating,
        zIndex: 9999,
        elevation: 8,
    },
    textWrap: {
        justifyContent: 'center',
    },
    title: {
        fontWeight: '700',
        color: COLORS.primary,
    },
    subtitle: {
        color: COLORS.secondary,
        fontSize: 11,
    },
});

export default CrowwSuccessNotification;
