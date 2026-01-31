# SMS

_Send SMS messages using the system's UI._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/sms/)

```typescript
import * as SMS from 'expo-sms';
```

### Usage

```typescript
const isAvailable = await SMS.isAvailableAsync();

const { result } = await SMS.sendSMSAsync(
  ['1234567890', '0987654321'],  // Recipients
  'Hello from my app!',          // Message
  {
    attachments: {
      uri: 'file:///path/to/image.png',
      mimeType: 'image/png',
      filename: 'image.png',
    },
  }
);
```

### Result

- `SMS.SentStatus.SENT` - Message sent
- `SMS.SentStatus.CANCELLED` - User cancelled
- `SMS.SentStatus.UNKNOWN` - Unknown result

