# Requirements Document

## Introduction

This document specifies the requirements for fixing the IAS Zone enrollment issue in the Homey MTD085-ZB app. The current implementation fails to enroll the device in the IAS Zone due to using an incorrect attribute name when writing the CIE address. This prevents the sensor from properly reporting presence changes to Homey.

## Requirements

### Requirement 1

**User Story:** As a Homey user, I want the MTD085-ZB sensor to successfully enroll in the IAS Zone during pairing, so that the sensor can report presence changes reliably.

#### Acceptance Criteria

1. WHEN the device is paired THEN the Homey App SHALL write the CIE address using the correct Zigbee attribute name "cieAddr"
2. WHEN the CIE address is written successfully THEN the device SHALL transition from "notEnrolled" to "enrolled" state
3. WHEN the device is enrolled THEN the Homey App SHALL receive zone status change notifications
4. IF the CIE address write fails THEN the Homey App SHALL retry with exponential backoff up to 3 times

### Requirement 2

**User Story:** As a developer, I want the app to use the correct Zigbee IAS Zone cluster attribute names, so that the implementation follows the Zigbee specification.

#### Acceptance Criteria

1. THE Homey App SHALL use "cieAddr" (attribute ID 0x0010) instead of "iasCieAddress" when writing the CIE address
2. THE Homey App SHALL handle both successful and failed attribute write operations gracefully
3. THE Homey App SHALL log appropriate debug information during the enrollment process
4. THE Homey App SHALL maintain backward compatibility with devices that are already enrolled

### Requirement 3

**User Story:** As a Homey user, I want existing paired devices to continue working after the fix is applied, so that I don't need to re-pair my sensors.

#### Acceptance Criteria

1. WHEN the app is updated THEN existing enrolled devices SHALL continue to function normally
2. WHEN the app is updated THEN devices that failed to enroll previously SHALL attempt enrollment again on next initialization
3. WHEN a device reconnects after the fix THEN it SHALL check enrollment status and re-enroll if necessary
4. THE Homey App SHALL not break existing device functionality during the fix deployment