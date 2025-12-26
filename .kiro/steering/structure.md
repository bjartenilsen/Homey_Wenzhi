# Project Structure

```
├── app.json              # Homey app manifest (id, version, drivers, flows)
├── app.js                # Main app entry point (not yet created)
├── package.json          # Node.js package config
├── assets/               # App-level images and icons
│   ├── icon.svg
│   └── images/           # small.png, large.png, xlarge.png
├── drivers/              # Zigbee device drivers
│   └── mtd085zb/         # MTD085-ZB driver
│       └── assets/       # Driver-specific icons
├── lib/                  # Shared utility modules
│   ├── device-matcher.js # Zigbee device identification
│   └── zone-status-parser.js # IAS Zone status bitmap parsing
├── locales/              # i18n translations
│   └── en.json           # English strings (app, device, flow)
└── test/
    └── property/         # Property-based tests (vitest + fast-check)
```

## Key Files
- `app.json` - Homey manifest with drivers, flows, permissions
- `locales/en.json` - Required keys: app.name, app.description, device.name, flow triggers/conditions
- `lib/` - Pure utility functions, no Homey dependencies

## Conventions
- Driver folders match driver id in `app.json`
- Each driver has its own `assets/` folder for icons
- Tests use `.property.test.js` suffix for property-based tests
