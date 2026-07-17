import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@adventure/db";
import { formatINR, SELLER, SAC_CODE, GST_PERCENT } from "@adventure/core";
import { requireUser } from "@/lib/auth";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const inv = await prisma.invoice.findUnique({ where: { id: params.id } });
  // Owner sees their own invoices; admins can open any (invoice register).
  if (!inv || (inv.userId !== user.id && !user.isAdmin)) notFound();

  const intra = inv.cgstP > 0 || inv.sgstP > 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/billing" className="text-sm text-brand-400 hover:underline">
          ← Back to billing
        </Link>
        <PrintButton />
      </div>

      {/* The invoice sheet — white, print-friendly. */}
      <div className="rounded-xl bg-white p-8 text-ink-950 print:rounded-none print:p-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold">Tax Invoice</h1>
            <p className="mt-1 font-mono text-sm">{inv.number}</p>
            <p className="text-xs text-ink-600">
              Date: {inv.createdAt.toLocaleDateString("en-IN")}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-bold">{SELLER.name}</p>
            <p className="text-xs text-ink-600">{SELLER.address}</p>
            <p className="text-xs text-ink-600">GSTIN: {SELLER.gstin}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Bill to</p>
            <p className="mt-1 text-sm font-medium">{inv.buyerName || user.email}</p>
            {inv.buyerGstin && <p className="text-xs text-ink-600">GSTIN: {inv.buyerGstin}</p>}
            {inv.buyerBillingAddress && (
              <p className="mt-1 whitespace-pre-wrap text-xs text-ink-600">{inv.buyerBillingAddress}</p>
            )}
          </div>
          {inv.buyerShippingAddress && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Ship to</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-ink-600">{inv.buyerShippingAddress}</p>
            </div>
          )}
        </div>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
              <th className="py-2 pr-2">Description</th>
              <th className="py-2 px-2">SAC</th>
              <th className="py-2 pl-2 text-right">Taxable value</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-ink-100">
              <td className="py-3 pr-2">{inv.description}</td>
              <td className="py-3 px-2">{inv.sacCode || SAC_CODE}</td>
              <td className="py-3 pl-2 text-right">{formatINR(inv.taxableP)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <Row label="Taxable value" value={formatINR(inv.taxableP)} />
          {intra ? (
            <>
              <Row label={`CGST @ ${GST_PERCENT / 2}%`} value={formatINR(inv.cgstP)} />
              <Row label={`SGST @ ${GST_PERCENT / 2}%`} value={formatINR(inv.sgstP)} />
            </>
          ) : (
            <Row label={`IGST @ ${GST_PERCENT}%`} value={formatINR(inv.igstP)} />
          )}
          <div className="mt-1 flex justify-between border-t border-ink-200 pt-2 font-bold">
            <span>Total</span>
            <span>{formatINR(inv.totalP)}</span>
          </div>
        </div>

        <p className="mt-8 text-xs text-ink-500">
          This is a computer-generated tax invoice. SAC {inv.sacCode || SAC_CODE} — online business
          management services, taxed at {GST_PERCENT}% GST.
          {inv.razorpayPaymentId ? ` Payment ref: ${inv.razorpayPaymentId}.` : ""}
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-700">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
