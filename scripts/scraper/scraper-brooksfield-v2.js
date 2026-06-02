/**
 * Scraper Brooksfield B2B — V2 (Opción 1 full)
 * ============================================
 *
 * Diferencias vs v1:
 *  - Entra a la página de detalle de cada producto.
 *  - Extrae: descripción real, todas las imágenes, colores visibles con hex, talles, tipo_talles.
 *  - Llama al endpoint AJAX (/api/ajax/producto.ajax.php) para obtener la matriz exacta color→talle.
 *  - Filtra por DISPONIBLES > 0 (criterio verificado vs modal del sitio).
 *  - Genera JSON con estructura: {colores: [{codigo, nombre, hex, talles_disponibles: [...]}, ...]}
 *
 * Modos de ejecución:
 *  node scraper-brooksfield-v2.js                   → corrida completa (todas las categorías).
 *  node scraper-brooksfield-v2.js --debug           → headless:false + screenshots.
 *  node scraper-brooksfield-v2.js --codigo=5521B    → procesa UN solo producto y loguea el JSON resultante.
 *                                                     Útil para validar el pipeline antes del run completo.
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ============================================================================
//  CONFIGURACIÓN
// ============================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parseo del flag --codigo=XXXX (modo single product)
const codigoArg = process.argv.find(a => a.startsWith('--codigo='));
const CODIGO_DEBUG = codigoArg ? codigoArg.split('=')[1] : null;

const CONFIG = {
  baseUrl: 'https://brooksfieldb2b.com.ar',
  loginUrl: 'https://brooksfieldb2b.com.ar/login.php',
  ajaxEndpoint: '/api/ajax/producto.ajax.php',
  markup: 2.40,
  curvaPrincipal: 'CE1',  // CE1 aparece en todos los productos (C54/CE1/M54, C84/CE1/M84, etc.) y tiene DISPONIBLES idénticos a las otras curvas.

  // Credenciales SIEMPRE desde el entorno — nunca hardcodeadas.
  credentials: {
    usuario: process.env.BROOKSFIELD_USER,
    password: process.env.BROOKSFIELD_PASSWORD
  },

  debug: process.argv.includes('--debug'),
  headless: !process.argv.includes('--debug'),
  codigoDebug: CODIGO_DEBUG,

  // Output: solo se escribe en modo full. En modo --codigo=X se loguea en consola.
  outputFile: path.resolve(__dirname, '../../data/productos-brooksfield.json'),
  screenshotsDir: path.join(__dirname, 'screenshots'),

  // Timeouts y delays
  timeoutNavegacion: 30000,
  timeoutCorto: 2000,
  delayEntreProductos: 300,  // ms entre productos para no martillar el server
};

if (!CONFIG.credentials.usuario || !CONFIG.credentials.password) {
  console.error('✗ Faltan credenciales. Definí BROOKSFIELD_USER y BROOKSFIELD_PASSWORD como variables de entorno.');
  process.exit(1);
}

const CATEGORIAS = [
  'BERMUDAS', 'BILLETERAS', 'BOLSOS', 'BOXERS', 'BUFANDAS',
  'BUZOS FRISADOS', 'BUZOS RUSTICOS', 'CAMISAS ML', 'CAMPERAS FRISADAS',
  'CANGUROS FRISADOS', 'CANGUROS RUSTICOS', 'CHALECOS', 'CINTURONES',
  'GORRAS', 'GORROS', 'JACKETS', 'JEANS', 'MEDIAS', 'PANTALONES',
  'PANTALONES CORDEROY', 'PERFUMERIA', 'POLOS MC', 'REMERAS MC',
  'REMERAS ML', 'SWEATERS'
];

// ============================================================================
//  HELPERS
// ============================================================================

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '✓',
    warn: '⚠',
    error: '✗',
    debug: '→'
  }[type] || '•';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function saveScreenshot(page, name) {
  if (!CONFIG.debug) return;
  await fs.mkdir(CONFIG.screenshotsDir, { recursive: true });
  const filename = path.join(CONFIG.screenshotsDir, `${name}_${Date.now()}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  log(`Screenshot guardado: ${filename}`, 'debug');
}

// Parsea precios en formato US del B2B: "$ 33,000.00" → 33000
function parsePrice(precioText) {
  if (!precioText) return null;
  const cleaned = precioText
    .replace('$', '')
    .replace(/\s/g, '')
    .replace(/,/g, '')
    .split('.')[0];
  return parseInt(cleaned) || null;
}

// Espera fija (compatible con Playwright >=1.30 sin warnings)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
//  LOGIN (idéntico al v1 — ya está probado, no se toca)
// ============================================================================

async function login(page) {
  log('Navegando a página de login...');
  await page.goto(CONFIG.loginUrl, { waitUntil: 'networkidle', timeout: CONFIG.timeoutNavegacion });
  await saveScreenshot(page, '01_login_page');

  log('Buscando formulario de login...');

  const usernameSelectors = [
    'input[name="ingresoCUIT"]',
    '#ingresoCUIT',
    'input[name="usuario"]',
    'input[name="username"]',
    'input[name="user"]',
    'input[name="cuit"]',
    'input[type="text"]',
    'input#usuario',
    'input#username'
  ];

  const passwordSelectors = [
    'input[name="ingresoPass"]',
    '#ingresoPass',
    'input[name="password"]',
    'input[name="pass"]',
    'input[name="clave"]',
    'input[type="password"]',
    'input#password'
  ];

  const submitSelectors = [
    'button#btnlogin',
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Ingresar")',
    'button:has-text("Entrar")',
    'button:has-text("Login")',
    'input[value*="Ingres"]',
    'input[value*="Entra"]'
  ];

  // Campo usuario
  let usernameInput = null;
  for (const selector of usernameSelectors) {
    try {
      usernameInput = await page.waitForSelector(selector, { timeout: CONFIG.timeoutCorto });
      if (usernameInput) {
        log(`Campo usuario encontrado: ${selector}`, 'debug');
        break;
      }
    } catch (e) { continue; }
  }
  if (!usernameInput) throw new Error('No se pudo encontrar el campo de usuario.');

  // Campo password
  let passwordInput = null;
  for (const selector of passwordSelectors) {
    try {
      passwordInput = await page.waitForSelector(selector, { timeout: CONFIG.timeoutCorto });
      if (passwordInput) {
        log(`Campo password encontrado: ${selector}`, 'debug');
        break;
      }
    } catch (e) { continue; }
  }
  if (!passwordInput) throw new Error('No se pudo encontrar el campo de contraseña.');

  log('Completando credenciales...');
  await usernameInput.fill(CONFIG.credentials.usuario);
  await passwordInput.fill(CONFIG.credentials.password);
  await saveScreenshot(page, '02_form_filled');

  // Botón submit
  let submitButton = null;
  for (const selector of submitSelectors) {
    try {
      submitButton = await page.waitForSelector(selector, { timeout: CONFIG.timeoutCorto });
      if (submitButton) {
        log(`Botón submit encontrado: ${selector}`, 'debug');
        break;
      }
    } catch (e) { continue; }
  }
  if (!submitButton) throw new Error('No se pudo encontrar el botón de login.');

  log('Haciendo login...');
  await Promise.all([
    submitButton.click(),
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: CONFIG.timeoutNavegacion }).catch(() => {})
  ]);
  await sleep(3000);
  await saveScreenshot(page, '03_after_login');

  // Verificación dual: DOM + texto
  const isLoggedInByDom = await page.evaluate(() => {
    const sels = [
      'a[href*="logout"]',
      'a[href*="cerrar"]',
      'a[href*="cuenta"]',
      'a[href*="carrito"]',
      '[class*="dropdown-toggle"]'
    ];
    return sels.some(s => document.querySelector(s) !== null);
  });

  let isLoggedInByText = false;
  if (!isLoggedInByDom) {
    const textSelectors = [
      'a:has-text("COLECCIÓN")',
      'a:has-text("STOCK")',
      'a:has-text("Cerrar")',
      'a:has-text("Salir")'
    ];
    for (const sel of textSelectors) {
      try {
        const count = await page.locator(sel).count();
        if (count > 0) {
          isLoggedInByText = true;
          log(`Login confirmado por texto: ${sel}`, 'debug');
          break;
        }
      } catch (e) { continue; }
    }
  }

  if (!isLoggedInByDom && !isLoggedInByText) {
    await saveScreenshot(page, 'login_failed');
    log(`URL actual: ${page.url()}`, 'debug');
    throw new Error('Login falló: no se detectaron elementos de la sesión activa.');
  }

  log('Login OK');
}

// ============================================================================
//  LISTING POR CATEGORÍA
// ============================================================================

/**
 * Navega a una categoría del catálogo y devuelve solo los códigos de producto.
 *
 * A diferencia del v1, NO extrae nombre/precio/imagen del listing.
 * Esos datos vienen del detalle de cada producto (más confiables y completos).
 *
 * Mantiene los mismos parámetros de URL del v1:
 *   - sx=MASCULINO        → sexo
 *   - na=true             → flag del sitio (no documentado, pero v1 lo usa y funciona)
 *   - colId=I26           → colección Invierno 2026
 *
 * @param {import('playwright').Page} page
 * @param {string} categoria  Nombre de la categoría tal como aparece en el sitio (ej: "PANTALONES")
 * @returns {Promise<string[]>}  Array de códigos de producto (ej: ["5521B", "8022B", ...])
 */
