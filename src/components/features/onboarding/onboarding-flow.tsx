"use client";

import * as React from "react";
import { useActionState } from "react";
import { motion } from "motion/react";
import {
  BriefcaseBusiness,
  Check,
  Compass,
  GraduationCap,
  Sparkles,
  Target,
} from "lucide-react";
import { completeOnboardingAction } from "@/actions/onboarding";
import type { OnboardingFormState } from "@/lib/onboarding/types-form";
import {
  BACKGROUNDS,
  EXPERIENCE_LEVELS,
  GOALS,
  INTERESTS,
  LABELS,
  MAX_INTERESTS,
  WEEKLY_HOURS_OPTIONS,
  WORK_PREFERENCES,
  type Background,
  type ExperienceLevel,
  type Goal,
  type Interest,
  type OnboardingProfile,
  type WorkPreference,
} from "@/lib/onboarding/types";
import { cn } from "@/lib/utils";
import { OnboardingStepCard } from "@/components/ui/onboarding-step-card";
import { Button } from "@/components/ui/button";

/**
 * Three-step personalization wizard.
 *
 * State lives in one object so the final submit can serialize the whole profile
 * into a single FormData payload for the server action — no partial writes, no
 * client-side persistence that could drift from the signed cookie.
 */

const initialState: OnboardingFormState = { ok: false };

const STEP_META = [
  {
    title: "Latar belakangmu",
    subtitle: "Biar kami tahu titik awalmu dan menyusun materi yang pas.",
    icon: <GraduationCap className="size-5" />,
    hero: "/onboarding/hero-learn.jpg",
  },
  {
    title: "Apa yang mau kamu kuasai?",
    subtitle: "Pilih 1–3 bidang. Ini menentukan rekomendasi kursus dan loker.",
    icon: <Compass className="size-5" />,
    hero: "/onboarding/hero-code.jpg",
  },
  {
    title: "Tujuan & komitmen",
    subtitle: "Terakhir, supaya rekomendasi loker dan jadwal belajar realistis.",
    icon: <Target className="size-5" />,
    hero: "/onboarding/hero-team.jpg",
  },
] as const;

interface ProfileDraft {
  experience: ExperienceLevel | null;
  background: Background | null;
  interests: Interest[];
  goal: Goal | null;
  weeklyHours: number | null;
  workPreference: WorkPreference | null;
}

const emptyDraft: ProfileDraft = {
  experience: null,
  background: null,
  interests: [],
  goal: null,
  weeklyHours: null,
  workPreference: null,
};

export function OnboardingFlow({
  nama,
  initial,
}: {
  nama: string;
  initial?: OnboardingProfile;
}) {
  const [state, formAction, pending] = useActionState(
    completeOnboardingAction,
    initialState,
  );
  const [step, setStep] = React.useState(0);
  const [draft, setDraft] = React.useState<ProfileDraft>(() =>
    initial
      ? {
          experience: initial.experience,
          background: initial.background,
          interests: initial.interests,
          goal: initial.goal as Goal,
          weeklyHours: initial.weeklyHours,
          workPreference: initial.workPreference,
        }
      : emptyDraft,
  );

  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const toggleInterest = (interest: Interest) => {
    setDraft((prev) => {
      const has = prev.interests.includes(interest);
      if (has) {
        return { ...prev, interests: prev.interests.filter((i) => i !== interest) };
      }
      if (prev.interests.length >= MAX_INTERESTS) return prev;
      return { ...prev, interests: [...prev.interests, interest] };
    });
  };

  const stepValid = [
    draft.experience !== null && draft.background !== null,
    draft.interests.length >= 1,
    draft.goal !== null && draft.weeklyHours !== null && draft.workPreference !== null,
  ][step];

  const meta = STEP_META[step];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (step < STEP_META.length - 1) {
      e.preventDefault();
      if (stepValid) setStep((s) => s + 1);
      return;
    }
    // Final step: let the action run.
  };

  return (
    <form action={formAction} onSubmit={handleSubmit} className="w-full max-w-xl">
      {/* Serialized payload — single source of truth for the server action. */}
      <input type="hidden" name="experience" value={draft.experience ?? ""} />
      <input type="hidden" name="background" value={draft.background ?? ""} />
      <input type="hidden" name="goal" value={draft.goal ?? ""} />
      <input type="hidden" name="weeklyHours" value={draft.weeklyHours ?? ""} />
      <input type="hidden" name="workPreference" value={draft.workPreference ?? ""} />
      {draft.interests.map((interest) => (
        <input key={interest} type="hidden" name="interests" value={interest} />
      ))}

      <OnboardingStepCard
        heroImageSrc={meta.hero}
        icon={meta.icon}
        title={meta.title}
        subtitle={step === 0 ? `Halo ${nama}, ${meta.subtitle}` : meta.subtitle}
        step={step + 1}
        totalSteps={STEP_META.length}
        footer={
          <>
            {step > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => setStep((s) => s - 1)}
                disabled={pending}
              >
                Kembali
              </Button>
            ) : null}
            <Button
              type="submit"
              size="lg"
              className="ms-auto"
              disabled={!stepValid || pending}
            >
              {step < STEP_META.length - 1 ? (
                <>
                  Lanjut
                  <Sparkles className="size-4" />
                </>
              ) : (
                <>{pending ? "Menyimpan..." : "Mulai belajar"}</>
              )}
            </Button>
          </>
        }
      >
        {state.message ? (
          <p
            className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {state.message}
          </p>
        ) : null}

        {step === 0 ? (
          <StepBackground draft={draft} set={set} />
        ) : step === 1 ? (
          <StepInterests draft={draft} toggle={toggleInterest} />
        ) : (
          <StepGoals draft={draft} set={set} />
        )}
      </OnboardingStepCard>
    </form>
  );
}

