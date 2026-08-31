# Dashboard RRHH

Dashboard web estático en español para el CEO (uso principal: teléfono). Unifica el modelo
de costo de rotación por tipo de tienda, el control de vacantes y la rotación mensual de RRHH.
Proyecto interno de Oscar (gestor de RRHH), no es para un cliente externo.

## Stack y despliegue

- Sitio estático → **GitHub Pages**, repo público `dashboard-rrhh` en la cuenta `oscarimorales`
  (el repo se crea en el paso 5 del plan, aún no existe).
- Datos: Google Sheet compartido con enlace, descargado como xlsx por
  `scripts/actualizar_datos.mjs` → genera `public/data/vacantes.json` y `public/data/rotacion.json`.
- GitHub Action diaria (6:00 Guatemala) + `workflow_dispatch`: descarga → sanitiza → build → Pages.
- Node 20, paquete `xlsx` (SheetJS) para leer el Excel.

## Comandos

- `npm run actualizar` — descarga el sheet y regenera los JSON (usa `.env` local).
- (El dev server / build se definirán al construir el dashboard.)

## REGLA INNEGOCIABLE: privacidad (el repo y el sitio son públicos)

1. El `SHEET_ID` vive SOLO en `.env` local (gitignoreado) y en el secret `SHEET_ID` de
   GitHub Actions. Jamás en código, README, commits ni logs.
2. Ningún dato personal puede llegar a `public/`, al bundle ni al repo: nombres de candidatos,
   `¿A QUIEN REEMPLAZA?`, jefes directos, solicitantes, entrevistadores, DPI, teléfonos, sueldos.
   Las pestañas de altas/bajas del sheet se ignoran por completo.
3. `scripts/actualizar_datos.mjs` corre una verificación final anti-fugas (encabezados prohibidos,
   patrones de DPI de 13 dígitos y teléfonos de 8 dígitos). Si detecta algo: aborta sin publicar.
4. Los xlsx descargados van a `.data/` (gitignoreado), nunca al repo.

## Modelo de costo — valores de control

Con los parámetros por defecto de la especificación, el simulador DEBE reproducir:
renuncia A = Q71,831 · renuncia B = Q54,581 · despido A = Q76,101 · despido B = Q58,851.
Si no cuadra, el bug está en la implementación, no en los controles.
El Excel de referencia es `J:\Mi unidad\RRHH\COLABORADORES\COSTO DE ROTACIÓN POR TIPO DE TIENDA - AJUSTADO 0825.xlsx`.

**Detalles verificados contra el Excel (2026-08-31) — sin esto los controles NO cuadran:**
- Semanas por mes = **4.33** (no 4.3333): jefe A/B = Q7,205.54 · coordinadora = Q3,325.64.
- El 4º canal de atracción difiere por escenario: **Renuncia usa "Internet" Q5,000/mes → Q500**
  prorrateado; **Despido usa "Telo" Q2,700/mes → Q270**. (Así está en el Excel de Oscar;
  posible inconsistencia suya — pendiente que Oscar decida si se replica o se unifica.)
- El Excel además trae mezcla: 60% renuncias / 40% despidos (la real del sheet es ~84/16).

## Reglas de trabajo

- No inventar datos: los campos vacíos/inconsistentes se reportan en la sección
  "Calidad de datos" del dashboard, no se rellenan.
- Detección de pestañas del sheet por encabezados, nunca por nombre ni posición.
- Formato es-GT para quetzales (Q71,831), tabular-nums para cifras.
- Colores: tinta #17251F, verde #0B7A55 (renuncia/positivo), ámbar #B5741A (despido).
