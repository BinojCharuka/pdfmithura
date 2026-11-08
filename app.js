/* app.js — Main application controller */

// ============================================================
// Navigation / router
// ============================================================
function getPages() {
  return {
    home:     document.getElementById('page-home'),
    splitter: document.getElementById('page-splitter'),
    'to-jpg': document.getElementById('page-to-jpg'),
    'to-pdf': document.getElementById('page-to-pdf'),
    combiner: document.getElementById('page-combiner'),
    compressor: document.getElementById('page-compressor'),
    md:       document.getElementById('page-md'),
  };
}

let currentPage = 'home';

function navigate(tool) {
  const pages = getPages();
  if (!pages[tool]) tool = 'home';

  // Hide all pages first to prevent any clash
  Object.keys(pages).forEach(key => {
    const p = pages[key];
    if (p) {
      p.classList.remove('active');
      p.hidden = true;
    }
  });

  // Show target page
  const newPage = pages[tool];
  if (newPage) {
    newPage.hidden = false;
    newPage.classList.add('active');
  }

  currentPage = tool;

  // Update nav active state
  document.querySelectorAll('[data-tool]').forEach(link => {
    link.classList.toggle('active', link.dataset.tool === tool);
  });

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Close mobile menu if open
  closeMobileMenu();

  // Update hash
  if (location.hash.replace('#', '') !== tool) {
    history.pushState({ tool }, '', `#${tool}`);
  }
}

// ── Delegated Click Handler for all [data-tool] elements ────
document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-tool]');
  if (link) {
    e.preventDefault();
    e.stopPropagation();
    const tool = link.getAttribute('data-tool');
    if (tool) {
      navigate(tool);
    }
  }
});

// ── Hash-based routing ──────────────────────────────────────
function loadFromHash() {
  const hash = location.hash.replace('#', '').trim();
  const pages = getPages();
  if (hash && pages[hash]) {
    navigate(hash);
  } else {
    navigate('home');
  }
}

window.addEventListener('popstate', loadFromHash);
window.addEventListener('hashchange', loadFromHash);

// ============================================================
// Mobile hamburger menu
// ============================================================
const hamburgerBtn = document.getElementById('hamburger-btn');
const mobileOverlay = document.getElementById('mobile-overlay');

function closeMobileMenu() {
  hamburgerBtn.classList.remove('open');
  hamburgerBtn.setAttribute('aria-expanded', 'false');
  mobileOverlay.classList.remove('open');
  mobileOverlay.setAttribute('aria-hidden', 'true');
}

hamburgerBtn.addEventListener('click', () => {
  const isOpen = hamburgerBtn.classList.toggle('open');
  hamburgerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  mobileOverlay.classList.toggle('open', isOpen);
  mobileOverlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
});

mobileOverlay.addEventListener('click', (e) => {
  if (e.target === mobileOverlay) closeMobileMenu();
});

// ============================================================
// Keyboard accessibility
// ============================================================
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMobileMenu();
});

// ============================================================
// Initialize all tool modules
// ============================================================
function initApp() {
  try { if (typeof Splitter !== 'undefined' && Splitter.init) Splitter.init(); } catch (e) { console.error('Splitter init error:', e); }
  try { if (typeof ToJpg !== 'undefined' && ToJpg.init) ToJpg.init(); } catch (e) { console.error('ToJpg init error:', e); }
  try { if (typeof ToPdf !== 'undefined' && ToPdf.init) ToPdf.init(); } catch (e) { console.error('ToPdf init error:', e); }
  try { if (typeof Combiner !== 'undefined' && Combiner.init) Combiner.init(); } catch (e) { console.error('Combiner init error:', e); }
  try { if (typeof Compressor !== 'undefined' && Compressor.init) Compressor.init(); } catch (e) { console.error('Compressor init error:', e); }

  // Initial page load from hash
  loadFromHash();

  // Visitor counter (async and non-blocking)
  fetch('https://countapi.mileshilliard.com/api/v1/hit/pdfmithura_views')
    .then(res => res.json())
    .then(data => {
      const el = document.getElementById('visit-count');
      if (el) el.textContent = data.value.toLocaleString();
    })
    .catch(() => {
      const el = document.getElementById('visit-count');
      if (el) el.textContent = '-';
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// ============================================================
// Global drag-over prevention (prevent browser from opening files)
// ============================================================
document.addEventListener('dragover', (e) => {
  // Only prevent default if not in a dropzone
  if (!e.target.closest('.upload-area')) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'none';
  }
});

document.addEventListener('drop', (e) => {
  if (!e.target.closest('.upload-area, .image-list, .pdf-list')) {
    e.preventDefault();
  }
});

// ============================================================
// Cleanup on unload
// ============================================================
window.addEventListener('beforeunload', () => {
  // Revoke any lingering object URLs
  // (browsers handle this, but being explicit is good practice)
});
