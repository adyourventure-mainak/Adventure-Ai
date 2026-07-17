import { financialYear, invoiceNumber, taxBreakdown } from "@adventure/core";
import { prisma } from "./client";

/**
 * Issue a GST tax invoice for a completed payment. Snapshots the buyer's
 * billing profile, computes the CGST/SGST/IGST split from the taxable base,
 * and allocates the next per-financial-year sequence atomically.
 *
 * `taxableP` is the pre-tax amount actually charged for (post-discount). The
 * caller passes it from the order it created, so the invoice matches to the
 * paise. Idempotent per Razorpay payment id: a webhook retry won't duplicate.
 */
export async function issueInvoice(input: {
  userId: string;
  companyId?: string | null;
  description: string;
  taxableP: number;
  razorpayPaymentId?: string | null;
}) {
  if (input.razorpayPaymentId) {
    const existing = await prisma.invoice.findFirst({
      where: { razorpayPaymentId: input.razorpayPaymentId },
      select: { id: true },
    });
    if (existing) return existing;
  }

  const buyer = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      billingName: true,
      billingGstin: true,
      billingAddress: true,
      shippingAddress: true,
    },
  });

  const tax = taxBreakdown(input.taxableP, buyer?.billingGstin);
  const fy = financialYear();

  // Allocate the next FY sequence atomically (upsert + increment in one tx).
  const counter = await prisma.$transaction(async (tx) => {
    const row = await tx.invoiceCounter.upsert({
      where: { financialYear: fy },
      create: { financialYear: fy, lastSeq: 1 },
      update: { lastSeq: { increment: 1 } },
    });
    return row.lastSeq;
  });

  return prisma.invoice.create({
    data: {
      number: invoiceNumber(fy, counter),
      financialYear: fy,
      seq: counter,
      userId: input.userId,
      companyId: input.companyId ?? null,
      description: input.description,
      buyerName: buyer?.billingName ?? null,
      buyerGstin: buyer?.billingGstin ?? null,
      buyerBillingAddress: buyer?.billingAddress ?? null,
      buyerShippingAddress: buyer?.shippingAddress ?? null,
      taxableP: tax.taxableP,
      cgstP: tax.cgstP,
      sgstP: tax.sgstP,
      igstP: tax.igstP,
      totalP: tax.totalP,
      razorpayPaymentId: input.razorpayPaymentId ?? null,
    },
  });
}
