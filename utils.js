/* utils.js — shared utility functions */

// ============================================================
// PDF.js setup
// ============================================================
const pdfjsLib = window['pdfjs-dist/build/pdf'];
if (pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ============================================================
// File validation
// ============================================================
function validatePDF(file) {
  if (!file) return 'Please upload a file first.';
  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    return 'Please select a valid PDF file.';
  }
  if (file.size > 300 * 1024 * 1024) {
    return 'This file is too large to process in your browser. Try a smaller file or fewer pages.';
  }
  return null;
}

function validateImages(files) {
  if (!files || files.length === 0) return 'Please upload at least one image file.';
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  for (const f of files) {
    if (!validTypes.includes(f.type) && !/\.(jpg|jpeg|png)$/i.test(f.name)) {
      return `"${f.name}" is not a valid JPG or PNG image.`;
    }
  }
  return null;
}

// ============================================================
// Page range parsing
// ============================================================
function parsePageRange(rangeStr, totalPages) {
  if (!rangeStr || !rangeStr.trim()) return null;
  const pages = new Set();
  const parts = rangeStr.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (/^\d+$/.test(trimmed)) {
      const n = parseInt(trimmed, 10);
      if (n < 1 || n > totalPages) return null;
      pages.add(n);
    } else if (/^\d+-\d+$/.test(trimmed)) {
      const [a, b] = trimmed.split('-').map(Number);
      if (a > b || a < 1 || b > totalPages) return null;
      for (let i = a; i <= b; i++) pages.add(i);
    } else {
      return null;
    }
  }
  if (pages.size === 0) return null;
  return [...pages].sort((a, b) => a - b);
}

// ============================================================
// Format file size
// ============================================================
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// ============================================================
// Load PDF with pdf-lib
// ============================================================
async function loadPdfLib(file) {
  const buf = await file.arrayBuffer();
  try {
    const doc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
    return { doc, buf };
  } catch (e) {
    throw new Error('This PDF could not be opened. Please try another file.');
  }
}

// ============================================================
// Load PDF with PDF.js (for rendering)
// ============================================================
async function loadPdfJs(file) {
  const buf = await file.arrayBuffer();
  try {
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    return pdf;
  } catch (e) {
    throw new Error('This PDF could not be opened. Please try another file.');
  }
}

// ============================================================
// Render page thumbnail (PDF.js)
// ============================================================
async function renderPageThumb(pdfJs, pageNum, targetWidth = 96) {
  const page = await pdfJs.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const scale = targetWidth / viewport.width;
  const scaledViewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;
  canvas.style.display = 'block';

  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
  return canvas;
}

// ============================================================
// Render page to full-res canvas (PDF.js)
// ============================================================
async function renderPageFullRes(pdfJs, pageNum, scale) {
  const page = await pdfJs.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas;
}

// ============================================================
// Canvas to JPG blob
// ============================================================
async function canvasToJpgBlob(canvas, quality = 0.85) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });
}

// ============================================================
// Trigger file download
// ============================================================
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ============================================================
// Create ZIP and trigger download
// ============================================================
async function downloadZip(files, zipName) {
  const zip = new JSZip();
  for (const { name, blob } of files) {
    zip.file(name, blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(zipBlob, zipName);
}

// ============================================================
// Show toast
// ============================================================
let toastTimeout = null;
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), duration);
}

// ============================================================
// Show / hide element
// ============================================================
function show(el) { if (el) el.hidden = false; }
function hide(el) { if (el) el.hidden = true; }

// ============================================================
// Set progress bar
// ============================================================
function setProgress(fillEl, labelEl, pct, label) {
  if (fillEl) fillEl.style.width = `${pct}%`;
  if (labelEl) labelEl.textContent = label || `Processing... ${Math.round(pct)}%`;
  const track = fillEl ? fillEl.closest('[role=progressbar]') : null;
  if (track) track.setAttribute('aria-valuenow', Math.round(pct));
}

// ============================================================
// Show error
// ============================================================
function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  show(el);
}

function hideError(el) {
  if (!el) return;
  hide(el);
}

// ============================================================
// Drag & drop list reordering (touch + mouse)
// ============================================================
function makeDraggableList(listEl, onReorder) {
  let dragSrc = null;

  function getDragPosition(e, el) {
    const rect = el.getBoundingClientRect();
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    return y < rect.height / 2 ? 'top' : 'bottom';
  }

  function clearDragStyles() {
    listEl.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
  }

  listEl.addEventListener('dragstart', (e) => {
    dragSrc = e.target.closest('[draggable]');
    if (dragSrc) {
      dragSrc.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    }
  });

  listEl.addEventListener('dragend', (e) => {
    clearDragStyles();
    if (dragSrc) dragSrc.classList.remove('dragging');
    dragSrc = null;
  });

  listEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    const target = e.target.closest('[draggable]');
    clearDragStyles();
    if (target && target !== dragSrc) {
      const pos = getDragPosition(e, target);
      target.classList.add(pos === 'top' ? 'drag-over-top' : 'drag-over-bottom');
    }
  });

  listEl.addEventListener('drop', (e) => {
    e.preventDefault();
    clearDragStyles();
    const target = e.target.closest('[draggable]');
    if (!target || target === dragSrc || !dragSrc) return;
    const pos = getDragPosition(e, target);
    if (pos === 'top') {
      listEl.insertBefore(dragSrc, target);
    } else {
      listEl.insertBefore(dragSrc, target.nextSibling);
    }
    if (onReorder) onReorder();
  });
}

// ============================================================
// Setup drag-and-drop upload area
// ============================================================
function setupDropZone(dropEl, inputEl, onFiles) {
  dropEl.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('label')) return;
    inputEl.click();
  });

  dropEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputEl.click();
    }
  });

  dropEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropEl.classList.add('drag-over');
  });

  dropEl.addEventListener('dragleave', (e) => {
    if (!dropEl.contains(e.relatedTarget)) {
      dropEl.classList.remove('drag-over');
    }
  });

  dropEl.addEventListener('drop', (e) => {
    e.preventDefault();
    dropEl.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length) onFiles(files);
  });

  inputEl.addEventListener('change', () => {
    if (inputEl.files.length) onFiles(inputEl.files);
    inputEl.value = '';
  });
}

// ============================================================
// Get image dimensions from File
// ============================================================
function getImageDimensions(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}
