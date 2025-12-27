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

    // Log detailed device information for debugging
    await this.logDeviceInfo();

    // Configure IAS Zone if not already done
    const isEnrolled = this.getStoreValue('iasZoneEnrolled');
    this.debugNotify(`IAS Zone enrolled: ${isEnrolled}`);
    
    // For this Tuya device, skip formal enrollment and rely on direct zone status monitoring
    if (!isEnrolled) {
      this.log('Skipping formal IAS Zone enrollment for Tuya device, using direct monitoring...');
      this.debugNotify('Using direct zone status monitoring...');
      
      // Mark as "enrolled" to skip future attempts, even though formal enrollment failed
      await this.setStoreValue('iasZoneEnrolled', true);
      await this.setStoreValue('cieAddressConfigured', true);
    }

    // Register IAS Zone cluster for zone status change notifications
    this.registerIASZoneHandler();

    // Set up attribute reporting for zone status changes
    await this.setupAttributeReporting();

    // Register flow condition handler
    this.registerFlowConditions();

    // Read initial zone status
    await this.readCurrentZoneStatus();

    // Start periodic zone status polling for debugging
    this.startZoneStatusPolling();

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
   * Logs detailed device information for debugging
   */
  async logDeviceInfo() {
    try {
      this.log('=== DEVICE DEBUG INFO ===');
      this.log('Device ID:', this.getData().id);
      this.log('ZCL Node available:', !!this.zclNode);
      
      if (this.zclNode) {
        this.log('Available endpoints:', Object.keys(this.zclNode.endpoints));
        
        // Log endpoint 1 clusters
        const endpoint1 = this.zclNode.endpoints[1];
        if (endpoint1) {
          this.log('Endpoint 1 clusters:', Object.keys(endpoint1.clusters));
          
          // Check IAS Zone cluster specifically
          const iasZone = endpoint1.clusters.iasZone;
          if (iasZone) {
            this.log('IAS Zone cluster found');
            try {
              const attributes = await iasZone.readAttributes(['zoneState', 'zoneType', 'zoneStatus']);
              this.log('IAS Zone attributes:', attributes);
              this.debugNotify(`Zone attrs: ${JSON.stringify(attributes)}`);
            } catch (error) {
              this.log('Failed to read IAS Zone attributes:', error.message);
            }
          } else {
            this.log('IAS Zone cluster NOT found');
          }
          
          // Check other clusters that might be relevant
          const clusters = ['basic', 'powerConfiguration', 'occupancySensing', 'illuminanceMeasurement'];
          for (const clusterName of clusters) {
            if (endpoint1.clusters[clusterName]) {
              this.log(`${clusterName} cluster found`);
            }
          }
        }
      }
      this.log('=== END DEVICE DEBUG INFO ===');
    } catch (error) {
      this.error('Failed to log device info:', error.message);
    }
  }

  /**
   * Sets up attribute reporting for zone status changes
   */
  async setupAttributeReporting() {
    try {
      const iasZoneCluster = this.zclNode.endpoints[1].clusters.iasZone;
      
      if (!iasZoneCluster) {
        this.log('No IAS Zone cluster for attribute reporting setup');
        return;
      }

      this.log('Setting up attribute reporting for zone status...');
      
      // Configure reporting for zone status attribute
      await iasZoneCluster.configureReporting({
        zoneStatus: {
          minInterval: 1,     // Minimum 1 second
          maxInterval: 300,   // Maximum 5 minutes
          minChange: 1,       // Report any change
        },
      });
      
      this.log('Zone status attribute reporting configured');
      this.debugNotify('Attribute reporting configured');
    } catch (error) {
      this.log('Failed to configure attribute reporting (may be normal for some devices):', error.message);
      this.debugNotify(`Reporting config failed: ${error.message}`);
    }
  }

  /**
   * Starts periodic polling of zone status for debugging
   */
  startZoneStatusPolling() {
    // Poll every 30 seconds for monitoring
    this.pollingInterval = setInterval(async () => {
      try {
        const iasZoneCluster = this.zclNode.endpoints[1].clusters.iasZone;
        if (iasZoneCluster) {
          const { zoneStatus } = await iasZoneCluster.readAttributes(['zoneStatus']);
          const presenceDetected = isPresenceDetected(zoneStatus);
          const currentCapability = this.getCapabilityValue('alarm_motion');
          
          this.log(`[POLL] Presence: ${presenceDetected}, Capability: ${currentCapability}`);
          
          // If there's a mismatch, update the capability
          if (currentCapability !== presenceDetected) {
            this.log(`[POLL] Updating capability from ${currentCapability} to ${presenceDetected}`);
            await this.setCapabilityValue('alarm_motion', presenceDetected);
            this.debugNotify(`Polled update: ${presenceDetected}`);
          }
        }
      } catch (error) {
        this.log('[POLL] Failed to read zone status:', error.message);
      }
    }, 30000);
    
    this.log('Started zone status polling (every 30 seconds)');
  }

  /**
   * Called when the device is deleted from Homey
   * Performs cleanup operations
   * 
   * @returns {Promise<void>}
   */
  async onDeleted() {
    this.log('MTD085-ZB device deleted');
    
    // Clean up polling interval
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
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
      
      this.log('Current zone status raw:', zoneStatus);
      this.log('Zone status type:', typeof zoneStatus);
      
      if (typeof zoneStatus === 'number') {
        this.log('Zone status bits:', zoneStatus.toString(2).padStart(16, '0'));
        this.log('Bit 0 (alarm1/presence):', (zoneStatus & 0x0001) !== 0);
      }
      
      // Update capability based on current status
      const presenceDetected = isPresenceDetected(zoneStatus);
      const currentState = this.getCapabilityValue('alarm_motion');
      
      this.log('Presence detected from status:', presenceDetected);
      this.log('Current capability value:', currentState);
      
      if (currentState !== presenceDetected) {
        await this.setCapabilityValue('alarm_motion', presenceDetected);
        this.log('Motion alarm synced to:', presenceDetected);
        this.debugNotify(`Synced to: ${presenceDetected}`);
      } else {
        this.log('Capability already matches zone status');
      }
    } catch (error) {
      this.error('Failed to read zone status:', error.message);
      this.debugNotify(`Read failed: ${error.message}`);
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
    this.log('=== ZONE STATUS CHANGE NOTIFICATION ===');
    this.log('Raw payload:', JSON.stringify(payload));
    this.log('Zone status value:', zoneStatus);
    this.log('Zone status type:', typeof zoneStatus);
    this.debugNotify(`Zone change: ${JSON.stringify(payload)}`);

    const presenceDetected = isPresenceDetected(zoneStatus);
    const currentState = this.getCapabilityValue('alarm_motion');
    
    this.log('Presence detected:', presenceDetected);
    this.log('Current capability state:', currentState);
    this.debugNotify(`Presence: ${presenceDetected}, Current: ${currentState}`);

    // Log the bit analysis
    if (typeof zoneStatus === 'number') {
      this.log('Zone status bits:', zoneStatus.toString(2).padStart(16, '0'));
      this.log('Bit 0 (alarm1/presence):', (zoneStatus & 0x0001) !== 0);
    }

    // Determine which flow card to trigger based on state transition
    const triggerType = determineFlowTrigger(currentState, presenceDetected);
    this.log('Flow trigger type:', triggerType);

    if (triggerType !== null) {
      await this.setCapabilityValue('alarm_motion', presenceDetected);
      this.log('Motion alarm updated:', presenceDetected);
      this.debugNotify(`Motion updated: ${presenceDetected}, Trigger: ${triggerType}`);

      // Trigger appropriate flow card
      try {
        await this.homey.flow.getDeviceTriggerCard(triggerType).trigger(this);
        this.log('Flow card triggered successfully:', triggerType);
      } catch (error) {
        this.error('Failed to trigger flow card:', error.message);
      }
    } else {
      this.log('No state change, no flow trigger needed');
    }
    
    this.log('=== END ZONE STATUS CHANGE ===');
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
   * - Attempts automatic enrollment without manual CIE address write
   * - Sends proactive enroll response for Tuya devices
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

    // For Tuya devices, try sending proactive enroll response
    // Some devices expect this without explicit CIE address configuration
    this.log('Attempting proactive zone enrollment for Tuya device...');
    this.debugNotify('Sending proactive enroll response...');
    
    try {
      await iasZoneCluster.zoneEnrollResponse({
        enrollResponseCode: 0, // Success
        zoneId: 1,
      });
      this.log('Proactive zone enroll response sent successfully');
      this.debugNotify('Proactive enroll response sent');
      
      // Wait a moment and check if enrollment succeeded
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const { zoneState: newZoneState } = await iasZoneCluster.readAttributes(['zoneState']);
      this.log('Zone state after enrollment attempt:', newZoneState);
      
      if (newZoneState === 'enrolled') {
        await this.setStoreValue('iasZoneEnrolled', true);
        this.log('IAS Zone enrollment successful');
        this.debugNotify('Enrollment successful');
      } else {
        throw new Error(`Enrollment failed, zone state is still: ${newZoneState}`);
      }
    } catch (error) {
      this.error('Proactive enrollment failed:', error.message);
      this.debugNotify(`Enrollment failed: ${error.message}`);
      throw error;
    }

    // Store configuration state
    await this.setStoreValue('cieAddressConfigured', true);
  }
}

module.exports = MTD085ZBDevice;
