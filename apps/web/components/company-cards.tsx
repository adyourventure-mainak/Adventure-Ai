"use client";

import { Building2, Rocket, PauseCircle, Clock } from "lucide-react";
import DisplayCards from "@/components/ui/display-cards";

export interface CompanyCardData {
  name: string;
  slug: string;
  status: string;
  planTier: string;
  positioning: string;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PROVISIONING: "Provisioning…",
  ACTIVE: "Agents running",
  PAUSED: "Paused",
  LAPSED: "Lapsed",
};

// Stacked offsets for up to three cards per stack (same rhythm as the
// component's defaults, plus the grayscale-until-hover treatment).
const STACK_CLASSES = [
  "[grid-area:stack] hover:-translate-y-10 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-ink-800 before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-ink-950/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0 cursor-pointer",
  "[grid-area:stack] translate-x-16 translate-y-10 hover:-translate-y-1 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-ink-800 before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-ink-950/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0 cursor-pointer",
  "[grid-area:stack] translate-x-32 translate-y-20 hover:translate-y-10 cursor-pointer",
];

function statusIcon(status: string) {
  const cls = "size-4 text-brand-400";
  if (status === "ACTIVE") return <Rocket className={cls} />;
  if (status === "PAUSED") return <PauseCircle className={cls} />;
  if (status === "PROVISIONING") return <Clock className={cls} />;
  return <Building2 className={cls} />;
}

export function CompanyCards({ companies }: { companies: CompanyCardData[] }) {
  // Chunk into stacks of three so any number of companies stays readable.
  const stacks: CompanyCardData[][] = [];
  for (let i = 0; i < companies.length; i += 3) stacks.push(companies.slice(i, i + 3));

  return (
    <div className="mt-10 space-y-24">
      {stacks.map((stack, s) => (
        <div key={s} className="flex justify-center pb-16 pr-0 sm:pr-32">
          <DisplayCards
            cards={stack.map((c, i) => ({
              icon: statusIcon(c.status),
              title: c.name,
              description: c.positioning || "Positioning in progress",
              date: `${c.planTier} · ${STATUS_LABEL[c.status] ?? c.status}`,
              iconClassName: "bg-brand-900",
              titleClassName: "text-brand-400",
              href: `/c/${c.slug}`,
              className: STACK_CLASSES[Math.min(i, STACK_CLASSES.length - 1)],
            }))}
          />
        </div>
      ))}
    </div>
  );
}
