import { Easing } from 'react-native';

/**
 * Croww Centralized Motion System
 *
 * Rules:
 * - Interaction feedback: 100–180ms
 * - Standard content transition: 180–280ms
 * - Larger modal/sheet transition: 250–350ms
 * - Avoid animations longer than 400ms
 * - Native / UI-thread driven animations exclusively (useNativeDriver: true)
 */

export const MOTION_TIMINGS = {
    instant: 80,
    interaction: 120,
    fast: 180,
    standard: 240,
    sheet: 290,
    modal: 320,
};

export const MOTION_EASING = {
    // Material 3 / Apple fluid decelerate
    emphasized: Easing.bezier(0.2, 0.0, 0, 1.0),
    // Incoming elements
    decelerate: Easing.out(Easing.cubic),
    // Exiting elements
    accelerate: Easing.in(Easing.cubic),
    // Shared continuous motion
    standard: Easing.bezier(0.4, 0.0, 0.2, 1.0),
    // Micro-interactions
    press: Easing.bezier(0.25, 1, 0.5, 1),
};

export const SPRING_CONFIGS = {
    subtlePress: {
        tension: 300,
        friction: 20,
        useNativeDriver: true,
    },
    sheetSlide: {
        tension: 180,
        friction: 22,
        useNativeDriver: true,
    },
    bubblePop: {
        tension: 240,
        friction: 14,
        useNativeDriver: true,
    },
};
