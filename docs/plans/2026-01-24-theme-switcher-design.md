# Theme Switcher Design

**Date:** 2026-01-24
**Status:** Approved
**Feature:** Theme switching system with retro-futuristic theme

## Overview

Add a theme switcher to the trend monitor dashboard with two themes:
1. **Default**: Current clean, modern design
2. **Retro-Futuristic**: Terminal aesthetic with emerald green, monospace fonts, and glowing effects

Additionally, refactor the horizontal navigation to a sidebar layout that works across all themes.

## Goals

- Enable users to switch between visual themes
- Persist theme preference across sessions
- Maintain consistent sidebar layout across all themes
- Make it easy to add new themes in the future
- Zero impact on existing functionality

## Architecture

### Theme Management

**State Management:** Zustand store with persist middleware

```typescript
type Theme = 'default' | 'retro-futuristic'

interface ThemeStore {
  theme: Theme
  setTheme: (theme: Theme) => void
}
```

- **Storage**: localStorage with key `'theme-storage'`
- **Default**: `'default'` theme
- **Persistence**: Automatic via Zustand persist middleware

### Theme Application

**CSS Variables Approach:**

Themes are defined as CSS classes (`:root`, `.dark`, `.retro-futuristic`) that set CSS variable values. Tailwind utilities reference these variables (`bg-background`, `text-foreground`), so theme changes cascade automatically.

**DOM Integration:**

`ThemeApplier` component subscribes to theme store and applies theme class to `document.documentElement`:

```typescript
useEffect(() => {
  document.documentElement.className = theme
}, [theme])
```

### Layout Structure

**Sidebar Navigation (All Themes):**

```
<div className="flex h-screen">
  <aside className="w-64 border-r">
    {/* Header: Logo/branding */}
    {/* Navigation: Vertical links */}
    {/* Footer: Theme switcher + status */}
  </aside>

  <main className="flex-1 flex flex-col">
    {/* Optional top bar */}
    {/* Content area */}
  </main>
</div>
```

**Navigation Links:**
- Overview (/)
- Keywords (/keywords)
- Sources (/sources)

## Component Structure

### New Files

```
apps/web/src/
├── stores/
│   └── themeStore.ts          # Zustand store with persist
├── components/
│   ├── ThemeApplier.tsx       # Applies theme to DOM
│   └── ThemeSwitcher.tsx      # Dropdown selector in sidebar
```

### Modified Files

```
apps/web/src/
├── components/
│   └── Layout.tsx             # Refactor: horizontal nav → sidebar
├── routes/
│   └── __root.tsx             # Add ThemeApplier
└── index.css                  # Add retro-futuristic theme
```

### Component Details

**themeStore.ts:**
- Zustand store with persist middleware
- localStorage key: `'theme-storage'`
- Exports: `useThemeStore` hook

**ThemeApplier.tsx:**
- Subscribes to theme store
- Updates `document.documentElement.className`
- Placed in `__root.tsx` before Layout

**ThemeSwitcher.tsx:**
- shadcn/ui DropdownMenu component
- Shows theme options with icons
- Positioned in sidebar footer
- Calls `setTheme()` on selection

**Layout.tsx:**
- Full redesign from horizontal nav to sidebar
- Sidebar contains: header, nav links, theme switcher
- Main area contains: optional top bar, content outlet
- Active link styling via TanStack Router `activeProps`

## Theme Definitions

### Default Theme

Uses existing color palette from current `:root`:
- Clean, modern aesthetic
- Sans-serif fonts
- Subtle grays and primary color accents
- Simple borders and shadows

### Retro-Futuristic Theme

Terminal aesthetic inspired by the design sample:

**Colors:**
- Background: Deep space blacks (`#0a0b10`, `#0d1117`)
- Foreground: Emerald green (`emerald-500`, `emerald-400`)
- Borders: Subtle emerald with transparency (`emerald-900/30`)
- Accents: Bright emerald highlights

**Typography:**
- Monospace font family (ui-monospace, Courier New)
- Font applied via theme class on root element

**Visual Effects:**
- `.terminal-glow`: Text shadow for glowing effect on active items
- `.scan-line`: Optional subtle scan line background
- Uppercase labels and tracking-widest for terminal feel

### CSS Implementation

Add to `index.css`:

