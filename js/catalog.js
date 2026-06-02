/* ===================================================================
   CLOUSA PREMIUM v2.0 — catalog.js
   Render de la grilla + filtros (categoría, precio, búsqueda) + orden.
   =================================================================== */

window.Clousa = window.Clousa || {};

(function (C) {
  'use strict';

  var PRICE_BRACKETS = [
    { id: 'all',          label: 'Todos los precios',     min: 0,      max: Infinity },
    { id: '0-25000',      label: 'Hasta $25.000',         min: 0,      max: 25000 },
    { id: '25000-50000',  label: '$25.000 – $50.000',     min: 25000,  max: 50000 },
    { id: '50000-75000',  label: '$50.000 – $75.000',     min: 50000,  max: 75000 },
    { id: '75000-100000', label: '$75.000 – $100.000',    min: 75000,  max: 100000 },
    { id: '100000+',      label: 'Más de $100.000',       min: 100000, max: Infinity }
  ];

  var SORTS = [
    { id: 'destacados', label: 'Destacados' },
    { id: 'precio-asc', label: 'Precio: menor a mayor' },
    { id: 'precio-desc', label: 'Precio: mayor a menor' },
    { id: 'nombre',     label: 'Nombre A–Z' }
  ];

  function getProductImage(p) {
    if (p.imagenes && p.imagenes.length > 0) return p.imagenes[0];
    if (p.img) return p.img;
    return 'assets/placeholder.svg';
  }

  var INITIAL_LIMIT = 8;
  var state = { category: 'all', categoryGroup: null, price: 'all', sort: 'destacados', query: '', brand: 'all', showAll: false };
  var dom = {};

  function buildCategoryChips() {
    var chips = ['<button class="chip is-active" data-cat="all">Todas</button>'];
    C.categorias.forEach(function (cat) {
      chips.push('<button class="chip" data-cat="' + C.escapeHtml(cat) + '">' +
        C.escapeHtml(cat) + '</button>');
    });
    dom.chips.innerHTML = chips.join('');
  }

  function buildSelects() {
    dom.price.innerHTML = PRICE_BRACKETS.map(function (b) {
      return '<option value="' + b.id + '">' + b.label + '</option>';
    }).join('');
    dom.sort.innerHTML = SORTS.map(function (s) {
      return '<option value="' + s.id + '">' + s.label + '</option>';
    }).join('');
  }

  /* Vista inicial destacada: top 8 Brooksfield ≥ $120.000,
     intercalando categorías para diversidad visual.
     Solo se usa cuando todos los filtros están en default. */
  function getInitialFeatured() {
    var brooks = C.productos
      .filter(function (p) { return p.brand === 'Brooksfield' && p.price >= 120000 && !p.soldOut; })
      .sort(function (a, b) { return b.price - a.price; });

    if (brooks.length < 8) {
      brooks = C.productos
        .filter(function (p) { return p.brand === 'Brooksfield' && !p.soldOut; })
        .sort(function (a, b) { return b.price - a.price; });
    }

    var byCategory = {};
    brooks.forEach(function (p) {
      if (!byCategory[p.category]) byCategory[p.category] = [];
      byCategory[p.category].push(p);
    });

    var categories = Object.keys(byCategory);
    var result = [];
    var idx = 0;
    while (result.length < 8) {
      var added = false;
      for (var i = 0; i < categories.length && result.length < 8; i++) {
        var cat = categories[i];
        if (byCategory[cat][idx]) {
          result.push(byCategory[cat][idx]);
          added = true;
        }
      }
      if (!added) break;
      idx++;
    }
    return result;
  }

  /* Jeans destacados fijos (8 productos por nombre).
     Intercala las 3 familias CARGO / CARPENTER / ROMA round-robin
     para diversidad visual. */
  function getFeaturedJeans() {
    var targets = [
      'JEAN CARGO BLUE PREMIUM MASCULINO',
      'JEAN CARGO LIGHT BLUE PREMIUM MASCULINO',
      'JEAN CARPENTER BLUE PREMIUM MASCULINO',
      'JEAN CARPENTER L. BLUE PREMIUM MASCULINO',
      'JEAN CARPEN PATCH L. BLUE PREM MASCULINO',
      'JEAN ROMA HEAVY VINTAGE',
      'JEAN ROMA VINTAGE PREMIUM',
      'JEAN ROMA DARK BLUE PREMIUM'
    ];
    function norm(s) {
      return String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
    }
    var matched = [];
    targets.forEach(function (target) {
      var t = norm(target);
      var p = C.productos.filter(function (pr) { return norm(pr.name) === t; })[0];
      if (!p) {
        p = C.productos.filter(function (pr) { return norm(pr.name).indexOf(t) >= 0; })[0];
      }
      if (p) matched.push(p);
    });

    var byFamily = { CARGO: [], CARPENTER: [], ROMA: [] };
    matched.forEach(function (p) {
      var n = norm(p.name);
      if (/CARGO/.test(n))             byFamily.CARGO.push(p);
      else if (/CARPEN/.test(n))       byFamily.CARPENTER.push(p);
      else if (/ROMA/.test(n))         byFamily.ROMA.push(p);
    });

    var families = ['CARGO', 'CARPENTER', 'ROMA'];
    var result = [];
    var idx = 0;
    while (result.length < 8) {
      var added = false;
      for (var i = 0; i < families.length && result.length < 8; i++) {
        var p = byFamily[families[i]][idx];
        if (p) { result.push(p); added = true; }
      }
      if (!added) break;
      idx++;
    }
    return result;
  }

  function isInitialDefault() {
    return !state.showAll
      && state.brand === 'all'
      && state.category === 'all'
      && state.price === 'all'
      && state.sort === 'destacados'
      && !state.query;
  }

  function getFiltered() {
    var bracket = PRICE_BRACKETS.filter(function (b) { return b.id === state.price; })[0]
      || PRICE_BRACKETS[0];
    var q = state.query.trim().toLowerCase();

    var list = C.productos.filter(function (p) {
      if (state.brand !== 'all' && p.brand !== state.brand) return false;
      if (state.categoryGroup && state.categoryGroup.indexOf(p.category) === -1) return false;
      if (state.category !== 'all' && p.category !== state.category) return false;
      if (p.price < bracket.min || p.price > bracket.max) return false;
      if (q && p.name.toLowerCase().indexOf(q) === -1 &&
              p.category.toLowerCase().indexOf(q) === -1 &&
              p.brand.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });

    if (state.sort === 'precio-asc')  list.sort(function (a, b) { return a.price - b.price; });
    if (state.sort === 'precio-desc') list.sort(function (a, b) { return b.price - a.price; });
    if (state.sort === 'nombre')      list.sort(function (a, b) { return a.name.localeCompare(b.name); });

    return list;
  }

  function cardHtml(p) {
    return '' +
      '<article class="product-card' + (p.soldOut ? ' is-sold' : '') + '" data-id="' +
        C.escapeHtml(p.id) + '">' +
        '<div class="product-card__media">' +
          (p.soldOut ? '<span class="product-card__badge">Agotado</span>' : '') +
          '<img loading="lazy" src="' + C.escapeHtml(getProductImage(p)) + '" alt="' +
            C.escapeHtml(p.name) + '" ' +
            'onerror="this.onerror=null;this.src=\'assets/placeholder.svg\';this.classList.add(\'img-error\')">' +
          '<button class="product-card__quick">Vista rápida</button>' +
        '</div>' +
        '<div class="product-card__info">' +
          '<p class="product-card__brand">' + C.escapeHtml(p.brand) + '</p>' +
          '<h3 class="product-card__name">' + C.escapeHtml(p.name) + '</h3>' +
          '<p class="product-card__price">' + C.formatPrice(p.price) + '</p>' +
        '</div>' +
      '</article>';
  }

  function render() {
    var initialMode = isInitialDefault();
    var list = initialMode ? getInitialFeatured() : getFiltered();

    dom.count.textContent = list.length +
      (list.length === 1 ? ' producto' : ' productos');

    /* Sincroniza el contador del header de colección */
    var collCount = document.getElementById('collectionCount');
    if (collCount) {
      collCount.textContent = list.length +
        (list.length === 1 ? ' producto' : ' productos');
    }

    if (list.length === 0) {
      dom.grid.innerHTML = '';
      dom.empty.hidden = false;
      if (dom.loadMoreWrap) dom.loadMoreWrap.hidden = true;
      return;
    }

    dom.empty.hidden = true;

    var visible = (!state.showAll && list.length > INITIAL_LIMIT)
      ? list.slice(0, INITIAL_LIMIT)
      : list;

    dom.grid.innerHTML = visible.map(cardHtml).join('');
    dom.grid.classList.toggle('is-featured', initialMode);
    if (dom.featuredWrap) dom.featuredWrap.classList.toggle('is-featured', initialMode);

    /* En vista inicial siempre mostramos el CTA para acceder al catálogo completo */
    if (initialMode) {
      if (dom.loadMoreWrap) dom.loadMoreWrap.hidden = false;
    } else {
      if (dom.loadMoreWrap) dom.loadMoreWrap.hidden = state.showAll || list.length <= INITIAL_LIMIT;
    }

    if (C.revealGrid) C.revealGrid();
  }

  /* Activa el catálogo completo filtrado por una marca específica.
     Modo "colección": oculta hero/editorial/jeans/campaign y muestra
     un header con título de la marca + link de regreso. */
  function filterByBrand(brand) {
    state.showAll       = true;
    state.brand         = brand;
    state.category      = 'all';
    state.categoryGroup = null;
    state.price         = 'all';
    state.sort          = 'destacados';
    state.query         = '';

    /* Mostrar los controles ocultos */
    var controls = document.getElementById('catalogControls');
    if (controls) controls.hidden = false;
    var rc = document.getElementById('resultCount');
    if (rc) rc.hidden = false;

    /* Activar modo colección y setear título */
    document.body.classList.add('mode-collection');
    var header = document.getElementById('collectionHeader');
    var title  = document.getElementById('collectionTitle');
    if (header) header.hidden = false;
    if (title)  title.textContent = 'Colección ' + brand + ' Invierno 2026';

    /* Sincronizar UI de los chips de marca */
    if (dom.brandChips) {
      var chips = dom.brandChips.querySelectorAll('.brand-chip');
      Array.prototype.forEach.call(chips, function (c) {
        c.classList.toggle('is-active', c.getAttribute('data-brand') === brand);
      });
    }

    /* Resetear chip de categoría a "Todas" */
    if (dom.chips) {
      var catChips = dom.chips.querySelectorAll('.chip');
      Array.prototype.forEach.call(catChips, function (c) {
        c.classList.toggle('is-active', c.getAttribute('data-cat') === 'all');
      });
    }

    /* Resetear selects e input de búsqueda */
    if (dom.price)  dom.price.value  = 'all';
    if (dom.sort)   dom.sort.value   = 'destacados';
    if (dom.search) dom.search.value = '';

    render();

    /* Scroll al header del catálogo */
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* Filtra por marca + grupo de categorías (ej: "Mistral · Remeras"
     que incluye REMERAS MC + REMERAS ML). */
  function filterByBrandAndCategory(brand, categoriesStr, label) {
    state.showAll       = true;
    state.brand         = brand;
    state.category      = 'all';
    state.categoryGroup = categoriesStr
      ? categoriesStr.split(',').map(function (s) { return s.trim(); })
      : null;
    state.price = 'all';
    state.sort  = 'destacados';
    state.query = '';

    var controls = document.getElementById('catalogControls');
    if (controls) controls.hidden = false;
    var rc = document.getElementById('resultCount');
    if (rc) rc.hidden = false;

    document.body.classList.add('mode-collection');
    var header = document.getElementById('collectionHeader');
    var title  = document.getElementById('collectionTitle');
    if (header) header.hidden = false;
    if (title)  title.textContent = label || (brand + ' · Categoría');

    if (dom.brandChips) {
      var chips = dom.brandChips.querySelectorAll('.brand-chip');
      Array.prototype.forEach.call(chips, function (c) {
        c.classList.toggle('is-active', c.getAttribute('data-brand') === brand);
      });
    }
    if (dom.chips) {
      var catChips = dom.chips.querySelectorAll('.chip');
      Array.prototype.forEach.call(catChips, function (c) {
        c.classList.toggle('is-active', c.getAttribute('data-cat') === 'all');
      });
    }
    if (dom.price)  dom.price.value  = 'all';
    if (dom.sort)   dom.sort.value   = 'destacados';
    if (dom.search) dom.search.value = '';

    render();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* Salir del modo colección: restaura la home con destacados */
  function exitCollectionMode() {
    document.body.classList.remove('mode-collection');
    var header = document.getElementById('collectionHeader');
    if (header) header.hidden = true;

    /* Resetear estado para volver a la vista inicial featured */
    state.showAll       = false;
    state.brand         = 'all';
    state.category      = 'all';
    state.categoryGroup = null;
    state.price         = 'all';
    state.sort          = 'destacados';
    state.query         = '';

    /* Ocultar controles otra vez */
    var controls = document.getElementById('catalogControls');
    if (controls) controls.hidden = true;
    var rc = document.getElementById('resultCount');
    if (rc) rc.hidden = true;

    /* Resetear UI */
    if (dom.brandChips) {
      var chips = dom.brandChips.querySelectorAll('.brand-chip');
      Array.prototype.forEach.call(chips, function (c) {
        c.classList.toggle('is-active', c.getAttribute('data-brand') === 'all');
      });
    }
    if (dom.chips) {
      var catChips = dom.chips.querySelectorAll('.chip');
      Array.prototype.forEach.call(catChips, function (c) {
        c.classList.toggle('is-active', c.getAttribute('data-cat') === 'all');
      });
    }
    if (dom.price)  dom.price.value  = 'all';
    if (dom.sort)   dom.sort.value   = 'destacados';
    if (dom.search) dom.search.value = '';

    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function init() {
    dom.grid         = document.getElementById('catalogGrid');
    dom.count        = document.getElementById('resultCount');
    dom.empty        = document.getElementById('emptyState');
    dom.loadMoreWrap = document.getElementById('loadMoreWrap');
    dom.chips        = document.getElementById('catChips');
    dom.brandChips   = document.getElementById('brandChips');
    dom.price        = document.getElementById('priceFilter');
    dom.sort         = document.getElementById('sortFilter');
    dom.search       = document.getElementById('searchInput');
    dom.featuredWrap = document.getElementById('featuredWrap');
    dom.jeansGrid    = document.getElementById('featuredJeansGrid');

    function scrollGrid(gridEl, dir) {
      var card = gridEl.querySelector('.product-card');
      if (!card) return;
      gridEl.scrollBy({ left: dir * (card.offsetWidth + 18), behavior: 'smooth' });
    }
    function bindNavButtons(prevId, nextId, gridEl) {
      var p = document.getElementById(prevId);
      var n = document.getElementById(nextId);
      if (p) p.addEventListener('click', function () { scrollGrid(gridEl, -1); });
      if (n) n.addEventListener('click', function () { scrollGrid(gridEl, 1); });
    }
    bindNavButtons('featuredPrev', 'featuredNext', dom.grid);
    bindNavButtons('featuredJeansPrev', 'featuredJeansNext', dom.jeansGrid);

    /* Click en card de jeans → abre modal (mismo handler que el grid principal) */
    if (dom.jeansGrid) {
      dom.jeansGrid.addEventListener('click', function (e) {
        var card = e.target.closest('.product-card');
        if (!card) return;
        var p = C.getById(card.getAttribute('data-id'));
        if (p) C.modal.open(p);
      });
    }

    /* Dropdown del nav: links con data-brand → expanden el catálogo.
       Si tienen data-categories, filtran además por ese conjunto. */
    var brandLinks = document.querySelectorAll('.nav__dropdown a[data-brand]');
    Array.prototype.forEach.call(brandLinks, function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var brand      = link.getAttribute('data-brand');
        var categories = link.getAttribute('data-categories');
        var label      = link.getAttribute('data-label');
        if (categories) {
          filterByBrandAndCategory(brand, categories, label);
        } else {
          filterByBrand(brand);
        }
      });
    });

    /* Link "Volver al inicio" del header de colección */
    var backLink = document.getElementById('collectionBack');
    if (backLink) {
      backLink.addEventListener('click', function (e) {
        e.preventDefault();
        exitCollectionMode();
      });
    }

    /* Click en logo o links del nav que apuntan al hero → salir del modo colección */
    var logoLink = document.querySelector('.nav__logo');
    if (logoLink) {
      logoLink.addEventListener('click', function () {
        if (document.body.classList.contains('mode-collection')) {
          exitCollectionMode();
        }
      });
    }

    /* Render fila de jeans destacados (una sola vez al cargar) */
    function renderJeans() {
      if (!dom.jeansGrid) return;
      var list = getFeaturedJeans();
      if (list.length === 0) {
        var section = dom.jeansGrid.closest('section');
        if (section) section.hidden = true;
        return;
      }
      dom.jeansGrid.innerHTML = list.map(cardHtml).join('');
    }
    renderJeans();

    var loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', function () {
        state.showAll = true;
        var controls = document.getElementById('catalogControls');
        if (controls) controls.hidden = false;
        var rc = document.getElementById('resultCount');
        if (rc) rc.hidden = false;
        render();
      });
    }

    buildCategoryChips();
    buildSelects();

    dom.brandChips.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-brand]');
      if (!chip) return;
      state.brand = chip.getAttribute('data-brand');
      state.showAll = false;
      state.categoryGroup = null;
      var all = dom.brandChips.querySelectorAll('.brand-chip');
      for (var i = 0; i < all.length; i++) all[i].classList.remove('is-active');
      chip.classList.add('is-active');
      render();
    });

    dom.chips.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-cat]');
      if (!chip) return;
      state.category = chip.getAttribute('data-cat');
      state.showAll = false;
      state.categoryGroup = null;
      var all = dom.chips.querySelectorAll('.chip');
      for (var i = 0; i < all.length; i++) all[i].classList.remove('is-active');
      chip.classList.add('is-active');
      render();
    });

    dom.price.addEventListener('change', function () {
      state.price = dom.price.value; state.showAll = false; state.categoryGroup = null; render();
    });
    dom.sort.addEventListener('change', function () {
      state.sort = dom.sort.value; state.showAll = false; state.categoryGroup = null; render();
    });

    var t;
    dom.search.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        state.query = dom.search.value; state.showAll = false; state.categoryGroup = null; render();
      }, 160);
    });

    /* Click en card -> abre la vista rápida */
    dom.grid.addEventListener('click', function (e) {
      var card = e.target.closest('.product-card');
      if (!card) return;
      var p = C.getById(card.getAttribute('data-id'));
      if (p) C.modal.open(p);
    });

    /* Filtrado por categoría desde un enlace externo (ej. nav) */
    var hash = decodeURIComponent(location.hash.replace('#cat=', ''));
    if (hash && location.hash.indexOf('#cat=') === 0) {
      state.category = hash;
      var target = dom.chips.querySelector('[data-cat="' + hash + '"]');
      if (target) {
        dom.chips.querySelectorAll('.chip').forEach(function (c) {
          c.classList.remove('is-active');
        });
        target.classList.add('is-active');
      }
    }

    render();
  }

  C.catalog = {
    init: init,
    render: render,
    filterByBrand: filterByBrand,
    filterByBrandAndCategory: filterByBrandAndCategory
  };

})(window.Clousa);
