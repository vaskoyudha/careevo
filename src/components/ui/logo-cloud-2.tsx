/* eslint-disable @next/next/no-img-element */
import { PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Logo = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
};

export type LogoCloudProps = React.ComponentProps<"div">;

export function LogoCloud({ className, ...props }: LogoCloudProps) {
  return (
    <div
      className={cn(
        "relative grid grid-cols-2 border-x border-neutral-200 dark:border-neutral-800 md:grid-cols-4",
        className
      )}
      {...props}
    >
      <div className="-translate-x-1/2 -top-px pointer-events-none absolute left-1/2 w-screen border-t border-neutral-200 dark:border-neutral-800" />

      <LogoCard
        className="relative border-r border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40"
        logo={{
          src: "https://cdn.21st.dev/assets/mirror/bd/bdf5f3ae72bcfda892a686c03b7932985c694e9a9828643c980601bbc9e53cb4.svg",
          alt: "Nvidia Logo",
        }}
      >
        <PlusIcon
          className="-right-[12.5px] -bottom-[12.5px] absolute z-10 size-6 text-neutral-400 dark:text-neutral-600"
          strokeWidth={1}
        />
      </LogoCard>

      <LogoCard
        className="border-b border-neutral-200 dark:border-neutral-800 md:border-r"
        logo={{
          src: "https://cdn.21st.dev/assets/mirror/31/319eeae853dd1af99d442b6c16b6c38dc52a66a719f8e502c65f85d26255cbd3.svg",
          alt: "Supabase Logo",
        }}
      />

      <LogoCard
        className="relative border-r border-b border-neutral-200 dark:border-neutral-800 md:bg-neutral-50/70 dark:md:bg-neutral-900/40"
        logo={{
          src: "https://cdn.21st.dev/assets/mirror/90/90f01a9537335666282ae5acc80bd4305f86d085a92d60904c3aa3ccc4414570.svg",
          alt: "GitHub Logo",
        }}
      >
        <PlusIcon
          className="-right-[12.5px] -bottom-[12.5px] absolute z-10 size-6 text-neutral-400 dark:text-neutral-600"
          strokeWidth={1}
        />
        <PlusIcon
          className="-bottom-[12.5px] -left-[12.5px] absolute z-10 hidden size-6 text-neutral-400 dark:text-neutral-600 md:block"
          strokeWidth={1}
        />
      </LogoCard>

      <LogoCard
        className="relative border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 md:bg-background dark:bg-neutral-900/40 md:dark:bg-background"
        logo={{
          src: "https://cdn.21st.dev/assets/mirror/2b/2bcdd4124223e3bf8e66bc08ce0ac32a6cc42ffe3584bbecfd377847176a188d.svg",
          alt: "OpenAI Logo",
        }}
      />

      <LogoCard
        className="relative border-r border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 md:border-b-0 md:bg-background dark:bg-neutral-900/40 md:dark:bg-background"
        logo={{
          src: "https://cdn.21st.dev/assets/mirror/fc/fc7b090ebcfc468d24a1dc482b2db1fcbfd99ca14568552a30ce553d6dda7fcb.svg",
          alt: "Turso Logo",
        }}
      >
        <PlusIcon
          className="-right-[12.5px] -bottom-[12.5px] md:-left-[12.5px] absolute z-10 size-6 text-neutral-400 dark:text-neutral-600 md:hidden"
          strokeWidth={1}
        />
      </LogoCard>

      <LogoCard
        className="border-b border-neutral-200 dark:border-neutral-800 bg-background md:border-r md:border-b-0 md:bg-neutral-50/70 dark:md:bg-neutral-900/40"
        logo={{
          src: "https://cdn.21st.dev/assets/mirror/96/96517bce3574d648280ff639d01d9889f354b488b3f826db5df746d730232a0c.svg",
          alt: "Clerk Logo",
        }}
      />

      <LogoCard
        className="border-r border-neutral-200 dark:border-neutral-800"
        logo={{
          src: "https://cdn.21st.dev/assets/mirror/e8/e8514b1206f79e1abdafcc1d2632393cc7cfbcbbe25426ac5143b17b184b56b8.svg",
          alt: "Claude AI Logo",
        }}
      />

      <LogoCard
        className="bg-neutral-50/70 dark:bg-neutral-900/40"
        logo={{
          src: "https://cdn.21st.dev/assets/mirror/56/5624b7c243ac8d60e848fb5ea222ec932c1600df54a2762238b37498372fb0c8.svg",
          alt: "Vercel Logo",
        }}
      />

      <div className="-translate-x-1/2 -bottom-px pointer-events-none absolute left-1/2 w-screen border-b border-neutral-200 dark:border-neutral-800" />
    </div>
  );
}

export type LogoCardProps = React.ComponentProps<"div"> & {
  logo: Logo;
};

export function LogoCard({ logo, className, children, ...props }: LogoCardProps) {
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
