# Maps

_Native maps using Google Maps (Android) and Apple Maps (iOS)._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/maps/)

```typescript
import { MapView, Marker, Polyline, Polygon } from 'expo-maps';
```

### Basic Map

```typescript
<MapView
  style={{ flex: 1 }}
  initialCameraPosition={{ latitude: 37.78, longitude: -122.43, zoom: 12 }}
  mapType="standard"  // 'standard' | 'satellite' | 'hybrid' | 'terrain'
  showsUserLocation
/>
```

### Markers & Shapes

```typescript
<MapView style={{ flex: 1 }}>
  <Marker coordinate={{ latitude, longitude }} title="Title" description="Description" />
  <Polyline coordinates={[...]} strokeColor="#FF0000" strokeWidth={3} />
  <Polygon coordinates={[...]} fillColor="rgba(0,0,255,0.3)" strokeColor="#0000FF" />
</MapView>
```

### Camera Control

```typescript
mapRef.current?.animateCamera({ latitude, longitude, zoom: 14 });
```

### Events

`onMapPress`, `onMarkerPress`, `onCameraMove`

**Config:** Add `androidApiKey` to `expo-maps` plugin in `app.json` for Google Maps.
