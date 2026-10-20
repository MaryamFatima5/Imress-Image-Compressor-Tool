// ==========================================================================
// IMRESS - Professional Smooth Scroll Controller
// Module: ui-scroller.js
// Provides silky-smooth cubic-bezier tracking without browser jitter.
// ==========================================================================

let activeScrollAnim = null;
let userInteractedWithScroll = false;
let isProgrammaticScrolling = false;

// Once user scrolls up or down (wheel, touch, arrow keys, or scrollbar), stop auto-scrolling
function handleUserManualScroll() {
    userInteractedWithScroll = true;
    if (activeScrollAnim) {
        cancelAnimationFrame(activeScrollAnim);
        activeScrollAnim = null;
    }
}

window.addEventListener('wheel', handleUserManualScroll, { passive: true });
window.addEventListener('touchmove', handleUserManualScroll, { passive: true });
window.addEventListener('keydown', (e) => {
    const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
    if (scrollKeys.includes(e.key)) {
        handleUserManualScroll();
    }
}, { passive: true });

window.addEventListener('scroll', () => {
    // If scroll occurred naturally (not via our step frame), user scrolled manually
    if (!isProgrammaticScrolling && !userInteractedWithScroll) {
        handleUserManualScroll();
    }
}, { passive: true });

function smoothScrollTo(targetY, duration = 650, force = false) {
    if (userInteractedWithScroll && !force) return;

    if (activeScrollAnim) {
        cancelAnimationFrame(activeScrollAnim);
        activeScrollAnim = null;
    }

    const startY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const clampedTarget = Math.max(0, Math.min(targetY, maxScroll));
    const distance = clampedTarget - startY;

    if (Math.abs(distance) < 2) return;

    const startTime = performance.now();

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function step(currentTime) {
        if (userInteractedWithScroll && !force) {
            activeScrollAnim = null;
            return;
        }

        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = easeOutCubic(progress);

        isProgrammaticScrolling = true;
        window.scrollTo(0, startY + (distance * ease));
        requestAnimationFrame(() => {
            isProgrammaticScrolling = false;
        });

        if (progress < 1) {
            activeScrollAnim = requestAnimationFrame(step);
        } else {
            activeScrollAnim = null;
        }
    }

    activeScrollAnim = requestAnimationFrame(step);
}

function scrollToCompressionSection() {
    userInteractedWithScroll = false;
    if (summaryBanner) {
        const bannerRect = summaryBanner.getBoundingClientRect();
        const currentY = window.scrollY || window.pageYOffset;
        // Position summaryBanner right near top of screen with 16px luxury breathing room
        const targetY = currentY + bannerRect.top - 16;
        smoothScrollTo(Math.max(0, targetY), 700, true);
    }
}

function followCompressingRow(idOrIndex) {
    if (userInteractedWithScroll) return;

    let row = document.getElementById(`resultRow-${idOrIndex}`);
    if (!row && typeof idOrIndex === 'number') {
        const item = fileResults[idOrIndex];
        if (item) row = document.getElementById(`resultRow-${item.id}`);
    }
    if (!row) return;

    const rowRect = row.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const currentScrollY = window.scrollY || window.pageYOffset;

    const rowAbsTop = currentScrollY + rowRect.top;

    // Ideal screen line for active row: comfortably below the center (around 52% - 56% of viewport)
    // so previous completed rows and upcoming pending rows are both visible
    const idealScreenY = Math.min(viewportHeight * 0.54, viewportHeight - 140);
    const desiredScrollY = Math.max(0, Math.round(rowAbsTop - idealScreenY));

    // Only scroll downwards as compression proceeds further down
    if (desiredScrollY > currentScrollY + 6) {
        // "slow slow following": 800ms silky glide
        smoothScrollTo(desiredScrollY, 800);
    }
}
