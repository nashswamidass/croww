/**
 * Firestore REST helper for local staging/production scripts.
 * Uses the Firebase CLI access token (IAM), which bypasses security rules.
 * Does not print tokens. Never guesses a project id.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

function cliAccessToken() {
    const configPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const tokens = parsed?.tokens || {};
    if (!tokens.access_token || Number(tokens.expires_at) <= Date.now() + 30 * 1000) {
        throw new Error("Firebase CLI access token missing or expired. Run `firebase login`.");
    }
    return tokens.access_token;
}

function decodeValue(value) {
    if (!value || typeof value !== "object") return null;
    if ("nullValue" in value) return null;
    if ("booleanValue" in value) return value.booleanValue;
    if ("integerValue" in value) return Number(value.integerValue);
    if ("doubleValue" in value) return value.doubleValue;
    if ("stringValue" in value) return value.stringValue;
    if ("timestampValue" in value) return new Date(value.timestampValue);
    if ("geoPointValue" in value) {
        return {
            latitude: value.geoPointValue.latitude,
            longitude: value.geoPointValue.longitude,
        };
    }
    if ("arrayValue" in value) {
        return (value.arrayValue.values || []).map(decodeValue);
    }
    if ("mapValue" in value) {
        return decodeMap(value.mapValue.fields || {});
    }
    if ("referenceValue" in value) return value.referenceValue;
    return null;
}

function decodeMap(fields) {
    const out = {};
    Object.entries(fields || {}).forEach(([key, value]) => {
        out[key] = decodeValue(value);
    });
    return out;
}

function encodeValue(value) {
    if (value === null || value === undefined) return { nullValue: null };
    if (typeof value === "boolean") return { booleanValue: value };
    if (typeof value === "number") {
        return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    }
    if (typeof value === "string") return { stringValue: value };
    if (value instanceof Date) return { timestampValue: value.toISOString() };
    if (Array.isArray(value)) {
        return { arrayValue: { values: value.map(encodeValue) } };
    }
    if (value && typeof value === "object") {
        if (Object.prototype.hasOwnProperty.call(value, "latitude")
            && Object.prototype.hasOwnProperty.call(value, "longitude")
            && Object.keys(value).length <= 3) {
            return {
                geoPointValue: {
                    latitude: value.latitude,
                    longitude: value.longitude,
                },
            };
        }
        return { mapValue: { fields: encodeMap(value) } };
    }
    return { stringValue: String(value) };
}

function encodeMap(data) {
    const fields = {};
    Object.entries(data || {}).forEach(([key, value]) => {
        if (value === undefined) return;
        fields[key] = encodeValue(value);
    });
    return fields;
}

function docName(projectId, docPath) {
    return `projects/${projectId}/databases/(default)/documents/${docPath}`;
}

async function firestoreRequest(projectId, method, urlPath, body) {
    const token = cliAccessToken();
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/${urlPath}`;
    const response = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (error) {
        json = { raw: text.slice(0, 300) };
    }
    if (!response.ok) {
        const message = json.error?.message || text.slice(0, 300) || `HTTP ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        throw err;
    }
    return json;
}

function idFromName(name) {
    return String(name || "").split("/").pop();
}

async function listCollection(projectId, collectionId, pageSize = 200) {
    const docs = [];
    let pageToken = "";
    do {
        const qs = `pageSize=${pageSize}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
        const json = await firestoreRequest(projectId, "GET", `documents/${collectionId}?${qs}`);
        (json.documents || []).forEach((row) => {
            docs.push({
                id: idFromName(row.name),
                path: row.name.replace(`projects/${projectId}/databases/(default)/documents/`, ""),
                data: decodeMap(row.fields || {}),
            });
        });
        pageToken = json.nextPageToken || "";
    } while (pageToken);
    return docs;
}

async function getDoc(projectId, docPath) {
    try {
        const json = await firestoreRequest(projectId, "GET", `documents/${docPath}`);
        return {
            exists: true,
            id: idFromName(json.name),
            path: docPath,
            data: decodeMap(json.fields || {}),
        };
    } catch (error) {
        if (error.status === 404) {
            return { exists: false, id: idFromName(docPath), path: docPath, data: null };
        }
        throw error;
    }
}

async function setDoc(projectId, docPath, data) {
    const fields = encodeMap(data);
    const query = `documentId=${encodeURIComponent(docPath.split("/").pop())}`;
    const parent = docPath.split("/").slice(0, -1).join("/");
    return firestoreRequest(projectId, "POST", `documents/${parent}?${query}`, { fields });
}

async function patchDoc(projectId, docPath, data) {
    const fieldPaths = Object.keys(data);
    const mask = fieldPaths.map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`).join("&");
    return firestoreRequest(projectId, "PATCH", `documents/${docPath}?${mask}`, {
        fields: encodeMap(data),
    });
}

async function queryWhere(projectId, collectionId, field, op, value) {
    const json = await firestoreRequest(projectId, "POST", "documents:runQuery", {
        structuredQuery: {
            from: [{ collectionId }],
            where: {
                fieldFilter: {
                    field: { fieldPath: field },
                    op,
                    value: encodeValue(value),
                },
            },
        },
    });
    return (Array.isArray(json) ? json : [])
        .filter((row) => row.document)
        .map((row) => ({
            id: idFromName(row.document.name),
            path: row.document.name.replace(`projects/${projectId}/databases/(default)/documents/`, ""),
            data: decodeMap(row.document.fields || {}),
        }));
}

async function commitWrites(projectId, writes) {
    return firestoreRequest(projectId, "POST", "documents:commit", { writes });
}

module.exports = {
    decodeMap,
    encodeMap,
    encodeValue,
    docName,
    listCollection,
    getDoc,
    setDoc,
    patchDoc,
    queryWhere,
    commitWrites,
    cliAccessToken,
};
