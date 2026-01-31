# LivePhoto

_Display iOS Live Photos with motion playback._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/live-photo/)

```typescript
import { LivePhotoView, isAvailableAsync } from 'expo-live-photo';
```

### Usage

```typescript
<LivePhotoView
  source={{ photoUri: 'file:///photo.heic', pairedVideoUri: 'file:///video.mov' }}
  style={{ width: 300, height: 300 }}
  contentFit="cover"
  isMuted={false}
/>
```

### Methods

```typescript
ref.current?.startPlayback('full');
ref.current?.stopPlayback();
```

### Events

- `onLoadStart`, `onLoadComplete`, `onLoadError`
- `onPlaybackStart`, `onPlaybackStop`

**Platform Notes:** iOS only. Use `isAvailableAsync()` to check support.
