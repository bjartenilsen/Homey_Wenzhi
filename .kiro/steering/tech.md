# Tech Stack

## Platform
- Homey SDK 3
- Node.js >= 18.0.0

## Dependencies
- No runtime dependencies (Homey provides Zigbee APIs)

## Dev Dependencies
- `vitest` - Test runner
- `fast-check` - Property-based testing

## Commands

```bash
# Run tests (single run)
npm test

# Run tests in watch mode
npm run test:watch
```

## Code Style
- `'use strict'` directive in all JS files
- CommonJS modules (`module.exports` / `require`)
- JSDoc comments for functions and types
- ES module imports in test files (`import { } from`)

## Zigbee Specifics
- IAS Zone cluster for presence detection
- Zone status is a 16-bit bitmap (bit 0 = alarm1/presence)
- Device matching by `modelId` + `manufacturerName`