/* ----------------------------- step primitives ---------------------------- */

function FieldLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-sm font-medium text-foreground/80", className)}>{children}</p>
  );
}

function OptionGrid<T extends string>({
  options,
  selected,
  onSelect,
  labels,
  columns = 2,
}: {
  options: readonly T[];
  selected: T | null;
  onSelect: (value: T) => void;
  labels: Record<T, string>;
  columns?: 2 | 3;
}) {
  return (
    <div className={cn("grid gap-2", columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
      {options.map((option) => {
        const active = selected === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            aria-pressed={active}
            className={cn(
              "flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors",
              active
                ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30"
                : "border-input bg-background text-foreground/80 hover:border-primary/40 hover:bg-accent/40",
            )}
          >
            <span>{labels[option]}</span>
            {active ? <Check className="size-4 text-primary" /> : null}
          </button>
        );
      })}
    </div>
  );
}

function StepBackground({
  draft,
  set,
}: {
  draft: ProfileDraft;
  set: <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => void;
}) {
  return (
    <>
      <div className="grid gap-3">
        <FieldLabel>Seberapa jauh pengalamanmu?</FieldLabel>
        <OptionGrid
          options={EXPERIENCE_LEVELS}
          selected={draft.experience}
          onSelect={(v) => set("experience", v)}
          labels={LABELS.experience}
        />
      </div>
      <div className="grid gap-3">
        <FieldLabel>Saat ini kamu...</FieldLabel>
        <OptionGrid
          options={BACKGROUNDS}
          selected={draft.background}
          onSelect={(v) => set("background", v)}
          labels={LABELS.background}
          columns={3}
        />
      </div>
    </>
  );
}

function StepInterests({
  draft,
  toggle,
}: {
  draft: ProfileDraft;
  toggle: (interest: Interest) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <FieldLabel>Bidang yang diminati</FieldLabel>
        <span className="text-xs text-muted-foreground tabular-nums">
          {draft.interests.length}/{MAX_INTERESTS} dipilih
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {INTERESTS.map((interest) => {
          const active = draft.interests.includes(interest);
          return (
            <motion.button
              key={interest}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => toggle(interest)}
              aria-pressed={active}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors",
                active
                  ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30"
                  : "border-input bg-background text-foreground/80 hover:border-primary/40 hover:bg-accent/40",
              )}
            >
              <span>{LABELS.interest[interest]}</span>
              {active ? <Check className="size-4 text-primary" /> : null}
            </motion.button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Rekomendasi kursus &amp; loker akan difokuskan ke pilihanmu.
      </p>
    </div>
  );
}

function StepGoals({
  draft,
  set,
}: {
  draft: ProfileDraft;
  set: <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => void;
}) {
  return (
    <>
      <div className="grid gap-3">
        <FieldLabel>Tujuan utamamu</FieldLabel>
        <OptionGrid
          options={GOALS}
          selected={draft.goal}
          onSelect={(v) => set("goal", v)}
          labels={LABELS.goal}
        />
      </div>

      <div className="grid gap-3">
        <FieldLabel>Waktu belajar per minggu</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {WEEKLY_HOURS_OPTIONS.map((hours) => {
            const active = draft.weeklyHours === hours;
            return (
              <button
                key={hours}
                type="button"
                onClick={() => set("weeklyHours", hours)}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-foreground/80 hover:border-primary/40",
                )}
              >
                {hours} jam
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3">
        <FieldLabel className="flex items-center gap-2">
          <BriefcaseBusiness className="size-4 text-muted-foreground" />
          Preferensi kerja
        </FieldLabel>
        <OptionGrid
          options={WORK_PREFERENCES}
          selected={draft.workPreference}
          onSelect={(v) => set("workPreference", v)}
          labels={LABELS.workPreference}
        />
      </div>
    </>
  );
}
