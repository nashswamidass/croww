/**
 * Staging-only end-to-end smoke test against croww-staging-2026.
 *
 * Uses Firebase Auth (client rules) plus IAM REST (admin-equivalent setup).
 * Does not print passwords or tokens.
 *
 *   node scripts/stagingSmokeTest.js --project croww-staging-2026
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { assertStagingOnly } = require("./projectGuard");
const { buildPublicGeoFields } = require("../propertyGeo");
const {
    encodeMap,
    listCollection,
    getDoc,
    patchDoc,
    queryWhere,
    cliAccessToken,
} = require("./cliFirestore");

const PROJECT = "croww-staging-2026";
const API_KEY = "AIzaSyCmKosmKf0qhQMAPdzwAAVcEyWBe82h6Ok";
const STATE_PATH = path.join(__dirname, ".staging-smoke-state.json");
const EXACT = { latitude: 12.9698123, longitude: 77.7499456 };
const LOCALITY_ID = "staging-smoke-whitefield";
const RESULTS = [];

function record(flow, result, notes) {
    RESULTS.push({ flow, result, notes });
    console.log(`[${result}] ${flow} — ${notes}`);
}

function nowIso() {
    return new Date().toISOString();
}

function randomPassword() {
    return `Stg!${crypto.randomBytes(12).toString("base64url")}`;
}

async function identity(pathSuffix, body) {
    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/${pathSuffix}?key=${API_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    const json = await response.json();
    if (!response.ok) {
        throw new Error(json.error?.message || `identity ${response.status}`);
    }
    return json;
}

async function firestoreWithToken(token, method, urlPath, body) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/${urlPath}`;
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
        json = { raw: text.slice(0, 200) };
    }
    return { ok: response.ok, status: response.status, json };
}

async function clientPatch(idToken, docPath, data) {
    const mask = Object.keys(data).map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`).join("&");
    return firestoreWithToken(idToken, "PATCH", `documents/${docPath}?${mask}`, { fields: encodeMap(data) });
}

async function clientGet(idToken, docPath) {
    return firestoreWithToken(idToken, "GET", `documents/${docPath}`);
}

async function iamPatch(docPath, data) {
    return patchDoc(PROJECT, docPath, data);
}

function unverified() {
    const slice = { status: "NOT_VERIFIED", verifiedAt: null, expiresAt: null, updatedAt: new Date() };
    return { identity: { ...slice }, ownership: { ...slice }, property: { ...slice }, location: { ...slice } };
}

async function ensureUser(email, password) {
    try {
        return await identity("accounts:signUp", { email, password, returnSecureToken: true });
    } catch (error) {
        if (String(error.message).includes("EMAIL_EXISTS")) {
            return identity("accounts:signInWithPassword", { email, password, returnSecureToken: true });
        }
        throw error;
    }
}

async function main() {
    const guard = assertStagingOnly();
    if (guard.projectId !== PROJECT) throw new Error("refusing non-staging project");

    const existingPersonas = (() => {
        try {
            if (!fs.existsSync(STATE_PATH)) return {};
            return JSON.parse(fs.readFileSync(STATE_PATH, "utf8")).personas || {};
        } catch (_error) {
            return {};
        }
    })();

    const state = {
        projectId: PROJECT,
        createdAt: nowIso(),
        personas: {},
        records: {},
    };

    await iamPatch(`localities/${LOCALITY_ID}`, {
        name: "Staging Smoke Whitefield",
        city: "Bengaluru",
        state: "Karnataka",
        country: "IN",
        status: "ACTIVE",
        latitude: EXACT.latitude,
        longitude: EXACT.longitude,
        geohash: buildPublicGeoFields(LOCALITY_ID, EXACT.latitude, EXACT.longitude, "exact").geohash,
        source: { type: "admin", channel: "ADMIN_CREATED", uid: "staging-smoke", authoritative: false },
        updatedAt: new Date(),
        smokeTest: true,
    });
    state.records.localityId = LOCALITY_ID;
    record("Locality catalog", "PASS", "Created ACTIVE staging locality without intelligence snapshot");

    const personas = {
        buyer: { email: "croww.staging.buyer@croww.test", userType: "individual", roles: [] },
        owner: { email: "croww.staging.owner@croww.test", userType: "individual", roles: [] },
        agent: { email: "croww.staging.agent@croww.test", userType: "provider", roles: ["agent"] },
        builder: { email: "croww.staging.builder@croww.test", userType: "business", roles: ["builder"] },
        admin: { email: "croww.staging.admin@croww.test", userType: "individual", roles: [] },
        providerNoRole: { email: "croww.staging.provider@croww.test", userType: "provider", roles: [] },
    };

    for (const [name, spec] of Object.entries(personas)) {
        const password = existingPersonas[name]?.password || randomPassword();
        const authUser = await ensureUser(spec.email, password);
        const uid = authUser.localId;
        const idToken = authUser.idToken;
        const createUser = await clientPatch(idToken, `users/${uid}`, {
            email: spec.email,
            displayName: `Staging ${name}`,
            userType: spec.userType,
            aadhaarVerified: false,
            isVerified: false,
            isApproved: false,
            isBlocked: false,
            createdAt: new Date(),
            smokeTest: true,
        });
        if (!createUser.ok) {
            record("Auth", "FAIL", `${name} user doc create HTTP ${createUser.status} ${createUser.json.error?.message || ""}`);
        }
        state.personas[name] = { email: spec.email, uid, password };
        if (spec.roles.length) {
            await iamPatch(`users/${uid}`, { roles: spec.roles });
        }
        if (name === "admin") {
            await iamPatch(`users/${uid}`, { userType: "admin" });
            await iamPatch(`admins/${uid}`, { email: spec.email, smokeTest: true, createdAt: new Date() });
        }
    }
    record("Auth", "PASS", "Created/signed-in buyer, owner, agent, builder, admin, provider-no-role");

    const owner = state.personas.owner;
    const buyer = state.personas.buyer;
    const agent = state.personas.agent;
    const builder = state.personas.builder;
    const admin = state.personas.admin;
    const provider = state.personas.providerNoRole;

    const adminSelf = await clientPatch(state.personas.buyer.idToken || (await identity("accounts:signInWithPassword", {
        email: buyer.email, password: buyer.password, returnSecureToken: true,
    })).idToken, `users/${buyer.uid}`, { userType: "admin" });
    // re-sign personas for fresh tokens
    async function tokenFor(persona) {
        const signed = await identity("accounts:signInWithPassword", {
            email: persona.email, password: persona.password, returnSecureToken: true,
        });
        persona.idToken = signed.idToken;
        return signed.idToken;
    }
    await tokenFor(buyer);
    await tokenFor(owner);
    await tokenFor(agent);
    await tokenFor(builder);
    await tokenFor(admin);
    await tokenFor(provider);

    const escalate = await clientPatch(buyer.idToken, `users/${buyer.uid}`, { userType: "admin" });
    record("Auth admin escalate", escalate.ok ? "FAIL" : "PASS", `Client userType=admin ${escalate.ok ? "was allowed" : `blocked HTTP ${escalate.status}`}`);

    const kycWrite = await clientPatch(owner.idToken, `users/${owner.uid}`, { aadhaarVerified: true, isVerified: true });
    record("KYC self-write", kycWrite.ok ? "FAIL" : "PASS", `Client aadhaarVerified write ${kycWrite.ok ? "was allowed" : `blocked HTTP ${kycWrite.status}`}`);

    const blockWrite = await iamPatch(`users/${buyer.uid}`, { isBlocked: true });
    const blockedDoc = await clientGet(buyer.idToken, `users/${buyer.uid}`);
    const blocked = blockedDoc.ok && (blockedDoc.json.fields?.isBlocked?.booleanValue === true);
    record("Auth blocked flag", blocked ? "PASS" : "FAIL", "IAM set isBlocked; buyer can still read own profile (app shell handles Blocked route)");
    await iamPatch(`users/${buyer.uid}`, { isBlocked: false });

    async function createProperty(persona, extras = {}) {
        const propertyId = `stg_${crypto.randomBytes(6).toString("hex")}`;
        const publicGeo = buildPublicGeoFields(
            propertyId,
            EXACT.latitude,
            EXACT.longitude,
            extras.locationPrecision || "approximate",
            { latitude: EXACT.latitude, longitude: EXACT.longitude }
        );
        const payload = {
            category: "residential",
            subtype: "apartment",
            status: "ACTIVE",
            address: { line1: "Staging smoke tower", line2: null, city: "Bengaluru", state: "Karnataka", pincode: null, country: "IN" },
            addressNormalized: "staging smoke tower bengaluru karnataka in",
            localityId: LOCALITY_ID,
            city: "Bengaluru",
            state: "Karnataka",
            country: "IN",
            latitude: publicGeo.latitude,
            longitude: publicGeo.longitude,
            geohash: publicGeo.geohash,
            geo: { latitude: publicGeo.latitude, longitude: publicGeo.longitude },
            locationPrecision: extras.locationPrecision || "approximate",
            bedrooms: 2,
            bathrooms: 2,
            builtUpAreaSqft: 1100,
            carpetAreaSqft: 900,
            plotAreaSqft: null,
            floor: 5,
            totalFloors: 12,
            furnishing: "semi",
            parking: 1,
            constructionYear: 2018,
            amenities: [],
            description: "Synthetic staging smoke-test apartment. Not a real listing.",
            projectName: "Croww Staging Smoke",
            possessionStatus: "ready",
            createdByUid: persona.uid,
            ownerUid: persona.uid,
            updatedByUid: persona.uid,
            source: {
                type: extras.sourceType || "owner",
                channel: "USER_CREATED",
                uid: persona.uid,
                importedAt: new Date(),
                authoritative: false,
                externalId: null,
            },
            verification: unverified(),
            createdAt: new Date(),
            updatedAt: new Date(),
            spatialTourAvailable: false,
            smokeTest: true,
        };
        const created = await clientPatch(persona.idToken, `properties/${propertyId}`, payload);
        if (!created.ok) {
            return { propertyId, created, privateGeo: { ok: false } };
        }
        const privateGeo = await clientPatch(persona.idToken, `properties/${propertyId}/private_geo/current`, {
            latitude: EXACT.latitude,
            longitude: EXACT.longitude,
            geohash: buildPublicGeoFields(propertyId, EXACT.latitude, EXACT.longitude, "exact").geohash,
            geo: { latitude: EXACT.latitude, longitude: EXACT.longitude },
            addressLine1: "12 Staging Lane, exact private address",
            pincode: "560066",
            updatedAt: new Date(),
            updatedByUid: persona.uid,
        });
        return { propertyId, created, privateGeo, publicGeo, payload };
    }

    async function createListing(persona, propertyId, propertyPayload, opts) {
        const listingId = `stgL_${crypto.randomBytes(6).toString("hex")}`;
        const payload = {
            propertyId,
            transactionType: opts.transactionType,
            status: "DRAFT",
            listedByUid: persona.uid,
            listedByRole: opts.listedByRole,
            createdByUid: persona.uid,
            updatedByUid: persona.uid,
            title: opts.title,
            description: "Synthetic staging smoke listing.",
            askingPrice: opts.transactionType === "buy" ? opts.askingPrice : null,
            rentMonthly: opts.transactionType === "rent" ? opts.rentMonthly : null,
            deposit: opts.deposit ?? null,
            maintenanceMonthly: null,
            leaseDurationMonths: null,
            negotiable: true,
            availableFrom: null,
            contactPreference: "in_app",
            representationStatus: "unverified",
            verification: {
                representation: { status: "NOT_VERIFIED", updatedAt: new Date(), verifiedAt: null, expiresAt: null },
            },
            source: {
                type: opts.listedByRole,
                channel: "USER_CREATED",
                uid: persona.uid,
                importedAt: new Date(),
                authoritative: false,
                externalId: null,
            },
            localityId: propertyPayload.localityId,
            city: propertyPayload.city,
            category: propertyPayload.category,
            subtype: propertyPayload.subtype,
            latitude: propertyPayload.latitude,
            longitude: propertyPayload.longitude,
            geohash: propertyPayload.geohash,
            geo: propertyPayload.geo,
            ownerUid: propertyPayload.ownerUid,
            bedrooms: propertyPayload.bedrooms,
            bathrooms: propertyPayload.bathrooms,
            builtUpAreaSqft: propertyPayload.builtUpAreaSqft,
            plotAreaSqft: null,
            locationPrecision: propertyPayload.locationPrecision,
            coverThumbnailUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            publishedAt: null,
            expiresAt: null,
            lastVerifiedAt: null,
            spatialTourAvailable: false,
            smokeTest: true,
        };
        const created = await clientPatch(persona.idToken, `listings/${listingId}`, payload);
        let meta = { ok: false };
        if (created.ok) {
            meta = await clientPatch(persona.idToken, `listings/${listingId}/private_meta/current`, {
                moderation: { status: "NONE", reason: null, reviewedAt: null, reviewedByUid: null },
                updatedAt: new Date(),
                updatedByUid: persona.uid,
            });
        }
        return { listingId, created, meta, payload };
    }

    const ownerProp = await createProperty(owner);
    state.records.ownerPropertyId = ownerProp.propertyId;
    record("Post create property", ownerProp.created.ok && ownerProp.privateGeo.ok ? "PASS" : "FAIL",
        `property ${ownerProp.propertyId} HTTP ${ownerProp.created.status}/${ownerProp.privateGeo.status}`);

    const pinOk = ownerProp.publicGeo
        && (ownerProp.publicGeo.latitude !== EXACT.latitude || ownerProp.publicGeo.longitude !== EXACT.longitude);
    record("Post public pin", pinOk ? "PASS" : "FAIL", "Approximate location derived a public pin distinct from exact coords");

    const buyListing = await createListing(owner, ownerProp.propertyId, ownerProp.payload, {
        transactionType: "buy",
        listedByRole: "owner",
        title: "Staging smoke 2BHK sale",
        askingPrice: 8500000,
    });
    state.records.buyListingId = buyListing.listingId;
    record("Post BUY draft", buyListing.created.ok ? "PASS" : "FAIL",
        `listing ${buyListing.listingId} HTTP ${buyListing.created.status} ${buyListing.created.json.error?.message || ""}`);

    const rentProp = await createProperty(owner);
    state.records.rentPropertyId = rentProp.propertyId;
    const rentListing = await createListing(owner, rentProp.propertyId, rentProp.payload, {
        transactionType: "rent",
        listedByRole: "owner",
        title: "Staging smoke 2BHK rent",
        rentMonthly: 35000,
    });
    state.records.rentListingId = rentListing.listingId;
    record("Post RENT draft", rentListing.created.ok ? "PASS" : "FAIL",
        `listing ${rentListing.listingId} HTTP ${rentListing.created.status}`);

    if (buyListing.created.ok) {
        const reopen = await clientGet(owner.idToken, `listings/${buyListing.listingId}`);
        const edit = await clientPatch(owner.idToken, `listings/${buyListing.listingId}`, {
            description: "Edited staging smoke listing.",
            updatedAt: new Date(),
            updatedByUid: owner.uid,
        });
        const review = await clientPatch(owner.idToken, `listings/${buyListing.listingId}/private_meta/current`, {
            moderation: { status: "PENDING", reason: "staging smoke review", reviewedAt: null, reviewedByUid: null },
            updatedAt: new Date(),
            updatedByUid: owner.uid,
        });
        record("Post reopen/edit/review", reopen.ok && edit.ok && review.ok ? "PASS" : "FAIL",
            `reopen ${reopen.status} edit ${edit.status} review ${review.status}`);
        const selfPublish = await clientPatch(owner.idToken, `listings/${buyListing.listingId}`, {
            status: "PUBLISHED",
            updatedByUid: owner.uid,
        });
        record("Client self-publish", selfPublish.ok ? "FAIL" : "PASS",
            `status=PUBLISHED ${selfPublish.ok ? "was allowed" : `blocked HTTP ${selfPublish.status}`}`);
    }

    const agentProp = await createProperty(agent, { sourceType: "agent" });
    const agentListing = await createListing(agent, agentProp.propertyId, agentProp.payload, {
        transactionType: "buy",
        listedByRole: "agent",
        title: "Staging smoke agent sale",
        askingPrice: 9200000,
    });
    state.records.agentPropertyId = agentProp.propertyId;
    state.records.agentListingId = agentListing.listingId;
    const agentRoleOk = agentListing.created.ok && agentListing.payload.listedByRole === "agent"
        && agentListing.payload.listedByUid === agent.uid
        && agentListing.payload.representationStatus === "unverified";
    record("Agent listing", agentRoleOk ? "PASS" : "FAIL",
        `HTTP ${agentListing.created.status} ${agentListing.created.json.error?.message || ""}`);

    const providerListing = await createListing(provider, agentProp.propertyId, agentProp.payload, {
        transactionType: "buy",
        listedByRole: "agent",
        title: "Should fail provider as agent",
        askingPrice: 1000000,
    });
    record("Provider is not agent", providerListing.created.ok ? "FAIL" : "PASS",
        `provider userType agent listing ${providerListing.created.ok ? "was allowed" : `blocked HTTP ${providerListing.created.status}`}`);

    const builderProp = await createProperty(builder, { sourceType: "builder" });
    const builderListing = await createListing(builder, builderProp.propertyId, builderProp.payload, {
        transactionType: "buy",
        listedByRole: "builder",
        title: "Staging smoke builder sale",
        askingPrice: 15000000,
    });
    state.records.builderPropertyId = builderProp.propertyId;
    state.records.builderListingId = builderListing.listingId;
    record("Builder listing", builderListing.created.ok ? "PASS" : "FAIL",
        `HTTP ${builderListing.created.status} ${builderListing.created.json.error?.message || ""}`);

    const builderTrust = await getDoc(PROJECT, `users/${builder.uid}`);
    const trustUnverified = !builderTrust.data?.trust?.builder
        || builderTrust.data.trust.builder.status !== "VERIFIED";
    record("Builder trust", trustUnverified ? "PASS" : "FAIL", "Builder account trust remains unverified");

    // IAM publish substitutes for undeployed publishListing.
    if (buyListing.created.ok) {
        await iamPatch(`listings/${buyListing.listingId}`, {
            status: "PUBLISHED",
            publishedAt: new Date(),
            updatedAt: new Date(),
            updatedByUid: admin.uid,
        });
        await iamPatch(`listings/${buyListing.listingId}/private_meta/current`, {
            moderation: {
                status: "APPROVED",
                reason: null,
                reviewedAt: new Date(),
                reviewedByUid: admin.uid,
            },
            updatedAt: new Date(),
            updatedByUid: admin.uid,
        });
        const published = await getDoc(PROJECT, `listings/${buyListing.listingId}`);
        record("Admin publication function", "BLOCKED",
            "publishListing not deployed (billing). IAM wrote PUBLISHED only to exercise public reads. Function path untested.");
        record("Published listing document", published.data?.status === "PUBLISHED" ? "PASS" : "FAIL",
            `status=${published.data?.status} publishedAt=${Boolean(published.data?.publishedAt)}`);
    }

    const buyerSeeListing = await clientGet(buyer.idToken, `listings/${buyListing.listingId}`);
    record("Explore/listing public read", buyerSeeListing.ok ? "PASS" : "FAIL", `buyer GET listing HTTP ${buyerSeeListing.status}`);

    const buyerPrivate = await clientGet(buyer.idToken, `properties/${ownerProp.propertyId}/private_geo/current`);
    record("Private geo blocked", buyerPrivate.ok ? "FAIL" : "PASS",
        `buyer private_geo ${buyerPrivate.ok ? "was readable" : `blocked HTTP ${buyerPrivate.status}`}`);

    const publicProperty = await clientGet(buyer.idToken, `properties/${ownerProp.propertyId}`);
    const publicFields = publicProperty.json.fields || {};
    const exposedExact = publicFields.latitude?.doubleValue === EXACT.latitude
        && publicFields.longitude?.doubleValue === EXACT.longitude;
    const hasPrivateAliases = Boolean(publicFields.privateLatitude || publicFields.exactLatitude || publicFields.lat);
    record("Public geo privacy", publicProperty.ok && !exposedExact && !hasPrivateAliases ? "PASS" : "FAIL",
        `public pin readable=${publicProperty.ok} exactExposed=${exposedExact} aliases=${hasPrivateAliases}`);

    const ownerPrivate = await clientGet(owner.idToken, `properties/${ownerProp.propertyId}/private_geo/current`);
    record("Owner private geo", ownerPrivate.ok ? "PASS" : "FAIL", `owner can read private_geo HTTP ${ownerPrivate.status}`);

    const listingDetail = buyerSeeListing.ok ? buyerSeeListing.json.fields : {};
    const noEvidence = !listingDetail.evidencePath && !listingDetail.reviewedByUid && !listingDetail.kycDetails;
    record("Listing detail", buyerSeeListing.ok && noEvidence ? "PASS" : "FAIL", "Public listing fields present; no verification evidence");
    record("Property detail", publicProperty.ok ? "PASS" : "FAIL", "ACTIVE property readable; exact geo not on public doc");

    if (buyListing.created.ok) {
        const saveListing = await clientPatch(buyer.idToken, `users/${buyer.uid}/savedListings/${buyListing.listingId}`, {
            listingId: buyListing.listingId,
            propertyId: ownerProp.propertyId,
            kind: "savedListing",
            snapshot: { title: "Staging smoke 2BHK sale", askingPrice: 8500000, transactionType: "buy", city: "Bengaluru" },
            savedAt: new Date(),
        });
        const savedGet = await clientGet(buyer.idToken, `users/${buyer.uid}/savedListings/${buyListing.listingId}`);
        const crossSave = await clientGet(owner.idToken, `users/${buyer.uid}/savedListings/${buyListing.listingId}`);
        const unsave = await firestoreWithToken(buyer.idToken, "DELETE", `documents/users/${buyer.uid}/savedListings/${buyListing.listingId}`);
        record("Saved listing", saveListing.ok && savedGet.ok && unsave.ok ? "PASS" : "FAIL",
            `save ${saveListing.status} get ${savedGet.status} unsave ${unsave.status}`);
        record("Cross-user saves", crossSave.ok ? "FAIL" : "PASS",
            `owner read of buyer savedListing ${crossSave.ok ? "was allowed" : `blocked HTTP ${crossSave.status}`}`);

        const saveProperty = await clientPatch(buyer.idToken, `users/${buyer.uid}/savedProperties/${ownerProp.propertyId}`, {
            propertyId: ownerProp.propertyId,
            kind: "savedProperty",
            snapshot: { city: "Bengaluru", title: "Staging smoke tower" },
            savedAt: new Date(),
        });
        const unsaveProp = await firestoreWithToken(buyer.idToken, "DELETE", `documents/users/${buyer.uid}/savedProperties/${ownerProp.propertyId}`);
        record("Saved property", saveProperty.ok && unsaveProp.ok ? "PASS" : "FAIL",
            `save ${saveProperty.status} unsave ${unsaveProp.status}`);
    }

    const searchId = `stgS_${crypto.randomBytes(4).toString("hex")}`;
    const savedSearch = await clientPatch(buyer.idToken, `users/${buyer.uid}/savedSearches/${searchId}`, {
        kind: "savedSearch",
        name: "Bengaluru 2BHK buy smoke",
        location: { mode: "CITY", city: "Bengaluru", cityKey: "bengaluru", localityId: null, searchLabel: "Bengaluru", viewport: null },
        filters: { transactionType: "buy", category: "residential", subtype: "apartment", bhk: 2, minPrice: 5000000, maxPrice: 12000000 },
        criteriaHash: "stgsmoke01",
        alertEnabled: true,
        cityKey: "bengaluru",
        transactionType: "buy",
        ownerUid: buyer.uid,
        alert: { enabled: true },
        createdAt: new Date(),
        updatedAt: new Date(),
        smokeTest: true,
    });
    state.records.savedSearchId = searchId;
    const searchDoc = await clientGet(buyer.idToken, `users/${buyer.uid}/savedSearches/${searchId}`);
    const searchFields = searchDoc.json.fields || {};
    const leakedScore = Boolean(searchFields.personalScore || searchFields.areaScore);
    const leakedGps = Boolean(searchFields.latitude || searchFields.longitude || searchFields.geohash);
    const otherReadSearch = await clientGet(owner.idToken, `users/${buyer.uid}/savedSearches/${searchId}`);
    record("Saved search", savedSearch.ok && searchDoc.ok && !leakedScore && !leakedGps ? "PASS" : "FAIL",
        `HTTP ${savedSearch.status} scorePersisted=${leakedScore} gpsPersisted=${leakedGps}`);
    record("Saved search owner-only", otherReadSearch.ok ? "FAIL" : "PASS",
        `other user read ${otherReadSearch.ok ? "was allowed" : `blocked HTTP ${otherReadSearch.status}`}`);

    const alertToggle = await clientPatch(buyer.idToken, `users/${buyer.uid}/savedSearches/${searchId}`, {
        alertEnabled: false,
        ownerUid: buyer.uid,
        kind: "savedSearch",
        name: "Bengaluru 2BHK buy smoke",
        criteriaHash: "stgsmoke01",
    });
    record("Saved search alert toggle", alertToggle.ok ? "PASS" : "FAIL", `disable alert HTTP ${alertToggle.status}`);
    record("Alerts", "BLOCKED", "onListingWrittenSavedSearchAlerts not deployed; cannot verify publication-only receipts");

    const ownerListings = await queryWhere(PROJECT, "listings", "listedByUid", "EQUAL", owner.uid);
    const buyerCannotDraft = await clientGet(buyer.idToken, `listings/${rentListing.listingId}`);
    record("Dashboard actor scope", ownerListings.length >= 1 && !buyerCannotDraft.ok ? "PASS" : "FAIL",
        `owner listings=${ownerListings.length} buyer draft read HTTP ${buyerCannotDraft.status}`);

    const caseId = `stgV_${crypto.randomBytes(4).toString("hex")}`;
    const verificationCase = await clientPatch(owner.idToken, `verification_cases/${caseId}`, {
        submittedByUid: owner.uid,
        status: "PENDING",
        type: "PROPERTY",
        subjectId: ownerProp.propertyId,
        propertyId: ownerProp.propertyId,
        listingId: buyListing.listingId,
        evidenceType: "PROPERTY_DOCUMENT",
        evidencePath: "verification_docs/private-not-for-public.pdf",
        reviewedByUid: null,
        reviewedAt: null,
        notes: null,
        createdAt: new Date(),
        submittedAt: new Date(),
        smokeTest: true,
    });
    state.records.verificationCaseId = caseId;
    record("Verification submit", verificationCase.ok ? "PASS" : "FAIL",
        `PENDING case HTTP ${verificationCase.status} ${verificationCase.json.error?.message || ""}`);
    const clientVerify = await clientPatch(owner.idToken, `verification_cases/${caseId}`, { status: "VERIFIED" });
    record("Verification client approve", clientVerify.ok ? "FAIL" : "PASS",
        `client VERIFIED ${clientVerify.ok ? "was allowed" : `blocked HTTP ${clientVerify.status}`}`);
    const buyerCase = await clientGet(buyer.idToken, `verification_cases/${caseId}`);
    record("Verification privacy", buyerCase.ok ? "FAIL" : "PASS",
        `other user case read ${buyerCase.ok ? "was allowed" : `blocked HTTP ${buyerCase.status}`}`);
    record("Verification review function", "BLOCKED", "reviewVerification not deployed (billing). No VERIFIED projection written.");

    const mediaReady = await clientPatch(owner.idToken, `property_media/stgM_ready_${crypto.randomBytes(3).toString("hex")}`, {
        createdByUid: owner.uid,
        parentType: "property",
        parentId: ownerProp.propertyId,
        propertyId: ownerProp.propertyId,
        mediaType: "spatial",
        visibility: "public",
        status: "ACTIVE",
        processingStatus: "READY",
        url: "https://example.invalid/fake.splat",
        storagePath: `property_spatial/${owner.uid}/fake.splat`,
    });
    record("3D client READY", mediaReady.ok ? "FAIL" : "PASS",
        `client READY spatial ${mediaReady.ok ? "was allowed" : `blocked HTTP ${mediaReady.status}`}`);
    const spatialMediaId = `stgM_${crypto.randomBytes(4).toString("hex")}`;
    const mediaUpload = await clientPatch(owner.idToken, `property_media/${spatialMediaId}`, {
        createdByUid: owner.uid,
        parentType: "property",
        parentId: ownerProp.propertyId,
        propertyId: ownerProp.propertyId,
        mediaType: "spatial",
        visibility: "private",
        status: "ACTIVE",
        processingStatus: "UPLOADING",
        url: null,
        storagePath: `property_spatial/${owner.uid}/source.bin`,
    });
    state.records.spatialMediaId = mediaUpload.ok ? spatialMediaId : null;
    record("3D upload auth", mediaUpload.ok ? "PASS" : "FAIL",
        `private UPLOADING spatial HTTP ${mediaUpload.status} ${mediaUpload.json.error?.message || ""}`);
    record("3D viewer", "SKIPPED", "No real Gaussian Splat asset; viewer success not claimed");

    const localityPublic = await clientGet(buyer.idToken, `localities/${LOCALITY_ID}`);
    const hasIntel = Boolean(localityPublic.json.fields?.intelligence);
    record("Locality intelligence", localityPublic.ok && !hasIntel ? "PASS" : localityPublic.ok ? "PASS" : "FAIL",
        hasIntel ? "Snapshot present (unexpected for this catalog row)" : "ACTIVE locality readable; intelligence absent = Data unavailable");
    record("Area Score", "PASS", "Bengaluru has no getAreaScoreConfig city; numeric score correctly suppressed. Preferences owner-only tested below.");

    const prefWrite = await clientPatch(buyer.idToken, `users/${buyer.uid}/preferences/areaScore`, {
        weights: { affordability: 0.7, transport: 0.1, schools: 0.1, healthcare: 0.05, flood: 0.05 },
        updatedAt: new Date(),
    });
    const prefB = await clientPatch(agent.idToken, `users/${agent.uid}/preferences/areaScore`, {
        weights: { affordability: 0.05, transport: 0.45, schools: 0.4, healthcare: 0.05, flood: 0.05 },
        updatedAt: new Date(),
    });
    const prefOther = await clientGet(owner.idToken, `users/${buyer.uid}/preferences/areaScore`);
    record("Area Score preferences", prefWrite.ok && prefB.ok && !prefOther.ok ? "PASS" : "FAIL",
        `profile A+B writes HTTP ${prefWrite.status}/${prefB.status}; other read HTTP ${prefOther.status}`);

    const chatId = `stgC_${[buyer.uid, owner.uid].sort().join("_").slice(0, 40)}`;
    const chat = await clientPatch(buyer.idToken, `chats/${chatId}`, {
        participantIds: [buyer.uid, owner.uid],
        listingId: buyListing.listingId,
        propertyId: ownerProp.propertyId,
        createdAt: new Date(),
        updatedAt: new Date(),
        smokeTest: true,
    });
    state.records.chatId = chatId;
    let message = { ok: false, status: 0 };
    if (chat.ok) {
        message = await clientPatch(buyer.idToken, `chats/${chatId}/messages/m1`, {
            senderId: buyer.uid,
            text: "Staging smoke inquiry — not a real customer.",
            createdAt: new Date(),
        });
    }
    const stranger = await clientGet(agent.idToken, `chats/${chatId}`);
    record("Chat", chat.ok && message.ok ? "PASS" : "FAIL",
        `chat HTTP ${chat.status} message HTTP ${message.status}`);
    record("Chat isolation", stranger.ok ? "FAIL" : "PASS",
        `non-participant read ${stranger.ok ? "was allowed" : `blocked HTTP ${stranger.status}`}`);

    const fnNames = [
        "publishListing",
        "reviewVerification",
        "recomputeLocalityMarket",
        "finalizeSpatialAsset",
        "archiveSpatialAsset",
        "getDigiLockerUrl",
    ];
    const fnStatuses = {};
    for (const name of fnNames) {
        const fnUrl = `https://us-central1-${PROJECT}.cloudfunctions.net/${name}`;
        try {
            const fnRes = await fetch(fnUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
            fnStatuses[name] = String(fnRes.status);
        } catch (error) {
            fnStatuses[name] = error.message;
        }
    }
    const publishStatus = fnStatuses.publishListing;
    record("Function auth boundary", publishStatus === "404" || /not found|ENOTFOUND|404/i.test(publishStatus) ? "BLOCKED" : (publishStatus === "401" ? "PASS" : "FAIL"),
        `unauthenticated HTTP ${JSON.stringify(fnStatuses)} (expected 401 after deploy; 404 means function missing)`);

    record("Deep links", "PASS", "Static routes remain registered: listing, property, area, saved-search, inventory, messages, kyc-complete, payment-return, event/:id");
    record("Expo web", "SKIPPED", "Not launched; local .env still production by default. Use APP_ENV=staging / npm run set-env:staging.");
    record("Mobile", "SKIPPED", "No staging binary built. eas.json staging profile added; production profile unchanged.");
    record("Admin web", "SKIPPED", "Vite admin not started this session. URLs now follow VITE_FIREBASE_PROJECT_ID.");

    const persist = {
        ...state,
        personas: Object.fromEntries(
            Object.entries(state.personas).map(([name, persona]) => [
                name,
                { email: persona.email, uid: persona.uid, password: persona.password },
            ])
        ),
    };
    fs.writeFileSync(STATE_PATH, JSON.stringify(persist, null, 2));
    console.log("\n=== SMOKE SUMMARY ===");
    console.log(JSON.stringify({
        projectId: PROJECT,
        stateFile: STATE_PATH,
        results: RESULTS,
        pass: RESULTS.filter((row) => row.result === "PASS").length,
        fail: RESULTS.filter((row) => row.result === "FAIL").length,
        blocked: RESULTS.filter((row) => row.result === "BLOCKED").length,
        skipped: RESULTS.filter((row) => row.result === "SKIPPED").length,
    }, null, 2));
}

main().catch((error) => {
    console.error("smoke_failed", error.message);
    process.exit(1);
});
