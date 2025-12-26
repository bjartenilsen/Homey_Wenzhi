/**
 * **Feature: homey-mtd085-zb-app, Property 3: Flow Card Triggering on State Change**
 * **Validates: Requirements 3.1, 3.2**
 * 
 * *For any* presence state transition, when the motion alarm capability changes
 * from false to true, the "motion_detected" trigger SHALL fire; when it changes
 * from true to false, the "motion_cleared" trigger SHALL fire; when the state
 * does not change, no trigger SHALL fire.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { determineFlowTrigger } from '../../lib/flow-trigger-logic.js';

describe('Property 3: Flow Card Triggering on State Change', () => {
  // Generator for boolean states (previous and new)
  const booleanStateArb = fc.boolean();
  
  // Generator for state transitions
  const stateTransitionArb = fc.tuple(
    fc.oneof(fc.constant(null), fc.boolean()), // previous state (can be null/unknown)
    fc.boolean() // new state
  );

  it('triggers motion_detected when state changes from false to true', () => {
    fc.assert(
      fc.property(fc.constant([false, true]), ([prevState, newState]) => {
        const trigger = determineFlowTrigger(prevState, newState);
        return trigger === 'motion_detected';
      }),
      { numRuns: 100 }
    );
  });

  it('triggers motion_cleared when state changes from true to false', () => {
    fc.assert(
      fc.property(fc.constant([true, false]), ([prevState, newState]) => {
        const trigger = determineFlowTrigger(prevState, newState);
        return trigger === 'motion_cleared';
      }),
      { numRuns: 100 }
    );
  });

  it('does not trigger when state remains the same', () => {
    fc.assert(
      fc.property(booleanStateArb, (state) => {
        const trigger = determineFlowTrigger(state, state);
        return trigger === null;
      }),
      { numRuns: 100 }
    );
  });

  it('for any state transition, trigger type matches the transition direction', () => {
    fc.assert(
      fc.property(stateTransitionArb, ([prevState, newState]) => {
        const trigger = determineFlowTrigger(prevState, newState);
        
        // If states are equal, no trigger
        if (prevState === newState) {
          return trigger === null;
        }
        
        // If transitioning to true, motion_detected
        if (newState === true) {
          return trigger === 'motion_detected';
        }
        
        // If transitioning to false, motion_cleared
        if (newState === false) {
          return trigger === 'motion_cleared';
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('trigger is symmetric: false->true and true->false produce opposite triggers', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const toTrue = determineFlowTrigger(false, true);
        const toFalse = determineFlowTrigger(true, false);
        
        return (
          toTrue === 'motion_detected' &&
          toFalse === 'motion_cleared' &&
          toTrue !== toFalse
        );
      }),
      { numRuns: 100 }
    );
  });
});
