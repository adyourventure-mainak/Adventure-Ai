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

/** 30-day advertisement plan with segment & competitor research (paid tiers). */
export const AdPlanSchema = z.object({
  objective: z.string().describe("One-sentence goal for the 30 days"),
  segments: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().describe("Who they are and what they need"),
        painPoints: z.array(z.string()).min(2).max(4),
        channels: z.array(z.string()).min(1).max(4).describe("Where to reach them"),
      }),
    )
    .min(2)
    .max(4),
  competitors: z
    .array(
      z.object({
        name: z.string(),
        positioning: z.string(),
        strengths: z.array(z.string()).min(1).max(3),
        weaknesses: z.array(z.string()).min(1).max(3),
        counterAngle: z.string().describe("How our ads win against them"),
      }),
    )
    .min(2)
    .max(5),
  calendar: z
    .array(
      z.object({
        week: z.number().int().min(1).max(5),
        theme: z.string(),
        entries: z
          .array(
            z.object({
              days: z.string().describe('e.g. "Day 1-3"'),
              channel: z.string(),
              segment: z.string().describe("Which segment this targets"),
              concept: z.string().describe("The ad concept / creative angle"),
              cta: z.string(),
              budgetPercent: z.number().min(0).max(100),
            }),
          )
          .min(2)
          .max(5),
      }),
    )
    .min(4)
    .max(5),
  kpis: z.array(z.object({ metric: z.string(), target: z.string() })).min(3).max(6),
  budgetNote: z.string().describe("How to split and pace the monthly ad budget"),
});
export type AdPlan = z.infer<typeof AdPlanSchema>;
