import React from 'react';
import { Platform } from 'react-native';
import { Helmet } from 'react-helmet-async';

/**
 * SEO Component for Web
 * Injects Meta tags and Schema.org JSON-LD structured data
 */
const SEO = ({
    title,
    description,
    image,
    url,
    type = 'website',
    schemaData = null
}) => {
    // Only run on Web
    if (Platform.OS !== 'web') return null;

    const siteName = 'Croww: Rent on the map';
    const fullTitle = title ? `${title} | ${siteName}` : siteName;
    const defaultDescription = 'Join exclusive events and find event buddies on Croww.';
    const metaDescription = description || defaultDescription;
    const siteUrl = 'https://croww.ai';
    const fullUrl = url ? `${siteUrl}${url}` : siteUrl;
    const metaImage = image || 'https://croww.ai/assets/images/og-image.png';

    return (
        <Helmet>
            {/* Standard Meta Tags */}
            <title>{fullTitle}</title>
            <meta name="description" content={metaDescription} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={fullUrl} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={metaDescription} />
            <meta property="og:image" content={metaImage} />
            <meta property="og:site_name" content={siteName} />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:url" content={fullUrl} />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={metaDescription} />
            <meta name="twitter:image" content={metaImage} />

            {/* Schema.org JSON-LD */}
            {schemaData && (
                <script type="application/ld+json">
                    {JSON.stringify(schemaData)}
                </script>
            )}
        </Helmet>
    );
};

export default SEO;
