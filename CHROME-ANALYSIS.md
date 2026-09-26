# Chrome Component Analysis for Marketing Pages

## Overview
The `Chrome` component is the main navigation/header component used across marketing pages in the Careevo application.

---

## 1. File Location
**Primary file:** `/src/components/ui/chrome.tsx`

**Associated files:**
- `/src/app/globals.css` - Contains all Chrome-related styles (lines 482-705)
- `/src/components/ui/explore-menu.tsx` - Mega menu dropdown wrapper
- `/src/components/ui/icons.tsx` - Icon definitions

---

## 2. Full Structure

### Component Hierarchy
```
Chrome
├── Skip Link (accessibility)
├── chrome (main container)
│   ├── chrome-brand (logo/link to home)
│   ├── nav-float (center navigation)
│   │   ├── ExploreMenu (mega dropdown)
│   │   ├── Static Nav Items (Belajar, Loker, Careevo Plus)
│   └── chrome-actions (right-aligned actions)
│       ├── SiJagoLink
│       ├── Masuk button (ghost style)
│       └── Daftar button (brand style)
```

### Key Components Wrapped/Included

#### **NavItems Array** (Lines 19-35)
```typescript
const navItems: NavItem[] = [
  { href: "/belajar", label: "Belajar", icon: <GraduationCap /> },
  { href: "/loker", label: "Loker", icon: <Briefcase /> },
  { href: "/careevo-plus", label: "Careevo Plus", icon: <Sparkle /> },
];
```

