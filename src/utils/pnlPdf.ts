/* ────────────────────────────────────────────────────────────────────
 * PDF Export — Laporan Laba Rugi (Template Matching)
 * Two-page layout matching tamplate baru.pdf specification.
 * ──────────────────────────────────────────────────────────────────── */

import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";
import type { PnlStatement, PnlSection } from "../data/pnl";

export interface PnlPdfData {
  entity: string;
  branch: string;
  period: string;
  periodLabel: string;
  statement: PnlStatement;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function fmt(v: number): string {
  if (v === 0) return "";
  return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(v));
}

function drawCenter(page: any, text: string, y: number, font: any, size: number, color = rgb(0, 0, 0)) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (page.getSize().width - w) / 2, y, size, font, color });
}

function drawRight(page: any, text: string, x: number, y: number, font: any, size: number, color = rgb(0, 0, 0)) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: x - w, y, size, font, color });
}

function drawLeft(page: any, text: string, x: number, y: number, font: any, size: number, color = rgb(0, 0, 0)) {
  page.drawText(text, { x, y, size, font, color });
}

function line(page: any, x1: number, y: number, x2: number, thickness = 0.5, color = rgb(0, 0, 0)) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}

function doubleLine(page: any, x1: number, y: number, x2: number, gap = 3, thickness = 0.5, color = rgb(0, 0, 0)) {
  line(page, x1, y, x2, thickness, color);
  line(page, x1, y - gap, x2, thickness, color);
}

function extractBrand(entity: string): string {
  if (entity === "Dentico Group (Consolidated)") return "DENTICO GROUP";
  return entity.split(" - ")[0].toUpperCase();
}

function extractBranch(branch: string): string {
  if (branch === "Semua Cabang (Grup)" || branch === "Semua Cabang (5)") return "KONSOLIDASI";
  const parts = branch.split(" - ");
  return parts.length > 1 ? parts.slice(1).join(" - ").toUpperCase() : branch.toUpperCase();
}

/* ── Main export ──────────────────────────────────────────────────── */

