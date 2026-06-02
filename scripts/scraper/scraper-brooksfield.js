import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ═══════════════════════════════════════════════════════════════════
//  CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIG = {
  baseUrl: 'https://brooksfieldb2b.com.ar',
  loginUrl: 'https://brooksfieldb2b.com.ar/login.php',
  // Credenciales SIEMPRE desde el entorno — nunca hardcodeadas.
  // En GitHub Actions vienen de Secrets; en local, de variables de entorno.
  credentials: {
    usuario: process.env.BROOKSFIELD_USER,
    password: process.env.BROOKSFIELD_PASSWORD
  },
  debug: process.argv.includes('--debug'),
  headless: !process.argv.includes('--debug'),
  // Escribe directo en data/productos-brooksfield.json del repo (resuelto desde este archivo).
  outputFile: path.resolve(__dirname, '../../data/productos-brooksfield.json'),
  screenshotsDir: path.join(__dirname, 'screenshots')
};

if (!CONFIG.credentials.usuario || !CONFIG.credentials.password) {
  console.error('✗ Faltan credenciales. Definí BROOKSFIELD_USER y BROOKSFIELD_PASSWORD como variables de entorno.');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════
//  FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════════════════

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

// Parsea precios en formato US: "$ 33,000.00" → 33000
function parsePrice(precioText) {
  if (!precioText) return null;
  const cleaned = precioText
    .replace('$', '')
    .replace(/\s/g, '')
    .replace(/,/g, '')   // quita separador de miles
    .split('.')[0];       // descarta decimales
  return parseInt(cleaned) || null;
}

// ═══════════════════════════════════════════════════════════════════
//  SCRAPER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

async function scraper() {
  log('Iniciando scraper de Brooksfield B2B...');

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

  try {
    // ─────────────────────────────────────────────────────────────────
    // PASO 1: LOGIN
    // ─────────────────────────────────────────────────────────────────

    log('Navegando a página de login...');
    await page.goto(CONFIG.loginUrl, { waitUntil: 'networkidle', timeout: 30000 });
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

    // Buscar campo usuario
    let usernameInput = null;
    for (const selector of usernameSelectors) {
      try {
        usernameInput = await page.waitForSelector(selector, { timeout: 2000 });
        if (usernameInput) {
          log(`Campo usuario encontrado: ${selector}`, 'debug');
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!usernameInput) {
      throw new Error('No se pudo encontrar el campo de usuario en el formulario de login');
    }

    // Buscar campo password
    let passwordInput = null;
    for (const selector of passwordSelectors) {
      try {
        passwordInput = await page.waitForSelector(selector, { timeout: 2000 });
        if (passwordInput) {
          log(`Campo password encontrado: ${selector}`, 'debug');
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!passwordInput) {
      throw new Error('No se pudo encontrar el campo de contraseña en el formulario de login');
    }

    // Completar formulario
    log('Completando credenciales...');
    await usernameInput.fill(CONFIG.credentials.usuario);
    await passwordInput.fill(CONFIG.credentials.password);
    await saveScreenshot(page, '02_form_filled');

    // Buscar botón submit
    let submitButton = null;
    for (const selector of submitSelectors) {
      try {
        submitButton = await page.waitForSelector(selector, { timeout: 2000 });
        if (submitButton) {
          log(`Botón submit encontrado: ${selector}`, 'debug');
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!submitButton) {
      throw new Error('No se pudo encontrar el botón de login');
    }

    // Hacer login
    log('Haciendo login...');
    await Promise.all([
      submitButton.click(),
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
    ]);

    await page.waitForTimeout(3000);
    await saveScreenshot(page, '03_after_login');

    // Verificar si el login fue exitoso usando dos estrategias en paralelo:
    // 1) Selectores DOM puros adentro de page.evaluate
    // 2) Selectores con texto usando la API de Playwright (page.locator)
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
        } catch (e) {
          continue;
        }
      }
    }

    const isLoggedIn = isLoggedInByDom || isLoggedInByText;

    if (!isLoggedIn) {
      await saveScreenshot(page, 'login_failed');
      log(`URL actual: ${page.url()}`, 'debug');
      throw new Error('Login falló: no se detectaron elementos de la sesión activa. Verificar credenciales.');
    }

    log('Login OK');

    // ─────────────────────────────────────────────────────────────────
    // PASO 2: NAVEGAR AL CATÁLOGO Y EXTRAER TODAS LAS CATEGORÍAS
    // ─────────────────────────────────────────────────────────────────

    log('Iniciando extracción de todas las categorías...');

    const CATEGORIAS = [
      'BERMUDAS', 'BILLETERAS', 'BOLSOS', 'BOXERS', 'BUFANDAS',
      'BUZOS FRISADOS', 'BUZOS RUSTICOS', 'CAMISAS ML', 'CAMPERAS FRISADAS',
      'CANGUROS FRISADOS', 'CANGUROS RUSTICOS', 'CHALECOS', 'CINTURONES',
      'GORRAS', 'GORROS', 'JACKETS', 'JEANS', 'MEDIAS', 'PANTALONES',
      'PANTALONES CORDEROY', 'PERFUMERIA', 'POLOS MC', 'REMERAS MC',
      'REMERAS ML', 'SWEATERS'
    ];

    const todosLosProductos = [];
    let categoriasConProductos = 0;

    for (const categoria of CATEGORIAS) {
      try {
        const catalogUrl = `${CONFIG.baseUrl}/catalogo.php?itemCatalogo=${encodeURIComponent(categoria)}&sx=MASCULINO&na=true&colId=I26`;

        await page.goto(catalogUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(1500);

        const rawProductos = await page.evaluate((cat) => {
          const items = [];
          const productElements = document.querySelectorAll('div.box-producto');

          productElements.forEach(el => {
            try {
              const codigo = el.getAttribute('data-prod') || null;
              const infos = el.querySelectorAll('.box-info-producto p');
              const nombre = infos[0] ? infos[0].textContent.trim().replace(/\s+/g, ' ') : null;
              const precioEl = el.querySelector('p.mb-3');
              const precioText = precioEl ? precioEl.textContent.trim() : null;
              const agotado = el.textContent.includes('AGOTADO');

              items.push({ codigo, nombre, precioText, agotado, categoria: cat });
            } catch (e) {
              console.error('Error extrayendo producto:', e);
            }
          });

          return items;
        }, categoria);

        log(`[${categoria}] → ${rawProductos.length} productos extraídos`);

        if (rawProductos.length > 0) {
          categoriasConProductos++;
          todosLosProductos.push(...rawProductos);
        }

      } catch (error) {
        log(`Error procesando categoría ${categoria}: ${error.message}`, 'error');
        console.error(error.stack);
      }
    }

    log(`TOTAL: ${todosLosProductos.length} productos en ${categoriasConProductos} categorías`);

    await saveScreenshot(page, '04_scraping_completo');

    // ─────────────────────────────────────────────────────────────────
    // PASO 3: ESTRUCTURAR Y GUARDAR
    // ─────────────────────────────────────────────────────────────────

    log('Generando catálogo público...');

    // Catálogo público: disponibles Y agotados, siempre con precio válido.
    // Se EXCLUYE precio_mayorista (precio B2B — no se publica).
    const productos = todosLosProductos
      .map(p => {
        const precio_mayorista = parsePrice(p.precioText);
        return {
          codigo: p.codigo,
          nombre: p.nombre,
          marca: 'Brooksfield',
          categoria: p.categoria,
          precio_venta: precio_mayorista ? Math.round(precio_mayorista * 2.40) : null,
          imagen: `${CONFIG.baseUrl}/images/productos/${p.codigo}/${p.codigo}-001.png`,
          agotado: p.agotado
        };
      })
      .filter(p => p.codigo && p.nombre && p.precio_venta > 0);

    // Salvaguarda: nunca pisar el catálogo con un resultado vacío.
    if (productos.length === 0) {
      const debugUrl = `${CONFIG.baseUrl}/catalogo.php?itemCatalogo=${encodeURIComponent('BERMUDAS')}&sx=MASCULINO&na=true&colId=I26`;
      await page.goto(debugUrl, { waitUntil: 'networkidle', timeout: 30000 });
      const debugHtml = await page.content();
      const debugFile = path.join(CONFIG.screenshotsDir, 'brooksfield_debug.html');
      await fs.mkdir(path.dirname(debugFile), { recursive: true });
      await fs.writeFile(debugFile, debugHtml, 'utf-8');
      log(`HTML de diagnóstico guardado en: ${debugFile}`);
      throw new Error('No se obtuvieron productos válidos — no se escribe el archivo para no romper la tienda.');
    }

    const categoriasUnicas = [...new Set(productos.map(p => p.categoria))].sort();

    const output = {
      metadata: {
        proveedor: 'Brooksfield B2B',
        coleccion: 'Invierno 2026',
        fecha_actualizacion: new Date().toISOString(),
        total_productos: productos.length,
        total_categorias: categoriasUnicas.length
      },
      categorias: categoriasUnicas,
      productos
    };

    await fs.mkdir(path.dirname(CONFIG.outputFile), { recursive: true });
    await fs.writeFile(CONFIG.outputFile, JSON.stringify(output, null, 2) + '\n', 'utf-8');

    log(`Catálogo guardado en: ${CONFIG.outputFile}`);
    log(`${productos.length} productos en ${categoriasUnicas.length} categorías`);

  } catch (error) {
    log(`Error crítico: ${error.message}`, 'error');
    console.error(error);
    await saveScreenshot(page, 'error');
    throw error;

  } finally {
    await browser.close();
    log('Navegador cerrado');
  }
}

// ═══════════════════════════════════════════════════════════════════
//  EJECUCIÓN
// ═══════════════════════════════════════════════════════════════════

scraper()
  .then(() => {
    log('Scraping completado exitosamente', 'info');
    process.exit(0);
  })
  .catch((error) => {
    log('Scraping falló', 'error');
    console.error(error);
    process.exit(1);
  });
