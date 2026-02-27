/**
 * SEO Content for Landing Pages
 * Tailored summaries and titles for top cities and categories
 */

export const CITY_SEO_CONTENT = {
    'chennai': {
        heading: 'Events in Chennai',
        title: 'Events in Chennai – Concerts, Festivals & Tickets | Croww',
        summary: 'Explore the vibrant event scene in Chennai! From classical music concerts and traditional festivals to modern tech meetups and parties, find everything happening in the gateway to South India.',
        description: 'Find the best events in Chennai. Browse concerts, festivals, parties and more. Book tickets and find event buddies on Croww.',
        keywords: 'chennai events, concerts in chennai, festivals in chennai, music shows chennai, tech events chennai'
    },
    'bangalore': {
        heading: 'Events in Bangalore',
        title: 'Events in Bangalore – DJ Nights, Tech & Shows | Croww',
        summary: 'Discover the pulse of the Silicon Valley of India. Bangalore offers a diverse range of events, including top-tier DJ nights, networking meetups, and open-mic shows. Don\'t miss out!',
        description: 'Explore events in Bangalore (Bengaluru). From pub crawls to coding workshops, find what\'s buzzing in the city today.',
        keywords: 'bangalore events, dj nights bangalore, tech meetups bangalore, comedy shows bangalore'
    },
    'mumbai': {
        heading: 'Events in Mumbai',
        title: 'Events in Mumbai – Bollywood, Art & Nightlife | Croww',
        summary: 'Experience the magic of the city that never sleeps. Mumbai\'s event calendar is packed with Bollywood screenings, art exhibitions at Kalaghoda, and legendary nightlife events.',
        description: 'Find all the top events in Mumbai. Book tickets for theater, concerts, and exclusive parties on Croww.',
        keywords: 'mumbai events, bollywood shows mumbai, art festivals mumbai, nightlife mumbai'
    },
    'delhi': {
        heading: 'Events in Delhi',
        title: 'Events in Delhi – History, Food & Gigs | Croww',
        summary: 'From food festivals in Old Delhi to high-profile gigs in Gurgaon and Noida, the National Capital Region (NCR) has something for everyone. Stay updated with Croww.',
        description: 'Discover events in Delhi NCR. Festivals, food walks, and music gigs happening near you.',
        keywords: 'delhi events, ncr gigs, food festivals delhi, exhibitions delhi'
    },
    'goa': {
        heading: 'Events in Goa',
        title: 'Events in Goa – Beach Parties & Festivals | Croww',
        summary: 'Sunshine, sea, and soulful events. Goa is the ultimate destination for beach music festivals, wellness retreats, and vibrant night markets.',
        description: 'Find beach parties, music festivals and flea markets in Goa. Your guide to the best events in the party capital.',
        keywords: 'goa events, sunburn goa, beach parties goa, fleas goa'
    }
};

export const CATEGORY_SEO_CONTENT = {
    'festivals': {
        heading: 'Festival Events',
        title: 'Festival Events – Music, Arts & Culture | Croww',
        summary: 'Immerse yourself in celebration! Explore festivals ranging from multi-day music extravaganzas to cultural and art exhibitions across the country.',
        description: 'Explore the best festival events. Discover top-rated music, art, and cultural festivals. Join the community on Croww.',
        keywords: 'music festivals, art festivals, cultural events, ticketed festivals india'
    },
    'music': {
        heading: 'Music Concerts & Gigs',
        title: 'Music Events – Live Concerts, Gigs & Sets | Croww',
        summary: 'Find your rhythm. Whether it\'s a stadium concert by global stars or an intimate gig at a local café, track all music events right here.',
        description: 'Discover live music events near you. Concerts, DJ sets, and unplugged sessions on Croww.',
        keywords: 'live music, concerts india, dj sets, music gigs'
    },
    'tech': {
        heading: 'Tech & Business Events',
        title: 'Tech Events – Workshops, Meetups & Summits | Croww',
        summary: 'Network with best. Join tech workshops, startup summits, and business networking events to stay ahead in the industry.',
        description: 'Find technology and business events. Networking, workshops, and summits on Croww.',
        keywords: 'tech meetups, startup events, coding workshops, business summits'
    },
    'art': {
        heading: 'Art & Culture',
        title: 'Art Events – Exhibitions, Theater & More | Croww',
        summary: 'Witness creativity in action. Explore art exhibitions, theater performances, and workshops that celebrate the human spirit.',
        description: 'Discover art and culture events. Theater plays, gallery openings, and creative workshops.',
        keywords: 'art exhibitions, theater shows, culture events, creative workshops'
    }
};

export const getSEOContent = (type, id) => {
    const cleanId = id.split('-')[0].toLowerCase();
    const content = type === 'city' ? CITY_SEO_CONTENT[cleanId] : CATEGORY_SEO_CONTENT[cleanId];
    return content || null;
};
