# Complete Issue & Update List from Transcript

-----

## SIDEBAR / NAVIGATION

### Import/Plus Button Position (Sidebar Open)

**Current:** Import/plus button sits at the bottom of the sidebar
**Done:** Import/plus button positioned at the very top of the sidebar

### Selected Item Indicator (Sidebar Closed)

**Current:** Currently selected item shows a dot at the bottom of the page
**Done:** Orange marker on the left side (matching the style of all other selected items)

### Analytics Position in Sidebar

**Current:** Analytics appears below Settings in sidebar
**Done:** Analytics moved above Settings

### Settings Position in Sidebar

**Current:** Settings appears above Analytics
**Done:** Settings moved to the very bottom of the sidebar

-----

## HOME SCREEN / ALL TRANSCRIPTS

### Search Box Spacing

**Current:** Search box is crammed directly against the top “Library” line with no breathing room
**Done:** Add padding/spacing so the search box isn’t crushed against the top element

### Search Box Location & Behavior

**Current:** Search box visible at all times in the folder section
**Done:** Hide the search box by default. Add a magnifying glass icon next to the plus button in the main header. Tapping the magnifying glass opens the search box. Search remains available but isn’t cluttering the UI when not needed.

-----

## IMPORT / INTEGRATIONS SCREEN

### Extra Line at Top

**Current:** There’s an unnecessary extra line at the very top of the import screen
**Done:** Remove the extra line

### Integrations Box Design

**Current:** Full box container around integrations—feels like overkill
**Done:** Clean up and simplify the design. Move content up. Remove unnecessary container styling.

### Date Range Labeling

**Current:** Just says “pick a date range” with no context about what you’re doing
**Done:** Make it explicit that the user is adding calls/meetings or searching for meetings. Label should clarify the action.

### Fetch Meetings Button Visibility

**Current:** “Fetch Meetings” button is hidden/hard to find. The containing box doesn’t scroll well, making it difficult to see on full screen.
**Done:** Fetch Meetings button clearly visible. Scrolling behavior fixed so all content is accessible.

### Integration Icons

**Current:** Icons in the integrations area don’t match the icons used on the main transcripts page
**Done:** Replace integration icons with the exact same icons shown on the main transcripts page

### Grayed Out Connect Buttons

**Current:** When integrations aren’t connected, the connect button appears slightly grayed out
**Done:** Connect buttons should appear fully active/clickable when integration isn’t connected

### Connect Integration Flow - Extra Steps

**Current:** Clicking to connect Zoom shows “Connect Integration - Connect Zoom - Step 1 of 3” and requires hitting “Next” just to proceed past an informational screen that adds no value
**Done:** Eliminate unnecessary confirmation steps. User shouldn’t have to click “Next” when the screen is just telling them they’re connecting Zoom. Reduce clicks required to complete connection.

### Missing Requirements Information

**Current:** Screen says “Understand the requirements” and “Important information” but displays no actual requirements or information. User must check a box saying they “reviewed requirements” they never saw.
**Done:** Either display actual requirements, or remove the checkbox and “requirements” language entirely

### Zoom Connect Button Broken

**Current:** Clicking “Connect with Zoom” does nothing—completely non-functional
**Done:** Zoom OAuth flow initiates properly when clicked

### Google Meet Requirements + Fathom Promotion

**Current:** Google Meet shows restrictions (only available for Workspace Business/Standard Plus/Enterprise/Education Plus). Personal accounts can sync meeting data but don’t have recordings. No alternative offered.
**Done:** Add Fathom affiliate link with messaging like: “If you have another type of account, connect Fathom instead. Sign up free using this link.” Gives users a free alternative path.

### Google Meet Extra Confirmation Step

**Current:** After acknowledging requirements, user must click through another confirmation screen before actually connecting
**Done:** Eliminate the extra confirmation. “Connect with Google Meet” should be available on the requirements page itself. Reduce total clicks.

### Google Connect Infinite Spinner

**Current:** After clicking connect, spinner runs indefinitely with no error messages, no timeout, no feedback
**Done:** Connection either succeeds with confirmation, or fails with clear error message explaining what went wrong

### Multiple Google Account Handling

**Current:** If a Google account is already connected, there’s no indication of this. System doesn’t prevent or inform about conflicts when trying to connect additional accounts.
**Done:** If Google account already connected, show that status clearly. Allow connecting additional accounts or explain why it’s not possible.

### Cancel/Close Button During Connection

**Current:** X button and cancel options don’t work during connection spinner. User is stuck.
**Done:** X button and cancel actually close the modal and abort the connection attempt

### Component Consistency

**Current:** Integrations component may differ between Import screen and Settings screen
**Done:** Use the exact same component in both locations

-----

## CONTENT SECTION

### Loading State for Hooks/Posts

