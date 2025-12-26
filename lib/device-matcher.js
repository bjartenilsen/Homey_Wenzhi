'use strict';

/**
 * Device Matcher for MTD085-ZB presence sensor
 * Identifies the Wenzhi/LeapMMW MTD085-ZB device by modelId and manufacturerName
 * 
 * @module lib/device-matcher
 */

/**
 * Expected device identifiers for MTD085-ZB
 */
const EXPECTED_MODEL_ID = 'TS0225';
const EXPECTED_MANUFACTURER_NAME = '_TZ321C_fkzihax8';

/**
 * @typedef {Object} ZigbeeDeviceInfo
 * @property {string} modelId - The Zigbee model identifier
 * @property {string} manufacturerName - The Zigbee manufacturer name
 */

/**
 * Checks if a Zigbee device matches the MTD085-ZB presence sensor
 * 
 * @param {ZigbeeDeviceInfo} device - Device info containing modelId and manufacturerName
 * @returns {boolean} True if device matches MTD085-ZB identifiers
 */
function isMatchingDevice(device) {
  if (!device || typeof device !== 'object') {
    return false;
  }
  
  return (
    device.modelId === EXPECTED_MODEL_ID &&
    device.manufacturerName === EXPECTED_MANUFACTURER_NAME
  );
}

module.exports = {
  isMatchingDevice,
  EXPECTED_MODEL_ID,
  EXPECTED_MANUFACTURER_NAME,
};
