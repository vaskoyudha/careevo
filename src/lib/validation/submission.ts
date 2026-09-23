import { z } from "zod";

export const promptEntrySchema = z.object({
  tool: z.string().trim().min(1).max(60),
  purpose: z.string().trim().min(1).max(280),
});

export const pasteEventSchema = z.object({
  length: z.number().int().min(50),
});

export const submissionSchema = z.object({
  task_id: z.uuid(),
  version: z.number().int().min(1),
  files: z.array(z.string().trim().min(1)).min(1).max(20),
});

export type PromptEntryInput = z.infer<typeof promptEntrySchema>;
export type SubmissionInput = z.infer<typeof submissionSchema>;
