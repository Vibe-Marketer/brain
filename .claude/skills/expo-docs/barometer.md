# Barometer

_Access device barometer sensor for atmospheric pressure readings._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/barometer/)

```typescript
import { Barometer } from 'expo-sensors';
```

### Usage

```typescript
const available = await Barometer.isAvailableAsync();

const subscription = Barometer.addListener(({ pressure, relativeAltitude }) => {
  console.log(pressure, 'hPa');
  console.log(relativeAltitude, 'm'); // iOS only
});

Barometer.setUpdateInterval(1000);
subscription.remove();
```

Returns `pressure` in hectopascals (hPa) and `relativeAltitude` in meters (iOS only).
