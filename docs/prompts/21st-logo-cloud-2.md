# 21st.dev — Logo Cloud 2 (@efferd)

- **Source URL:** `https://21st.dev/community/components/s/hook?preview=%2F%40efferd%2Fcomponents%2Flogo-cloud-2`
- **Canonical URL:** `https://21st.dev/@efferd/components/logo-cloud-2`
- **Author:** Efferd (`@efferd`)
- **Demo ID:** 9301
- **Component ID:** `logo-cloud-2`
- **Dependencies:** `lucide-react`, `clsx`, `tailwind-merge`

---

## AI Prompt (Cursor / Claude Code / v0 / ChatGPT)

```markdown
Create a responsive Logo Cloud component in React with Tailwind CSS called `LogoCloud`.

Requirements:
1. Component structure:
   - A grid layout: 2 columns on mobile (`grid-cols-2`), 4 columns on medium/large screens (`md:grid-cols-4`).
   - Border lines between cards with full-width top and bottom bleed borders (`w-screen`).
   - Cards alternating with subtle secondary background colors (`bg-secondary`, `dark:bg-secondary/30`).
   - Corner accent plus marks using the `Plus` icon from `lucide-react` positioned with negative absolute offsets (`-right-[12.5px] -bottom-[12.5px]`).
   - Logos should support dark mode using `dark:brightness-0 dark:invert`.
2. Company logos included:
   - Nvidia (`https://cdn.21st.dev/assets/mirror/bd/bdf5f3ae72bcfda892a686c03b7932985c694e9a9828643c980601bbc9e53cb4.svg`)
   - Supabase (`https://cdn.21st.dev/assets/mirror/31/319eeae853dd1af99d442b6c16b6c38dc52a66a719f8e502c65f85d26255cbd3.svg`)
   - GitHub (`https://cdn.21st.dev/assets/mirror/90/90f01a9537335666282ae5acc80bd4305f86d085a92d60904c3aa3ccc4414570.svg`)
   - OpenAI (`https://cdn.21st.dev/assets/mirror/2b/2bcdd4124223e3bf8e66bc08ce0ac32a6cc42ffe3584bbecfd377847176a188d.svg`)
   - Turso (`https://cdn.21st.dev/assets/mirror/fc/fc7b090ebcfc468d24a1dc482b2db1fcbfd99ca14568552a30ce553d6dda7fcb.svg`)
   - Clerk (`https://cdn.21st.dev/assets/mirror/96/96517bce3574d648280ff639d01d9889f354b488b3f826db5df746d730232a0c.svg`)
   - Claude AI (`https://cdn.21st.dev/assets/mirror/e8/e8514b1206f79e1abdafcc1d2632393cc7cfbcbbe25426ac5143b17b184b56b8.svg`)
   - Vercel (`https://cdn.21st.dev/assets/mirror/56/5624b7c243ac8d60e848fb5ea222ec932c1600df54a2762238b37498372fb0c8.svg`)
3. Demo page:
   - Centered section with title: "Companies we collaborate with." with "collaborate" highlighted in `text-primary`.
```

---

## Component Code (`src/components/ui/logo-cloud-2.tsx`)

```tsx
import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoCardProps extends React.ComponentProps<"div"> {
  logo: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
  };
}

function LogoCard({ logo, className, children, ...props }: LogoCardProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-background px-4 py-8 md:p-8",
        className
      )}
      {...props}
    >
      <img
        alt={logo.alt}
        className="pointer-events-none h-4 select-none md:h-5 dark:brightness-0 dark:invert"
        height={logo.height || "auto"}
        src={logo.src}
        width={logo.width || "auto"}
      />
      {children}
    </div>
  );
}

