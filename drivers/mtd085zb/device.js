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
   * Sends debug notification to Homey timeline
   * @param {string} message - Debug message
   */
  debugNotify(message) {
    try {
      this.homey.notifications.createNotification({
        excerpt: `MTD085-ZB Debug: ${message}`
      });
    } catch (error) {
      // Ignore notification errors
    }
  }

  /**
   * Called when the Zigbee node is initialized and zclNode is available
   * Sets up IAS Zone cluster handling and configures the device
   * 
   * @returns {Promise<void>}
   */
  async onNodeInit({ zclNode }) {
    this.log('MTD085-ZB device initializing...');
    this.debugNotify('Device initializing...');

    // Store zclNode reference
    this.zclNode = zclNode;

    // Configure IAS Zone if not already done
    const isEnrolled = this.getStoreValue('iasZoneEnrolled');
    this.debugNotify(`IAS Zone enrolled: ${isEnrolled}`);
    
    if (!isEnrolled) {
      this.log('IAS Zone not enrolled, configuring...');
      this.debugNotify('Starting IAS Zone configuration...');
      try {
        await this.configureIASZoneWithRetry();
        this.debugNotify('IAS Zone configuration completed');
      } catch (error) {
        this.error('Failed to configure IAS Zone:', error.message);
        this.debugNotify(`IAS Zone config failed: ${error.message}`);
      }
    }

    // Register IAS Zone cluster for zone status change notifications
    this.registerIASZoneHandler();

    // Register flow condition handler
    this.registerFlowConditions();

    // Read initial zone status
    await this.readCurrentZoneStatus();

    this.log('MTD085-ZB device initialized');
    this.debugNotify('Device initialization complete');
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
      // Register zone status change notification handler
      iasZoneCluster.onZoneStatusChangeNotification = this.onZoneStatusChange.bind(this);
      this.log('IAS Zone status change handler registered');

      // Register zone enroll request handler - device will send this after CIE address is written
      iasZoneCluster.onZoneEnrollRequest = async (payload) => {
        this.log('Zone enroll request received:', payload);
        try {
          // Respond with enrollment success
          await iasZoneCluster.zoneEnrollResponse({
            enrollResponseCode: 0, // Success
            zoneId: 1,
          });
          this.log('Zone enroll response sent');
          await this.setStoreValue('iasZoneEnrolled', true);
        } catch (error) {
          this.error('Failed to send zone enroll response:', error.message);
        }
      };
      this.log('IAS Zone enroll request handler registered');
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
    this.debugNotify(`Zone status change: ${JSON.stringify(zoneStatus)}`);

    const presenceDetected = isPresenceDetected(zoneStatus);
    const currentState = this.getCapabilityValue('alarm_motion');
    this.debugNotify(`Presence: ${presenceDetected}, Current: ${currentState}`);

    // Determine which flow card to trigger based on state transition
    const triggerType = determineFlowTrigger(currentState, presenceDetected);

    if (triggerType !== null) {
      await this.setCapabilityValue('alarm_motion', presenceDetected);
      this.log('Motion alarm updated:', presenceDetected);
      this.debugNotify(`Motion updated: ${presenceDetected}, Trigger: ${triggerType}`);

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
   * - Waits for device to send zone enroll request (handled by onZoneEnrollRequest)
   * 
   * @returns {Promise<void>}
   */
  async configureIASZone() {
    const iasZoneCluster = this.zclNode.endpoints[1].clusters.iasZone;

    if (!iasZoneCluster) {
      throw new Error('IAS Zone cluster not available');
    }

    // Check current zone state
    const { zoneState } = await iasZoneCluster.readAttributes(['zoneState']);
    this.log('Current zone state:', zoneState);
    this.debugNotify(`Zone state: ${zoneState}`);

    if (zoneState === 'enrolled') {
      this.log('Device already enrolled');
      this.debugNotify('Device already enrolled');
      await this.setStoreValue('iasZoneEnrolled', true);
      return;
    }

    // Write CIE address (Homey's IEEE address) - this triggers the device to send zoneEnrollRequest
    this.log('Writing CIE address to trigger enrollment...');
    this.debugNotify('Writing CIE address...');
    await iasZoneCluster.writeAttributes({
      cieAddr: this.homey.zigbee.ieeeAddress,
    });
    this.log('CIE address written successfully, waiting for zone enroll request from device...');
    this.debugNotify('CIE address written successfully');

    // For some Tuya devices, we need to send the enroll response proactively
    // Wait a bit then send enroll response
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      this.log('Sending proactive zone enroll response...');
      this.debugNotify('Sending enroll response...');
      await iasZoneCluster.zoneEnrollResponse({
        enrollResponseCode: 0, // Success
        zoneId: 1,
      });
      this.log('Zone enroll response sent');
      this.debugNotify('Enroll response sent');
    } catch (error) {
      this.log('Proactive enroll response failed (may be normal):', error.message);
      this.debugNotify(`Enroll response failed: ${error.message}`);
    }

    // Store configuration state
    await this.setStoreValue('cieAddressConfigured', true);
  }
}

module.exports = MTD085ZBDevice;
