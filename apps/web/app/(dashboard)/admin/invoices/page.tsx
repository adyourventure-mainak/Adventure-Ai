import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@adventure/db";
import { formatINR, GST_PERCENT } from "@adventure/core";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Admin invoice register: every GST invoice across all users, in issue
 * sequence per financial year — the record the accountant works from.
 */
export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: { fy?: string };
}) {
  const user = await requireUser();
  if (!user.isAdmin) notFound();

  const years = await prisma.invoice.findMany({
    distinct: ["financialYear"],
    select: { financialYear: true },
    orderBy: { financialYear: "desc" },
  });
  const fy = searchParams.fy ?? years[0]?.financialYear;

  const invoices = fy
    ? await prisma.invoice.findMany({
        where: { financialYear: fy },
        orderBy: { seq: "asc" },
        include: { user: { select: { email: true } } },
      })
    : [];

  const totals = invoices.reduce(
    (t, i) => ({
      taxable: t.taxable + i.taxableP,
      cgst: t.cgst + i.cgstP,
      sgst: t.sgst + i.sgstP,
      igst: t.igst + i.igstP,
      total: t.total + i.totalP,
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Invoice register</h1>
          <p className="mt-1 text-sm text-ink-400">
            All GST tax invoices, in sequence. SAC 9983 @ {GST_PERCENT}%.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {years.map((y) => (
            <Link
              key={y.financialYear}
              href={`/admin/invoices?fy=${y.financialYear}`}
              className={
                y.financialYear === fy
                  ? "rounded-lg bg-brand-500 px-3 py-1.5 font-medium text-ink-950"
                  : "rounded-lg border border-ink-800 px-3 py-1.5 text-ink-400 hover:text-white"
              }
            >
              FY {y.financialYear}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="py-4">
          <p className="text-xs text-ink-400">Invoices</p>
          <p className="mt-1 text-2xl font-bold">{invoices.length}</p>
        </Card>
        <Card className="py-4">
          <p className="text-xs text-ink-400">Taxable value</p>
          <p className="mt-1 text-2xl font-bold">{formatINR(totals.taxable)}</p>
        </Card>
        <Card className="py-4">
          <p className="text-xs text-ink-400">GST collected</p>
          <p className="mt-1 text-2xl font-bold">
            {formatINR(totals.cgst + totals.sgst + totals.igst)}
          </p>
          <p className="text-xs text-ink-400">
            CGST {formatINR(totals.cgst)} · SGST {formatINR(totals.sgst)} · IGST{" "}
            {formatINR(totals.igst)}
          </p>
        </Card>
        <Card className="py-4">
          <p className="text-xs text-ink-400">Invoiced total</p>
          <p className="mt-1 text-2xl font-bold">{formatINR(totals.total)}</p>
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-800 text-left text-xs text-ink-400">
              <th className="px-4 py-3">Invoice no.</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">GSTIN</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Taxable</th>
              <th className="px-4 py-3 text-right">CGST</th>
              <th className="px-4 py-3 text-right">SGST</th>
              <th className="px-4 py-3 text-right">IGST</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Payment ref</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-ink-400">
                  No invoices yet — they are issued automatically on payment completion.
                </td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-ink-800/50">
                <td className="px-4 py-3 font-mono text-xs">{inv.number}</td>
                <td className="px-4 py-3 text-ink-400">
                  {inv.createdAt.toLocaleDateString("en-IN")}
                </td>
                <td className="px-4 py-3">{inv.buyerName || inv.user.email}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink-400">
                  {inv.buyerGstin || "—"}
                </td>
                <td className="px-4 py-3 text-ink-100">{inv.description}</td>
                <td className="px-4 py-3 text-right">{formatINR(inv.taxableP)}</td>
                <td className="px-4 py-3 text-right">{inv.cgstP ? formatINR(inv.cgstP) : "—"}</td>
                <td className="px-4 py-3 text-right">{inv.sgstP ? formatINR(inv.sgstP) : "—"}</td>
                <td className="px-4 py-3 text-right">{inv.igstP ? formatINR(inv.igstP) : "—"}</td>
                <td className="px-4 py-3 text-right font-medium">{formatINR(inv.totalP)}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink-400">
                  {inv.razorpayPaymentId ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-ink-400">
        Numbering is sequential per financial year (Apr–Mar) with no gaps —{" "}
        <span className="font-mono">ADVAI-ONLINE/&lt;FY&gt;/001</span> onward. Amounts shown are
        exactly what appears on each customer&apos;s printed invoice.
      </p>
    </div>
  );
}
