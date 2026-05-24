# Styles

There are two stylesheet systems in this folder.

## Active Stylesheet

- `app-military.css`

`main.tsx` currently imports this file, so it is the live design system.

Characteristics:

- tactical / military-inspired theme
- light and dark variants
- CSS custom properties for colors, spacing, chart palettes, and surfaces
- comments explicitly state that industrial mood support has been removed

## Legacy Stylesheet

- `app.css`

This is not currently imported, but it remains useful as:

- a fallback visual reference
- a record of earlier theming decisions
- the source of the older `data-mood` styling behavior

## Important Quirk

`App.tsx` still stores `document.documentElement.dataset.mood`, but `app-military.css` no longer consumes it. Theme changes are live; mood changes are currently vestigial under the active stylesheet.

## Editing Guidance

- Prefer editing `app-military.css` for live UI changes.
- Reuse existing CSS variables before introducing new hard-coded colors.
- If you intentionally revive mood-based styling, make sure the app state and stylesheet behavior match again.
