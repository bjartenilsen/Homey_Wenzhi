'use strict';

/**
 * Zone Status Parser for IAS Zone cluster
 * Parses the 16-bit zone status bitmap from Zigbee IAS Zone devices
 * 
 * @module lib/zone-status-parser
 */

/**
 * @typedef {Object} ParsedZoneStatus
 * @property {boolean} alarm1 - Bit 0: Zone alarm 1 (presence detected)
 * @property {boolean} alarm2 - Bit 1: Zone alarm 2
 * @property {boolean} tamper - Bit 2: Tamper
 * @property {boolean} battery - Bit 3: Battery low
 * @property {boolean} supervisionReports - Bit 4: Supervision reports
 * @property {boolean} restoreReports - Bit 5: Restore reports
 * @property {boolean} trouble - Bit 6: Trouble
 * @property {boolean} acMains - Bit 7: AC mains fault
 */

/**
 * Parses a 16-bit IAS Zone status value into individual status flags
 * 
 * @param {number} zoneStatus - 16-bit zone status value
 * @returns {ParsedZoneStatus} Parsed status object with boolean flags
 */
function parseZoneStatus(zoneStatus) {
  return {
    alarm1: (zoneStatus & 0x0001) !== 0,
    alarm2: (zoneStatus & 0x0002) !== 0,
    tamper: (zoneStatus & 0x0004) !== 0,
    battery: (zoneStatus & 0x0008) !== 0,
    supervisionReports: (zoneStatus & 0x0010) !== 0,
    restoreReports: (zoneStatus & 0x0020) !== 0,
    trouble: (zoneStatus & 0x0040) !== 0,
    acMains: (zoneStatus & 0x0080) !== 0,
  };
}

/**
 * Checks if presence is detected based on zone status
 * Presence is indicated by the alarm1 bit (bit 0)
 * 
 * @param {number} zoneStatus - 16-bit zone status value
 * @returns {boolean} True if presence is detected (alarm1 bit is set)
 */
function isPresenceDetected(zoneStatus) {
  return (zoneStatus & 0x0001) !== 0;
}

module.exports = {
  parseZoneStatus,
  isPresenceDetected,
};
