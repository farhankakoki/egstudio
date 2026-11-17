import { jsPDF } from 'jspdf';
import type { DrawingSettings, OrthographicDrawing } from '../types/geometry';

export type ExportMode = 'clean' | 'with_construction';

interface SvgSheetOptions {
  drawing: OrthographicDrawing;
  settings: DrawingSettings;
  mode: ExportMode;
  solidName: string;
}

/**
 * Generates a complete, standalone, ISO-style Engineering Graphics SVG sheet
 * containing Elevation, Plan, XY reference line, optional construction projectors,
 * dimensions, and a clean title block.
 */
export function buildDrawingSheetSVG({
  drawing,
  settings,
  mode,
  solidName,
}: SvgSheetOptions): string {
  const showConstruction = mode === 'with_construction';
  const showDimensions = settings.showDimensions;
  const showHidden = settings.showHidden;
  const showLabels = settings.showLabels;
  const isFirstAngle = drawing.convention === 'first_angle';

  const { minX, maxX, minPlanY, maxPlanY, minElevZ, maxElevZ } = drawing.bounds;
  const marginX = 48;
  const xyWidth = Math.max(220, maxX - minX + marginX * 2);
  const centerX = (minX + maxX) / 2;
  const leftX = centerX - xyWidth / 2;
  const rightX = centerX + xyWidth / 2;

  // Vertical layout in SVG coords (Y increases downward)
  const topExtent = isFirstAngle ? maxElevZ : maxPlanY;
  const bottomExtent = isFirstAngle ? maxPlanY : maxElevZ;
  const padTop = 55;
  const padBottom = 68; // Space for title block
  const gapAbove = Math.max(30, topExtent + 28);
  const gapBelow = Math.max(30, bottomExtent + 28);

  const svgWidth = Math.max(320, xyWidth + 40);
  const svgHeight = padTop + gapAbove + gapBelow + padBottom;
  const originX = svgWidth / 2 - centerX;
  const xyY = padTop + gapAbove;

  const toElevSvgY = (z: number) => (isFirstAngle ? xyY - z : xyY + z);
  const toPlanSvgY = (y: number) => (isFirstAngle ? xyY + y : xyY - y);

  const escapeXml = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const linesMarkup: string[] = [];

  // Projectors
  if (showConstruction) {
    for (const p of drawing.projectors) {
      const px1 = originX + p.x1;
      const py1 = toElevSvgY(p.y1);
      const py2 = toPlanSvgY(p.y2);
      linesMarkup.push(
        `<line x1="${px1.toFixed(2)}" y1="${py1.toFixed(2)}" x2="${px1.toFixed(2)}" y2="${py2.toFixed(2)}" stroke="#94a3b8" stroke-width="0.6" />`
      );
    }
  }

  // XY Reference Line
  linesMarkup.push(
    `<line x1="${(originX + leftX).toFixed(2)}" y1="${xyY.toFixed(2)}" x2="${(originX + rightX).toFixed(2)}" y2="${xyY.toFixed(2)}" stroke="#0f172a" stroke-width="1.2" />`
  );
  linesMarkup.push(
    `<text x="${(originX + leftX - 10).toFixed(2)}" y="${(xyY + 3.5).toFixed(2)}" font-family="sans-serif" font-size="10" font-weight="600" fill="#0f172a" text-anchor="end">X</text>`
  );
  linesMarkup.push(
    `<text x="${(originX + rightX + 10).toFixed(2)}" y="${(xyY + 3.5).toFixed(2)}" font-family="sans-serif" font-size="10" font-weight="600" fill="#0f172a" text-anchor="start">Y</text>`
  );

  // Elevation & Plan edges
  const renderLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    style: string
  ) => {
    if (style === 'hidden' && !showHidden) return '';
    if (style === 'axis' && !showConstruction) return '';
    if (style === 'visible') {
      return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round" />`;
    }
    if (style === 'hidden') {
      return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#475569" stroke-width="1.15" stroke-dasharray="4 2.5" stroke-linecap="round" />`;
    }
    if (style === 'axis') {
      return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#2563eb" stroke-width="0.85" stroke-dasharray="8 2.5 1.5 2.5" />`;
    }
    return '';
  };

  for (const l of drawing.elevationLines) {
    const el = renderLine(originX + l.x1, toElevSvgY(l.y1), originX + l.x2, toElevSvgY(l.y2), l.style);
    if (el) linesMarkup.push(el);
  }
  for (const l of drawing.planLines) {
    const el = renderLine(originX + l.x1, toPlanSvgY(l.y1), originX + l.x2, toPlanSvgY(l.y2), l.style);
    if (el) linesMarkup.push(el);
  }

  // Vertex labels
  if (showLabels) {
    const drawnElev = new Set<string>();
    for (const pt of drawing.elevationPoints) {
      const key = `${Math.round(pt.x)}_${Math.round(pt.y)}`;
      if (drawnElev.has(key)) continue;
      drawnElev.add(key);
      linesMarkup.push(
        `<text x="${(originX + pt.x + 3).toFixed(2)}" y="${(toElevSvgY(pt.y) - 3).toFixed(2)}" font-family="monospace" font-size="7.5" fill="#1e293b">${escapeXml(pt.label)}</text>`
      );
    }

    const drawnPlan = new Set<string>();
    for (const pt of drawing.planPoints) {
      const key = `${Math.round(pt.x)}_${Math.round(pt.y)}`;
      if (drawnPlan.has(key)) continue;
      drawnPlan.add(key);
      linesMarkup.push(
        `<text x="${(originX + pt.x + 3).toFixed(2)}" y="${(toPlanSvgY(pt.y) + 8).toFixed(2)}" font-family="monospace" font-size="7.5" fill="#1e293b">${escapeXml(pt.label)}</text>`
      );
    }
  }

  // Dimensions
  if (showDimensions) {
    const dimX = originX + maxX + 18;
    const elevTop = toElevSvgY(maxElevZ);
    const elevBot = toElevSvgY(minElevZ);
    if (Math.abs(elevTop - elevBot) > 4) {
      linesMarkup.push(
        `<line x1="${(originX + maxX + 2).toFixed(2)}" y1="${elevTop.toFixed(2)}" x2="${(dimX + 4).toFixed(2)}" y2="${elevTop.toFixed(2)}" stroke="#64748b" stroke-width="0.6" />`,
        `<line x1="${(originX + maxX + 2).toFixed(2)}" y1="${elevBot.toFixed(2)}" x2="${(dimX + 4).toFixed(2)}" y2="${elevBot.toFixed(2)}" stroke="#64748b" stroke-width="0.6" />`,
        `<line x1="${dimX.toFixed(2)}" y1="${elevTop.toFixed(2)}" x2="${dimX.toFixed(2)}" y2="${elevBot.toFixed(2)}" stroke="#1d4ed8" stroke-width="0.75" />`,
        `<text x="${(dimX + 4).toFixed(2)}" y="${((elevTop + elevBot) / 2 + 3).toFixed(2)}" font-family="monospace" font-size="7.5" fill="#1d4ed8">${escapeXml(`${(maxElevZ - minElevZ).toFixed(1)} mm`)}</text>`
      );
    }
    const planTop = toPlanSvgY(minPlanY);
    const planBot = toPlanSvgY(maxPlanY);
    const dimY = Math.max(planTop, planBot) + 14;
    const pxLeft = originX + minX;
    const pxRight = originX + maxX;
    if (pxRight - pxLeft > 4) {
      linesMarkup.push(
        `<line x1="${pxLeft.toFixed(2)}" y1="${Math.max(planTop, planBot).toFixed(2)}" x2="${pxLeft.toFixed(2)}" y2="${(dimY + 4).toFixed(2)}" stroke="#64748b" stroke-width="0.6" />`,
        `<line x1="${pxRight.toFixed(2)}" y1="${Math.max(planTop, planBot).toFixed(2)}" x2="${pxRight.toFixed(2)}" y2="${(dimY + 4).toFixed(2)}" stroke="#64748b" stroke-width="0.6" />`,
        `<line x1="${pxLeft.toFixed(2)}" y1="${dimY.toFixed(2)}" x2="${pxRight.toFixed(2)}" y2="${dimY.toFixed(2)}" stroke="#1d4ed8" stroke-width="0.75" />`,
        `<text x="${((pxLeft + pxRight) / 2).toFixed(2)}" y="${(dimY + 10).toFixed(2)}" font-family="monospace" font-size="7.5" fill="#1d4ed8" text-anchor="middle">${escapeXml(`${(maxX - minX).toFixed(1)} mm`)}</text>`
      );
    }
  }

  // View Titles & Title Block
  const elevTitleY = isFirstAngle ? 22 : xyY + gapBelow - 10;
  const planTitleY = isFirstAngle ? xyY + gapBelow - 4 : 22;
  const titleBlockY = svgHeight - 44;

  const conventionLabel = isFirstAngle ? 'First-Angle Projection (KTU)' : 'Third-Angle Projection';
  const titleText = settings.drawingTitle.trim() || `${solidName} — Orthographic Projection`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">
  <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="#ffffff" />
  <rect x="8" y="8" width="${svgWidth - 16}" height="${svgHeight - 16}" fill="none" stroke="#0f172a" stroke-width="1" />
  <text x="18" y="${elevTitleY}" font-family="sans-serif" font-size="9" font-weight="600" fill="#475569">ELEVATION (FRONT VIEW)</text>
  <text x="18" y="${planTitleY}" font-family="sans-serif" font-size="9" font-weight="600" fill="#475569">PLAN (TOP VIEW)</text>
  ${linesMarkup.join('\n  ')}
  <line x1="8" y1="${titleBlockY}" x2="${svgWidth - 8}" y2="${titleBlockY}" stroke="#0f172a" stroke-width="0.9" />
  <text x="16" y="${titleBlockY + 16}" font-family="sans-serif" font-size="10" font-weight="700" fill="#0f172a">${escapeXml(titleText)}</text>
  <text x="16" y="${titleBlockY + 29}" font-family="sans-serif" font-size="8" fill="#475569">${escapeXml(solidName)} · ${escapeXml(conventionLabel)} · Scale: ${escapeXml(settings.scaleLabel)} · Mode: ${showConstruction ? 'With Construction Lines' : 'Clean Final Drawing'}</text>
  <text x="${svgWidth - 16}" y="${titleBlockY + 22}" font-family="monospace" font-size="8" fill="#64748b" text-anchor="end">EG STUDIO</text>
