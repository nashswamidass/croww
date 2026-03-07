import React, { useState } from 'react';
import { Modal, View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Typography from './Typography';
import AntigravityButton from './AntigravityButton';
import { SPACING, COLORS, BORDER_RADIUS } from '../constants/theme';
import { authService } from '../services/authService';

const PolicyAcceptanceModal = ({ visible, user, onAccept }) => {
    const [loading, setLoading] = useState(false);

    const isBusiness = user?.userType === 'business' || user?.isBusiness;
    const policyType = isBusiness ? 'Business Commission Policy' : 'Provider Commission Policy';

    // Enhanced policy content
    const policyContent = isBusiness ? `
COMMISSION & PAYOUT POLICY
For Event Organizers

1. SCOPE OF SERVICE
Croww provides a digital marketplace for event discovery, ticket sales, and audience engagement. As an Organizer, you leverage our infrastructure to reach customers and manage bookings.

2. PLATFORM COMMISSION
• Standard Platform Fee: 7.0% of the ticket subtotal.
• This fee applies to all successfully processed ticket sales.
• The commission is calculated on the base price before taxes.

3. TAXES (GST)
• A mandatory 18% GST (Goods and Services Tax) is applicable on the commission amount charged by Croww.
• Example: If commission is ₹100, GST of ₹18 will be added, totaling ₹118.

4. SETTLEMENT & PAYOUTS
• Cycle: T+2 to T+3 business days after the successful completion of the event.
• Method: Direct bank transfer to your registered account via our payment gateway partner (Cashfree).
• Security: Funds are held in a secure escrow-like environment until the event concludes to ensure customer protection.

5. CANCELLATIONS & REFUNDS
• Organizers are responsible for setting their own refund policies.
• Croww's platform commission is non-refundable once a successful transaction has been processed, even in cases of eventual refunds or event cancellations.

6. ACCEPTANCE
By clicking "Accept", you acknowledge that you have read, understood, and agreed to these terms as a condition of using Croww's organizer dashboard.
    ` : `
COMMISSION & PAYOUT POLICY
For Service Providers (DJs, Vendors, etc.)

1. SCOPE OF SERVICE
Croww connects professional service providers with event organizers and individuals looking for event-related services.

2. PLATFORM COMMISSION
• Marketplace Fee: 15.0% of the confirmed booking value.
• This fee covers platform maintenance, marketing, and lead generation.

3. TAXES (GST)
• A mandatory 18% GST (Goods and Services Tax) is applicable on the commission amount charged by Croww.
• Example: If commission is ₹100, GST of ₹18 will be added, totaling ₹118.

4. SETTLEMENT & PAYOUTS
• Cycle: T+2 to T+3 business days after the service is marked as completed by both parties.
• Method: Auto-settlement to your verified bank account.

5. DISPUTE RESOLUTION
• In case of service issues, Croww reserves the right to hold payouts until a resolution is reached between the provider and the client.

6. ACCEPTANCE
By clicking "Accept", you acknowledge that you have read, understood, and agreed to these terms to continue offering services on Croww.
    `;

    const handleAccept = async () => {
        setLoading(true);
        try {
            await authService.acceptPolicy(user.id);
            onAccept();
        } catch (error) {
            console.error('Failed to accept policy:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Typography variant="h2">{policyType}</Typography>
                        <Typography variant="caption" style={{ marginTop: 4 }}>
                            Please review and accept to continue
                        </Typography>
                    </View>

                    <ScrollView style={styles.content}>
                        <Typography variant="body" style={styles.policyText}>
                            {policyContent}
                        </Typography>
                    </ScrollView>

                    <View style={styles.footer}>
                        <AntigravityButton
                            title="Accept & Continue"
                            onPress={handleAccept}
                            loading={loading}
                            fullWidth
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.l,
    },
    container: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.l,
        width: '100%',
        maxHeight: '80%',
        overflow: 'hidden',
    },
    header: {
        padding: SPACING.l,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    content: {
        padding: SPACING.l,
    },
    policyText: {
        lineHeight: 24,
        color: COLORS.text,
    },
    footer: {
        padding: SPACING.l,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    }
});

export default PolicyAcceptanceModal;