async function obtenerCodigosCategoria(page, categoria) {
  const url = `${CONFIG.baseUrl}/catalogo.php`
    + `?itemCatalogo=${encodeURIComponent(categoria)}`
    + `&sx=MASCULINO`
    + `&na=true`
    + `&colId=I26`;

  await page.goto(url, { waitUntil: 'networkidle', timeout: CONFIG.timeoutNavegacion });
  await sleep(1500);

  const codigos = await page.evaluate(() => {
    const items = [];
    const productElements = document.querySelectorAll('div.box-producto');
    productElements.forEach(el => {
      const codigo = el.getAttribute('data-prod');
      if (codigo) items.push(codigo);
    });
    return items;
  });

  return codigos;
}

// ============================================================================
//  EXTRACCIÓN DEL DETALLE DE PRODUCTO
// ============================================================================

/**
 * Navega a producto.php?coditm=X&item=Y y extrae:
 *   - nombre, descripcion, precioBase
 *   - imagenes (URLs absolutas, todas las del slider)
 *   - variantesVisibles (códigos de colores seleccionables: ["012", "013", ...])
 *   - talles (array del objeto JS var producto: ["28", ..., "52"])
 *   - tipoTalles ('numeros' | 'letras')
 *   - coloresVariantes (diccionario maestro {codvar: {detalle, html, ...}} del var producto)
 *   - codTabTal (ej. "MNU" — útil para debug)
 *
 * Las variantes visibles vienen del DOM (botones que el usuario ve).
 * El diccionario de colores con hex viene del JS de la página (var producto.coloresVariantes).
 * Ambas se cruzan después para resolver nombre+hex de cada variante visible.
 *
 * @param {import('playwright').Page} page
 * @param {string} codigo     Código del producto (ej. "5521B")
 * @param {string} categoria  Categoría tal como va en el sitio (ej. "PANTALONES")
 * @returns {Promise<object>}
 */
