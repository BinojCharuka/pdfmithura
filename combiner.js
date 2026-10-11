/* combiner.js — PDF Combiner tool */

const Combiner = (() => {
  let pdfItems = [];   // { id, file, pageCount }
  let isProcessing = false;
  let downloadBlob = null;
  let dragSrcId = null;
  let idCounter = 0;

  // Elements
  const uploadArea    = document.getElementById('combiner-upload-area');
  const fileInput     = document.getElementById('combiner-file-input');
  const addMoreInput  = document.getElementById('combiner-add-more-input');
  const errorEl       = document.getElementById('combiner-error');
  const filesSection  = document.getElementById('combiner-files-section');
  const fileCount     = document.getElementById('combiner-file-count');
  const pdfList       = document.getElementById('combiner-pdf-list');
  const actionBtn     = document.getElementById('combiner-action-btn');
  const progressWrap  = document.getElementById('combiner-progress');
  const progressFill  = document.getElementById('combiner-progress-fill');
  const progressLbl   = document.getElementById('combiner-progress-label');
  const resultCard    = document.getElementById('combiner-result');
  const downloadBtn   = document.getElementById('combiner-download-btn');
  const resetBtn      = document.getElementById('combiner-reset-btn');

  function init() {
    setupDropZone(uploadArea, fileInput, handleFiles);
    addMoreInput.addEventListener('change', () => {
      if (addMoreInput.files.length) handleFiles(addMoreInput.files);
      addMoreInput.value = '';
    });
    actionBtn.addEventListener('click', doCombine);
    downloadBtn.addEventListener('click', doDownload);
    resetBtn.addEventListener('click', reset);

    // Drag reorder using shared utility
    makeDraggableList(pdfList, updateOrder);
  }

  function updateOrder() {
    const newOrderIds = Array.from(pdfList.querySelectorAll('.pdf-card')).map(el => parseInt(el.dataset.id, 10));
    pdfItems.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
    pdfList.querySelectorAll('.card-order').forEach((el, idx) => {
      el.textContent = idx + 1;
    });
  }

  // ── File handling ──────────────────────────────────────────
  async function handleFiles(files) {
    const arr = Array.from(files);
    const invalid = arr.find(f => !f.type.includes('pdf') && !f.name.toLowerCase().endsWith('.pdf'));
    if (invalid) {
      showError(errorEl, `"${invalid.name}" is not a valid PDF file. Please select only PDF files.`);
      return;
    }
    hideError(errorEl);
    hide(resultCard);
    downloadBlob = null;

    for (const file of arr) {
      const id = ++idCounter;
      let pages = '?';
      try {
        const doc = await loadPdfJs(file);
        pages = doc.numPages;
      } catch (e) { /* could not read page count */ }
      pdfItems.push({ id, file, pages });
    }

    renderList();
    show(filesSection);
    fileCount.textContent = pdfItems.length;
  }

  // ── Render list ────────────────────────────────────────────
  function renderList() {
    pdfList.innerHTML = '';
    pdfItems.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'pdf-card';
      card.setAttribute('draggable', 'true');
      card.dataset.id = item.id;
      card.setAttribute('role', 'listitem');
      card.setAttribute('aria-label', `PDF ${idx + 1}: ${item.file.name}`);

      card.innerHTML = `
        <div class="drag-handle" title="Drag to reorder" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="5" r="1.5" fill="currentColor"/><circle cx="15" cy="5" r="1.5" fill="currentColor"/>
            <circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="9" cy="19" r="1.5" fill="currentColor"/><circle cx="15" cy="19" r="1.5" fill="currentColor"/>
          </svg>
        </div>
        <span class="card-order">${idx + 1}</span>
        <div class="pdf-icon">📄</div>
        <div class="card-details">
          <div class="card-name">${item.file.name}</div>
          <div class="card-meta">${formatFileSize(item.file.size)} • ${item.pages} page${item.pages !== 1 ? 's' : ''}</div>
        </div>
        <div class="card-actions">
          <button class="card-action-btn card-move-up" data-id="${item.id}" aria-label="Move Up" title="Move Up">↑</button>
          <button class="card-action-btn card-move-down" data-id="${item.id}" aria-label="Move Down" title="Move Down">↓</button>
          <button class="card-remove" data-id="${item.id}" aria-label="Remove ${item.file.name}" title="Remove">✕</button>
        </div>
      `;

      card.querySelector('.card-move-up').addEventListener('click', () => moveItem(item.id, -1));
      card.querySelector('.card-move-down').addEventListener('click', () => moveItem(item.id, 1));
      card.querySelector('.card-remove').addEventListener('click', () => removeItem(item.id));
      pdfList.appendChild(card);
    });
    fileCount.textContent = pdfItems.length;
  }

  function moveItem(id, dir) {
    const idx = pdfItems.findIndex(i => i.id === id);
    if (idx === -1) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= pdfItems.length) return;
    
    // Swap
    const temp = pdfItems[idx];
    pdfItems[idx] = pdfItems[newIdx];
    pdfItems[newIdx] = temp;
    
    renderList();
  }

  function removeItem(id) {
    pdfItems = pdfItems.filter(i => i.id !== id);
    renderList();
    if (pdfItems.length === 0) hide(filesSection);
  }

  // ── (Drag reorder logic moved to utils.js) ─────────────────

  // ── Combine ────────────────────────────────────────────────
  async function doCombine() {
    if (isProcessing) return;
    if (pdfItems.length < 1) {
      showToast('⚠️ Please upload at least one PDF file.');
      return;
    }

    isProcessing = true;
    actionBtn.disabled = true;
    hide(resultCard);
    show(progressWrap);
    hideError(errorEl);
    downloadBlob = null;

    try {
      const combinedDoc = await PDFLib.PDFDocument.create();
      let totalPagesCombined = 0;

      for (let idx = 0; idx < pdfItems.length; idx++) {
        const item = pdfItems[idx];
        const pct = Math.round(((idx) / pdfItems.length) * 90);
        setProgress(progressFill, progressLbl, pct, `Processing document ${idx + 1} of ${pdfItems.length}…`);

        let srcDoc;
        try {
          const buf = await item.file.arrayBuffer();
          srcDoc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
        } catch (e) {
          throw new Error(`Could not read "${item.file.name}". It may be corrupted or password-protected.`);
        }

        const pageCount = srcDoc.getPageCount();
        const indices = Array.from({ length: pageCount }, (_, i) => i);
        const copiedPages = await combinedDoc.copyPages(srcDoc, indices);
        copiedPages.forEach(p => combinedDoc.addPage(p));
        totalPagesCombined += pageCount;
      }

      setProgress(progressFill, progressLbl, 95, 'Finalizing PDF…');
      const bytes = await combinedDoc.save();
      downloadBlob = new Blob([bytes], { type: 'application/pdf' });

      setProgress(progressFill, progressLbl, 100, 'Done!');
      const resultTextEl = resultCard.querySelector('.result-text');
      if (resultTextEl) {
        resultTextEl.textContent = `Combined ${pdfItems.length} PDFs (${totalPagesCombined} pages) successfully!`;
      }
      downloadBtn.textContent = '⬇️ Download PDF';
      show(resultCard);
    } catch (e) {
      showError(errorEl, e.message || 'An error occurred while combining PDFs. Please try again.');
    } finally {
      isProcessing = false;
      actionBtn.disabled = false;
      hide(progressWrap);
    }
  }

  function doDownload() {
    if (!downloadBlob) return;
    triggerDownload(downloadBlob, 'combined.pdf');
  }

  // ── Reset ──────────────────────────────────────────────────
  function reset() {
    pdfItems = [];
    isProcessing = false;
    downloadBlob = null;
    dragSrcId = null;
    idCounter = 0;
    hide(filesSection);
    hide(resultCard);
    hide(progressWrap);
    hideError(errorEl);
    pdfList.innerHTML = '';
    actionBtn.disabled = false;
    fileInput.value = '';
  }

  return { init, reset };
})();
