const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { adb, sleep, captureScreenshot, tap, keyevent, text, SCREENSHOT_DIR } = require('./runtimeAuditSuite');

async function run() {
    console.log('--- Step 1: Install Release APK ---');
    const apkPath = path.resolve(__dirname, '../android/app/build/outputs/apk/release/app-release.apk');
    if (!fs.existsSync(apkPath)) {
        throw new Error('Release APK not found at: ' + apkPath);
    }
    console.log('Installing release APK...');
    adb(`install -r "${apkPath}"`);

    console.log('--- Step 2: Grant permissions & clean start ---');
    // Clear app data to test first launch & permission prompts
    adb('shell pm clear com.croww.app');
    sleep(1500);

    // Ensure device is at home screen first
    adb('shell input keyevent 3');
    sleep(1000);

    // Launch App cleanly
    console.log('Launching com.croww.app/.MainActivity...');
    adb('shell am start -W -n com.croww.app/.MainActivity');
    sleep(5000);

    // 19. Native notification permission prompt (or Home initial)
    console.log('Capturing 19_native_notification_permission_prompt...');
    captureScreenshot('19_native_notification_permission_prompt');

    // Tap "Allow" on permission dialog if present (usually middle-right or accept)
    // On Android 13+ dialog, "Allow" is typically at center-right
    // Let's grant notification permission via pm if not already granted so UI flow can proceed
    adb('shell pm grant com.croww.app android.permission.POST_NOTIFICATIONS');
    adb('shell pm grant com.croww.app android.permission.ACCESS_FINE_LOCATION');
    sleep(2000);

    // 1. Home
    console.log('Capturing 01_home...');
    captureScreenshot('01_home');

    // 2. Home empty state (in non-Chennai city or high filter)
    console.log('Switching to Bengaluru / empty state...');
    // Tap city pill
    tap(180, 130);
    sleep(2000);
    console.log('Capturing 02_home_empty_state...');
    captureScreenshot('02_home_empty_state');

    // Switch back to Chennai for full exploration
    tap(180, 130);
    sleep(2000);

    // 3. Home with real/QA inventory
    console.log('Capturing 03_home_inventory...');
    captureScreenshot('03_home_inventory');

    // 5. Post landing
    console.log('Navigating to Post Tab...');
    // Bottom tab bar: Post is center button (approx x=540, y=2250 on 1080x2400)
    // Let's get screen dimensions
    const wmSize = adb('shell wm size');
    const match = wmSize.match(/(\d+)x(\d+)/);
    const width = match ? parseInt(match[1], 10) : 1080;
    const height = match ? parseInt(match[2], 10) : 2400;
    console.log(`Device resolution: ${width}x${height}`);

    const tabY = height - 120;
    const exploreTabX = Math.floor(width * 0.12);
    const savedTabX = Math.floor(width * 0.32);
    const postTabX = Math.floor(width * 0.50);
    const areasTabX = Math.floor(width * 0.68);
    const profileTabX = Math.floor(width * 0.88);

    // Tap Post Tab
    tap(postTabX, tabY);
    sleep(2500);
    console.log('Capturing 05_post_landing...');
    captureScreenshot('05_post_landing');

    // Tap "Bed" category (first category card)
    tap(width / 2, 750);
    sleep(2000);
    console.log('Capturing 06_post_category...');
    captureScreenshot('06_post_category');

    // Tap Continue to Form
    tap(width / 2, height - 200);
    sleep(2000);
    console.log('Capturing 07_post_form...');
    captureScreenshot('07_post_form');

    // Fill title
    tap(width / 2, 600);
    text('Pre-Production Verified Bed in OMR');
    keyevent(66); // ENTER
    keyevent(4);  // BACK KEY to dismiss keyboard
    sleep(1000);

    // Tap Continue to Review
    tap(width / 2, height - 150);
    sleep(2000);
    console.log('Capturing 08_post_review...');
    captureScreenshot('08_post_review');

    // Submit Draft
    tap(width / 2, height - 150);
    sleep(3000);
    console.log('Capturing 09_listing_detail_after_creation...');
    captureScreenshot('09_listing_detail_after_creation');

    // Back to Post Tab
    keyevent(4);
    sleep(1500);

    // 12. Areas intro
    console.log('Navigating to Areas Tab...');
    tap(areasTabX, tabY);
    sleep(3000);
    console.log('Capturing 12_areas_intro...');
    captureScreenshot('12_areas_intro');

    // Tap "Start Personalization" / Next
    tap(width / 2, height - 250);
    sleep(2000);
    console.log('Capturing 13_areas_wizard...');
    captureScreenshot('13_areas_wizard');

    // Walk through wizard steps (tap option then Next)
    for (let step = 1; step <= 4; step++) {
        tap(width / 2, 800); // select option
        tap(width / 2, height - 200); // tap next
        sleep(1500);
    }
    // Final step calculation
    tap(width / 2, 800);
    tap(width / 2, height - 200);
    sleep(4000);

    // 14. Intelligence map
    console.log('Capturing 14_intelligence_map...');
    captureScreenshot('14_intelligence_map');

    // Tap a locality score pin on the map
    tap(width / 2, height / 2);
    sleep(2000);
    console.log('Capturing 15_locality_detail...');
    captureScreenshot('15_locality_detail');

    // Close locality sheet or back to normal Explore
    tap(width - 100, 200);
    sleep(1500);

    // 16. Profile
    console.log('Navigating to Profile Tab...');
    tap(profileTabX, tabY);
    sleep(2500);
    console.log('Capturing 16_profile...');
    captureScreenshot('16_profile');

    // 10. Inventory Dashboard (from Profile or Post)
    // Tap "My listings" card on Profile (second main item)
    tap(width / 2, 680);
    sleep(2500);
    console.log('Capturing 10_inventory...');
    captureScreenshot('10_inventory');
    keyevent(4); // back to Profile
    sleep(1500);

    // 11. Messages (tap Messages on Profile)
    tap(width / 2, 880);
    sleep(2500);
    console.log('Capturing 11_messages...');
    captureScreenshot('11_messages');
    keyevent(4); // back to Profile
    sleep(1500);

    // 17. Settings (tap Settings on Profile)
    tap(width / 2, 1080);
    sleep(2500);
    console.log('Capturing 17_settings...');
    captureScreenshot('17_settings');

    // 18. Notification settings (tap Notification Preferences on Settings)
    tap(width / 2, 700);
    sleep(2500);
    console.log('Capturing 18_notification_settings...');
    captureScreenshot('18_notification_settings');

    // 20. Notification received (tap "Send Test Notification" on Notification Settings)
    console.log('Dispatching test notification...');
    // Scroll down to test button
    adb(`shell input swipe ${width / 2} 1600 ${width / 2} 600 300`);
    sleep(1500);
    // Tap Send Test Notification
    tap(width / 2, 1200);
    sleep(2000);

    // Pull down notification shade to capture notification
    adb('shell cmd statusbar expand-notifications');
    sleep(2000);
    console.log('Capturing 20_notification_received...');
    captureScreenshot('20_notification_received');

    // 21. Notification-tap destination: tap notification to trigger deep link
    tap(width / 2, 450);
    sleep(3000);
    console.log('Capturing 21_notification_tap_destination...');
    captureScreenshot('21_notification_tap_destination');

    // Back to explore
    tap(exploreTabX, tabY);
    sleep(2000);

    // 4. Property Detail
    console.log('Opening listing detail...');
    // Tap the bottom sheet peek card or first listing
    tap(width / 2, height - 350);
    sleep(3000);
    console.log('Capturing 04_property_detail...');
    captureScreenshot('04_property_detail');

    // 23. Location permission/request state on property detail
    // Scroll down to location privacy card
    adb(`shell input swipe ${width / 2} 1600 ${width / 2} 600 300`);
    sleep(1500);
    console.log('Capturing 23_location_request_state...');
    captureScreenshot('23_location_request_state');

    // 24. 3D / Spatial state
    // Scroll down to 3D section if present
    adb(`shell input swipe ${width / 2} 1600 ${width / 2} 800 300`);
    sleep(1500);
    console.log('Capturing 24_spatial_3d_state...');
    captureScreenshot('24_spatial_3d_state');

    // 22. Auth prompt
    // Tap Save button while logged out
    tap(width - 120, 150);
    sleep(2000);
    console.log('Capturing 22_auth_prompt...');
    captureScreenshot('22_auth_prompt');

    console.log('=== ALL AUDIT FLOWS EXECUTED SUCCESSFULLY ===');
}

run().catch(err => {
    console.error('Audit run failed:', err);
    process.exit(1);
});
