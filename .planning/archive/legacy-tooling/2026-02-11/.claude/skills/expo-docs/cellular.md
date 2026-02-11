# Cellular

_Get information about the user's cellular service provider._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/cellular/)

```typescript
import * as Cellular from 'expo-cellular';
```

### Constants

- `carrier` - Carrier name like "Verizon", "AT&T"
- `isoCountryCode` - ISO country code like "us", "gb"
- `mobileCountryCode` - MCC like "310" for US
- `mobileNetworkCode` - Carrier-specific MNC
- `allowsVoip` - Whether VoIP is allowed

### Methods

- `getCellularGenerationAsync()` - Returns generation: `UNKNOWN` (0), `CELLULAR_2G` (1), `CELLULAR_3G` (2), `CELLULAR_4G` (3), `CELLULAR_5G` (4)
