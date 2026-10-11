/* splitter.js — PDF Splitter tool */

const Splitter = (() => {
  // State
  let pdfJsDoc = null;
  let pdfLibDoc = null;
  let pdfFile = null;
  let selectedPages = new Set();
  let totalPages = 0;
  let isProcessing = false;
  let downloadBlob = null;

  // Elements
  const uploadArea   = document.getElementById('splitter-upload-area');
  const fileInput    = document.getElementById('splitter-file-input');
  const fileInfo     = document.getElementById('splitter-file-info');
  const fileName     = document.getElementById('splitter-file-name');
  const fileMeta     = document.getElementById('splitter-file-meta');
  const removeFile   = document.getElementById('splitter-remove-file');
  const errorEl      = document.getElementById('splitter-error');
  const pagesSection = document.getElementById('splitter-pages-section');
  const pageCount    = document.getElementById('splitter-page-count');
  const pageGrid     = document.getElementById('splitter-page-grid');
  const selectAll    = document.getElementById('splitter-select-all');
  const clearSel     = document.getElementById('splitter-clear-selection');
  const rangeInput   = document.getElementById('splitter-range-input');
  const applyRange   = document.getElementById('splitter-apply-range');
  const actionBtn    = document.getElementById('splitter-action-btn');
  const progressWrap = document.getElementById('splitter-progress');
  const progressFill = document.getElementById('splitter-progress-fill');
  const progressLbl  = document.getElementById('splitter-progress-label');
  const resultCard   = document.getElementById('splitter-result');
  const resultText   = document.getElementById('splitter-result-text');
  const downloadBtn  = document.getElementById('splitter-download-btn');
  const resetBtn     = document.getElementById('splitter-reset-btn');

  // ── Setup ──────────────────────────────────────────────────
  function init() {
    setupDropZone(uploadArea, fileInput, handleFiles);
    removeFile.addEventListener('click', reset);
    selectAll.addEventListener('click', selectAllPages);
    clearSel.addEventListener('click', clearSelection);
    applyRange.addEventListener('click', applyPageRange);
    rangeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyPageRange(); });
    actionBtn.addEventListener('click', doSplit);
    downloadBtn.addEventListener('click', doDownload);
    resetBtn.addEventListener('click', reset);
  }

  // ── File handling ──────────────────────────────────────────
  function handleFiles(files) {
    const file = files[0];
    const err = validatePDF(file);
    if (err) { showError(errorEl, err); return; }
    hideError(errorEl);
    pdfFile = file;
    fileName.textContent = file.name;
    show(fileInfo);
    hide(pagesSection);
    hide(resultCard);
    hide(progressWrap);
    downloadBlob = null;
    loadPDF(file);
  }

  async function loadPDF(file) {
    actionBtn.disabled = true;
    pageGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:20px;">Loading PDF…</div>';
    try {
      [pdfJsDoc, { doc: pdfLibDoc }] = await Promise.all([
        loadPdfJs(file),
        loadPdfLib(file)
      ]);
      totalPages = pdfJsDoc.numPages;
      fileMeta.textContent = `${formatFileSize(file.size)} • ${totalPages} page${totalPages !== 1 ? 's' : ''}`;
      pageCount.textContent = totalPages;
      selectedPages = new Set();
      await renderThumbnails();
      show(pagesSection);
      actionBtn.disabled = false;
    } catch (e) {
      showError(errorEl, e.message || 'This PDF could not be opened. Please try another file.');
      hide(fileInfo);
      pdfFile = null;
    }
  }

  async function renderThumbnails() {
    pageGrid.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const thumb = createThumbPlaceholder(i);
      pageGrid.appendChild(thumb);
    }
    // Render thumbnails progressively
    for (let i = 1; i <= totalPages; i++) {
      const thumbEl = pageGrid.querySelector(`[data-page="${i}"]`);
      try {
        const canvas = await renderPageThumb(pdfJsDoc, i, 96);
        const placeholder = thumbEl.querySelector('.page-thumb-placeholder');
        if (placeholder) placeholder.replaceWith(canvas);
      } catch (e) { /* keep placeholder */ }
    }
  }

  function createThumbPlaceholder(pageNum) {
    const div = document.createElement('div');
    div.className = 'page-thumb';
    div.dataset.page = pageNum;
    div.setAttribute('role', 'listitem');
    div.setAttribute('tabindex', '0');
    div.setAttribute('aria-label', `Page ${pageNum}, click to select`);
    div.setAttribute('aria-pressed', 'false');

    const placeholder = document.createElement('div');
    placeholder.className = 'page-thumb-placeholder';
    placeholder.textContent = '📄';

    const badge = document.createElement('div');
    badge.className = 'check-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = '✓';

    const numEl = document.createElement('div');
    numEl.className = 'page-num';
    numEl.textContent = `Page ${pageNum}`;

    div.appendChild(placeholder);
    div.appendChild(badge);
    div.appendChild(numEl);

    div.addEventListener('click', () => togglePage(pageNum, div));
    div.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePage(pageNum, div); }
    });
    return div;
  }

  function togglePage(pageNum, el) {
    if (selectedPages.has(pageNum)) {
      selectedPages.delete(pageNum);
      el.classList.remove('selected');
      el.setAttribute('aria-pressed', 'false');
    } else {
      selectedPages.add(pageNum);
      el.classList.add('selected');
      el.setAttribute('aria-pressed', 'true');
    }
    rangeInput.value = '';
  }

  function selectAllPages() {
    selectedPages = new Set(Array.from({ length: totalPages }, (_, i) => i + 1));
    pageGrid.querySelectorAll('.page-thumb').forEach(el => {
      el.classList.add('selected');
      el.setAttribute('aria-pressed', 'true');
    });
    rangeInput.value = '';
  }

  function clearSelection() {
    selectedPages.clear();
    pageGrid.querySelectorAll('.page-thumb').forEach(el => {
      el.classList.remove('selected');
      el.setAttribute('aria-pressed', 'false');
    });
    rangeInput.value = '';
  }

  function applyPageRange() {
    const val = rangeInput.value.trim();
    if (!val) { clearSelection(); return; }
    const pages = parsePageRange(val, totalPages);
    if (!pages) {
      showToast('⚠️ Invalid range. Example: 1-3, 5, 7-9');
      return;
    }
    selectedPages = new Set(pages);
    pageGrid.querySelectorAll('.page-thumb').forEach(el => {
      const pg = parseInt(el.dataset.page, 10);
      const sel = selectedPages.has(pg);
      el.classList.toggle('selected', sel);
      el.setAttribute('aria-pressed', sel ? 'true' : 'false');
    });
  }

  // ── Split logic ────────────────────────────────────────────
  async function doSplit() {
    if (isProcessing || !pdfLibDoc) return;

    const mode = document.querySelector('input[name="split-mode"]:checked')?.value || 'extract';

    if (mode === 'extract' && selectedPages.size === 0) {
      showToast('⚠️ Please select at least one page.');
      return;
    }

    isProcessing = true;
    actionBtn.disabled = true;
    hide(resultCard);
    show(progressWrap);
    hideError(errorEl);

    try {
      if (mode === 'each') {
        await splitEveryPage();
      } else {
        await extractSelectedPages();
      }
    } catch (e) {
      showError(errorEl, e.message || 'An error occurred while splitting. Please try again.');
    } finally {
      isProcessing = false;
      actionBtn.disabled = false;
      hide(progressWrap);
    }
  }

  async function extractSelectedPages() {
    const pages = [...selectedPages].sort((a, b) => a - b);
    setProgress(progressFill, progressLbl, 10, 'Extracting pages…');

    const newDoc = await PDFLib.PDFDocument.create();
    const indices = pages.map(p => p - 1);
    const copied = await newDoc.copyPages(pdfLibDoc, indices);
    copied.forEach(p => newDoc.addPage(p));

    setProgress(progressFill, progressLbl, 90, 'Finalizing PDF…');
    const bytes = await newDoc.save();
    const pdfBlob = new Blob([bytes], { type: 'application/pdf' });
    const outputName = pdfFile ? pdfFile.name.replace(/\.pdf$/i, '_extracted.pdf') : 'split-pages.pdf';
    downloadBlob = { type: 'single', name: outputName, blob: pdfBlob };

    setProgress(progressFill, progressLbl, 100, 'Done!');
    resultText.textContent = `Extracted ${pages.length} page${pages.length !== 1 ? 's' : ''} into 1 PDF.`;
    downloadBtn.textContent = '⬇️ Download PDF';
    show(resultCard);
  }

  async function splitEveryPage() {
    const blobs = [];
    const baseName = pdfFile ? pdfFile.name.replace(/\.pdf$/i, '') : 'page';

    for (let i = 1; i <= totalPages; i++) {
      const pct = Math.round((i / totalPages) * 90);
      setProgress(progressFill, progressLbl, pct, `Splitting page ${i} of ${totalPages}…`);

      const newDoc = await PDFLib.PDFDocument.create();
      const [page] = await newDoc.copyPages(pdfLibDoc, [i - 1]);
      newDoc.addPage(page);
      const bytes = await newDoc.save();
      blobs.push({ name: `${baseName}-page-${i}.pdf`, blob: new Blob([bytes], { type: 'application/pdf' }) });
    }

    if (blobs.length === 1) {
      downloadBlob = { type: 'single', name: blobs[0].name, blob: blobs[0].blob };
      resultText.textContent = '1 PDF created.';
      downloadBtn.textContent = '⬇️ Download PDF';
    } else {
      setProgress(progressFill, progressLbl, 95, 'Preparing ZIP…');
      downloadBlob = { type: 'zip', files: blobs, name: `${baseName}-split.zip` };
      resultText.textContent = `${blobs.length} PDFs created. Download as ZIP.`;
      downloadBtn.textContent = '⬇️ Download ZIP';
    }

    setProgress(progressFill, progressLbl, 100, 'Done!');
    show(resultCard);
  }

  function doDownload() {
    if (!downloadBlob) return;
    if (downloadBlob.type === 'single') {
      triggerDownload(downloadBlob.blob, downloadBlob.name);
    } else {
      downloadZip(downloadBlob.files, downloadBlob.name);
    }
  }

  // ── Reset ──────────────────────────────────────────────────
  function reset() {
    pdfJsDoc = null;
    pdfLibDoc = null;
    pdfFile = null;
    selectedPages.clear();
    totalPages = 0;
    isProcessing = false;
    downloadBlob = null;

    hide(fileInfo);
    hide(pagesSection);
    hide(resultCard);
    hide(progressWrap);
    hideError(errorEl);
    pageGrid.innerHTML = '';
    rangeInput.value = '';
    actionBtn.disabled = false;
    document.getElementById('split-mode-extract').checked = true;
    fileInput.value = '';
  }

  return { init, reset };
})();
