/* tojpg.js — PDF to JPG tool */

const ToJpg = (() => {
  let pdfJsDoc = null;
  let pdfFile = null;
  let totalPages = 0;
  let selectedPages = new Set();
  let isProcessing = false;
  let downloadData = null;

  // Elements
  const uploadArea    = document.getElementById('tojpg-upload-area');
  const fileInput     = document.getElementById('tojpg-file-input');
  const fileInfo      = document.getElementById('tojpg-file-info');
  const fileName      = document.getElementById('tojpg-file-name');
  const fileMeta      = document.getElementById('tojpg-file-meta');
  const removeFile    = document.getElementById('tojpg-remove-file');
  const errorEl       = document.getElementById('tojpg-error');
  const settingsSection = document.getElementById('tojpg-settings-section');
  const pagesSelect   = document.getElementById('tojpg-pages-select');
  const rangeRow      = document.getElementById('tojpg-range-row');
  const rangeInput    = document.getElementById('tojpg-range-input');
  const pageGridContainer = document.getElementById('tojpg-page-grid-container');
  const pageGrid      = document.getElementById('tojpg-page-grid');
  const selectAllBtn  = document.getElementById('tojpg-select-all');
  const clearAllBtn   = document.getElementById('tojpg-clear-all');
  const qualitySelect = document.getElementById('tojpg-quality-select');
  const dpiSelect     = document.getElementById('tojpg-dpi-select');
  const actionBtn     = document.getElementById('tojpg-action-btn');
  const progressWrap  = document.getElementById('tojpg-progress');
  const progressFill  = document.getElementById('tojpg-progress-fill');
  const progressLbl   = document.getElementById('tojpg-progress-label');
  const resultCard    = document.getElementById('tojpg-result');
  const resultText    = document.getElementById('tojpg-result-text');
  const downloadBtn   = document.getElementById('tojpg-download-btn');
  const resetBtn      = document.getElementById('tojpg-reset-btn');

  function init() {
    setupDropZone(uploadArea, fileInput, handleFiles);
    removeFile.addEventListener('click', reset);
    resetBtn.addEventListener('click', reset);
    actionBtn.addEventListener('click', doConvert);
    downloadBtn.addEventListener('click', doDownload);

    pagesSelect.addEventListener('change', () => {
      hide(rangeRow);
      hide(pageGridContainer);
      if (pagesSelect.value === 'range') show(rangeRow);
      if (pagesSelect.value === 'selected') show(pageGridContainer);
    });

    selectAllBtn && selectAllBtn.addEventListener('click', () => {
      selectedPages = new Set(Array.from({ length: totalPages }, (_, i) => i + 1));
      pageGrid.querySelectorAll('.page-thumb').forEach(el => {
        el.classList.add('selected');
        el.setAttribute('aria-pressed', 'true');
      });
    });

    clearAllBtn && clearAllBtn.addEventListener('click', () => {
      selectedPages.clear();
      pageGrid.querySelectorAll('.page-thumb').forEach(el => {
        el.classList.remove('selected');
        el.setAttribute('aria-pressed', 'false');
      });
    });
  }

  function handleFiles(files) {
    const file = files[0];
    const err = validatePDF(file);
    if (err) { showError(errorEl, err); return; }
    hideError(errorEl);
    pdfFile = file;
    hide(settingsSection);
    hide(resultCard);
    hide(progressWrap);
    downloadData = null;
    loadPDF(file);
  }

  async function loadPDF(file) {
    try {
      pdfJsDoc = await loadPdfJs(file);
      totalPages = pdfJsDoc.numPages;
      fileName.textContent = file.name;
      fileMeta.textContent = `${formatFileSize(file.size)} • ${totalPages} page${totalPages !== 1 ? 's' : ''}`;
      show(fileInfo);
      selectedPages.clear();
      pagesSelect.value = 'all';
      hide(rangeRow);
      hide(pageGridContainer);
      await buildPageGrid();
      show(settingsSection);
    } catch (e) {
      showError(errorEl, e.message || 'This PDF could not be opened. Please try another file.');
    }
  }

  async function buildPageGrid() {
    pageGrid.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const div = document.createElement('div');
      div.className = 'page-thumb';
      div.dataset.page = i;
      div.setAttribute('role', 'listitem');
      div.setAttribute('tabindex', '0');
      div.setAttribute('aria-label', `Page ${i}`);
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
      numEl.textContent = `Page ${i}`;

      div.appendChild(placeholder);
      div.appendChild(badge);
      div.appendChild(numEl);

      div.addEventListener('click', () => togglePage(i, div));
      div.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePage(i, div); }
      });
      pageGrid.appendChild(div);
    }

    // Progressive thumbnail rendering
    for (let i = 1; i <= Math.min(totalPages, 20); i++) {
      const thumbEl = pageGrid.querySelector(`[data-page="${i}"]`);
      if (!thumbEl) continue;
      try {
        const canvas = await renderPageThumb(pdfJsDoc, i, 80);
        const placeholder = thumbEl.querySelector('.page-thumb-placeholder');
        if (placeholder) placeholder.replaceWith(canvas);
      } catch (e) { /* skip */ }
    }
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
  }

  function getTargetPages() {
    const mode = pagesSelect.value;
    if (mode === 'all') {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (mode === 'range') {
      const val = rangeInput.value.trim();
      if (!val) return null;
      const pages = parsePageRange(val, totalPages);
      if (!pages) { showToast('⚠️ Invalid page range. Example: 1-3, 5, 7-9'); return null; }
      return pages;
    }
    if (mode === 'selected') {
      if (selectedPages.size === 0) { showToast('⚠️ Please select at least one page.'); return null; }
      return [...selectedPages].sort((a, b) => a - b);
    }
    return null;
  }

  async function doConvert() {
    if (isProcessing || !pdfJsDoc) return;

    const pages = getTargetPages();
    if (!pages || pages.length === 0) {
      showToast('⚠️ Please select at least one page to convert.');
      return;
    }

    const quality = parseFloat(qualitySelect.value);
    const scale = parseFloat(dpiSelect.value);

    isProcessing = true;
    actionBtn.disabled = true;
    hide(resultCard);
    show(progressWrap);
    hideError(errorEl);
    downloadData = null;

    const blobs = [];

    try {
      for (let idx = 0; idx < pages.length; idx++) {
        const pageNum = pages[idx];
        const pct = Math.round(((idx) / pages.length) * 90);
        setProgress(progressFill, progressLbl, pct, `Converting page ${idx + 1} of ${pages.length}…`);

        const canvas = await renderPageFullRes(pdfJsDoc, pageNum, scale);
        const blob = await canvasToJpgBlob(canvas, quality);
        blobs.push({ name: `page-${pageNum}.jpg`, blob });

        // Release canvas memory
        canvas.width = 0;
        canvas.height = 0;
      }

      setProgress(progressFill, progressLbl, 95, 'Creating ZIP…');

      // Always package as ZIP — ensures .jpg extension is preserved on all browsers/OS
      downloadData = { type: 'zip', blobs, name: 'pdf-to-jpg.zip' };
      resultText.textContent = blobs.length === 1
        ? '1 JPG image created. Download the ZIP to open it.'
        : `${blobs.length} JPG images created.`;
      downloadBtn.textContent = '⬇️ Download ZIP';

      setProgress(progressFill, progressLbl, 100, 'Done!');
      show(resultCard);
    } catch (e) {
      showError(errorEl, e.message || 'An error occurred during conversion.');
    } finally {
      isProcessing = false;
      actionBtn.disabled = false;
      hide(progressWrap);
    }
  }

  function doDownload() {
    if (!downloadData) return;
    // Always ZIP — single files were getting dropped extensions by the browser
    downloadZip(downloadData.blobs, downloadData.name);
  }

  function reset() {
    pdfJsDoc = null;
    pdfFile = null;
    totalPages = 0;
    selectedPages.clear();
    isProcessing = false;
    downloadData = null;

    hide(fileInfo);
    hide(settingsSection);
    hide(resultCard);
    hide(progressWrap);
    hide(rangeRow);
    hide(pageGridContainer);
    hideError(errorEl);
    pageGrid.innerHTML = '';
    rangeInput.value = '';
    pagesSelect.value = 'all';
    actionBtn.disabled = false;
    fileInput.value = '';
  }

  return { init, reset };
})();
