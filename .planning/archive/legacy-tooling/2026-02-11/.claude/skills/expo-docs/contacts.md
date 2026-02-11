# Contacts

_Access and manage device contacts._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/contacts/)

```typescript
import * as Contacts from 'expo-contacts';
```

### Permissions

```typescript
const { status } = await Contacts.requestPermissionsAsync();
```

### Get Contacts

```typescript
const { data } = await Contacts.getContactsAsync({
  fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
  pageSize: 20,
  sort: Contacts.SortTypes.FirstName,
});

const contact = await Contacts.getContactByIdAsync(id, [Contacts.Fields.Name]);
```

### Manage Contacts

```typescript
const id = await Contacts.addContactAsync({ firstName: 'John', phoneNumbers: [{ number: '555-1234' }] });
await Contacts.updateContactAsync({ id, firstName: 'Jane' });
await Contacts.removeContactAsync(id);
```

### Present Form

```typescript
await Contacts.presentFormAsync(contactId);
await Contacts.presentFormAsync(null, { firstName: 'Pre-filled' });
```
