# Device

_Get system information about the physical device._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/device/)

```typescript
import * as Device from 'expo-device';
```

### Constants

- `brand` - "Apple", "Samsung", "Google"
- `modelName` - "iPhone 14 Pro", "Pixel 7"
- `modelId` - Device model code
- `osName` - "iOS", "Android", "iPadOS"
- `osVersion` - "17.0", "14"
- `deviceName` - User-set name like "John's iPhone"
- `deviceType` - `PHONE` (1), `TABLET` (2), `DESKTOP` (3), `TV` (4)
- `totalMemory` - Total RAM in bytes
- `isDevice` - `true` on physical device, `false` on simulator

### Methods

- `getDeviceTypeAsync()` - Async getter for device type
- `getUptimeAsync()` - Device uptime in milliseconds
- `getMaxMemoryAsync()` - Max memory (Android)
