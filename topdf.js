/* topdf.js — JPG / PNG to PDF tool */

const ToPdf = (() => {
  // State
  let imageItems = [];   // { id, file, dataUrl, width, height }
  let isProcessing = false;
  let downloadBlob = null;
  let dragSrcId = null;
  let idCounter = 0;

  // Elements
  const uploadArea   = document.getElementById('topdf-upload-area');
  const fileInput    = document.getElementById('topdf-file-input');
  const addMoreInput = document.getElementById('topdf-add-more-input');
  const errorEl      = document.getElementById('topdf-error');
  const imagesSection = document.getElementById('topdf-images-section');
  const imageCount   = document.getElementById('topdf-image-count');
  const imageList    = document.getElementById('topdf-image-list');
  const pageSizeEl   = document.getElementById('topdf-page-size');
  const orientEl     = document.getElementById('topdf-orientation');
  const fitEl        = document.getElementById('topdf-image-fit');
  const marginEl     = document.getElementById('topdf-margin');
  const actionBtn    = document.getElementById('topdf-action-btn');
  const progressWrap = document.getElementById('topdf-progress');
  const progressFill = document.getElementById('topdf-progress-fill');
  const progressLbl  = document.getElementById('topdf-progress-label');
  const resultCard   = document.getElementById('topdf-result');
  const downloadBtn  = document.getElementById('topdf-download-btn');
  const resetBtn     = document.getElementById('topdf-reset-btn');

  function init() {
    setupDropZone(uploadArea, fileInput, handleFiles);
    addMoreInput.addEventListener('change', () => {
      if (addMoreInput.files.length) handleFiles(addMoreInput.files);
      addMoreInput.value = '';
    });
    actionBtn.addEventListener('click', doCreate);
    downloadBtn.addEventListener('click', doDownload);
    resetBtn.addEventListener('click', reset);

    // Drag-and-drop reorder
    imageList.addEventListener('dragstart', onDragStart);
    imageList.addEventListener('dragover', onDragOver);
    imageList.addEventListener('dragleave', onDragLeave);
    imageList.addEventListener('drop', onDrop);
    imageList.addEventListener('dragend', onDragEnd);
  }

  // ── File handling ──────────────────────────────────────────
  async function handleFiles(files) {
    const arr = Array.from(files);
    const err = validateImages(arr);
    if (err) { showError(errorEl, err); return; }
    hideError(errorEl);
    hide(resultCard);
    downloadBlob = null;

    for (const file of arr) {
      const id = ++idCounter;
      const dataUrl = await fileToDataUrl(file);
      const dims = await getImageDimensions(file);
      imageItems.push({ id, file, dataUrl, width: dims.width, height: dims.height });
    }

    renderList();
    show(imagesSection);
    imageCount.textContent = imageItems.length;
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Render list ────────────────────────────────────────────
  function renderList() {
    imageList.innerHTML = '';
    imageItems.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'image-card';
      card.setAttribute('draggable', 'true');
      card.dataset.id = item.id;
      card.setAttribute('role', 'listitem');
      card.setAttribute('aria-label', `Image ${idx + 1}: ${item.file.name}`);

      card.innerHTML = `
        <div class="drag-handle" title="Drag to reorder" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="5" r="1.5" fill="currentColor"/><circle cx="15" cy="5" r="1.5" fill="currentColor"/>
            <circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="9" cy="19" r="1.5" fill="currentColor"/><circle cx="15" cy="19" r="1.5" fill="currentColor"/>
          </svg>
        </div>
        <span class="card-order">${idx + 1}</span>
        <img class="image-thumb" src="${item.dataUrl}" alt="${item.file.name}" loading="lazy" />
        <div class="card-details">
          <div class="card-name">${item.file.name}</div>
          <div class="card-meta">${formatFileSize(item.file.size)}${item.width ? ` • ${item.width}×${item.height}px` : ''}</div>
        </div>
        <button class="card-remove" data-id="${item.id}" aria-label="Remove ${item.file.name}">✕</button>
      `;

      card.querySelector('.card-remove').addEventListener('click', () => removeItem(item.id));
      imageList.appendChild(card);
    });
    imageCount.textContent = imageItems.length;
  }

  function removeItem(id) {
    imageItems = imageItems.filter(i => i.id !== id);
    renderList();
    if (imageItems.length === 0) {
      hide(imagesSection);
    }
  }

  // ── Drag reorder ───────────────────────────────────────────
  function onDragStart(e) {
    const card = e.target.closest('[data-id]');
    if (!card) return;
    dragSrcId = parseInt(card.dataset.id, 10);
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e) {
    e.preventDefault();
    const target = e.target.closest('[data-id]');
    clearDragOver();
    if (target && parseInt(target.dataset.id, 10) !== dragSrcId) {
      const rect = target.getBoundingClientRect();
      const y = e.clientY - rect.top;
      target.classList.add(y < rect.height / 2 ? 'drag-over-top' : 'drag-over-bottom');
    }
  }

  function onDragLeave(e) {
    if (!imageList.contains(e.relatedTarget)) clearDragOver();
  }

  function onDrop(e) {
    e.preventDefault();
    const target = e.target.closest('[data-id]');
    const targetId = target ? parseInt(target.dataset.id, 10) : null;

    clearDragOver();
    imageList.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));

    if (!targetId || targetId === dragSrcId) return;

    const srcIdx = imageItems.findIndex(i => i.id === dragSrcId);
    const tgtIdx = imageItems.findIndex(i => i.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;

    const rect = target.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const afterTarget = y >= rect.height / 2;

    const [removed] = imageItems.splice(srcIdx, 1);
    const insertAt = afterTarget ? tgtIdx + (srcIdx < tgtIdx ? 0 : 1) : tgtIdx - (srcIdx > tgtIdx ? 0 : 1);
    imageItems.splice(Math.max(0, insertAt), 0, removed);
    renderList();
  }

  function onDragEnd() {
    clearDragOver();
    imageList.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    dragSrcId = null;
  }

  function clearDragOver() {
    imageList.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
  }

  // ── PDF page size definitions (in pts) ─────────────────────
  const PAGE_SIZES = {
    A4:     [595.28, 841.89],
    A5:     [419.53, 595.28],
    Letter: [612, 792],
    Legal:  [612, 1008],
  };

  // ── Create PDF ─────────────────────────────────────────────
  async function doCreate() {
    if (isProcessing || imageItems.length === 0) {
      if (imageItems.length === 0) showToast('⚠️ Please upload at least one image.');
      return;
    }

    isProcessing = true;
    actionBtn.disabled = true;
    hide(resultCard);
    show(progressWrap);
    hideError(errorEl);
    downloadBlob = null;

    try {
      const pdfDoc = await PDFLib.PDFDocument.create();
      const pageSize = pageSizeEl.value;
      const orientation = orientEl.value;
      const fit = fitEl.value;
      const margin = parseInt(marginEl.value, 10);

      for (let idx = 0; idx < imageItems.length; idx++) {
        const item = imageItems[idx];
        const pct = Math.round(((idx) / imageItems.length) * 90);
        setProgress(progressFill, progressLbl, pct, `Processing image ${idx + 1} of ${imageItems.length}…`);

        let embeddedImg;
        const mimeType = item.file.type;

        try {
          const arrayBuffer = await item.file.arrayBuffer();
          if (mimeType === 'image/png') {
            embeddedImg = await pdfDoc.embedPng(arrayBuffer);
          } else {
            embeddedImg = await pdfDoc.embedJpg(arrayBuffer);
          }
        } catch (embedErr) {
          // Fallback: convert to JPEG via canvas
          const canvas = document.createElement('canvas');
          const img = new Image();
          await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = rej;
            img.src = item.dataUrl;
          });
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d').drawImage(img, 0, 0);
          const jpgBlob = await canvasToJpgBlob(canvas, 0.92);
          const jpgBuf = await jpgBlob.arrayBuffer();
          embeddedImg = await pdfDoc.embedJpg(jpgBuf);
        }

        const imgW = embeddedImg.width;
        const imgH = embeddedImg.height;

        // Determine page dimensions
        let pgW, pgH;
        if (pageSize === 'Original') {
          pgW = imgW;
          pgH = imgH;
        } else {
          [pgW, pgH] = PAGE_SIZES[pageSize] || PAGE_SIZES['A4'];
        }

        // Orientation override
        let finalW = pgW, finalH = pgH;
        if (orientation === 'portrait') {
          if (pgW > pgH) { finalW = pgH; finalH = pgW; }
        } else if (orientation === 'landscape') {
          if (pgH > pgW) { finalW = pgH; finalH = pgW; }
        } else {
          // Auto: match image aspect
          if (imgW > imgH && pgH > pgW) { finalW = pgH; finalH = pgW; }
          else if (imgH > imgW && pgW > pgH) { finalW = pgH; finalH = pgW; }
        }

        const page = pdfDoc.addPage([finalW, finalH]);

        const drawW = finalW - margin * 2;
        const drawH = finalH - margin * 2;

        let dW, dH, dx, dy;

        if (fit === 'original') {
          dW = imgW;
          dH = imgH;
        } else if (fit === 'fill') {
          // fill: scale to fill
          const scaleX = drawW / imgW;
          const scaleY = drawH / imgH;
          const scale = Math.max(scaleX, scaleY);
          dW = imgW * scale;
          dH = imgH * scale;
        } else {
          // fit: scale to fit maintaining AR
          const scaleX = drawW / imgW;
          const scaleY = drawH / imgH;
          const scale = Math.min(scaleX, scaleY);
          dW = imgW * scale;
          dH = imgH * scale;
        }

        dx = margin + (drawW - dW) / 2;
        dy = margin + (drawH - dH) / 2;

        page.drawImage(embeddedImg, {
          x: dx,
          y: dy,
          width: dW,
          height: dH,
        });
      }

      setProgress(progressFill, progressLbl, 95, 'Creating ZIP…');
      const bytes = await pdfDoc.save();
      downloadBlob = new Blob([bytes], { type: 'application/pdf' });

      setProgress(progressFill, progressLbl, 100, 'Done!');
      downloadBtn.textContent = '⬇️ Download ZIP';
      show(resultCard);
    } catch (e) {
      showError(errorEl, e.message || 'An error occurred while creating the PDF. Please try again.');
    } finally {
      isProcessing = false;
      actionBtn.disabled = false;
      hide(progressWrap);
    }
  }

  function doDownload() {
    if (!downloadBlob) return;
    // Always ZIP — bare blob downloads lose their .pdf extension on macOS/Chrome
    downloadZip([{ name: 'images-to-pdf.pdf', blob: downloadBlob }], 'images-to-pdf.zip');
  }

  // ── Reset ──────────────────────────────────────────────────
  function reset() {
    imageItems = [];
    isProcessing = false;
    downloadBlob = null;
    dragSrcId = null;
    idCounter = 0;
    hide(imagesSection);
    hide(resultCard);
    hide(progressWrap);
    hideError(errorEl);
    imageList.innerHTML = '';
    actionBtn.disabled = false;
    pageSizeEl.value = 'A4';
    orientEl.value = 'auto';
    fitEl.value = 'fit';
    marginEl.value = '20';
    fileInput.value = '';
  }

  return { init, reset };
})();
