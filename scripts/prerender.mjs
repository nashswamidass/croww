import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

/**
 * Robust Prerender Script for Croww
 * Generates static HTML for Home, Cities, Categories, Events, and Providers.
 */

// 1. Manual .env parsing to avoid dependency issues in build script
const envPath = path.resolve(process.cwd(), '.env');
const env = {};
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) env[key.trim()] = value.trim();
    });
}

// 2. Initialize Firebase
const firebaseConfig = {
    apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.EXPO_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 3. Static SEO Content Fallbacks
const CITY_SEO_CONTENT = {
    'chennai': {
        heading: 'Events in Chennai',
        title: 'Events in Chennai – Concerts, Festivals & Tickets | Croww',
        summary: 'Explore the vibrant event scene in Chennai! From classical music concerts and traditional festivals to modern tech meetups and parties.',
        description: 'Find the best events in Chennai. Browse concerts, festivals, parties and more on Croww.'
    },
    'bangalore': {
        heading: 'Events in Bangalore',
        title: 'Events in Bangalore – DJ Nights, Tech & Shows | Croww',
        summary: 'Discover the pulse of the Silicon Valley of India. Bangalore offers a diverse range of DJ nights, networking meetups, and open-mic shows.',
        description: 'Explore events in Bangalore (Bengaluru). From pub crawls to coding workshops on Croww.'
    },
    'mumbai': {
        heading: 'Events in Mumbai',
        title: 'Events in Mumbai – Bollywood, Art & Nightlife | Croww',
        summary: 'Experience the magic of the city that never sleeps. Mumbai\'s event calendar is packed with Bollywood screenings and art exhibitions.',
        description: 'Find all the top events in Mumbai. Book tickets for theater, concerts, and exclusive parties on Croww.'
    }
};

const CATEGORY_SEO_CONTENT = {
    'festivals': {
        heading: 'Festival Events',
        title: 'Festival Events – Music, Arts & Culture | Croww',
        summary: 'Immerse yourself in celebration! Explore festivals ranging from music extravaganzas to cultural and art exhibitions.',
        description: 'Explore the best festival events. Discover top-rated music, art, and cultural festivals on Croww.'
    }
};

const DIST_DIR = path.resolve(process.cwd(), 'dist');
const TEMPLATE_PATH = path.join(DIST_DIR, 'index.html');

async function fetchRoutes() {
    console.log('📡 Fetching all routes for prerendering...');
    const routes = [
        { path: '/', title: 'Croww – Find Exclusive Events & Buddies', description: 'Join exclusive events and find event buddies on Croww.' },
        ...Object.entries(CITY_SEO_CONTENT).map(([id, content]) => ({
            path: `/cities/${id}-events`,
            ...content
        })),
        ...Object.entries(CATEGORY_SEO_CONTENT).map(([id, content]) => ({
            path: `/categories/${id}`,
            ...content
        }))
    ];

    try {
        // Fetch Top 50 Events
        const eventsSnap = await getDocs(collection(db, 'events'));
        eventsSnap.forEach(doc => {
            const data = doc.data();
            routes.push({
                path: `/event/${doc.id}`,
                title: `${data.title} | Croww`,
                description: data.description || 'Join this exclusive event on Croww.',
                heading: data.title,
                summary: data.description,
                image: data.imageUri
            });
        });

        // Fetch Service Providers
        const usersSnap = await getDocs(query(collection(db, 'users'), where('userType', 'in', ['business', 'provider'])));
        usersSnap.forEach(doc => {
            const data = doc.data();
            routes.push({
                path: `/provider/${doc.id}`,
                title: `${data.name} | Professional on Croww`,
                description: data.about || data.bio || 'Check out this professional profile on Croww.',
                heading: data.name,
                summary: data.about || data.bio,
                image: data.profileImage || data.avatarUrl
            });
        });
    } catch (err) {
        console.error('⚠️ Warning: Dynamic fetch failed. Proceeding with static routes only.', err.message);
    }

    return routes;
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
}

async function run() {
    console.log('🏁 Starting Prerender Engine...');

    if (!fs.existsSync(TEMPLATE_PATH)) {
        console.error('❌ Template not found at dist/index.html');
        process.exit(1);
    }

    const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
    const routes = await fetchRoutes();

    for (const route of routes) {
        console.log(`📄 Generating: ${route.path}`);

        let html = template;
        const title = escapeHtml(route.title);
        const desc = escapeHtml(route.description);
        const img = route.image || 'https://croww.ai/assets/images/og-image.png';

        // Update Meta Tags
        html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);

        const tags = `
    <meta name="description" content="${desc}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:url" content="https://croww.ai${route.path}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
        `.trim();

        html = html.replace('</head>', `    ${tags}\n  </head>`);

        // Inject Static Content into #root
        const bodyHtml = `
            <div style="padding: 40px; font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto;">
                <img src="${img}" style="width: 100%; border-radius: 12px; margin-bottom: 24px;" />
                <h1 style="font-size: 32px; margin-bottom: 16px;">${escapeHtml(route.heading || 'Croww')}</h1>
                <p style="font-size: 18px; line-height: 1.6; color: #444;">${escapeHtml(route.summary || route.description)}</p>
                <div style="margin-top: 40px; padding: 20px; border-top: 1px solid #eee;">
                    <p><strong>Experience the full version on Croww:</strong></p>
                    <a href="https://croww.ai" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 6px;">Open App</a>
                </div>
            </div>
        `.trim();

        html = html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);

        // Save File
        const outDir = path.join(DIST_DIR, ...route.path.split('/').filter(Boolean));
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'index.html'), html);
    }

    console.log(`✨ Prerendered ${routes.length} pages successfully!`);
    process.exit(0);
}

run();
