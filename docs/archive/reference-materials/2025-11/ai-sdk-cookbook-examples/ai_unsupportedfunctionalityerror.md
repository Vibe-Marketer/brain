---

# AI_TypeValidationError

This error occurs when type validation fails.

## Properties

- `value`: The value that failed validation
- `message`: The error message including validation details

## Checking for this Error

You can check if an error is an instance of `AI_TypeValidationError` using:

```typescript
import { TypeValidationError } from 'ai';

if (TypeValidationError.isInstance(error)) {
  // Handle the error
}
```

---
title: AI_UnsupportedFunctionalityError
description: Learn how to fix AI_UnsupportedFunctionalityError