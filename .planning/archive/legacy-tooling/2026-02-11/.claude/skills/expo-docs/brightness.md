# Brightness

_Control screen brightness programmatically._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/brightness/)

```typescript
import * as Brightness from 'expo-brightness';
```

### Methods

- `requestPermissionsAsync()` - Request permission (iOS needs it)
- `getBrightnessAsync()` - Get current brightness (0-1)
- `setBrightnessAsync(value)` - Set brightness (0-1)
- `getSystemBrightnessAsync()` - Get system brightness
- `setSystemBrightnessAsync(value)` - Set system brightness (Android only)
- `getSystemBrightnessModeAsync()` - Get `AUTOMATIC` or `MANUAL` mode (Android)
- `setSystemBrightnessModeAsync(mode)` - Set brightness mode (Android)
