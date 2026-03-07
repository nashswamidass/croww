const puppeteer = require('puppeteer-core');

const delay = ms => new Promise(res => setTimeout(res, ms));

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: "new",
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();
    
    try {
        console.log("Navigating to app...");
        await page.goto('http://localhost:19006', { timeout: 30000, waitUntil: 'networkidle2' });
        await delay(5000);
        
        // Log in
        console.log("Checking for Login screen...");
        const loginTexts = await page.$x("//div[contains(text(), 'Login')]");
        if (loginTexts.length > 0) {
            console.log("On login screen. Entering credentials...");
            // Use a test account or the one we know works from previous sessions
            // Assuming there's an email input and password input
            const inputs = await page.$$('input');
            if (inputs.length >= 2) {
                await inputs[0].type('nash@croww.ai'); // A known test account format we used earlier
                await inputs[1].type('password123'); // Guessing standard test password, or we can just bypass and rely on code review
                
                const loginBtn = await page.$x("//div[text()='Login']");
                if (loginBtn.length > 0) {
                    await loginBtn[0].click();
                    await delay(5000); // Wait for auth and navigation
                }
            }
        }
        
        console.log("Looking for Create Event (+) button...");
        const createBtns = await page.$x("//div[text()='+']");
        
        if (createBtns.length > 0) {
            console.log("Found + button, clicking it...");
            await createBtns[0].click();
            await delay(2000);
            
            console.log("Checking if we are on Create Event screen...");
            const publicText = await page.$x("//div[contains(text(), 'Public Event')]");
            if (publicText.length > 0) {
                console.log("Successfully navigated to Create Event screen.");
                
                const switches = await page.$$('input[type="checkbox"]');
                console.log(`Found ${switches.length} switches on the page.`);
                
                if (switches.length >= 2) {
                    console.log("Testing Public Event toggle...");
                    await switches[0].click();
                    await delay(1000);
                    
                    const alertText = await page.evaluate(() => {
                        const divs = Array.from(document.querySelectorAll('div'));
                        const alertDiv = divs.find(d => d.textContent.includes('Verification Required') || d.textContent.includes('verify now'));
                        return alertDiv ? alertDiv.textContent : null;
                    });
                    
                    if (alertText) {
                        console.log(">>> Found Verification Alert when clicking Public: ", alertText.substring(0, 100));
                    } else {
                        console.log(">>> No Verification Alert found when clicking Public.");
                    }
                    
                    // Dismiss alert
                    const laterBtn = await page.$x("//div[text()='Later' or text()='Cancel' or text()='OK']");
                    if (laterBtn.length > 0) {
                         await laterBtn[0].click();
                         await delay(500);
                    }

                    console.log("Testing Paid Event toggle...");
                    await switches[1].click(); 
                    await delay(1000);
                    
                    const paidAlertText = await page.evaluate(() => {
                        const divs = Array.from(document.querySelectorAll('div'));
                        const alertDiv = divs.find(d => d.textContent.includes('Business Verification Required') || d.textContent.includes('verified business accounts'));
                        return alertDiv ? alertDiv.textContent : null;
                    });
                    
                    if (paidAlertText) {
                        console.log(">>> Found Paid Alert when clicking Paid: ", paidAlertText.substring(0, 100));
                    } else {
                        console.log(">>> No Verification Alert found when clicking Paid.");
                    }
                }
            } else {
                console.log("Could not find 'Public Event' text on screen.");
            }
        } else {
             console.log("Could not find Create Event (+) button after attempted login.");
        }

    } catch (e) {
        console.error("Test error:", e);
    } finally {
        await browser.close();
    }
})();
