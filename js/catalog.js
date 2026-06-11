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
  /* State con arrays multi-select para el sidebar (Commit E).
     Cada facet es un array — vacío = no filtra, items = OR dentro del facet.
     Entre facets: AND. */
  var state = {
    brandList:    [],          /* multi: ['Mistral', 'Brooksfield'] */
    categoryList: [],          /* multi: nombres de categoría del JSON */
    priceList:    [],          /* multi: ids de PRICE_BRACKETS */
    sizes:        [],          /* multi: ['S','M','L','XL','XXL'] */
    inStockOnly:  false,       /* checkbox único disponibilidad */
    sort:         'destacados',
    query:        '',
    showAll:      false
  };

  /* ────────────────────────────────────────────────────────────────────
     Orden de prioridad comercial — Invierno 2026
     Las prendas fuertes de la temporada arriba, accesorios al final.
     Se aplica cuando el sort es "destacados" (default) y también para
     ordenar los chips de categoría.
     ──────────────────────────────────────────────────────────────────── */
  var CATEGORY_PRIORITY = [
    /* Top invierno — abrigo y outerwear */
    'JACKETS',
    'CAMPERAS FRISADAS', 'CAMPERAS RUSTICAS', 'CAMPERAS POLAR',
    'SWEATERS',
    /* Buzos y canguros */
    'BUZOS FRISADOS', 'BUZOS RUSTICOS', 'BUZOS POLAR',
    'CANGUROS FRISADOS', 'CANGUROS RUSTICOS',
    'CHALECOS',
    /* Camisas y remeras de manga larga */
    'CAMISAS ML',
    'REMERAS ML',
    /* Pantalones */
    'JEANS',
    'PANTALONES', 'PANTALONES CORDEROY',
    'JOGGINGS FRISADOS', 'JOGGINGS RUSTICOS',
    /* Manga corta (menor prioridad en invierno) */
    'POLOS MC',
    'REMERAS MC',
    /* Ropa interior */
    'BOXERS',
    /* Accesorios al final */
    'BUFANDAS', 'GORROS', 'GORRAS',
    'CINTURONES', 'MEDIAS',
    'BILLETERAS', 'BOLSOS',
    /* Perfumería al cierre */
    'PERFUMERIA'
  ];
  function categoryRank(cat) {
    var idx = CATEGORY_PRIORITY.indexOf(cat);
    return idx === -1 ? 999 : idx;
  }
  var dom = {};

  function buildCategoryChips() {
    if (!dom.chips) return;
    /* Ordenar por prioridad comercial (jackets primero, accesorios al final) */
    var sorted = C.categorias.slice().sort(function (a, b) {
      return categoryRank(a) - categoryRank(b);
    });
    var chips = ['<button class="chip is-active" data-cat="all">Todas</button>'];
    sorted.forEach(function (cat) {
      chips.push('<button class="chip" data-cat="' + C.escapeHtml(cat) + '">' +
        C.escapeHtml(cat) + '</button>');
    });
    dom.chips.innerHTML = chips.join('');
  }

  function buildSelects() {
    if (dom.price) {
      dom.price.innerHTML = PRICE_BRACKETS.map(function (b) {
        return '<option value="' + b.id + '">' + b.label + '</option>';
      }).join('');
    }
    if (dom.sort) {
      dom.sort.innerHTML = SORTS.map(function (s) {
        return '<option value="' + s.id + '">' + s.label + '</option>';
      }).join('');
    }
  }

  /* Actualiza el texto del último item del breadcrumb (#collectionBreadcrumb) */
  function setBreadcrumb(label) {
    var bc = document.getElementById('collectionBreadcrumb');
    if (bc) bc.textContent = label;
  }

  /* Asigna la imagen de cada category-card desde un producto representativo
     del JSON. Toma el primero con stock; si no hay, el primero a secas. */
  function setCategoryCardImages() {
    var cards = document.querySelectorAll('.category-card[data-rep-cat]');
    Array.prototype.forEach.call(cards, function (card) {
      var repCat = card.getAttribute('data-rep-cat');
      var match = C.productos.filter(function (p) {
        return p.category === repCat && !p.soldOut && p.img;
      })[0];
      if (!match) {
        match = C.productos.filter(function (p) { return p.category === repCat && p.img; })[0];
      }
      if (match) {
        var img = card.querySelector('img');
        if (img) img.src = match.img;
      }
    });
  }

  function isInitialDefault() {
    return !state.showAll
      && state.brandList.length === 0
      && state.categoryList.length === 0
      && state.priceList.length === 0
      && state.sizes.length === 0
      && !state.inStockOnly
      && state.sort === 'destacados'
      && !state.query;
  }

  /* Verifica si un producto pasa todos los filtros activos excepto el indicado.
     Si excludeFacet === null, aplica todos los filtros.
     Esto permite calcular conteos por facet sin que el propio facet se filtre a sí mismo. */
  function passesFilters(p, excludeFacet) {
    if (excludeFacet !== 'availability' && state.inStockOnly && p.soldOut) return false;
    if (excludeFacet !== 'brand' && state.brandList.length > 0 &&
        state.brandList.indexOf(p.brand) === -1) return false;
    if (excludeFacet !== 'category' && state.categoryList.length > 0 &&
        state.categoryList.indexOf(p.category) === -1) return false;
    if (excludeFacet !== 'size' && state.sizes.length > 0) {
      var talles = p.talles || [];
      var ok = false;
      for (var i = 0; i < talles.length; i++) {
        if (state.sizes.indexOf(talles[i]) !== -1) { ok = true; break; }
      }
      if (!ok) return false;
    }
    if (excludeFacet !== 'price' && state.priceList.length > 0) {
      var inAny = false;
      for (var j = 0; j < state.priceList.length; j++) {
        var bid = state.priceList[j];
        var b = PRICE_BRACKETS.filter(function (br) { return br.id === bid; })[0];
        if (b && p.price >= b.min && p.price <= b.max) { inAny = true; break; }
      }
      if (!inAny) return false;
    }
    var q = state.query.trim().toLowerCase();
    if (q && p.name.toLowerCase().indexOf(q) === -1 &&
            p.category.toLowerCase().indexOf(q) === -1 &&
            p.brand.toLowerCase().indexOf(q) === -1) return false;
    return true;
  }

  function getFiltered() {
    var list = C.productos.filter(function (p) { return passesFilters(p, null); });

    if (state.sort === 'precio-asc')  list.sort(function (a, b) { return a.price - b.price; });
    if (state.sort === 'precio-desc') list.sort(function (a, b) { return b.price - a.price; });
    if (state.sort === 'nombre')      list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    if (state.sort === 'destacados') {
      list.sort(function (a, b) {
        /* 1) por prioridad comercial de categoría */
        var diff = categoryRank(a.category) - categoryRank(b.category);
        if (diff !== 0) return diff;
        /* 2) agotados al final dentro de la misma categoría */
        if (a.soldOut !== b.soldOut) return a.soldOut ? 1 : -1;
        /* 3) precio descendente (premium primero) */
        return b.price - a.price;
      });
    }

    return list;
  }

  function cardHtml(p) {
    /* Imagen secundaria opcional para el hover swap (Dawn pattern). */
    var imgPrimary   = C.escapeHtml(getProductImage(p));
    var imgSecondary = (p.imagenes && p.imagenes.length > 1)
      ? C.escapeHtml(p.imagenes[1])
      : '';
    var hasSecondary = imgSecondary && imgSecondary !== imgPrimary;

    /* Badges con clases modificadoras (sumar --new / --sale después sin tocar lógica). */
    var badgeHtml = '';
    if (p.soldOut) {
      badgeHtml = '<span class="product-card__badge product-card__badge--sold">Sin stock</span>';
    }

    return '' +
      '<article class="product-card' + (p.soldOut ? ' is-sold' : '') + '" data-id="' +
        C.escapeHtml(p.id) + '" tabindex="0" aria-label="' + C.escapeHtml(p.name) + '">' +
        '<div class="product-card__media">' +
          badgeHtml +
          '<img class="product-card__img product-card__img--primary" loading="lazy" src="' + imgPrimary + '" alt="' +
            C.escapeHtml(p.name) + '" ' +
            'onerror="this.onerror=null;this.src=\'assets/placeholder.svg\';this.classList.add(\'img-error\')">' +
          (hasSecondary
            ? '<img class="product-card__img product-card__img--hover" loading="lazy" src="' + imgSecondary + '" alt="" aria-hidden="true" ' +
              'onerror="this.onerror=null;this.style.display=\'none\'">'
            : '') +
          (p.soldOut ? '<div class="product-card__sold-overlay" aria-hidden="true">Agotado</div>' : '') +
          '<span class="product-card__quick" aria-hidden="true">+ Vista rápida</span>' +
        '</div>' +
        '<div class="product-card__info">' +
          '<p class="product-card__brand">' + C.escapeHtml(p.brand) + '</p>' +
          '<h3 class="product-card__name">' + C.escapeHtml(p.name) + '</h3>' +
          '<div class="product-card__price-row">' +
            '<span class="product-card__price">' + C.formatPrice(p.price) + '</span>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function render() {
    var initialMode = isInitialDefault();

    /* En home (initialMode), el #catalogGrid está oculto (collection-only).
       Los brand-blocks ya cubren el render destacado. Salir temprano. */
    if (initialMode) {
      if (dom.loadMoreWrap) dom.loadMoreWrap.hidden = true;
      if (dom.empty) dom.empty.hidden = true;
      return;
    }

    var list = getFiltered();

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
    dom.grid.classList.remove('is-featured');
    if (dom.featuredWrap) dom.featuredWrap.classList.remove('is-featured');

    if (dom.loadMoreWrap) dom.loadMoreWrap.hidden = state.showAll || list.length <= INITIAL_LIMIT;

    if (C.revealGrid) C.revealGrid();
  }

  /* Render de los 2 bloques de marca de la home (Brooksfield + Mistral).
     Toma top 4 productos con stock de cada marca, intercalando categorías
     para diversidad visual. Bind del CTA "Ver toda la colección" + click
     en card → modal. */
  function renderBrandBlocks() {
    var marcas = ['Brooksfield', 'Mistral'];
    marcas.forEach(function (brand) {
      var grid = document.getElementById('brandGrid' + brand);
      if (!grid) return;

      var pool = C.productos
        .filter(function (p) { return p.brand === brand && !p.soldOut; })
        .sort(function (a, b) { return b.price - a.price; });

      /* Round-robin por categoría para no repetir tipos */
      var byCategory = {};
      pool.forEach(function (p) {
        if (!byCategory[p.category]) byCategory[p.category] = [];
        byCategory[p.category].push(p);
      });
      var categories = Object.keys(byCategory).sort(function (a, b) {
        return categoryRank(a) - categoryRank(b);
      });
      var picked = [];
      var idx = 0;
      while (picked.length < 4) {
        var added = false;
        for (var i = 0; i < categories.length && picked.length < 4; i++) {
          var p = byCategory[categories[i]][idx];
          if (p) { picked.push(p); added = true; }
        }
        if (!added) break;
        idx++;
      }

      grid.innerHTML = picked.map(cardHtml).join('');

      grid.addEventListener('click', function (e) {
        var card = e.target.closest('.product-card');
        if (!card) return;
        var p = C.getById(card.getAttribute('data-id'));
        if (p) C.modal.open(p);
      });
    });

    /* CTAs "Ver toda la colección" — entran al modo colección filtrado */
    var ctas = document.querySelectorAll('[data-brand-cta]');
    Array.prototype.forEach.call(ctas, function (cta) {
      cta.addEventListener('click', function (e) {
        e.preventDefault();
        filterByBrand(cta.getAttribute('data-brand-cta'));
      });
    });
  }

  /* Activa el catálogo completo filtrado por una marca específica.
     Modo "colección": oculta los bloques featured-only de la home y
     muestra un header con título de la marca + link de regreso. */
  function filterByBrand(brand) {
    state.showAll      = true;
    state.brandList    = [brand];
    state.categoryList = [];
    state.priceList    = [];
    state.sizes        = [];
    state.inStockOnly  = false;
    state.sort         = 'destacados';
    state.query        = '';

    document.body.classList.add('mode-collection');
    var header = document.getElementById('collectionHeader');
    var title  = document.getElementById('collectionTitle');
    if (header) header.hidden = false;
    if (title)  title.textContent = brand.toUpperCase();
    setBreadcrumb(brand);

    if (dom.sort)   dom.sort.value   = 'destacados';

    renderFiltersSidebar();
    render();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* Busca por texto libre — entra al modo colección y filtra por state.query.
     Se llama desde el search bar del header. */
  function filterByQuery(q) {
    state.showAll      = true;
    state.brandList    = [];
    state.categoryList = [];
    state.priceList    = [];
    state.sizes        = [];
    state.inStockOnly  = false;
    state.sort         = 'destacados';
    state.query        = q || '';

    document.body.classList.add('mode-collection');
    var header = document.getElementById('collectionHeader');
    var title  = document.getElementById('collectionTitle');
    if (header) header.hidden = false;
    if (title)  title.textContent = 'RESULTADOS · ' + q.toUpperCase();
    setBreadcrumb('Búsqueda: ' + q);

    if (dom.sort)   dom.sort.value   = 'destacados';

    renderFiltersSidebar();
    render();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* Filtra solo por grupo de categorías, ambas marcas. Usado por el nav
     simplificado (CAMPERAS / BUZOS / PANTALONES / REMERAS / ACCESORIOS)
     y por las cards de categoría de la home. */
  function filterByCategory(categoriesStr, label) {
    state.showAll      = true;
    state.brandList    = [];
    state.categoryList = categoriesStr
      ? categoriesStr.split(',').map(function (s) { return s.trim(); })
      : [];
    state.priceList    = [];
    state.sizes        = [];
    state.inStockOnly  = false;
    state.sort         = 'destacados';
    state.query        = '';

    document.body.classList.add('mode-collection');
    var header = document.getElementById('collectionHeader');
    var title  = document.getElementById('collectionTitle');
    if (header) header.hidden = false;
    var catLabel = label || 'Colección';
    if (title)  title.textContent = catLabel.toUpperCase();
    setBreadcrumb(catLabel);

    if (dom.sort)   dom.sort.value   = 'destacados';

    renderFiltersSidebar();
    render();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* Filtra por marca + grupo de categorías (ej: "Mistral · Remeras"). */
  function filterByBrandAndCategory(brand, categoriesStr, label) {
    state.showAll      = true;
    state.brandList    = [brand];
    state.categoryList = categoriesStr
      ? categoriesStr.split(',').map(function (s) { return s.trim(); })
      : [];
    state.priceList    = [];
    state.sizes        = [];
    state.inStockOnly  = false;
    state.sort         = 'destacados';
    state.query        = '';

    document.body.classList.add('mode-collection');
    var header = document.getElementById('collectionHeader');
    var title  = document.getElementById('collectionTitle');
    if (header) header.hidden = false;
    var bcLabel = label || (brand + ' · Categoría');
    if (title)  title.textContent = bcLabel.toUpperCase();
    setBreadcrumb(bcLabel);

    if (dom.sort)   dom.sort.value   = 'destacados';

    renderFiltersSidebar();
    render();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* Salir del modo colección: restaura la home con destacados */
  function exitCollectionMode() {
    document.body.classList.remove('mode-collection');
    var header = document.getElementById('collectionHeader');
    if (header) header.hidden = true;

    /* Resetear título y breadcrumb a los defaults */
    var title = document.getElementById('collectionTitle');
    if (title) title.textContent = 'COLECCIÓN HOMBRE';
    setBreadcrumb('Colección');

    /* Resetear estado a la vista inicial */
    state.showAll      = false;
    state.brandList    = [];
    state.categoryList = [];
    state.priceList    = [];
    state.sizes        = [];
    state.inStockOnly  = false;
    state.sort         = 'destacados';
    state.query        = '';

    if (dom.sort) dom.sort.value = 'destacados';

    renderFiltersSidebar();
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

    /* Links del nav simplificado y mobile menu — filtrar por categorías */
    var categoryLinks = document.querySelectorAll('[data-categories]:not([data-brand])');
    Array.prototype.forEach.call(categoryLinks, function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var categories = link.getAttribute('data-categories');
        var label      = link.getAttribute('data-label');
        filterByCategory(categories, label);
      });
    });

    /* Links viejos data-brand (por compatibilidad si quedan en algún lado) */
    var brandLinks = document.querySelectorAll('a[data-brand]');
    Array.prototype.forEach.call(brandLinks, function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var brand      = link.getAttribute('data-brand');
        var categories = link.getAttribute('data-categories');
        var label      = link.getAttribute('data-label');
        if (categories) filterByBrandAndCategory(brand, categories, label);
        else            filterByBrand(brand);
      });
    });

    /* CTAs "Hombre" / "Ver colección" → modo colección con todos los productos */
    var ctaAllLinks = document.querySelectorAll('[data-cta-all]');
    Array.prototype.forEach.call(ctaAllLinks, function (cta) {
      cta.addEventListener('click', function (e) {
        e.preventDefault();
        filterByCategory('', 'Colección Hombre');
      });
    });

    /* "Inicio" del nav — salir del modo colección si está activo, ir al hero */
    var homeLinks = document.querySelectorAll('[data-nav-home]');
    Array.prototype.forEach.call(homeLinks, function (link) {
      link.addEventListener('click', function (e) {
        if (document.body.classList.contains('mode-collection')) {
          e.preventDefault();
          exitCollectionMode();
        }
      });
    });

    /* Set imágenes de las cards de categoría desde productos representativos */
    setCategoryCardImages();

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

    if (dom.sort) {
      dom.sort.addEventListener('change', function () {
        state.sort = dom.sort.value; render();
      });
    }

    /* Click en card -> abre la vista rápida */
    dom.grid.addEventListener('click', function (e) {
      var card = e.target.closest('.product-card');
      if (!card) return;
      var p = C.getById(card.getAttribute('data-id'));
      if (p) C.modal.open(p);
    });

    /* Drawer de filtros mobile — abre/cierra el sidebar con backdrop overlay.
       En desktop CSS oculta el botón porque el sidebar es siempre visible. */
    var filterBtn   = document.getElementById('filterToggleBtn');
    var filterClose = document.getElementById('filtersCloseBtn');
    var filterOverlay = document.getElementById('filtersOverlay');
    var sidebarEl   = document.getElementById('filtersSidebar');

    function openFiltersDrawer() {
      if (!sidebarEl) return;
      sidebarEl.classList.add('is-open');
      if (filterOverlay) {
        filterOverlay.hidden = false;
        /* Forzar reflow para que la transición de opacity se aplique */
        filterOverlay.offsetHeight;
        filterOverlay.classList.add('is-open');
      }
      document.body.classList.add('no-scroll');
      if (filterBtn) filterBtn.setAttribute('aria-expanded', 'true');
      /* Focus al primer checkbox o close button para a11y */
      setTimeout(function () { if (filterClose) filterClose.focus(); }, 50);
    }
    function closeFiltersDrawer() {
      if (!sidebarEl) return;
      sidebarEl.classList.remove('is-open');
      if (filterOverlay) {
        filterOverlay.classList.remove('is-open');
        /* Esperar fin de transición antes de hidden para mantener fade-out visible */
        setTimeout(function () { filterOverlay.hidden = true; }, 250);
      }
      document.body.classList.remove('no-scroll');
      if (filterBtn) filterBtn.setAttribute('aria-expanded', 'false');
    }

    if (filterBtn) {
      filterBtn.addEventListener('click', function () {
        if (sidebarEl && sidebarEl.classList.contains('is-open')) closeFiltersDrawer();
        else openFiltersDrawer();
      });
    }
    if (filterClose)   filterClose.addEventListener('click', closeFiltersDrawer);
    if (filterOverlay) filterOverlay.addEventListener('click', closeFiltersDrawer);

    /* ESC cierra el drawer si está abierto */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebarEl && sidebarEl.classList.contains('is-open')) {
        closeFiltersDrawer();
      }
    });

    /* Botón "Limpiar filtros" del sidebar */
    var clearBtn = document.getElementById('filtersClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearAllFilters);

    /* Event delegation para checkboxes del sidebar (renderizados dinámicamente) */
    var sidebar = document.getElementById('filtersSidebar');
    if (sidebar) sidebar.addEventListener('change', handleFacetChange);

    /* Inicializar facets (cuenta inicial sobre todo el catálogo) */
    renderFiltersSidebar();

    /* Render de los bloques de marca destacados de la home */
    renderBrandBlocks();

    render();
  }

  /* ── Sidebar de filtros (Commit E) ─────────────────────────────────
     Renderea los 5 facet groups con checkboxes + conteo dinámico.
     Cada facet calcula su count aplicando todos los filtros EXCEPTO el suyo
     (patrón estándar de ecommerce: el conteo refleja qué pasaría al activar
     ese checkbox sin tocar los otros filtros activos). */

  /* Talles reales del catálogo (excluye dummies "U"/"99" que no son talles) */
  function getRealSizes() {
    var seen = {};
    C.productos.forEach(function (p) {
      (p.talles || []).forEach(function (t) {
        if (t !== 'U' && t !== '99' && t) seen[t] = true;
      });
    });
    /* Orden lógico de talles */
    var preferred = ['XS','S','M','L','XL','XXL','XXXL','38','40','42','44','46','48','50','52','54'];
    var ordered = preferred.filter(function (s) { return seen[s]; });
    Object.keys(seen).forEach(function (s) {
      if (ordered.indexOf(s) === -1) ordered.push(s);
    });
    return ordered;
  }

  /* Categorías reales del catálogo, ordenadas por prioridad comercial */
  function getRealCategories() {
    var seen = {};
    C.productos.forEach(function (p) { if (p.category) seen[p.category] = true; });
    return Object.keys(seen).sort(function (a, b) {
      return categoryRank(a) - categoryRank(b);
    });
  }

  /* Marcas reales del catálogo */
  function getRealBrands() {
    var seen = {};
    C.productos.forEach(function (p) { if (p.brand) seen[p.brand] = true; });
    return Object.keys(seen).sort();
  }

  /* Cuenta cuántos productos pasarían si activamos cada valor del facet
     (excluyendo el propio facet del filtrado). */
  function getFacetCounts(facetName, values) {
    var counts = {};
    values.forEach(function (v) { counts[v] = 0; });
    C.productos.forEach(function (p) {
      if (!passesFilters(p, facetName)) return;
      if (facetName === 'availability') {
        if (!p.soldOut) counts['in-stock'] = (counts['in-stock'] || 0) + 1;
      } else if (facetName === 'brand') {
        if (counts.hasOwnProperty(p.brand)) counts[p.brand]++;
      } else if (facetName === 'category') {
        if (counts.hasOwnProperty(p.category)) counts[p.category]++;
      } else if (facetName === 'size') {
        (p.talles || []).forEach(function (t) {
          if (counts.hasOwnProperty(t)) counts[t]++;
        });
      } else if (facetName === 'price') {
        PRICE_BRACKETS.forEach(function (b) {
          if (b.id === 'all') return;
          if (p.price >= b.min && p.price <= b.max && counts.hasOwnProperty(b.id)) {
            counts[b.id]++;
          }
        });
      }
    });
    return counts;
  }

  /* Renderea un grupo de facets en su <ul> correspondiente */
  function renderFacetGroup(facetName, listId, items, activeList) {
    var ul = document.getElementById(listId);
    if (!ul) return;
    var values = items.map(function (it) { return it.value; });
    var counts = getFacetCounts(facetName, values);

    ul.innerHTML = items.map(function (it) {
      var c = counts[it.value] || 0;
      var checked = activeList.indexOf(it.value) !== -1;
      var emptyClass = (c === 0 && !checked) ? ' is-empty' : '';
      return '' +
        '<li class="filter-group__item' + emptyClass + '">' +
          '<label>' +
            '<input type="checkbox" data-facet="' + facetName + '" ' +
              'value="' + C.escapeHtml(it.value) + '"' +
              (checked ? ' checked' : '') + '>' +
            '<span class="filter-group__label-text">' + C.escapeHtml(it.label) + '</span>' +
            '<span class="filter-group__count">(' + c + ')</span>' +
          '</label>' +
        '</li>';
    }).join('');
  }

  function renderFiltersSidebar() {
    /* Disponibilidad — checkbox único */
    renderFacetGroup('availability', 'facetAvailability',
      [{ value: 'in-stock', label: 'Con stock' }],
      state.inStockOnly ? ['in-stock'] : []);

    /* Marca */
    renderFacetGroup('brand', 'facetBrand',
      getRealBrands().map(function (b) { return { value: b, label: b }; }),
      state.brandList);

    /* Categoría */
    renderFacetGroup('category', 'facetCategory',
      getRealCategories().map(function (c) { return { value: c, label: c }; }),
      state.categoryList);

    /* Talle */
    renderFacetGroup('size', 'facetSize',
      getRealSizes().map(function (s) { return { value: s, label: s }; }),
      state.sizes);

    /* Precio — usa labels de PRICE_BRACKETS sin el "all" */
    renderFacetGroup('price', 'facetPrice',
      PRICE_BRACKETS.filter(function (b) { return b.id !== 'all'; })
        .map(function (b) { return { value: b.id, label: b.label }; }),
      state.priceList);
  }

  /* Aplica cambio de checkbox al state correspondiente y re-renderea */
  function handleFacetChange(e) {
    var input = e.target;
    if (input.tagName !== 'INPUT' || input.type !== 'checkbox') return;
    var facet = input.getAttribute('data-facet');
    var value = input.value;
    var checked = input.checked;

    if (facet === 'availability') {
      state.inStockOnly = checked;
    } else {
      var listName = ({
        brand: 'brandList',
        category: 'categoryList',
        size: 'sizes',
        price: 'priceList'
      })[facet];
      if (!listName) return;
      var list = state[listName];
      var idx = list.indexOf(value);
      if (checked && idx === -1) list.push(value);
      if (!checked && idx !== -1) list.splice(idx, 1);
    }

    state.showAll = true;
    renderFiltersSidebar();
    render();
  }

  /* Resetea todos los filtros del sidebar (mantiene query y sort) */
  function clearAllFilters() {
    state.brandList    = [];
    state.categoryList = [];
    state.priceList    = [];
    state.sizes        = [];
    state.inStockOnly  = false;
    renderFiltersSidebar();
    render();
  }

  C.catalog = {
    init: init,
    render: render,
    filterByBrand: filterByBrand,
    filterByBrandAndCategory: filterByBrandAndCategory,
    filterByQuery: filterByQuery
  };

})(window.Clousa);
