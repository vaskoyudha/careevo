# 🎨 Skeleton Loading System for Careevo

## Overview

Beautiful skeleton loading animations have been added to Careevo, matching the same elegant design system used in SiJago. These shimmer effects provide professional loading states throughout your application.

## Components Available

### 1. `src/components/ui/Skeleton.tsx` - Base Component Library

```tsx
import { 
  Skeleton,           // Base shimmer element
  SkeletonText,       // Text placeholders (auto-width lines)
  SkeletonAvatar,     // Circle avatars (xs→xl sizes)
  SkeletonCard,       // Complete card layouts
  SkeletonList,       // Staggered list of cards
  SkeletonTable,      // Data table with rows/columns
  SkeletonOverlay,    // Overlay with spinner + progress rings
} from "@/components/ui/Skeleton";
```

### 2. `src/components/ui/SkeletonLoadingView.tsx` - Page Layout Examples

```tsx
import SkeletonLoadingView from "@/components/ui/SkeletonLoadingView";
// Shows complete example layout with lists, tables, overlays
```

### 3. `src/components/ui/LoadingPage.tsx` - Universal Wrapper

```tsx
import { LoadingPage } from "@/components/ui/LoadingPage";

export default function MyPage() {
  if (loading) {
    return <LoadingPage title="Preparing..." description="Please wait." />;
  }
  return <Content />;
}
```

## Usage Examples

### Basic Shimmer Effect

```tsx
import { Skeleton } from "@/components/ui/Skeleton";

// Simple shimmer box
<Skeleton className="h-10 w-full rounded-lg" />

// With gradient variant
<Skeleton variant="shimmer" className="w-32 h-8" />
```

### Card Loading

```tsx
import { SkeletonCard, SkeletonList } from "@/components/ui/Skeleton";

// Single card
<SkeletonCard 
  title={true}
  description={true}
  image={false}
  buttons={false}
/>

// List of cards (staggered animation)
<SkeletonList itemLength={5} />
```

### Table Loading

```tsx
import { SkeletonTable } from "@/components/ui/Skeleton";

<SkeletonTable 
  rows={10}
  columns={4}
  hasActions={true}
/>
```

### Full-Screen Overlay

```tsx
import { SkeletonOverlay } from "@/components/ui/Skeleton";

<SkeletonOverlay 
  fullScreen={true}
  title="Loading content..."
  description="This may take a moment."
/>
```

## CSS Animations Added

All animations are in `src/app/globals.css`:

```css
/* Main shimmer effect */
.animate-loading-skeleton   /* Smooth left-to-right gradient */

/* Spinners & pulses */
.animate-spin-slow          /* Slow rotation (3s) */
.animate-pulse-soft         /* Gentle opacity pulse (2s) */

/* Entrance animations */
.animate-fade-in-up        /* Slide up entrance */
.delay-50 through delay-500 /* Animation delays in 50ms steps */
```

## Integration Steps

### Step 1: Add Import to Your Component

```tsx
import { SkeletonOverlay } from "@/components/ui/Skeleton";
```

### Step 2: Wrap Content with Loading State

```tsx
export default function LearningPage() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetchData().then(setData);
  }, []);
  
  if (!data) {
    return (
      <SkeletonOverlay
        fullScreen={true}
        title="Preparing your learning journey..."
        description="Load your personalized curriculum."
      />
    );
  }
  
  return <ActualContent data={data} />;
}
```

### Step 3: Use Skeleton Variants Within Pages

```tsx
function FeaturesSection({ features, loading }) {
  if (loading) {
    return <SkeletonList itemLength={6} />;
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {features.map(feature => (
        <FeatureCard key={feature.id} {...feature} />
      ))}
    </div>
  );
}
```

## Visual Design

### Color Palette
- Primary shimmer: `from-[#e2eef4] via-[#f0f7fa] to-[#e2eef4]`
- Background: White (`bg-white`)
- Borders: Gray-200 (`border-gray-200`)
- Shadows: Soft shadows for depth

### Animation Timing
- Duration: 2s ease-in-out infinite
- Delays: 50ms increments for organic stagger
- Performance: GPU-accelerated CSS transforms

## Best Practices

1. **Use proper loading states**: Show skeletons before async data loads
2. **Keep animations subtle**: Don't distract from actual content
3. **Match content dimensions**: Skeleton should match placeholder space
4. **Stagger entrances**: Use delay classes for natural feel
5. **Respect reduced motion**: Users with `prefers-reduced-motion` preference

## Common Patterns

### Server Component Loading
```tsx
export default async function Page() {
  const data = await loadData();
  
  return (
    <Suspense fallback={<LoadingPage />}>
      {data ? <Content data={data} /> : null}
    </Suspense>
  );
}
```

### Client Component Pattern
```tsx
"use client";

import { useState, useEffect } from "react";
import { SkeletonOverlay } from "@/components/ui/Skeleton";

export function DynamicComponent() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetch().then(result => {
      setData(result);
      setLoading(false);
    });
  }, []);
  
  if (loading) {
    return <SkeletonOverlay title="Loading..." />;
  }
  
  return <Content data={data} />;
}
```

## Troubleshooting

### Animations not appearing?
1. Clear browser cache (Ctrl+Shift+R)
2. Verify `npm run build` completed successfully
3. Check that `globals.css` contains skeleton animations
4. Ensure Tailwind is processing the classes

### Performance issues?
1. Use pure CSS animations (already configured)
2. Avoid JavaScript-driven animations
3. Limit concurrent loading overlays
4. Use skeleton variants strategically

## Next Steps

To see it in action:
1. Visit http://localhost:3000
2. Navigate to any page that loads data asynchronously
3. Watch for beautiful shimmer animations during load

---

**Built with ❤️ for Careevo's user experience!**

*All animations optimized for 60fps performance.*
