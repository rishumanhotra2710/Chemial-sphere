# ChemicalSphere(TM) - Decision Intelligence Platform

## Run it
Open `index.html` directly in a browser. No server, no CDN, no install.

## Regenerate the data
```
python generate_chemicalsphere_data.py
```
Rewrites `data.js` (the platform reads this) and `csv/*.csv` (OTBI / modelling extracts).

## What's in here
| File | Purpose |
|---|---|
| `index.html` | App shell - sidebar nav, topbar/filters, shared components (KPI tiles, insight cards, decomposition widget, combo charts), page routing |
| `pages.js` | Render logic for all 20 pages (Overview, 6 Business Intelligence pages, 13 Predictive/Governance pages) |
| `generate_chemicalsphere_data.py` | Batch-spine star schema simulator + KPI layer + agent rule layer + forecasting/decomposition/concentration analytics |
| `data.js` | Pre-computed payload consumed by the platform |
| `csv/` | 13 tables - 8 dimensions, 1 bridge, 5 facts |

## Pages
- **Overview** - headline KPIs, quick links, Outcome Tracker (baseline vs ChemicalSphere-active)
- **Business Intelligence**: Executive Command Center, Plant Performance, Formula & Product Mix, Supply Chain, Inventory & Waste, Customer & Revenue
- **Predictive**: Demand Forecasting, Production Scheduling Optimiser, Waste & Shelf-Life Risk, Margin What-If (interactive), Supply Dependency, Formula Change Impact, Document Intelligence, Customer Economics, Access & Governance, Data Trust, Decision Grain, Margin Reconciliation, Model Intelligence

Interactive features that are actually wired up (not decorative): period-window chips and hover tooltips on
Executive Command Center's trend chart, region filters on Plant/Supply Chain/Customer pages, "Show workings" /
"Open <entity>" drill-down on every agent insight card, and live sliders on Margin What-If (calibrated to
reconcile exactly with the true baseline margin at zero delta).

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
