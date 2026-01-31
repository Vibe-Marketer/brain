# Calendar

_Interact with device calendars, events, and reminders._

[Expo Docs](https://docs.expo.dev/versions/latest/sdk/calendar/)

```typescript
import * as Calendar from 'expo-calendar';
```

### Permissions

```typescript
await Calendar.requestCalendarPermissionsAsync();
await Calendar.requestRemindersPermissionsAsync(); // iOS only
```

### Calendars

```typescript
const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
const calendarId = await Calendar.createCalendarAsync({ title: 'My Calendar', ... });
```

### Events

```typescript
const events = await Calendar.getEventsAsync([calendarId], startDate, endDate);

const eventId = await Calendar.createEventAsync(calendarId, {
  title: 'Meeting',
  startDate: new Date(),
  endDate: new Date(),
  location: 'Office',
  alarms: [{ relativeOffset: -30 }],
});

await Calendar.updateEventAsync(eventId, { title: 'Updated' });
await Calendar.deleteEventAsync(eventId);
```

### Reminders (iOS only)

```typescript
const reminders = await Calendar.getRemindersAsync([calendarId], null, startDate, endDate);
await Calendar.createReminderAsync(calendarId, { title: 'Task', dueDate: new Date() });
```
