# AI_EmptyResponseBodyError

This error occurs when an API returns an empty response body.

## Properties

- `message`: Error message describing the empty response

## Checking for this Error

You can check if an error is an instance of `AI_EmptyResponseBodyError` using:

```typescript
import { EmptyResponseBodyError } from 'ai';

if (EmptyResponseBodyError.isInstance(error)) {
  // Handle the error
}
```
