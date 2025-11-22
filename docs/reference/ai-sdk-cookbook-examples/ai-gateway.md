---

# AI_UnsupportedFunctionalityError

This error occurs when functionality is not unsupported.

## Properties

- `functionality`: The name of the unsupported functionality
- `message`: The error message

## Checking for this Error

You can check if an error is an instance of `AI_UnsupportedFunctionalityError` using:

```typescript
import { UnsupportedFunctionalityError } from 'ai';

if (UnsupportedFunctionalityError.isInstance(error)) {
  // Handle the error
}
```

---
title: AI Gateway
description: Learn how to use the AI Gateway provider with the AI SDK.