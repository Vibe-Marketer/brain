# MailComposer

_Compose and send emails using the system's email client._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/mail-composer/)

```typescript
import * as MailComposer from 'expo-mail-composer';
```

### Usage

```typescript
const isAvailable = await MailComposer.isAvailableAsync();

const result = await MailComposer.composeAsync({
  recipients: ['to@example.com'],
  ccRecipients: ['cc@example.com'],
  bccRecipients: ['bcc@example.com'],
  subject: 'Hello',
  body: '<h1>HTML content</h1>',
  isHtml: true,
  attachments: ['file:///path/to/file.pdf'],
});
```

### Result Status

- `MailComposerStatus.SENT` - Email sent
- `MailComposerStatus.SAVED` - Saved as draft
- `MailComposerStatus.CANCELLED` - User cancelled
- `MailComposerStatus.UNDETERMINED` - Unknown
