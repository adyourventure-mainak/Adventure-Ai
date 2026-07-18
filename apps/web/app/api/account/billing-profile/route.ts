import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@adventure/db";
import { gstinStateCode } from "@adventure/core";
import { getUser } from "@/lib/auth";

const Input = z.object({
  billingName: z.string().max(200).optional().or(z.literal("")),
  billingGstin: z.string().max(20).optional().or(z.literal("")),
  billingPhone: z.string().max(20),
  billingAddress: z.string().max(1000).optional().or(z.literal("")),
  shippingAddress: z.string().max(1000).optional().or(z.literal("")),
});

/** Save the owner's GST billing profile, used to issue tax invoices. */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = Input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const gstin = parsed.data.billingGstin?.trim().toUpperCase() || null;
  if (gstin && !gstinStateCode(gstin)) {
    return NextResponse.json(
      { error: "That GSTIN doesn't look valid (15 chars, e.g. 22AAAAA0000A1Z5). Leave blank if you don't have one." },
      { status: 400 },
    );
  }

  // Contact number is required, with country code so it's unambiguous.
  const phoneRaw = parsed.data.billingPhone.trim();
  if (!phoneRaw.startsWith("+")) {
    return NextResponse.json(
      { error: "Enter a contact number starting with the country code, e.g. +91 98765 43210." },
      { status: 400 },
    );
  }
  const phone = phoneRaw.replace(/[^\d+]/g, "");
  if (phone.replace(/\D/g, "").length < 8) {
    return NextResponse.json({ error: "That contact number looks too short." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      billingName: parsed.data.billingName?.trim() || null,
      billingGstin: gstin,
      billingPhone: phone,
      billingAddress: parsed.data.billingAddress?.trim() || null,
      shippingAddress: parsed.data.shippingAddress?.trim() || null,
    },
  });
  return NextResponse.json({ ok: true });
}
