const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = '/Users/nashnewton/.gemini/antigravity-ide/brain/87ee7bae-aafb-4d91-932f-dcf471c0ea08';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'audit_screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function adb(cmd) {
    try {
        return execSync(`adb ${cmd}`, { encoding: 'utf8', timeout: 30000 });
    } catch (e) {
        console.warn(`ADB Error [${cmd}]:`, e.message);
        return '';
    }
}

function sleep(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {}
}

function captureScreenshot(name) {
    const remotePath = `/sdcard/${name}.png`;
    const localPath = path.join(SCREENSHOT_DIR, `${name}.png`);
    adb(`shell screencap -p ${remotePath}`);
    adb(`pull ${remotePath} "${localPath}"`);
    adb(`shell rm ${remotePath}`);
    console.log(`Captured: ${name}.png -> ${localPath}`);
    return localPath;
}

function tap(x, y) {
    adb(`shell input tap ${x} ${y}`);
    sleep(1500);
}

function keyevent(code) {
    adb(`shell input keyevent ${code}`);
    sleep(1500);
}

function text(t) {
    adb(`shell input text "${t}"`);
    sleep(1000);
}

console.log('=== RUNTIME AUDIT SUITE STARTING ===');
console.log('Artifact screenshot directory:', SCREENSHOT_DIR);

module.exports = {
    adb,
    sleep,
    captureScreenshot,
    tap,
    keyevent,
    text,
    SCREENSHOT_DIR
};
