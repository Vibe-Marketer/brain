# Glass Effect

_Native iOS liquid glass effect components using UIVisualEffectView. iOS 26+ feature._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/glass-effect/)

```typescript
import { GlassView } from 'expo-glass-effect';
```

### Usage

```typescript
<GlassView glassStyle={GlassStyle.regular} tintColor="#007AFF" style={styles.card}>
  <Text>Content with glass effect</Text>
</GlassView>
```

### Glass Styles

- `GlassStyle.regular` - Default glass effect
- `GlassStyle.thin` - Lighter glass
- `GlassStyle.thick` - More prominent glass
- `GlassStyle.chrome` - Metallic chrome effect
- `GlassStyle.adaptive` - Adapts to content

### Native Bottom Tabs with Glass Effect

For the liquid glass effect on bottom tab bars, use `@bottom-tabs/react-navigation` which provides native tab components. It should already be installed.

[React Native Bottom Tabs Docs](https://incubator.callstack.com/react-native-bottom-tabs/docs/guides/usage-with-expo-router)


**Create layout adapter** in `src/components/bottom-tabs.tsx`:

```typescript
import { withLayoutContext } from 'expo-router';
import {
  createNativeBottomTabNavigator,
  NativeBottomTabNavigationOptions,
  NativeBottomTabNavigationEventMap,
} from '@bottom-tabs/react-navigation';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';

const BottomTabNavigator = createNativeBottomTabNavigator().Navigator;

export const Tabs = withLayoutContext<
  NativeBottomTabNavigationOptions,
  typeof BottomTabNavigator,
  TabNavigationState<ParamListBase>,
  NativeBottomTabNavigationEventMap
>(BottomTabNavigator);
```

**Use in tab layout** `src/app/(tabs)/_layout.tsx`:

```typescript
import { Tabs } from '@/components/bottom-tabs';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: () => ({ sfSymbol: 'house' }),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: () => ({ sfSymbol: 'person' }),
        }}
      />
    </Tabs>
  );
}
```

### Platform Behavior

- **iOS 26+**: Full liquid glass effect
- **iOS < 26**: Falls back to blur effect
- **Android**: Falls back to semi-transparent background
