# Crypto

_Cryptographic operations including random values and hashing._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/crypto/)

```typescript
import * as Crypto from 'expo-crypto';
```

### Random Values

```typescript
const randomBytes = await Crypto.getRandomBytesAsync(16);
const uuid = Crypto.randomUUID();
```

### Hashing

```typescript
const hash = await Crypto.digestStringAsync(
  Crypto.CryptoDigestAlgorithm.SHA256,
  'Hello, World!'
);
```

Algorithms: `MD5`, `SHA1`, `SHA256`, `SHA384`, `SHA512`

Encodings: `HEX` (default), `BASE64`

```typescript
const base64Hash = await Crypto.digestStringAsync(
  Crypto.CryptoDigestAlgorithm.SHA256,
  'data',
  { encoding: Crypto.CryptoEncoding.BASE64 }
);
```
