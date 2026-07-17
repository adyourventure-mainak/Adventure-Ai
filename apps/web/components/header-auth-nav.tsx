"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

/**
 * Right side of the marketing header. Checks the Supabase session in the
 * browser (keeps the marketing pages static) and swaps
 * "Sign in / Start free" for a Dashboard button when the visitor is
 * already logged in.
 */
export function HeaderAuthNav() {
  // null = unknown (first paint) — render the logged-out buttons meanwhile so
  // the header never appears empty.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabaseBrowser()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled) setSignedIn(Boolean(data.session));
      })
      .catch(() => {
        if (!cancelled) setSignedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (signedIn) {
    return (
      <Link href="/dashboard">
        <Button size="sm">Dashboard</Button>
      </Link>
    );
  }
  return (
    <>
      <Link href="/login" className="hover:text-white">Sign in</Link>
      <Link href="/login">
        <Button size="sm">Start free</Button>
      </Link>
    </>
  );
}
