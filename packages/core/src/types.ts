import { z } from "zod";

/** Landing page copy — stored as LandingPage.copy and edited by the Engineer agent. */
export const LandingCopySchema = z.object({
  heroHeadline: z.string(),
  heroSubheadline: z.string(),
  cta: z.string(),
  features: z
    .array(z.object({ title: z.string(), description: z.string() }))
    .min(3)
    .max(4),
  faq: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .min(3)
    .max(5),
});
export type LandingCopy = z.infer<typeof LandingCopySchema>;

/** Structured output schema for onboarding company generation. */
export const CompanyFoundationSchema = z.object({
  companyName: z.string().describe("Short, brandable company name"),
  tagline: z.string(),
  ideaSummary: z.string().describe("2-3 sentence summary of the business idea"),
  positioning: z
    .string()
    .describe("Who the target customer is, the problem, and why this wins"),
  brandVoice: z.string().describe("2-3 adjectives + a sentence on tone"),
  landingCopy: LandingCopySchema,
  thirtyDayPlan: z
    .array(
      z.object({
        week: z.number().int().min(1).max(5),
        title: z.string(),
        tasks: z.array(z.string()).min(2).max(6),
      }),
    )
    .min(4)
    .max(5),
});

export type CompanyFoundation = z.infer<typeof CompanyFoundationSchema>;

export const CreateCompanyInput = z.object({
  idea: z.string().max(2000).optional(),
  surprise: z.boolean().default(false),
});
export type CreateCompanyInput = z.infer<typeof CreateCompanyInput>;
