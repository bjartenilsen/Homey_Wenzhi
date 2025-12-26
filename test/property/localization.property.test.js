/**
 * **Feature: homey-mtd085-zb-app, Property 6: Localization Completeness**
 * **Validates: Requirements 6.3**
 * 
 * *For any* localization file, all required keys (app name, app description,
 * device name, flow card titles) SHALL be present and non-empty for the English locale.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// Required localization keys for English locale
const REQUIRED_KEYS = [
  'app.name',
  'app.description',
  'device.name',
  'flow.triggers.motion_detected.title',
  'flow.triggers.motion_cleared.title',
  'flow.conditions.is_motion_detected.title'
];

/**
 * Gets a nested value from an object using dot notation
 */
function getNestedValue(obj, keyPath) {
  const keys = keyPath.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = current[key];
  }
  
  return current;
}

/**
 * Validates that a localization object contains all required keys with non-empty values
 */
function validateLocalization(localization) {
  const errors = [];
  
  for (const keyPath of REQUIRED_KEYS) {
    const value = getNestedValue(localization, keyPath);
    
    if (value === undefined) {
      errors.push(`Missing required key: ${keyPath}`);
    } else if (typeof value !== 'string') {
      errors.push(`Key ${keyPath} must be a string, got ${typeof value}`);
    } else if (value.trim().length === 0) {
      errors.push(`Key ${keyPath} must not be empty`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

describe('Property 6: Localization Completeness', () => {
  // Generator for valid localization objects - using constantFrom for speed
  const validLocalizationArb = fc.record({
    app: fc.record({
      name: fc.constantFrom('App Name', 'My Sensor', 'Device App'),
      description: fc.constantFrom('Description 1', 'Description 2', 'App desc')
    }),
    device: fc.record({
      name: fc.constantFrom('Device Name', 'Sensor', 'Presence Detector')
    }),
    flow: fc.record({
      triggers: fc.record({
        motion_detected: fc.record({
          title: fc.constantFrom('Motion detected', 'Presence detected')
        }),
        motion_cleared: fc.record({
          title: fc.constantFrom('Motion cleared', 'Presence cleared')
        })
      }),
      conditions: fc.record({
        is_motion_detected: fc.record({
          title: fc.constantFrom('Motion is detected', 'Is presence')
        })
      })
    })
  });

  it('should validate localizations with all required keys present and non-empty', () => {
    fc.assert(
      fc.property(validLocalizationArb, (localization) => {
        const result = validateLocalization(localization);
        return result.valid === true;
      }),
      { numRuns: 100 }
    );
  });

  it('should reject localizations with missing keys', () => {
    // Generator that creates localization with one missing key
    const missingKeyArb = fc.constantFrom(...REQUIRED_KEYS).map(keyToRemove => {
      // Create a valid localization then remove one key
      const localization = {
        app: { name: 'Test App', description: 'Test Description' },
        device: { name: 'Test Device' },
        flow: {
          triggers: {
            motion_detected: { title: 'Motion Detected' },
            motion_cleared: { title: 'Motion Cleared' }
          },
          conditions: {
            is_motion_detected: { title: 'Is Motion Detected' }
          }
        }
      };
      
      // Remove the specified key
      const keys = keyToRemove.split('.');
      let current = localization;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      delete current[keys[keys.length - 1]];
      
      return { localization, removedKey: keyToRemove };
    });

    fc.assert(
      fc.property(missingKeyArb, ({ localization, removedKey }) => {
        const result = validateLocalization(localization);
        return result.valid === false && result.errors.some(e => e.includes(removedKey));
      }),
      { numRuns: 100 }
    );
  });

  it('should reject localizations with empty string values', () => {
    // Generator that creates localization with one empty value
    const emptyValueArb = fc.constantFrom(...REQUIRED_KEYS).map(keyToEmpty => {
      const localization = {
        app: { name: 'Test App', description: 'Test Description' },
        device: { name: 'Test Device' },
        flow: {
          triggers: {
            motion_detected: { title: 'Motion Detected' },
            motion_cleared: { title: 'Motion Cleared' }
          },
          conditions: {
            is_motion_detected: { title: 'Is Motion Detected' }
          }
        }
      };
      
      // Set the specified key to empty string
      const keys = keyToEmpty.split('.');
      let current = localization;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = '';
      
      return { localization, emptyKey: keyToEmpty };
    });

    fc.assert(
      fc.property(emptyValueArb, ({ localization, emptyKey }) => {
        const result = validateLocalization(localization);
        return result.valid === false && result.errors.some(e => e.includes(emptyKey));
      }),
      { numRuns: 100 }
    );
  });

  it('should validate the actual en.json localization file', () => {
    const localePath = path.join(process.cwd(), 'locales', 'en.json');
    const localization = JSON.parse(fs.readFileSync(localePath, 'utf-8'));
    
    const result = validateLocalization(localization);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
