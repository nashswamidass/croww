import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { HelmetProvider } from 'react-helmet-async';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import AppDownloadPopup from './src/components/AppDownloadPopup';
import ProductionPreviewBanner from './src/components/ProductionPreviewBanner';
import { RiveMotionProvider } from './src/components/rive/RiveMotionContext';

if (process.env.EXPO_PUBLIC_APP_ENV === 'production-preview') {
    console.warn(
        '[CROWW PRODUCTION PREVIEW] Connected to live Firebase project: croww-live-2026 (871336486604). Do NOT make destructive changes.'
    );
}

Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '', // Add your DSN to .env
    debug: __DEV__,
    tracesSampleRate: 1.0,
});

function App() {
    const [fontsLoaded] = useFonts({
        ...Ionicons.font,
        ...MaterialCommunityIcons.font,
    });

    if (!fontsLoaded) {
        return null;
    }

    return (
        <HelmetProvider>
            <SafeAreaProvider>
                <AuthProvider>
                    <RiveMotionProvider>
                        <ProductionPreviewBanner />
                        <AppNavigator />
                        <AppDownloadPopup />
                    </RiveMotionProvider>
                </AuthProvider>
            </SafeAreaProvider>
        </HelmetProvider>
    );
}

export default Sentry.wrap(App);
