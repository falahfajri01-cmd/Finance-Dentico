/* ────────────────────────────────────────────────────────────────────
 * PDF Export — Laporan Laba Rugi
 * Generated to match user's template specification:
 *   Line 1: {Brand} DENTAL
 *   Line 2: {Brand} - {Branch}
 *   Line 3: Laporan Laba Rugi
 *   Line 4: Periode {Month Year}
 *   Then full P&L table
 * ──────────────────────────────────────────────────────────────────── */

import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";
import type { PnlStatement, PnlSection } from "../data/pnl";
import { fmtRpFull } from "../data/finance";

export interface PnlPdfData {
  entity: string;
  branch: string;
  period: string;
  periodLabel: string;
  statement: PnlStatement;
}

function drawRight(page: any, text: string, x: number, y: number, font: any, size: number, color = rgb(0, 0, 0)) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: x - w, y, size, font, color });
}

function drawLeft(page: any, text: string, x: number, y: number, font: any, size: number, color = rgb(0, 0, 0)) {
  page.drawText(text, { x, y, size, font, color });
}

export function formatPeriodHeader(period: string, periodLabel: string): string {
  if (period === "Q3" || period === "2026-Q3") return `Periode ${periodLabel}`;
  if (/^\d{4}-\d{2}$/.test(period)) return `Periode ${periodLabel}`;
  if (/^\d{4}-Q\d$/.test(period)) return `Periode ${periodLabel}`;
  if (/^\d{4}-YTD$/.test(period)) return `Periode ${periodLabel}`;
  return `Periode ${periodLabel}`;
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

export async function generatePnlPdf(data: PnlPdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  let page = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = page.getSize();
  const margin = 50;
  const colLabel = margin;
  const colAmount = width - margin - 5;
  const rowHeight = 20;
  const indentStep = 15;
  const headerSize = 10;
  const bodySize = 9;
  const totalSize = 10;
  let y = height - margin;

  const brand = extractBrand(data.entity);
  const branch = extractBranch(data.branch);

  // ── HEADER ────────────────────────────────────────────────────────
  drawLeft(page, `${brand} DENTAL`, margin, y, fontBold, 18, rgb(0, 0.2, 0.5));
  y -= 26;
  drawLeft(page, `${brand} - ${branch}`, margin, y, font, 13, rgb(0.2, 0.2, 0.2));
  y -= 20;
  drawLeft(page, "LAPORAN LABA RUGI", margin, y, fontBold, 16, rgb(0, 0, 0));
  y -= 24;

  const periodHeader = formatPeriodHeader(data.period, data.periodLabel);
  drawLeft(page, periodHeader, margin, y, font, 12, rgb(0.3, 0.3, 0.3));
  y -= 10;

  page.drawLine({
    start: { x: margin, y: y },
    end: { x: width - margin, y: y },
    thickness: 1,
    color: rgb(0.6, 0.6, 0.6),
  });
  y -= 18;

  function drawSection(sec: PnlSection, isBebanChild: boolean) {
    if (y < margin + 60) {
      page = pdfDoc.addPage(PageSizes.A4);
      const { height: h } = page.getSize();
      y = h - margin;
    }

    const secTitle = sec.key === "pendapatan" ? "PENDAPATAN USAHA"
      : sec.key === "langsung" ? "BIAYA LANGSUNG"
      : sec.key === "nonops" ? "PENDAPATAN / BEBAN NON-OPERASIONAL"
      : sec.title.replace("BIAYA ", "").toUpperCase();

    drawLeft(page, secTitle, margin, y, fontBold, headerSize, rgb(0, 0.2, 0.5));
    y -= rowHeight;

    for (const row of sec.rows) {
      if (y < margin + 30) {
        page = pdfDoc.addPage(PageSizes.A4);
        const { height: h } = page.getSize();
        y = h - margin;
      }

      const indent = isBebanChild ? indentStep : 0;
      const labelX = colLabel + indent;

      drawLeft(page, row.name, labelX, y, row.drillable ? font : fontOblique, bodySize, rgb(0, 0, 0));
      drawRight(page, fmtRpFull(row.amount).replace("Rp ", ""), colAmount, y, font, bodySize);
      y -= rowHeight;
    }

    if (y < margin + 30) {
      page = pdfDoc.addPage(PageSizes.A4);
      const { height: h } = page.getSize();
      y = h - margin;
    }

    const subLabel = sec.key === "pendapatan" ? "TOTAL PENDAPATAN"
      : sec.key === "langsung" ? "TOTAL BEBAN LANGSUNG"
      : sec.key === "nonops" ? "TOTAL PENDAPATAN / BEBAN NON-OPERASIONAL"
      : `TOTAL ${sec.title.replace("BIAYA ", "").toUpperCase()}`;

    drawLeft(page, subLabel, margin, y, fontBold, totalSize);
    drawRight(page, fmtRpFull(Math.abs(sec.total)).replace("Rp ", ""), colAmount, y, fontBold, totalSize);
    y -= rowHeight + 4;
  }

  // ── Draw all sections ───────────────────────────────────────────
  drawSection(data.statement.sections.find(s => s.key === "pendapatan")!, false);
  drawSection(data.statement.sections.find(s => s.key === "langsung")!, false);

  // LABA KOTOR
  if (y < margin + 30) {
    page = pdfDoc.addPage(PageSizes.A4);
    const { height: h } = page.getSize();
    y = h - margin;
  }
  page.drawLine({
    start: { x: margin, y: y + 4 },
    end: { x: width - margin, y: y + 4 },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.6),
  });
  drawLeft(page, "LABA KOTOR", margin, y, fontBold, totalSize, rgb(0, 0.2, 0.5));
  drawRight(page, fmtRpFull(data.statement.labaKotor).replace("Rp ", ""), colAmount, y, fontBold, totalSize, rgb(0, 0.2, 0.5));
  y -= rowHeight + 8;

  // BEBAN OPERASIONAL header
  drawLeft(page, "BEBAN OPERASIONAL", margin, y, fontBold, headerSize, rgb(0.5, 0.3, 0));
  y -= rowHeight;

  // Children
  const bebanChildren = ["sdm", "ops", "maint", "adm", "mkt"];
  bebanChildren.forEach(key => {
    drawSection(data.statement.sections.find(s => s.key === key)!, true);
  });

  // TOTAL BEBAN OPERASIONAL
  if (y < margin + 30) {
    page = pdfDoc.addPage(PageSizes.A4);
    const { height: h } = page.getSize();
    y = h - margin;
  }
  page.drawLine({
    start: { x: margin, y: y + 4 },
    end: { x: width - margin, y: y + 4 },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.6),
  });
  drawLeft(page, "TOTAL BEBAN OPERASIONAL", margin, y, fontBold, totalSize);
  drawRight(page, fmtRpFull(data.statement.bebanOps).replace("Rp ", ""), colAmount, y, fontBold, totalSize);
  y -= rowHeight + 8;

  // LABA OPERASIONAL
  page.drawLine({
    start: { x: margin, y: y + 4 },
    end: { x: width - margin, y: y + 4 },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.6),
  });
  drawLeft(page, "LABA OPERASIONAL", margin, y, fontBold, totalSize, rgb(0, 0.2, 0.5));
  drawRight(page, fmtRpFull(data.statement.labaOperasional).replace("Rp ", ""), colAmount, y, fontBold, totalSize, rgb(0, 0.2, 0.5));
  y -= rowHeight + 8;

  // NON-OPERASIONAL
  drawSection(data.statement.sections.find(s => s.key === "nonops")!, false);

  // LABA BERSIH
  if (y < margin + 50) {
    page = pdfDoc.addPage(PageSizes.A4);
    const { height: h } = page.getSize();
    y = h - margin;
  }
  page.drawLine({
    start: { x: margin, y: y + 8 },
    end: { x: width - margin, y: y + 8 },
    thickness: 1.5,
    color: rgb(0, 0.2, 0.5),
  });
  y -= 10;
  drawLeft(page, "LABA BERSIH", margin, y, fontBold, 14, rgb(0, 0.2, 0.5));
  drawRight(page, fmtRpFull(data.statement.labaBersih).replace("Rp ", ""), colAmount, y, fontBold, 14, rgb(0, 0.2, 0.5));
  y -= 22;

  const marginPct = data.statement.pendapatan !== 0
    ? ((data.statement.labaBersih / data.statement.pendapatan) * 100).toFixed(2)
    : "0.00";
  drawLeft(page, `Net Margin: ${marginPct}%`, margin, y, fontOblique, 9, rgb(0.4, 0.4, 0.4));
  y -= 30;

  // FOOTER
  page.drawLine({
    start: { x: margin, y: y },
    end: { x: width - margin, y: y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 16;

  const now = new Date();
  const generated = `Dicetak: ${now.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })} ${now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB`;
  drawLeft(page, generated, margin, y, fontOblique, 8, rgb(0.5, 0.5, 0.5));
  drawRight(page, "Dentico Finance Core", colAmount, y, fontOblique, 8, rgb(0.5, 0.5, 0.5));

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