**Current:** Takes a noticeable delay before hooks, posts, and other content items appear after navigating to Content
**Done:** Faster loading, or at minimum a loading indicator so user knows content is coming

### Content Cards Visual Design

**Current:** Cards have a generic “vibe code AI” look—feels cheap/auto-generated
**Done:** Redesign content cards (can be addressed later, but noted as an issue)

### Generator Naming

**Current:** Called “Call Content Generator”
**Done:** Rename to “Social Post Generator” or similar—something that actually describes what it does

### Business Profile Edit Access

**Current:** Once a business profile is connected, there’s no visible option to edit, view, or update that profile
**Done:** Add edit/view functionality for connected business profiles

### Call Cards Size

**Current:** Call cards are way too large with excessive wasted space
**Done:** Reduce card height significantly. Make them more compact.

-----

## SORTING AND TAGGING PAGE

### Tags Tab Error

**Current:** Clicking on Tags produces a big error and the screen blinks/flickers back and forth
**Done:** Tags tab loads properly without errors

### Rules Tab Error

**Current:** Clicking on Rules produces the same error as Tags—won’t load
**Done:** Rules tab loads properly without errors

### Missing Debug Tool

**Current:** Debug script/tool that was previously available on this page is no longer showing for user’s account
**Done:** Restore debug tool visibility for appropriate accounts

### Overall Page Status

**Current:** Sorting and tagging page is fundamentally broken
**Done:** Complete rework to remove all bugs. All tabs functional.

-----

## COLLABORATION SECTION

### Team Creation

**Current:** “Create a Team” button spins briefly then fails silently. Happens regardless of whether “admin visibility” is checked or not.
**Done:** Team creation actually works and creates a team

### Team Status Display

**Current:** Says “You’re not part of a team yet” but doesn’t provide clear guidance
**Done:** Clear messaging about team status and next steps

### Coach Invite - Email

**Current:** Clicking “Invite a Coach” shows email input field, but submitting doesn’t actually send any email
**Done:** Email invitations actually send

### Coach Invite - Link Generation

**Current:** “Generate invite link” button does nothing
**Done:** Generates a shareable invite link that can be copied

-----

## ANALYTICS PAGE

### All Tabs Broken

**Current:** Clicking on any tab within Analytics Overview causes an error. No tabs are functional.
**Done:** All analytics tabs load and display data properly

-----

## SETTINGS PAGE

### Excessive Divider Lines

**Current:** Way too many divider lines throughout settings
**Done:** Remove unnecessary dividers. Streamline visual hierarchy.

### Edit Pencil Placement

**Current:** Edit pencils appear outside their associated box, in a separate button next to the field
**Done:** Move edit icons inside the input boxes so users can click within the field area to edit

### Confirmation Icons

**Current:** Checkmarks and X marks are gray and hard to see
**Done:** Use red X for cancel/error and green checkmark for confirm/success—make them clearly visible

### Email Edit Functionality

**Current:** No way to edit email address
**Done:** Add edit capability for email address field

### New Profile Creation Flow

**Current:** Clicking “New Profile” creates a profile but gives no indication user needs to scroll down to fill it out. Content doesn’t update when switching between profiles in the selector—still shows CallVault data.
**Done:** After creating new profile, auto-scroll to the new profile section or provide clear indication. Profile selector actually switches displayed content.

### Users Tab - Extra Lines

**Current:** Unnecessary divider lines cluttering the Users tab
**Done:** Remove excess lines

### Users Tab - Non-Functional Elements

**Current:** Status, Joined date, and View Details—none of these work or do anything
**Done:** All user management functions operational

### Billing Section

**Current:** Billing exists but nothing is functional. Plans displayed aren’t correct/current.
**Done:** Billing fully functional with accurate plan information

### Integrations - Google Connect Error

**Current:** Clicking allow on Google (Drive and Calendar permissions) returns “edge function returned a non-200 code” error. Integration remains “Not Connected.”
**Done:** Google OAuth completes successfully and shows “Connected” status

### Integrations - Zoom Connect

**Current:** Clicking to connect Zoom goes nowhere—no response at all
**Done:** Zoom OAuth flow initiates properly

### Knowledge Base Indexing - Incorrect Count

**Current:** Shows “12 transcripts ready to index” but progress displays “1 of 933”—as if 933 transcripts still need chunking despite the 12-transcript message
**Done:** Accurate count displayed. Numbers should match the actual state of transcripts requiring indexing.

-----

## SUMMARY COUNT

- **Sidebar/Navigation:** 4 items
- **Home Screen/Transcripts:** 2 items
- **Import/Integrations:** 14 items
- **Content Section:** 5 items
- **Sorting & Tagging:** 4 items
- **Collaboration:** 4 items
- **Analytics:** 1 item
- **Settings:** 10 items

**Total: 44 distinct issues/updates identified**