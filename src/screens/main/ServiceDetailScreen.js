import React from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Linking, Modal, TextInput, Dimensions, Platform, Share, KeyboardAvoidingView } from 'react-native';
import { showAlert } from '../../utils/showAlert';
import { normalizeUrl } from '../../utils/normalizeUrl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import Typography from '../../components/Typography';
import AntigravityButton from '../../components/AntigravityButton';
import NotionCard from '../../components/NotionCard';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { userService } from '../../services/userService';
import { reviewService } from '../../services/reviewService';
import { eventService } from '../../services/eventService';
import { getAvatarSource } from '../../utils/avatarHelper';
import { getValidImageUri, DEFAULT_EVENT_IMAGE } from '../../utils/imageUtils';
import { useAuth } from '../../context/AuthContext';
import SEO from '../../components/SEO';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const StarRating = ({ rating, size = 20, interactive = false, onRate }) => {
    const stars = [1, 2, 3, 4, 5];
    return (
        <View style={{ flexDirection: 'row', gap: 4 }}>
            {stars.map((star) => (
                <TouchableOpacity
                    key={star}
                    disabled={!interactive}
                    onPress={() => interactive && onRate && onRate(star)}
                    activeOpacity={interactive ? 0.6 : 1}
                >
                    <Ionicons
                        name={star <= rating ? 'star' : 'star-outline'}
                        size={size}
                        color={star <= rating ? '#FFD700' : COLORS.border}
                    />
                </TouchableOpacity>
            ))}
        </View>
    );
};

