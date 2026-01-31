# Battery

_Get device battery information and subscribe to changes._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/battery/)

```typescript
import * as Battery from 'expo-battery';
```

### Methods

- `getBatteryLevelAsync()` - Returns 0-1 battery level
- `getBatteryStateAsync()` - Returns `UNKNOWN`, `UNPLUGGED`, `CHARGING`, or `FULL`
- `isLowPowerModeEnabledAsync()` - Check if low power mode is on
- `isAvailableAsync()` - Check if battery monitoring available

### Event Listeners

```typescript
Battery.addBatteryLevelListener(({ batteryLevel }) => {});
Battery.addBatteryStateListener(({ batteryState }) => {});
Battery.addLowPowerModeListener(({ lowPowerMode }) => {});
```

Call `.remove()` on subscription to clean up.
