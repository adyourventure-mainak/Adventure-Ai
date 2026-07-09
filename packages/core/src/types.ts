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
  design: z
    .object({
      accentColor: z.string().describe("Primary brand hex color that fits this business, e.g. #2563eb"),
      accentDarkColor: z.string().describe("A darker shade of the accent for hovers/gradients, e.g. #1e40af"),
      fontFamily: z
        .enum(["sans", "serif", "rounded", "mono"])
        .describe("Typography vibe: sans=modern, serif=premium/editorial, rounded=friendly, mono=technical"),
      style: z
        .enum(["minimal", "bold", "playful", "elegant", "corporate"])
        .describe("Overall visual style that matches the brand"),
    })
    .describe("Site design tokens chosen to fit this specific company"),
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
  // WhatsApp contact number for the generated site (optional). Loosely
  // validated here; the API normalizes to E.164.
  phone: z.string().max(20).optional(),
  // DPDP: explicit consent to store & display the phone number. Required
  // when a phone is provided; the API stamps Company.phoneConsentAt.
  phoneConsent: z.boolean().default(false),
});

/** Design tokens type (from CompanyFoundationSchema.design), stored on Company.theme. */
export type CompanyTheme = CompanyFoundation["design"] & {
  /** Owner's website design suggestions (up to 5), collected after onboarding. */
  suggestions?: string[];
  /** Owner-uploaded images to feature on the site (public URLs). */
  imageUrls?: string[];
};
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

/** Business audit for an existing business with a website: market research,
 *  SWOT, product/service scope, and a growth implementation plan. */
export const BusinessAuditReportSchema = z.object({
  businessSummary: z.string().describe("What this business does, in 2-3 sentences"),
  marketResearch: z.object({
    industryOverview: z.string(),
    marketSizeAndGrowth: z.string().describe("Realistic figures with India context where relevant"),
    keyTrends: z.array(z.string()).min(3).max(6),
    targetSegments: z
      .array(z.object({ name: z.string(), description: z.string(), whyTheyBuy: z.string() }))
      .min(2)
      .max(4),
    competitiveLandscape: z.string().describe("Who they compete with and how the market is shifting"),
    namedCompetitors: z
      .array(
        z.object({
          name: z.string().describe("Real competitor brand/company name — no placeholders"),
          scope: z.enum(["LOCAL", "GLOBAL"]),
          marketStrengths: z.array(z.string()).min(2).max(4),
        }),
      )
      .min(3)
      .max(8)
      .describe("Named local (India/regional) and global competitors"),
  }),
  swot: z.object({
    strengths: z.array(z.string()).min(3).max(6),
    weaknesses: z.array(z.string()).min(3).max(6),
    opportunities: z.array(z.string()).min(3).max(6),
    threats: z.array(z.string()).min(3).max(6),
  }),
  scope: z
    .array(
      z.object({
        offering: z.string().describe("The product or service"),
        currentPosition: z.string(),
        expansionOpportunities: z.array(z.string()).min(2).max(4),
        risks: z.array(z.string()).min(1).max(3),
      }),
    )
    .min(1)
    .max(5)
    .describe("Scope assessment per product/service"),
  implementationPlan: z.object({
    executiveSummary: z.string().describe("The senior marketing executive's overall recommendation"),
    quickWins: z.array(z.string()).min(3).max(5).describe("Do these in the first 2 weeks"),
    phases: z
      .array(
        z.object({
          phase: z.string().describe('e.g. "Month 1: Foundation"'),
          objective: z.string(),
          actions: z.array(z.string()).min(3).max(6),
          expectedOutcome: z.string(),
        }),
      )
      .min(3)
      .max(4),
    kpis: z.array(z.object({ metric: z.string(), target: z.string() })).min(3).max(6),
  }),
});
export type BusinessAuditReport = z.infer<typeof BusinessAuditReportSchema>;
