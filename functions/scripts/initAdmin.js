/**
 * Initialize firebase-admin for local scripts.
 * Prefers GOOGLE_APPLICATION_CREDENTIALS; otherwise writes a temporary
 * authorized-user ADC file from the Firebase CLI login (never printed).
 * Never guesses a project id.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const admin = require("firebase-admin");

// Public OAuth client embedded in firebase-tools (not a Croww secret).
const FIREBASE_TOOLS_CLIENT_ID =
    "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const FIREBASE_TOOLS_CLIENT_SECRET = "jEQPZWeas_2qQ3RLrJnOJCKF";

function loadFirebaseToolsRefreshToken() {
    const configPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
    if (!fs.existsSync(configPath)) {
        throw new Error("Firebase CLI login not found. Run `firebase login`.");
    }
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const refreshToken = parsed?.tokens?.refresh_token;
    if (!refreshToken || typeof refreshToken !== "string") {
        throw new Error("Firebase CLI refresh token missing. Run `firebase login`.");
    }
    return refreshToken;
}

function writeTemporaryAdc(projectId) {
    const adcPath = path.join(os.tmpdir(), `croww-adc-${projectId}.json`);
    const payload = {
        type: "authorized_user",
        client_id: FIREBASE_TOOLS_CLIENT_ID,
        client_secret: FIREBASE_TOOLS_CLIENT_SECRET,
        refresh_token: loadFirebaseToolsRefreshToken(),
    };
    fs.writeFileSync(adcPath, JSON.stringify(payload), { mode: 0o600 });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
    return adcPath;
}

function initAdmin(projectId) {
    if (!projectId) {
        throw new Error("initAdmin requires an explicit projectId.");
    }
    if (admin.apps.length) {
        return admin.app();
    }
    process.env.NO_GCE_CHECK = "true";
    process.env.GCLOUD_PROJECT = projectId;
    process.env.GOOGLE_CLOUD_PROJECT = projectId;
    process.env.FIRESTORE_PREFER_REST = process.env.FIRESTORE_PREFER_REST || "true";
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        writeTemporaryAdc(projectId);
    }
    return admin.initializeApp({ projectId });
}

module.exports = { initAdmin };
