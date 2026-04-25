import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import * as Sentry from '@sentry/react-native';

Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '', // Add your DSN to .env
    debug: __DEV__,
    tracesSampleRate: 1.0,
});

import { AuthProvider } from './src/context/AuthContext';
import { HelmetProvider } from 'react-helmet-async';
import AppDownloadPopup from './src/components/AppDownloadPopup';

function App() {
    return (
        <HelmetProvider>
            <SafeAreaProvider>
                <AuthProvider>
                    <AppNavigator />
                    <AppDownloadPopup />
                </AuthProvider>
            </SafeAreaProvider>
        </HelmetProvider>
    );
}

export default Sentry.wrap(App);
