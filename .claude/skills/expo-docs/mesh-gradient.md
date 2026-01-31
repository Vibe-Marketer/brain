# MeshGradient

_SwiftUI MeshGradient exposed to React Native (iOS 18+)._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/mesh-gradient/)

```typescript
import { MeshGradient } from 'expo-mesh-gradient';
```

### Usage

```typescript
<MeshGradient
  style={{ flex: 1 }}
  columns={3}
  rows={3}
  colors={[
    '#FF0000', '#FF8000', '#FFFF00',
    '#00FF00', '#00FFFF', '#0000FF',
    '#FF00FF', '#FF0080', '#8000FF',
  ]}
  points={[...]}      // Optional custom { x, y } positions (0-1)
  smoothsColors={true}
/>
```

Colors array must have `columns * rows` items.

**Platform Notes:** iOS 18+ native, falls back to LinearGradient on older iOS/Android.
