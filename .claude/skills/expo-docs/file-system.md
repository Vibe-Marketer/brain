# FileSystem

_Access files and directories on the device._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/filesystem/)

```typescript
import * as FileSystem from 'expo-file-system';
```

### Directories

- `FileSystem.documentDirectory` - Persistent storage
- `FileSystem.cacheDirectory` - Cache (can be cleared)
- `FileSystem.bundleDirectory` - Read-only app bundle (iOS)

### Read/Write

```typescript
const content = await FileSystem.readAsStringAsync(uri);
const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

await FileSystem.writeAsStringAsync(uri, 'content');
await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
```

### File Operations

```typescript
const info = await FileSystem.getInfoAsync(uri);  // { exists, size, isDirectory, uri }
await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
const files = await FileSystem.readDirectoryAsync(uri);
await FileSystem.copyAsync({ from, to });
await FileSystem.moveAsync({ from, to });
await FileSystem.deleteAsync(uri, { idempotent: true });
```

### Download/Upload

```typescript
const { uri } = await FileSystem.downloadAsync(url, destUri);
await FileSystem.uploadAsync(url, fileUri, { uploadType: FileSystem.FileSystemUploadType.MULTIPART });
```
