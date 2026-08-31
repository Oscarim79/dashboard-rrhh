# Estado del proyecto — Dashboard RRHH

## ✅ PUBLICADO Y FUNCIONANDO (2026-08-31)

- **Dashboard en vivo:** https://oscarim79.github.io/dashboard-rrhh/
- **Repo público:** https://github.com/Oscarim79/dashboard-rrhh (cuenta `Oscarim79`; la
  "oscarimorales" de la spec no existe — Oscar confirmó usar la real)
- **Actualización automática:** GitHub Action diaria a las 6:00 de Guatemala + botón
  "Run workflow" en la pestaña Actions. Secret `SHEET_ID` configurado.
- 4 páginas: Resumen CEO · Vacantes · Rotación · Simulador. Verificado en vivo (curl + navegador,
  móvil y escritorio) y JSON publicado revisado: cero datos personales.
- Afinado con retroalimentación de Oscar (2026-08-31): título "DASHBOARD RRHH · CORPORACIÓN
  AMERICANA", menú lateral (fijo en escritorio, ☰ deslizable en móvil), tarjetas del Resumen
  separan "cada salida cuesta" del "acumulado anual (volumen × costo)", y la leyenda distingue
  finiquito (verde) de indemnización (naranja).

## Decisiones firmes

- Modelo con **4 tipos de tienda** (AA/A/B/C, archivo de Oscar con marcas A2K/ABIQ/FRIOTEC).
  Ventas por tipo = puntos medios: AA Q1.2M · A Q750k · B Q400k · C Q200k (editables en Simulador).
- Canales de atracción sin Telo; "Internet" es gasto aparte y se queda (confirmado por Oscar).
  Controles del modelo: renuncia A Q71,831 · B Q54,581 · despido A Q76,331 · B Q59,081 —
  validados en cada deploy por `scripts/validar_modelo.mjs`.
- Calibración con datos reales: **mediana 16 días / promedio 22** de vacante (n=151 cerradas con
  dato; 74 cerradas sin fechas ni días quedan fuera). Corregido 2026-08-31 tras el reclamo de Oscar:
  un bug convertía celdas vacías en 0 días. La mezcla real: 84% renuncias / 16% despidos.
- `SHEET_ID` solo en `.env` local (gitignoreado) y secret de Actions. Pipeline con verificación
  anti-fugas que aborta si detecta datos personales. Pestañas con nombres/DPI/sueldos ignoradas.
- Zona 9 marcada como tienda cerrada (ya no existe).

## Pendientes (no bloquean nada)

1. **Tiendas sin tipo** (se muestran sin costo): Catocha, Petapa, Pradera Concepción (Americana),
   Pradera 2, Central, Peque 2, CLM, Abi Q Online. Cuando Oscar las clasifique → editar
   `config/tiendas.json` y hacer push.
2. En el Excel de tiendas de Oscar hay una **fila tipo B sin nombre** — preguntarle cuál es.
3. El Excel del modelo de Oscar aún tiene la fila "Telo" en la hoja Despido y fórmulas de
   Tienda B mal referenciadas en su Resumen (suman columna B corrida una fila). No afecta al
   dashboard; es limpieza de su archivo.
4. Asumimos "Pradera CSV" (ABIQ) = la tienda Abi Q de Pradera Concepción — Oscar no lo ha corregido,
   así que se da por bueno.

## Cómo retomar

Abrir `D:\Proyectos\DASHBOARD RRHH` y preguntar "¿en qué nos quedamos?". Comandos útiles:
`npm run actualizar` (regenerar datos con el .env local), `node scripts/validar_modelo.mjs`
(controles del modelo), `npx --yes http-server public -p 4173` (ver el sitio local).
Para cambios: editar → commit → push (el push despliega solo).
