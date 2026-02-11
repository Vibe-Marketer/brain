# LinearGradient

_Render linear color gradients as backgrounds._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/linear-gradient/)

```typescript
import { LinearGradient } from 'expo-linear-gradient';
```

### Usage

```typescript
<LinearGradient
  colors={['#4c669f', '#3b5998', '#192f6a']}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  locations={[0, 0.5, 1]}
  style={{ flex: 1 }}
>
  <Text>Content</Text>
</LinearGradient>
```

### Props

- `colors` - Array of color strings
- `start` / `end` - Direction points `{ x: 0-1, y: 0-1 }`. Default is top to bottom
- `locations` - Array of 0-1 positions for color stops (optional)

Directions: vertical `{x:0.5,y:0}→{x:0.5,y:1}`, horizontal `{x:0,y:0}→{x:1,y:0}`, diagonal `{x:0,y:0}→{x:1,y:1}`
