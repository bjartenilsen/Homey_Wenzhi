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
 * Converts zone status to a number, handling Buffer input
 * 
 * @param {number|Buffer|Object} zoneStatus - Zone status value (number or Buffer)
 * @returns {number} Zone status as a number
 */
function toZoneStatusNumber(zoneStatus) {
  if (typeof zoneStatus === 'number') {
    return zoneStatus;
  }
  if (Buffer.isBuffer(zoneStatus)) {
    // Little-endian 16-bit value
    return zoneStatus.readUInt16LE(0);
  }
  if (zoneStatus && zoneStatus.type === 'Buffer' && Array.isArray(zoneStatus.data)) {
    // Handle serialized Buffer format from interview
    return Buffer.from(zoneStatus.data).readUInt16LE(0);
  }
  return 0;
}

/**
 * Parses a 16-bit IAS Zone status value into individual status flags
 * 
 * @param {number|Buffer} zoneStatus - 16-bit zone status value
 * @returns {ParsedZoneStatus} Parsed status object with boolean flags
 */
function parseZoneStatus(zoneStatus) {
  const status = toZoneStatusNumber(zoneStatus);
  return {
    alarm1: (status & 0x0001) !== 0,
    alarm2: (status & 0x0002) !== 0,
    tamper: (status & 0x0004) !== 0,
    battery: (status & 0x0008) !== 0,
    supervisionReports: (status & 0x0010) !== 0,
    restoreReports: (status & 0x0020) !== 0,
    trouble: (status & 0x0040) !== 0,
    acMains: (status & 0x0080) !== 0,
  };
}

/**
 * Checks if presence is detected based on zone status
 * Presence is indicated by the alarm1 bit (bit 0)
 * 
 * @param {number|Buffer} zoneStatus - 16-bit zone status value
 * @returns {boolean} True if presence is detected (alarm1 bit is set)
 */
function isPresenceDetected(zoneStatus) {
  const status = toZoneStatusNumber(zoneStatus);
  return (status & 0x0001) !== 0;
}

module.exports = {
  parseZoneStatus,
  isPresenceDetected,
};
