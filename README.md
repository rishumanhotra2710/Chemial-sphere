# ChemicalSphere(TM) - Decision Intelligence Layer (Initial Build)

## Run it
Open `index.html` directly in a browser. No server, no CDN, no install.

## Regenerate the data
```
python generate_chemicalsphere_data.py
```
Rewrites `data.js` (the cockpit reads this) and `csv/*.csv` (OTBI / modelling extracts).

## What's in here
| File | Purpose |
|---|---|
| `index.html` | Executive Cockpit - KPI tiles, agent feed, trends, scorecards, knowledge graph, outcome tracker |
| `generate_chemicalsphere_data.py` | Batch-spine star schema simulator + KPI layer + agent rule layer |
| `data.js` | Pre-computed payload consumed by the cockpit |
| `csv/` | 13 tables - 8 dimensions, 1 bridge, 5 facts |

## Star schema (batch is the spine)
Dimensions: plant, supplier, raw_material, formula, product, customer, carrier
Bridge:     recipe (formula -> ingredient BOM)
Facts:      batch, capa, purchase_order, shipment, inventory

Genealogy chain carried end to end:
RawMaterial -> Supplier -> PO -> Batch -> Formula -> Product -> Customer -> Revenue -> Margin

## Scale
24 months | 6 plants | 12 formulas | 10 suppliers | 20 raw materials | 15 customers
5,280 batches | 1,987 PO lines | 2,719 shipments | 209 CAPA records
Months 1-18 = baseline | Months 19-24 = ChemicalSphere active (drives Outcome Tracker)

## Seeded anomalies (one story per agent)
| ID | Anomaly | Agent it triggers |
|---|---|---|
| PLT-03 Jurong Island | OEE / throughput bottleneck | Production Optimization |
| FRM-09 SpecialtyBlend Z | RM cost variance -> margin leak | Formula Intelligence |
| SUP-07 Caspian Intermed | OTIF collapse + lead-time drift | Supplier Risk |
| Agrochem / Specialty | QC failure cluster -> CAPA recurrence | Compliance |
| PLT-05 Camacari | Slow-moving shelf-life exposure | Inventory Intelligence |

## KPI definitions
All 21 KPIs are defined in `KPI_DEFS` in the generator and surface on each tile in the UI.
Composites (Supplier Risk Score, Audit Compliance Score, Logistics Risk Score,
Recall Readiness) are weighted indices - weights are visible in the code and defensible in a demo.

## Agent thresholds
Held in `THRESHOLDS` in the generator. Tuned so only the seeded anomalies fire (7 open
recommendations). Loosen `margin_floor` / `capa_recur_ceiling` to generate more noise.

## Next step
Swap the simulator for the real Retail DI Layer structure once available, then map
each fact table to its Oracle source (JDE, Sales Cloud, CPQ, OIC, OTM, EPM, OCC, OAC).
