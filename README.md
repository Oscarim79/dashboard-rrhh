# Dashboard RRHH

Dashboard ejecutivo (en español, móvil primero) que unifica el **costo de rotación por tipo de
tienda**, el **control de vacantes** y la **rotación mensual** de RRHH. Se publica como sitio
estático en GitHub Pages y se actualiza solo, todos los días, desde un Google Sheet.

## Cómo funciona

1. `scripts/actualizar_datos.mjs` descarga el Google Sheet (como xlsx), detecta las pestañas
   **por sus encabezados** (no por nombre ni posición), limpia los datos y genera
   `public/data/vacantes.json`, `rotacion.json` y `meta.json` — solo cifras agregadas.
2. Antes de escribir nada corre una **verificación anti-fugas**: si detecta encabezados
   prohibidos, posibles DPI (13 dígitos) o teléfonos (8 dígitos), aborta sin publicar.
3. Una GitHub Action corre ese script todos los días a las 6:00 (hora de Guatemala),
   valida el modelo de costo contra sus valores de control y despliega `public/` a Pages.
4. `public/js/modelo.js` replica el modelo de costo del Excel de RRHH; el Simulador
   permite mover los supuestos y calibrarlos con los datos reales.

## Privacidad

El sitio y este repositorio son públicos. **Ningún dato personal sale del Google Sheet**:
ni nombres, ni DPI, ni teléfonos, ni sueldos. El ID del sheet tampoco está en el código:
vive en un `.env` local (ignorado por git) y en el secret `SHEET_ID` de GitHub Actions.

## Comandos (Windows / PowerShell)

Crear el archivo `.env` (una sola vez, reemplazando el ID real):

```powershell
Set-Content -Path .env -Value "SHEET_ID=EL_ID_DE_TU_SHEET"
```

Instalar dependencias y actualizar los datos localmente:

```powershell
npm install
npm run actualizar
```

Validar que el modelo reproduce los valores de control:

```powershell
node scripts/validar_modelo.mjs
```

Ver el dashboard localmente (sirve la carpeta `public/`):

```powershell
npx --yes http-server public -p 4173 -c-1
```

## Estructura

- `config/tiendas.json` — clasificación de tiendas (AA/A/B/C), marca y alias de nombres.
- `scripts/actualizar_datos.mjs` — pipeline: descarga → sanitiza → agrega → verifica → publica.
- `scripts/validar_modelo.mjs` — valores de control del modelo (si fallan, hay un bug).
- `public/` — el sitio: Resumen (CEO) · Vacantes · Rotación · Simulador.
- `.github/workflows/actualizar.yml` — actualización diaria + despliegue a Pages.
