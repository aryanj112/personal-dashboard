# Styles

## Active Stylesheet

- `app.css`

`main.tsx` imports this file — it is the single, live design system.

Characteristics:

- tactical / military-inspired theme
- light and dark variants
- CSS custom properties for colors, spacing, chart palettes, and surfaces

## Quirk

`App.tsx` still stores `document.documentElement.dataset.mood`, but `app.css`
does not consume it. Theme changes are live; mood changes are currently
vestigial.

## Editing Guidance

- Edit `app.css` for all UI changes.
- Reuse existing CSS variables before introducing new hard-coded colors.
