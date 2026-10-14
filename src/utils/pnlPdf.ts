/* ────────────────────────────────────────────────────────────────────
 * PDF Export — Laporan Laba Rugi (Template Matching)
 * Two-page layout matching tamplate baru.pdf specification.
 *
 * Key design decisions:
 * - Explicit page break after Total Biaya Pemeliharaan (page 1)
 * - Page 2 starts fresh from top margin with BEBAN ADMINISTRASI
 * - Compact row height (12pt) + narrow gaps to fit all accounts on page 1
 * - All accounts preserved including zero-amount rows
 * - No footer
 * - Double lines only under LABA KOTOR and LABA BERSIH (short, under nominal)
 * - Extra spacing before LABA KOTOR, TOTAL BEBAN OPERASIONAL, and LABA BERSIH
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

function lineFn(page: any, x1: number, y: number, x2: number, thickness = 0.5, color = rgb(0, 0, 0)) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}

function doubleLineFn(page: any, x1: number, y: number, x2: number, gap = 3, thickness = 0.5, color = rgb(0, 0, 0)) {
  lineFn(page, x1, y, x2, thickness, color);
  lineFn(page, x1, y - gap, x2, thickness, color);
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
  const margin = 45;
  const colLabel = margin;
  const colAmount = width - margin - 5;

  const brand = extractBrand(data.entity);
  const branch = extractBranch(data.branch);
  const st = data.statement;

  /* ── Layout constants ───────────────────────────────────────────── */
  const ROW_H = 12;
  const GAP_SM = 3;
  const GAP_MD = 5;
  const GAP_LG = 8;
  const INDENT_SEC = 0;
  const INDENT_SUB = 18;
  const INDENT_ACC = 28;

  /* ── Header (page 1 only) ───────────────────────────────────────── */
  function drawHeader(page: any): number {
    let y = height - margin;
    drawCenter(page, `${brand} DENTAL`, y, fontBold, 16);
    y -= 20;
    drawCenter(page, "LAPORAN LABA RUGI", y, fontBold, 12);
    y -= 16;
    drawCenter(page, `${brand} - ${branch}`, y, font, 10);
    y -= 12;
    drawCenter(page, `Periode ${data.periodLabel}`, y, fontBold, 10);
    y -= 6;
    lineFn(page, margin, y, width - margin, 0.5);
    y -= 10;
    return y;
  }

  /* ── Get section by key ─────────────────────────────────────────── */
  function getSec(key: string): PnlSection | null {
    return st.sections.find((s) => s.key === key) ?? null;
  }

  /* ── Draw a complete section (header + accounts + subtotal) ──────── */
  function drawSection(
    page: any,
    startY: number,
    sec: PnlSection,
    codes: string[],
    title: string,
    totalLabel: string,
    indent: number,
  ): number {
    const xTitle = colLabel + indent;
    const xAcc = colLabel + indent + 6;
    let y = startY;

    // Section title
    drawLeft(page, title, xTitle, y, fontBold, 10);
    y -= ROW_H;

    // Account rows (always rendered, even if amount is 0)
    for (const code of codes) {
      const row = sec.rows.find((r) => r.code === code);
      const name = row?.name ?? code;
      const amount = row?.amount ?? 0;
      drawLeft(page, name, xAcc, y, font, 9);
      drawRight(page, fmt(amount), colAmount, y, font, 9);
      y -= ROW_H;
    }

    // Subtotal row with single underline
    drawLeft(page, totalLabel, xTitle, y, fontBold, 9);
    drawRight(page, fmt(Math.abs(sec.total)), colAmount, y, fontBold, 9);
    y -= ROW_H;
    lineFn(page, margin + indent, y, width - margin, 0.5);

    return y - GAP_MD;
  }

  /* ── Draw short double line under nominal only (not full width) ──── */
  function drawShortDouble(page: any, y: number) {
    const lineWidth = 50;
    doubleLineFn(page, colAmount - lineWidth, y, colAmount, 3);
  }

  /* ═══════════════════════════════════════════════════════════════════
   * PAGE 1 — ends after Total Biaya Pemeliharaan
   * ═══════════════════════════════════════════════════════════════════ */
  let y = drawHeader(page1);

  // 1. PENDAPATAN USAHA
  const pendSec = getSec("pendapatan");
  y = drawSection(page1, y, pendSec!, ["4101", "4301"], "PENDAPATAN USAHA", "TOTAL PENDAPATAN USAHA", INDENT_SEC);
  y -= GAP_MD;

  // 2. BEBAN LANGSUNG
  const lngSec = getSec("langsung");
  y = drawSection(page1, y, lngSec!, ["6001", "6002", "6003", "6004"], "BEBAN LANGSUNG", "TOTAL BEBAN LANGSUNG", INDENT_SEC);
  y -= GAP_LG;

  // 3. LABA KOTOR (short double underline below nominal only, extra space before)
  drawLeft(page1, "LABA KOTOR", colLabel, y, fontBold, 12);
  drawRight(page1, fmt(st.labaKotor), colAmount, y, fontBold, 12);
  y -= ROW_H + 2;
  drawShortDouble(page1, y);
  y -= GAP_LG;

  // 4. BEBAN OPERASIONAL (group header)
  drawLeft(page1, "BEBAN OPERASIONAL", colLabel, y, fontBold, 11);
  y -= ROW_H + GAP_SM;

  // 4a. BIAYA GAJI & SDM
  const sdmSec = getSec("sdm");
  y = drawSection(page1, y, sdmSec!, ["6102", "6103", "6104", "6105", "6106", "6107", "6108", "6109", "6110"], "BIAYA GAJI & SDM", "Total Gaji & SDM", INDENT_SUB);
  y -= GAP_MD;

  // 4b. BEBAN OPERASIONAL (biaya umum)
  const opsSec = getSec("ops");
  y = drawSection(page1, y, opsSec!,
    ["6201", "6202", "6203", "6204", "6205", "6206", "6207", "6208", "6209", "6210", "6211", "6212", "6213", "6214", "6215", "6216", "6217", "6218"],
    "BEBAN OPERASIONAL", "Total Beban Operasional", INDENT_SUB);
  y -= GAP_MD;

  // 4c. BIAYA PEMELIHARAAN
  const maintSec = getSec("maint");
  y = drawSection(page1, y, maintSec!, ["6301", "6302", "6303", "6304", "6305"], "BIAYA PEMELIHARAAN", "Total Biaya Pemeliharaan", INDENT_SUB);
  y -= GAP_LG;

  // ── Page 1 ends here: Total Biaya Pemeliharaan ────────────────────
  // Explicit page break — nothing more is drawn on page 1

  /* ═══════════════════════════════════════════════════════════════════
   * PAGE 2 — Fresh coordinate system starting from top margin
   * ═══════════════════════════════════════════════════════════════════ */
  let y2 = height - margin;

  // 5. BEBAN ADMINISTRASI
  const admSec = getSec("adm");
  y2 = drawSection(page2, y2, admSec!,
    ["6401", "6402", "6403", "6404", "6405", "6406", "6407", "6408"],
    "BEBAN ADMINISTRASI", "Total Biaya Administrasi", INDENT_SUB);
  y2 -= GAP_MD;

  // 6. PENYUSUTAN & AMORTISASI (fixed template names, amounts from 6407/6408)
  const allRows = st.sections.flatMap((s) => s.rows);
  const row6407 = allRows.find((r) => r.code === "6407");
  const row6408 = allRows.find((r) => r.code === "6408");

  drawLeft(page2, "PENYUSUTAN & AMORTISASI", colLabel + INDENT_SUB, y2, fontBold, 10);
  y2 -= ROW_H;

  const deprNames = [
    { name: "Beban Penyusutan Peralatan Medis", amount: row6407?.amount ?? 0 },
    { name: "Beban Penyusutan Peralatan Kantor", amount: 0 },
    { name: "Beban Penyusutan Renovasi", amount: 0 },
    { name: "Beban Amortisasi", amount: row6408?.amount ?? 0 },
  ];

  let deprTotal = 0;
  for (const acc of deprNames) {
    drawLeft(page2, acc.name, colLabel + INDENT_ACC, y2, font, 9);
    drawRight(page2, fmt(acc.amount), colAmount, y2, font, 9);
    deprTotal += acc.amount;
    y2 -= ROW_H;
  }

  // Subtotal Penyusutan
  drawLeft(page2, "Total Biaya Penyusutan & Amortisasi", colLabel + INDENT_SUB, y2, fontBold, 9);
  drawRight(page2, fmt(Math.abs(deprTotal)), colAmount, y2, fontBold, 9);
  y2 -= ROW_H;
  lineFn(page2, margin + INDENT_SUB, y2, width - margin, 0.5);
  y2 -= GAP_MD;

  // 7. BEBAN MARKETING
  const mktSec = getSec("mkt");
  y2 = drawSection(page2, y2, mktSec!, ["6501", "6502", "6503", "6504", "6505", "6506"], "BEBAN MARKETING", "Total Biaya Marketing", INDENT_SUB);
  y2 -= GAP_LG;

  // 8. TOTAL BEBAN OPERASIONAL (grand total — single line)
  drawLeft(page2, "TOTAL BEBAN OPERASIONAL", colLabel, y2, fontBold, 11);
  drawRight(page2, fmt(st.bebanOps), colAmount, y2, fontBold, 11);
  y2 -= ROW_H;
  lineFn(page2, margin, y2, width - margin, 0.5);
  y2 -= GAP_MD;

  // 9. LABA OPERASIONAL (single line, bold, font 12 — extra space before)
  drawLeft(page2, "LABA OPERASIONAL", colLabel, y2, fontBold, 12);
  drawRight(page2, fmt(st.labaOperasional), colAmount, y2, fontBold, 12);
  y2 -= ROW_H;
  lineFn(page2, margin, y2, width - margin, 0.5);
  y2 -= GAP_LG;

  // 10. PENDAPATAN / BEBAN NON-OPERASIONAL
  const nonOpsSec = getSec("nonops");
  y2 = drawSection(page2, y2, nonOpsSec!, ["4302", "6601", "6602", "6603"], "PENDAPATAN / BEBAN NON-OPERASIONAL", "TOTAL PENDAPATAN / BEBAT NON-OPERASIONAL", INDENT_SEC);
  y2 -= GAP_LG;

  // 11. LABA BERSIH (short double underline below nominal, larger font)
  drawLeft(page2, "LABA BERSIH", colLabel, y2, fontBold, 13);
  drawRight(page2, fmt(st.labaBersih), colAmount, y2, fontBold, 13);
  y2 -= ROW_H + 2;
  drawShortDouble(page2, y2);

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