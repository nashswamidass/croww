import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { MOTION_TIMINGS, MOTION_EASING } from '../../constants/motion';

/**
 * High-performance UI-thread animated container for screen/card entry.
 */
export const MotionView = ({
    children,
    delay = 0,
    duration = MOTION_TIMINGS.standard,
    slideDistance = 12,
    fadeOnly = false,
    style,
    ...props
}) => {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(slideDistance)).current;

    useEffect(() => {
        const animations = [
            Animated.timing(opacity, {
                toValue: 1,
                duration,
                delay,
                easing: MOTION_EASING.decelerate,
                useNativeDriver: true,
            }),
        ];

        if (!fadeOnly) {
            animations.push(
                Animated.timing(translateY, {
                    toValue: 0,
                    duration,
                    delay,
                    easing: MOTION_EASING.emphasized,
                    useNativeDriver: true,
                })
            );
        }

        Animated.parallel(animations).start();
    }, [delay, duration, fadeOnly, opacity, slideDistance, translateY]);

    return (
        <Animated.View
            style={[
                style,
                {
                    opacity,
                    transform: fadeOnly ? [] : [{ translateY }],
                },
            ]}
            {...props}
        >
            {children}
        </Animated.View>
    );
};

export default MotionView;
