/* compressor.js — PDF Compressor tool */

const Compressor = (() => {
  let pdfJsDoc = null;
  let pdfFile = null;
  let totalPages = 0;
  let isProcessing = false;
  let downloadData = null;

  // Elements
  const uploadArea    = document.getElementById('compressor-upload-area');
  const fileInput     = document.getElementById('compressor-file-input');
  const fileInfo      = document.getElementById('compressor-file-info');
  const fileName      = document.getElementById('compressor-file-name');
  const fileMeta      = document.getElementById('compressor-file-meta');
  const removeFile    = document.getElementById('compressor-remove-file');
  const errorEl       = document.getElementById('compressor-error');
  const settingsSection = document.getElementById('compressor-settings-section');
  const levelSelect   = document.getElementById('compressor-level-select');
  const actionBtn     = document.getElementById('compressor-action-btn');
  const progressWrap  = document.getElementById('compressor-progress');
  const progressFill  = document.getElementById('compressor-progress-fill');
  const progressLbl   = document.getElementById('compressor-progress-label');
  const resultCard    = document.getElementById('compressor-result');
  const resultText    = document.getElementById('compressor-result-text');
  const downloadBtn   = document.getElementById('compressor-download-btn');
  const resetBtn      = document.getElementById('compressor-reset-btn');

  function init() {
    setupDropZone(uploadArea, fileInput, handleFiles);
    removeFile.addEventListener('click', reset);
    resetBtn.addEventListener('click', reset);
    actionBtn.addEventListener('click', doCompress);
    downloadBtn.addEventListener('click', doDownload);
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
      show(settingsSection);
    } catch (e) {
      showError(errorEl, e.message || 'This PDF could not be opened. Please try another file.');
    }
  }

  async function doCompress() {
    if (isProcessing || !pdfJsDoc) return;

    const level = levelSelect.value;
    let scale = 1.5;
    let quality = 0.7;

    if (level === 'extreme') {
      scale = 1.0; // 72 DPI
      quality = 0.5;
    } else if (level === 'normal') {
      scale = 1.5; // ~100 DPI
      quality = 0.7;
    } else if (level === 'less') {
      scale = 2.0; // 150 DPI
      quality = 0.85;
    }

    isProcessing = true;
    actionBtn.disabled = true;
    hide(resultCard);
    show(progressWrap);
    hideError(errorEl);
    downloadData = null;

    try {
      const { PDFDocument } = window.PDFLib;
      const pdfDoc = await PDFDocument.create();

      for (let i = 1; i <= totalPages; i++) {
        const pct = Math.round(((i - 1) / totalPages) * 90);
        setProgress(progressFill, progressLbl, pct, `Compressing page ${i} of ${totalPages}…`);

        const canvas = await renderPageFullRes(pdfJsDoc, i, scale);
        const imgBlob = await canvasToJpgBlob(canvas, quality);
        const arrayBuffer = await imgBlob.arrayBuffer();

        const img = await pdfDoc.embedJpg(arrayBuffer);
        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, {
          x: 0,
          y: 0,
          width: img.width,
          height: img.height,
        });

        // Release canvas memory
        canvas.width = 0;
        canvas.height = 0;
      }

      setProgress(progressFill, progressLbl, 95, 'Finalizing PDF…');
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      downloadData = {
        blob,
        name: pdfFile.name.replace('.pdf', `_compressed_${level}.pdf`)
      };

      const originalSize = pdfFile.size;
      const newSize = blob.size;
      const savedBytes = originalSize - newSize;
      const savedPct = Math.round((savedBytes / originalSize) * 100);

      if (savedBytes > 0) {
        resultText.textContent = `PDF compressed! Saved ${formatFileSize(savedBytes)} (${savedPct}% reduction).`;
      } else {
        resultText.textContent = `PDF compressed, but size increased. Try a more extreme setting.`;
      }

      setProgress(progressFill, progressLbl, 100, 'Done!');
      show(resultCard);
    } catch (e) {
      showError(errorEl, e.message || 'An error occurred during compression.');
    } finally {
      isProcessing = false;
      actionBtn.disabled = false;
      hide(progressWrap);
    }
  }

  function doDownload() {
    if (!downloadData) return;
    downloadFile(downloadData.blob, downloadData.name);
  }

  function reset() {
    pdfJsDoc = null;
    pdfFile = null;
    totalPages = 0;
    isProcessing = false;
    downloadData = null;

    hide(fileInfo);
    hide(settingsSection);
    hide(resultCard);
    hide(progressWrap);
    hideError(errorEl);
    actionBtn.disabled = false;
    fileInput.value = '';
    levelSelect.value = 'normal';
  }

  return { init, reset };
})();
