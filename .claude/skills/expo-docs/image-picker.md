# ImagePicker

_Select images and videos from library or capture with camera._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/imagepicker/)

```typescript
import * as ImagePicker from 'expo-image-picker';
```

### Permissions

```typescript
await ImagePicker.requestCameraPermissionsAsync();
await ImagePicker.requestMediaLibraryPermissionsAsync();
```

### Pick from Library

```typescript
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ['images'],           // 'images' | 'videos' | 'livePhotos'
  allowsEditing: true,
  allowsMultipleSelection: true,
  selectionLimit: 5,
  aspect: [4, 3],
  quality: 0.8,
  base64: true,
});

if (!result.canceled) {
  result.assets[0].uri;    // File URI
  result.assets[0].width;  // Dimensions
  result.assets[0].base64; // If requested
}
```

### Take Photo

```typescript
const result = await ImagePicker.launchCameraAsync({
  mediaTypes: ['images'],
  cameraType: ImagePicker.CameraType.back,
  quality: 1,
});
```
