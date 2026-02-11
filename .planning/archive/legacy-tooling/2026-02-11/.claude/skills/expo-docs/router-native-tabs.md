# Router Native Tabs

_Native iOS tab bar with Expo Router, including glass effects for iOS 26+._

[Expo Docs](https://docs.expo.dev/router/advanced/native-tabs/)

```typescript
import { Tabs } from 'expo-router/tabs';
```

### Basic Usage

```typescript
// app/(tabs)/_layout.tsx
export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Icon color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
```

### With Glass Effect

```typescript
<Tabs screenOptions={{
  headerTransparent: true,
  headerBlurEffect: 'systemMaterial',
  tabBarStyle: { position: 'absolute', backgroundColor: 'transparent' },
  tabBarBackground: () => <BlurView intensity={80} style={StyleSheet.absoluteFill} />,
}}>
```

### Tab Options

- `tabBarBadge` - Show badge number
- `tabBarPosition` - `'bottom'` | `'left'` (sidebar on iPad)

### Custom Tab Bar

```typescript
<Tabs tabBar={(props) => <CustomTabBar {...props} />} />
```
