'use strict';

const { ZigBeeDriver } = require('homey-zigbeedriver');

/**
 * MTD085-ZB Presence Sensor Driver
 * Driver entry point for the Wenzhi/LeapMMW MTD085-ZB mmWave presence sensor
 * 
 * @class MTD085ZBDriver
 * @extends ZigBeeDriver
 */
class MTD085ZBDriver extends ZigBeeDriver {
  /**
   * Called when the driver is initialized
   * 
   * @returns {Promise<void>}
   */
  async onInit() {
    this.log('MTD085-ZB driver initialized');
  }
}

module.exports = MTD085ZBDriver;
