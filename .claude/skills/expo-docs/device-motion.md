# DeviceMotion

_Access device motion and orientation sensors (accelerometer, gyroscope, magnetometer combined)._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/devicemotion/)

```typescript
import { DeviceMotion } from 'expo-sensors';
```

### Usage

```typescript
const available = await DeviceMotion.isAvailableAsync();

const subscription = DeviceMotion.addListener((data) => {
  data.acceleration;          // { x, y, z } in m/s²
  data.accelerationIncludingGravity;
  data.rotation;              // { alpha, beta, gamma } in degrees
  data.rotationRate;          // { alpha, beta, gamma } in deg/s
  data.orientation;           // Device orientation (0, 90, 180, 270)
});

DeviceMotion.setUpdateInterval(100);
subscription.remove();
```

Rotation: `alpha` is z-axis (0-360°), `beta` is x-axis (-180 to 180°), `gamma` is y-axis (-90 to 90°).
