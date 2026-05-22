/* ===================================================================
   CLOUSA PREMIUM v2.0 — modal.js
   Vista rápida de producto: imagen, selección de talle y alta al carrito.
   =================================================================== */

window.Clousa = window.Clousa || {};

(function (C) {
  'use strict';

  var current = null;   // producto abierto
  var size = null;      // talle seleccionado
  var dom = {};

  function open(product) {
    if (!product) return;
    current = product;
    size = null;

    dom.img.src = product.img;
    dom.img.alt = product.name;
    dom.brand.textContent = product.brand;
    dom.name.textContent = product.name;
    dom.price.textContent = C.formatPrice(product.price);
    dom.meta.textContent = product.category + (product.soldOut ? ' · Sin stock' : '');
    dom.error.classList.remove('is-visible');

    dom.sizes.innerHTML = product.talles.map(function (t) {
      return '<button class="size" data-size="' + C.escapeHtml(t) + '">' +
        C.escapeHtml(t) + '</button>';
    }).join('');

    dom.add.disabled = !!product.soldOut;
    dom.add.textContent = product.soldOut ? 'Sin stock' : 'Agregar al carrito';

    dom.modal.classList.add('is-open');
    document.body.classList.add('no-scroll');
  }

  function close() {
    dom.modal.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
    current = null;
    size = null;
  }

  function selectSize(btn, value) {
    size = value;
    var all = dom.sizes.querySelectorAll('.size');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('is-active');
    btn.classList.add('is-active');
    dom.error.classList.remove('is-visible');
  }

  function addToCart() {
    if (!current) return;
    if (!size) { dom.error.classList.add('is-visible'); return; }
    C.cart.add(current, size, 1);
    close();
  }

  function consultWA() {
    if (!current) return;
    var msg = 'Hola! Me interesa este producto:\n\n' + current.name +
      (size ? '\nTalle: ' + size : '') +
      '\nPrecio: ' + C.formatPrice(current.price);
    window.open('https://wa.me/' + C.WHATSAPP + '?text=' + encodeURIComponent(msg), '_blank');
  }

  function init() {
    dom.modal = document.getElementById('modal');
    dom.img   = document.getElementById('modalImg');
    dom.brand = document.getElementById('modalBrand');
    dom.name  = document.getElementById('modalName');
    dom.price = document.getElementById('modalPrice');
    dom.meta  = document.getElementById('modalMeta');
    dom.sizes = document.getElementById('modalSizes');
    dom.error = document.getElementById('modalError');
    dom.add   = document.getElementById('modalAdd');

    dom.sizes.addEventListener('click', function (e) {
      var b = e.target.closest('[data-size]');
      if (b) selectSize(b, b.getAttribute('data-size'));
    });
    dom.add.addEventListener('click', addToCart);

    var waBtn = document.getElementById('modalWA');
    if (waBtn) waBtn.addEventListener('click', consultWA);

    var closeBtn = document.getElementById('modalClose');
    if (closeBtn) closeBtn.addEventListener('click', close);

    dom.modal.addEventListener('click', function (e) {
      if (e.target === dom.modal) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && dom.modal.classList.contains('is-open')) close();
    });
  }

  C.modal = { init: init, open: open, close: close };

})(window.Clousa);
