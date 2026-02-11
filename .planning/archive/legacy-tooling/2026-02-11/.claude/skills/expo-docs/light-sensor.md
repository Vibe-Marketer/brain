# LightSensor

_Access device light sensor for ambient illuminance readings._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/light-sensor/)

```typescript
import { LightSensor } from 'expo-sensors';
```

### Usage

```typescript
const available = await LightSensor.isAvailableAsync();

const subscription = LightSensor.addListener(({ illuminance }) => {
  // illuminance in lux
});

LightSensor.setUpdateInterval(500);
subscription.remove();
```

Reference values: 0.0001 lux (moonless night), 50 lux (room), 1000 lux (overcast), 100000 lux (direct sun).

**Platform Notes:** Android only. Not available on iOS.
