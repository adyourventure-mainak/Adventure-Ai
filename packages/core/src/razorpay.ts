import crypto from "node:crypto";

const BASE = "https://api.razorpay.com/v1";

function authHeader(): string {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error("Razorpay keys not configured");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function rzp<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Razorpay ${path} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface RazorpaySubscription {
  id: string;
  plan_id: string;
  status: string;
  current_end: number | null;
  short_url?: string;
}

export function createSubscription(params: {
  planId: string;
  notes?: Record<string, string>;
}): Promise<RazorpaySubscription> {
  return rzp("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: params.planId,
      total_count: 60, // 5 years of monthly cycles; cancel anytime
      customer_notify: 1,
      notes: params.notes ?? {},
    }),
  });
}

export function cancelSubscription(subscriptionId: string): Promise<RazorpaySubscription> {
  return rzp(`/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ cancel_at_cycle_end: 1 }),
  });
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export function createOrder(params: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  return rzp("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: params.amountPaise,
      currency: "INR",
      receipt: params.receipt,
      notes: params.notes ?? {},
    }),
  });
}

export interface RazorpayTransfer {
  id: string;
  amount: number;
  recipient: string;
  status: string;
}

/**
 * Razorpay Route: split a captured payment to a linked account. Used for the
 * platform's revenue share — the settled amount goes to the business's linked
 * account, the remainder stays with the platform.
 */
export async function createTransferForPayment(params: {
  paymentId: string;
  linkedAccountId: string; // acc_... from Route linked-account onboarding
  amountPaise: number;
  notes?: Record<string, string>;
}): Promise<RazorpayTransfer> {
  const res = await rzp<{ items: RazorpayTransfer[] }>(`/payments/${params.paymentId}/transfers`, {
    method: "POST",
    body: JSON.stringify({
      transfers: [
        {
          account: params.linkedAccountId,
          amount: params.amountPaise,
          currency: "INR",
          notes: params.notes ?? {},
        },
      ],
    }),
  });
  const transfer = res.items?.[0];
  if (!transfer) throw new Error(`Razorpay transfer for payment ${params.paymentId} returned no items`);
  return transfer;
}

/** Verify the signature Razorpay sends on webhook deliveries. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET not configured");
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return (
    expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  );
}

/** Verify the checkout success signature (payment_id|subscription_id style). */
export function verifyCheckoutSignature(params: {
  razorpayPaymentId: string;
  razorpaySubscriptionId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("RAZORPAY_KEY_SECRET not configured");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${params.razorpayPaymentId}|${params.razorpaySubscriptionId}`)
    .digest("hex");
  return (
    expected.length === params.signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(params.signature))
  );
}
