# Audio

_Modern audio playback and recording API for React Native._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/audio/)

```typescript
import { useAudioPlayer, useAudioPlayerStatus, useAudioRecorder } from 'expo-audio';
```

### Playback with Hooks

```typescript
const player = useAudioPlayer(require('./audio.mp3'));
const status = useAudioPlayerStatus(player);

player.play();
player.pause();
player.seekTo(30);
player.setVolume(0.5);
player.setRate(1.5);
```

Status provides `playing`, `duration`, `currentTime`, and `isBuffering`.

### Recording

```typescript
const recorder = useAudioRecorder(RecordingOptions.HIGH_QUALITY);

await recorder.prepareToRecordAsync();
recorder.record();
await recorder.stop();
const uri = recorder.uri;
```

### Audio Mode

```typescript
import { setAudioModeAsync } from 'expo-audio';

await setAudioModeAsync({
  playsInSilentMode: true,
  shouldRouteThroughEarpiece: false,
});
```
