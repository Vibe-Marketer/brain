# Pedometer

_Access device pedometer for step counting._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/pedometer/)

```typescript
import { Pedometer } from 'expo-sensors';
```

### Usage

```typescript
const available = await Pedometer.isAvailableAsync();
await Pedometer.requestPermissionsAsync();  // iOS needs Motion permission

// Get steps between dates
const result = await Pedometer.getStepCountAsync(startDate, endDate);
console.log(result.steps);

// Watch real-time steps
const subscription = Pedometer.watchStepCount((result) => {
  console.log(result.steps);  // Steps since watch started
});
subscription.remove();
```

**Platform Notes:** iOS requires Motion & Fitness permission. Android uses Google Play Services.
