import React, { useEffect, useState } from 'react';
import {
    View,
    Modal,
    TextInput,
    Switch,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import Typography from '../../Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../constants/theme';

const SaveSearchModal = ({
    visible,
    defaultName,
    busy,
    error,
    onClose,
    onSave,
}) => {
    const [name, setName] = useState(defaultName || '');
    const [alerts, setAlerts] = useState(true);

    useEffect(() => {
        if (visible) {
            setName(defaultName || '');
            setAlerts(true);
        }
    }, [visible, defaultName]);

    const save = () => {
        onSave({ name: name.trim(), alertEnabled: alerts });
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={styles.sheet} accessibilityViewIsModal>
                    <Typography variant="h3">Save this search</Typography>
                    <Typography variant="caption" style={styles.hint}>
                        Optional name. Alerts use published listings only.
                    </Typography>
                    <TextInput
                        value={name}
                        onChangeText={setName}
                        placeholder={defaultName || 'Search name'}
                        placeholderTextColor={COLORS.secondary}
                        style={styles.input}
                        accessibilityLabel="Saved search name"
                        maxLength={80}
                    />
                    <View style={styles.row}>
                        <Typography variant="body" style={styles.toggleLabel}>Alerts</Typography>
                        <Switch
                            value={alerts}
                            onValueChange={setAlerts}
                            accessibilityLabel="Enable search alerts"
                        />
                    </View>
                    {error ? <Typography variant="caption" style={styles.error}>{error}</Typography> : null}
                    <View style={styles.actions}>
                        <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel" style={styles.action}>
                            <Typography variant="body">Cancel</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={save}
                            disabled={busy}
                            accessibilityRole="button"
                            accessibilityLabel="Save search"
                            style={styles.action}
                        >
                            {busy ? <ActivityIndicator color={COLORS.accent} /> : (
                                <Typography variant="body" style={styles.save}>Save</Typography>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        padding: SPACING.l,
    },
    sheet: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.l,
        padding: SPACING.l,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    hint: { color: COLORS.secondary, marginTop: SPACING.s, textTransform: 'none' },
    input: {
        marginTop: SPACING.m,
        minHeight: 44,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.m,
        paddingHorizontal: SPACING.m,
        color: COLORS.primary,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: SPACING.m,
        minHeight: 44,
    },
    toggleLabel: { color: COLORS.primary },
    error: { color: COLORS.error, marginTop: SPACING.s, textTransform: 'none' },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.m },
    action: { minHeight: 44, justifyContent: 'center', marginLeft: SPACING.l },
    save: { color: COLORS.accent, fontWeight: '700' },
});

export default SaveSearchModal;
