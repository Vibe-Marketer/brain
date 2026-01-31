# Application

_A universal library that provides information about the native application's ID, app name, and build version at runtime._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/application/)

```typescript
import * as Application from 'expo-application';
```

### Constants

- `applicationId` - Bundle ID (iOS) or application ID (Android), `null` on web
- `applicationName` - Human-readable app name displayed on home screen
- `nativeApplicationVersion` - Version string like "1.0.0" for app stores
- `nativeBuildVersion` - Internal build number like "114"

### Methods

- `getInstallationTimeAsync()` - Returns `Date` when app was installed
- `getAndroidId()` - Gets unique device hex string (Android only)
- `getIosApplicationReleaseTypeAsync()` - Returns release type: `UNKNOWN`, `SIMULATOR`, `ENTERPRISE`, `DEVELOPMENT`, `AD_HOC`, `APP_STORE` (iOS only)
- `getInstallReferrerAsync()` - Gets referrer URL from Play Store (Android only)
- `getIosIdForVendorAsync()` - Gets IDFV value (iOS only)
