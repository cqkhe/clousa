[README.md](https://github.com/user-attachments/files/28131496/README.md)
# Scraper Mistral B2B - Extracción Automática de Catálogo

Scraper automatizado para extraer el catálogo completo de productos, precios y stock desde Mistral B2B (https://mistralb2b.com.ar).

## 🚀 Instalación

### Prerequisitos

- Node.js 18+ instalado
- Conexión a internet

### Pasos

1. **Copiar esta carpeta a tu máquina local:**
   ```bash
   # Si estás en el repo de Clousa:
   cd C:\clousa  # o donde tengas tu proyecto
   mkdir scraper-mistral
   cd scraper-mistral
   ```

2. **Copiar los archivos:**
   - `package.json`
   - `scraper.js`
   - `README.md` (este archivo)

3. **Instalar dependencias:**
   ```bash
   npm install
   ```

   Esto instalará Playwright y sus navegadores automáticamente (~200MB).

## 📖 Uso

### Ejecución básica (headless)

```bash
npm run scrape
```

Esto ejecuta el scraper en modo invisible y rápido.

### Ejecución en modo DEBUG (recomendado la primera vez)

```bash
npm run scrape:debug
```

Esto abre el navegador visible para que veas qué está haciendo el scraper en tiempo real. **Usa este modo la primera vez** para verificar que el login funcione.

## 📂 Archivos generados

Después de ejecutar, el scraper genera:

### `mistral_catalogo.json`
Archivo principal con todos los productos extraídos. Estructura:

```json
{
  "metadata": {
    "fecha_extraccion": "2025-05-21T...",
    "proveedor": "Mistral B2B",
    "url_catalogo": "https://mistralb2b.com.ar/...",
    "total_items_raw": 150
  },
  "productos_raw": [
    {
      "index": 0,
      "imagen": "https://...",
      "imagenes": ["https://...", "https://..."],
      "textos": ["Campera North", "Talle: S M L XL", "$45.000"],
      "link": "https://mistralb2b.com.ar/producto.php?id=123",
      "dataAttributes": {
        "data-id": "123",
        "data-precio": "45000"
      }
    }
  ]
}
```

### `screenshots/` (solo en modo debug)
Capturas de pantalla del proceso:
- `01_login_page_*.png` - Formulario de login
- `02_form_filled_*.png` - Formulario completado
- `03_after_login_*.png` - Página después del login
- `04_catalogo_*.png` - Catálogo de productos

### `mistral_page_dump.html` (si no encuentra productos)
HTML completo de la página para análisis manual.

### `error_page_dump.html` (si hay error)
HTML de la página donde ocurrió el error.

## 🔧 Configuración

Para cambiar credenciales o comportamiento, editá `scraper.js` líneas 12-21:

```javascript
const CONFIG = {
  baseUrl: 'https://mistralb2b.com.ar',
  loginUrl: 'https://mistralb2b.com.ar/login.php',
  credentials: {
    usuario: '20110220643',  // ← cambiar acá
    password: 'capo'          // ← cambiar acá
  },
  // ...
};
```

## 🐛 Troubleshooting

### Error: "No se pudo encontrar el campo de usuario"

**Causa:** El formulario de login tiene una estructura HTML diferente a la esperada.

**Solución:**
1. Ejecutá en modo debug: `npm run scrape:debug`
2. Cuando abra el navegador, fijate qué campos tiene el formulario
3. Abrí DevTools (F12) en el navegador
4. Hacé click derecho en el campo usuario → Inspeccionar
5. Copiá el atributo `name` o `id` del input
6. Pegame ese atributo acá y actualizo el scraper

### Error: "Login falló"

**Causa:** Credenciales incorrectas o el sitio bloqueó el login automatizado.

**Solución:**
1. Verificá que las credenciales sean correctas (probá loguearte manualmente)
2. Si funcionan manualmente pero no en el scraper, el sitio puede tener protección anti-bot
3. Avisame y agrego lógica más avanzada (delays, captcha solver, etc.)

### No encuentra productos

**Causa:** Estamos navegando a la página correcta pero no detectamos la estructura HTML de los productos.

**Solución:**
1. El scraper guardó `mistral_page_dump.html`
2. Abrí ese archivo en un editor de texto
3. Buscá (Ctrl+F) por texto que veas en los productos (ej: nombre de una campera)
4. Copiame el bloque HTML que contenga ese producto
5. Actualizo el scraper con la estructura correcta

## 📊 Próximos pasos después de extraer el catálogo

Una vez que tengamos `mistral_catalogo.json` con datos correctos:

### 1. Parser inteligente
Crear `parser.js` que tome el JSON raw y lo estructure con:
- Código de artículo
- Nombre normalizado
- Categoría inferida
- Precio parseado correctamente
- Stock por talle
- Talles disponibles

### 2. Integración con Clousa
- Reemplazar el array hardcoded de productos en `index.html`
- Fetch automático desde `mistral_catalogo.json`
- Agregar tu margen de ganancia sobre los precios de fábrica
- Filtros por marca, categoría, talle, precio

### 3. Automatización
- GitHub Actions para ejecutar el scraper cada 6 horas
- Netlify Function que exponga el catálogo vía API
- Sistema de alertas si hay productos nuevos o cambios de precio

## 🔐 Seguridad

⚠️ **NO commitees este scraper al repo público de GitHub** con las credenciales dentro.

Si querés subirlo:
1. Movete las credenciales a un archivo `.env`
2. Agregá `.env` al `.gitignore`
3. Usá `process.env.MISTRAL_USER` en lugar de hardcodear

## 📞 Soporte

Si algo no funciona o necesitás ajustar el scraper:
1. Ejecutá en modo debug
2. Tomá screenshots de los errores
3. Guardá el `error_page_dump.html` si se generó
4. Pasame esa info y lo ajusto

---

**Versión:** 1.0.0  
**Autor:** Santino Gallo Vazquez  
**Proyecto:** Clousa Ecommerce Integration
