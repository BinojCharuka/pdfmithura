/* ============================================================
   md-generator.js — Markdown Generator Tool for PDF Mithura
   Matches the exact design language, colors & structure of PDF Mithura
   ============================================================ */

(function () {
  // Elements
  const editor = document.getElementById('md-editor');
  const preview = document.getElementById('md-preview');
  const filenameInput = document.getElementById('md-filename');
  const charCount = document.getElementById('md-char-count');
  const wordCount = document.getElementById('md-word-count');
  const lineCount = document.getElementById('md-line-count');
  const readingTime = document.getElementById('md-reading-time');
  const saveStatus = document.getElementById('md-save-status');
  const dropZone = document.getElementById('md-drop-zone');
  const editorContainer = document.getElementById('md-editor-container');
  const convertModal = document.getElementById('md-convert-modal');
  const templatesModal = document.getElementById('md-templates-modal');
  const cheatsheetModal = document.getElementById('md-cheatsheet-modal');
  const convertInput = document.getElementById('md-convert-input');
  const exportDropdown = document.getElementById('md-export-dropdown');
  const imageInput = document.getElementById('md-image-input');

  // Turndown service for HTML to Markdown
  const turndownService = (typeof TurndownService !== 'undefined') ? new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
  }) : null;

  if (turndownService && typeof turndownPluginGfm !== 'undefined') {
    turndownService.use(turndownPluginGfm.gfm);
  }

  // Marked Configuration
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      breaks: true,
      gfm: true,
      highlight: function (code, lang) {
        if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (e) {}
        }
        return code;
      }
    });
  }

  // Live preview update
  let renderTimer = null;
  function scheduleUpdate() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(updatePreview, 120);
  }

  function updatePreview() {
    if (!editor || !preview) return;
    const text = editor.value;

    if (text.trim() && typeof marked !== 'undefined') {
      preview.innerHTML = marked.parse(text);

      // Render KaTeX if loaded
      if (typeof renderMathInElement !== 'undefined') {
        try {
          renderMathInElement(preview, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\(', right: '\\)', display: false },
              { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
          });
        } catch (e) {}
      }
    } else {
      preview.innerHTML = '<div class="md-empty-preview">✨ Type or paste your content on the left to see the live preview here...</div>';
    }

    updateStats();
  }

  function updateStats() {
    if (!editor) return;
    const text = editor.value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    if (charCount) charCount.textContent = text.length;
    if (wordCount) wordCount.textContent = words;
    if (lineCount) lineCount.textContent = text ? text.split('\n').length : 0;
    if (readingTime) {
      const minutes = Math.max(1, Math.ceil(words / 200));
      readingTime.textContent = `${minutes} min read`;
    }
  }

  function insertAtCursor(text) {
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.value = editor.value.substring(0, start) + text + editor.value.substring(end);
    editor.selectionStart = editor.selectionEnd = start + text.length;
    scheduleUpdate();
  }

  // Formatting helper
  window.mdInsertFormat = function (type) {
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.substring(start, end);
    let before = editor.value.substring(0, start);
    let after = editor.value.substring(end);
    let insert = '';

    switch (type) {
      case 'heading1': insert = `# ${selected || 'Heading 1'}`; break;
      case 'heading2': insert = `## ${selected || 'Heading 2'}`; break;
      case 'heading3': insert = `### ${selected || 'Heading 3'}`; break;
      case 'bold': insert = `**${selected || 'bold text'}**`; break;
      case 'italic': insert = `*${selected || 'italic text'}*`; break;
      case 'strike': insert = `~~${selected || 'strikethrough'}~~`; break;
      case 'code': insert = `\`${selected || 'code'}\``; break;
      case 'ul': insert = `\n- ${selected || 'List item'}\n- Item 2\n- Item 3`; break;
      case 'ol': insert = `\n1. ${selected || 'First item'}\n2. Second item`; break;
      case 'task': insert = `\n- [ ] ${selected || 'Pending task'}\n- [x] Completed task`; break;
      case 'link': insert = `[${selected || 'Link text'}](https://example.com)`; break;
      case 'image': insert = `![${selected || 'Image alt'}](https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800)`; break;
      case 'table': insert = `\n| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Data 1   | Data 2   | Data 3   |\n| Data 4   | Data 5   | Data 6   |\n`; break;
      case 'codeblock': insert = `\n\`\`\`javascript\n${selected || '// code here'}\n\`\`\`\n`; break;
      case 'quote': insert = `\n> ${selected || 'Quote text'}\n`; break;
      case 'math': insert = `\n$$ E = mc^2 $$\n`; break;
      case 'hr': insert = `\n---\n`; break;
    }

    editor.value = before + insert + after;
    editor.focus();
    const newPos = start + insert.length;
    editor.setSelectionRange(newPos, newPos);
    scheduleUpdate();
  };

  // Smart Paste (HTML to Markdown auto-conversion)
  if (editor) {
    editor.addEventListener('paste', (e) => {
      const html = e.clipboardData.getData('text/html');
      if (html && turndownService && html.includes('<') && html.includes('>')) {
        const md = turndownService.turndown(html);
        if (md && md.trim() && md !== e.clipboardData.getData('text/plain')) {
          e.preventDefault();
          insertAtCursor(md);
          if (typeof showToast === 'function') {
            showToast('Converted rich text to Markdown!', 'success');
          }
        }
      }
    });

    editor.addEventListener('input', () => {
      scheduleUpdate();
      localStorage.setItem('pdfmithura_md_content', editor.value);
    });

    // Tab indent
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 4;
        scheduleUpdate();
      }
    });
  }

  if (filenameInput) {
    filenameInput.addEventListener('input', () => {
      localStorage.setItem('pdfmithura_md_filename', filenameInput.value);
    });
  }

  // Keyboard Shortcuts (Ctrl/Cmd + S/B/I/K)
  document.addEventListener('keydown', (e) => {
    const isToolActive = document.getElementById('page-md')?.classList.contains('active');
    if (!isToolActive) return;

    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 's':
          e.preventDefault();
          window.mdDownload();
          break;
        case 'b':
          e.preventDefault();
          window.mdInsertFormat('bold');
          break;
        case 'i':
          e.preventDefault();
          window.mdInsertFormat('italic');
          break;
        case 'k':
          e.preventDefault();
          window.mdInsertFormat('link');
          break;
      }
    }
  });

  // Drag & drop file to load
  if (editorContainer) {
    editorContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone?.classList.add('active');
    });

    editorContainer.addEventListener('dragleave', (e) => {
      if (!editorContainer.contains(e.relatedTarget)) {
        dropZone?.classList.remove('active');
      }
    });

    editorContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone?.classList.remove('active');
      const file = e.dataTransfer.files[0];
      if (file) {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            insertAtCursor(`\n![${file.name}](${event.target.result})\n`);
            if (typeof showToast === 'function') showToast(`Image ${file.name} inserted!`, 'success');
          };
          reader.readAsDataURL(file);
        } else {
          const reader = new FileReader();
          reader.onload = (event) => {
            let content = event.target.result;
            if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
              if (turndownService) content = turndownService.turndown(content);
            }
            editor.value = content;
            if (filenameInput) filenameInput.value = file.name.replace(/\.[^.]+$/, '.md');
            scheduleUpdate();
            if (typeof showToast === 'function') showToast(`Loaded ${file.name}`, 'success');
          };
          reader.readAsText(file);
        }
      }
    });
  }

  // Upload image handler
  if (imageInput) {
    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        insertAtCursor(`\n![${file.name}](${event.target.result})\n`);
        if (typeof showToast === 'function') showToast(`Image ${file.name} inserted!`, 'success');
      };
      reader.readAsDataURL(file);
    });
  }

  // Download Trigger
  function triggerDownload(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Export functions
  window.mdDownload = function () {
    if (!editor || !editor.value.trim()) {
      if (typeof showToast === 'function') showToast('Editor is empty!', 'error');
      return;
    }
    let filename = (filenameInput?.value.trim() || 'document.md');
    if (!filename.endsWith('.md')) filename += '.md';
    triggerDownload(editor.value, filename, 'text/markdown;charset=utf-8');
    if (typeof showToast === 'function') showToast(`Downloaded ${filename}`, 'success');
  };

  window.mdExportHTML = function () {
    if (!editor || !editor.value.trim()) return;
    let baseName = (filenameInput?.value.trim() || 'document').replace(/\.[^.]+$/, '');
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${baseName}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 820px; margin: 40px auto; padding: 0 20px; line-height: 1.7; color: #1a1a1a; background: #fff; }
pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow: auto; }
code { font-family: monospace; background: #f4f4f4; padding: 2px 6px; border-radius: 4px; }
table { border-collapse: collapse; width: 100%; margin: 16px 0; }
th, td { border: 1px solid #ddd; padding: 8px 12px; }
th { background: #f8f8f8; }
blockquote { border-left: 4px solid #a8ff00; margin: 0; padding-left: 16px; color: #555; }
</style>
</head>
<body>
${marked.parse(editor.value)}
</body>
</html>`;
    triggerDownload(htmlContent, `${baseName}.html`, 'text/html;charset=utf-8');
    if (typeof showToast === 'function') showToast(`Exported ${baseName}.html`, 'success');
  };

  window.mdExportTXT = function () {
    if (!editor || !editor.value.trim()) return;
    let baseName = (filenameInput?.value.trim() || 'document').replace(/\.[^.]+$/, '');
    triggerDownload(editor.value, `${baseName}.txt`, 'text/plain;charset=utf-8');
    if (typeof showToast === 'function') showToast(`Exported ${baseName}.txt`, 'success');
  };

  window.mdExportPDF = function () {
    window.print();
  };

  window.mdCopy = function () {
    if (!editor || !editor.value.trim()) {
      if (typeof showToast === 'function') showToast('Nothing to copy!', 'error');
      return;
    }
    navigator.clipboard.writeText(editor.value).then(() => {
      if (typeof showToast === 'function') showToast('Copied to clipboard!', 'success');
    }).catch(() => {
      editor.select();
      document.execCommand('copy');
      if (typeof showToast === 'function') showToast('Copied to clipboard!', 'success');
    });
  };

  window.mdClear = function () {
    if (editor && editor.value.trim() && !confirm('Are you sure you want to clear the editor?')) return;
    if (editor) editor.value = '';
    scheduleUpdate();
    if (typeof showToast === 'function') showToast('Editor cleared', 'success');
  };

  window.mdToggleFullscreen = function () {
    editorContainer?.classList.toggle('fullscreen');
  };

  window.mdToggleExportMenu = function () {
    exportDropdown?.classList.toggle('show');
  };

  window.addEventListener('click', (e) => {
    if (!e.target.closest('#md-export-dropdown')) {
      exportDropdown?.classList.remove('show');
    }
  });

  // Modal Helpers
  window.mdOpenModal = function (name) {
    const modal = document.getElementById(`md-${name}-modal`);
    if (modal) {
      modal.classList.add('active');
      if (name === 'convert') {
        setTimeout(() => convertInput?.focus(), 100);
      }
    }
  };

  window.mdCloseModal = function (name) {
    const modal = document.getElementById(`md-${name}-modal`);
    if (modal) modal.classList.remove('active');
  };

  document.querySelectorAll('.md-modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  });

  window.mdPerformConversion = function () {
    if (!convertInput || !convertInput.value.trim()) {
      if (typeof showToast === 'function') showToast('Paste HTML/Text first', 'error');
      return;
    }
    if (turndownService) {
      const md = turndownService.turndown(convertInput.value);
      insertAtCursor(md);
      convertInput.value = '';
      window.mdCloseModal('convert');
      if (typeof showToast === 'function') showToast('Converted & inserted!', 'success');
    }
  };

  // Templates
  const templates = {
    readme: `# 🚀 Project Title

> A brief description of your awesome project.

![License](https://img.shields.io/badge/license-MIT-a8ff00.svg)

## 📋 Features
- Fast & lightweight browser tool
- Privacy-first architecture
- Modern dark/olive styling

## 🛠️ Getting Started
\`\`\`bash
git clone https://github.com/user/project.git
cd project
npm install
npm run dev
\`\`\`

## 📄 License
Licensed under the [MIT License](LICENSE).
`,
    blog: `---
title: "Getting Started with Markdown & Web Tools"
date: ${new Date().toISOString().split('T')[0]}
author: "Binoj Charuka"
---

# Getting Started with Markdown & Web Tools

![Cover](https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=900)

## Introduction
Writing documentation has never been faster. Using Markdown allows seamless export to HTML, PDF, and websites.

### Why Markdown?
1. Clean plain-text formatting
2. Universal platform support
3. Readable without rendering

> "Simplicity is the soul of efficiency."
`,
    math: `# 🧮 Mathematical Notes

## Mass–Energy Equivalence
$$ E = mc^2 $$

## Quadratic Formula
$$ x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} $$
`,
    notes: `# 📝 Meeting Minutes

**Date:** ${new Date().toLocaleDateString()}
**Attendees:** Team Leads

## 🎯 Agenda
1. Review roadmap
2. Performance optimization

## ✅ Action Items
- [ ] Implement new features
- [x] Initial design review
`
  };

  window.mdLoadTemplate = function (name) {
    if (templates[name]) {
      if (editor && editor.value.trim() && !confirm('This will replace current content. Continue?')) return;
      if (editor) editor.value = templates[name];
      scheduleUpdate();
      window.mdCloseModal('templates');
      if (typeof showToast === 'function') showToast('Template loaded!', 'success');
    }
  };

  // Mobile View Switcher (Editor / Preview / Split)
  window.mdSwitchTab = function (mode) {
    if (!editorContainer) return;
    editorContainer.classList.remove('mode-editor', 'mode-preview', 'mode-split');
    editorContainer.classList.add(`mode-${mode}`);

    document.querySelectorAll('.md-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.id === `tab-${mode}`);
    });

    if (mode === 'preview') {
      updatePreview();
    }
  };

  // Set default mode on mobile
  if (window.innerWidth <= 768 && editorContainer) {
    editorContainer.classList.add('mode-editor');
  }

  // Restore saved state
  const savedContent = localStorage.getItem('pdfmithura_md_content');
  const savedFilename = localStorage.getItem('pdfmithura_md_filename');
  if (savedContent && editor) editor.value = savedContent;
  if (savedFilename && filenameInput) filenameInput.value = savedFilename;

  // Initialize
  scheduleUpdate();
})();

