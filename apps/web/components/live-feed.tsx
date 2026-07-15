import { Badge } from "@/components/ui";

export type FeedItem = { id: string; agent: string; action: string; createdAt: Date };
export type LiveFeed = {
  items: FeedItem[];
  /** Newest event is recent enough to honestly call the feed "live". */
  fresh: boolean;
} | null;

// Public-facing names for the internal agent enum.
const AGENT_LABEL: Record<string, string> = {
  ORCHESTRATOR: "CEO",
  PLANNER: "Planner",
  ENGINEER: "Engineer",
  SOCIAL: "Social",
  EMAIL_OUTREACH: "Email",
  SUPPORT: "Support",
  ADS: "Ads",
  FINANCE: "Finance",
  RESEARCH: "Research",
};

function ago(then: Date): string {
  const mins = Math.max(0, Math.round((Date.now() - then.getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/**
 * Real activity pooled across every company the platform runs, anonymised —
 * agents write company names and deploy URLs into their own log lines, so the
 * caller scrubs those before anything reaches this list. Only isPublic events
 * are eligible: financials, drafts and customer conversations never are.
 */
export function LiveFeedList({ feed }: { feed: NonNullable<LiveFeed> }) {
  return (
    <ul className="divide-y divide-ink-800/70">
      {feed.items.map((item) => (
        <li key={item.id} className="flex items-start gap-3 px-5 py-3 text-sm">
          <Badge variant="outline" className="mt-0.5 w-20 shrink-0 justify-center text-xs">
            {AGENT_LABEL[item.agent] ?? item.agent}
          </Badge>
          <span className="min-w-0 flex-1 text-ink-100/90">{item.action}</span>
          <span className="mt-0.5 shrink-0 text-xs text-ink-600">{ago(item.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Sample activity — only ever rendered under an "example" label. */
export const EXAMPLE_FEED = [
  { agent: "CEO", action: "Wrote today's brief: focus on landing page conversion + outreach" },
  { agent: "Engineer", action: "Rewrote the landing page hero and pushed it live to the repo" },
  { agent: "Research", action: "Analyzed 3 competitors; found a pricing gap at the ₹999/mo tier" },
  { agent: "Email", action: "Drafted an outreach email to the target segment — ready in the inbox" },
  { agent: "Social", action: "Generated tomorrow's post: image, caption & tags — ready to share" },
  { agent: "Support", action: "Drafted a reply to a customer question using company memory" },
];

export function ExampleFeedList() {
  return (
    <ul className="divide-y divide-ink-800/70">
      {EXAMPLE_FEED.map((item, i) => (
        <li key={i} className="flex items-start gap-3 px-5 py-3 text-sm">
          <Badge variant="outline" className="mt-0.5 w-20 shrink-0 justify-center text-xs">
            {item.agent}
          </Badge>
          <span className="text-ink-100/90">{item.action}</span>
        </li>
      ))}
    </ul>
  );
}
