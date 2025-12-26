/**
 * **Feature: homey-mtd085-zb-app, Property 5: App Manifest Validation**
 * **Validates: Requirements 6.1, 6.5**
 * 
 * *For any* valid app manifest, the manifest SHALL contain all required fields:
 * id, version, compatibility, sdk, name, description, category, drivers,
 * and the sdk field SHALL be >= 3.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// Required fields for a valid Homey app manifest
const REQUIRED_FIELDS = ['id', 'version', 'compatibility', 'sdk', 'name', 'description', 'category', 'drivers'];

/**
 * Validates that a manifest object contains all required fields
 * and meets SDK version requirements
 */
function validateManifest(manifest) {
  const errors = [];
  
  // Check all required fields exist
  for (const field of REQUIRED_FIELDS) {
    if (!(field in manifest)) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Check SDK version is >= 3
  if ('sdk' in manifest && manifest.sdk < 3) {
    errors.push(`SDK version must be >= 3, got ${manifest.sdk}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

describe('Property 5: App Manifest Validation', () => {
  // Generator for valid manifest objects - using constantFrom for speed
  const validManifestArb = fc.record({
    id: fc.constantFrom('com.test.app', 'com.example.sensor', 'nl.company.device'),
    version: fc.constantFrom('1.0.0', '2.0.0', '1.2.3'),
    compatibility: fc.constantFrom('>=5.0.0', '>=4.0.0'),
    sdk: fc.integer({ min: 3, max: 10 }),
    name: fc.constant({ en: 'Test App' }),
    description: fc.constant({ en: 'Test Description' }),
    category: fc.constantFrom(['security'], ['lights'], ['climate']),
    drivers: fc.constant([])
  });

  // Generator for invalid SDK versions
  const invalidSdkManifestArb = fc.record({
    id: fc.constantFrom('com.test.app', 'com.example.sensor'),
    version: fc.constantFrom('1.0.0', '2.0.0'),
    compatibility: fc.constantFrom('>=5.0.0'),
    sdk: fc.integer({ min: 1, max: 2 }), // Invalid: SDK < 3
    name: fc.constant({ en: 'Test App' }),
    description: fc.constant({ en: 'Test Description' }),
    category: fc.constant(['security']),
    drivers: fc.constant([])
  });

  it('should validate manifests with all required fields and sdk >= 3', () => {
    fc.assert(
      fc.property(validManifestArb, (manifest) => {
        const result = validateManifest(manifest);
        return result.valid === true;
      }),
      { numRuns: 100 }
    );
  });

  it('should reject manifests with sdk < 3', () => {
    fc.assert(
      fc.property(invalidSdkManifestArb, (manifest) => {
        const result = validateManifest(manifest);
        return result.valid === false && result.errors.some(e => e.includes('SDK version'));
      }),
      { numRuns: 100 }
    );
  });

  it('should reject manifests missing required fields', () => {
    // Generator that removes one required field
    const missingFieldArb = fc.tuple(
      validManifestArb,
      fc.constantFrom(...REQUIRED_FIELDS)
    ).map(([manifest, fieldToRemove]) => {
      const copy = { ...manifest };
      delete copy[fieldToRemove];
      return { manifest: copy, removedField: fieldToRemove };
    });

    fc.assert(
      fc.property(missingFieldArb, ({ manifest, removedField }) => {
        const result = validateManifest(manifest);
        return result.valid === false && result.errors.some(e => e.includes(removedField));
      }),
      { numRuns: 100 }
    );
  });

  it('should validate the actual app.json manifest', () => {
    const manifestPath = path.join(process.cwd(), 'app.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    
    const result = validateManifest(manifest);
    expect(result.valid).toBe(true);
    expect(manifest.sdk).toBeGreaterThanOrEqual(3);
  });
});
