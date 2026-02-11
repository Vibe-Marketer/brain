# Gyroscope

_Access device gyroscope sensor for rotation rate measurements._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/gyroscope/)

```typescript
import { Gyroscope } from 'expo-sensors';
```

### Usage

```typescript
const available = await Gyroscope.isAvailableAsync();

const subscription = Gyroscope.addListener(({ x, y, z }) => {
  // Values in radians per second
  // x = pitch, y = roll, z = yaw
});

Gyroscope.setUpdateInterval(100);
subscription.remove();
```

Convert to degrees: `rad * (180 / Math.PI)`
