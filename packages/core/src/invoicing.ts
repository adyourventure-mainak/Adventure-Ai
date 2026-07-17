// GST tax-invoice constants and helpers. All amounts in paise.
import { GST_PERCENT } from "./plans";

/** Us — the seller. Shown on every invoice. */
export const SELLER = {
  name: "AD VENTURE",
  address: "Patnabazar, Midnapore, West Bengal",
  gstin: "19CTUPS7673A1ZW",
  stateCode: "19", // West Bengal — first two digits of the GSTIN
  stateName: "West Bengal",
} as const;

/** SAC (service accounting code) for the platform's service, taxed at 18%. */
export const SAC_CODE = "9983"; // Other professional, technical & business services
export const INVOICE_PREFIX = "ADVAI-ONLINE";

/**
 * Indian financial year (Apr–Mar) for a date, e.g. 2026-07-20 → "2026-27".
 * Invoice sequences reset each FY.
 */
export function financialYear(d = new Date()): string {
  const y = d.getUTCFullYear();
  const startYear = d.getUTCMonth() >= 3 ? y : y - 1; // month 3 = April
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** Format a per-FY sequence into the invoice number, e.g. ADVAI-ONLINE/2026-27/001. */
export function invoiceNumber(fy: string, seq: number): string {
  return `${INVOICE_PREFIX}/${fy}/${String(seq).padStart(3, "0")}`;
}

/** State code from a GSTIN (first two digits), or null if not a plausible GSTIN. */
export function gstinStateCode(gstin?: string | null): string | null {
  if (!gstin) return null;
  const s = gstin.trim().toUpperCase();
  return /^[0-9]{2}[A-Z0-9]{13}$/.test(s) ? s.slice(0, 2) : null;
}

export interface TaxBreakdown {
  taxableP: number; // pre-tax base (after any discount)
  cgstP: number;
  sgstP: number;
  igstP: number;
  totalP: number;
  intraState: boolean;
}

/**
 * Split GST on a taxable base. Intra-state (buyer in the seller's state, or no
 * GSTIN given → place of supply defaults to the seller's state) splits into
 * CGST+SGST; inter-state is IGST. Total tax is 18% either way — only the split
 * differs. The buyer pays the same regardless.
 */
export function taxBreakdown(taxableP: number, buyerGstin?: string | null): TaxBreakdown {
  const buyerState = gstinStateCode(buyerGstin);
  const intraState = !buyerState || buyerState === SELLER.stateCode;
  const totalGst = Math.round((taxableP * GST_PERCENT) / 100);
  if (intraState) {
    const half = Math.round(totalGst / 2);
    return {
      taxableP,
      cgstP: half,
      sgstP: totalGst - half,
      igstP: 0,
      totalP: taxableP + totalGst,
      intraState: true,
    };
  }
  return { taxableP, cgstP: 0, sgstP: 0, igstP: totalGst, totalP: taxableP + totalGst, intraState: false };
}
