# Beautiful Skeleton Loading Components for AI Mastery

This document describes the beautiful skeleton loading animation system implemented for the AI Mastery application.

## Overview

The skeleton loading system provides elegant, professional loading states that match AI Mastery's ocean-blue theme palette. All components use smooth shimmer animations with CSS gradients for a modern, polished feel.

## Features

- ✨ **Beautiful Shimmer Animations** - Smooth gradient-based shimmer effects
- 🎨 **Ocean Blue Theme** - Matches AI Mastery's color palette (`#e2eef4`, `#f0f7fa`)
- 📱 **Responsive** - Adapts to different screen sizes
- ⚡ **Performance Optimized** - Pure CSS animations, no JavaScript overhead
- 🎯 **Type-Safe** - Full TypeScript support with props validation
- 🔤 **i18n Ready** - Translation-ready text placeholders

## Component Library

### Core Components

#### 1. `Skeleton` (Base)
```tsx
import { Skeleton } from "@/components/common/Skeleton";

// Basic skeleton
<Skeleton className="h-10 w-full rounded-lg" />

// Variants
<Skeleton variant="pulse" />        // Pulse effect
<Skeleton variant="shimmer" />      // Shimmer effect (default)
<Skeleton variant="bounce" />       // Bounce effect  
<Skeleton variant="fade" />         // Fade effect
```

#### 2. `SkeletonText`
```tsx
import { SkeletonText } from "@/components/common/Skeleton";

// Default: 3 lines of varying widths
<SkeletonText />

// Custom lines count
<SkeletonText lines={5} />

// Custom classes
<SkeletonText lines={2} className="w-3/4" />
```

#### 3. `SkeletonAvatar`
```tsx
import { SkeletonAvatar } from "@/components/common/Skeleton";

// Sizes: xs, sm, md, lg, xl
<SkeletonAvatar size="md" />
```

#### 4. `SkeletonCard`
```tsx
import { SkeletonCard } from "@/components/common/Skeleton";

// Complete card with all elements
<SkeletonCard 
  title={true}
  description={true}
  image={true}
  buttons={true}
/>

// Customize what's shown
<SkeletonCard 
  title={true}
  description={false}
  image={false}
/>
```

#### 5. `SkeletonList`
```tsx
import { SkeletonList } from "@/components/common/Skeleton";

// Default: 5 cards with staggered animation
<SkeletonList />

// Custom length
<SkeletonList itemLength={10} />
```

#### 6. `SkeletonTable`
```tsx
import { SkeletonTable } from "@/components/common/Skeleton";

// Default: 5 rows x 4 columns
<SkeletonTable />

// Custom configuration
<SkeletonTable 
  rows={10}
  columns={6}
  hasActions={true}
/>
```

#### 7. `SkeletonOverlay`
```tsx
import { SkeletonOverlay } from "@/components/common/Skeleton";

// Full-screen overlay with spinner and message
<SkeletonOverlay fullScreen={true} />

// Inline overlay
<SkeletonOverlay showContentBehind={true} />
```

#### 8. `SkeletonButton` & `SkeletonInput`
```tsx
import { SkeletonButton, SkeletonInput } from "@/components/common/Skeleton";

<SkeletonButton fullWidth={true} />
<SkeletonInput label={true} placeholder={true} />
```

### Specialized Views

#### 1. `ChatLoadingView`
Beautiful chat conversation loading state with animated messages.

```tsx
import { ChatLoadingView } from "@/components/chat/ChatLoadingView";

<ChatLoadingView className="h-full" />
```

Features:
- Animated user and AI messages
- Typing indicators
- Code block placeholders
- Action button skeletons

#### 2. `SettingsLoadingView` (Coming soon)
Comprehensive settings page loading layout.

#### 3. `KnowledgeLoadingView` (Coming soon)
Knowledge base file browser loading state.

### Utility Components

#### `LoadingPage`
Universal page-level loading wrapper.

```tsx
import { LoadingPage } from "@/components/common/LoadingPage";

<LoadingPage 
  fullScreen={true}
  title="Preparing your workspace..."
  description="This may take a moment."
/>
```

#### `LoadingIndicator`
Small inline loading indicators.

```tsx
import { LoadingIndicator } from "@/components/common/LoadingPage";

// Different variants
<LoadingIndicator size="md" variant="spin" label="Loading..." />
<LoadingIndicator variant="pulse" />
<LoadingIndicator variant="dots" />
```

## Usage Examples

### Example 1: Page-Level Loading
```tsx
import { LoadingPage } from "@/components/common/LoadingPage";

export function MyPage() {
  const [loading] = useState(true);
  
  if (loading) {
    return <LoadingPage title="Loading content..." />;
  }
  
  return <Content />;
}
```

