[README.md](https://github.com/user-attachments/files/28131729/README.md)
# Scraper Mistral B2B — Clousa

Automatización que mantiene `data/productos.json` sincronizado con el
catálogo de [Mistral B2B](https://mistralb2b.com.ar). Corre sola todos los
días; cuando el catálogo cambia, commitea el JSON y Netlify re-deploya.

```
scripts/scraper/
├── scraper.js          Scraper Playwright (login + 25 categorías + JSON)
├── package.json        Dependencias (playwright)
├── package-lock.json   Lockfile — necesario para `npm ci`
├── .gitignore          Ignora node_modules/, screenshots/ y dumps
└── README.md           Este archivo
```

---

## Cómo funciona

1. **Disparador** — el workflow `.github/workflows/actualizar-stock.yml`
   corre por `cron` a las **09:00 UTC (06:00 Argentina)**, y también puede
   lanzarse a mano desde la pestaña Actions.
2. **Login** — `scraper.js` abre Chromium con Playwright e inicia sesión en
   Mistral B2B con las credenciales tomadas del entorno.
3. **Recorrido** — visita las 25 categorías
   (`catalogo.php?itemCatalogo=…&colId=I26`) y extrae cada producto.
4. **Reglas de negocio**
   - `precio_venta = precio_fabrica × 1.40` (markup del 40 %).
   - Solo se publican productos **disponibles** (`agotado: false`).
   - Se descartan los productos con `precio_venta` nulo o 0.
   - El JSON final **excluye** `precio_fabrica` y `precio_texto`: los
     precios de fábrica B2B nunca llegan al sitio público.
5. **Salvaguarda** — si el scraping no devuelve productos válidos, el script
   aborta **sin escribir** el archivo, para no romper la tienda.
6. **Commit** — si `data/productos.json` cambió, el workflow commitea como
   `chore: actualizar stock Mistral [bot]` y pushea. Netlify re-deploya solo.

### Formato de salida (`data/productos.json`)

```json
{
  "metadata": {
    "proveedor": "Mistral B2B",
    "coleccion": "Invierno 2026",
    "fecha_actualizacion": "2026-05-22T09:00:00.000Z",
    "total_productos": 172,
    "total_categorias": 22
  },
  "categorias": ["JACKETS", "JEANS", "..."],
  "productos": [
    {
      "codigo": "96093M",
      "nombre": "PACK X 2 BOXER PREMIUM LYCRA MASCULINO",
      "marca": "Mistral",
      "categoria": "BOXERS",
      "precio_venta": 26600,
      "imagen": "https://mistralb2b.com.ar/images/productos/...",
      "agotado": false
    }
  ]
}
```

---

## Configurar los GitHub Secrets

Las credenciales **nunca** van en el código: se leen del entorno. En
GitHub Actions vienen de **Secrets**.

1. En GitHub: **Settings ▸ Secrets and variables ▸ Actions**.
2. **New repository secret** y creá estos dos:

   | Nombre              | Valor                       |
   |---------------------|-----------------------------|
   | `MISTRAL_USER`      | Usuario de Mistral B2B      |
   | `MISTRAL_PASSWORD`  | Contraseña de Mistral B2B   |

3. El workflow los inyecta como variables de entorno al correr `scraper.js`.

> El scraper aborta con un error claro si `MISTRAL_USER` o
> `MISTRAL_PASSWORD` no están definidos.

---

## Ejecutar localmente

```bash
cd scripts/scraper
npm install                       # instala playwright
npx playwright install chromium   # descarga el navegador

# Credenciales por variables de entorno (no se hardcodean):
MISTRAL_USER="tu_usuario" MISTRAL_PASSWORD="tu_password" npm run scrape
```

Modo **debug** — abre el navegador visible y guarda capturas en
`screenshots/`:

```bash
MISTRAL_USER="tu_usuario" MISTRAL_PASSWORD="tu_password" npm run scrape:debug
```

El resultado se escribe en `../../data/productos.json` (la ruta se resuelve
relativa a `scraper.js`, así que funciona desde cualquier directorio).

En Windows (PowerShell):

```powershell
$env:MISTRAL_USER="tu_usuario"; $env:MISTRAL_PASSWORD="tu_password"; npm run scrape
```

---

## Ejecutar manualmente en GitHub

1. Pestaña **Actions** del repositorio.
2. Workflow **«Actualizar Stock Diario Mistral»** en la lista de la izquierda.
3. Botón **Run workflow ▸ Run workflow**.

Sirve para forzar una actualización sin esperar al cron.

---

## Troubleshooting

- **Aborta por credenciales** → faltan `MISTRAL_USER` / `MISTRAL_PASSWORD`
  en el entorno (o en Secrets).
- **«No se pudo encontrar el campo de usuario»** → la estructura del login
  cambió. Corré `npm run scrape:debug` y revisá las capturas en
  `screenshots/`.
- **«No hay productos»** → revisá el dump `mistral_page_dump.html` o
  `error_page_dump.html` que deja el scraper, y ajustá los selectores en
  `scraper.js`.
- **El workflow no commitea** → no hubo cambios en el catálogo (es el
  comportamiento esperado) o el job no tiene permiso `contents: write`.
