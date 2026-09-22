import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TOUCH_TARGETS } from '../constants/theme';

/**
 * CrowwScreenHeader
 *
 * Consistent brand header for all consumer-facing tab screens.
 * Renders the Croww logotype on the left, an optional centred title,
 * an optional back-chevron, and an optional right-side action slot.
 *
 * Usage:
 *   <CrowwScreenHeader navigation={navigation} />
 *   <CrowwScreenHeader navigation={navigation} showBack rightElement={<SomeCTA />} />
 *
 * Intentionally NOT used on SettingsScreen (per product spec).
 *
 * Props:
 *  - navigation      React Navigation prop (required for showBack / navigate calls)
 *  - showBack        bool   — show a back chevron on the left (overrides logo position)
 *  - onBack          fn     — custom back handler; defaults to navigation.goBack()
 *  - rightElement    node   — arbitrary element to render on the right
 *  - style           object — additional styles for the outer container
 *  - withTopInset    bool   — include the safe-area top inset (default true)
 */
const CrowwScreenHeader = ({
    navigation,
    showBack = false,
    onBack,
    rightElement,
    style,
    withTopInset = true,
}) => {
    const insets = useSafeAreaInsets();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else if (navigation?.canGoBack?.()) {
            navigation.goBack();
        }
    };

    return (
        <View
            style={[
                styles.container,
                { paddingTop: withTopInset ? Math.max(insets.top, SPACING.m) : SPACING.m },
                style,
            ]}
        >
            {/* Left: back button AND logo */}
            <View style={styles.leftContainer}>
                {showBack && (
                    <TouchableOpacity
                        onPress={handleBack}
                        style={styles.backButton}
                        hitSlop={TOUCH_TARGETS.hitSlop}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                )}
                <Image
                    source={require('../../assets/croww-logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                    accessibilityLabel="Croww"
                    accessibilityRole="image"
                />
            </View>

            {/* Right: optional action slot */}
            {rightElement ? (
                <View style={styles.right}>{rightElement}</View>
            ) : (
                /* Spacer keeps logo flush-left when there is no right element */
                <View style={styles.rightPlaceholder} />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.l,
        paddingBottom: SPACING.s,
        backgroundColor: COLORS.background,
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    logo: {
        width: 72,
        height: 28,
    },
    backButton: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: -6,
    },
    right: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    rightPlaceholder: {
        width: 36,
    },
});

export default CrowwScreenHeader;
