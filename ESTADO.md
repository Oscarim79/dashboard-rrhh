# Estado del proyecto — Dashboard RRHH

## Decisiones firmes

- Sitio estático en GitHub Pages, repo público `dashboard-rrhh` (cuenta `oscarimorales`) — se crea al FINAL (paso 5 del plan).
- Fuente única: Google Sheet compartido con enlace, descargado como xlsx. Nada de exportaciones manuales.
- `SHEET_ID` solo en `.env` local y secret de GitHub Actions. Nunca en el código.
- Privacidad innegociable: cero nombres, DPI, teléfonos o sueldos en el repo/sitio. Verificación anti-fugas obligatoria antes de publicar. Pestañas ALTAS, SALIDAS, BASE DE DATOS GENERAL, CVs FILTRADOS y CONTROL DE INTEGRACIÓN se ignoran por completo.
- 4 páginas: Resumen CEO / Vacantes / Rotación / Simulador. Diseño móvil primero.
- Valores de control del simulador: renuncia A Q71,831 · renuncia B Q54,581 · despido A Q76,101 · despido B Q58,851 — **ya reproducidos exactamente** (ver CLAUDE.md: semanas/mes = 4.33 y canal Internet-vs-Telo según escenario).

## Hecho (sesión 2026-08-31)

- Proyecto inicializado: git, npm, `xlsx`, `.env` con SHEET_ID, `.gitignore` (protege `.env`, `.data/`, xlsx).
- Descarga automática del sheet funcionando (`scripts/diagnostico.mjs` + `diagnostico-extra.mjs`).
- Diagnóstico completo de datos hecho (detalle en el chat de esta sesión). Resumen:
  - CONTROL DE VACANTES: 254 filas, ago 2024 → ago 2026. 228 cerradas / 14 abiertas / 12 canceladas.
  - Días reales de vacante (cerradas, n=228): **mediana 10, promedio 11.9** — muy por debajo del supuesto de 30.
  - Motivos: Renuncia 149 · Cambio estratégico 40 · Despido 29 · Nueva plaza 21 · Temporal 7 · No confirmado 6. Mezcla real renuncia/despido ≈ 84/16.
  - Empresas: Americana 228 · Abi Q 25 · Friotec 1.
  - Rotación: `INDICADOR ROTACION` (56 filas, % ACUMULADO del año, TOTAL EMPRESA y AREA COMERCIAL) y `DATA INDICADOR ROTACION` (354 filas, mensual por área/supervisor con altas/bajas/headcount).
  - Calidad: 154 cerradas sin fecha de cierre (solo traen DÍAS TRANSCURRIDOS), 3 con días negativos, 13 con días registrados ≠ calculados, lugares de trabajo sucios (mayúsculas, regiones mezcladas con tiendas), puestos con variantes de escritura, canales de atracción casi vacíos (solo se llenan desde ~2026).

## Siguiente — BLOQUEADO esperando a Oscar

1. **Oscar debe confirmar o corregir el mapeo de lugares → tipo A / tipo B / no-es-tienda** (propuesta enviada en el chat; dijo que lo está consiguiendo).
2. **Canales de atracción actualizados:** Oscar eliminó "Telo" y renombró "Ferias" → "Inversión de pauta para redes". Falta que GUARDE el Excel (está abierto con cambios sin guardar) para re-leer los montos finales y re-derivar los 4 valores de control.
3. Oscar decide qué pestaña manda para rotación (propuesta: DATA para % mensual + INDICADOR para acumulado).
4. Con eso confirmado → construir pipeline (`scripts/actualizar_datos.mjs`) + dashboard (paso 4) y luego repo + Action + Pages (paso 5).

## Cómo retomar

Abrir `D:\Proyectos\DASHBOARD RRHH`, preguntar "¿en qué nos quedamos?" y responder las 3 preguntas de arriba. El diagnóstico técnico quedó en `.data/diagnostico.json` (local, no se commitea) y se regenera con `npm run diagnostico`.
