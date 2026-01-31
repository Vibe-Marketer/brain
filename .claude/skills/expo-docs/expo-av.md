# AV (Deprecated)

_Legacy audio/video playback and recording. Use `expo-audio` and `expo-video` instead._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/av/)

```typescript
import { Audio, Video } from 'expo-av';
```

### Audio Playback

```typescript
const { sound } = await Audio.Sound.createAsync(require('./audio.mp3'), { shouldPlay: true });
await sound.playAsync();
await sound.pauseAsync();
await sound.setPositionAsync(30000);
await sound.unloadAsync();
```

### Recording

```typescript
await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
const recording = new Audio.Recording();
await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
await recording.startAsync();
await recording.stopAndUnloadAsync();
const uri = recording.getURI();
```

### Video Component

```typescript
<Video
  source={{ uri: 'https://example.com/video.mp4' }}
  style={{ width: 300, height: 200 }}
  useNativeControls
  resizeMode={ResizeMode.CONTAIN}
  shouldPlay
  isLooping
/>
```
