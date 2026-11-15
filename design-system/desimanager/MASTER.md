# DesiManager design system

## Product context

Voice-first shop bookkeeping for chaiwalas and other small shopkeepers. Most use is quick, mobile, and happens beside a busy counter. The interface should stay easy to scan in daylight and forgiving when a shopkeeper is interrupted.

## Visual direction

- Minimal dashboard layout with one clear message per card.
- Warm cream canvas and quiet surfaces; forest green for the shop identity; terracotta for the main action.
- Use simple SVG icons, short labels, clear numbers, and small amounts of motion.
- Keep the five main destinations visible on mobile through bottom navigation.
- Use Lexend for headings and Noto Sans Devanagari for body text and local-language characters, with system sans-serif fallbacks.

## Tokens

| Role | Value |
| --- | --- |
| Canvas | #F8F5EF |
| Surface | #FFFEFA |
| Soft surface | #F4EFE6 |
| Main text | #24332D |
| Muted text | #748078 |
| Border | #E9E3D9 |
| Brand forest | #1E4438 |
| Deep forest | #17382F |
| Primary action | #963C1D |
| Primary action hover | #7D3016 |
| Positive | #23614D |
| Positive surface | #E5F1E9 |
| Expense accent | #D78A67 |
| Warning | #93620C |
| Warning surface | #FBF1D8 |
| Error | #AD3F32 |
| Error surface | #FAEAE7 |

## Typography and spacing

- Body text starts at 15–16px; labels stay at 9px or larger and are never the only way to understand a control.
- Use 1.45–1.6 line height for instructions and helper copy.
- Keep 8px or more between neighboring touch targets; interactive buttons are at least 42px tall.
- Use consistent 8px spacing increments for card padding, gaps, and page sections.
- Use tabular or lined-up numerals for rupee amounts when supported.

## Interaction

- Every expense, credit entry, and payment shows a review step before it is saved by voice.
- Keep typed commands available when speech recognition is missing or microphone permission is denied.
- Use visible focus rings, native form labels, descriptive button names, and reduced-motion support.
- Charts include visible labels and a data table for assistive technology.
- Keep all pages usable at 375px, 768px, 1024px, and 1440px with no page-level horizontal scrolling.
- Keep sign-in, account creation, microphone consent, wake-word setup, and error states calm and clear.
- The udhaar table must show one customer per row with credit given, payments received, and balance due as separate columns.

## Dashboard chart

Use a direct comparison of daily sales and expenses with two named series. Keep the values available in an accessible table and do not encode meaning using color alone.
