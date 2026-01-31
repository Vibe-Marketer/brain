# DocumentPicker

_Select documents from device storage or cloud providers._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/document-picker/)

```typescript
import * as DocumentPicker from 'expo-document-picker';
```

### Pick Documents

```typescript
const result = await DocumentPicker.getDocumentAsync({
  type: '*/*',                    // MIME type filter
  multiple: true,                 // Allow multiple selection
  copyToCacheDirectory: true,     // Copy to app cache
});

if (!result.canceled) {
  result.assets.forEach((file) => {
    file.uri;      // File URI
    file.name;     // File name
    file.size;     // Size in bytes
    file.mimeType; // MIME type
  });
}
```

Type filters: `'*/*'`, `'application/pdf'`, `'image/*'`, or array `['application/pdf', 'text/plain']`
