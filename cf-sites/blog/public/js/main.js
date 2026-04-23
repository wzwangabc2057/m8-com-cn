// Blog template client-side JS
document.addEventListener('DOMContentLoaded', () => {
  // ─── Mobile nav toggle ──────────────────────────────────
  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('.nav-toggle');
  if (navToggle && header) {
    navToggle.addEventListener('click', () => {
      const isOpen = header.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!header.contains(e.target) && header.classList.contains('nav-open')) {
        header.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && header.classList.contains('nav-open')) {
        header.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.focus();
      }
    });
  }

  // ─── Smooth scroll for anchor links ─────────────────────
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (href && href !== '#') {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  // ─── Cart badge (read count from cookie set by store) ──
  const cartBadge = document.getElementById('cart-badge');
  if (cartBadge) {
    const match = document.cookie.match(/(?:^|;\s*)cart_count=(\d+)/);
    const count = match ? parseInt(match[1], 10) : 0;
    if (count > 0) {
      cartBadge.textContent = count > 99 ? '99+' : String(count);
      cartBadge.style.display = 'block';
    }
  }

  // ─── Lazy image intersection observer ───────────────────
  if ('IntersectionObserver' in window) {
    const imgObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('loaded');
          imgObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '100px' });

    document.querySelectorAll('.post-card-image img, .featured-card-image img').forEach((img) => {
      imgObserver.observe(img);
    });
  }
});
