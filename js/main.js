/* ===================================================================
   CLOUSA PREMIUM v2.0 — main.js
   Orquestación · Navegación · Toast · Animaciones GSAP
   =================================================================== */

window.Clousa = window.Clousa || {};

(function (C) {
  'use strict';

  /* ---- Toast ---- */
  var toastEl, toastTimer;
  C.toast = function (msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-visible');
    }, 2200);
  };

  /* ---- Navegación ---- */
  function initNav() {
    var nav     = document.getElementById('nav');
    var toggle  = document.getElementById('navToggle');
    var mobile  = document.getElementById('navMobile');
    var closeBtn = document.getElementById('mobileMenuClose');

    function openMobileMenu() {
      if (!mobile) return;
      mobile.classList.add('is-open');
      if (nav) nav.classList.add('is-open');
      document.body.classList.add('no-scroll');
    }
    function closeMobileMenu() {
      if (!mobile) return;
      mobile.classList.remove('is-open');
      if (nav) nav.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
    }

    if (toggle) {
      toggle.addEventListener('click', function (e) {
        e.preventDefault();
        if (mobile && mobile.classList.contains('is-open')) {
          closeMobileMenu();
        } else {
          openMobileMenu();
        }
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', closeMobileMenu);
    }

    if (mobile) {
      /* Acordeones del menú mobile: click en "Colección/Mistral/Brooksfield" expande sub */
      var expandBtns = mobile.querySelectorAll('.mobile-menu__expand');
      Array.prototype.forEach.call(expandBtns, function (btn) {
        btn.addEventListener('click', function () {
          var targetId = btn.getAttribute('data-target');
          var sub = document.getElementById(targetId);
          if (!sub) return;
          var isOpen = sub.classList.contains('is-open');
          /* Cerrar otros sub-menús primero (acordeón mutuamente exclusivo) */
          mobile.querySelectorAll('.mobile-menu__sub').forEach(function (s) {
            s.classList.remove('is-open');
          });
          mobile.querySelectorAll('.mobile-menu__expand').forEach(function (b) {
            b.setAttribute('aria-expanded', 'false');
          });
          if (!isOpen) {
            sub.classList.add('is-open');
            btn.setAttribute('aria-expanded', 'true');
          }
        });
      });

      /* Click en links del menú mobile — cerrar después de navegar */
      mobile.addEventListener('click', function (e) {
        var link = e.target.closest('a');
        if (!link) return;
        var brand      = link.getAttribute('data-brand');
        var categories = link.getAttribute('data-categories');
        var label      = link.getAttribute('data-label');

        if (brand && C.catalog) {
          e.preventDefault();
          if (categories && C.catalog.filterByBrandAndCategory) {
            C.catalog.filterByBrandAndCategory(brand, categories, label);
          } else if (C.catalog.filterByBrand) {
            C.catalog.filterByBrand(brand);
          }
          closeMobileMenu();
          return;
        }

        /* Link Buscar mobile */
        if (link.id === 'navMobileSearch') {
          e.preventDefault();
          closeMobileMenu();
          setTimeout(function () {
            var input = document.getElementById('searchInput');
            if (input) {
              input.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setTimeout(function () { input.focus(); }, 400);
            }
          }, 350);
          return;
        }
        /* Link Carrito mobile */
        if (link.id === 'navMobileCart') {
          e.preventDefault();
          closeMobileMenu();
          if (C.cart && C.cart.open) setTimeout(C.cart.open, 350);
          return;
        }
        /* Links normales con href interno → cerrar menú al click */
        if (link.getAttribute('href') && link.getAttribute('href') !== '#') {
          closeMobileMenu();
        }
      });
    }

    /* Search bar expandible del nav */
    var searchBtn   = document.getElementById('navSearchBtn');
    var searchBar   = document.getElementById('navSearchBar');
    var searchInput = document.getElementById('navSearchInput');
    var searchClose = document.getElementById('navSearchClose');

    function openSearch() {
      if (!searchBar) return;
      searchBar.hidden = false;
      if (searchBtn) searchBtn.setAttribute('aria-expanded', 'true');
      setTimeout(function () { if (searchInput) searchInput.focus(); }, 30);
    }
    function closeSearch() {
      if (!searchBar) return;
      searchBar.hidden = true;
      if (searchBtn) searchBtn.setAttribute('aria-expanded', 'false');
      if (searchInput) searchInput.value = '';
    }

    if (searchBtn) {
      searchBtn.addEventListener('click', function () {
        if (searchBar && searchBar.hidden) openSearch();
        else closeSearch();
      });
    }
    if (searchClose) searchClose.addEventListener('click', closeSearch);

    /* Debounce de la búsqueda → entra al modo colección con state.query */
    if (searchInput) {
      var sT;
      searchInput.addEventListener('input', function () {
        clearTimeout(sT);
        sT = setTimeout(function () {
          var q = searchInput.value.trim();
          if (q.length >= 2 && C.catalog && C.catalog.filterByQuery) {
            C.catalog.filterByQuery(q);
          }
        }, 220);
      });
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var q = searchInput.value.trim();
          if (q && C.catalog && C.catalog.filterByQuery) {
            C.catalog.filterByQuery(q);
          }
          closeSearch();
        }
      });
    }

    /* ESC cierra el search bar abierto */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && searchBar && !searchBar.hidden) closeSearch();
    });

    /* Sticky nav: clase .is-scrolled cuando bajás del primer 1px */
    if (nav) {
      var rafScroll;
      function onScroll() {
        if (rafScroll) return;
        rafScroll = requestAnimationFrame(function () {
          rafScroll = null;
          nav.classList.toggle('is-scrolled', window.scrollY > 4);
        });
      }
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }

  /* ---- Animaciones GSAP ---- */
  var cardTriggers = [];

  function initGsap() {
    if (typeof gsap === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    /* Encabezado de sección */
    gsap.utils.toArray('.section-head').forEach(function (head) {
      gsap.from(head.children, {
        y: 28, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out',
        scrollTrigger: { trigger: head, start: 'top 88%' }
      });
    });
  }

  /* Revela las cards de producto con stagger al entrar en viewport.
     Se llama tras cada render del catálogo. */
  C.revealGrid = function () {
    if (typeof gsap === 'undefined') return;
    cardTriggers.forEach(function (t) { t.kill(); });
    cardTriggers = [];

    var cards = gsap.utils.toArray('.product-card');
    if (!cards.length) return;

    cardTriggers = ScrollTrigger.batch(cards, {
      start: 'top 94%',
      onEnter: function (batch) {
        gsap.fromTo(batch,
          { y: 44 },
          { y: 0, duration: 0.7, stagger: 0.07, ease: 'power2.out', overwrite: true, clearProps: 'transform' }
        );
      }
    });
    ScrollTrigger.refresh();
  };

  /* ---- Init ---- */
  document.addEventListener('DOMContentLoaded', function () {
    initNav();
    C.cart.init();
    C.modal.init();
    initGsap();

    var grid = document.getElementById('catalogGrid');
    var empty = document.getElementById('emptyState');

    C.loadProducts()
      .then(function () {
        C.catalog.init();
      })
      .catch(function (err) {
        if (grid) grid.innerHTML = '';
        if (empty) {
          empty.hidden = false;
          empty.innerHTML = '<p>No se pudo cargar el catálogo.<br>' +
            C.escapeHtml(err.message) + '</p>' +
            '<button class="btn btn--outline" onclick="location.reload()">Reintentar</button>';
        }
      });
  });

})(window.Clousa);
