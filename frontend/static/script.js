// ==========================================================================
// IMRESS - Professional Image Compressor
// Master Application Coordinator & Entrypoint
//
// Modular Architecture (All modules < 500 lines):
//   1. app-state.js          - Reactive state, DOM registry, formatters & native save
//   2. ui-scroller.js        - 60fps smooth scrolling & dynamic row following
//   3. staging-controller.js - Staging queue, offline previews & dropzone events
//   4. compression-engine.js - Parallel multi-worker pool & compression pipeline
//   5. results-controller.js - Results table, live metrics, and batch ZIP generator
// ==========================================================================

console.log('[Imress] Image Compressor Client Initialized successfully.');