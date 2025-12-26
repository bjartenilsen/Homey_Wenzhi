# Requirements Document

## Introduction

This document specifies the requirements for a Homey app that provides support for the Wenzhi/LeapMMW MTD085-ZB mmWave presence sensor. The device is a Tuya-based Zigbee sensor (model TS0225, manufacturer _TZ321C_fkzihax8) that uses millimeter-wave radar technology for human presence detection. The app will enable Homey users to integrate this sensor into their smart home automation workflows.

## Glossary

- **Homey**: A smart home hub platform that supports multiple wireless protocols including Zigbee
- **Homey App**: A software package that extends Homey's functionality to support specific devices or services
- **MTD085-ZB**: The Wenzhi/LeapMMW mmWave presence sensor device model
- **mmWave**: Millimeter-wave radar technology used for detecting human presence through micro-movements
- **Zigbee**: A low-power wireless mesh network protocol used for smart home devices
- **IAS Zone**: Intruder Alarm System Zone cluster in Zigbee, used for security and motion sensors
- **Tuya**: A Chinese IoT platform; many Zigbee devices use Tuya's protocol implementation
- **Cluster**: A Zigbee concept representing a set of related attributes and commands for device functionality
- **Endpoint**: A Zigbee addressing concept that allows a single device to expose multiple logical devices
- **Presence Detection**: The ability to detect whether a human is present in a monitored area
- **Motion Alarm**: A binary state indicating whether motion/presence has been detected

## Requirements

### Requirement 1

**User Story:** As a Homey user, I want to pair the MTD085-ZB sensor with my Homey hub, so that I can use the sensor in my smart home automations.

#### Acceptance Criteria

1. WHEN a user initiates Zigbee pairing on Homey and puts the MTD085-ZB in pairing mode THEN the Homey App SHALL discover and identify the device using modelId "TS0225" and manufacturerName "_TZ321C_fkzihax8"
2. WHEN the device is discovered THEN the Homey App SHALL complete the Zigbee network join process and register the device
3. WHEN pairing completes successfully THEN the Homey App SHALL display the device with an appropriate name and icon in the Homey interface
4. IF pairing fails THEN the Homey App SHALL display an error message indicating the failure reason

### Requirement 2

**User Story:** As a Homey user, I want to see the presence detection status from my MTD085-ZB sensor, so that I can know when someone is present in the monitored area.

#### Acceptance Criteria

1. WHEN the MTD085-ZB sensor detects human presence THEN the Homey App SHALL update the motion alarm capability to "true"
2. WHEN the MTD085-ZB sensor no longer detects human presence THEN the Homey App SHALL update the motion alarm capability to "false"
3. WHEN the sensor reports a zone status change via IAS Zone cluster THEN the Homey App SHALL process the status within 2 seconds
4. WHILE the device is paired THEN the Homey App SHALL maintain the current presence state accurately

### Requirement 3

**User Story:** As a Homey user, I want to use the presence sensor in Homey flows, so that I can automate actions based on presence detection.

#### Acceptance Criteria

1. WHEN presence is detected THEN the Homey App SHALL trigger a "motion detected" flow card
2. WHEN presence is no longer detected THEN the Homey App SHALL trigger a "motion cleared" flow card
3. WHEN a user creates a flow THEN the Homey App SHALL provide a condition card to check current presence state
4. WHILE the sensor is operational THEN the Homey App SHALL expose the alarm_motion capability for flow integration

### Requirement 4

**User Story:** As a Homey user, I want the app to properly configure the sensor during pairing, so that the sensor reports presence changes reliably.

#### Acceptance Criteria

1. WHEN the device is paired THEN the Homey App SHALL configure the IAS Zone cluster by writing the CIE address
2. WHEN the device is paired THEN the Homey App SHALL enroll the device in the IAS Zone
3. WHEN zone enrollment completes THEN the Homey App SHALL configure attribute reporting for zone status changes
4. IF IAS Zone configuration fails THEN the Homey App SHALL retry configuration up to 3 times before reporting failure

### Requirement 5

**User Story:** As a Homey user, I want the app to handle device reconnection gracefully, so that the sensor continues to work after power cycles or network issues.

#### Acceptance Criteria

1. WHEN the device reconnects to the Zigbee network THEN the Homey App SHALL restore the device state within 30 seconds
2. WHEN the device has been offline THEN the Homey App SHALL re-read the current zone status upon reconnection
3. WHILE the device is offline THEN the Homey App SHALL indicate unavailable status in the Homey interface
4. WHEN the device comes back online THEN the Homey App SHALL resume normal presence reporting

### Requirement 6

**User Story:** As a developer, I want the app to follow Homey app development standards, so that the app can be published to the Homey App Store.

#### Acceptance Criteria

1. THE Homey App SHALL include a valid app manifest (app.json) with required metadata fields
2. THE Homey App SHALL include appropriate device driver files following Homey SDK conventions
3. THE Homey App SHALL include localization files for at least English language
4. THE Homey App SHALL include device images and icons meeting Homey store requirements
5. THE Homey App SHALL use Homey SDK version 3 or later
