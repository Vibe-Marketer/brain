# Expo Router

_File-based routing for React Native and web._

[Expo Docs](https://docs.expo.dev/router/introduction/)

```typescript
import { Stack, Tabs, Link, router, useLocalSearchParams } from 'expo-router';
```

### File Structure

```
app/
├── _layout.tsx      # Root layout
├── index.tsx        # / route
├── about.tsx        # /about route
├── (tabs)/          # Tab group
│   ├── _layout.tsx
│   └── index.tsx
├── user/[id].tsx    # Dynamic /user/:id
└── +not-found.tsx   # 404 page
```

### Navigation

```typescript
<Link href="/about">About</Link>
<Link href={{ pathname: '/user/[id]', params: { id: '123' } }}>User</Link>

router.push('/about');
router.replace('/home');
router.back();
```

### Dynamic Routes

```typescript
// app/user/[id].tsx
const { id } = useLocalSearchParams<{ id: string }>();
```

### Layouts

```typescript
// Stack layout
<Stack>
  <Stack.Screen name="index" options={{ title: 'Home' }} />
  <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
</Stack>

// Tab layout
<Tabs>
  <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ... }} />
</Tabs>
```

### Protected Routes

```typescript
if (!user) return <Redirect href="/login" />;
```