```css
.retro-futuristic {
  font-family: ui-monospace, 'Courier New', monospace;

  --background: oklch(0.04 0.01 252);
  --foreground: oklch(0.67 0.14 165);
  --card: oklch(0.06 0.01 252);
  --card-foreground: oklch(0.80 0.12 165);
  --primary: oklch(0.67 0.14 165);
  --primary-foreground: oklch(0.04 0.01 252);
  --border: oklch(0.30 0.08 165 / 30%);
  /* ... additional variables */
}

@layer utilities {
  .terminal-glow {
    text-shadow: 0 0 10px currentColor, 0 0 20px currentColor;
  }

  .scan-line {
    background: linear-gradient(
      to bottom,
      transparent 50%,
      rgba(16, 185, 129, 0.03) 50%
    );
    background-size: 100% 4px;
  }
}
```

## Implementation Flow

### Theme Initialization

1. App loads → Zustand persist middleware reads localStorage
2. If no saved theme → defaults to `'default'`
3. `ThemeApplier` mounts → reads theme from store
4. `useEffect` applies theme class to `document.documentElement`
5. Initial render uses correct theme (no flash)

### Theme Switching

1. User opens ThemeSwitcher dropdown in sidebar
2. Selects theme option (e.g., "Retro-Futuristic")
3. Calls `setTheme('retro-futuristic')`
4. Zustand updates state + persists to localStorage
5. `ThemeApplier` detects change → updates DOM class
6. CSS variables cascade → entire app re-styles instantly

## Testing Plan

### Manual Testing

**Theme Persistence:**
- Switch theme → refresh page → verify persists
- Test in different browsers
- Clear localStorage → verify defaults to 'default'

**Theme Switching:**
- Toggle between themes → verify instant visual change
- Check all UI components render correctly in both themes
- Verify active link highlighting in sidebar

**Layout & Navigation:**
- Test sidebar on all routes (/, /keywords, /sources, /keywords/:id)
- Verify responsive behavior
- Check active state styling

**Component Coverage:**
- Cards, tables, forms, buttons in both themes
- Verify readability and contrast
- Test terminal-glow doesn't hurt readability

### Component Tests (Optional)

- `themeStore`: Verify persist middleware
- `ThemeApplier`: Verify DOM class updates
- `ThemeSwitcher`: Verify dropdown renders and calls setTheme

## Rollout Plan

**Phase 1 - Core Implementation:**
1. Create `stores/themeStore.ts`
2. Create `components/ThemeApplier.tsx`
3. Update `index.css` with retro-futuristic theme + utilities
4. Create `components/ThemeSwitcher.tsx`
5. Refactor `components/Layout.tsx` to sidebar
6. Update `__root.tsx` to include ThemeApplier

**Phase 2 - Testing & Polish:**
1. Test all routes with both themes
2. Verify component styling in both themes
3. Fine-tune any color/contrast issues
4. Add icons to theme dropdown options

## Future Enhancements

- **Additional themes**: Cyberpunk, minimal, light mode variants
- **Theme preview**: Show theme thumbnail in dropdown
- **System preference**: Auto-detect `prefers-color-scheme`
- **Mobile responsive**: Sidebar toggle/drawer for mobile
- **Per-route themes**: Override theme for specific pages
- **Custom themes**: User-defined color palettes

## Design Decisions

**Why Zustand over React Context?**
- Simpler API for global state
- Built-in persist middleware
- Better performance (no context re-renders)
- Aligns with project preference for Zustand

**Why CSS variables over CSS-in-JS?**
- Already using this pattern (`:root`, `.dark`)
- Excellent performance (no runtime overhead)
- Works seamlessly with Tailwind
- Easy to add new themes

**Why sidebar for all themes?**
- Consistent UX across themes
- Modern dashboard pattern
- Scales better than horizontal nav
- Avoids jarring layout shifts when changing themes
- Matches retro-futuristic design sample

**Why localStorage over backend?**
- MVP is single-user with no auth
- Simple implementation
- Good UX without backend changes
- Easy to migrate to backend later

## References

- Design sample: `docs/design/retro-futuristic/`
- Zustand docs: https://github.com/pmndrs/zustand
- Tailwind CSS variables: https://tailwindcss.com/docs/customizing-colors#using-css-variables
