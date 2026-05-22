/* ===================================================================
   CLOUSA PREMIUM v2.0 — data.js
   Carga y normalización del catálogo Mistral (data/productos.json).
   Única fuente de verdad. Solo expone precio_venta — nunca precio_fabrica.
   =================================================================== */

window.Clousa = window.Clousa || {};

(function (C) {
  'use strict';

  var DATA_URL = 'data/productos.json';
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

  /* Mistral JSON -> modelo interno del sitio.
     Se descartan deliberadamente: precio_fabrica, precio_texto, link_detalle. */
  function normalize(p) {
    return {
      id:       String(p.codigo || ''),
      name:     cleanName(p.nombre),
      brand:    p.marca || 'Mistral',
      category: p.categoria || '',
      price:    Number(p.precio_venta) || 0,
      img:      p.imagen || '',
      soldOut:  !!p.agotado,
      talles:   C.tallesFor(p.categoria)
    };
  }

  /* Carga el catálogo. Acepta el formato {metadata, categorias, productos}
     o un array plano de productos. */
  C.loadProducts = function () {
    return fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('No se pudo cargar el catálogo (' + res.status + ')');
        return res.json();
      })
      .then(function (json) {
        var raw = Array.isArray(json) ? json : (json.productos || []);
        /* Se descartan productos sin id, sin nombre o sin precio válido
           (el JSON de origen trae algunos con precio_venta = null). */
        C.productos = raw.map(normalize).filter(function (p) {
          return p.id && p.name && p.price > 0;
        });

        var cats = (json && Array.isArray(json.categorias) && json.categorias.length)
          ? json.categorias.slice()
          : C.productos.map(function (p) { return p.category; });

        /* Solo categorías que efectivamente tienen productos */
        var withProducts = {};
        C.productos.forEach(function (p) { withProducts[p.category] = true; });
        C.categorias = cats.filter(function (c) { return withProducts[c]; })
          .filter(function (c, i, a) { return a.indexOf(c) === i; })
          .sort();

        return C.productos;
      });
  };

  C.getById = function (id) {
    return C.productos.filter(function (p) { return p.id === String(id); })[0] || null;
  };

})(window.Clousa);
