document.addEventListener('DOMContentLoaded', () => {
  // Custom cursor tracking
  const cursor = document.getElementById('cursor');
  if (cursor) {
    document.addEventListener('mousemove', e => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top  = e.clientY + 'px';
    });

    // Hover effects for cursor on interactive elements
    document.querySelectorAll('a, button, .pillar-card, input, .gallery-item').forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
    });
  }

  // Scroll reveal animation using IntersectionObserver
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length > 0) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.12 });

    reveals.forEach(r => revealObserver.observe(r));
  }

  // ── BILINGUAL TOGGLE ──────────────────────────────────────────
  // Switches all [data-en] / [data-es] elements and persists preference

  function applyLang(lang) {
    document.querySelectorAll('[data-en][data-es]').forEach(el => {
      el.textContent = el.dataset[lang];
    });
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.id === `btn-${lang}`);
    });
    localStorage.setItem('volumen-lang', lang);
    document.documentElement.setAttribute('lang', lang === 'es' ? 'es' : 'en');
  }

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.id === 'btn-es' ? 'es' : 'en';
      applyLang(lang);
    });
  });

  // Restore saved language preference on every page load
  const savedLang = localStorage.getItem('volumen-lang');
  if (savedLang === 'es') applyLang('es');
});
