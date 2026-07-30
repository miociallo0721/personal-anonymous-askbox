import { z } from "zod";

export const questionContentSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => Array.from(value).length >= 2, "问题至少需要 2 个字符")
  .refine((value) => Array.from(value).length <= 1000, "问题不能超过 1000 个字符");

export const submitQuestionSchema = z.object({
  content: questionContentSchema,
  turnstileToken: z.string().max(4096).default(""),
  website: z.string().max(500).default(""),
});

export const answerContentSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => Array.from(value).length >= 2, "回答至少需要 2 个字符")
  .refine((value) => Array.from(value).length <= 600, "回答不能超过 600 个字符");

export const loginSchema = z.object({ password: z.string().min(1).max(1024) });

export const idSchema = z.coerce.number().int().positive();
