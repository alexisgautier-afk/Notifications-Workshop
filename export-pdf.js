// PDF export for B-Style Notifications Workshop deck
// Slide dimensions detected from source CSS:
//   @page { size: 338.67mm 190.5mm; margin: 0; }  →  1280 × 720 px at 96 dpi

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const HTML_FILE = path.resolve(__dirname, 'index.html');
const OUTPUT_FILE = path.resolve(__dirname, 'deck-export.pdf');

// Detected from existing print CSS (338.67mm × 190.5mm = 1280 × 720px @96dpi)
const SLIDE_W_MM = '338.67mm';
const SLIDE_H_MM = '190.5mm';
const VIEWPORT_W = 1280;
const VIEWPORT_H = 720;

(async () => {
  console.log('Launching browser…');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const page = await browser.newPage();

  await page.setViewport({
    width: VIEWPORT_W,
    height: VIEWPORT_H,
    deviceScaleFactor: 2,
  });

  console.log(`Loading file://${HTML_FILE}`);
  await page.goto(`file://${HTML_FILE}`, { waitUntil: 'networkidle0' });

  // Count slides before injecting anything
  const slideCount = await page.evaluate(
    () => document.querySelectorAll('.slide').length
  );
  console.log(`Slides detected in HTML: ${slideCount}`);

  // Inject print styles programmatically — source file is never touched
  await page.addStyleTag({
    content: `
      /* ── layout reset for multi-page PDF ── */
      html, body {
        width: ${VIEWPORT_W}px !important;
        height: auto !important;
        overflow: visible !important;
      }

      .deck {
        position: static !important;
        width: ${VIEWPORT_W}px !important;
        height: auto !important;
        overflow: visible !important;
        display: block !important;
      }

      /* Make every slide a full page */
      .slide {
        position: relative !important;
        inset: auto !important;
        width: ${VIEWPORT_W}px !important;
        height: ${VIEWPORT_H}px !important;
        opacity: 1 !important;
        pointer-events: none !important;
        display: flex !important;
        page-break-after: always !important;
        break-after: page !important;
        overflow: hidden !important;
        transform: none !important;
      }

      /* Remove last-page trailing break */
      .slide:last-of-type {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }

      /* Hide browser-only chrome */
      .nav-zone,
      .noise-overlay,
      .edit-hint,
      .slide-counter,
      .add-row-btn { display: none !important; }

      @page {
        size: ${SLIDE_W_MM} ${SLIDE_H_MM};
        margin: 0;
      }
    `,
  });

  console.log('Exporting PDF…');
  await page.pdf({
    path: OUTPUT_FILE,
    width: SLIDE_W_MM,
    height: SLIDE_H_MM,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await browser.close();

  // ── Validation: count PDF pages via raw byte scan ──
  const pdfBytes = fs.readFileSync(OUTPUT_FILE, 'latin1');
  const pageMatches = pdfBytes.match(/\/Type\s*\/Page\b/g) || [];
  const pdfPageCount = pageMatches.length;

  const sizeKB = Math.round(fs.statSync(OUTPUT_FILE).size / 1024);

  console.log('\n── Export complete ──────────────────────');
  console.log(`  Output : ${OUTPUT_FILE}`);
  console.log(`  Size   : ${sizeKB} KB`);
  console.log(`  Slides in HTML : ${slideCount}`);
  console.log(`  Pages  in PDF  : ${pdfPageCount}`);

  if (pdfPageCount !== slideCount) {
    console.warn(
      `\n  ⚠  Page count mismatch! Expected ${slideCount}, got ${pdfPageCount}.`
    );
    process.exit(1);
  } else {
    console.log(`  ✓  Page count matches (${pdfPageCount})`);
  }
})();