async function extraerDetalleProducto(page, codigo, categoria) {
  const url = `${CONFIG.baseUrl}/producto.php`
    + `?coditm=${encodeURIComponent(codigo)}`
    + `&item=${encodeURIComponent(categoria)}`;

  await page.goto(url, { waitUntil: 'load', timeout: CONFIG.timeoutNavegacion });
  await sleep(800);  // Espera a que `var producto` se inicialice en el scope global.

  const detalle = await page.evaluate(({ debug, codigo }) => {
    // ─────────────────────────────────────────────────────────────────────
    // 1. Leer el objeto JS global `var producto` (declarado con var → window.producto)
    // ─────────────────────────────────────────────────────────────────────
    const prod = window.producto || {};

    // ─────────────────────────────────────────────────────────────────────
    // 2. Nombre del producto (varios selectores fallback)
    // ─────────────────────────────────────────────────────────────────────
    let nombre = null;
    const nombreSelectores = [
      '.box-info-producto h6',
      '.box-info-producto h5',
      '.box-info-producto h4',
      '.box-info-producto h3',
      '.box-info-producto h2',
      '.box-info-producto h1',
      '.box-info-producto p:first-child'
    ];
    for (const sel of nombreSelectores) {
      const el = document.querySelector(sel);
      const txt = el ? el.textContent.trim() : '';
      if (txt && txt !== codigo && !txt.startsWith('$')) {
        nombre = txt.replace(/\s+/g, ' ');
        break;
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3. Descripción (.talles-info p — primer párrafo del bloque)
    // ─────────────────────────────────────────────────────────────────────
    let descripcion = null;
    const descEl = document.querySelector('.talles-info p');
    if (descEl) {
      descripcion = descEl.textContent.trim().replace(/\s+/g, ' ');
    }

    // ─────────────────────────────────────────────────────────────────────
    // 4. Imágenes (#box-images-pred img — todas, convertidas a absolutas)
    // ─────────────────────────────────────────────────────────────────────
    const imagenes = [];
    const imgEls = document.querySelectorAll('#box-images-pred img');
    imgEls.forEach(img => {
      // Algunos sitios usan data-src para lazy loading; probamos ambos.
      const src = img.getAttribute('src') || img.getAttribute('data-src');
      if (src && !src.startsWith('data:')) {
        try {
          const abs = new URL(src, window.location.origin).href;
          if (!imagenes.includes(abs)) imagenes.push(abs);
        } catch (e) { /* URL inválida, ignorar */ }
      }
    });

    // ─────────────────────────────────────────────────────────────────────
    // 5. Variantes visibles (botones div.btn.variante con data-var)
    //    Estos son los colores que el usuario PUEDE ELEGIR en la UI.
    //    El JSON del endpoint AJAX puede tener más colores (internos), los filtramos.
    // ─────────────────────────────────────────────────────────────────────
    const variantesVisibles = [];
    document.querySelectorAll('div.btn.variante').forEach(el => {
      const codVar = el.getAttribute('data-var');
      if (codVar && !variantesVisibles.includes(codVar)) {
        variantesVisibles.push(codVar);
      }
    });

    // ─────────────────────────────────────────────────────────────────────
    // 6. Precio base mayorista
    //    Preferimos #precio_input (formato sin decoración: "44000,0000")
    //    Fallback: <p id="precio"> (formato display: "$ 44,000.00")
    // ─────────────────────────────────────────────────────────────────────
    let precioBase = null;
    const precioInput = document.querySelector('#precio_input');
    if (precioInput) {
      const v = (precioInput.value || '').toString();
      // "44000,0000" → "44000" → 44000
      const limpio = v.split(',')[0].replace(/[^\d]/g, '');
      precioBase = parseInt(limpio) || null;
    }
    if (!precioBase) {
      const precioP = document.querySelector('#precio');
      if (precioP) {
        // "$ 44,000.00" → "4400000" → 44000 (descartando los 2 últimos dígitos = decimales)
        const txt = precioP.textContent || '';
        const limpio = txt.replace('$', '').replace(/\s/g, '').replace(/,/g, '').split('.')[0];
        precioBase = parseInt(limpio) || null;
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 7. Datos del objeto JS `var producto`
    // ─────────────────────────────────────────────────────────────────────
    const result = {
      nombre,
      descripcion,
      imagenes,
      variantesVisibles,
      precioBase,
      talles: Array.isArray(prod.talles) ? prod.talles : [],
      tipoTalles: prod.tipoTalles || null,
      coloresVariantes: prod.coloresVariantes || {},
      codTabTal: prod.codtabtal || null
    };

    if (debug) {
      console.log('[debug] imagesVariantes:', JSON.stringify(window.producto.imagesVariantes, null, 2));
      console.log('[debug] coloresVariantes:', JSON.stringify(window.producto.coloresVariantes, null, 2));
      console.log('[debug] variantes:', JSON.stringify(window.producto.variantes, null, 2));
    }

    return result;
  }, { debug: CONFIG.debug, codigo });

  return detalle;
}

// ============================================================================
//  CONSULTA AL ENDPOINT AJAX DE STOCK
// ============================================================================

/**
 * Hace POST a /api/ajax/producto.ajax.php con consultaCurvaCompleta={codigo}.
 *
 * El fetch corre DENTRO del browser de Playwright (vía page.evaluate), así que
 * hereda las cookies de sesión del login automáticamente. No hace falta pasarlas
 * a mano. Devuelve la matriz completa de stock como array de objetos.
 *
 * Estructura típica de cada registro:
 *   {
 *     CODITM: "5521B", CODTAL: "028", CODCOL: "012",
 *     DISPONIBLES: 3, CODCURVA: "C54", HabilitadoWeb: true,
 *     CANTIDAD: 0, COEFICIENTE: null, ACTIVO: true, ...
 *   }
 *
 * Hay 3 valores de CODCURVA (C54/CE1/M54) con DISPONIBLES idénticos. Solo nos
 * interesa C54 (curva principal). El filtrado se hace en procesarMatrizStock().
 *
 * @param {import('playwright').Page} page
 * @param {string} codigo
 * @returns {Promise<Array|null>}  Array de registros, o null si la consulta falló.
 */
async function consultarStockAjax(page, codigo) {
  try {
    const result = await page.evaluate(async ({ endpoint, cod }) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: `consultaCurvaCompleta=${encodeURIComponent(cod)}`,
        credentials: 'same-origin'
      });

      if (!response.ok) {
        return { error: `HTTP ${response.status}`, data: null };
      }

      const text = await response.text();
      try {
        return { error: null, data: JSON.parse(text) };
      } catch (e) {
        return { error: `JSON parse failed: ${e.message}`, data: null, preview: text.slice(0, 200) };
      }
    }, { endpoint: CONFIG.ajaxEndpoint, cod: codigo });

    if (result.error) {
      log(`AJAX ${codigo}: ${result.error}${result.preview ? ' | preview: ' + result.preview : ''}`, 'warn');
      return null;
    }

    if (!Array.isArray(result.data)) {
      log(`AJAX ${codigo}: respuesta no es array (recibido ${typeof result.data})`, 'warn');
      return null;
    }

    return result.data;
  } catch (e) {
    log(`AJAX ${codigo}: excepción ${e.message}`, 'error');
    return null;
  }
}

// ============================================================================
//  PROCESAMIENTO DE LA MATRIZ DE STOCK
// ============================================================================

/**
 * Normaliza el CODTAL del endpoint para alinearlo con var producto.talles.
 *   - "028" → "28"   (numérico con padding)
 *   - "00S" → "S"    (letra con padding doble)
 *   - "0XL" → "XL"   (compuesto con padding)
 *   - "3XL" → "3XL"  (sin padding, no tocar)
 *   - "XXL" → "XXL"  (sin padding, no tocar)
 * Regla única: stripear ceros a la izquierda de cualquier string.
 */
function normalizarTalle(codTal) {
  if (!codTal) return codTal;
  return codTal.replace(/^0+/, '') || codTal;
}

/**
 * Busca un color en el diccionario `coloresVariantes` del var producto.
 * Tolera dos posibles formas del diccionario:
 *   - Objeto indexado: { "012": {detalle: "MARINO", html: "#1b1464", ...}, ... }
 *   - Array de objetos: [{codvar: "012", detalle: "MARINO", html: "#1b1464"}, ...]
 *
 * @returns {{nombre: string|null, hex: string|null}}
 */
function buscarInfoColor(codVar, coloresVariantes) {
  if (!coloresVariantes) return { nombre: null, hex: null };

  let entry = null;

  if (Array.isArray(coloresVariantes)) {
    entry = coloresVariantes.find(c => String(c.codvar) === String(codVar));
  } else if (typeof coloresVariantes === 'object') {
    entry = coloresVariantes[codVar] || coloresVariantes[String(codVar)];
    // Si tampoco está indexado, buscamos por valor
    if (!entry) {
      entry = Object.values(coloresVariantes)
        .find(c => c && String(c.codvar) === String(codVar));
    }
  }

  if (!entry) return { nombre: null, hex: null };

  return {
    nombre: (entry.detalle || entry.nombre || '').trim() || null,
    hex: entry.html || entry.hex || null
  };
}

/**
 * Cruza la matriz de stock con las variantes visibles para producir el array
 * final de colores del producto.
 *
 * Reglas:
 *   - Solo se procesan colores que están en `variantesVisibles` (lo que el
 *     usuario ve en la UI). Los colores extra del JSON (internos) se descartan.
 *   - Para cada color, se filtran registros por CODCURVA === curva.
 *   - Un talle es disponible si DISPONIBLES > 0 (criterio verificado vs modal).
 *   - El nombre y hex de cada color vienen de coloresVariantes (var producto).
 *
 * @param {Array} stockData             Array del endpoint AJAX (o null si falló).
 * @param {string[]} variantesVisibles  Códigos de variante visibles en la UI.
 * @param {object|Array} coloresVariantes  Diccionario de var producto.
 * @param {string} curva                Valor de CODCURVA a filtrar (ej: "MLE", "C54").
 * @returns {Array<{codigo, nombre, hex, talles_disponibles}>}
 */
function procesarMatrizStock(stockData, variantesVisibles, coloresVariantes, curva) {
  if (!Array.isArray(stockData) || stockData.length === 0) {
    // Sin matriz disponible: devolvemos los colores visibles con talles vacíos.
    // El producto va a quedar marcado como agotado (todos los talles_disponibles vacíos).
    return variantesVisibles.map(codVar => {
      const { nombre, hex } = buscarInfoColor(codVar, coloresVariantes);
      return {
        codigo: codVar,
        nombre: nombre || codVar,
        hex: hex || null,
        talles_disponibles: []
      };
    });
  }

  return variantesVisibles.map(codVar => {
    const tallesDisp = stockData
      .filter(r =>
        String(r.CODCOL) === String(codVar)
        && r.CODCURVA === curva
        && Number(r.DISPONIBLES) > 0
      )
      .map(r => normalizarTalle(r.CODTAL));

    // Deduplicar manteniendo el orden de aparición.
    const tallesUnicos = [...new Set(tallesDisp)];

    const { nombre, hex } = buscarInfoColor(codVar, coloresVariantes);

    return {
      codigo: codVar,
      nombre: nombre || codVar,
      hex: hex || null,
      talles_disponibles: tallesUnicos
    };
  });
}

// ============================================================================
//  CONSTRUCCIÓN DEL OBJETO PRODUCTO FINAL
// ============================================================================

/**
 * Arma el objeto producto con la estructura final que va al JSON publicado.
 *
 * Reglas de negocio:
 *   - precio_venta = precioBase * CONFIG.markup (2.10), redondeado.
 *   - agotado = true si NINGÚN color tiene talles disponibles.
 *   - Si detalle.imagenes está vacío, usa el patrón conocido como fallback
 *     (la imagen 001.png suele estar siempre publicada).
 *
 * @param {object} args
 * @param {string} args.codigo
 * @param {string} args.categoria
 * @param {object} args.detalle    Lo que devuelve extraerDetalleProducto.
 * @param {Array}  args.colores    Lo que devuelve procesarMatrizStock.
 * @returns {object}
 */
function construirProductoFinal({ codigo, categoria, detalle, colores }) {
  // Precio
  const precio_venta = detalle.precioBase
    ? Math.round(detalle.precioBase * CONFIG.markup)
    : null;

  // Agotado: ningún color con stock en ningún talle
  const hayStock = colores.some(c => c.talles_disponibles.length > 0);
  const agotado = !hayStock;

  // Fallback imagen: si el slider venía vacío, intentamos la URL canónica.
  let imagenes = detalle.imagenes;
  if (!imagenes || imagenes.length === 0) {
    imagenes = [`${CONFIG.baseUrl}/images/productos/${codigo}/${codigo}-001.png`];
  }

  return {
    codigo,
    nombre: detalle.nombre || codigo,
    descripcion: detalle.descripcion,
    categoria,
    marca: 'Brooksfield',
    precio_venta,
    agotado,
    tipo_talles: detalle.tipoTalles,
    talles: detalle.talles,
    imagenes,
    colores
  };
}

// ============================================================================
//  ORQUESTACIÓN POR PRODUCTO
// ============================================================================

/**
 * Procesa un solo producto end-to-end:
 *   1. Navega al detalle y extrae nombre/precio/imágenes/variantes/diccionarios.
 *   2. Valida que el producto tenga lo mínimo para publicar (nombre/precio/variantes).
 *   3. Consulta el endpoint AJAX para la matriz de stock.
 *   4. Cruza variantes visibles con la matriz → array de colores con talles disponibles.
 *   5. Arma el objeto producto final.
 *
 * Cualquier error o validación fallida loguea y devuelve null (el producto se saltea).
 *
 * @param {import('playwright').Page} page
 * @param {string} codigo
 * @param {string} categoria
 * @returns {Promise<object|null>}
 */
async function procesarProducto(page, codigo, categoria) {
  try {
    // 1. Detalle del producto (DOM + var producto)
    const detalle = await extraerDetalleProducto(page, codigo, categoria);

    // 2. Validaciones mínimas
    if (!detalle.nombre) {
      log(`${codigo} (${categoria}): sin nombre en detalle, se usará el código como nombre`, 'warn');
    }
    if (!detalle.precioBase) {
      log(`Skip ${codigo} (${categoria}): sin precio extraíble`, 'warn');
      return null;
    }
    if (!detalle.variantesVisibles || detalle.variantesVisibles.length === 0) {
      log(`Skip ${codigo} (${categoria}): sin variantes visibles en la UI`, 'warn');
      return null;
    }

    // 3. Matriz de stock (AJAX)
    const stockData = await consultarStockAjax(page, codigo);
    // Si stockData es null, procesarMatrizStock devuelve colores con talles vacíos
    // y el producto va a quedar marcado como agotado. No abortamos.

    // 4. Cruce variantes visibles ↔ matriz
    const colores = procesarMatrizStock(
      stockData,
      detalle.variantesVisibles,
      detalle.coloresVariantes,
      CONFIG.curvaPrincipal
    );

    // 5. Objeto final
    return construirProductoFinal({ codigo, categoria, detalle, colores });

  } catch (e) {
    log(`Error procesando ${codigo} (${categoria}): ${e.message}`, 'error');
    if (CONFIG.debug) console.error(e.stack);
    return null;
  }
}

// ============================================================================
//  MAIN
// ============================================================================

async function main() {
  log('=== Scraper Brooksfield V2 ===');

  // ─── Parseo de flags de single-product ────────────────────────────────────
  // CONFIG.codigoDebug ya fue parseado en el Bloque 1 desde --codigo=
  // Acá agregamos --categoria= y validamos la combinación.
  const modoSingle = !!CONFIG.codigoDebug;
  const modoListing = process.argv.includes('--listing-only');
  let codigoSingle = null;
  let categoriaSingle = null;

  // Helper: parsea y valida --categoria= (usado por single y listing)
  function parseCategoriaArg() {
    const categoriaArg = process.argv.find(a => a.startsWith('--categoria='));
    if (!categoriaArg) return null;
    return categoriaArg.split('=')[1].replace(/_/g, ' ').toUpperCase();
  }

  if (modoSingle) {
    codigoSingle = CONFIG.codigoDebug;
    categoriaSingle = parseCategoriaArg();

    if (!categoriaSingle) {
      console.error('✗ Modo single product requiere también --categoria=NOMBRE');
      console.error('  Ejemplo: node scraper-brooksfield-v2.js --codigo=5521B --categoria=PANTALONES');
      console.error('');
      console.error('  Categorías válidas (usar _ en vez de espacios):');
      CATEGORIAS.forEach(c => console.error(`    --categoria=${c.replace(/ /g, '_')}`));
      process.exit(1);
    }

    if (!CATEGORIAS.includes(categoriaSingle)) {
      console.error(`✗ Categoría "${categoriaSingle}" no está en la lista válida.`);
      console.error(`  Categorías: ${CATEGORIAS.join(', ')}`);
      process.exit(1);
    }

    log(`Modo SINGLE PRODUCT: ${codigoSingle} en ${categoriaSingle}`);
  } else if (modoListing) {
    categoriaSingle = parseCategoriaArg();

    if (!categoriaSingle) {
      console.error('✗ --listing-only requiere --categoria=NOMBRE');
      console.error('  Ejemplo: node scraper-brooksfield-v2.js --listing-only --categoria=REMERAS_MC');
      process.exit(1);
    }

    if (!CATEGORIAS.includes(categoriaSingle)) {
      console.error(`✗ Categoría "${categoriaSingle}" no está en la lista válida.`);
      console.error(`  Categorías: ${CATEGORIAS.join(', ')}`);
      process.exit(1);
    }

    log(`Modo LISTING ONLY: ${categoriaSingle}`);
  } else {
    log(`Modo FULL: ${CATEGORIAS.length} categorías a procesar`);
  }

  // ─── Browser + context ─────────────────────────────────────────────────────
  const browser = await chromium.launch({
    headless: CONFIG.headless,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    ignoreHTTPSErrors: true
  });

  const page = await context.newPage();

  page.on('console', async msg => {
    const args = await Promise.all(msg.args().map(arg => arg.jsonValue().catch(() => arg.toString())));
    console.log('[browser]', ...args);
  });

  try {
    // ─── Login ───────────────────────────────────────────────────────────────
    await login(page);

    // ─── Modo LISTING ONLY ───────────────────────────────────────────────────
    if (modoListing) {
      const codigos = await obtenerCodigosCategoria(page, categoriaSingle);
      log(`[${categoriaSingle}] ${codigos.length} códigos:`);
      codigos.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
      return;
    }

    // ─── Modo SINGLE PRODUCT ─────────────────────────────────────────────────
    if (modoSingle) {
      const producto = await procesarProducto(page, codigoSingle, categoriaSingle);

      if (producto) {
        log('Producto procesado OK. JSON resultante:');
        console.log('─'.repeat(70));
        console.log(JSON.stringify(producto, null, 2));
        console.log('─'.repeat(70));

        // Resumen amigable
        const totalColores = producto.colores.length;
        const coloresConStock = producto.colores.filter(c => c.talles_disponibles.length > 0).length;
        const tallesTotales = producto.colores.reduce((acc, c) => acc + c.talles_disponibles.length, 0);
        log(`Resumen: ${totalColores} colores (${coloresConStock} con stock) | ${tallesTotales} combinaciones color×talle disponibles | precio_venta=${producto.precio_venta} | agotado=${producto.agotado}`);
      } else {
        log('Producto NO procesado (ver warnings arriba).', 'warn');
      }
      return; // No iteramos categorías ni escribimos archivo en modo single.
    }

    // ─── Modo FULL ───────────────────────────────────────────────────────────
    const todosLosProductos = [];
    let totalCodigos = 0;
    let totalSkipped = 0;
    const inicioRun = Date.now();

    for (const categoria of CATEGORIAS) {
      try {
        log(`──── [${categoria}] ────`);

        const codigos = await obtenerCodigosCategoria(page, categoria);
        log(`[${categoria}] ${codigos.length} códigos en el listing`);

        if (codigos.length === 0) continue;
        totalCodigos += codigos.length;

        let procesadosCategoria = 0;
        for (const codigo of codigos) {
          const producto = await procesarProducto(page, codigo, categoria);
          if (producto) {
            todosLosProductos.push(producto);
            procesadosCategoria++;
          } else {
            totalSkipped++;
          }
          await sleep(CONFIG.delayEntreProductos);
        }

        log(`[${categoria}] ${procesadosCategoria}/${codigos.length} OK`);
      } catch (e) {
        log(`[${categoria}] error: ${e.message}`, 'error');
        continue;
      }
    }

    const duracionMin = ((Date.now() - inicioRun) / 60000).toFixed(1);
    const conStock = todosLosProductos.filter(p => !p.agotado).length;
    const agotados = todosLosProductos.filter(p => p.agotado).length;
    log(`══════════════════════════════════════════════════════════`);
    log(`TOTAL: ${todosLosProductos.length} productos | ${conStock} con stock | ${agotados} agotados | ${totalSkipped} skipped | ${totalCodigos} en listings`);
    log(`Duración: ${duracionMin} min`);

    // ─── Salvaguarda: no pisar JSON con resultado vacío ─────────────────────
    if (todosLosProductos.length === 0) {
      throw new Error('No se obtuvieron productos válidos. No se escribe el archivo.');
    }

    // ─── Estructurar y guardar ──────────────────────────────────────────────
    const categoriasUnicas = [...new Set(todosLosProductos.map(p => p.categoria))].sort();

    const output = {
      metadata: {
        proveedor: 'Brooksfield B2B',
        coleccion: 'Invierno 2026',
        fecha_actualizacion: new Date().toISOString(),
        total_productos: todosLosProductos.length,
        total_categorias: categoriasUnicas.length,
        productos_con_stock: conStock,
        productos_agotados: agotados,
        scraper_version: 'v2'
      },
      categorias: categoriasUnicas,
      productos: todosLosProductos
    };

    await fs.mkdir(path.dirname(CONFIG.outputFile), { recursive: true });
    await fs.writeFile(CONFIG.outputFile, JSON.stringify(output, null, 2) + '\n', 'utf-8');
    log(`Catálogo guardado: ${CONFIG.outputFile}`);

  } catch (e) {
    log(`Error crítico: ${e.message}`, 'error');
    console.error(e);
    await saveScreenshot(page, 'error_critico');
    throw e;
  } finally {
    await browser.close();
    log('Browser cerrado');
  }
}

// ============================================================================
//  EJECUCIÓN
// ============================================================================

main()
  .then(() => {
    log('Scraping completado');
    process.exit(0);
  })
  .catch((error) => {
    log('Scraping falló', 'error');
    console.error(error);
    process.exit(1);
  });
