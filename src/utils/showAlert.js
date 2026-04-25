import { Platform } from 'react-native';

/**
 * Cross-platform alert helper.
 * - Native: delegates to Alert.alert (full button support)
 * - Web: uses non-blocking logic where possible, or window.confirm
 *
 * @param {string} title
 * @param {string} message
 * @param {Array<{text: string, onPress?: function, style?: string}>} [buttons]
 */
export function showAlert(title, message, buttons) {
    console.log(`[showAlert] ${title}: ${message}`);

    if (Platform.OS !== 'web') {
        const { Alert } = require('react-native');
        Alert.alert(title, message, buttons);
        return;
    }

    // Web logic:
    // If it's a simple alert with 0 or 1 button, we can just use alert()
    if (!buttons || buttons.length <= 1) {
        // We use a small timeout to allow UI updates before the blocking alert runs
        setTimeout(() => {
            window.alert(`${title}\n\n${message}`);
            if (buttons && buttons[0] && buttons[0].onPress) {
                buttons[0].onPress();
            }
        }, 100);
        return;
    }

    // Two or more buttons → use confirm dialog
    const positiveBtn = buttons.find(b =>
        ['ok', 'yes', 'login', 'confirm', 'send', 'log out', 'leave'].includes(b.text?.toLowerCase())
    ) || buttons[buttons.length - 1];

    const negativeBtn = buttons.find(b =>
        b.style === 'cancel' || ['cancel', 'no'].includes(b.text?.toLowerCase())
    ) || buttons[0];

    // Use a small timeout to ensure the UI has processed the click before blocking
    setTimeout(() => {
        const ok = window.confirm(`${title}\n\n${message}`);
        if (ok) {
            if (positiveBtn?.onPress) positiveBtn.onPress();
        } else {
            if (negativeBtn?.onPress) negativeBtn.onPress();
        }
    }, 100);
}