export function LogoCloud({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative grid grid-cols-2 border-x md:grid-cols-4",
        className
      )}
      {...props}
    >
      <div className="-translate-x-1/2 -top-px pointer-events-none absolute left-1/2 w-screen border-t" />
      <LogoCard
        className="relative border-r border-b bg-secondary dark:bg-secondary/30"
        logo={{
          src: "https://cdn.21st.dev/assets/mirror/bd/bdf5f3ae72bcfda892a686c03b7932985c694e9a9828643c980601bbc9e53cb4.svg",
          alt: "Nvidia Logo",
        }}
      >
        <Plus className="-right-[12.5px] -bottom-[12.5px] absolute z-10 size-6" strokeWidth={1} />
      </LogoCard>
      <LogoCard
        className="border-b md:border-r"
        logo={{
          src: "https://cdn.21st.dev/assets/mirror/31/319eeae853dd1af99d442b6c16b6c38dc52a66a719f8e502c65f85d26255cbd3.svg",
          alt: "Supabase Logo",
        }}
      />
      <LogoCard
        className="relative border-r border-b md:bg-secondary dark:md:bg-secondary/30"
        logo={{
          src: "https://cdn.21st.dev/assets/mirror/90/90f01a9537335666282ae5acc80bd4305f86d085a92d60904c3aa3ccc4414570.svg",
          alt: "GitHub Logo",
        }}
      >
        <Plus className="-right-[12.5px] -bottom-[12.5px] absolute z-10 size-6" strokeWidth={1} />
        <Plus className="-bottom-[12.5px] -left-[12.5px] absolute z-10 hidden size-6 md:block" strokeWidth={1} />
      </LogoCard>
      <LogoCard
        className="relative border-b bg-secondary md:bg-background dark:bg-secondary/30 md:dark:bg-background"
        logo={{
          src: "https://cdn.21st.dev/assets/mirror/2b/2bcdd4124223e3bf8e66bc08ce0ac32a6cc42ffe3584bbecfd377847176a188d.svg",
          alt: "OpenAI Logo",
        }}
      />
      <LogoCard
        className="relative border-r border-b bg-secondary md:border-b-0 md:bg-background dark:bg-secondary/30 md:dark:bg-background"
        logo={{
          src: "https://cdn.21st.dev/assets/mirror/fc/fc7b090ebcfc468d24a1dc482b2db1fcbfd99ca14568552a30ce553d6dda7fcb.svg",
          alt: "Turso Logo",
        }}
      >
        <Plus className="-right-[12.5px] -bottom-[12.5px] md:-left-[12.5px] absolute z-10 size-6 md:hidden" strokeWidth={1} />
      </LogoCard>
      <LogoCard
        className="border-b bg-background md:border-r md:border-b-0 md:bg-secondary dark:md:bg-secondary/30"
        logo={{
          src: "https://cdn.21st.dev/assets/mirror/96/96517bce3574d648280ff639d01d9889f354b488b3f826db5df746d730232a0c.svg",
          alt: "Clerk Logo",
        }}
      />
      <LogoCard
        className="border-r"
        logo={{
          src: "https://cdn.21st.dev/assets/mirror/e8/e8514b1206f79e1abdafcc1d2632393cc7cfbcbbe25426ac5143b17b184b56b8.svg",
          alt: "Claude AI Logo",
        }}
      />
      <LogoCard
        className="bg-secondary dark:bg-secondary/30"
        logo={{
          src: "https://cdn.21st.dev/assets/mirror/56/5624b7c243ac8d60e848fb5ea222ec932c1600df54a2762238b37498372fb0c8.svg",
          alt: "Vercel Logo",
        }}
      />
      <div className="-translate-x-1/2 -bottom-px pointer-events-none absolute left-1/2 w-screen border-b" />
    </div>
  );
}
```

---

## Demo Usage (`src/components/demo/logo-cloud-demo.tsx`)

```tsx
import { LogoCloud } from "@/components/ui/logo-cloud-2";

export default function DemoLogoCloud() {
  return (
    <div className="min-h-screen w-full place-content-center px-4 py-16">
      <section className="relative mx-auto grid max-w-3xl">
        <h2 className="mb-6 text-center font-medium text-lg text-muted-foreground tracking-tight md:text-2xl">
          Companies we{" "}
          <span className="font-semibold text-primary">collaborate</span> with.
        </h2>

        <LogoCloud />
      </section>
    </div>
  );
}
```
