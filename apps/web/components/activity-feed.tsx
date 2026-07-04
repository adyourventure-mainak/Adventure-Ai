"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui";

export interface FeedItem {
  id: string;
  agent: string;
  action: string;
  createdAt: string;
  tokens: number;
}

/** Live activity feed: seeds from server-rendered history, then tails SSE. */
export function ActivityFeed({ slug, initial }: { slug: string; initial: FeedItem[] }) {
  const [items, setItems] = useState<FeedItem[]>(initial);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const es = new EventSource(`/api/activity/stream?slug=${encodeURIComponent(slug)}`);
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = (e) => {
      const item = JSON.parse(e.data) as FeedItem;
      setItems((prev) =>
        prev.some((p) => p.id === item.id) ? prev : [item, ...prev].slice(0, 50),
      );
    };
    return () => es.close();
  }, [slug]);

  return (
    <div>
      <div className="flex items-center justify-between border-b border-ink-800 px-6 py-4">
        <h2 className="font-semibold">Activity</h2>
        <Badge variant={live ? "success" : "outline"}>{live ? "● live" : "connecting…"}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="px-6 py-8 text-sm text-ink-400">No activity yet.</p>
      ) : (
        <ul className="divide-y divide-ink-800">
          {items.map((log) => (
            <li key={log.id} className="flex items-start gap-4 px-6 py-3 text-sm">
              <Badge variant="outline" className="mt-0.5 w-28 shrink-0 justify-center">
                {log.agent}
              </Badge>
              <div className="flex-1">
                <p className="text-ink-100">{log.action}</p>
                <p className="mt-0.5 text-xs text-ink-400">
                  {new Date(log.createdAt).toLocaleString("en-IN")}
                  {log.tokens > 0 && ` · ${log.tokens} tokens`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
