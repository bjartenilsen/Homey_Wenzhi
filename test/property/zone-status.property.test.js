/**
 * **Feature: homey-mtd085-zb-app, Property 2: Zone Status to Motion Capability Mapping**
 * **Validates: Requirements 2.1, 2.2**
 * 
 * *For any* IAS Zone status value (16-bit integer), the motion alarm capability
 * SHALL be set to true if and only if bit 0 (alarm1) of the zone status is set to 1.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseZoneStatus, isPresenceDetected } from '../../lib/zone-status-parser.js';

describe('Property 2: Zone Status to Motion Capability Mapping', () => {
  // Generator for valid 16-bit zone status values (0x0000 to 0xFFFF)
  const zoneStatusArb = fc.integer({ min: 0, max: 0xFFFF });

  it('isPresenceDetected returns true iff bit 0 is set', () => {
    fc.assert(
      fc.property(zoneStatusArb, (zoneStatus) => {
        const bit0Set = (zoneStatus & 0x0001) !== 0;
        const result = isPresenceDetected(zoneStatus);
        return result === bit0Set;
      }),
      { numRuns: 100 }
    );
  });

  it('parseZoneStatus.alarm1 equals isPresenceDetected result', () => {
    fc.assert(
      fc.property(zoneStatusArb, (zoneStatus) => {
        const parsed = parseZoneStatus(zoneStatus);
        const presence = isPresenceDetected(zoneStatus);
        return parsed.alarm1 === presence;
      }),
      { numRuns: 100 }
    );
  });

  it('parseZoneStatus correctly extracts all status bits', () => {
    fc.assert(
      fc.property(zoneStatusArb, (zoneStatus) => {
        const parsed = parseZoneStatus(zoneStatus);
        
        // Verify each bit is correctly extracted
        const expectedAlarm1 = (zoneStatus & 0x0001) !== 0;
        const expectedAlarm2 = (zoneStatus & 0x0002) !== 0;
        const expectedTamper = (zoneStatus & 0x0004) !== 0;
        const expectedBattery = (zoneStatus & 0x0008) !== 0;
        const expectedSupervision = (zoneStatus & 0x0010) !== 0;
        const expectedRestore = (zoneStatus & 0x0020) !== 0;
        const expectedTrouble = (zoneStatus & 0x0040) !== 0;
        const expectedAcMains = (zoneStatus & 0x0080) !== 0;

        return (
          parsed.alarm1 === expectedAlarm1 &&
          parsed.alarm2 === expectedAlarm2 &&
          parsed.tamper === expectedTamper &&
          parsed.battery === expectedBattery &&
          parsed.supervisionReports === expectedSupervision &&
          parsed.restoreReports === expectedRestore &&
          parsed.trouble === expectedTrouble &&
          parsed.acMains === expectedAcMains
        );
      }),
      { numRuns: 100 }
    );
  });

  it('presence detection is independent of other status bits', () => {
    // Generate zone status with random other bits but controlled bit 0
    const controlledBit0Arb = fc.tuple(
      fc.boolean(), // bit 0 value
      fc.integer({ min: 0, max: 0x7FFF }) // other bits (shifted left by 1)
    ).map(([bit0, otherBits]) => {
      const status = (otherBits << 1) | (bit0 ? 1 : 0);
      return { status: status & 0xFFFF, expectedPresence: bit0 };
    });

    fc.assert(
      fc.property(controlledBit0Arb, ({ status, expectedPresence }) => {
        return isPresenceDetected(status) === expectedPresence;
      }),
      { numRuns: 100 }
    );
  });
});