#### **Navigation Flow**
1. Uses Next.js `usePathname()` hook for active state detection
2. `resolveHref()` function handles hash links (#main) vs page paths
3. `isActive()` function determines current route highlighting
4. Scroll detection changes appearance when scrolling down

---

## 3. Navigation Links Structure

### Desktop Layout (`.nav-float`)
- **Flexbox center alignment**: Centered horizontally
- **Gap spacing**: `gap: 2px` between items
- **Fixed order**: Logo → Explore Menu → Nav Items → Actions

### Item Structure (`.nav-item`)
```tsx
<Link className={active ? "nav-item is-active" : "nav-item"}>
  {item.icon}                    // Icon at top +2px relative position
  {item.label || <span className="sr-only">...</span>}
</Link>
```

### Active State Logic
```typescript
const isActive = (href: string) => {
  if (href.startsWith("/")) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  return false;
};
```

---

## 4. Icons Used & Positioning

### Available Icons (from `/src/components/ui/icons.tsx`)
- `GraduationCap` - Belajar (education)
- `Briefcase` - Loker (jobs)
- `Sparkle` - Careevo Plus (premium)
- `Compass` - Explore menu trigger
- `ChevronDown` - Dropdown indicator
- `UserRound`, `Settings`, `MessageSquare`, etc. - Other uses

### Icon Styling
```css
.nav-item svg {
  display: block;
  flex-shrink: 0;
  align-self: center;
  position: relative;
  top: 2px;              /* Slight vertical adjustment */
  width: 16px;
  height: 16px;
  stroke-width: 2.2;     /* Slightly thicker than defaults */
  color: #000;           /* Inherits parent color */
}
```

### Icon Specifications
- **Default size**: 15px (navbar), 16px (rendered)
- **Stroke width**: 1.5 (design system standard), 2.2 (in nav)
- **Colors**: Inherit from parent, can override with CSS classes

---

## 5. Mobile vs Desktop Behavior Differences

### Desktop (>768px)
```css
.chrome {
  flex-direction: row;          /* Horizontal layout */
  flex-wrap: nowrap;
  padding: 1rem 1.6rem;
}
.nav-float {
  min-width: auto;
  overflow: visible;
}
.nav-item {
  font-size: 13.5px;
  gap: 0.4rem;                  /* Icon + text spacing */
  padding: 0.5rem 0.85rem;      /* 36px min-height */
}
```

### Mobile (≤768px)
```css
@media (max-width: 768px) {
  .chrome {
    flex-wrap: wrap;
    row-gap: 0.5rem;
    padding: 0.5rem 0.55rem;
  }
  
  .nav-float {
    order: 3;                   /* Moves to bottom row */
    width: 100%;
    max-width: 100%;
    overflow-x: auto;           /* Horizontal scroll */
    -webkit-overflow-scrolling: touch;
  }
  
  .nav-item {
    font-size: 0;               /* Hide text labels */
    gap: 0;                     /* Remove icon-text spacing */
    padding: 0.55rem 0.65rem;
    min-width: 40px;            /* Touch-friendly tappable area */
    justify-content: center;    /* Center icons only */
  }
  
  .nav-item svg { 
    width: 16px; 
    height: 16px; 
  }
  
  .nav-item .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }
}
```

### Mobile Transformation Summary
- **Desktop**: Icon + Text visible
- **Mobile**: Icons only, text hidden via `font-size: 0`, horizontal scrolling enabled
- **Touch targets**: Increased to 40px minimum width

---

## 6. Animation Patterns

### Transition Properties
All interactions use smooth **200ms ease-out** transitions:

```css
/* Base nav item transition */
.transition:
  background-color 200ms ease-out,
  color 200ms ease-out,
  box-shadow 200ms ease-out,
  transform 200ms ease-out;

/* Hover effects */
.nav-item:hover {
  transform: none;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.9) inset;
}

/* Active link hover (no visual change) */
.nav-item.is-active:hover {
  background: transparent;
  box-shadow: none;
}
```

### Click Interactions
```css
.nav-item:active {
  transform: scale(0.97);  /* Subtle press effect */
}

.chrome-btn:active {
  transform: translateY(0) scale(0.97);
}
```

### Dark Hero Mode Transitions
For pages like `/loker` at scroll position 0:
```css
.chrome.is-dark-hero .nav-item:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
  transition-duration: 200ms;
}

/* Smooth scroll behavior transition */
.chrome {
  /* Background changes smoothly on scroll */
}
```

### Explode Menu Animations
```css
.explore-scrim {
  animation: explore-scrim-in 180ms ease-out;
}

.ChevronDown icon rotates on open:
  transition-transform duration-200 ${isOpen ? "rotate-180" : ""}
```

### Button Hover States
```css
.chrome-btn:hover {
  transform: translateY(-1px);        /* Lift effect */
  box-shadow: 0 10px 22px -8px rgba(10, 61, 98, 0.36), inset 0 1px 0 rgba(255, 255, 255, 1);
  border-color: rgba(255, 255, 255, 0.95);
}
```

### Scroll Detection Transition
```typescript
const [scrolled, setScrolled] = useState(false);

useEffect(() => {
  const onScroll = () => {
    setScrolled(window.scrollY > 24);  // Threshold for style change
  };
}, []);
```

---

## 7. Adding Business-Specific Icon/Link

### Recommended Approach

Based on the existing structure, here's where to add a business icon/link:

#### Option A: Add to Chrome NavItems (Standard Way)
**File:** `/src/components/ui/chrome.tsx`

1. Import your business icon:
```typescript
import { Building2 } from "@/components/ui/icons";  // or other lucide-react icon
```

2. Add to navItems array:
```typescript
const navItems: NavItem[] = [
  {
    href: "/belajar",
    label: "Belajar",
    icon: <GraduationCap size={15} strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    href: "/business",  // Your business link
    label: "Business",
    icon: <Building2 size={15} strokeWidth={1.5} aria-hidden="true" />,
  },
  // ... existing items
];
```

3. The component automatically handles:
   - Active state detection
   - Hover animations
   - Mobile icon-only mode
   - Dark hero mode compatibility

#### Option B: Create Separate Business Navbar (Current Pattern)
**File:** `/src/components/features/marketing/business-navbar.tsx`

This already exists and is used specifically for the `/business` page. It has:
- Different styling (cleaner, modern design)
- Built-in mobile hamburger menu
- Highlighted "Business" link in blue
- Separate auth flow

---

## 8. Key CSS Classes Reference

| Class | Purpose | Style Notes |
|-------|---------|-------------|
| `.chrome` | Main container | Adapts on scroll, supports dark mode |
| `.chrome-brand` | Logo link | Flex-1, left-aligned |
| `.nav-float` | Center nav area | Centered flex, 2px gaps |
| `.nav-item` | Navigation link | 36px min-height, rounded-[8px] |
| `.nav-item.is-active` | Current page | Bold weight, different color |
| `.chrome-actions` | Right buttons | Flex-end aligned, right padding |
| `.chrome-btn` | Action button | Gradient background, glassmorphism |
| `.chrome-btn-brand` | Primary CTA | Solid gray/black background |
| `.chrome-btn-ghost` | Secondary CTA | Transparent with backdrop-blur |

---

## Summary

The Chrome component follows a clean, accessible pattern with:
- **Semantic HTML** (skip links, ARIA attributes)
- **Responsive design** (icon-only mobile mode)
- **Smooth animations** (200ms transitions)
- **Context-aware styling** (dark hero mode support)
- **Reusable structure** (centralized navItems array)

To add your business-specific link, simply extend the `navItems` array in `/src/components/ui/chrome.tsx` with an icon and href that matches the existing pattern.
