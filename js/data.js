/* ===================================================================
   CLOUSA PREMIUM v2.0 — data.js
   Carga y normalización del catálogo Mistral (data/productos.json).
   Única fuente de verdad. Solo expone precio_venta — nunca precio_fabrica.
   =================================================================== */

window.Clousa = window.Clousa || {};

(function (C) {
  'use strict';

  var WHATSAPP = '5491166025737';

  C.WHATSAPP = WHATSAPP;
  C.productos = [];
  C.categorias = [];

  /* Limpia los saltos de línea que trae el campo `nombre` del scraper */
  function cleanName(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  /* Escapa texto antes de inyectarlo como HTML */
  C.escapeHtml = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* Precio formateado en pesos argentinos */
  C.formatPrice = function (n) {
    return '$' + Number(n || 0).toLocaleString('es-AR');
  };

  /* Talles por defecto según la familia de la categoría
     (el JSON Mistral no incluye talles) */
  C.tallesFor = function (categoria) {
    var c = String(categoria || '').toUpperCase();
    if (/JEAN|PANTAL|JOGGING/.test(c)) return ['38', '40', '42', '44', '46', '48'];
    if (/CINTUR/.test(c))              return ['90', '95', '100', '105', '110'];
    if (/BOXER/.test(c))               return ['S', 'M', 'L', 'XL'];
    if (/GORRA|GORRO|BUFANDA|PERFUM/.test(c)) return ['Único'];
    return ['S', 'M', 'L', 'XL', 'XXL'];
  };

  function normalizeSize(t) {
    return String(t).replace(/^0+/, '') || String(t);
  }

  /* Mistral JSON -> modelo interno del sitio.
     Se descartan deliberadamente: precio_fabrica, precio_texto, link_detalle. */
  function normalize(p) {
    var rawTalles = Array.isArray(p.talles) && p.talles.length ? p.talles : null;
    var desc = p.descripcion && p.descripcion !== '0' ? String(p.descripcion).trim() : '';
    return {
      id:          String(p.codigo || ''),
      name:        cleanName(p.nombre),
      brand:       p.marca || 'Mistral',
      category:    p.categoria || '',
      price:       Number(p.precio_venta) || 0,
      img:         (Array.isArray(p.imagenes) && p.imagenes[0]) || p.imagen || '',
      imagenes:    Array.isArray(p.imagenes) ? p.imagenes : (p.imagen ? [p.imagen] : []),
      soldOut:     !!p.agotado,
      talles:      rawTalles ? rawTalles.map(normalizeSize) : C.tallesFor(p.categoria),
      description: desc,
      colores:     Array.isArray(p.colores) ? p.colores : []
    };
  }

  /* Carga el catálogo. Acepta el formato {metadata, categorias, productos}
     o un array plano de productos. */
  C.loadProducts = function () {
    var mistralFetch = fetch('data/productos.json')
      .then(function (res) {
        if (!res.ok) throw new Error('No se pudo cargar el catálogo Mistral (' + res.status + ')');
        return res.json();
      });

    var brooksfieldFetch = fetch('data/productos-brooksfield.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .catch(function (err) {
        console.warn('[Clousa] productos-brooksfield.json no disponible:', err.message);
        return { productos: [], categorias: [] };
      });

    return Promise.all([mistralFetch, brooksfieldFetch])
      .then(function (results) {
        var mistralData     = results[0];
        var brooksfieldData = results[1];

        var rawCombined = (mistralData.productos || []).concat(brooksfieldData.productos || []);
        C.productos = rawCombined.map(normalize).filter(function (p) {
          return p.id && p.name && p.price > 0;
        });

        var allCats = (mistralData.categorias || []).concat(brooksfieldData.categorias || []);
        var withProducts = {};
        C.productos.forEach(function (p) { withProducts[p.category] = true; });
        C.categorias = allCats
          .filter(function (c, i, a) { return a.indexOf(c) === i; })
          .filter(function (c) { return withProducts[c]; })
          .sort();

        return C.productos;
      });
  };

  C.getById = function (id) {
    return C.productos.filter(function (p) { return p.id === String(id); })[0] || null;
  };

})(window.Clousa);
