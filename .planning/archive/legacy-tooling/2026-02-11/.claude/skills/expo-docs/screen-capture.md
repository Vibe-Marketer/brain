# ScreenCapture

_Prevent screen capture/recording and detect capture events._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/screen-capture/)

```typescript
import { usePreventScreenCapture, addScreenshotListener } from 'expo-screen-capture';
```

### Prevent Capture

```typescript
// Hook - prevents while mounted
usePreventScreenCapture();

// Conditional
usePreventScreenCapture(showSensitiveData ? 'sensitive' : undefined);

// Imperative
await ScreenCapture.preventScreenCaptureAsync();
await ScreenCapture.allowScreenCaptureAsync();
```

### Detect Screenshots

```typescript
const subscription = addScreenshotListener(() => {
  console.log('Screenshot taken!');
});
subscription.remove();
```

### Check Recording

```typescript
const isRecording = await ScreenCapture.isScreenCapturedAsync();  // iOS only
```

**Platform Notes:** Full support on iOS. Prevention works on Android, detection limited.
