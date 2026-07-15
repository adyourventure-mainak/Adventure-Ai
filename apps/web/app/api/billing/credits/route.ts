import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, grantCredits } from "@adventure/db";
import { CREDIT_PACKS } from "@adventure/core";
import * as razorpay from "@adventure/core/razorpay";
import { getUser } from "@/lib/auth";
import { billingTestMode } from "@/lib/billing";

const Input = z.object({
  slug: z.string(),
  credits: z.number().int(),
});

/**
 * Create a Razorpay Order for a credit pack. The webhook's payment.captured
 * handler grants the credits (notes.type = "credit_pack"), so a lost checkout
 * callback can't lose a purchase.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = Input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const pack = CREDIT_PACKS.find((p) => p.credits === parsed.data.credits);
  if (!pack) return NextResponse.json({ error: "Unknown credit pack" }, { status: 400 });

  const company = await prisma.company.findUnique({
    where: { slug: parsed.data.slug },
    select: { id: true, name: true, ownerId: true, planTier: true },
  });
  if (!company || company.ownerId !== user.id) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  if (company.planTier === "FREE") {
    return NextResponse.json({ error: "Credits are for paid plans — upgrade first." }, { status: 403 });
  }

  // Test-mode bypass: never active on the production deployment.
  if (billingTestMode()) {
    await grantCredits(
      company.id,
      pack.credits,
      `Credit pack (billing test mode — no charge, ${pack.credits} credits)`,
    );
    return NextResponse.json({ activated: true, credits: pack.credits, companyName: company.name });
  }

  const order = await razorpay.createOrder({
    amountPaise: pack.pricePaise,
    receipt: `credits-${company.id.slice(-12)}-${Date.now()}`,
    notes: {
      type: "credit_pack",
      companyId: company.id,
      credits: String(pack.credits),
    },
  });

  return NextResponse.json({
    orderId: order.id,
    amountPaise: pack.pricePaise,
    credits: pack.credits,
    companyName: company.name,
  });
}
