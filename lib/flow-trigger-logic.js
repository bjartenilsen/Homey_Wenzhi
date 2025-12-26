'use strict';

/**
 * Flow trigger types
 * @typedef {'motion_detected' | 'motion_cleared' | null} FlowTriggerType
 */

/**
 * Determines which flow card should be triggered based on state transition
 * 
 * @param {boolean|null} previousState - Previous alarm_motion state (null if unknown)
 * @param {boolean} newState - New alarm_motion state
 * @returns {FlowTriggerType} The flow card to trigger, or null if no trigger needed
 */
function determineFlowTrigger(previousState, newState) {
  // No trigger if state hasn't changed
  if (previousState === newState) {
    return null;
  }

  // Trigger motion_detected when changing to true
  if (newState === true) {
    return 'motion_detected';
  }

  // Trigger motion_cleared when changing to false
  if (newState === false) {
    return 'motion_cleared';
  }

  return null;
}

module.exports = {
  determineFlowTrigger,
};
