'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { isPresenceDetected } = require('../../lib/zone-status-parser');
const { withRetry } = require('../../lib/retry');
const { determineFlowTrigger } = require('../../lib/flow-trigger-logic');

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
   * Called when the Zigbee node is initialized and zclNode is available
   * Sets up IAS Zone cluster handling and configures the device
   * 
   * @returns {Promise<void>}
   */
  async onNodeInit({ zclNode }) {
    this.log('MTD085-ZB device initializing...');

    // Store zclNode reference
    this.zclNode = zclNode;

    // Register IAS Zone cluster for zone status change notifications
    this.registerIASZoneHandler();

    // Register flow condition handler
    this.registerFlowConditions();

    // Read initial zone status
    await this.readCurrentZoneStatus();

    this.log('MTD085-ZB device initialized');
  }

  /**
   * Registers flow condition handlers
   */
  registerFlowConditions() {
    this.homey.flow.getConditionCard('is_motion_detected')
      .registerRunListener(async (args) => {
        return args.device.getCapabilityValue('alarm_motion') === true;
      });
    this.log('Flow condition handlers registered');
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
   * Called when the device goes offline
   * Sets the device as unavailable in the Homey interface
   * 
   * @returns {Promise<void>}
   */
  async onOffline() {
    this.log('MTD085-ZB device went offline');
    await this.setUnavailable(this.homey.__('device.unavailable'));
  }

  /**
   * Called when the device comes back online
   * Restores availability and re-reads the current zone status
   * 
   * @returns {Promise<void>}
   */
  async onOnline() {
    this.log('MTD085-ZB device came back online');
    
    // Restore device availability
    await this.setAvailable();
    this.log('Device availability restored');

    // Re-read current zone status to sync state
    await this.readCurrentZoneStatus();
  }

  /**
   * Reads the current zone status from the device
   * Used to sync state after reconnection
   * 
   * @returns {Promise<void>}
   */
  async readCurrentZoneStatus() {
    try {
      const iasZoneCluster = this.zclNode.endpoints[1].clusters.iasZone;
      
      if (!iasZoneCluster) {
        this.error('IAS Zone cluster not available for status read');
        return;
      }

      this.log('Reading current zone status...');
      const { zoneStatus } = await iasZoneCluster.readAttributes(['zoneStatus']);
      
      this.log('Current zone status:', zoneStatus);
      
      // Update capability based on current status
      const presenceDetected = isPresenceDetected(zoneStatus);
      const currentState = this.getCapabilityValue('alarm_motion');
      
      if (currentState !== presenceDetected) {
        await this.setCapabilityValue('alarm_motion', presenceDetected);
        this.log('Motion alarm synced to:', presenceDetected);
      }
    } catch (error) {
      this.error('Failed to read zone status:', error.message);
    }
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

    // Determine which flow card to trigger based on state transition
    const triggerType = determineFlowTrigger(currentState, presenceDetected);

    if (triggerType !== null) {
      await this.setCapabilityValue('alarm_motion', presenceDetected);
      this.log('Motion alarm updated:', presenceDetected);

      // Trigger appropriate flow card
      await this.homey.flow.getDeviceTriggerCard(triggerType).trigger(this);
      this.log('Flow card triggered:', triggerType);
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
