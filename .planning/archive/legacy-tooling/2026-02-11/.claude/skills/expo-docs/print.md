# Print

_Print documents and HTML using system print dialog._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/print/)

```typescript
import * as Print from 'expo-print';
```

### Print HTML

```typescript
await Print.printAsync({
  html: '<html><body><h1>Hello</h1></body></html>',
});
```

### Print to PDF

```typescript
const { uri } = await Print.printToFileAsync({
  html: htmlContent,
  width: 612,     // 8.5 inches in points
  height: 792,    // 11 inches in points
  base64: false,  // Set true to return base64 instead of file
});
```

### Select Printer (iOS)

```typescript
const printer = await Print.selectPrinterAsync();
await Print.printAsync({ html, printerUrl: printer.url });
```
