import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import { SPACING, COLORS } from '../../constants/theme';

const LegalPolicyScreen = ({ navigation, route }) => {
    const { type } = route.params || { type: 'privacy' };

    const getPolicyContent = () => {
        switch (type) {
            case 'privacy':
                return {
                    title: 'Privacy Policy',
                    content: `
Effective Date: 10, Feb 2026

Pixwik Technologies Private Limited ("Pixwik", "Company", "we", "our", or "us") operates the Crow mobile application and related services ("Platform"). This Privacy Policy explains how we collect, use, store, disclose, and safeguard user information when you access or use our services.

By using the Crow platform, you agree to the collection and use of information in accordance with this policy.

1. Information We Collect

We collect information necessary to provide event discovery, ticket booking, and related services.

a) Personal Information
When registering or using the platform, we may collect:
• Full name
• Email address
• Phone number
• Profile details
• Account login credentials
• Payment-related identifiers
• Booking and purchase records

b) Usage Information
We may automatically collect:
• Device type and OS
• App usage data
• Interaction patterns
• Crash logs and performance data
• Session timestamps

c) Location Data
With user consent, we may collect approximate or precise location data to:
• Show nearby events
• Provide local service recommendations
• Improve event discovery
Location access can be disabled anytime via device settings.

d) Payment Information
Payments are processed via secure third-party payment gateways. We do not store full credit or debit card details.

2. How We Use Information

Collected data may be used to:
• Provide event booking and ticketing services
• Manage user accounts
• Process payments and refunds
• Improve platform performance
• Prevent fraud or misuse
• Communicate updates or service notices
• Offer customer support
• Comply with legal requirements

3. Data Sharing

We do not sell personal information.

Information may be shared with:
• Event organizers for booking fulfillment
• Service providers operating events
• Payment processors
• Legal authorities when required
• Analytics and infrastructure partners

All partners are required to maintain data confidentiality.

4. Data Retention

We retain user data only as long as necessary to:
• Maintain accounts
• Comply with laws
• Resolve disputes
• Prevent fraud

Users may request deletion of their accounts and associated data.

5. User Rights

Users may:
• Access stored personal data
• Correct inaccurate data
• Request data deletion
• Withdraw consent for data usage
• Request account closure

Requests can be sent to:
📧 info@pixwik.com

6. Children's Privacy

Crow services are not intended for users under 13 years of age. If data from minors is identified, it will be removed promptly.

a) Zero-Tolerance for Child Sexual Abuse and Exploitation (CSAE)
Pixwik maintains a zero-tolerance policy regarding Child Sexual Abuse Material (CSAM) and Child Sexual Abuse and Exploitation (CSAE). We strictly prohibit the upload, sharing, or distribution of such content on our Platform. 

b) Reporting to Authorities
Any instances of CSAE or CSAM will be reported immediately to the appropriate legal authorities, including the National Center for Missing & Exploited Children (NCMEC), and may result in immediate account termination and legal action.

7. Policy Updates

We may update this policy periodically. Updates will be published within the app or website.

8. Contact Information

For privacy concerns or requests:

Pixwik Technologies Private Limited
Email: info@pixwik.com
`
                };
            case 'security':
                return {
                    title: 'Security Policy',
                    content: `
SECURITY POLICY

Croww App – Pixwik Technologies Private Limited

Pixwik Technologies Private Limited prioritizes the security of user data and financial transactions on the Crow platform.

1. Security Measures Implemented

We implement reasonable and industry-standard security practices, including:
• Encrypted data transmission (HTTPS/SSL)
• Secure authentication systems
• Controlled internal access to data
• Server security monitoring
• Payment processing via trusted gateways
• Regular software updates and patches

2. Payment Security

All payments are processed via certified payment processors. Sensitive financial information is not stored on our servers.

3. User Responsibility

Users are responsible for:
• Maintaining password confidentiality
• Avoiding credential sharing
• Reporting suspicious account activity
• Using secure devices and networks

4. Security Incident Reporting

If users discover vulnerabilities or suspicious activities, they should report immediately to:
📧 info@pixwik.com

5. Limitation of Liability

While we implement security measures, no system is completely immune to risks. Pixwik cannot guarantee absolute protection but continuously improves defenses.
`
                };
            case 'refund':
                return {
                    title: 'Refund Policy',
                    content: `
REFUND POLICY

Croww App – Pixwik Technologies Private Limited

Crow enables event organizers and service providers to sell tickets and services through the platform.

1. Refund Responsibility

Refund decisions primarily depend on event organizers or service providers.

2. Eligible Refund Cases

Refunds may be applicable when:
• An event is cancelled
• Event is officially postponed or rescheduled
• Service provider cancels confirmed booking

3. Non-Refundable Cases

Refunds are generally not applicable for:
• Change of personal plans
• Late arrival or absence
• Missed events
• Policy violations by attendees

Platform service or convenience fees may be non-refundable.

4. Refund Request Procedure

Users must:
• Submit refund requests through the app or support email
• Provide booking details
• Request before or within event-specific timelines

Refund processing times depend on banks or payment gateways.

5. Organizer-Specific Policies

Some events may have stricter or custom refund rules, which will be displayed before purchase.

6. Refund Processing Time

Approved refunds are typically processed within 5–15 business days, depending on payment method.

7. Contact for Refund Support

📧 info@pixwik.com
`
                };
            case 'terms':
                return {
                    title: 'Terms of Service',
                    content: `
TERMS OF SERVICE

Croww App – Pixwik Technologies Private Limited

Effective Date: 10, Feb 2026

Welcome to Crow ("Platform"), operated by Pixwik Technologies Private Limited ("Pixwik", "Company", "we", "our", or "us"). By creating an account and using the Platform, you agree to these Terms of Service.

1. Acceptance of Terms

By accessing or using Crow, you agree to be bound by these Terms. If you do not agree, do not use the Platform.

2. Eligibility

You must be at least 13 years of age to use this Platform. By using the Platform, you represent that you meet this requirement.

3. User Accounts

• Users must provide accurate information during registration
• You are responsible for maintaining the confidentiality of your account credentials
• You are responsible for all activities under your account
• One account per person is permitted
• Sharing account credentials is prohibited

4. Acceptable Use

You agree not to:
• Post false, misleading, or fraudulent content
• Harass, threaten, or abuse other users
• Use the platform for illegal activities
• Post, share, or distribute Child Sexual Abuse Material (CSAM) or any content related to Child Sexual Abuse and Exploitation (CSAE)
• Impersonate any person or entity
• Attempt to circumvent security features
• Upload harmful code or malicious content
• Spam other users with unwanted messages
• Create fake events or listings

Pixwik maintains a ZERO-TOLERANCE policy for CSAE. Any user found violating this will have their account terminated immediately and will be reported to law enforcement.

5. Event Listings & Ticketing

• Event organizers are responsible for the accuracy of event details
• Pixwik acts as a platform facilitator and is not the event organizer
• Ticket purchases are subject to the organizer's terms and our Refund Policy
• We reserve the right to remove events that violate our guidelines

6. Service Provider Listings

• Service providers are responsible for the accuracy of their listings
• Pixwik does not guarantee the quality of third-party services
• Disputes between users and providers should be resolved directly

7. Payments

• Payment processing is handled by certified third-party payment gateways
• All prices are displayed in INR unless otherwise specified
• Platform fees may apply and will be disclosed before purchase

8. Content & Intellectual Property

• Users retain ownership of content they create
• By posting content, you grant Pixwik a non-exclusive license to display it on the Platform
• Pixwik retains all rights to the Platform's design, code, and branding

9. Termination

We reserve the right to suspend or terminate accounts that violate these Terms, without prior notice.

10. Limitation of Liability

Pixwik is not liable for:
• Actions of third-party event organizers or service providers
• Damages arising from use or inability to use the Platform
• Content posted by other users

11. Changes to Terms

We may update these Terms periodically. Continued use after changes constitutes acceptance.

12. Contact

For questions about these Terms:

Pixwik Technologies Private Limited
Email: info@pixwik.com
`
                };
            default:
                return { title: 'Legal Policy', content: 'Content not available.' };
        }
    };

    const policy = getPolicyContent();

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="h2">{policy.title}</Typography>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                <Typography variant="body" style={styles.text}>
                    {policy.content}
                </Typography>
                <View style={styles.footer}>
                    <Typography variant="caption" color={COLORS.secondary}>
                        Last updated: Feb 10, 2026
                    </Typography>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backButton: {
        marginRight: SPACING.s,
    },
    content: {
        padding: SPACING.m,
        paddingBottom: SPACING.xl,
    },
    text: {
        lineHeight: 24,
        color: COLORS.text,
    },
    footer: {
        marginTop: SPACING.xl,
        paddingTop: SPACING.m,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        alignItems: 'center',
    }
});

export default LegalPolicyScreen;
