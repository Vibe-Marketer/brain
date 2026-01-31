# SecureStore

_Encrypt and securely store key-value pairs locally on the device._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/securestore/)

```typescript
import * as SecureStore from 'expo-secure-store';
```

### Usage

```typescript
// Store value
await SecureStore.setItemAsync('token', 'secret-value');

// Retrieve value
const token = await SecureStore.getItemAsync('token');

// Delete value
await SecureStore.deleteItemAsync('token');
```

### Options

```typescript
await SecureStore.setItemAsync('key', 'value', {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
  requireAuthentication: true,  // Require biometrics/passcode
});
```

### Accessibility Options

- `AFTER_FIRST_UNLOCK` - After device unlocked once since boot
- `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` - Same, not backed up
- `WHEN_UNLOCKED` - While device unlocked (default)
- `WHEN_UNLOCKED_THIS_DEVICE_ONLY` - Same, not backed up
- `ALWAYS` - Always accessible
- `ALWAYS_THIS_DEVICE_ONLY` - Always, not backed up

**Limits:** Values must be ≤2048 bytes.

