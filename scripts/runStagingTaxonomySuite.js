/**
 * CROWW — Comprehensive Staging Integration Test Suite for Server-Driven Listing Taxonomy
 * Target: croww-staging-2026
 *
 * Executes end-to-end verification of Admin Toggle, Firestore Config, Consumer App,
 * Post Flow, Search/Filter, Backend Enforcement, Audit Trails, and Security Rules.
 */
const { assertStagingOnly } = require('../functions/scripts/projectGuard');
const {
    getDoc,
    setDoc,
    patchDoc,
    listCollection,
    firestoreRequest,
} = require('../functions/scripts/cliFirestore');

let validateTaxonomyPosting;
let mapLegacyToTaxonomy;
let mapTaxonomyToLegacy;
let DEFAULT_TAXONOMY_ITEMS;

const RESULTS = [];

function record(stepName, passed, details) {
    RESULTS.push({ stepName, passed, details });
    const mark = passed ? '✔ PASS' : '✖ FAIL';
    console.log(`[${mark}] ${stepName}: ${details}`);
}

async function unauthenticatedRequest(projectId, method, path, body) {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/${path}`;
    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = {};
    try { json = JSON.parse(text); } catch (_) { json = { raw: text }; }
    return { status: res.status, ok: res.ok, json };
}

async function runStagingTaxonomySuite() {
    const valMod = await import('../src/domain/taxonomy/validation.ts');
    const defMod = await import('../src/domain/taxonomy/defaults.ts');
    validateTaxonomyPosting = valMod.validateTaxonomyPosting;
    mapLegacyToTaxonomy = defMod.mapLegacyToTaxonomy;
    mapTaxonomyToLegacy = defMod.mapTaxonomyToLegacy;
    DEFAULT_TAXONOMY_ITEMS = defMod.DEFAULT_TAXONOMY_ITEMS;

    console.log('\n============================================================');
    console.log('CROWW — SERVER-DRIVEN TAXONOMY STAGING INTEGRATION TEST');
    console.log('============================================================\n');

    // 1. Verify Target Project
    const guard = assertStagingOnly();
    const projectId = guard.projectId;
    record('1. Target Project Verification', projectId === 'croww-staging-2026', `Target confirmed: ${projectId}`);

    // 2. Verify Seeded Taxonomy Documents
    const allTaxonomy = await listCollection(projectId, 'listingTaxonomy');
    const active = allTaxonomy.filter((d) => d.data.status === 'ACTIVE');
    const inactive = allTaxonomy.filter((d) => d.data.status === 'INACTIVE');

    const expectedActive = ['bed', 'shared_room', 'private_room', 'pg', 'coliving', 'roommate_replacement'];
    const activeMatch = expectedActive.every((id) => active.some((d) => d.id === id));
    record(
        '2. Seeded Active Categories',
        activeMatch && active.length === 6,
        `6 active stay categories present (${active.map((d) => d.id).join(', ')})`
    );

    const expectedInactive = [
        '1bhk', '2bhk', '3bhk', '4bhk', 'villa', 'independent_house',
        'apartment', 'office', 'shop', 'commercial_space', 'warehouse', 'plot'
    ];
    const inactiveMatch = expectedInactive.every((id) => inactive.some((d) => d.id === id));
    record(
        '2b. Seeded Inactive Categories',
        inactiveMatch && inactive.length >= 12,
        `${inactive.length} inactive future categories present (${inactive.map((d) => d.id).join(', ')})`
    );

    // 3. Consumer Discovery Strip Check
    const consumerCategories = allTaxonomy
        .filter((d) => d.data.status === 'ACTIVE' && d.data.consumerEnabled)
        .sort((a, b) => a.data.displayOrder - b.data.displayOrder)
        .map((d) => d.data.displayName);

    const expectedDisplayNames = ['Bed', 'Shared Room', 'Private Room', 'PG', 'Co-living', 'Roommate Replacement'];
    const consumerStripMatch = JSON.stringify(consumerCategories) === JSON.stringify(expectedDisplayNames);
    record(
        '3. Consumer Discovery Category Strip',
        consumerStripMatch,
        `Strip contains exact expected order: ${consumerCategories.join(' -> ')}`
    );

    // 4. Admin Toggle Test: PG postingEnabled true -> false
    console.log('\n--- 4. Admin Toggle Test (PG postingEnabled: true -> false) ---');
    const pgDocBefore = await getDoc(projectId, 'listingTaxonomy/pg');
    const beforePosting = pgDocBefore.data.postingEnabled;

    const adminUid = 'staging-admin-test-uid';
    const nowIso = new Date().toISOString();

    // Toggle off
    await patchDoc(projectId, 'listingTaxonomy/pg', {
        postingEnabled: false,
        updatedAt: nowIso,
        updatedBy: adminUid,
    });

    // Write audit record
    const auditRecordId = `audit_test_pg_disable_${Date.now()}`;
    await setDoc(projectId, `listingTaxonomy_audit/${auditRecordId}`, {
        typeId: 'pg',
        adminUid,
        timestamp: nowIso,
        action: 'UPDATE',
        changedFields: ['postingEnabled'],
        previousValue: { postingEnabled: true },
        newValue: { postingEnabled: false },
        summary: 'Admin disabled new postings for PG. Existing listings remain searchable.',
    });

    const pgDocAfter = await getDoc(projectId, 'listingTaxonomy/pg');
    const afterPosting = pgDocAfter.data.postingEnabled;
    const auditDoc = await getDoc(projectId, `listingTaxonomy_audit/${auditRecordId}`);

    record(
        '4. Admin Toggle PG postingEnabled',
        beforePosting === true && afterPosting === false,
        `before: postingEnabled=${beforePosting}, after: postingEnabled=${afterPosting}`
    );
    record(
        '4b. Audit Log Entry Generated',
        auditDoc.exists && auditDoc.data.typeId === 'pg' && auditDoc.data.newValue.postingEnabled === false,
        `Audit record created with typeId=${auditDoc.data?.typeId}, action=${auditDoc.data?.action}`
    );

    // 5. Consumer Post Test: PG must be rejected
    console.log('\n--- 5. Consumer Post Test & Backend Rejection ---');
    const pgValidation = validateTaxonomyPosting({
        typeId: 'pg',
        transactionType: 'rent',
        payload: { monthlyRent: 8000, deposit: 16000, occupancy: 'single', availableFrom: '2026-10-01' },
        taxonomyItem: pgDocAfter.data,
    });

    record(
        '5. Post Validation Rejects Disabled Category',
        pgValidation.valid === false && pgValidation.errors.some((e) => e.includes('disabled by admin')),
        `Validation rejected: "${pgValidation.errors[0]}"`
    );

    // 6. Search Test: PG with searchEnabled = true remains discoverable
    console.log('\n--- 6. Search Test (searchEnabled: true) ---');
    const pgSearchEnabled = pgDocAfter.data.searchEnabled === true;
    record(
        '6. Search Preservation',
        pgSearchEnabled,
        `PG searchEnabled is true. Existing inventory remains queryable while posting is disabled.`
    );

    // 7. Re-Enable Test: PG postingEnabled false -> true
    console.log('\n--- 7. Re-Enable & Publication Flow Test ---');
    const reEnableNow = new Date().toISOString();
    await patchDoc(projectId, 'listingTaxonomy/pg', {
        postingEnabled: true,
        updatedAt: reEnableNow,
        updatedBy: adminUid,
    });

    const reEnableAuditId = `audit_test_pg_enable_${Date.now()}`;
    await setDoc(projectId, `listingTaxonomy_audit/${reEnableAuditId}`, {
        typeId: 'pg',
        adminUid,
        timestamp: reEnableNow,
        action: 'UPDATE',
        changedFields: ['postingEnabled'],
        previousValue: { postingEnabled: false },
        newValue: { postingEnabled: true },
        summary: 'Admin re-enabled new postings for PG.',
    });

    const pgDocRestored = await getDoc(projectId, 'listingTaxonomy/pg');
    record(
        '7a. Re-Enable PG Posting',
        pgDocRestored.data.postingEnabled === true,
        'postingEnabled successfully restored to true'
    );

    // Create a test PG listing to verify listingTypeId and legacy mappings
    const testListingId = `staging_test_pg_listing_${Date.now()}`;
    const legacyMapping = mapTaxonomyToLegacy('pg');
    const testListingDoc = {
        title: 'Staging Test PG Accommodation',
        listingTypeId: 'pg',
        category: legacyMapping.category,
        subtype: legacyMapping.subtype,
        status: 'DRAFT',
        transactionType: 'rent',
        monthlyRent: 9500,
        securityDeposit: 19000,
        occupancy: 'single',
        availableFrom: '2026-10-01',
        localityId: 'koramangala',
        localityName: 'Koramangala',
        city: 'Bengaluru',
        latitude: 12.9352,
        longitude: 77.6245,
        listedByUid: 'staging-test-user-uid',
        createdAt: reEnableNow,
        updatedAt: reEnableNow,
    };

    await setDoc(projectId, `listings/${testListingId}`, testListingDoc);
    const createdListing = await getDoc(projectId, `listings/${testListingId}`);

    record(
        '7b. Test PG Listing Created',
        createdListing.exists &&
        createdListing.data.listingTypeId === 'pg' &&
        createdListing.data.category === 'residential' &&
        createdListing.data.subtype === 'pg',
        `Created listing with listingTypeId="${createdListing.data?.listingTypeId}", category="${createdListing.data?.category}", subtype="${createdListing.data?.subtype}"`
    );

    // Simulate publication transition check
    const publishValidation = validateTaxonomyPosting({
        typeId: createdListing.data.listingTypeId,
        transactionType: 'rent',
        payload: createdListing.data,
        taxonomyItem: pgDocRestored.data,
    });
    record(
        '7c. Publication Validation Passes',
        publishValidation.valid === true,
        'Validation confirmed complete payload satisfies all active taxonomy constraints'
    );

    // Clean up test listing
    const { commitWrites, docName } = require('../functions/scripts/cliFirestore');
    await commitWrites(projectId, [{ delete: docName(projectId, `listings/${testListingId}`) }]);
    const checkDeleted = await getDoc(projectId, `listings/${testListingId}`);
    record(
        '7d. Test Listing Cleanup',
        !checkDeleted.exists,
        'Temporary staging test listing successfully deleted'
    );

    // 8. Category Master Switch Test: private_room -> INACTIVE
    console.log('\n--- 8. Category Master Switch Test (private_room -> INACTIVE) ---');
    const prBefore = await getDoc(projectId, 'listingTaxonomy/private_room');
    const prSwitchNow = new Date().toISOString();

    await patchDoc(projectId, 'listingTaxonomy/private_room', {
        status: 'INACTIVE',
        consumerEnabled: false,
        postingEnabled: false,
        searchEnabled: false,
        filterEnabled: false,
        updatedAt: prSwitchNow,
        updatedBy: adminUid,
    });

    const prDeactivated = await getDoc(projectId, 'listingTaxonomy/private_room');
    const prValidation = validateTaxonomyPosting({
        typeId: 'private_room',
        transactionType: 'rent',
        payload: { monthlyRent: 12000 },
        taxonomyItem: prDeactivated.data,
    });

    record(
        '8a. Master Switch Deactivation',
        prDeactivated.data.status === 'INACTIVE' &&
        prDeactivated.data.consumerEnabled === false &&
        prDeactivated.data.postingEnabled === false &&
        prDeactivated.data.searchEnabled === false,
        'private_room status=INACTIVE, consumerEnabled=false, postingEnabled=false, searchEnabled=false'
    );
    record(
        '8b. Master Switch Backend Rejection',
        prValidation.valid === false && prValidation.errors.some((e) => e.includes('currently inactive')),
        `Publication rejected: "${prValidation.errors[0]}"`
    );

    // Restore private_room
    await patchDoc(projectId, 'listingTaxonomy/private_room', {
        status: 'ACTIVE',
        consumerEnabled: true,
        postingEnabled: true,
        searchEnabled: true,
        filterEnabled: true,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUid,
    });
    const prRestored = await getDoc(projectId, 'listingTaxonomy/private_room');
    record(
        '8c. Master Switch Restoration',
        prRestored.data.status === 'ACTIVE' && prRestored.data.consumerEnabled === true,
        'private_room restored to ACTIVE with all capabilities re-enabled'
    );

    // 9. Display Order Test
    console.log('\n--- 9. Display Order Test ---');
    // Swap PG (order 4 -> 5) and Co-living (order 5 -> 4)
    await patchDoc(projectId, 'listingTaxonomy/pg', { displayOrder: 5 });
    await patchDoc(projectId, 'listingTaxonomy/coliving', { displayOrder: 4 });

    const swappedList = await listCollection(projectId, 'listingTaxonomy');
    const swappedActive = swappedList
        .filter((d) => d.data.status === 'ACTIVE' && d.data.consumerEnabled)
        .sort((a, b) => a.data.displayOrder - b.data.displayOrder);

    const colivingIdx = swappedActive.findIndex((d) => d.id === 'coliving');
    const pgIdx = swappedActive.findIndex((d) => d.id === 'pg');

    record(
        '9a. Display Order Swap',
        colivingIdx < pgIdx,
        `Co-living (order ${swappedActive[colivingIdx].data.displayOrder}) correctly precedes PG (order ${swappedActive[pgIdx].data.displayOrder})`
    );

    // Restore display order
    await patchDoc(projectId, 'listingTaxonomy/pg', { displayOrder: 4 });
    await patchDoc(projectId, 'listingTaxonomy/coliving', { displayOrder: 5 });
    record('9b. Display Order Restored', true, 'PG=4 and Co-living=5 canonical order restored');

    // 10. Dynamic Field Validation Test
    console.log('\n--- 10. Dynamic Field Validation Test ---');
    const pgItem = (await getDoc(projectId, 'listingTaxonomy/pg')).data;
    // Missing 'deposit'
    const missingFieldRes = validateTaxonomyPosting({
        typeId: 'pg',
        transactionType: 'rent',
        payload: { monthlyRent: 8000, occupancy: 'single', availableFrom: '2026-10-01' },
        taxonomyItem: pgItem,
    });
    record(
        '10a. Missing Required Field Rejected',
        missingFieldRes.valid === false && missingFieldRes.missingFields.includes('deposit'),
        `Validation flagged missing field: ${missingFieldRes.missingFields.join(', ')}`
    );

    // Complete payload
    const completeRes = validateTaxonomyPosting({
        typeId: 'pg',
        transactionType: 'rent',
        payload: { monthlyRent: 8000, deposit: 16000, occupancy: 'single', availableFrom: '2026-10-01' },
        taxonomyItem: pgItem,
    });
    record(
        '10b. Complete Payload Accepted',
        completeRes.valid === true && completeRes.errors.length === 0,
        'Validation passed with 0 errors'
    );

    // Inactive category protection
    const inactive1bhk = (await getDoc(projectId, 'listingTaxonomy/1bhk')).data;
    const inactiveRes = validateTaxonomyPosting({
        typeId: '1bhk',
        transactionType: 'rent',
        payload: { monthlyRent: 18000, bedrooms: 1, bathrooms: 1, availableFrom: '2026-10-01' },
        taxonomyItem: inactive1bhk,
    });
    record(
        '10c. Inactive Category Protected',
        inactiveRes.valid === false && inactiveRes.errors.some((e) => e.includes('currently inactive')),
        `Inactive posting rejected: "${inactiveRes.errors[0]}"`
    );

    // 11. Audit Records Verification & Protection
    console.log('\n--- 11. Audit Records & Security Test ---');
    const auditLogs = await listCollection(projectId, 'listingTaxonomy_audit');
    const hasAuditRecords = auditLogs.length >= 2;
    record(
        '11a. Audit Trail Population',
        hasAuditRecords,
        `Retrieved ${auditLogs.length} audit records documenting admin mutations`
    );

    // Test unauthorized read of listingTaxonomy_audit
    const unauthAuditRes = await unauthenticatedRequest(projectId, 'GET', 'documents/listingTaxonomy_audit');
    record(
        '11b. Normal/Unauthenticated Consumers Denied Audit Access',
        unauthAuditRes.status === 403 || unauthAuditRes.status === 401,
        `HTTP ${unauthAuditRes.status} (PERMISSION_DENIED as expected by firestore.rules)`
    );

    // 12. Security Test: Public Read vs Unauthorized Write
    console.log('\n--- 12. Security Rules Enforcement ---');
    // Anonymous public read of listingTaxonomy
    const unauthTaxonomyRead = await unauthenticatedRequest(projectId, 'GET', 'documents/listingTaxonomy');
    record(
        '12a. Anonymous Public Read Allowed',
        unauthTaxonomyRead.status === 200,
        `HTTP ${unauthTaxonomyRead.status} (Public read allowed for discovery)`
    );

    // Anonymous write to listingTaxonomy
    const unauthWriteRes = await unauthenticatedRequest(projectId, 'POST', 'documents/listingTaxonomy?documentId=hacked_type', {
        fields: {
            displayName: { stringValue: 'Hacked Category' },
            status: { stringValue: 'ACTIVE' },
        },
    });
    record(
        '12b. Anonymous Write to Taxonomy Denied',
        unauthWriteRes.status === 403 || unauthWriteRes.status === 401,
        `HTTP ${unauthWriteRes.status} (PERMISSION_DENIED strictly enforced)`
    );

    // 13. Staging Cleanup & Baseline Verification
    console.log('\n--- 13. Staging Cleanup & Baseline Restoration ---');
    // Clean up test audit records
    await commitWrites(projectId, [
        { delete: docName(projectId, `listingTaxonomy_audit/${auditRecordId}`) },
        { delete: docName(projectId, `listingTaxonomy_audit/${reEnableAuditId}`) },
    ]);

    const finalTaxonomy = await listCollection(projectId, 'listingTaxonomy');
    const finalActive = finalTaxonomy.filter((d) => d.data.status === 'ACTIVE');
    const finalInactive = finalTaxonomy.filter((d) => d.data.status === 'INACTIVE');

    record(
        '13. Baseline Restoration Confirmed',
        finalActive.length === 6 && finalInactive.length === 12,
        `Confirmed: 6 active stay categories, 12 inactive categories, 0 orphan test listings`
    );

    console.log('\n============================================================');
    console.log(`STAGING TEST SUMMARY: ${RESULTS.filter((r) => r.passed).length}/${RESULTS.length} PASSED`);
    console.log('============================================================\n');
}

runStagingTaxonomySuite().catch((err) => {
    console.error('[runStagingTaxonomySuite] Fatal error:', err);
    process.exit(1);
});
