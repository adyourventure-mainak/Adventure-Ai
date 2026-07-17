"use client";

import { Button } from "@/components/ui";

/** Triggers the browser print dialog — users "Save as PDF" from there. */
export function PrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      Print / save PDF
    </Button>
  );
}
