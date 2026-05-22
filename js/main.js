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
    var nav = document.getElementById('nav');
    var toggle = document.getElementById('navToggle');
    var mobile = document.getElementById('navMobile');
    if (toggle && mobile) {
      toggle.addEventListener('click', function () {
        var opening = !nav.classList.contains('is-open');
        if (opening) mobile.style.top = nav.getBoundingClientRect().bottom + 'px';
        nav.classList.toggle('is-open');
        mobile.classList.toggle('is-open');
      });
      mobile.addEventListener('click', function (e) {
        if (e.target.tagName === 'A') {
          nav.classList.remove('is-open');
          mobile.classList.remove('is-open');
        }
      });
    }
    var searchBtn = document.getElementById('navSearchBtn');
    if (searchBtn) {
      searchBtn.addEventListener('click', function () {
        var input = document.getElementById('searchInput');
        if (input) {
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(function () { input.focus(); }, 400);
        }
      });
    }
  }

  /* ---- Animaciones GSAP ---- */
  var cardTriggers = [];

  function initGsap() {
    if (typeof gsap === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    /* Hero — parallax sobre la imagen de fondo */
    gsap.to('#heroImg', {
      yPercent: 16,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });

    /* Hero — entrada escalonada del contenido */
    gsap.from('.hero__content > *', {
      y: 34, opacity: 0, duration: 1, stagger: 0.12, ease: 'power3.out', delay: 0.15
    });

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
        gsap.from(batch, {
          y: 44, opacity: 0, duration: 0.7, stagger: 0.07,
          ease: 'power2.out', overwrite: true
        });
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
