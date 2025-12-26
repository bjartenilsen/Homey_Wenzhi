'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { isPresenceDetected } = require('../../lib/zone-status-parser');
const { withRetry } = require('../../lib/retry');

/**
 * MTD085-ZB Presence Sensor Device
 * Handles the Wenzhi/LeapMMW MTD085-ZB mmWave presence sensor
 * 
 * @class MTD085ZBDevice
 * @extends ZigBeeDevice
 */
class MTD085ZBDevice extends ZigBeeDevice {
  /**
   * Maximum number of configuration retry attempts
   * @type {number}
   */
  static MAX_RETRIES = 3;

  /**
   * Delay between retry attempts in milliseconds
   * @type {number}
   */
  static RETRY_DELAY = 1000;

  /**
   * Called when the device is initialized
   * Sets up IAS Zone cluster handling and configures the device
   * 
   * @returns {Promise<void>}
   */
  async onInit() {
    this.log('MTD085-ZB device initializing...');

    // Register IAS Zone cluster for zone status change notifications
    this.registerIASZoneHandler();

    this.log('MTD085-ZB device initialized');
  }

  /**
   * Called when the device is added to Homey
   * Configures the IAS Zone cluster with retry logic
   * 
   * @returns {Promise<void>}
   */
  async onAdded() {
    this.log('MTD085-ZB device added, configuring IAS Zone...');
    
    try {
      await this.configureIASZoneWithRetry();
      this.log('IAS Zone configuration completed successfully');
    } catch (error) {
      this.error('Failed to configure IAS Zone after max retries:', error);
      throw error;
    }
  }

  /**
   * Called when the device is deleted from Homey
   * Performs cleanup operations
   * 
   * @returns {Promise<void>}
   */
  async onDeleted() {
    this.log('MTD085-ZB device deleted');
  }

  /**
   * Registers the IAS Zone cluster handler for zone status change notifications
   */
  registerIASZoneHandler() {
    const iasZoneCluster = this.zclNode.endpoints[1].clusters.iasZone;
    
    if (iasZoneCluster) {
      iasZoneCluster.onZoneStatusChangeNotification = this.onZoneStatusChange.bind(this);
      this.log('IAS Zone handler registered');
    } else {
      this.error('IAS Zone cluster not found on endpoint 1');
    }
  }

  /**
   * Handles zone status change notifications from the IAS Zone cluster
   * Updates the alarm_motion capability based on presence detection
   * 
   * @param {Object} payload - Zone status change payload
   * @param {number} payload.zoneStatus - 16-bit zone status bitmap
   * @returns {Promise<void>}
   */
  async onZoneStatusChange(payload) {
    const { zoneStatus } = payload;
    this.log('Zone status change received:', zoneStatus);

    const presenceDetected = isPresenceDetected(zoneStatus);
    const currentState = this.getCapabilityValue('alarm_motion');

    if (presenceDetected !== currentState) {
      await this.setCapabilityValue('alarm_motion', presenceDetected);
      this.log('Motion alarm updated:', presenceDetected);

      // Trigger appropriate flow card
      if (presenceDetected) {
        await this.homey.flow.getDeviceTriggerCard('motion_detected').trigger(this);
      } else {
        await this.homey.flow.getDeviceTriggerCard('motion_cleared').trigger(this);
      }
    }
  }

  /**
   * Configures the IAS Zone cluster with retry logic
   * Retries up to MAX_RETRIES times on failure
   * 
   * @returns {Promise<void>}
   * @throws {Error} If configuration fails after max retries
   */
  async configureIASZoneWithRetry() {
    const result = await withRetry(
      () => this.configureIASZone(),
      {
        maxRetries: MTD085ZBDevice.MAX_RETRIES,
        delay: MTD085ZBDevice.RETRY_DELAY,
        onRetry: (attempt, error) => {
          this.error(`Configuration attempt ${attempt} failed:`, error.message);
          this.log(`Retrying in ${MTD085ZBDevice.RETRY_DELAY}ms...`);
        },
      }
    );

    if (!result.success) {
      throw new Error(`IAS Zone configuration failed after ${MTD085ZBDevice.MAX_RETRIES} attempts: ${result.error.message}`);
    }
  }

  /**
   * Configures the IAS Zone cluster
   * - Writes CIE address
   * - Sends zone enroll response
   * - Configures attribute reporting
   * 
   * @returns {Promise<void>}
   */
  async configureIASZone() {
    const iasZoneCluster = this.zclNode.endpoints[1].clusters.iasZone;

    if (!iasZoneCluster) {
      throw new Error('IAS Zone cluster not available');
    }

    // Write CIE address (Homey's IEEE address)
    this.log('Writing CIE address...');
    await iasZoneCluster.writeAttributes({
      iasCieAddress: this.homey.zigbee.ieeeAddress,
    });

    // Send zone enroll response
    this.log('Sending zone enroll response...');
    await iasZoneCluster.zoneEnrollResponse({
      enrollResponseCode: 0, // Success
      zoneId: 1,
    });

    // Configure attribute reporting for zone status
    this.log('Configuring zone status reporting...');
    await iasZoneCluster.configureReporting({
      zoneStatus: {
        minInterval: 0,
        maxInterval: 3600,
        minChange: 1,
      },
    });

    // Store configuration state
    await this.setStoreValue('iasZoneEnrolled', true);
    await this.setStoreValue('cieAddressConfigured', true);
  }
}

module.exports = MTD085ZBDevice;
