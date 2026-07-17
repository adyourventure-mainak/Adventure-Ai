import { NextResponse } from "next/server";
import { Prisma, prisma, grantCredits, grantWelcomeCredits, recordRedemption, issueInvoice } from "@adventure/db";
import { PLANS, REVENUE_SHARE_PERCENT, TRIAL_DAYS, GST_PERCENT } from "@adventure/core";
import * as razorpay from "@adventure/core/razorpay";

// Razorpay webhook receiver. Signature-verified, idempotent via the
// webhook_events table (event id as primary key: insert-or-skip).
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const eventId = request.headers.get("x-razorpay-event-id");

  if (!signature || !razorpay.verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (!eventId) return NextResponse.json({ error: "Missing event id" }, { status: 400 });

  const event = JSON.parse(rawBody) as {
    event: string;
    payload: Record<string, { entity: Record<string, unknown> } | undefined>;
  };

  // Idempotency: first insert wins; replays are acknowledged and skipped.
  try {
    await prisma.webhookEvent.create({
      data: { id: eventId, type: event.event, payload: event as unknown as Prisma.InputJsonValue },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ status: "duplicate" });
    }
    throw err;
  }

  let error: string | null = null;
  try {
    await handleEvent(event);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] ${event.event} failed:`, err);
  }

  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: { processedAt: new Date(), error },
  });

  // Always 200 after recording — Razorpay retries only on non-2xx, and we've
  // durably stored the payload for reprocessing.
  return NextResponse.json({ status: error ? "recorded_with_error" : "ok" });
}

async function handleEvent(event: {
  event: string;
  payload: Record<string, { entity: Record<string, unknown> } | undefined>;
}) {
  switch (event.event) {
    case "subscription.charged":
    case "subscription.activated": {
      const sub = event.payload.subscription?.entity as
        | { id: string; current_end: number | null; status: string }
        | undefined;
      if (!sub) return;
      const record = await prisma.subscription.findUnique({
        where: { razorpaySubscriptionId: sub.id },
      });
      if (!record) throw new Error(`Unknown subscription ${sub.id}`);
      const plan = PLANS[record.planTier];

      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: record.id },
          data: {
            status: "ACTIVE",
            currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
          },
        }),
        prisma.company.update({
          where: { id: record.companyId },
          data: {
            planTier: record.planTier,
            taskCyclesPerDay: plan.taskCyclesPerDay,
            // First activation kicks off provisioning (Phase 2 worker job);
            // subsequent renewals keep the company ACTIVE.
            status: "PROVISIONING",
            lapsedAt: null,
          },
        }),
        prisma.activityLog.create({
          data: {
            companyId: record.companyId,
            agent: "FINANCE",
            action: `Subscription payment received — ${plan.name} plan active`,
          },
        }),
      ]);
      await grantWelcomeCredits(record.companyId); // no-op on renewals

      // Invoice this charge. Subscription plan amount is GST-inclusive, so back
      // out the taxable base. Uses the payment entity (present on charged) for
      // idempotency; skips if this event carries no payment.
      const subPayment = event.payload.payment?.entity as
        | { id: string; amount: number }
        | undefined;
      if (subPayment?.amount) {
        const owner = await prisma.company.findUnique({
          where: { id: record.companyId },
          select: { ownerId: true, name: true },
        });
        if (owner) {
          const taxableP = Math.round((subPayment.amount * 100) / (100 + GST_PERCENT));
          await issueInvoice({
            userId: owner.ownerId,
            companyId: record.companyId,
            description: `${plan.name} plan (monthly) — ${owner.name}`,
            taxableP,
            razorpayPaymentId: subPayment.id,
          }).catch((err) => console.error("[webhook] subscription invoice failed:", err));
        }
      }
      break;
    }

    case "subscription.halted":
    case "subscription.paused": {
      const sub = event.payload.subscription?.entity as { id: string } | undefined;
      if (!sub) return;
      const record = await prisma.subscription.findUnique({
        where: { razorpaySubscriptionId: sub.id },
      });
      if (!record) return;
      await prisma.$transaction([
        prisma.subscription.update({ where: { id: record.id }, data: { status: "HALTED" } }),
        prisma.company.update({ where: { id: record.companyId }, data: { status: "PAUSED" } }),
        prisma.activityLog.create({
          data: {
            companyId: record.companyId,
            agent: "FINANCE",
            action: "Subscription payment failed — agents paused until payment resumes",
            isPublic: false,
          },
        }),
      ]);
      break;
    }

    case "subscription.cancelled":
    case "subscription.completed": {
      const sub = event.payload.subscription?.entity as { id: string } | undefined;
      if (!sub) return;
      const record = await prisma.subscription.findUnique({
        where: { razorpaySubscriptionId: sub.id },
      });
      if (!record) return;
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: record.id },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        }),
        // 90-day retention window starts now; agents pause, data stays.
        prisma.company.update({
          where: { id: record.companyId },
          data: { status: "LAPSED", lapsedAt: new Date() },
        }),
      ]);
      break;
    }

    case "payment.captured": {
      const payment = event.payload.payment?.entity as
        | { id: string; amount: number; order_id?: string; notes?: Record<string, string> }
        | undefined;
      if (!payment) return;

      // Credit-pack purchases carry notes.type = "credit_pack" on the order.
      if (payment.notes?.type === "credit_pack" && payment.notes.companyId) {
        const credits = parseInt(payment.notes.credits ?? "0", 10);
        if (credits > 0) {
          await grantCredits(
            payment.notes.companyId,
            credits,
            `Credit pack purchase (${credits} credits)`,
            payment.order_id,
          );
        }
        await redeemIfCoupon(payment.notes, "CREDITS");
        await issueInvoiceFor(payment, `${credits} credit${credits === 1 ? "" : "s"}`);
        return;
      }

      // Trial: one-time payment unlocks Pro-level access for TRIAL_DAYS days
      // (the worker scheduler lapses trials past Company.trialEndsAt).
      if (payment.notes?.type === "trial" && payment.notes.companyId) {
        const plan = PLANS.TRIAL;
        await prisma.$transaction([
          prisma.company.update({
            where: { id: payment.notes.companyId },
            data: {
              planTier: "TRIAL",
              taskCyclesPerDay: plan.taskCyclesPerDay,
              status: "PROVISIONING",
              trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
              lapsedAt: null,
            },
          }),
          prisma.activityLog.create({
            data: {
              companyId: payment.notes.companyId,
              agent: "FINANCE",
              action: `Trial payment received — Trial plan active for ${TRIAL_DAYS} days`,
            },
          }),
        ]);
        await grantWelcomeCredits(payment.notes.companyId);
        await redeemIfCoupon(payment.notes, "TRIAL");
        await issueInvoiceFor(payment, `${TRIAL_DAYS}-day trial (Pro access)`);
        return;
      }

      // Business revenue (a company's customer paying it through the
      // platform): Razorpay Route splits it 80/20 to the company's linked
      // account. Requires the RAZORPAY_ROUTE integration (meta.accountId).
      if (payment.notes?.type === "business_revenue" && payment.notes.companyId) {
        await settleBusinessRevenue(payment as { id: string; amount: number; notes: Record<string, string> });
      }
      return;
    }

    case "transfer.processed":
    case "transfer.failed":
    case "transfer.reversed": {
      const transfer = event.payload.transfer?.entity as { id: string; status?: string } | undefined;
      if (!transfer) return;
      const status = event.event.replace("transfer.", ""); // processed | failed | reversed
      await prisma.transferRecord.updateMany({
        where: { razorpayTransferId: transfer.id },
        data: { status, ...(status === "processed" ? { processedAt: new Date() } : {}) },
      });
      break;
    }

    default:
      break;
  }
}

/**
 * Issue a GST invoice for a captured one-time payment (credit pack / trial).
 * The taxable base rides on the order notes (notes.baseP), so the invoice
 * matches the charge to the paise. Best-effort — the payment already
 * succeeded, and issueInvoice is idempotent on the payment id.
 */
async function issueInvoiceFor(
  payment: { id: string; notes?: Record<string, string> },
  descriptionSuffix: string,
): Promise<void> {
  const notes = payment.notes;
  const taxableP = notes?.baseP ? parseInt(notes.baseP, 10) : 0;
  if (!notes?.companyId || !Number.isFinite(taxableP) || taxableP <= 0) return;
  try {
    const company = await prisma.company.findUnique({
      where: { id: notes.companyId },
      select: { ownerId: true, name: true },
    });
    if (!company) return;
    await issueInvoice({
      userId: company.ownerId,
      companyId: notes.companyId,
      description: `${descriptionSuffix} — ${company.name}`,
      taxableP,
      razorpayPaymentId: payment.id,
    });
  } catch (err) {
    console.error("[webhook] invoice issue failed:", err);
  }
}

/**
 * Record a coupon redemption for a captured discounted order. Best-effort: the
 * payment already succeeded, so a redemption-count race must not fail the
 * webhook. Idempotent overall because the whole webhook is keyed on event id.
 */
async function redeemIfCoupon(
  notes: Record<string, string>,
  appliedTo: "TRIAL" | "CREDITS",
): Promise<void> {
  if (!notes.couponId || !notes.companyId) return;
  try {
    const company = await prisma.company.findUnique({
      where: { id: notes.companyId },
      select: { ownerId: true },
    });
    if (!company) return;
    await recordRedemption({
      couponId: notes.couponId,
      userId: company.ownerId,
      companyId: notes.companyId,
      appliedTo,
    });
  } catch (err) {
    console.error("[webhook] coupon redemption record failed:", err);
  }
}

/**
 * Route revenue share: keep REVENUE_SHARE_PERCENT, transfer the rest to the
 * company's linked account. The TransferRecord is created first (idempotency
 * anchor per payment) so a webhook retry after a partial failure won't
 * double-transfer.
 */
async function settleBusinessRevenue(payment: {
  id: string;
  amount: number;
  notes: Record<string, string>;
}) {
  const companyId = payment.notes.companyId;
  const existing = await prisma.transferRecord.findFirst({
    where: { razorpayPaymentId: payment.id },
  });
  if (existing) return; // already settled (webhook retry)

  const platformFeeP = Math.floor((payment.amount * REVENUE_SHARE_PERCENT) / 100);
  const settledAmountP = payment.amount - platformFeeP;

  const integration = await prisma.integration.findUnique({
    where: { companyId_provider: { companyId, provider: "RAZORPAY_ROUTE" } },
  });
  const linkedAccountId = (integration?.meta as { accountId?: string } | null)?.accountId;

  const record = await prisma.transferRecord.create({
    data: {
      companyId,
      razorpayPaymentId: payment.id,
      grossAmountP: payment.amount,
      platformFeeP,
      settledAmountP,
      status: linkedAccountId && integration?.status === "CONNECTED" ? "created" : "pending_account",
    },
  });

  if (!linkedAccountId || integration?.status !== "CONNECTED") {
    // Revenue recorded; transfer waits until the linked account is onboarded.
    await prisma.activityLog.create({
      data: {
        companyId,
        agent: "FINANCE",
        action: `Revenue received (₹${(payment.amount / 100).toFixed(0)}) — link your Razorpay account to receive your ${100 - REVENUE_SHARE_PERCENT}% share`,
        isPublic: false,
      },
    });
    return;
  }

  const transfer = await razorpay.createTransferForPayment({
    paymentId: payment.id,
    linkedAccountId,
    amountPaise: settledAmountP,
    notes: { companyId, transferRecordId: record.id },
  });
  await prisma.$transaction([
    prisma.transferRecord.update({
      where: { id: record.id },
      data: { razorpayTransferId: transfer.id, status: transfer.status || "created" },
    }),
    prisma.activityLog.create({
      data: {
        companyId,
        agent: "FINANCE",
        action: `Revenue ₹${(payment.amount / 100).toFixed(0)} received — ₹${(settledAmountP / 100).toFixed(0)} transferring to your account (${REVENUE_SHARE_PERCENT}% platform share)`,
      },
    }),
  ]);
}
