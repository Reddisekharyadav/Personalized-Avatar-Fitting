// loadModelViewer.js
// Ensures @google/model-viewer is loaded only once and avoids duplicate custom element definition
export default async function loadModelViewer() {
  if (typeof window === 'undefined') return;
  if (customElements.get('model-viewer')) return;

  // Try dynamic import first (works with bundlers)
  try {
    await import('@google/model-viewer');
    return;
  } catch (err) {
    console.warn('Dynamic import of @google/model-viewer failed, falling back to CDN:', err && err.message ? err.message : err);
    // Fallback to CDN script - check again first to avoid double-define
    if (customElements.get('model-viewer')) return;
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-model-viewer-fallback]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', (e) => reject(e));
        return;
      }

      const s = document.createElement('script');
      s.setAttribute('type', 'module');
      s.setAttribute('src', 'https://unpkg.com/@google/model-viewer@4.1.0/dist/model-viewer.min.js');
      s.setAttribute('data-model-viewer-fallback', '1');
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });
  }
}
