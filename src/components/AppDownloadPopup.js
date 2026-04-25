import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';
import Typography from './Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const IS_WEB = Platform.OS === 'web';
const POPUP_DISMISSED_KEY = '@croww_app_download_dismissed';

const AppDownloadPopup = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [isMobileWeb, setIsMobileWeb] = useState(false);

    useEffect(() => {
        if (!IS_WEB) return;

        const checkMobile = () => {
            const userAgent = window.navigator.userAgent || window.navigator.vendor || window.opera;
            const isMobileDevice = /android|ipad|playbook|silk|iphone|ipod/i.test(userAgent);
            setIsMobileWeb(isMobileDevice);
        };

        const checkDismissed = async () => {
            try {
                const dismissed = await AsyncStorage.getItem(POPUP_DISMISSED_KEY);
                if (!dismissed) {
                    setIsVisible(true);
                }
            } catch (error) {
                console.error('Error checking popup state:', error);
                setIsVisible(true);
            }
        };

        checkMobile();
        checkDismissed();
    }, []);

    if (!IS_WEB || !isMobileWeb || !isVisible) return null;

    const handleDismiss = async () => {
        setIsVisible(false);
        try {
            await AsyncStorage.setItem(POPUP_DISMISSED_KEY, 'true');
        } catch (error) {
            console.error('Error saving dismiss state:', error);
        }
    };

    const handleOpenApp = () => {
        const userAgent = window.navigator.userAgent || window.navigator.vendor || window.opera;
        const isIOS = /ipad|iphone|ipod/i.test(userAgent);
        const isAndroid = /android/i.test(userAgent);

        if (isAndroid) {
            // Android Intent URI opens the app if installed, or falls back to Play Store
            const intentUri = 'intent://#Intent;scheme=crowwapp;package=com.croww.app;S.browser_fallback_url=https://play.google.com/store/apps/details?id=com.croww.app;end';
            window.location.href = intentUri;
        } else if (isIOS) {
            // For iOS, try custom scheme, then fallback
            const appScheme = 'crowwapp://';
            const storeLink = 'https://apps.apple.com/in/app/croww-no-more-boring-nights/id6759898911';
            
            // Set a timeout to go to the store
            const start = Date.now();
            setTimeout(() => {
                if (Date.now() - start < 2000) {
                    window.location.href = storeLink;
                }
            }, 1500);
            
            window.location.href = appScheme;
        } else {
            // Fallback
            window.location.href = 'https://play.google.com/store/apps/details?id=com.croww.app';
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
                <Ionicons name="close" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
            
            <View style={styles.content}>
                <Image 
                    source={require('../../assets/app-icon.png')} 
                    style={styles.icon}
                />
                <View style={styles.textContainer}>
                    <Typography variant="body" style={{ fontWeight: 'bold' }}>
                        Croww App
                    </Typography>
                    <Typography variant="caption" color={COLORS.secondary}>
                        Faster and better experience
                    </Typography>
                </View>
                <TouchableOpacity style={styles.openButton} onPress={handleOpenApp}>
                    <Typography variant="body" color={COLORS.background} style={{ fontWeight: 'bold' }}>
                        OPEN
                    </Typography>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        zIndex: 9999,
        paddingTop: 10,
        paddingBottom: 10,
        paddingHorizontal: SPACING.m,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
        ...(Platform.OS === 'web' && { position: 'fixed' })
    },
    closeButton: {
        position: 'absolute',
        left: 10,
        top: '50%',
        marginTop: -5,
        zIndex: 2,
        padding: 5,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 30, // Space for close button
    },
    icon: {
        width: 40,
        height: 40,
        borderRadius: 8,
        marginRight: SPACING.s,
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    openButton: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: SPACING.l,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.round,
    }
});

export default AppDownloadPopup;
