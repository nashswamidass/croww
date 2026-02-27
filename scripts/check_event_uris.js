const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, limit } = require('firebase/firestore');

// Hardcode config for script execution
const firebaseConfig = {
    apiKey: "AIzaSyDaBIQfycxVH8b2p-Z0SsJZTH-57WIwkts",
    authDomain: "croww-live-2026.firebaseapp.com",
    projectId: "croww-live-2026",
    storageBucket: "croww-live-2026.firebasestorage.app",
    messagingSenderId: "871336486604",
    appId: "1:871336486604:web:80e2f6b627aa8224350469"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkEvents() {
    console.log("Fetching events...");
    try {
        const eventsRef = collection(db, 'events');
        // Get last 20 events
        const q = query(eventsRef, limit(20));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log("No events found.");
            return;
        }

        console.log(`Found ${snapshot.size} events. Checking image URIs...\n`);

        snapshot.forEach(doc => {
            const data = doc.data();
            let dateStr = 'N/A';
            try {
                if (data.date && data.date.seconds) {
                    dateStr = new Date(data.date.seconds * 1000).toISOString();
                } else if (data.date) {
                    dateStr = String(data.date);
                }
            } catch (e) {
                dateStr = 'Invalid Date';
            }
            const uri = data.imageUri;
            console.log(`-- Event: ${data.title} (ID: ${doc.id})`);
            console.log(`   Date: ${dateStr}`);
            console.log(`   Image URI: ${uri}`);
            console.log(`URI Type: ${typeof uri}`);
            if (uri) {
                if (uri.startsWith('http')) console.log("- Protocol: HTTP/HTTPS");
                else if (uri.startsWith('file://')) console.log("- Protocol: FILE (Local)");
                else if (uri.startsWith('content://')) console.log("- Protocol: CONTENT (Local)");
                else if (uri.startsWith('gs://')) console.log("- Protocol: GS (Firebase Storage Reference)");
                else console.log("- Protocol: UNKNOWN");
            } else {
                console.log("- No Image URI");
            }
            console.log('-------------------');
        });
    } catch (error) {
        console.error("Error fetching events:", error);
    }
}

checkEvents();
