# Sharing

_Share files using the system share sheet._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/sharing/)

```typescript
import * as Sharing from 'expo-sharing';
```

### Usage

```typescript
const isAvailable = await Sharing.isAvailableAsync();

await Sharing.shareAsync(fileUri, {
  mimeType: 'application/pdf',
  dialogTitle: 'Share document',
  UTI: 'com.adobe.pdf',  // iOS Uniform Type Identifier
});
```

Share local files only. For text/URLs, use React Native's `Share` API instead.

