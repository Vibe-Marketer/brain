# KeepAwake

_Prevent the screen from sleeping while your app is active._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/keep-awake/)

```typescript
import { useKeepAwake, activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
```

### Hook (Recommended)

```typescript
function VideoPlayer() {
  useKeepAwake();  // Screen stays awake while mounted
  return <Video />;
}

function Timer({ isRunning }) {
  useKeepAwake('timer', isRunning);  // Conditional
}
```

### Imperative

```typescript
activateKeepAwake();
deactivateKeepAwake();

// Tagged (multiple independent states)
activateKeepAwakeAsync('download');
deactivateKeepAwake('download');
```
