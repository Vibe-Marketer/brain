# Camera

_Camera preview and photo/video capture._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/camera/)

```typescript
import { CameraView, useCameraPermissions } from 'expo-camera';
```

### Permissions

```typescript
const [permission, requestPermission] = useCameraPermissions();
if (!permission?.granted) await requestPermission();
```

### Basic Camera

```typescript
const cameraRef = useRef<CameraView>(null);

<CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
  <Button onPress={async () => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8, base64: true });
  }} />
</CameraView>
```

### Video Recording

```typescript
const video = await cameraRef.current?.recordAsync({ maxDuration: 60, quality: '1080p' });
cameraRef.current?.stopRecording();
```

### Barcode Scanning

```typescript
<CameraView
  barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13'] }}
  onBarcodeScanned={({ type, data }) => console.log(type, data)}
/>
```
