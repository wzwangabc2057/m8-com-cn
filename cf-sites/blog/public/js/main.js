// Blog template client-side JS
document.addEventListener('DOMContentLoaded', () => {
  const hydrateMobileNav = () => {
    const desktopNav = document.querySelector('.site-nav');
    const mobileNav = document.querySelector('.mobile-nav');
    if (!(desktopNav instanceof HTMLElement) || !(mobileNav instanceof HTMLElement) || mobileNav.children.length > 0) {
      return;
    }

    Array.from(desktopNav.children).forEach((item) => {
      if (!(item instanceof HTMLElement) || !item.classList.contains('nav-item')) {
        return;
      }

      const mainLink = Array.from(item.children).find(
        (child) => child instanceof HTMLAnchorElement && child.classList.contains('nav-link'),
      );
      if (!(mainLink instanceof HTMLAnchorElement)) return;

      const mobileItem = document.createElement('div');
      mobileItem.className = 'mobile-nav-item';

      const mobileMainLink = document.createElement('a');
      mobileMainLink.href = mainLink.href;
      mobileMainLink.className = 'mobile-nav-link';
      mobileMainLink.textContent = (mainLink.textContent || '').trim();
      mobileItem.appendChild(mobileMainLink);

      const dropdown = Array.from(item.children).find(
        (child) => child instanceof HTMLElement && child.classList.contains('nav-dropdown'),
      );
      const dropdownLinks = dropdown instanceof HTMLElement
        ? dropdown.querySelectorAll('.nav-dropdown-link')
        : [];
      if (dropdownLinks.length > 0) {
        const subnav = document.createElement('div');
        subnav.className = 'mobile-subnav';

        dropdownLinks.forEach((linkNode) => {
          if (!(linkNode instanceof HTMLAnchorElement)) return;

          const mobileSubLink = document.createElement('a');
          mobileSubLink.href = linkNode.href;
          mobileSubLink.className = 'mobile-subnav-link';
          mobileSubLink.textContent = (linkNode.textContent || '').trim();
          subnav.appendChild(mobileSubLink);
        });

        if (subnav.children.length > 0) {
          mobileItem.appendChild(subnav);
        }
      }

      mobileNav.appendChild(mobileItem);
    });
  };

  const promoteHubCardEntryLinks = () => {
    const openLinkPattern = /^(?:打开|进入|查看|Open\b|Enter\b|View\b|Browse\b)/i;

    document.querySelectorAll('.m8-hub-card').forEach((card) => {
      const title = card.querySelector('.m8-hub-card-title');
      const links = card.querySelector('.m8-hub-links');
      const firstLink = links?.querySelector('li:first-child a');

      if (!(title instanceof HTMLElement) || !(links instanceof HTMLElement) || !(firstLink instanceof HTMLAnchorElement)) {
        return;
      }
      if (title.querySelector('a')) return;

      const label = (firstLink.textContent || '').trim();
      const href = firstLink.getAttribute('href');
      if (!href || !openLinkPattern.test(label)) return;

      const titleText = (title.textContent || '').trim();
      if (!titleText) return;

      const link = document.createElement('a');
      link.href = href;
      link.className = 'm8-hub-card-title-link';
      link.textContent = titleText;

      title.textContent = '';
      title.appendChild(link);
      card.classList.add('m8-hub-card--title-linked');

      const firstItem = firstLink.closest('li');
      if (firstItem) {
        firstItem.remove();
      }
      if (!links.querySelector('li')) {
        links.remove();
      }
    });
  };

  // ─── Mobile nav toggle ──────────────────────────────────
  hydrateMobileNav();

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

  promoteHubCardEntryLinks();
});
