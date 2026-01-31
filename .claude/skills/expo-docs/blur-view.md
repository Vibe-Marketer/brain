# BlurView

_A React component that blurs everything underneath it._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/blur-view/)

```typescript
import { BlurView } from 'expo-blur';
```

### Usage

```typescript
<BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill}>
  <Text>Content over blur</Text>
</BlurView>
```

### Props

- `intensity` - Blur intensity 0-100 (default: 50)
- `tint` - `"light"` | `"dark"` | `"default"` | `"extraLight"` | `"regular"` | `"prominent"`
- `blurReductionFactor` - Performance optimization (default: 4)
- `experimentalBlurMethod` - Android: `"none"` | `"dimezisBlurView"`
