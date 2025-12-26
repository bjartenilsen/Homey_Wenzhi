/**
 * **Feature: homey-mtd085-zb-app, Property 4: Configuration Retry Logic**
 * **Validates: Requirements 4.4**
 * 
 * *For any* sequence of IAS Zone configuration attempts where the first N attempts
 * fail (N < 3), the system SHALL retry until success or until 3 failures occur,
 * at which point it SHALL report failure.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { withRetrySync } from '../../lib/retry.js';

describe('Property 4: Configuration Retry Logic', () => {
  const MAX_RETRIES = 3;

  /**
   * Creates an operation that fails for the first N attempts then succeeds
   * @param {number} failCount - Number of times to fail before succeeding
   * @returns {Function} Operation function
   */
  function createFailThenSucceedOperation(failCount) {
    let callCount = 0;
    return () => {
      callCount++;
      if (callCount <= failCount) {
        return { success: false, error: new Error(`Attempt ${callCount} failed`) };
      }
      return { success: true, value: 'configured' };
    };
  }

  /**
   * Creates an operation that always fails
   * @returns {Function} Operation function
   */
  function createAlwaysFailOperation() {
    let callCount = 0;
    return () => {
      callCount++;
      return { success: false, error: new Error(`Attempt ${callCount} failed`) };
    };
  }

  it('succeeds immediately when operation succeeds on first try', () => {
    fc.assert(
      fc.property(fc.constant(0), (failCount) => {
        const operation = createFailThenSucceedOperation(failCount);
        const result = withRetrySync(operation, MAX_RETRIES);
        
        return result.success === true && result.attempts === 1;
      }),
      { numRuns: 100 }
    );
  });

  it('retries and succeeds when failures < maxRetries', () => {
    // Generate fail counts from 1 to MAX_RETRIES - 1
    const failCountArb = fc.integer({ min: 1, max: MAX_RETRIES - 1 });

    fc.assert(
      fc.property(failCountArb, (failCount) => {
        const operation = createFailThenSucceedOperation(failCount);
        const result = withRetrySync(operation, MAX_RETRIES);
        
        // Should succeed after failCount + 1 attempts
        return (
          result.success === true &&
          result.attempts === failCount + 1
        );
      }),
      { numRuns: 100 }
    );
  });

  it('fails after exactly maxRetries attempts when all fail', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const operation = createAlwaysFailOperation();
        const result = withRetrySync(operation, MAX_RETRIES);
        
        return (
          result.success === false &&
          result.attempts === MAX_RETRIES &&
          result.error !== undefined
        );
      }),
      { numRuns: 100 }
    );
  });

  it('number of attempts equals min(failCount + 1, maxRetries)', () => {
    // Generate fail counts from 0 to MAX_RETRIES + 2 to test boundary
    const failCountArb = fc.integer({ min: 0, max: MAX_RETRIES + 2 });

    fc.assert(
      fc.property(failCountArb, (failCount) => {
        const operation = createFailThenSucceedOperation(failCount);
        const result = withRetrySync(operation, MAX_RETRIES);
        
        const expectedAttempts = Math.min(failCount + 1, MAX_RETRIES);
        const expectedSuccess = failCount < MAX_RETRIES;
        
        return (
          result.attempts === expectedAttempts &&
          result.success === expectedSuccess
        );
      }),
      { numRuns: 100 }
    );
  });

  it('preserves error from last failed attempt', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        let lastAttempt = 0;
        const operation = () => {
          lastAttempt++;
          return { 
            success: false, 
            error: new Error(`Attempt ${lastAttempt} failed`) 
          };
        };
        
        const result = withRetrySync(operation, MAX_RETRIES);
        
        return (
          result.success === false &&
          result.error.message === `Attempt ${MAX_RETRIES} failed`
        );
      }),
      { numRuns: 100 }
    );
  });

  it('works with configurable maxRetries values', () => {
    // Test with different maxRetries values
    const maxRetriesArb = fc.integer({ min: 1, max: 10 });
    const failCountArb = fc.integer({ min: 0, max: 15 });

    fc.assert(
      fc.property(maxRetriesArb, failCountArb, (maxRetries, failCount) => {
        const operation = createFailThenSucceedOperation(failCount);
        const result = withRetrySync(operation, maxRetries);
        
        const expectedAttempts = Math.min(failCount + 1, maxRetries);
        const expectedSuccess = failCount < maxRetries;
        
        return (
          result.attempts === expectedAttempts &&
          result.success === expectedSuccess
        );
      }),
      { numRuns: 100 }
    );
  });
});
