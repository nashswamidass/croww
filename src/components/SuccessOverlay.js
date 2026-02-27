import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    withTiming,
    Easing,
    useAnimatedStyle
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import Typography from './Typography';
import { COLORS } from '../constants/theme';

const { width } = Dimensions.get('window');

const SuccessOverlay = ({ visible, onAnimationComplete }) => {
    const lottieRef = useRef(null);
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            opacity.value = withTiming(1, { duration: 300 });
            scale.value = withTiming(1, {
                duration: 600,
                easing: Easing.bezier(0.175, 0.885, 0.32, 1.275)
            });

            // Play lottie animation
            if (lottieRef.current) {
                lottieRef.current.play();
            }

            const timer = setTimeout(() => {
                onAnimationComplete?.();
            }, 3000); // Extended slightly for Lottie duration

            return () => clearTimeout(timer);
        } else {
            scale.value = 0;
            opacity.value = 0;
            if (lottieRef.current) {
                lottieRef.current.reset();
            }
        }
    }, [visible]);

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const containerStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    if (!visible && opacity.value === 0) return null;

    return (
        <View style={[StyleSheet.absoluteFill, styles.overlayContainer]}>
            <Animated.View style={[styles.backdrop, backdropStyle]} />
            <View style={styles.container}>
                <Animated.View style={[styles.card, containerStyle]}>
                    <View style={styles.animationContainer}>
                        <LottieView
                            ref={lottieRef}
                            source={{ uri: 'https://lottie.host/7833a697-3d14-4903-a1df-b153b8b0e854/uG4u9GqN5I.json' }}
                            style={styles.lottie}
                            autoPlay={false}
                            loop={false}
                        />
                    </View>
                    <Typography variant="h2" style={styles.title}>Payment Successful!</Typography>
                    <Typography variant="body" style={styles.subtitle}>Issuing your tickets...</Typography>
                </Animated.View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlayContainer: {
        zIndex: 9999,
        elevation: 10,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    card: {
        backgroundColor: COLORS.surface,
        padding: 40,
        borderRadius: 24,
        alignItems: 'center',
        width: Math.min(width * 0.8, 400),
        borderWidth: 1,
        borderColor: COLORS.border,
        elevation: 10,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
    },
    animationContainer: {
        width: 150,
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lottie: {
        width: '100%',
        height: '100%',
    },
    title: {
        marginTop: 12,
        textAlign: 'center',
    },
    subtitle: {
        marginTop: 8,
        color: COLORS.secondary,
        textAlign: 'center',
    },
});

export default SuccessOverlay;