export async function generatePnlPdf(data: PnlPdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page1 = pdfDoc.addPage(PageSizes.A4);
  const page2 = pdfDoc.addPage(PageSizes.A4);

  const { width, height } = page1.getSize();
  const margin = 60;
  const colLabel = margin;
  const colAmount = width - margin - 5;

  const brand = extractBrand(data.entity);
  const branch = extractBranch(data.branch);
  const st = data.statement;

  /* ── Layout constants ───────────────────────────────────────────── */
  const ROW_H = 18;
  const GAP_SM = 4;
  const GAP_MD = 8;
  const GAP_LG = 12;
  const INDENT_SEC = 0;
  const INDENT_SUB = 20;
  const INDENT_ACC = 30;

  /* ── Header (page 1 only) ───────────────────────────────────────── */
  function drawHeader(page: any): number {
    let y = height - margin;
    drawCenter(page, `${brand} DENTAL`, y, fontBold, 18);
    y -= 26;
    drawCenter(page, "LAPORAN LABA RUGI", y, fontBold, 14);
    y -= 22;
    drawCenter(page, `${brand} - ${branch}`, y, font, 11);
    y -= 20;
    drawCenter(page, `Periode ${data.periodLabel}`, y, fontBold, 11);
    y -= 8;
    line(page, margin, y, width - margin, 1);
    y -= 14;
    return y;
  }

  /* ── Draw section header ────────────────────────────────────────── */
  function drawSectionHeader(page: any, y: number, title: string, indent: number, size = 11): number {
    drawLeft(page, title, colLabel + indent, y, fontBold, size);
    return y - ROW_H;
  }

  /* ── Draw account row (keeps row even if amount is 0/empty) ─────── */
  function drawAccountRow(page: any, y: number, name: string, amount: number, indent: number, isBold = false): number {
    drawLeft(page, name, colLabel + indent, y, isBold ? fontBold : font, 10);
    drawRight(page, fmt(amount), colAmount, y, isBold ? fontBold : font, 10);
    return y - ROW_H;
  }

  /* ── Draw subtotal row with single underline ────────────────────── */
  function drawSubtotal(page: any, y: number, label: string, amount: number, indent: number, lineStart: number): number {
    drawLeft(page, label, colLabel + indent, y, fontBold, 10);
    drawRight(page, fmt(amount), colAmount, y, fontBold, 10);
    y -= ROW_H;
    line(page, lineStart, y, width - margin, 0.5);
    return y - GAP_SM;
  }

  /* ── Draw double underline total (Laba Kotor, Laba Bersih) ──────── */
  function drawDoubleTotal(page: any, y: number, label: string, amount: number, indent: number, fontSize = 11): number {
    drawLeft(page, label, colLabel + indent, y, fontBold, fontSize);
    drawRight(page, fmt(amount), colAmount, y, fontBold, fontSize);
    y -= ROW_H + 2;
    doubleLine(page, margin, y, width - margin, 3);
    return y - GAP_LG;
  }

  /* ── Draw grand total with single line (TOTAL BEBAN OPERASIONAL) ── */
  function drawGrandTotal(page: any, y: number, label: string, amount: number): number {
    drawLeft(page, label, colLabel, y, fontBold, 11);
    drawRight(page, fmt(amount), colAmount, y, fontBold, 11);
    y -= ROW_H;
    line(page, margin, y, width - margin, 0.5);
    return y - GAP_MD;
  }

  /* ── Get section by key ─────────────────────────────────────────── */
  function getSec(key: string): PnlSection | null {
    return st.sections.find((s) => s.key === key) ?? null;
  }

  /* ═══════════════════════════════════════════════════════════════════
   * PAGE 1 — ends after Total Biaya Pemeliharaan
   * ═══════════════════════════════════════════════════════════════════ */
  let y = drawHeader(page1);

  // 1. PENDAPATAN USAHA
  y = drawSectionHeader(page1, y, "PENDAPATAN USAHA", INDENT_SEC);
  const pendSec = getSec("pendapatan");
  for (const code of ["4101", "4301"]) {
    const row = pendSec?.rows.find((r) => r.code === code);
    if (row) y = drawAccountRow(page1, y, row.name, row.amount, INDENT_ACC);
  }
  y = drawSubtotal(page1, y, "TOTAL PENDAPATAN USAHA", Math.abs(pendSec?.total ?? 0), INDENT_SEC, margin);
  y -= GAP_MD;

  // 2. BEBAN LANGSUNG
  y = drawSectionHeader(page1, y, "BEBAN LANGSUNG", INDENT_SEC);
  const lngSec = getSec("langsung");
  for (const code of ["6001", "6002", "6003", "6004"]) {
    const row = lngSec?.rows.find((r) => r.code === code);
    if (row) y = drawAccountRow(page1, y, row.name, row.amount, INDENT_ACC);
  }
  y = drawSubtotal(page1, y, "TOTAL BEBAN LANGSUNG", Math.abs(lngSec?.total ?? 0), INDENT_SEC, margin);
  y -= GAP_MD;

  // 3. LABA KOTOR (double underline)
  y = drawDoubleTotal(page1, y, "LABA KOTOR", st.labaKotor, INDENT_SEC);
  y -= GAP_MD;

  // 4. BEBAN OPERASIONAL (group header)
  y = drawSectionHeader(page1, y, "BEBAN OPERASIONAL", INDENT_SEC);
  y -= GAP_SM;

  // 4a. BIAYA GAJI & SDM
  y = drawSectionHeader(page1, y, "BIAYA GAJI & SDM", INDENT_SUB);
  const sdmSec = getSec("sdm");
  for (const code of ["6102", "6103", "6104", "6105", "6106", "6107", "6108", "6109", "6110"]) {
    const row = sdmSec?.rows.find((r) => r.code === code);
    if (row) y = drawAccountRow(page1, y, row.name, row.amount, INDENT_ACC);
  }
  y = drawSubtotal(page1, y, "Total Gaji & SDM", Math.abs(sdmSec?.total ?? 0), INDENT_SUB, margin + INDENT_SUB);
  y -= GAP_MD;

  // 4b. BEBAN OPERASIONAL (biaya umum)
  y = drawSectionHeader(page1, y, "BEBAN OPERASIONAL", INDENT_SUB);
  const opsSec = getSec("ops");
  for (const code of ["6201", "6202", "6203", "6204", "6205", "6206", "6207", "6208", "6209", "6210", "6211", "6212", "6213", "6214", "6215", "6216", "6217", "6218"]) {
    const row = opsSec?.rows.find((r) => r.code === code);
    if (row) y = drawAccountRow(page1, y, row.name, row.amount, INDENT_ACC);
  }
  y = drawSubtotal(page1, y, "Total Beban Operasional", Math.abs(opsSec?.total ?? 0), INDENT_SUB, margin + INDENT_SUB);
  y -= GAP_MD;

  // 4c. BIAYA PEMELIHARAAN
  y = drawSectionHeader(page1, y, "BIAYA PEMELIHARAAN", INDENT_SUB);
  const maintSec = getSec("maint");
  for (const code of ["6301", "6302", "6303", "6304", "6305"]) {
    const row = maintSec?.rows.find((r) => r.code === code);
    if (row) y = drawAccountRow(page1, y, row.name, row.amount, INDENT_ACC);
  }
  y = drawSubtotal(page1, y, "Total Biaya Pemeliharaan", Math.abs(maintSec?.total ?? 0), INDENT_SUB, margin + INDENT_SUB);
  y -= GAP_LG;

  // Page 1 ends here after Total Biaya Pemeliharaan (explicit page break)

  /* ═══════════════════════════════════════════════════════════════════
   * PAGE 2 — Fresh coordinate system starting from top
   * ═══════════════════════════════════════════════════════════════════ */
  let y2 = height - margin;

  // 5. BEBAN ADMINISTRASI
  y2 = drawSectionHeader(page2, y2, "BEBAN ADMINISTRASI", INDENT_SUB);
  const admSec = getSec("adm");
  for (const code of ["6401", "6402", "6403", "6404", "6405", "6406", "6407", "6408"]) {
    const row = admSec?.rows.find((r) => r.code === code);
    if (row) y2 = drawAccountRow(page2, y2, row.name, row.amount, INDENT_ACC);
  }
  y2 = drawSubtotal(page2, y2, "Total Biaya Administrasi", Math.abs(admSec?.total ?? 0), INDENT_SUB, margin + INDENT_SUB);
  y2 -= GAP_MD;

  // 6. PENYUSUTAN & AMORTISASI
  y2 = drawSectionHeader(page2, y2, "PENYUSUTAN & AMORTISASI", INDENT_SUB);
  // Fixed account names per template (may not exist in seed data)
  const deprAccounts = [
    { code: "6701", name: "Beban Penyusutan Peralatan Medis" },
    { code: "6702", name: "Beban Penyusutan Peralatan Kantor" },
    { code: "6703", name: "Beban Penyusutan Renovasi" },
    { code: "6704", name: "Beban Amortisasi" },
  ];
  for (const acc of deprAccounts) {
    const row = admSec?.rows.find((r) => r.code === acc.code) ?? 
                st.sections.flatMap(s => s.rows).find(r => r.code === acc.code);
    const amount = row?.amount ?? 0;
    y2 = drawAccountRow(page2, y2, acc.name, amount, INDENT_ACC);
  }
  // Subtotal for Penyusutan & Amortisasi
  const deprTotal = deprAccounts.reduce((sum, acc) => {
    const row = st.sections.flatMap(s => s.rows).find(r => r.code === acc.code);
    return sum + (row?.amount ?? 0);
  }, 0);
  y2 = drawSubtotal(page2, y2, "Total Biaya Penyusutan & Amortisasi", Math.abs(deprTotal), INDENT_SUB, margin + INDENT_SUB);
  y2 -= GAP_MD;

  // 7. BEBAN MARKETING
  y2 = drawSectionHeader(page2, y2, "BEBAN MARKETING", INDENT_SUB);
  const mktSec = getSec("mkt");
  for (const code of ["6501", "6502", "6503", "6504", "6505", "6506"]) {
    const row = mktSec?.rows.find((r) => r.code === code);
    if (row) y2 = drawAccountRow(page2, y2, row.name, row.amount, INDENT_ACC);
  }
  y2 = drawSubtotal(page2, y2, "Total Biaya Marketing", Math.abs(mktSec?.total ?? 0), INDENT_SUB, margin + INDENT_SUB);
  y2 -= GAP_MD;

  // 8. TOTAL BEBAN OPERASIONAL (grand total of all operational expenses)
  y2 = drawGrandTotal(page2, y2, "TOTAL BEBAN OPERASIONAL", st.bebanOps);
  y2 -= GAP_MD;

  // 9. LABA OPERASIONAL (single underline only per template - double only for Laba Kotor & Laba Bersih)
  drawLeft(page2, "LABA OPERASIONAL", colLabel, y2, fontBold, 11);
  drawRight(page2, fmt(st.labaOperasional), colAmount, y2, fontBold, 11);
  y2 -= ROW_H;
  line(page2, margin, y2, width - margin, 0.5);
  y2 -= GAP_MD;

  // 10. PENDAPATAN / BEBAN NON-OPERASIONAL
  y2 = drawSectionHeader(page2, y2, "PENDAPATAN / BEBAN NON-OPERASIONAL", INDENT_SEC);
  const nonOpsSec = getSec("nonops");
  for (const code of ["4302", "6601", "6602", "6603"]) {
    const row = nonOpsSec?.rows.find((r) => r.code === code);
    if (row) y2 = drawAccountRow(page2, y2, row.name, row.amount, INDENT_ACC);
  }
  y2 = drawSubtotal(page2, y2, "TOTAL PENDAPATAN / BEBAN NON-OPERASIONAL", Math.abs(nonOpsSec?.total ?? 0), INDENT_SEC, margin);
  y2 -= GAP_MD;

  // 11. LABA BERSIH (double underline, larger font)
  y2 = drawDoubleTotal(page2, y2, "LABA BERSIH", st.labaBersih, INDENT_SEC, 13);
  y2 -= GAP_LG;

  // No footer per template

  return pdfDoc.save();
}

export function downloadPnlPdf(data: PnlPdfData, filename?: string) {
  generatePnlPdf(data).then(bytes => {
    const blob = new Blob([bytes as unknown as ArrayBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? `laba-rugi-${data.entity.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${data.period}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }).catch(err => {
    console.error("[PDF] generate failed:", err);
    alert("Gagal membuat PDF: " + err.message);
  });
}