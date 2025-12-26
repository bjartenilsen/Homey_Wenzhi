/**
 * **Feature: homey-mtd085-zb-app, Property 1: Device Identification Matching**
 * **Validates: Requirements 1.1**
 * 
 * *For any* Zigbee device info containing modelId and manufacturerName,
 * the device matcher SHALL return true if and only if modelId equals "TS0225"
 * AND manufacturerName equals "_TZ321C_fkzihax8".
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isMatchingDevice,
  EXPECTED_MODEL_ID,
  EXPECTED_MANUFACTURER_NAME,
} from '../../lib/device-matcher.js';

describe('Property 1: Device Identification Matching', () => {
  // Generator for random model IDs (excluding the expected one)
  const randomModelIdArb = fc.string({ minLength: 1, maxLength: 20 })
    .filter(s => s !== EXPECTED_MODEL_ID);

  // Generator for random manufacturer names (excluding the expected one)
  const randomManufacturerArb = fc.string({ minLength: 1, maxLength: 30 })
    .filter(s => s !== EXPECTED_MANUFACTURER_NAME);

  // Generator for valid device info objects
  const deviceInfoArb = fc.record({
    modelId: fc.string({ minLength: 0, maxLength: 20 }),
    manufacturerName: fc.string({ minLength: 0, maxLength: 30 }),
  });

  it('returns true only when both modelId and manufacturerName match exactly', () => {
    fc.assert(
      fc.property(deviceInfoArb, (device) => {
        const result = isMatchingDevice(device);
        const shouldMatch = (
          device.modelId === EXPECTED_MODEL_ID &&
          device.manufacturerName === EXPECTED_MANUFACTURER_NAME
        );
        return result === shouldMatch;
      }),
      { numRuns: 100 }
    );
  });

  it('returns true for exact match of TS0225 and _TZ321C_fkzihax8', () => {
    const exactMatchDevice = {
      modelId: EXPECTED_MODEL_ID,
      manufacturerName: EXPECTED_MANUFACTURER_NAME,
    };
    expect(isMatchingDevice(exactMatchDevice)).toBe(true);
  });

  it('returns false when modelId does not match', () => {
    fc.assert(
      fc.property(randomModelIdArb, (modelId) => {
        const device = {
          modelId,
          manufacturerName: EXPECTED_MANUFACTURER_NAME,
        };
        return isMatchingDevice(device) === false;
      }),
      { numRuns: 100 }
    );
  });

  it('returns false when manufacturerName does not match', () => {
    fc.assert(
      fc.property(randomManufacturerArb, (manufacturerName) => {
        const device = {
          modelId: EXPECTED_MODEL_ID,
          manufacturerName,
        };
        return isMatchingDevice(device) === false;
      }),
      { numRuns: 100 }
    );
  });

  it('returns false when neither field matches', () => {
    fc.assert(
      fc.property(randomModelIdArb, randomManufacturerArb, (modelId, manufacturerName) => {
        const device = { modelId, manufacturerName };
        return isMatchingDevice(device) === false;
      }),
      { numRuns: 100 }
    );
  });

  it('returns false for null or invalid device objects', () => {
    expect(isMatchingDevice(null)).toBe(false);
    expect(isMatchingDevice(undefined)).toBe(false);
    expect(isMatchingDevice({})).toBe(false);
    expect(isMatchingDevice('string')).toBe(false);
    expect(isMatchingDevice(123)).toBe(false);
  });
});
