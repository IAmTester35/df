# Design System Master File (Nordic Glass SPA)

> **LOGIC:** When building a specific page, first check `design-system/nordic-glass-spa/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Nordic Glass SPA
**Style:** Nordic Glassmorphism (Arctic Edition)
**Mood:** Cold, Clean, Simple, Premium, Ethereal

---

## Global Rules

### Color Palette (Nordic Arctic Blue)

| Role | Hex | CSS Variable | Description |
|------|-----|--------------|-------------|
| Primary | `#1E40AF` | `--color-primary` | Deep Arctic Blue |
| Secondary | `#7DD3FC` | `--color-secondary` | Glacier Sky Blue |
| Accent | `#0EA5E9` | `--color-accent` | Frozen Lake Cyan |
| Background | `#F8FAFC` | `--color-background` | Arctic Mist (Near White) |
| Text | `#0F172A` | `--color-text` | Midnight Navy (High Contrast) |
| Glass-BG | `rgba(255, 255, 255, 0.45)` | `--color-glass-bg` | Translucent Ice |
| Glass-Border | `rgba(255, 255, 255, 0.6)` | `--color-glass-border` | Frost Rim |

**Color Notes:** Inspired by the cold, crisp landscapes of Scandinavia. Uses high-contrast midnight navy against soft glacial blues.

### Typography

- **Heading Font:** Outfit (fallback: Inter)
- **Body Font:** Inter
- **Mood:** Clean, Modern, Spatially Aware
- **Google Fonts:** [Outfit + Inter](https://fonts.google.com/share?selection.family=Inter:wght@300;400;500;600|Outfit:wght@400;600;700)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Outfit:wght@400;600;700&display=swap');
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` | Fine adjustments |
| `--space-sm` | `8px` | Icon/Text gaps |
| `--space-md` | `16px` | Standard padding |
| `--space-lg` | `24px` | Card/Section padding |
| `--space-xl` | `48px` | Layout margins |

### Glassmorphism Effects

| Token | Value | Description |
|-------|-------|-------------|
| `--glass-blur` | `16px` | Backdrop filter blur |
| `--glass-shadow` | `0 8px 32px 0 rgba(15, 23, 42, 0.08)` | Subtle deep shadow |
| `--glass-border` | `1px solid var(--color-glass-border)` | Crystalline border |

---

## Component Specs

### Glass Cards (The Signature Component)

```css
.glass-card {
  background: var(--color-glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: var(--glass-border);
  border-radius: 24px;
  padding: var(--space-lg);
  box-shadow: var(--glass-shadow);
  transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
}

.glass-card:hover {
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.55);
  box-shadow: 0 12px 48px 0 rgba(15, 23, 42, 0.12);
}
```

### Nordic Buttons

```css
/* Primary Button - Deep Arctic */
.btn-primary {
  background: var(--color-primary);
  color: white;
  padding: 12px 28px;
  border-radius: 14px;
  font-family: 'Outfit', sans-serif;
  font-weight: 600;
  transition: all 300ms ease;
  cursor: pointer;
  border: none;
}

.btn-primary:hover {
  background: #111827; /* Darker navy */
  box-shadow: 0 4px 20px rgba(30, 64, 175, 0.3);
}

/* Glass Button */
.btn-glass {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: var(--color-primary);
  padding: 12px 28px;
  border-radius: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 300ms ease;
}
```

### Navigation

```css
.nav-floating {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: auto;
  min-width: 300px;
  z-index: 1000;
  padding: 12px 24px;
}
```

---

## Style Guidelines

**Style:** Nordic Minimalist Glass
**Industry:** SPA / Dashboard / Modern Utility

### Visual Principles
1. **Airy Layouts**: Use generous whitespace (`--space-xl`).
2. **Crystalline Borders**: Borders should be light and translucent, like ice edges.
3. **Cold Palette**: Avoid any warm colors (reds, yellows, oranges) unless for critical errors. Use different shades of blue and slate.
4. **Subtle Motion**: Use long, smooth transitions (400ms) with `cubic-bezier`.

---

## Anti-Patterns (Do NOT Use)
- ❌ **Warm Palettes** — No pinks, oranges, or yellows.
- ❌ **Sharp Corners** — Use 16px - 24px border radius.
- ❌ **Solid Dark Backgrounds** — Use deep navy with slight transparency if needed.
- ❌ **Emojis as Icons** — Use Lucide/Heroicons in `slate-600` or `blue-600`.

---

## Pre-Delivery Checklist
- [ ] Colors are strictly in the "Cold Blue" spectrum.
- [ ] Glass cards have `backdrop-filter` and `border`.
- [ ] Typography uses "Outfit" for headings.
- [ ] Responsive at 375px, 768px, 1024px, 1440px.
- [ ] No layout shift on hover.
- [ ] `cursor-pointer` on all interactive glass elements.
