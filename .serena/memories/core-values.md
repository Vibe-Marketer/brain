# CallVault Core Values

## The One-Click Promise

> Every feature, function, and workflow should strive to complete the user's job in the **fewest possible actions** - ideally a single click or button press.

## Guiding Principles

### Before Building
- What's the user trying to accomplish?
- What's the absolute minimum they should do?
- Can we infer defaults instead of asking?

### During Implementation
- Eliminate unnecessary forms, modals, confirmations
- Use smart defaults over configuration
- Auto-progress when there's only one sensible path
- Batch operations where users would repeat actions

### In Review
- Count the clicks/taps required
- Ask: "Would removing this step break anything critical?"
- Default to fewer steps unless user safety requires more

## The Friction Test

Before completing any feature:
- [ ] Can this be done in fewer clicks/actions?
- [ ] Are we defaulting to smart values instead of asking?
- [ ] Is there unnecessary confirmation?
- [ ] Does this absorb complexity from the user?

## KISS-UX Principle

> Simple UX > simple code. 
> We absorb complexity so users don't have to.

A slightly more complex backend that saves users 3 clicks is worth it.

## Examples

| High Friction | One-Click Solution |
|---------------|-------------------|
| Select files → Click Upload → Confirm → Wait → Close | Drag & drop auto-uploads with progress |
| Open settings → Find option → Toggle → Save → Close | One toggle, instant save |
| Fill form → Review → Confirm → Submit → View result | Smart defaults → Submit → Done |
