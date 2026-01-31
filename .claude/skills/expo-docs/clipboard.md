# Clipboard

_Read and write to the system clipboard._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/clipboard/)

```typescript
import * as Clipboard from 'expo-clipboard';
```

### String

```typescript
await Clipboard.setStringAsync('Hello');
const text = await Clipboard.getStringAsync();
const hasString = await Clipboard.hasStringAsync();
```

### Image

```typescript
await Clipboard.setImageAsync(base64String);
const image = await Clipboard.getImageAsync({ format: 'png' });
const hasImage = await Clipboard.hasImageAsync();
```

### URL

```typescript
await Clipboard.setUrlAsync('https://expo.dev');
const url = await Clipboard.getUrlAsync();
const hasUrl = await Clipboard.hasUrlAsync();
```

### Listener

```typescript
const subscription = Clipboard.addClipboardListener(({ contentTypes }) => {});
subscription.remove();
```
