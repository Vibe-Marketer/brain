# Blob

_Web standards-compliant Blob implementation for React Native._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/blob/)

```typescript
import { Blob } from 'expo-blob';
```

### Creating Blobs

```typescript
const textBlob = new Blob(['Hello, World!'], { type: 'text/plain' });
const bufferBlob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
const combined = new Blob([blob1, blob2]);
```

### Reading Blobs

```typescript
const text = await blob.text();
const arrayBuffer = await blob.arrayBuffer();
```

### Properties

- `blob.size` - Size in bytes
- `blob.type` - MIME type
- `blob.slice(start, end, type)` - Create a slice