const ServiceDetailScreen = ({ route, navigation }) => {
    const { serviceId, id: routeId } = route.params || {};
    const finalServiceId = serviceId || routeId;
    const [service, setService] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const { user: currentUser } = useAuth();
    const [reviews, setReviews] = React.useState([]);
    const [events, setEvents] = React.useState([]);
    const [showReviewModal, setShowReviewModal] = React.useState(false);
    const [reviewRating, setReviewRating] = React.useState(0);
    const [reviewComment, setReviewComment] = React.useState('');
    const [submittingReview, setSubmittingReview] = React.useState(false);
    const [userReview, setUserReview] = React.useState(null);
    const [isFollowing, setIsFollowing] = React.useState(false);
    const [followLoading, setFollowLoading] = React.useState(false);
    const insets = useSafeAreaInsets();

    React.useEffect(() => {
        const fetchData = async () => {
            try {
                const [serviceData, organizerEvents] = await Promise.all([
                    userService.getUserById(finalServiceId),
                    eventService.getEventsByOrganizer(finalServiceId)
                ]);
                setService(serviceData);

                // Simple date parsing to sort by date if possible, otherwise just show all
                const validEvents = (organizerEvents || []).filter(e => e.date);
                setEvents(validEvents);

                if (serviceData) {
                    const reviewsData = await reviewService.getBusinessReviews(finalServiceId);
                    setReviews(reviewsData);

                    if (currentUser?.id) {
                        const [existing, followStatus] = await Promise.all([
                            reviewService.getUserReview(finalServiceId, currentUser.id),
                            userService.getFollowStatus(currentUser.id, finalServiceId)
                        ]);
                        if (existing) {
                            setUserReview(existing);
                            setReviewRating(existing.rating);
                            setReviewComment(existing.comment || '');
                        }
                        setIsFollowing(followStatus);
                    }
                }
            } catch (error) {
                console.error("Error fetching service detail:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [finalServiceId, currentUser?.id]);

    const handleShare = async () => {
        try {
            const url = `https://croww.ai/provider/${finalServiceId}`;
            await Share.share({
                message: `Check out ${service?.name} on Croww! ${url}`,
                url: url, // iOS only
                title: service?.name
            });
        } catch (error) {
            console.error('Error sharing profile:', error);
        }
    };

    const handleFollow = async () => {
        if (!currentUser) {
            showAlert('Login Required', 'Please login to follow businesses.');
            return;
        }

        setFollowLoading(true);
        try {
            if (isFollowing) {
                await userService.unfollowUser(currentUser.id, finalServiceId);
                setIsFollowing(false);
                setService(prev => ({
                    ...prev,
                    followersCount: Math.max(0, (prev.followersCount || 1) - 1)
                }));
            } else {
                await userService.followUser(currentUser.id, finalServiceId);
                setIsFollowing(true);
                setService(prev => ({
                    ...prev,
                    followersCount: (prev.followersCount || 0) + 1
                }));
            }
        } catch (error) {
            console.error('Error toggling follow:', error);
            const message = error.message || 'Failed to update follow status.';
            showAlert('Follow Action Failed', message);
        } finally {
            setFollowLoading(false);
        }
    };

    const handleSubmitReview = async () => {
        if (reviewRating === 0) {
            showAlert('Rating Required', 'Please select a star rating.');
            return;
        }

        setSubmittingReview(true);
        try {
            await reviewService.submitReview({
                businessId: serviceId,
                userId: currentUser.id,
                userName: currentUser.name || 'User',
                rating: reviewRating,
                comment: reviewComment.trim(),
            });

            // Refresh reviews and service data
            const [updatedReviews, updatedService] = await Promise.all([
                reviewService.getBusinessReviews(serviceId),
                userService.getUserById(serviceId),
            ]);
            setReviews(updatedReviews);
            setService(updatedService);

            const existing = await reviewService.getUserReview(serviceId, currentUser.id);
            setUserReview(existing);

            setShowReviewModal(false);
            showAlert('Thank you!', 'Your review has been submitted.');
        } catch (error) {
            console.error('Error submitting review:', error);
            showAlert('Error', 'Failed to submit review. Please try again.');
        } finally {
            setSubmittingReview(false);
        }
    };

    const isVerifiedUser = currentUser?.isVerified || currentUser?.isApproved;
    const isOwnProfile = currentUser && currentUser.id === finalServiceId;
    const isProfessional = service?.userType === 'provider' || service?.userType === 'business' || service?.isProvider || service?.isBusiness;

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            </ScreenWrapper>
        );
    }

    const businessSchema = Platform.OS === 'web' && service ? {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": service.name,
        "description": service.about || service.bio,
        "image": service.profileImage || service.avatarUrl,
        "address": {
            "@type": "PostalAddress",
            "streetAddress": service.address,
            "addressLocality": service.location
        },
        "aggregateRating": service.rating ? {
            "@type": "AggregateRating",
            "ratingValue": service.rating,
            "reviewCount": service.reviews || 0
        } : null
    } : null;

    if (!service) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <Ionicons name="alert-circle-outline" size={64} color={COLORS.secondary} />
                    <Typography variant="h2" style={{ marginTop: SPACING.m }}>Profile Not Found</Typography>
                    <Typography variant="body" color={COLORS.secondary} style={{ textAlign: 'center', marginVertical: SPACING.m }}>
                        This profile may have been removed or is currently unavailable.
                    </Typography>
                    <AntigravityButton title="Go Back" onPress={() => navigation.goBack()} />
                </View>
            </ScreenWrapper>
        );
    }

    const avatarSource = getAvatarSource(service.photoURL || service.avatar || service.profileImage, service.userType);
    const hasAbout = service.about && service.about.trim().length > 0;
    const hasLocation = service.location && service.location.trim().length > 0;
    const hasPackages = service.packages && service.packages.length > 0;
    const profilePhotos = service.profilePhotos || [];
    const hasPhotos = profilePhotos.length > 0;

    return (
        <ScreenWrapper edges={['top']}>
            <SEO
                title={service.name}
                description={service.about || service.bio}
                image={service.profileImage || service.avatarUrl}
                url={`/provider/${service.id}`}
                type="profile"
                schemaData={businessSchema}
            />
            {/* Top Navigation */}
            <View style={styles.topNav}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Typography variant="body" style={{ fontWeight: '600' }}>Profile</Typography>
                <TouchableOpacity onPress={handleShare} style={styles.backButton}>
                    <Ionicons name="share-outline" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Header */}
                <View style={styles.profileHeader}>
                    <View style={styles.avatarContainer}>
                        <Image
                            source={avatarSource}
                            style={styles.avatar}
                            accessibilityLabel={`Profile picture of ${service.name}`}
                        />
                        {service.isVerified && (
                            <View style={styles.verifiedBadgeOnAvatar}>
                                <Ionicons name="checkmark-circle" size={24} color={COLORS.accent} />
                            </View>
                        )}
                    </View>

                    <Typography variant="h2" style={styles.profileName}>{service.name}</Typography>
                    <View style={styles.roleChip}>
                        <Typography variant="caption" style={styles.roleChipText}>
                            {service.category || service.role || (service.userType === 'business' ? 'Venue' : 'Freelancer')}
                        </Typography>
                    </View>

                    {service.socialLinks && (
                        <View style={styles.headerSocials}>
                            {service.socialLinks.instagram && normalizeUrl(service.socialLinks.instagram) !== '' && (
                                <TouchableOpacity onPress={() => Linking.openURL(normalizeUrl(service.socialLinks.instagram))} style={styles.socialIconBtn}>
                                    <Ionicons name="logo-instagram" size={20} color={COLORS.primary} />
                                </TouchableOpacity>
                            )}
                            {service.socialLinks.soundcloud && normalizeUrl(service.socialLinks.soundcloud) !== '' && (
                                <TouchableOpacity onPress={() => Linking.openURL(normalizeUrl(service.socialLinks.soundcloud))} style={styles.socialIconBtn}>
                                    <Ionicons name="musical-notes" size={20} color={COLORS.primary} />
                                </TouchableOpacity>
                            )}
                            {service.socialLinks.behance && normalizeUrl(service.socialLinks.behance) !== '' && (
                                <TouchableOpacity onPress={() => Linking.openURL(normalizeUrl(service.socialLinks.behance))} style={styles.socialIconBtn}>
                                    <Ionicons name="logo-behance" size={20} color={COLORS.primary} />
                                </TouchableOpacity>
                            )}
                            {service.socialLinks.youtube && normalizeUrl(service.socialLinks.youtube) !== '' && (
                                <TouchableOpacity onPress={() => Linking.openURL(normalizeUrl(service.socialLinks.youtube))} style={styles.socialIconBtn}>
                                    <Ionicons name="logo-youtube" size={20} color={COLORS.primary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {service.bio && (
                        <Typography variant="body" color={COLORS.secondary} style={{ textAlign: 'center', marginTop: SPACING.m, paddingHorizontal: SPACING.m }}>
                            {service.bio}
                        </Typography>
                    )}
                </View>

                {/* Professional Stats Section */}
                <View style={styles.sectionHeader}>
                    <Typography variant="caption" style={styles.sectionLabel}>SERVICE OVERVIEW</Typography>
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="star" size={16} color="#FFD700" />
                            <Typography variant="h3" style={styles.statValue}>
                                {service.rating ? Number(service.rating).toFixed(1) : 'New'}
                            </Typography>
                        </View>
                        <Typography variant="small" color={COLORS.secondary}>Rating</Typography>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Typography variant="h3" style={styles.statValue}>
                            {service.followersCount || 0}
                        </Typography>
                        <Typography variant="small" color={COLORS.secondary}>Followers</Typography>
                    </View>

                    {isProfessional && (
                        <>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Typography variant="h3" style={styles.statValue}>
                                    {service.stats?.experience || '—'}
                                </Typography>
                                <Typography variant="small" color={COLORS.secondary}>Exp</Typography>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Typography variant="h3" style={[styles.statValue, { color: COLORS.accent }]}>
                                    {(service.stats?.price || (service.stats?.pricingType === 'inquiry' ? 'Inq' : '—'))}
                                </Typography>
                                <Typography variant="small" color={COLORS.secondary}>Price</Typography>
                            </View>
                        </>
                    )}

                    {!isProfessional && (
                        <>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Typography variant="h3" style={styles.statValue}>
                                    {events.length}
                                </Typography>
                                <Typography variant="small" color={COLORS.secondary}>Events</Typography>
                            </View>
                        </>
                    )}
                </View>

                {/* Action Buttons */}
                {!isOwnProfile && (
                    <View style={styles.actionRow}>
                        <AntigravityButton
                            title={isFollowing ? "Following" : "Follow"}
                            variant={isFollowing ? "secondary" : "primary"}
                            icon={isFollowing ? "checkmark-circle" : "add-circle-outline"}
                            onPress={handleFollow}
                            loading={followLoading}
                            style={{ flex: 1.1, minWidth: 80, paddingHorizontal: 4 }}
                        />
                        <AntigravityButton
                            title="Message"
                            variant="secondary"
                            icon="chatbubble-outline"
                            onPress={() => navigation.navigate('Chat', {
                                recipientId: service.id,
                                recipientName: service.name,
                                recipientRole: service.category || service.role || 'Service'
                            })}
                            style={{ flex: 1, minWidth: 80, paddingHorizontal: 4 }}
                        />
                        {isProfessional && (
                            <AntigravityButton
                                title="Book"
                                variant="secondary"
                                icon="calendar-outline"
                                onPress={() => navigation.navigate('CreateBooking', {
                                    providerId: service.id,
                                    providerName: service.name,
                                    serviceName: service.category || service.role || 'Service'
                                })}
                                style={{ flex: 1, minWidth: 80, paddingHorizontal: 4 }}
                            />
                        )}
                    </View>
                )}

                {/* Photos Gallery */}
                {hasPhotos && (
                    <View style={styles.section}>
                        <Typography variant="h3" style={styles.sectionTitle}>
                            {isProfessional ? 'Portfolio' : 'Photos'}
                        </Typography>
                        <View style={styles.portfolioGrid}>
                            {profilePhotos.map((photoUrl, index) => (
                                <View key={index} style={styles.portfolioItem}>
                                    <Image
                                        source={{ uri: photoUrl }}
                                        style={styles.portfolioImage}
                                    />
                                </View>
                            ))}
                        </View>
                    </View>
                )}
                {/* Social & External Portfolio Links */}
                {service.socialLinks && Object.values(service.socialLinks).some(link => link) && (
                    <View style={styles.section}>
                        <Typography variant="h3" style={styles.sectionTitle}>Portfolio & Socials</Typography>
                        <View style={styles.socialLinksRow}>
                            {service.socialLinks.instagram ? (
                                <TouchableOpacity style={styles.socialLinkButton} onPress={() => Linking.openURL(service.socialLinks.instagram)}>
                                    <Ionicons name="logo-instagram" size={20} color="#E1306C" />
                                    <Typography variant="small" style={styles.socialLinkText}>Instagram</Typography>
                                </TouchableOpacity>
                            ) : null}
                            {service.socialLinks.soundcloud ? (
                                <TouchableOpacity style={styles.socialLinkButton} onPress={() => Linking.openURL(service.socialLinks.soundcloud)}>
                                    <Ionicons name="musical-notes" size={20} color="#FF5500" />
                                    <Typography variant="small" style={styles.socialLinkText}>SoundCloud</Typography>
                                </TouchableOpacity>
                            ) : null}
                            {service.socialLinks.behance ? (
                                <TouchableOpacity style={styles.socialLinkButton} onPress={() => Linking.openURL(service.socialLinks.behance)}>
                                    <Ionicons name="color-palette" size={20} color="#1769FF" />
                                    <Typography variant="small" style={styles.socialLinkText}>Behance</Typography>
                                </TouchableOpacity>
                            ) : null}
                            {service.socialLinks.youtube ? (
                                <TouchableOpacity style={styles.socialLinkButton} onPress={() => Linking.openURL(service.socialLinks.youtube)}>
                                    <Ionicons name="logo-youtube" size={20} color="#FF0000" />
                                    <Typography variant="small" style={styles.socialLinkText}>YouTube</Typography>
                                </TouchableOpacity>
                            ) : null}
                            {service.socialLinks.googleDrive ? (
                                <TouchableOpacity style={styles.socialLinkButton} onPress={() => Linking.openURL(service.socialLinks.googleDrive)}>
                                    <Ionicons name="cloud-outline" size={20} color="#4285F4" />
                                    <Typography variant="small" style={styles.socialLinkText}>External Link</Typography>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>
                )}

                {/* About Section */}
                {hasAbout && (
                    <View style={styles.section}>
                        <Typography variant="h3" style={styles.sectionTitle}>About</Typography>
                        <Typography variant="body" style={styles.aboutText}>
                            {service.about}
                        </Typography>
                    </View>
                )}

                {/* Specialties / Interests */}
                {service.interests && service.interests.length > 0 && (
                    <View style={styles.section}>
                        <Typography variant="h3" style={styles.sectionTitle}>
                            {isProfessional ? 'Specialties' : 'Interests'}
                        </Typography>
                        <View style={styles.interestsContainer}>
                            {service.interests.map((interest, interestIndex) => (
                                <View key={interestIndex} style={styles.interestTag}>
                                    <Typography variant="small" style={{ color: COLORS.accent }}>
                                        {interest}
                                    </Typography>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Details Card */}
                <View style={styles.section}>
                    <Typography variant="h3" style={styles.sectionTitle}>Details</Typography>
                    <NotionCard style={styles.detailsCard}>
                        {service.address && (
                            <TouchableOpacity
                                style={styles.detailRow}
                                onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(service.address)}`)}
                            >
                                <View style={styles.detailIcon}>
                                    <Ionicons name="map-outline" size={18} color={COLORS.accent} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Typography variant="small" color={COLORS.secondary}>Address</Typography>
                                    <Typography variant="body">{service.address}</Typography>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={COLORS.border} />
                            </TouchableOpacity>
                        )}
                        {hasLocation && (
                            <View style={styles.detailRow}>
                                <View style={styles.detailIcon}>
                                    <Ionicons name="location-outline" size={18} color={COLORS.accent} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Typography variant="small" color={COLORS.secondary}>City</Typography>
                                    <Typography variant="body">{service.location}</Typography>
                                </View>
                            </View>
                        )}
                        {!service.address && !hasLocation && (
                            <View style={{ padding: SPACING.m, alignItems: 'center' }}>
                                <Typography variant="body" color={COLORS.secondary}>
                                    No further details available
                                </Typography>
                            </View>
                        )}
                    </NotionCard>
                </View>

                {/* Events Section */}
                {events.length > 0 && (
                    <View style={styles.section}>
                        <Typography variant="h3" style={styles.sectionTitle}>Upcoming Events</Typography>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                            {events.map((event) => (
                                <TouchableOpacity
                                    key={event.id}
                                    onPress={() => navigation.push('EventDetail', { event })}
                                >
                                    <NotionCard style={styles.eventCard}>
                                        <Image
                                            source={{ uri: getValidImageUri(event.imageUri) || DEFAULT_EVENT_IMAGE }}
                                            style={styles.eventImage}
                                        />
                                        <View style={{ padding: SPACING.s }}>
                                            <Typography variant="body" numberOfLines={1} style={{ fontWeight: '600' }}>
                                                {event.title}
                                            </Typography>
                                            <Typography variant="caption" color={COLORS.secondary}>
                                                {event.date}
                                            </Typography>
                                            {event.isPaid ? (
                                                <Typography variant="small" style={{ color: COLORS.accent, marginTop: 4 }}>
                                                    Starts from ₹{event.price}
                                                </Typography>
                                            ) : (
                                                <Typography variant="small" style={{ color: COLORS.success, marginTop: 4 }}>
                                                    Free
                                                </Typography>
                                            )}
                                        </View>
                                    </NotionCard>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Packages */}
                {hasPackages && (
                    <View style={styles.section}>
                        <Typography variant="h3" style={styles.sectionTitle}>Packages</Typography>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                            {service.packages.map((pkg) => (
                                <NotionCard key={pkg.id} style={styles.packageCard}>
                                    <View style={{ flex: 1 }}>
                                        <Typography variant="h3" numberOfLines={2}>{pkg.title}</Typography>
                                        <Typography variant="h2" style={{ color: COLORS.accent, marginVertical: SPACING.s }}>
                                            ₹{pkg.price?.toLocaleString()}
                                        </Typography>
                                        {pkg.features && pkg.features.slice(0, 3).map((feature, index) => (
                                            <View key={index} style={styles.featureItem}>
                                                <Ionicons name="checkmark" size={14} color={COLORS.success} />
                                                <Typography variant="caption" style={{ marginLeft: 6, flex: 1 }}>{feature}</Typography>
                                            </View>
                                        ))}
                                    </View>
                                    {!isOwnProfile && (
                                        <TouchableOpacity
                                            style={styles.packageBookBtn}
                                            onPress={() => navigation.navigate('CreateBooking', {
                                                providerId: service.id,
                                                providerName: service.name,
                                                serviceName: service.category || service.role || 'Service',
                                                packageData: pkg
                                            })}
                                        >
                                            <Typography variant="small" style={{ color: COLORS.accent, fontWeight: '700' }}>BOOK NOW</Typography>
                                            <Ionicons name="chevron-forward" size={14} color={COLORS.accent} />
                                        </TouchableOpacity>
                                    )}
                                </NotionCard>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Reviews Section */}
                <View style={styles.section}>
                    <View style={styles.reviewsHeader}>
                        <Typography variant="h3">Reviews</Typography>
                        {!isOwnProfile && isVerifiedUser && (
                            <TouchableOpacity
                                onPress={() => setShowReviewModal(true)}
                                style={styles.writeReviewButton}
                            >
                                <Ionicons name="create-outline" size={16} color={COLORS.accent} />
                                <Typography variant="caption" style={{ color: COLORS.accent, fontWeight: '600', marginLeft: 4 }}>
                                    {userReview ? 'Edit Review' : 'Write Review'}
                                </Typography>
                            </TouchableOpacity>
                        )}
                    </View>

                    {!isOwnProfile && !isVerifiedUser && (
                        <View style={styles.verifyNotice}>
                            <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.secondary} />
                            <Typography variant="caption" color={COLORS.secondary} style={{ marginLeft: SPACING.s, flex: 1 }}>
                                Only verified users can leave reviews
                            </Typography>
                        </View>
                    )}

                    {reviews.length === 0 ? (
                        <View style={styles.emptyReviews}>
                            <Ionicons name="chatbubbles-outline" size={40} color={COLORS.border} />
                            <Typography variant="body" color={COLORS.secondary} style={{ marginTop: SPACING.s, textAlign: 'center' }}>
                                {isVerifiedUser
                                    ? "No reviews yet. Be the first to share your experience!"
                                    : "No reviews yet"}
                            </Typography>
                        </View>
                    ) : (
                        <View style={{ gap: SPACING.m }}>
                            {reviews.slice(0, 5).map((review) => (
                                <NotionCard key={review.id} style={styles.reviewCard}>
                                    <View style={styles.reviewTop}>
                                        <TouchableOpacity
                                            style={{ flex: 1 }}
                                            onPress={() => navigation.push('ServiceDetail', { serviceId: review.userId })}
                                        >
                                            <Typography variant="body" style={{ fontWeight: '600' }}>
                                                {review.userName}
                                            </Typography>
                                            <StarRating rating={review.rating} size={14} />
                                        </TouchableOpacity>
                                        {review.createdAt && (
                                            <Typography variant="small" color={COLORS.secondary}>
                                                {review.createdAt.toDate
                                                    ? review.createdAt.toDate().toLocaleDateString()
                                                    : ''}
                                            </Typography>
                                        )}
                                    </View>
                                    {review.comment ? (
                                        <Typography variant="body" color={COLORS.secondary} style={{ marginTop: SPACING.s }}>
                                            {review.comment}
                                        </Typography>
                                    ) : null}
                                </NotionCard>
                            ))}
                            {reviews.length > 5 && (
                                <TouchableOpacity
                                    style={styles.seeAllReviews}
                                    onPress={() => navigation.navigate('ReviewList', {
                                        businessId: finalServiceId,
                                        businessName: service.name
                                    })}
                                >
                                    <Typography variant="body" style={{ color: COLORS.accent, fontWeight: '600' }}>
                                        See all {reviews.length} reviews
                                    </Typography>
                                    <Ionicons name="chevron-forward" size={16} color={COLORS.accent} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>

                <View style={{ height: SPACING.xxl }} />
            </ScrollView>

            {/* Review Modal */}
            <Modal
                visible={showReviewModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowReviewModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalOverlay}
                >
                    <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, SPACING.l) }]}>
                        <View style={styles.modalHandle} />
                        <Typography variant="h2" style={{ textAlign: 'center', marginBottom: SPACING.l }}>
                            {userReview ? 'Update Your Review' : 'Write a Review'}
                        </Typography>

                        <Typography variant="body" style={{ textAlign: 'center', marginBottom: SPACING.s }}>
                            How would you rate {service.name}?
                        </Typography>
                        <View style={{ alignItems: 'center', marginBottom: SPACING.l }}>
                            <StarRating
                                rating={reviewRating}
                                size={36}
                                interactive
                                onRate={setReviewRating}
                            />
                        </View>

                        <TextInput
                            style={styles.reviewInput}
                            placeholder="Share your experience (optional)"
                            placeholderTextColor={COLORS.secondary}
                            multiline
                            numberOfLines={4}
                            value={reviewComment}
                            onChangeText={setReviewComment}
                            textAlignVertical="top"
                        />

                        <View style={{ gap: SPACING.s, marginTop: SPACING.l }}>
                            <AntigravityButton
                                title={submittingReview ? 'Submitting...' : 'Submit Review'}
                                onPress={handleSubmitReview}
                                loading={submittingReview}
                            />
                            <AntigravityButton
                                title="Cancel"
                                variant="secondary"
                                onPress={() => setShowReviewModal(false)}
                            />
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    topNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.s,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backButton: {
        padding: 4,
    },
    scrollContent: {
        paddingBottom: 40,
    },

    // Profile Header
    profileHeader: {
        alignItems: 'center',
        paddingTop: SPACING.xl,
        paddingBottom: SPACING.m,
        paddingHorizontal: SPACING.m,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: SPACING.m,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 3,
        borderColor: COLORS.accent,
    },
    verifiedBadgeOnAvatar: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: COLORS.background,
        borderRadius: 12,
        padding: 1,
    },
    profileName: {
        textAlign: 'center',
        marginBottom: SPACING.xs,
    },
    roleChip: {
        backgroundColor: COLORS.accent + '20',
        paddingHorizontal: SPACING.m,
        paddingVertical: 4,
        borderRadius: 20,
        marginBottom: SPACING.s,
    },
    roleChipText: {
        color: COLORS.accent,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    sectionHeader: {
        paddingHorizontal: SPACING.m,
        marginBottom: SPACING.xs,
        alignItems: 'center',
    },
    sectionLabel: {
        color: COLORS.secondary,
        fontWeight: '700',
        letterSpacing: 1,
    },

    // Stats Row
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: SPACING.m,
        paddingVertical: SPACING.m,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.l,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontWeight: '700',
        marginBottom: 2,
    },
    statDivider: {
        width: 1,
        height: 36,
        backgroundColor: COLORS.border,
    },

    // Action Buttons
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: SPACING.m,
        marginTop: SPACING.l,
        gap: SPACING.s,
    },
    actionIcon: {
        width: 48,
        height: 48,
        borderRadius: BORDER_RADIUS.m,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Photos Gallery
    portfolioGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.m,
        marginTop: SPACING.s,
    },
    portfolioItem: {
        width: '48%',
        aspectRatio: 1,
        borderRadius: BORDER_RADIUS.m,
        overflow: 'hidden',
    },
    portfolioImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },

    // Sections
    section: {
        marginTop: SPACING.xl,
        paddingHorizontal: SPACING.m,
    },
    sectionTitle: {
        marginBottom: SPACING.m,
    },
    aboutText: {
        color: COLORS.secondary,
        lineHeight: 22,
    },

    // Details Card
    detailsCard: {
        padding: 0,
        overflow: 'hidden',
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    detailIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.accent + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
    },

    // Pricing
    pricingCard: {
        padding: SPACING.m,
    },
    pricingContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    priceBadge: {
        backgroundColor: COLORS.accent + '15',
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.s,
        borderRadius: BORDER_RADIUS.m,
    },

    // Packages
    horizontalScroll: {
        marginLeft: -SPACING.m,
        paddingLeft: SPACING.m,
    },
    packageCard: {
        width: 220,
        marginRight: SPACING.m,
        padding: SPACING.m,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    packageBookBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: SPACING.m,
        paddingTop: SPACING.s,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        gap: 4
    },

    // Events
    eventCard: {
        width: 200,
        marginRight: SPACING.m,
        padding: 0,
        overflow: 'hidden',
    },
    eventImage: {
        width: '100%',
        height: 120,
        backgroundColor: COLORS.surfaceHighlight,
    },

    // Reviews
    reviewsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.m,
    },
    writeReviewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.accent + '15',
        paddingHorizontal: SPACING.m,
        paddingVertical: 6,
        borderRadius: 20,
    },
    verifyNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        padding: SPACING.m,
        borderRadius: BORDER_RADIUS.m,
        marginBottom: SPACING.m,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    emptyReviews: {
        alignItems: 'center',
        paddingVertical: SPACING.xl,
    },
    reviewCard: {
        padding: SPACING.m,
    },
    reviewTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    seeAllReviews: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.m,
        gap: 4,
    },

    // Review Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: SPACING.xl,
    },
    modalHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.border,
        alignSelf: 'center',
        marginBottom: SPACING.l,
    },
    reviewInput: {
        backgroundColor: COLORS.background,
        color: COLORS.primary,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.m,
        padding: SPACING.m,
        fontSize: 15,
        minHeight: 100,
    },
    interestsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.s,
    },
    interestTag: {
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: SPACING.m,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.accent + '20', // subtle accent border
    },
    headerSocials: {
        flexDirection: 'row',
        gap: SPACING.m,
        marginTop: SPACING.m,
        justifyContent: 'center',
    },
    socialIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    socialLinksRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.s,
        marginTop: SPACING.s,
    },
    socialLinkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    socialLinkText: {
        color: COLORS.primary,
        fontWeight: '500',
    },
});

export default ServiceDetailScreen;
