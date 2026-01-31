# StoreReview

_Prompt users for in-app reviews._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/storereview/)

```typescript
import * as StoreReview from 'expo-store-review';
```

### Usage

```typescript
const isAvailable = await StoreReview.isAvailableAsync();
const hasAction = await StoreReview.hasAction();

// Request in-app review (system decides whether to show)
await StoreReview.requestReview();
```

### Open Store Page

```typescript
// Fallback: open app store page directly
StoreReview.storeUrl();  // Returns store URL for your app
```

**Best Practices:**
- Don't call after negative experiences
- Don't call too frequently
- System may not show the prompt every time
- iOS limits requests per year per user

