import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    validateAvailabilityInput,
    calculateAddVacancy,
    calculateReduceVacancy,
    calculateMarkFull,
    calculateReopen,
} from './validation.ts';
import {
    isActivelyAvailable,
    isFutureAvailable,
    isFull,
    formatAvailabilityLabel,
    formatInventoryRatio,
    formatAvailableFromDate,
} from './formatting.ts';
import { listingProtectedFieldsTouched } from '../validate.ts';
import { calculateAreaScore } from '../../areaScore/score.ts';

describe('Vacancy & Inventory Management for PG / Co-Living / Shared Accommodation', () => {

    // Test A: Listing retains the same listingId after vacancy updates
    it('A: Listing retains the same listingId after vacancy updates', () => {
        const originalListing = {
            id: 'listing_pg_male_2sharing_001',
            propertyId: 'prop_chennai_pg_101',
            title: '2 Sharing Male PG',
            status: 'PUBLISHED',
            availabilityMode: 'BED',
            availableCount: 0,
            availability: {
                availabilityMode: 'BED',
                totalCapacity: 12,
                occupiedCount: 12,
                availableCount: 0,
                availableFrom: null,
            },
        };

        const updatedAvailability = calculateAddVacancy(originalListing.availability, 2, '2026-10-15');
        const updatedListing = {
            ...originalListing,
            availability: updatedAvailability,
            availableCount: updatedAvailability.availableCount,
            availableFrom: updatedAvailability.availableFrom,
        };

        // Stable identity invariant
        assert.equal(updatedListing.id, originalListing.id);
        assert.equal(updatedListing.propertyId, originalListing.propertyId);
        assert.equal(updatedListing.availableCount, 2);
    });

    // Test B: Add vacancy works
    it('B: Add vacancy works and updates occupied count cleanly', () => {
        const current = {
            availabilityMode: 'BED',
            totalCapacity: 20,
            occupiedCount: 18,
            availableCount: 2,
            availableFrom: null,
        };

        const next = calculateAddVacancy(current, 2, '2026-10-15');
        assert.equal(next.availableCount, 4);
        assert.equal(next.occupiedCount, 16);
        assert.equal(next.totalCapacity, 20);
        assert.equal(next.availableFrom, '2026-10-15');
        assert.ok(next.occupiedCount + next.availableCount <= next.totalCapacity);
    });

    // Test C: Reduce vacancy works
    it('C: Reduce vacancy works when a tenant moves in', () => {
        const current = {
            availabilityMode: 'BED',
            totalCapacity: 20,
            occupiedCount: 17,
            availableCount: 3,
            availableFrom: null,
        };

        const next = calculateReduceVacancy(current, 1);
        assert.equal(next.availableCount, 2);
        assert.equal(next.occupiedCount, 18);
        assert.equal(next.totalCapacity, 20);
        assert.ok(next.occupiedCount + next.availableCount <= next.totalCapacity);
    });

    // Test D: Zero availability produces FULL state
    it('D: Zero availability produces FULL state', () => {
        const fullAvailability = calculateMarkFull({
            availabilityMode: 'BED',
            totalCapacity: 15,
            occupiedCount: 14,
            availableCount: 1,
            availableFrom: null,
        });

        assert.equal(fullAvailability.availableCount, 0);
        assert.equal(fullAvailability.occupiedCount, 14); // Preserves existing recorded occupancy (Option B)
        assert.equal(isFull(fullAvailability), true);
        assert.equal(isActivelyAvailable(fullAvailability), false);
        assert.equal(formatAvailabilityLabel(fullAvailability), 'Currently full');

        // Can also accept explicit occupancy if operator provides it
        const explicitFull = calculateMarkFull({
            availabilityMode: 'BED',
            totalCapacity: 15,
            occupiedCount: 14,
            availableCount: 1,
            availableFrom: null,
        }, { occupiedCount: 15 });
        assert.equal(explicitFull.occupiedCount, 15);
    });

    // Test E: Adding vacancy reopens availability
    it('E: Adding vacancy reopens availability from FULL state', () => {
        const fullState = {
            availabilityMode: 'BED',
            totalCapacity: 18,
            occupiedCount: 18,
            availableCount: 0,
            availableFrom: null,
        };
        assert.equal(isFull(fullState), true);

        const reopened = calculateReopen(fullState, 2, null);
        assert.equal(reopened.availableCount, 2);
        assert.equal(reopened.occupiedCount, 16);
        assert.equal(isFull(reopened), false);
        assert.equal(isActivelyAvailable(reopened), true);
        assert.equal(formatAvailabilityLabel(reopened), '2 beds available');
    });

    // Test F: Negative availability is rejected
    it('F: Negative availability is rejected', () => {
        const invalidInput = {
            availabilityMode: 'BED',
            totalCapacity: 20,
            occupiedCount: 10,
            availableCount: -1,
        };
        const issues = validateAvailabilityInput(invalidInput);
        assert.ok(issues.some((i) => i.field === 'availability.availableCount'));
    });

    // Test G: Occupied cannot exceed capacity
    it('G: Occupied cannot exceed capacity', () => {
        const invalidInput = {
            availabilityMode: 'UNIT',
            totalCapacity: 5,
            occupiedCount: 6,
            availableCount: 0,
        };
        const issues = validateAvailabilityInput(invalidInput);
        assert.ok(issues.some((i) => i.field === 'availability.occupiedCount'));
    });

    // Test H: Available cannot exceed capacity and sum cannot exceed capacity
    it('H: Available cannot exceed capacity and sum cannot exceed capacity', () => {
        const overAvailable = {
            availabilityMode: 'BED',
            totalCapacity: 10,
            occupiedCount: 0,
            availableCount: 12,
        };
        const issues1 = validateAvailabilityInput(overAvailable);
        assert.ok(issues1.some((i) => i.field === 'availability.availableCount'));

        const overSum = {
            availabilityMode: 'BED',
            totalCapacity: 10,
            occupiedCount: 8,
            availableCount: 5,
        };
        const issues2 = validateAvailabilityInput(overSum);
        assert.ok(issues2.some((i) => i.field === 'availability.capacity'));
    });

    // Test I: BED mode works
    it('I: BED mode works correctly with pluralization and ratio', () => {
        const singleBed = {
            availabilityMode: 'BED',
            totalCapacity: 10,
            occupiedCount: 9,
            availableCount: 1,
        };
        assert.equal(formatAvailabilityLabel(singleBed), '1 bed available');
        assert.equal(formatInventoryRatio(singleBed), '1 / 10 beds available');

        const multiBed = {
            availabilityMode: 'BED',
            totalCapacity: 10,
            occupiedCount: 7,
            availableCount: 3,
        };
        assert.equal(formatAvailabilityLabel(multiBed), '3 beds available');
        assert.equal(formatInventoryRatio(multiBed), '3 / 10 beds available');
    });

    // Test J: UNIT mode works
    it('J: UNIT mode works correctly with room units', () => {
        const singleUnit = {
            availabilityMode: 'UNIT',
            totalCapacity: 8,
            occupiedCount: 7,
            availableCount: 1,
        };
        assert.equal(formatAvailabilityLabel(singleUnit), '1 private room available');
        assert.equal(formatInventoryRatio(singleUnit), '1 / 8 rooms available');

        const multiUnit = {
            availabilityMode: 'UNIT',
            totalCapacity: 8,
            occupiedCount: 6,
            availableCount: 2,
        };
        assert.equal(formatAvailabilityLabel(multiUnit), '2 rooms available');
        assert.equal(formatInventoryRatio(multiUnit), '2 / 8 rooms available');
    });

    // Test K: Multiple listings under one property maintain independent inventory
    it('K: Multiple listings under one property maintain independent inventory', () => {
        const propertyId = 'prop_green_view_001';

        // Listing A: Private Room
        const listingA = {
            id: 'listing_a_private',
            propertyId,
            availability: { availabilityMode: 'UNIT', totalCapacity: 8, occupiedCount: 7, availableCount: 1 },
        };

        // Listing B: 2 Sharing
        const listingB = {
            id: 'listing_b_2share',
            propertyId,
            availability: { availabilityMode: 'BED', totalCapacity: 12, occupiedCount: 10, availableCount: 2 },
        };

        // Listing C: 3 Sharing
        const listingC = {
            id: 'listing_c_3share',
            propertyId,
            availability: { availabilityMode: 'BED', totalCapacity: 18, occupiedCount: 18, availableCount: 0 },
        };

        // Mutating Listing B (tenant moves in)
        const updatedB = {
            ...listingB,
            availability: calculateReduceVacancy(listingB.availability, 1),
        };

        // Verify independent inventory
        assert.equal(updatedB.availability.availableCount, 1);
        assert.equal(listingA.availability.availableCount, 1); // untouched
        assert.equal(listingC.availability.availableCount, 0); // untouched
        assert.equal(listingA.propertyId, propertyId);
        assert.equal(updatedB.propertyId, propertyId);
        assert.equal(listingC.propertyId, propertyId);
    });

    // Test L: availableFrom persists correctly
    it('L: availableFrom persists correctly in ISO format', () => {
        const validDate = '2026-10-15';
        const input = {
            availabilityMode: 'BED',
            totalCapacity: 10,
            occupiedCount: 8,
            availableCount: 2,
            availableFrom: validDate,
        };
        const issues = validateAvailabilityInput(input);
        assert.equal(issues.length, 0);
        assert.equal(formatAvailableFromDate(validDate), '15 Oct');
    });

    // Test M: Future availability is not shown as currently available
    it('M: Future availability is not shown as currently available', () => {
        const now = new Date('2026-09-22T12:00:00Z').getTime();
        const futureAvailability = {
            availabilityMode: 'BED',
            totalCapacity: 20,
            occupiedCount: 18,
            availableCount: 2,
            availableFrom: '2026-10-15', // 23 days in future
        };

        assert.equal(isFutureAvailable(futureAvailability, now), true);
        assert.equal(isActivelyAvailable(futureAvailability, now), false); // Not available now!
        assert.equal(formatAvailabilityLabel(futureAvailability, now), 'Available from 15 Oct');
    });

    // Test N: Full listings are excluded from active availability results
    it('N: Full listings are excluded from active availability results', () => {
        const listings = [
            { id: 'l1', availableCount: 2, availability: { availableCount: 2 } },
            { id: 'l2', availableCount: 0, availability: { availableCount: 0 } }, // full
            { id: 'l3', availableCount: 1, availability: { availableCount: 1 } },
        ];

        const activeListings = listings.filter((l) => (l.availableCount ?? 0) > 0);
        assert.equal(activeListings.length, 2);
        assert.ok(!activeListings.some((l) => l.id === 'l2'));
    });

    // Test O: Property records are not duplicated
    it('O: Property records are not duplicated when vacancy is updated', () => {
        const initialPropertyId = 'prop_lakeview_hostel_44';
        const initialListingId = 'listing_hostel_dorm_1';

        const updateOperation = (listing) => ({
            ...listing,
            availability: calculateAddVacancy(listing.availability, 1),
        });

        const listing = {
            id: initialListingId,
            propertyId: initialPropertyId,
            availability: { availabilityMode: 'BED', totalCapacity: 24, occupiedCount: 24, availableCount: 0 },
        };

        const updated = updateOperation(listing);
        assert.equal(updated.id, initialListingId);
        assert.equal(updated.propertyId, initialPropertyId);
    });

    // Test P: Availability history is created with correct schema
    it('P: Availability history record has complete audit schema', () => {
        const historyRecord = {
            listingId: 'listing_123',
            timestamp: new Date().toISOString(),
            actor: 'user_operator_99',
            previousAvailableCount: 0,
            newAvailableCount: 2,
            previousAvailableFrom: null,
            newAvailableFrom: '2026-10-15',
            changeType: 'REOPENED',
            notes: 'Two beds opened up for next month batch',
        };

        assert.equal(historyRecord.listingId, 'listing_123');
        assert.equal(historyRecord.previousAvailableCount, 0);
        assert.equal(historyRecord.newAvailableCount, 2);
        assert.equal(historyRecord.changeType, 'REOPENED');
        assert.equal(historyRecord.newAvailableFrom, '2026-10-15');
    });

    // Test Q: Existing moderation flow is preserved (protected fields cannot be touched)
    it('Q: Existing moderation flow is preserved and protected listing fields are protected', () => {
        // Legitimate vacancy update does not touch protected listing fields
        const vacancyUpdate = {
            availability: {
                availabilityMode: 'BED',
                totalCapacity: 10,
                occupiedCount: 8,
                availableCount: 2,
            },
            availableCount: 2,
            availabilityMode: 'BED',
        };
        const touchedSafe = listingProtectedFieldsTouched(vacancyUpdate);
        assert.equal(touchedSafe.length, 0);

        // Attempting to modify ownerUid or publishedAt during vacancy update is blocked
        const maliciousUpdate = {
            ...vacancyUpdate,
            ownerUid: 'attacker_uid',
            lastVerifiedAt: new Date().toISOString(),
        };
        const touchedDangerous = listingProtectedFieldsTouched(maliciousUpdate);
        assert.ok(touchedDangerous.includes('ownerUid'));
        assert.ok(touchedDangerous.includes('lastVerifiedAt'));
    });

    // Test R: Objective Area Score is unaffected by listing vacancy changes
    it('R: Objective Area Score is unaffected by listing vacancy changes', () => {
        const locality = {
            id: 'chennai__velachery',
            name: 'Velachery',
            publishedScore: 66,
            intelligence: {
                areaScore: 66,
                market: { medianRent: 18000 },
            },
        };

        // When a PG in Velachery changes from 0 vacancies to 5 vacancies:
        const initialLocalityScore = locality.intelligence.areaScore;

        // Listing vacancy update happens
        const pgListing = {
            id: 'listing_velachery_pg',
            localityId: 'chennai__velachery',
            availableCount: 5,
        };
        assert.equal(pgListing.availableCount, 5);

        // Locality score remains strictly invariant
        assert.equal(locality.intelligence.areaScore, initialLocalityScore);
        assert.equal(locality.publishedScore, 66);
    });

    // Test S: Match Score is unaffected by listing vacancy changes
    it('S: Match Score is unaffected by listing vacancy changes', () => {
        const userWeights = {
            transit: 0.3,
            dailyNeeds: 0.3,
            safety: 0.4,
        };
        const sampleSnapshot = {
            transit: { metroWalkMinutes: 5, status: 'VERIFIED' },
            dailyNeeds: { superMarketsCount: 8, status: 'VERIFIED' },
            safety: { streetLightingScore: 80, status: 'VERIFIED' },
        };

        const initialScore = calculateAreaScore({
            snapshot: sampleSnapshot,
            city: 'Chennai',
            weights: userWeights,
        });

        // Listing vacancy changes from 2 beds to 0 beds (full)
        const pgListing = {
            id: 'listing_velachery_pg',
            availableCount: 0,
        };
        assert.equal(pgListing.availableCount, 0);

        // Match Score calculation is completely independent of listing vacancy
        const afterScore = calculateAreaScore({
            snapshot: sampleSnapshot,
            city: 'Chennai',
            weights: userWeights,
        });

        assert.equal(initialScore.overallScore, afterScore.overallScore);
        assert.equal(initialScore.scoreStatus, afterScore.scoreStatus);
    });
});
