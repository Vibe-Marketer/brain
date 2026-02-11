# GLView

_OpenGL ES render target for WebGL-style graphics._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/gl-view/)

```typescript
import { GLView } from 'expo-gl';
```

### Basic Usage

```typescript
<GLView
  style={{ flex: 1 }}
  onContextCreate={(gl) => {
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.endFrameEXP();  // Required to flush
  }}
/>
```

### Animation Loop

```typescript
const render = () => {
  // Draw frame
  gl.endFrameEXP();
  requestAnimationFrame(render);
};
```

### Snapshot

```typescript
const result = await glViewRef.current?.takeSnapshotAsync({
  format: 'png',
  result: 'file',  // 'file' | 'base64' | 'data-uri'
});
```

Works with Three.js via `expo-three` package.
