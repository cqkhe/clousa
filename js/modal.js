/* ===================================================================
   CLOUSA PREMIUM v2.0 — modal.js
   Vista rápida de producto: imagen, color, talle y alta al carrito.
   =================================================================== */

window.Clousa = window.Clousa || {};

(function (C) {
  'use strict';

  var current       = null;
  var size          = null;
  var selectedColor = null;
  var lastFocused   = null;  /* para restaurar foco al cerrar (a11y) */
  var dom           = {};

  var DUMMY_SIZES = { 'U': true, '99': true };

  /* Devuelve la etiqueta de display de un color.
     Variantes sin hex (estampas): "Estampa 1", "Estampa 2"…
     Colores normales: nombre del color. */
  function colorLabel(c) {
    if (c.hex) return c.nombre;
    var n = parseInt(String(c.codigo).replace(/[^0-9]/g, ''), 10) || c.codigo;
    return 'Estampa ' + n;
  }

  // ── Talles ────────────────────────────────────────────────────────

  function renderSizes(product, color) {
    var talles       = product.talles || [];
    var isSingleDummy = talles.length === 1 && DUMMY_SIZES[talles[0]];

    if (isSingleDummy) {
      size                 = talles[0];
      dom.sizeLabel.hidden = true;
      dom.sizes.hidden     = true;
      dom.sizes.innerHTML  = '';
      return;
    }

    dom.sizeLabel.hidden = false;
    dom.sizes.hidden     = false;

    /* Si hay un color activo usamos sus talles_disponibles;
       si no hay colores en el producto, todos los talles están habilitados. */
    var available = (color && Array.isArray(color.talles_disponibles))
      ? color.talles_disponibles
      : talles;

    // Si el talle elegido ya no está en el nuevo color, deseleccionarlo
    if (size && available.indexOf(size) === -1) size = null;

    dom.sizes.innerHTML = talles.map(function (t) {
      var disabled = available.indexOf(t) === -1;
      var cls = 'modal__size' +
        (disabled   ? ' is-disabled' : '') +
        (t === size ? ' is-active'   : '');
      return '<button class="' + cls + '" data-size="' + C.escapeHtml(t) + '"' +
        (disabled ? ' tabindex="-1"' : '') + '>' + C.escapeHtml(t) + '</button>';
    }).join('');
  }

  // ── Colores ───────────────────────────────────────────────────────

  function renderColors(product) {
    var colores = product.colores || [];

    if (colores.length <= 1) {
      dom.colorBlock.hidden = true;
      selectedColor = colores[0] || null;
      return;
    }

    dom.colorBlock.hidden = false;

    dom.colorsEl.innerHTML = colores.map(function (c) {
      var isOut     = !c.talles_disponibles || c.talles_disponibles.length === 0;
      var isVariant = !c.hex;
      var varNum    = isVariant
        ? (parseInt(String(c.codigo).replace(/[^0-9]/g, ''), 10) || c.codigo)
        : '';
      var bg  = c.hex ? C.escapeHtml(c.hex) : '#e5e5e5';
      var cls = 'modal__color' + (isOut ? ' is-out-of-stock' : '');

      return '<button class="' + cls + '" data-color="' + C.escapeHtml(c.codigo) + '" ' +
        'style="background:' + bg + ';" title="' + C.escapeHtml(colorLabel(c)) + '"' +
        (isOut ? ' aria-disabled="true"' : '') + '>' +
        (isVariant ? C.escapeHtml(String(varNum)) : '') +
        '</button>';
    }).join('');

    /* Preseleccionar primer color con stock; si todos sin stock, el primero */
    var toSelect = null;
    for (var i = 0; i < colores.length; i++) {
      if (colores[i].talles_disponibles && colores[i].talles_disponibles.length > 0) {
        toSelect = colores[i];
        break;
      }
    }
    applyColor(toSelect || colores[0], false);
  }

  function applyColor(color, resetSize) {
    selectedColor = color;
    if (resetSize) size = null;

    dom.colorName.textContent = colorLabel(color);

    var all = dom.colorsEl.querySelectorAll('.modal__color');
    for (var i = 0; i < all.length; i++) {
      all[i].classList.toggle('is-selected',
        all[i].getAttribute('data-color') === color.codigo);
    }

    renderSizes(current, color);
  }

  // ── open / close ──────────────────────────────────────────────────

  /* Renderiza la galería: imagen principal + thumbnails clickeables.
     Si el producto tiene 1 sola imagen, oculta los thumbs. */
  function renderGallery(product) {
    var imgs = (product.imagenes && product.imagenes.length > 0)
      ? product.imagenes
      : [product.img];

    dom.img.src = imgs[0];
    dom.img.alt = product.name;

    if (imgs.length <= 1) {
      dom.thumbs.hidden = true;
      dom.thumbs.innerHTML = '';
      return;
    }

    dom.thumbs.hidden = false;
    dom.thumbs.innerHTML = imgs.map(function (src, i) {
      var safeSrc = C.escapeHtml(src);
      var isActive = i === 0 ? ' is-active' : '';
      return '<button type="button" class="modal__thumb' + isActive +
        '" data-thumb-index="' + i + '" aria-label="Imagen ' + (i + 1) + '">' +
        '<img src="' + safeSrc + '" alt="" loading="lazy">' +
      '</button>';
    }).join('');
  }

  function onThumbClick(e) {
    var btn = e.target.closest('[data-thumb-index]');
    if (!btn) return;
    var idx = parseInt(btn.getAttribute('data-thumb-index'), 10);
    var imgs = (current && current.imagenes) ? current.imagenes : [];
    if (!imgs[idx]) return;
    dom.img.src = imgs[idx];
    var all = dom.thumbs.querySelectorAll('.modal__thumb');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('is-active');
    btn.classList.add('is-active');
  }

  /* Focus trap: cicla Tab dentro del modal mientras está abierto. */
  function onTrapTab(e) {
    if (e.key !== 'Tab' || !dom.modal.classList.contains('is-open')) return;
    var focusables = dom.modal.querySelectorAll(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    var visible = Array.prototype.filter.call(focusables, function (el) {
      return el.offsetParent !== null;
    });
    if (visible.length === 0) return;
    var first = visible[0];
    var last  = visible[visible.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function open(product) {
    if (!product) return;
    current       = product;
    size          = null;
    selectedColor = null;

    /* Guardar el elemento que tenía foco para restaurar al cerrar */
    lastFocused = document.activeElement;

    /* Galería con thumbnails (usa product.imagenes si existe) */
    renderGallery(product);

    dom.brand.textContent = product.brand;
    dom.name.textContent  = product.name;
    dom.price.textContent = C.formatPrice(product.price);
    dom.code.textContent  = product.id ? 'Cód. ' + product.id : '';
    dom.meta.textContent  = product.category + (product.soldOut ? ' · Sin stock' : '');
    dom.error.classList.remove('is-visible');

    dom.desc.textContent = product.description || '';
    dom.desc.hidden      = !product.description;

    /* renderColors llama internamente a renderSizes cuando hay 2+ colores.
       Para productos sin colores, renderSizes se llama directamente. */
    renderColors(product);
    if (!product.colores || product.colores.length <= 1) {
      renderSizes(product, selectedColor);
    }

    dom.add.disabled    = !!product.soldOut;
    dom.add.textContent = product.soldOut ? 'Sin stock' : 'Agregar al carrito';

    dom.modal.classList.add('is-open');
    document.body.classList.add('no-scroll');

    /* Foco al botón cerrar (accesibilidad keyboard nav).
       Pequeño delay para que el modal sea focusable después de la transición. */
    setTimeout(function () {
      var closeBtn = document.getElementById('modalClose');
      if (closeBtn) closeBtn.focus();
    }, 50);
  }

  function close() {
    dom.modal.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
    current       = null;
    size          = null;
    selectedColor = null;

    /* Restaurar foco al elemento que abrió el modal */
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try { lastFocused.focus(); } catch (e) {}
      lastFocused = null;
    }
  }

  // ── Interacciones ─────────────────────────────────────────────────

  function onSizeClick(e) {
    var b = e.target.closest('[data-size]');
    if (!b || b.classList.contains('is-disabled')) return;
    size = b.getAttribute('data-size');
    var all = dom.sizes.querySelectorAll('.modal__size');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('is-active');
    b.classList.add('is-active');
    dom.error.classList.remove('is-visible');
  }

  function onColorClick(e) {
    var b = e.target.closest('[data-color]');
    if (!b || b.classList.contains('is-out-of-stock')) return;
    var cod     = b.getAttribute('data-color');
    var colores = current ? (current.colores || []) : [];
    for (var i = 0; i < colores.length; i++) {
      if (colores[i].codigo === cod) { applyColor(colores[i], true); break; }
    }
  }

  function addToCart() {
    if (!current) return;
    if (!size) { dom.error.classList.add('is-visible'); return; }
    /* Solo incluir color en el carrito cuando el selector estuvo visible */
    var colorForCart = (current.colores && current.colores.length > 1)
      ? selectedColor : null;
    C.cart.add(current, size, 1, colorForCart);
    close();
  }

  function consultWA() {
    if (!current) return;
    var colorStr = (selectedColor && current.colores && current.colores.length > 1)
      ? '\nColor: ' + colorLabel(selectedColor) : '';
    var msg = 'Hola! Me interesa este producto:\n\n' + current.name +
      (size ? '\nTalle: ' + size : '') + colorStr +
      '\nPrecio: ' + C.formatPrice(current.price);
    window.open('https://wa.me/' + C.WHATSAPP + '?text=' + encodeURIComponent(msg), '_blank');
  }

  // ── init ──────────────────────────────────────────────────────────

  function init() {
    dom.modal      = document.getElementById('modal');
    dom.img        = document.getElementById('modalImg');
    dom.thumbs     = document.getElementById('modalThumbs');
    dom.brand      = document.getElementById('modalBrand');
    dom.name       = document.getElementById('modalName');
    dom.price      = document.getElementById('modalPrice');
    dom.code       = document.getElementById('modalCode');
    dom.desc       = document.getElementById('modalDesc');
    dom.colorBlock = document.getElementById('modalColorBlock');
    dom.colorName  = document.getElementById('modalColorName');
    dom.colorsEl   = document.getElementById('modalColors');
    dom.sizeLabel  = document.getElementById('modalSizeLabel');
    dom.meta       = document.getElementById('modalMeta');
    dom.sizes      = document.getElementById('modalSizes');
    dom.error      = document.getElementById('modalError');
    dom.add        = document.getElementById('modalAdd');

    dom.sizes.addEventListener('click', onSizeClick);
    dom.colorsEl.addEventListener('click', onColorClick);
    if (dom.thumbs) dom.thumbs.addEventListener('click', onThumbClick);
    dom.add.addEventListener('click', addToCart);

    var waBtn    = document.getElementById('modalWA');
    if (waBtn) waBtn.addEventListener('click', consultWA);

    var closeBtn = document.getElementById('modalClose');
    if (closeBtn) closeBtn.addEventListener('click', close);

    dom.modal.addEventListener('click', function (e) {
      if (e.target === dom.modal) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && dom.modal.classList.contains('is-open')) close();
    });
    /* Focus trap dentro del modal (a11y — Radix pattern) */
    document.addEventListener('keydown', onTrapTab);
  }

  C.modal = { init: init, open: open, close: close };

})(window.Clousa);
