# ScreenOrientation

_Control and monitor device screen orientation._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/screen-orientation/)

```typescript
import * as ScreenOrientation from 'expo-screen-orientation';
```

### Lock Orientation

```typescript
await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
await ScreenOrientation.unlockAsync();
```

### Lock Options

`DEFAULT`, `ALL`, `PORTRAIT`, `PORTRAIT_UP`, `PORTRAIT_DOWN`, `LANDSCAPE`, `LANDSCAPE_LEFT`, `LANDSCAPE_RIGHT`

### Get/Watch Orientation

```typescript
const orientation = await ScreenOrientation.getOrientationAsync();
// PORTRAIT_UP (1), PORTRAIT_DOWN (2), LANDSCAPE_LEFT (3), LANDSCAPE_RIGHT (4)

const subscription = ScreenOrientation.addOrientationChangeListener((e) => {
  console.log(e.orientationInfo.orientation);
});
subscription.remove();
```
