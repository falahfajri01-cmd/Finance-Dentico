/* ────────────────────────────────────────────────────────────────────
 * PDF Export — Laporan Laba Rugi (Template Matching)
 * Two-page layout matching the provided template specification.
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

  /* ── Header drawing (reusable) ──────────────────────────────────── */
  function drawHeader(page: any) {
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

  /* ── Draw a section with given codes ────────────────────────────── */
  function drawSection(
    page: any,
    y: number,
    sec: PnlSection | null,
    codes: string[],
    options: { title: string; indent?: boolean; isHeader?: boolean; isTotal?: boolean; isEmpty?: boolean } = { title: "" }
  ): number {
    const { title, indent = false, isHeader = false, isTotal = false, isEmpty = false } = options;
    const xLabel = colLabel + (indent ? 20 : 0);
    const titleSize = isHeader ? 11 : 11;
    const rowHeight = 18;
    const gap = 4;

    if (isTotal) {
      // Total line with double underline
      drawLeft(page, title, xLabel, y, fontBold, titleSize);
      const totalVal = sec ? Math.abs(sec.total) : 0;
      drawRight(page, fmt(totalVal), colAmount, y, fontBold, titleSize);
      y -= rowHeight;
      doubleLine(page, margin, y, width - margin, 3);
      y -= gap + 4;
      return y;
    }

    if (isEmpty) {
      // Empty section header (Penyusutan)
      drawLeft(page, title, xLabel, y, fontBold, titleSize);
      y -= rowHeight + gap;
      return y;
    }

    if (isHeader) {
      drawLeft(page, title, xLabel, y, fontBold, titleSize);
      y -= rowHeight + gap;
      return y;
    }

    // Section header
    drawLeft(page, title, xLabel, y, fontBold, titleSize);
    y -= rowHeight;

    // Items
    for (const code of codes) {
      const row = sec?.rows.find((r) => r.code === code);
      const name = row?.name ?? code;
      const amount = row?.amount ?? 0;
      drawLeft(page, name, xLabel + 10, y, font, 10);
      drawRight(page, fmt(amount), colAmount, y, font, 10);
      y -= rowHeight;
    }

    // Subtotal
    if (sec && codes.length > 0) {
      const subLabel = `Total ${title.replace("BEBAN ", "").replace("BIAYA ", "")}`;
      drawLeft(page, subLabel, xLabel, y, fontBold, 10);
      drawRight(page, fmt(Math.abs(sec.total)), colAmount, y, fontBold, 10);
      y -= rowHeight;
      line(page, margin + (indent ? 20 : 0), y, width - margin, 0.5);
      y -= gap;
    }

    y -= gap;
    return y;
  }

  /* ── Get section by key ─────────────────────────────────────────── */
  function getSec(key: string): PnlSection | null {
    return st.sections.find((s) => s.key === key) ?? null;
  }

  /* ── PAGE 1 ─────────────────────────────────────────────────────── */
  let y = drawHeader(page1);

  // Pendapatan Usaha
  y = drawSection(page1, y, getSec("pendapatan"), ["4101", "4301"], { title: "PENDAPATAN USAHA" });
  line(page1, margin, y, width - margin, 0.5); // Garis 2
  y -= 8;

  // Beban Langsung
  y = drawSection(page1, y, getSec("langsung"), ["6001", "6002", "6003", "6004"], { title: "BEBAN LANGSUNG" });
  line(page1, margin, y, width - margin, 0.5); // Garis 3
  y -= 8;

  // Laba Kotor
  drawLeft(page1, "LABA KOTOR", colLabel, y, fontBold, 11);
  drawRight(page1, fmt(st.labaKotor), colAmount, y, fontBold, 11);
  y -= 18;
  doubleLine(page1, margin, y, width - margin, 3); // Garis 4 (ganda)
  y -= 10;

  // Beban Operasional Header
  drawLeft(page1, "BEBAN OPERASIONAL", colLabel, y, fontBold, 11);
  y -= 22;

  // Biaya Gaji & SDM
  y = drawSection(page1, y, getSec("sdm"), ["6102", "6103", "6104", "6105", "6106", "6107", "6108", "6109", "6110"], { title: "BIAYA GAJI & SDM", indent: true });
  line(page1, margin + 20, y, width - margin, 0.5); // Garis 5
  y -= 6;

  // Beban Operasional (detail)
  y = drawSection(page1, y, getSec("ops"), ["6201", "6202", "6203", "6204", "6205", "6206", "6207", "6208", "6209", "6210", "6211", "6212", "6213", "6214", "6215", "6216", "6217", "6218"], { title: "BEBAN OPERASIONAL", indent: true });
  line(page1, margin + 20, y, width - margin, 0.5); // Garis 6
  y -= 6;

  // Biaya Pemeliharaan
  y = drawSection(page1, y, getSec("maint"), ["6301", "6302", "6303", "6304", "6305"], { title: "BIAYA PEMELIHARAAN", indent: true });
  line(page1, margin + 20, y, width - margin, 0.5); // Garis 7
  y -= 6;

  // Beban Administrasi
  y = drawSection(page1, y, getSec("adm"), ["6401", "6402", "6403", "6404", "6405", "6406", "6407", "6408"], { title: "BEBAN ADMINISTRASI", indent: true });
  line(page1, margin + 20, y, width - margin, 0.5); // Garis 8
  y -= 10;

  /* ── PAGE 2 ─────────────────────────────────────────────────────── */
  y = margin;

  // Penyusutan & Amortisasi (empty section header)
  drawLeft(page2, "PENYUSUTAN & AMORTISASI", colLabel + 20, y, fontBold, 11);
  y -= 18;
  // No items - just spacing
  y -= 6;

  // Beban Marketing
  y = drawSection(page2, y, getSec("mkt"), ["6501", "6502", "6503", "6504", "6505", "6506"], { title: "BEBAN MARKETING", indent: true });
  y -= 4;

  // Total Beban Operasional
  drawLeft(page2, "TOTAL BEBAN OPERASIONAL", colLabel, y, fontBold, 11);
  drawRight(page2, fmt(st.bebanOps), colAmount, y, fontBold, 11);
  y -= 18;
  line(page2, margin, y, width - margin, 0.5);
  y -= 8;

  // Laba Operasional
  drawLeft(page2, "LABA OPERASIONAL", colLabel, y, fontBold, 11);
  drawRight(page2, fmt(st.labaOperasional), colAmount, y, fontBold, 11);
  y -= 18;
  doubleLine(page2, margin, y, width - margin, 3);
  y -= 10;

  // Non-operasional
  y = drawSection(page2, y, getSec("nonops"), ["4302", "6601", "6602", "6603"], { title: "PENDAPATAN / BEBAN NON-OPERASIONAL" });
  line(page2, margin, y, width - margin, 0.5);
  y -= 8;

  // Laba Bersih
  drawLeft(page2, "LABA BERSIH", colLabel, y, fontBold, 13);
  drawRight(page2, fmt(st.labaBersih), colAmount, y, fontBold, 13);
  y -= 22;
  doubleLine(page2, margin, y, width - margin, 3);
  y -= 10;

  /* ── Footer (page 2) ────────────────────────────────────────────── */
  const now = new Date();
  const generated = `Dicetak: ${now.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })} ${now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB`;
  drawLeft(page2, generated, margin, y, font, 8, rgb(0.5, 0.5, 0.5));
  drawRight(page2, "Dentico Finance Core", colAmount, y, font, 8, rgb(0.5, 0.5, 0.5));

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