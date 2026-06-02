import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ═══════════════════════════════════════════════════════════════════
//  CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIG = {
  baseUrl: 'https://mistralb2b.com.ar',
  loginUrl: 'https://mistralb2b.com.ar/login.php',
  // Credenciales SIEMPRE desde el entorno — nunca hardcodeadas.
  // En GitHub Actions vienen de Secrets; en local, de variables de entorno.
  credentials: {
    usuario: process.env.MISTRAL_USER,
    password: process.env.MISTRAL_PASSWORD
  },
  debug: process.argv.includes('--debug'),
  headless: !process.argv.includes('--debug'),
  // Escribe directo en data/productos.json del repo (resuelto desde este archivo).
  outputFile: path.resolve(__dirname, '../../data/productos.json'),
  screenshotsDir: 'screenshots'
};

if (!CONFIG.credentials.usuario || !CONFIG.credentials.password) {
  console.error('✗ Faltan credenciales. Definí MISTRAL_USER y MISTRAL_PASSWORD como variables de entorno.');
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

// ═══════════════════════════════════════════════════════════════════
//  SCRAPER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

async function scraper() {
  log('Iniciando scraper de Mistral B2B...');
  
  const browser = await chromium.launch({
    headless: CONFIG.headless,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    ignoreHTTPSErrors: true // IMPORTANTE: ignora certificados SSL inválidos
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
    
    // Estrategias múltiples para detectar campos de login
    // (no sabemos exactamente qué estructura HTML tienen)
    
    const usernameSelectors = [
      'input[name="usuario"]',
      'input[name="username"]',
      'input[name="user"]',
      'input[name="cuit"]',
      'input[type="text"]',
      'input#usuario',
      'input#username'
    ];
    
    const passwordSelectors = [
      'input[name="password"]',
      'input[name="pass"]',
      'input[name="clave"]',
      'input[type="password"]',
      'input#password'
    ];
    
    const submitSelectors = [
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
    
    // Verificar si el login fue exitoso
    const currentUrl = page.url();
    log(`URL actual después de login: ${currentUrl}`, 'debug');
    
    // Si nos quedamos en login.php, probablemente falló
    if (currentUrl.includes('login.php')) {
      // Buscar mensaje de error
      const errorMessages = await page.locator('text=/error|incorrecto|inválido/i').allTextContents();
      if (errorMessages.length > 0) {
        throw new Error(`Login falló: ${errorMessages.join(', ')}`);
      }
      log('Posible error de login - revisar screenshot', 'warn');
    }
    
    log('Login exitoso ✓');
    
    // ─────────────────────────────────────────────────────────────────
    // PASO 2: NAVEGAR AL CATÁLOGO Y EXTRAER TODAS LAS CATEGORÍAS
    // ─────────────────────────────────────────────────────────────────
    
    log('Iniciando extracción de todas las categorías...');
    
    // Lista completa de categorías de Mistral B2B (Colección Invierno 2026)
    const categorias = [
      'BOXERS', 'BUFANDAS', 'BUZOS FRISADOS', 'BUZOS POLAR', 'BUZOS RUSTICOS',
      'CAMISAS ML', 'CAMPERAS FRISADAS', 'CAMPERAS POLAR', 'CAMPERAS RUSTICAS',
      'CANGUROS FRISADOS', 'CANGUROS RUSTICOS', 'CHALECOS', 'CINTURONES',
      'GORRAS', 'GORROS', 'JACKETS', 'JEANS', 'JOGGINGS FRISADOS',
      'JOGGINGS RUSTICOS', 'PANTALONES', 'PERFUMERIA', 'POLOS MC',
      'REMERAS MC', 'REMERAS ML', 'SWEATERS'
    ];
    
    const todosLosProductos = [];
    const estadisticas = {
      categorias_procesadas: 0,
      categorias_con_productos: 0,
      categorias_vacias: 0,
      total_productos: 0,
      productos_agotados: 0
    };
    
    for (const categoria of categorias) {
      try {
        log(`\n📦 Procesando categoría: ${categoria}...`, 'info');
        
        const catalogUrl = `${CONFIG.baseUrl}/catalogo.php?itemCatalogo=${encodeURIComponent(categoria)}&colId=I26`;
        
        await page.goto(catalogUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(1500); // esperar que cargue el loader
        
        // Extraer productos de esta categoría
        const productos = await page.evaluate((cat) => {
          const items = [];
          const productElements = document.querySelectorAll('.box-producto');
          
          productElements.forEach((el, index) => {
            try {
              const item = { index: index };
              
              // Código del producto
              item.codigo = el.getAttribute('data-prod') || null;
              
              // Imagen principal
              const img = el.querySelector('.box-imagen img');
              if (img) {
                item.imagen = img.src || img.getAttribute('src');
              }
              
              // Info del producto
              const infos = el.querySelectorAll('.box-info-producto p');
              const textos = [];
              
              infos.forEach(p => {
                const text = p.textContent.trim();
                if (text) textos.push(text);
              });
              
              // Nombre completo
              item.nombre_completo = textos.filter(t => 
                !t.startsWith('COD:') && 
                !t.startsWith('$') && 
                t !== 'AGOTADO' &&
                t.length > 2
              ).join(' ');
              
              // Código (verificación)
              const codigoText = textos.find(t => t.startsWith('COD:'));
              if (codigoText) {
                item.codigo_texto = codigoText.replace('COD:', '').trim();
              }
              
              // Estado
              item.agotado = textos.includes('AGOTADO');
              
              // Precio
              const precioText = textos.find(t => t.startsWith('$'));
              if (precioText) {
                item.precio_texto = precioText;
                let precioLimpio = precioText
                  .replace('$', '')
                  .replace(/\s/g, '')
                  .replace(/\./g, '')
                  .replace(/,/g, '');
                
                if (precioLimpio.endsWith('00')) {
                  precioLimpio = precioLimpio.slice(0, -2);
                }
                
                item.precio = parseInt(precioLimpio) || null;
              }
              
              // Link detalle
              const link = el.querySelector('.box-info-producto a');
              if (link) {
                item.link_detalle = link.href || link.getAttribute('href');
              }
              
              // Categoría
              item.categoria = cat;
              
              items.push(item);
            } catch (e) {
              console.error('Error extrayendo producto:', e);
            }
          });
          
          return items;
        }, categoria);
        
        if (productos.length > 0) {
          log(`  ✓ Encontrados ${productos.length} productos`, 'info');
          estadisticas.categorias_con_productos++;
          estadisticas.total_productos += productos.length;
          estadisticas.productos_agotados += productos.filter(p => p.agotado).length;
          
          todosLosProductos.push(...productos);
        } else {
          log(`  ⚠ No hay productos en esta categoría`, 'warn');
          estadisticas.categorias_vacias++;
        }
        
        estadisticas.categorias_procesadas++;
        
      } catch (error) {
        log(`  ✗ Error procesando categoría ${categoria}: ${error.message}`, 'error');
      }
    }
    
    log(`\n📊 Estadísticas finales:`, 'info');
    log(`  - Categorías procesadas: ${estadisticas.categorias_procesadas}/${categorias.length}`);
    log(`  - Categorías con productos: ${estadisticas.categorias_con_productos}`);
    log(`  - Categorías vacías: ${estadisticas.categorias_vacias}`);
    log(`  - Total productos: ${estadisticas.total_productos}`);
    log(`  - Productos agotados: ${estadisticas.productos_agotados}`);
    log(`  - Productos disponibles: ${estadisticas.total_productos - estadisticas.productos_agotados}`);
    
    await saveScreenshot(page, '05_scraping_completo');
    
    // ─────────────────────────────────────────────────────────────────
    // PASO 3: ESTRUCTURAR Y GUARDAR
    // ─────────────────────────────────────────────────────────────────
    
    log('\n💾 Generando catálogo público...');

    // Catálogo público: SOLO disponibles y con precio válido.
    // Se EXCLUYEN precio_fabrica y precio_texto (precios B2B — no se publican).
    const productos = todosLosProductos
      .map(p => ({
        codigo: p.codigo,
        nombre: p.nombre_completo,
        marca: 'Mistral',
        categoria: p.categoria,
        precio_venta: p.precio ? Math.round(p.precio * 2.40) : null, // markup 140%
        imagen: p.imagen,
        agotado: p.agotado
      }))
      .filter(p => p.agotado === false && p.precio_venta > 0 && p.codigo && p.nombre);

    // Salvaguarda: nunca pisar el catálogo con un resultado vacío.
    if (productos.length === 0) {
      throw new Error('No se obtuvieron productos válidos — no se escribe el archivo para no romper la tienda.');
    }

    const categoriasConProductos = [...new Set(productos.map(p => p.categoria))].sort();

    const output = {
      metadata: {
        proveedor: 'Mistral B2B',
        coleccion: 'Invierno 2026',
        fecha_actualizacion: new Date().toISOString(),
        total_productos: productos.length,
        total_categorias: categoriasConProductos.length
      },
      categorias: categoriasConProductos,
      productos
    };

    await fs.mkdir(path.dirname(CONFIG.outputFile), { recursive: true });
    await fs.writeFile(CONFIG.outputFile, JSON.stringify(output, null, 2) + '\n', 'utf-8');

    log(`✓ Catálogo guardado en: ${CONFIG.outputFile}`);
    log(`✓ ${productos.length} productos disponibles en ${categoriasConProductos.length} categorías`);
    
  } catch (error) {
    log(`Error crítico: ${error.message}`, 'error');
    console.error(error);
    await saveScreenshot(page, 'error');
    
    // Guardar HTML para debug
    try {
      const html = await page.content();
      await fs.writeFile('error_page_dump.html', html, 'utf-8');
      log('HTML de error guardado en: error_page_dump.html');
    } catch (e) {
      // ignore
    }
    
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
    log('✓ Scraping completado exitosamente', 'info');
    process.exit(0);
  })
  .catch((error) => {
    log('✗ Scraping falló', 'error');
    console.error(error);
    process.exit(1);
  });