### Example 2: List Loading
```tsx
import { SkeletonList } from "@/components/common/Skeleton";

export function MyList() {
  const [loading, items] = useAsyncState([]);
  
  return (
    <div>
      {loading ? (
        <SkeletonList itemLength={5} />
      ) : (
        <div className="space-y-4">
          {items.map(item => <Item key={item.id} data={item} />)}
        </div>
      )}
    </div>
  );
}
```

### Example 3: Form Loading
```tsx
import { SkeletonInput, SkeletonButton } from "@/components/common/Skeleton";

export function LoginForm() {
  const [loading, handleSubmit] = useFormState();
  
  return (
    <form onSubmit={handleSubmit}>
      {loading ? (
        <>
          <SkeletonInput label={true} placeholder={true} />
          <SkeletonInput label={true} />
          <SkeletonButton />
        </>
      ) : (
        <LoginFormFields />
      )}
    </form>
  );
}
```

### Example 4: Conversation Loading
```tsx
import { ChatLoadingView } from "@/components/chat/ChatLoadingView";

export function ChatWorkspace() {
  const [conversation, loadConversation] = useConversation(id);
  
  if (!conversation) {
    return <ChatLoadingView />;
  }
  
  return <ChatView conversation={conversation} />;
}
```

## Animation Classes

Custom CSS animations are available in `globals.css`:

### Shimmer Effect
```css
.animate-loading-skeleton
/* Smooth left-to-right shimmer gradient */
```

### Spin Slow
```css
.animate-spin-slow
/* Slow rotating spinner (3s) */
```

### Pulse Soft
```css
.animate-pulse-soft
/* Gentle opacity pulse (2s) */
```

### Fade In Up
```css
.animate-fade-in-up
/* Slide up with fade-in entrance */
```

### Animation Delays
Helper classes for staggered animations:
```css
.animate-delay-50    /* 50ms */
.animate-delay-100   /* 100ms */
.animate-delay-150   /* 150ms */
/* ... up to animate-delay-500 */
```

## Styling Guidelines

### Color Palette
All skeletons use the ocean-blue theme:
- Primary gradient: `from-[#e2eef4] via-[#f0f7fa] to-[#e2eef4]`
- Background: `bg-muted` for fallback
- Shadow: Soft shadows for depth

### Timing & Easing
- Base animation duration: 2s ease-in-out infinite
- Delay increments: 50ms steps
- Enter animations: 400ms ease-out

### Responsive Design
All components use Tailwind utility classes and adapt automatically:
- Mobile-first approach
- Container-aware sizing
- Flex/Grid layouts

## Performance

### Best Practices
1. **Use proper loading states**: Show skeletons before content loads
2. **Avoid flash of empty content**: Pre-render skeleton with SSR
3. **Keep animations light**: CSS-only for 60fps performance
4. **Stagger animations**: Use delay helpers for organic feel

### Common Patterns
```tsx
// Server-side rendering
export default async function Page() {
  const data = await loadData();
  
  return (
    <Suspense fallback={<LoadingPage />}>
      {data ? <Content data={data} /> : null}
    </Suspense>
  );
}

// Client-side lazy loading
function useLoader<T>(loader: () => Promise<T>) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<T | null>(null);
  
  useEffect(() => {
    loader().then(result => {
      setData(result);
      setLoading(false);
    });
  }, []);
  
  return { loading, data };
}
```

## Integration with Existing Components

### Replacing Simple Loading Spins
```tsx
// Before
<div className="animate-spin"><Loader2 /></div>

// After
<Skeleton className="h-8 w-8 rounded-lg animate-shimmer" />
```

### Replacing Text Loaders
```tsx
// Before
<p>Loading...</p>

// After
<SkeletonText lines={1} className="w-24 h-5" />
```

## Troubleshooting

### Issue: Skeleton appears too bright
**Solution**: Add opacity modifier or reduce gradient brightness:
```tsx
<Skeleton className="opacity-70" />
```

### Issue: Animation too fast
**Solution**: Adjust animation duration in globals.css:
```css
@keyframes loading-skeleton {
  animation-duration: 2.5s; /* Increase from 2s */
}
```

### Issue: Staggered animations not working
**Solution**: Ensure delay classes are applied correctly:
```tsx
className={`delay-${(i + 1) * 50}`}
```

## Future Enhancements

Planned improvements:
- [ ] Settings page skeleton
- [ ] Knowledge base file list skeleton
- [ ] Workspace picker skeleton
- [ ] Tool/library picker skeletons
- [ ] Dark mode optimized skeletons
- [ ] Reduced motion preferences support

## Credits

Created with care for AI Mastery's beautiful user experience. The shimmer pattern was inspired by modern design systems like Material UI and Ant Design.

---

*For questions or contributions, see the main AI Mastery repository.*