</svg>`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportDrawingSVG(options: SvgSheetOptions, filename = 'eg-studio-drawing.svg') {
  const svg = buildDrawingSheetSVG(options);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, filename);
}

export async function exportDrawingPNG(
  options: SvgSheetOptions,
  filename = 'eg-studio-drawing.png'
): Promise<void> {
  const svg = buildDrawingSheetSVG(options);
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = 3;
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((pngBlob) => {
        URL.revokeObjectURL(url);
        if (pngBlob) {
          triggerDownload(pngBlob, filename);
          resolve();
        } else {
          reject(new Error('PNG generation failed'));
        }
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG into image'));
    };
    img.src = url;
  });
}

export function exportDrawingPDF(
  options: SvgSheetOptions,
  filename = 'eg-studio-drawing-a4.pdf'
) {
  const { drawing, settings, mode, solidName } = options;
  const showConstruction = mode === 'with_construction';
  const isFirstAngle = drawing.convention === 'first_angle';

  // A4 Portrait (210 x 297 mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = 210;
  const pageH = 297;
  const margin = 12;

  // Drawing border
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.rect(margin, margin, pageW - margin * 2, pageH - margin * 2);

  // Title block at bottom right
  const tbY = pageH - margin - 26;
  doc.setLineWidth(0.4);
  doc.line(margin, tbY, pageW - margin, tbY);
  doc.line(140, tbY, 140, pageH - margin);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(settings.drawingTitle || `${solidName} — Orthographic Projection`, margin + 4, tbY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Solid: ${solidName}`, margin + 4, tbY + 16);
  doc.text(
    `Convention: ${isFirstAngle ? 'First-Angle Projection' : 'Third-Angle Projection'} · Mode: ${showConstruction ? 'With Construction Lines' : 'Clean Final'}`,
    margin + 4,
    tbY + 21.5
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Scale: ${settings.scaleLabel}`, 144, tbY + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('All dimensions in mm', 144, tbY + 16);
  doc.text('Generated by EG Studio', 144, tbY + 21.5);

  // Compute auto-fit scale inside drawing area
  const drawAreaTop = margin + 12;
  const drawAreaBottom = tbY - 10;
  const drawAreaW = pageW - margin * 2 - 20;
  const drawAreaH = drawAreaBottom - drawAreaTop;

  const { minX, maxX, minPlanY, maxPlanY, minElevZ, maxElevZ } = drawing.bounds;
  const modelW = Math.max(40, maxX - minX + 40);
  const aboveExtent = Math.max(25, (isFirstAngle ? maxElevZ : maxPlanY) + 20);
  const belowExtent = Math.max(25, (isFirstAngle ? maxPlanY : maxElevZ) + 20);
  const modelH = aboveExtent + belowExtent;

  const scale = Math.min(1.3, drawAreaW / modelW, drawAreaH / modelH);
  const centerX = pageW / 2 - ((minX + maxX) / 2) * scale;
  const xyY = drawAreaTop + (drawAreaH * aboveExtent) / modelH;

  const toElevPdfY = (z: number) => (isFirstAngle ? xyY - z * scale : xyY + z * scale);
  const toPlanPdfY = (y: number) => (isFirstAngle ? xyY + y * scale : xyY - y * scale);

  // Projectors
  if (showConstruction) {
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.18);
    for (const p of drawing.projectors) {
      const px = centerX + p.x1 * scale;
      doc.line(px, toElevPdfY(p.y1), px, toPlanPdfY(p.y2));
    }
  }

  // XY reference line
  const xyLeft = margin + 12;
  const xyRight = pageW - margin - 12;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.45);
  doc.line(xyLeft, xyY, xyRight, xyY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('X', xyLeft - 4, xyY + 1);
  doc.text('Y', xyRight + 2, xyY + 1);

  const drawLines = (lines: typeof drawing.planLines, mapY: (v: number) => number) => {
    for (const l of lines) {
      if (l.style === 'hidden' && !settings.showHidden) continue;
      if (l.style === 'axis' && !showConstruction) continue;

      const x1 = centerX + l.x1 * scale;
      const y1 = mapY(l.y1);
      const x2 = centerX + l.x2 * scale;
      const y2 = mapY(l.y2);

      if (l.style === 'visible') {
        doc.setLineDashPattern([], 0);
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.6);
        doc.line(x1, y1, x2, y2);
      } else if (l.style === 'hidden') {
        doc.setLineDashPattern([2.2, 1.4], 0);
        doc.setDrawColor(71, 85, 105);
        doc.setLineWidth(0.35);
        doc.line(x1, y1, x2, y2);
      } else if (l.style === 'axis') {
        doc.setLineDashPattern([5, 1.5, 1, 1.5], 0);
        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(0.28);
        doc.line(x1, y1, x2, y2);
      }
    }
    doc.setLineDashPattern([], 0);
  };

  drawLines(drawing.elevationLines, toElevPdfY);
  drawLines(drawing.planLines, toPlanPdfY);

  // View labels
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('ELEVATION (FRONT VIEW)', margin + 6, isFirstAngle ? drawAreaTop + 2 : drawAreaBottom - 4);
  doc.text('PLAN (TOP VIEW)', margin + 6, isFirstAngle ? drawAreaBottom - 4 : drawAreaTop + 2);

  if (settings.showLabels) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    const seenE = new Set<string>();
    for (const pt of drawing.elevationPoints) {
      const k = `${Math.round(pt.x)}_${Math.round(pt.y)}`;
      if (seenE.has(k)) continue;
      seenE.add(k);
      doc.text(pt.label, centerX + pt.x * scale + 1.5, toElevPdfY(pt.y) - 1.5);
    }
    const seenP = new Set<string>();
    for (const pt of drawing.planPoints) {
      const k = `${Math.round(pt.x)}_${Math.round(pt.y)}`;
      if (seenP.has(k)) continue;
      seenP.add(k);
      doc.text(pt.label, centerX + pt.x * scale + 1.5, toPlanPdfY(pt.y) + 3);
    }
  }

  doc.save(filename);
}
