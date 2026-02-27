import { Alert, Platform } from 'react-native';

/**
 * Cross-platform alert helper.
 * - Native: delegates to Alert.alert (full button support)
 * - Web: uses window.alert / window.confirm as fallback
 *
 * @param {string} title
 * @param {string} message
 * @param {Array<{text: string, onPress?: function, style?: string}>} [buttons]
 */
export function showAlert(title, message, buttons) {
    if (Platform.OS !== 'web') {
        Alert.alert(title, message, buttons);
        return;
    }

    // Web fallback
    if (!buttons || buttons.length <= 1) {
        // Simple informational alert
        window.alert(`${title}\n\n${message}`);
        buttons?.[0]?.onPress?.();
        return;
    }

    // Two or more buttons → use confirm dialog
    const positiveBtn = buttons.find(b =>
        ['ok', 'yes', 'login', 'confirm', 'send'].includes(b.text?.toLowerCase())
    ) || buttons[buttons.length - 1];

    const negativeBtn = buttons.find(b =>
        b.style === 'cancel' || ['cancel', 'no'].includes(b.text?.toLowerCase())
    ) || buttons[0];

    const ok = window.confirm(`${title}\n\n${message}`);
    if (ok) {
        positiveBtn?.onPress?.();
    } else {
        negativeBtn?.onPress?.();
    }
}
