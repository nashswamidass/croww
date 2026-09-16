import React, { createContext, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

const RiveMotionContext = createContext({
    isReduceMotionEnabled: false,
    animationsEnabled: true,
    setAnimationsEnabled: () => {},
});

export const RiveMotionProvider = ({ children }) => {
    const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);
    const [animationsEnabled, setAnimationsEnabled] = useState(true);

    useEffect(() => {
        let isMounted = true;

        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            setIsReduceMotionEnabled(mediaQuery.matches);

            const handler = (e) => {
                if (isMounted) setIsReduceMotionEnabled(e.matches);
            };

            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener('change', handler);
            } else if (mediaQuery.addListener) {
                mediaQuery.addListener(handler);
            }

            return () => {
                isMounted = false;
                if (mediaQuery.removeEventListener) {
                    mediaQuery.removeEventListener('change', handler);
                } else if (mediaQuery.removeListener) {
                    mediaQuery.removeListener(handler);
                }
            };
        }

        // Native iOS / Android accessibility check
        AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
            if (isMounted) setIsReduceMotionEnabled(enabled);
        }).catch(() => {
            if (isMounted) setIsReduceMotionEnabled(false);
        });

        const subscription = AccessibilityInfo.addEventListener(
            'reduceMotionChanged',
            (enabled) => {
                if (isMounted) setIsReduceMotionEnabled(enabled);
            }
        );

        return () => {
            isMounted = false;
            if (subscription && subscription.remove) {
                subscription.remove();
            }
        };
    }, []);

    const effectiveAnimationsEnabled = animationsEnabled && !isReduceMotionEnabled;

    return (
        <RiveMotionContext.Provider
            value={{
                isReduceMotionEnabled,
                animationsEnabled: effectiveAnimationsEnabled,
                setAnimationsEnabled,
            }}
        >
            {children}
        </RiveMotionContext.Provider>
    );
};

export const useRiveMotion = () => useContext(RiveMotionContext);

export default RiveMotionContext;
