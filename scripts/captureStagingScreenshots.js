/**
 * Capture 6 staging verification screenshots using puppeteer-core and local Chrome.
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ARTIFACTS_DIR = '/Users/nashnewton/.gemini/antigravity-ide/brain/87ee7bae-aafb-4d91-932f-dcf471c0ea08';

async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

const { getDoc, patchDoc } = require('../functions/scripts/cliFirestore');

const PROJECT_ID = 'croww-staging-2026';

async function setPgPosting(enabled) {
    await patchDoc(PROJECT_ID, 'listingTaxonomy/pg', {
        postingEnabled: enabled,
        updatedAt: new Date().toISOString(),
    });
    console.log(`  [Firestore Staging] Updated listingTaxonomy/pg postingEnabled -> ${enabled}`);
}

async function main() {
    console.log('[captureStagingScreenshots] Launching Chrome...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
        ],
    });

    try {
        const page = await browser.newPage();

        // 0. Ensure PG posting is true
        await setPgPosting(true);

        // 1. Admin Listing Types page
        console.log('1. Capturing Admin Listing Types...');
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto('http://localhost:4174/preview-listing-taxonomy', { waitUntil: 'domcontentloaded' });
        await sleep(2500);
        const adminImg1 = path.join(ARTIFACTS_DIR, 'staging_01_admin_listing_types.png');
        await page.screenshot({ path: adminImg1, fullPage: false });
        console.log('  ✔ Saved:', adminImg1);

        // 2. PG Posting ON
        console.log('2. Capturing PG Posting ON...');
        const adminImg2 = path.join(ARTIFACTS_DIR, 'staging_02_pg_posting_on.png');
        await page.screenshot({ path: adminImg2, fullPage: false });
        console.log('  ✔ Saved:', adminImg2);

        // 3. Toggle PG Posting OFF in Firestore via Admin
        console.log('3. Setting PG posting OFF on staging...');
        await setPgPosting(false);
        await page.goto('http://localhost:4174/preview-listing-taxonomy', { waitUntil: 'domcontentloaded' });
        await sleep(2000);
        const adminImg3 = path.join(ARTIFACTS_DIR, 'staging_03_pg_posting_off.png');
        await page.screenshot({ path: adminImg3, fullPage: false });
        console.log('  ✔ Saved:', adminImg3);

        // 4. Consumer Post Screen with PG Hidden
        console.log('4. Capturing Consumer Post screen with PG hidden...');
        await page.setViewport({ width: 390, height: 844 });
        await page.goto('http://localhost:8081', { waitUntil: 'domcontentloaded' });
        await sleep(4000);

        // Click Post tab on [role="tab"]
        await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('[role="tab"], a, button'));
            const postTab = tabs.find((t) => t.textContent && t.textContent.includes('Post'));
            if (postTab) postTab.click();
        });
        await sleep(2500);

        const consumerImg4 = path.join(ARTIFACTS_DIR, 'staging_04_consumer_post_pg_hidden.png');
        await page.screenshot({ path: consumerImg4, fullPage: false });
        console.log('  ✔ Saved:', consumerImg4);

        // 5. Restore PG posting in Firestore & reload Consumer Post
        console.log('5. Restoring PG posting ON on staging...');
        await setPgPosting(true);
        await sleep(2500);

        console.log('5b. Capturing Consumer Post screen with PG restored in incognito context...');
        const incognito = await browser.createBrowserContext();
        const pageRestored = await incognito.newPage();
        await pageRestored.setViewport({ width: 390, height: 844 });
        await pageRestored.goto('http://localhost:8081', { waitUntil: 'domcontentloaded' });
        await sleep(4000);

        // Click Post tab on [role="tab"]
        await pageRestored.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('[role="tab"], a, button'));
            const postTab = tabs.find((t) => t.textContent && t.textContent.includes('Post'));
            if (postTab) postTab.click();
        });
        await sleep(3000);

        const consumerImg5 = path.join(ARTIFACTS_DIR, 'staging_05_consumer_post_pg_restored.png');
        await pageRestored.screenshot({ path: consumerImg5, fullPage: false });
        console.log('  ✔ Saved:', consumerImg5);
        await incognito.close();

        // 6. Dynamic Explore Categories
        console.log('6. Capturing Dynamic Explore Categories...');
        await page.goto('http://localhost:8081', { waitUntil: 'domcontentloaded' });
        await sleep(2500);

        const consumerImg6 = path.join(ARTIFACTS_DIR, 'staging_06_dynamic_explore_categories.png');
        await page.screenshot({ path: consumerImg6, fullPage: false });
        console.log('  ✔ Saved:', consumerImg6);

        console.log('\n[captureStagingScreenshots] All 6 screenshots captured successfully!');
    } finally {
        await browser.close();
    }
}

main().catch((err) => {
    console.error('[captureStagingScreenshots] Failed:', err);
    process.exit(1);
});
