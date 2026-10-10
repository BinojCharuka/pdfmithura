/* app.js — Main application controller */

// ============================================================
// Navigation / router
// ============================================================
const pages = {
  home:     document.getElementById('page-home'),
  splitter: document.getElementById('page-splitter'),
  'to-jpg': document.getElementById('page-to-jpg'),
  'to-pdf': document.getElementById('page-to-pdf'),
  combiner: document.getElementById('page-combiner'),
  compressor: document.getElementById('page-compressor'),
};

const navLinks = document.querySelectorAll('[data-tool]');
let currentPage = 'home';

function navigate(tool) {
  if (!pages[tool]) tool = 'home';
  if (tool === currentPage) return;

  // Hide current
  const oldPage = pages[currentPage];
  if (oldPage) { oldPage.classList.remove('active'); oldPage.hidden = true; }

  // Show new
  const newPage = pages[tool];
  if (newPage) { newPage.hidden = false; newPage.classList.add('active'); }

  currentPage = tool;

  // Update nav active state
  navLinks.forEach(link => {
    link.classList.toggle('active', link.dataset.tool === tool);
  });

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Close mobile menu
  closeMobileMenu();

  // Update hash for shallow routing
  history.pushState({ tool }, '', `#${tool}`);
}

// ── Bind nav links ─────────────────────────────────────────
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navigate(link.dataset.tool);
  });
});

// ── Hash-based routing ──────────────────────────────────────
function loadFromHash() {
  const hash = location.hash.replace('#', '').trim();
  if (hash && pages[hash]) {
    navigate(hash);
  } else {
    // Ensure home is shown
    const home = pages['home'];
    if (home) { home.hidden = false; home.classList.add('active'); }
    navLinks.forEach(link => {
      link.classList.toggle('active', link.dataset.tool === 'home');
    });
  }
}

window.addEventListener('popstate', loadFromHash);

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
document.addEventListener('DOMContentLoaded', () => {
  Splitter.init();
  ToJpg.init();
  ToPdf.init();
  Combiner.init();
  Compressor.init();

  // Initial page load from hash
  loadFromHash();
});

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
