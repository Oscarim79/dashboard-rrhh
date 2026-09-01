# Estado del proyecto — Dashboard RRHH

## ✅ PUBLICADO Y FUNCIONANDO (2026-08-31)

- **Dashboard en vivo:** https://oscarim79.github.io/dashboard-rrhh/
- **Repo público:** https://github.com/Oscarim79/dashboard-rrhh (cuenta `Oscarim79`; la
  "oscarimorales" de la spec no existe — Oscar confirmó usar la real)
- **Actualización automática:** GitHub Action diaria a las 6:00 de Guatemala + botón
  "Run workflow" en la pestaña Actions. Secret `SHEET_ID` configurado.
- 5 páginas: Resumen CEO · Vacantes · **Salidas** (nueva, 2026-08-31) · Rotación · Simulador.
  Verificado en vivo (curl + navegador, móvil y escritorio) y JSON publicado revisado: cero datos personales.
- Página Salidas reemplaza al viejo tablero de Data Studio (que está roto — sus fuentes no conectan).
  Usa la pestaña SALIDAS del sheet SOLO en agregado: razón, sub-motivos (n≥3), antigüedad por rangos,
  agencia, área, marca, género. Sin supervisores ni filas individuales. Hallazgo clave: 58% de las
  salidas ocurre antes de los 6 meses; antigüedad mediana al salir 4.7 meses.
- Afinado con retroalimentación de Oscar (2026-08-31): título "DASHBOARD RRHH · CORPORACIÓN
  AMERICANA", menú lateral (fijo en escritorio, ☰ deslizable en móvil), tarjetas del Resumen
  separan "cada salida cuesta" del "acumulado anual (volumen × costo)", y la leyenda distingue
  finiquito (verde) de indemnización (naranja).
- Selector de período en Salidas (2026-09-01, pedido de Oscar): botones "Todo el registro ·
  2024 · 2025 · 2026" que redibujan KPIs y todas las gráficas con el año elegido. El pipeline
  ahora publica en `salidas.json → porAnio` el desglose completo de cada año (la regla de
  privacidad n≥3 → OTROS se aplica dentro de cada año). Verificado en vivo.
- Fórmulas visibles en el Simulador (2026-09-01, pedido de Oscar): bajo cada bloque de
  supuestos hay una cajita con la fórmula en palabras y los números actuales sustituidos
  (ventas perdidas, curva, jefe, coordinadora, sobrecarga, gastos, publicidad, salida y suma
  final); se recalculan en vivo al mover cualquier slider. Verificado en vivo. La fórmula de
  ventas perdidas además explica el origen del 15% de impacto (supuesto del modelo: un vendedor
  menos en un equipo de 5-7 = 14-20% de la fuerza de venta).

## Decisiones firmes

- Modelo con **4 tipos de tienda** (AA/A/B/C, archivo de Oscar con marcas A2K/ABIQ/FRIOTEC).
  Ventas por tipo = puntos medios: AA Q1.2M · A Q750k · B Q400k · C Q200k (editables en Simulador).
- Canales de atracción sin Telo; "Internet" es gasto aparte y se queda (confirmado por Oscar).
- Modelo ampliado (Oscar, 2026-09-01): se suma el **jefe de RRHH** (Q8,000, 100% en reclutar,
  repartido entre las contrataciones del mes → Q800 por contratación) y la coordinadora baja a
  Q4,000. Controles vigentes: renuncia A Q72,262 · B Q55,012 · despido A Q76,762 · B Q59,512 —
  validados en cada deploy por `scripts/validar_modelo.mjs`.
- Calibración con datos reales: **mediana 16 días / promedio 22** de vacante (n=151 cerradas con
  dato; 74 cerradas sin fechas ni días quedan fuera). Corregido 2026-08-31 tras el reclamo de Oscar:
  un bug convertía celdas vacías en 0 días. La mezcla real: 84% renuncias / 16% despidos.
- `SHEET_ID` solo en `.env` local (gitignoreado) y secret de Actions. Pipeline con verificación
  anti-fugas que aborta si detecta datos personales. Pestañas con nombres/DPI/sueldos ignoradas.
- Zona 9 marcada como tienda cerrada (ya no existe).
- Dotación típica de tienda (Oscar, 2026-09-01, **afinable más adelante**): máximo 3 vendedores +
  1 jefe de tienda + 1 asistente. Sustenta el 15% de impacto en ventas del simulador: un vendedor
  menos = 20–33% de la capacidad de venta, así que 15% asume que el equipo cubre buena parte.

## Pendientes (no bloquean nada)

1. **Tiendas sin tipo**: Catocha, Petapa, Pradera Concepción (Americana), Pradera 2, Central,
   Peque 2, CLM, Abi Q Online. Desde 2026-09-01 sus salidas SÍ se costean en el Resumen con un
   **supuesto editable** (default 80% tipo B, resto C — pedido de Oscar, rotulado como supuesto).
   Cuando Oscar las clasifique → editar `config/tiendas.json` y hacer push; el supuesto
   desaparece solo y el costo pasa a ser dato.
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
