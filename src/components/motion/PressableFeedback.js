import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { MOTION_TIMINGS, MOTION_EASING } from '../../constants/motion';
import { TOUCH_TARGETS } from '../../constants/theme';

/**
 * Native-driver micro-press feedback container.
 * Gives immediate tactile response without waiting for JS thread re-renders.
 */
export const PressableFeedback = ({
    children,
    onPress,
    onLongPress,
    disabled = false,
    scaleTo = 0.975,
    style,
    hitSlop = TOUCH_TARGETS.hitSlop,
    accessibilityRole = 'button',
    accessibilityLabel,
    ...props
}) => {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        if (disabled) return;
        Animated.timing(scale, {
            toValue: scaleTo,
            duration: MOTION_TIMINGS.interaction,
            easing: MOTION_EASING.press,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        if (disabled) return;
        Animated.timing(scale, {
            toValue: 1,
            duration: MOTION_TIMINGS.fast,
            easing: MOTION_EASING.decelerate,
            useNativeDriver: true,
        }).start();
    };

    return (
        <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled}
            hitSlop={hitSlop}
            accessibilityRole={accessibilityRole}
            accessibilityLabel={accessibilityLabel}
            style={({ pressed }) => [styles.wrapper, typeof style === 'function' ? style({ pressed }) : style]}
            {...props}
        >
            <Animated.View style={[styles.inner, { transform: [{ scale }] }]}>
                {children}
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        overflow: 'visible',
    },
    inner: {
        width: '100%',
    },
});

export default PressableFeedback;
