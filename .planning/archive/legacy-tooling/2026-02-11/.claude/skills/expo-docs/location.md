# Location

_Get device geolocation - current position, continuous tracking, and geocoding._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/location/)

```typescript
import * as Location from 'expo-location';
```

### Permissions

```typescript
await Location.requestForegroundPermissionsAsync();
await Location.requestBackgroundPermissionsAsync();
```

### Get Location

```typescript
const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
location.coords.latitude;
location.coords.longitude;
location.coords.altitude;
location.coords.accuracy;
```

### Watch Location

```typescript
const subscription = await Location.watchPositionAsync(
  { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 10 },
  (location) => {}
);
subscription.remove();
```

### Accuracy Levels

`Lowest` (~3000m), `Low` (~1000m), `Balanced` (~100m), `High` (~10m), `Highest` (~1m), `BestForNavigation`

### Geocoding

```typescript
const coords = await Location.geocodeAsync('1600 Amphitheatre Parkway, Mountain View, CA');
const address = await Location.reverseGeocodeAsync({ latitude, longitude });
```

### Heading

```typescript
const subscription = await Location.watchHeadingAsync((heading) => {
  heading.trueHeading;  // Relative to true north
  heading.magHeading;   // Magnetic heading
});
```
