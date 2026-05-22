/* ===================================================================
   CLOUSA PREMIUM v2.0 — cart.js
   Carrito con persistencia en localStorage + checkout WhatsApp / Mercado Pago.
   =================================================================== */

window.Clousa = window.Clousa || {};

(function (C) {
  'use strict';

  var STORAGE_KEY = 'clousa_cart_v2';
  var MP_ENDPOINT = '/.netlify/functions/crear-preferencia';

  var items = [];
  var dom = {};

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) {}
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      items = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(items)) items = [];
    } catch (e) { items = []; }
  }

  function count() {
    return items.reduce(function (s, i) { return s + i.qty; }, 0);
  }
  function total() {
    return items.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
  }

  function render() {
    var n = count();
    if (dom.navCount) {
      dom.navCount.textContent = n;
      dom.navCount.hidden = n === 0;
    }
    if (!dom.body) return;

    if (items.length === 0) {
      dom.body.innerHTML =
        '<div class="cart__empty">' +
        '<span>Tu carrito está vacío</span>' +
        '<button class="btn btn--outline" data-cart-close>Ver catálogo</button>' +
        '</div>';
      if (dom.foot) dom.foot.hidden = true;
      return;
    }

    if (dom.foot) dom.foot.hidden = false;
    dom.body.innerHTML = items.map(function (it, i) {
      return '' +
        '<div class="cart-item">' +
          '<img class="cart-item__img" src="' + C.escapeHtml(it.img) + '" alt="" loading="lazy">' +
          '<div class="cart-item__info">' +
            '<div class="cart-item__brand">' + C.escapeHtml(it.brand) + '</div>' +
            '<div class="cart-item__name">' + C.escapeHtml(it.name) + '</div>' +
            '<div class="cart-item__price">' + C.formatPrice(it.price) +
              ' · Talle ' + C.escapeHtml(it.talle) + '</div>' +
            '<div class="cart-item__row">' +
              '<div class="qty">' +
                '<button data-cart-qty="' + i + '" data-d="-1" aria-label="Restar">−</button>' +
                '<span>' + it.qty + '</span>' +
                '<button data-cart-qty="' + i + '" data-d="1" aria-label="Sumar">+</button>' +
              '</div>' +
              '<button class="cart-item__remove" data-cart-remove="' + i + '">Quitar</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');

    if (dom.total) dom.total.textContent = C.formatPrice(total());
  }

  function add(product, talle, qty) {
    qty = qty || 1;
    var existing = items.filter(function (i) {
      return i.id === product.id && i.talle === talle;
    })[0];
    if (existing) {
      existing.qty += qty;
    } else {
      items.push({
        id: product.id,
        name: product.name,
        brand: product.brand,
        price: product.price,
        img: product.img,
        talle: talle,
        qty: qty
      });
    }
    save();
    render();
    C.toast('Agregado al carrito');
  }

  function changeQty(index, delta) {
    if (!items[index]) return;
    items[index].qty += delta;
    if (items[index].qty <= 0) items.splice(index, 1);
    save();
    render();
  }

  function remove(index) {
    items.splice(index, 1);
    save();
    render();
  }

  function open() {
    render();
    if (dom.drawer) dom.drawer.classList.add('is-open');
    if (dom.overlay) dom.overlay.classList.add('is-open');
    document.body.classList.add('no-scroll');
  }
  function close() {
    if (dom.drawer) dom.drawer.classList.remove('is-open');
    if (dom.overlay) dom.overlay.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
  }

  function checkoutWA() {
    if (items.length === 0) return;
    var lines = items.map(function (i) {
      return '• ' + i.name + ' (Talle ' + i.talle + ') x' + i.qty +
        ' — ' + C.formatPrice(i.price * i.qty);
    }).join('\n');
    var msg = 'Hola! Quiero realizar este pedido:\n\n' + lines +
      '\n\nTotal: ' + C.formatPrice(total());
    window.open('https://wa.me/' + C.WHATSAPP + '?text=' + encodeURIComponent(msg), '_blank');
  }

  function checkoutMP() {
    if (items.length === 0) return;
    var btn = dom.mpBtn;
    var label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Procesando...'; }

    fetch(MP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map(function (i) {
          return { name: i.name + ' (Talle ' + i.talle + ')', price: i.price, qty: i.qty };
        })
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.init_point) {
          window.location.href = data.init_point;
        } else {
          C.toast('No se pudo iniciar el pago — probá por WhatsApp');
        }
      })
      .catch(function () {
        C.toast('Error de conexión — probá por WhatsApp');
      })
      .then(function () {
        if (btn) { btn.disabled = false; btn.textContent = label; }
      });
  }

  /* Bindea el DOM del drawer del carrito */
  function init() {
    load();
    dom.drawer   = document.getElementById('cart');
    dom.overlay  = document.getElementById('overlay');
    dom.body     = document.getElementById('cartBody');
    dom.foot     = document.getElementById('cartFoot');
    dom.total    = document.getElementById('cartTotal');
    dom.navCount = document.getElementById('navCartCount');
    dom.mpBtn    = document.getElementById('cartMP');

    var openBtn = document.getElementById('navCartBtn');
    if (openBtn) openBtn.addEventListener('click', open);
    if (dom.overlay) dom.overlay.addEventListener('click', close);

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('[data-cart-close]'))  { close(); return; }
      if (t.closest('.cart__close'))       { close(); return; }
      var q = t.closest('[data-cart-qty]');
      if (q) { changeQty(+q.getAttribute('data-cart-qty'), +q.getAttribute('data-d')); return; }
      var r = t.closest('[data-cart-remove]');
      if (r) { remove(+r.getAttribute('data-cart-remove')); return; }
    });

    var waBtn = document.getElementById('cartWA');
    if (waBtn) waBtn.addEventListener('click', checkoutWA);
    if (dom.mpBtn) dom.mpBtn.addEventListener('click', checkoutMP);

    render();
  }

  C.cart = {
    init: init,
    add: add,
    open: open,
    close: close,
    count: count
  };

})(window.Clousa);
