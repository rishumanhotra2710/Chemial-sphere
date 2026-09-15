"""
ChemicalSphere(TM) - Decision Intelligence Layer
Synthetic data simulator (batch-spine star schema)

Mirrors the Retail Decision Intelligence Layer pattern:
  dimensions -> facts -> KPI layer -> agent rule layer -> outcome tracker

Seeded anomalies (deliberate, so every agent has a story to tell):
  1. SUP-07  : supplier OTIF collapse + lead-time drift   -> Supplier Risk Agent
  2. PLT-03  : OEE / throughput bottleneck                -> Production Optimization Agent
  3. FRM-09  : margin leakage via RM cost variance        -> Formula Intelligence Agent + CFO Agent
  4. BATCH   : Q-cluster of QC failures -> CAPA recurrence -> Compliance Agent
  5. INV     : slow-moving shelf-life risk at PLT-05      -> Inventory Intelligence Agent

Output: data.js  (window.CS_DATA)  +  CSV extracts for OTBI / modelling
"""

import json
import os
import numpy as np
import pandas as pd

RNG = np.random.default_rng(20260915)
OUT = os.path.dirname(os.path.abspath(__file__))
CSV_DIR = os.path.join(OUT, "csv")
os.makedirs(CSV_DIR, exist_ok=True)

# ----------------------------------------------------------------------------
# CONFIG - scale of the simulation (change these to resize the demo)
# ----------------------------------------------------------------------------
MONTHS          = 24          # history depth -> enables YoY + outcome tracking
BASELINE_MONTHS = 18          # months 1-18 = pre-ChemicalSphere baseline
BATCHES_PER_MONTH = 220
END_PERIOD = pd.Period("2026-09", freq="M")
PERIODS = pd.period_range(end=END_PERIOD, periods=MONTHS, freq="M")

# ----------------------------------------------------------------------------
# 1. DIMENSIONS
# ----------------------------------------------------------------------------
plants = pd.DataFrame([
    ("PLT-01", "Rotterdam Works",   "EMEA",   "Netherlands", 1.00, 0.86),
    ("PLT-02", "Houston Complex",   "AMER",   "USA",         1.25, 0.84),
    ("PLT-03", "Jurong Island",     "APAC",   "Singapore",   0.90, 0.71),   # bottleneck
    ("PLT-04", "Ludwigshafen Site", "EMEA",   "Germany",     1.10, 0.88),
    ("PLT-05", "Camacari Unit",     "LATAM",  "Brazil",      0.75, 0.80),   # shelf-life risk
    ("PLT-06", "Dahej Plant",       "APAC",   "India",       0.95, 0.83),
], columns=["plant_id", "plant_name", "region", "country", "capacity_factor", "base_oee"])

suppliers = pd.DataFrame([
    ("SUP-01", "Nordic Petrochem",   "EMEA",  "Low",      0.96, 12),
    ("SUP-02", "Gulf Feedstocks",    "AMER",  "Low",      0.94, 18),
    ("SUP-03", "Shandong Additives", "APAC",  "Medium",   0.89, 34),
    ("SUP-04", "Rhine Solvents",     "EMEA",  "Low",      0.95, 10),
    ("SUP-05", "Andes Minerals",     "LATAM", "Medium",   0.88, 26),
    ("SUP-06", "Pacific Catalysts",  "APAC",  "Medium",   0.91, 29),
    ("SUP-07", "Caspian Intermed",   "EMEA",  "High",     0.93, 22),   # degrades
    ("SUP-08", "Bharat Speciality",  "APAC",  "Low",      0.93, 20),
    ("SUP-09", "Lone Star Polymers", "AMER",  "Low",      0.95, 14),
    ("SUP-10", "Atlas Pigments",     "EMEA",  "Medium",   0.90, 24),
], columns=["supplier_id", "supplier_name", "region", "geo_risk", "base_otif", "base_lead_days"])

raw_materials = pd.DataFrame([
    ("RM-01", "Ethylene",            "Feedstock",  820,  "Flammable"),
    ("RM-02", "Propylene",           "Feedstock",  790,  "Flammable"),
    ("RM-03", "Benzene",             "Feedstock",  960,  "Carcinogen"),
    ("RM-04", "Caustic Soda",        "Base",       410,  "Corrosive"),
    ("RM-05", "Sulphuric Acid",      "Acid",       180,  "Corrosive"),
    ("RM-06", "Titanium Dioxide",    "Pigment",   3100,  "Irritant"),
    ("RM-07", "Platinum Catalyst",   "Catalyst", 28500,  "Oxidiser"),
    ("RM-08", "Toluene",             "Solvent",    720,  "Flammable"),
    ("RM-09", "Acetone",             "Solvent",    640,  "Flammable"),
    ("RM-10", "Phenol",              "Intermed",  1180,  "Toxic"),
    ("RM-11", "Epoxy Resin Base",    "Intermed",  2250,  "Irritant"),
    ("RM-12", "Silica Filler",       "Filler",     260,  "Inert"),
    ("RM-13", "Chlorine",            "Halogen",    340,  "Toxic Gas"),
    ("RM-14", "Ammonia",             "Base",       380,  "Toxic Gas"),
    ("RM-15", "Butadiene",           "Feedstock",  880,  "Flammable"),
    ("RM-16", "Methanol",            "Solvent",    430,  "Flammable"),
    ("RM-17", "Stabiliser Blend",    "Additive",  1650,  "Irritant"),
    ("RM-18", "Antioxidant AO-7",    "Additive",  2400,  "Irritant"),
    ("RM-19", "Urea",                "Base",       290,  "Inert"),
    ("RM-20", "Specialty Surfactant","Additive",  1950,  "Irritant"),
], columns=["material_id", "material_name", "material_class", "base_cost_per_tonne", "hazard_class"])

# formula = recipe; margin_grade drives the seeded margin story
formulas = pd.DataFrame([
    ("FRM-01", "PolyBond 200",     "Polymers",     0.94, 1.00),
    ("FRM-02", "PolyBond 400HD",   "Polymers",     0.92, 1.00),
    ("FRM-03", "SolvClear X",      "Solvents",     0.96, 1.00),
    ("FRM-04", "AgriNute N40",     "Agrochem",     0.91, 1.00),
    ("FRM-05", "CoatPrime TiO",    "Coatings",     0.89, 1.00),
    ("FRM-06", "EpoxSeal 7",       "Coatings",     0.90, 1.00),
    ("FRM-07", "CatalystPro Pt",   "Catalysts",    0.87, 1.00),
    ("FRM-08", "SurfActa 900",     "Surfactants",  0.93, 1.00),
    ("FRM-09", "SpecialtyBlend Z", "Specialty",    0.82, 0.74),   # margin leak
    ("FRM-10", "AgriNute K25",     "Agrochem",     0.92, 1.00),
    ("FRM-11", "PolyFlex LD",      "Polymers",     0.93, 1.00),
    ("FRM-12", "PureSolve 99",     "Solvents",     0.95, 1.00),
], columns=["formula_id", "formula_name", "product_family", "target_yield", "margin_grade"])

products = formulas.assign(
    product_id=lambda d: d.formula_id.str.replace("FRM", "PRD"),
    product_name=lambda d: d.formula_name,
    price_per_tonne=[1760, 1995, 1330, 1185, 3010, 3380, 36500, 2310, 2620, 1235, 1665, 1440],
)[["product_id", "product_name", "formula_id", "product_family", "price_per_tonne"]]
# high-value products are made in small batches - keeps revenue mix realistic
products["batch_scale"] = (2200 / products.price_per_tonne).clip(0.05, 1.6).round(3)
# explicit target margin per formula; FRM-09 is the deliberate margin leak
products["target_margin"] = [0.41,0.39,0.43,0.37,0.40,0.42,0.44,0.38,0.255,0.36,0.40,0.42]

customers = pd.DataFrame([
    (f"CUS-{i:02d}", n, r, s) for i, (n, r, s) in enumerate([
        ("Bayerische Coatings", "EMEA", "Coatings"),
        ("Midwest AgriCorp", "AMER", "Agriculture"),
        ("Shenzhen Electronics", "APAC", "Electronics"),
        ("TotalPack Plastics", "EMEA", "Packaging"),
        ("Rio Agro Insumos", "LATAM", "Agriculture"),
        ("Detroit AutoParts", "AMER", "Automotive"),
        ("Tata Polymers", "APAC", "Polymers"),
        ("Nordic Paints AS", "EMEA", "Coatings"),
        ("Gulf Industrial", "AMER", "Industrial"),
        ("Osaka Chemicals KK", "APAC", "Distribution"),
        ("Iberia Solventes", "EMEA", "Distribution"),
        ("Andina Pinturas", "LATAM", "Coatings"),
        ("Great Lakes Auto", "AMER", "Automotive"),
        ("Pune Speciality", "APAC", "Specialty"),
        ("Benelux Traders", "EMEA", "Distribution"),
    ], start=1)
], columns=["customer_id", "customer_name", "region", "segment"])

carriers = pd.DataFrame([
    ("CAR-01", "GlobalTank Logistics", "Bulk Liquid", 0.94),
    ("CAR-02", "EuroHaz Transport",    "Hazmat Road", 0.91),
    ("CAR-03", "OceanChem Lines",      "Ocean Bulk",  0.88),
    ("CAR-04", "RailChem Freight",     "Rail",        0.93),
    ("CAR-05", "AirExpress Spec",      "Air",         0.96),
], columns=["carrier_id", "carrier_name", "mode", "base_otif"])

# recipe bridge: formula -> ingredients (the BOM)
recipe_rows = []
for f in formulas.itertuples():
    n_ing = int(RNG.integers(3, 6))
    picks = RNG.choice(raw_materials.material_id.values, size=n_ing, replace=False)
    props = RNG.dirichlet(np.ones(n_ing) * 3)
    for m, p in zip(picks, props):
        recipe_rows.append((f.formula_id, m, round(float(p), 4)))
recipe = pd.DataFrame(recipe_rows, columns=["formula_id", "material_id", "proportion"])

# ----------------------------------------------------------------------------
# 2. FACTS - batch spine (production -> QC -> cost -> shipment -> revenue)
# ----------------------------------------------------------------------------
def commodity_index(i):
    """Commodity price cycle + shock in months 13-17."""
    base = 1 + 0.06 * np.sin(i / 3.2)
    if 12 <= i <= 16:   shock = 0.11
    elif i > 16:        shock = 0.11 * max(0.0, 1 - (i - 16) / 9)   # slow decay
    else:               shock = 0.0
    return base + shock

batch_rows = []
bno = 0
for i, per in enumerate(PERIODS):
    live = i >= BASELINE_MONTHS                     # ChemicalSphere active
    uplift = 0.0 if not live else min(0.032, 0.010 * (i - BASELINE_MONTHS + 1))
    ci = commodity_index(i)

    for _ in range(BATCHES_PER_MONTH):
        bno += 1
        pl = plants.sample(1, random_state=int(RNG.integers(1e9))).iloc[0]
        fm = formulas.sample(1, random_state=int(RNG.integers(1e9))).iloc[0]

        # --- OEE / yield ------------------------------------------------
        oee = pl.base_oee + RNG.normal(0, 0.035)
        if pl.plant_id == "PLT-03":                         # ANOMALY 2
            oee -= 0.055 + 0.004 * max(0, i - 8)
        oee += uplift * 0.9
        oee = float(np.clip(oee, 0.45, 0.97))

        yld = fm.target_yield + RNG.normal(0, 0.028) + uplift * 2.1
        if pl.plant_id == "PLT-03":
            yld -= 0.035
        yld = float(np.clip(yld, 0.55, 0.995))

        pr0 = products[products.formula_id == fm.formula_id].iloc[0]
        planned = float(RNG.uniform(18, 60) * pl.capacity_factor * pr0.batch_scale)
        actual = planned * yld

        # --- QC ---------------------------------------------------------
        p_fail = 0.045 + (0.05 if pl.plant_id == "PLT-03" else 0) \
                       + (0.06 if fm.formula_id == "FRM-09" else 0)
        if 9 <= i <= 14 and fm.product_family in ("Agrochem", "Specialty"):
            p_fail += 0.09                                  # ANOMALY 4 cluster
        p_fail = max(0.022, p_fail - uplift * 0.32)
        qc_fail = bool(RNG.random() < p_fail)

        # --- cost: anchored to price x target margin, then perturbed ----
        unit_cost = pr0.price_per_tonne * (1 - pr0.target_margin)
        rm_cost_t = unit_cost * 0.70 * ci                   # raw material share
        if fm.formula_id == "FRM-09":                       # ANOMALY 3
            rm_cost_t *= 1.13
        conv_cost_t = unit_cost * 0.28 * (1.9 - oee) / 1.05  # conversion share
        cost = (rm_cost_t + conv_cost_t) * planned * float(RNG.uniform(0.97, 1.03))

        # --- revenue ----------------------------------------------------
        pr = pr0
        sold = 0.0 if qc_fail else actual
        revenue = sold * pr.price_per_tonne * float(RNG.uniform(0.94, 1.04))

        batch_rows.append((
            f"BAT-{bno:06d}", str(per), i, pl.plant_id, pl.region, fm.formula_id,
            pr.product_id, fm.product_family, round(oee, 4), round(yld, 4),
            round(planned, 2), round(actual, 2), round(sold, 2), int(qc_fail),
            round(rm_cost_t, 2), round(cost, 2), round(revenue, 2), int(live),
        ))

batches = pd.DataFrame(batch_rows, columns=[
    "batch_id", "period", "period_idx", "plant_id", "region", "formula_id",
    "product_id", "product_family", "oee", "yield_pct", "planned_qty_t",
    "actual_qty_t", "sold_qty_t", "qc_failed", "rm_cost_per_t", "total_cost",
    "revenue", "cs_active"])
batches["gross_margin"] = batches.revenue - batches.total_cost

# --- CAPA (recurrence tracked for Compliance Agent) -------------------------
fails = batches[batches.qc_failed == 1]
capa = fails.sample(frac=0.62, random_state=7).copy()
capa["capa_id"] = [f"CAPA-{n:05d}" for n in range(1, len(capa) + 1)]
capa["root_cause"] = RNG.choice(
    ["Raw material variance", "Equipment calibration", "Operator deviation",
     "Process parameter drift", "Contamination", "Documentation gap"],
    size=len(capa), p=[.26, .19, .14, .21, .11, .09])
capa["recurring"] = (RNG.random(len(capa)) < np.where(
    capa.product_family.isin(["Agrochem", "Specialty"]), 0.42, 0.17)).astype(int)
capa["closed_on_time"] = (RNG.random(len(capa)) < np.where(capa.cs_active == 1, 0.90, 0.71)).astype(int)
capa = capa[["capa_id", "batch_id", "period", "period_idx", "plant_id", "formula_id",
             "product_family", "root_cause", "recurring", "closed_on_time", "cs_active"]]

# --- supplier deliveries (POs) ---------------------------------------------
po_rows = []
pno = 0
for i, per in enumerate(PERIODS):
    live = i >= BASELINE_MONTHS
    for s in suppliers.itertuples():
        for _ in range(int(RNG.integers(6, 12))):
            pno += 1
            otif_p = s.base_otif
            lead = s.base_lead_days
            if s.supplier_id == "SUP-07":                   # ANOMALY 1
                decay = min(0.30, 0.022 * max(0, i - 6))
                if live:                                     # agent action lands
                    decay *= max(0.45, 1 - 0.18 * (i - BASELINE_MONTHS + 1))
                otif_p -= decay
                lead += 1.6 * max(0, i - 6) * (0.6 if live else 1.0)
            if live:
                otif_p = min(0.985, otif_p + 0.045)
            mat = raw_materials.sample(1, random_state=int(RNG.integers(1e9))).iloc[0]
            qty = float(RNG.uniform(40, 260))
            po_rows.append((
                f"PO-{pno:06d}", str(per), i, s.supplier_id, s.region, s.geo_risk,
                mat.material_id, round(qty, 2),
                int(RNG.random() < otif_p),
                round(float(lead + RNG.normal(0, 3)), 1), float(s.base_lead_days),
                round(qty * mat.base_cost_per_tonne * commodity_index(i), 2),
                int(RNG.random() < (0.03 if s.supplier_id != "SUP-07" else 0.11)),
                int(live)))
pos = pd.DataFrame(po_rows, columns=[
    "po_id", "period", "period_idx", "supplier_id", "region", "geo_risk",
    "material_id", "qty_t", "on_time_in_full", "actual_lead_days",
    "planned_lead_days", "po_value", "quality_reject", "cs_active"])
pos["lead_time_variance"] = pos.actual_lead_days - pos.planned_lead_days

# --- shipments --------------------------------------------------------------
ship_rows = []
sno = 0
for b in batches[batches.sold_qty_t > 0].sample(frac=0.55, random_state=11).itertuples():
    sno += 1
    car = carriers.sample(1, random_state=int(RNG.integers(1e9))).iloc[0]
    cus = customers.sample(1, random_state=int(RNG.integers(1e9))).iloc[0]
    otif_p = car.base_otif + (0.03 if b.cs_active else 0)
    freight = b.sold_qty_t * float(RNG.uniform(58, 145)) * (1.25 if car.mode == "Air" else 1.0)
    ship_rows.append((
        f"SHP-{sno:06d}", b.period, b.period_idx, b.batch_id, b.plant_id,
        car.carrier_id, car.mode, cus.customer_id, cus.region,
        round(b.sold_qty_t, 2), int(RNG.random() < otif_p), round(freight, 2),
        int(RNG.random() < (0.05 if car.mode in ("Ocean Bulk", "Hazmat Road") else 0.02)),
        b.cs_active))
shipments = pd.DataFrame(ship_rows, columns=[
    "shipment_id", "period", "period_idx", "batch_id", "plant_id", "carrier_id",
    "mode", "customer_id", "customer_region", "qty_t", "on_time_in_full",
    "freight_cost", "disruption_flag", "cs_active"])

# --- inventory snapshots ----------------------------------------------------
inv_rows = []
for i, per in enumerate(PERIODS):
    live = i >= BASELINE_MONTHS
    for pl in plants.itertuples():
        for pr in products.itertuples():
            base = float(RNG.uniform(120, 640)) * pl.capacity_factor
            if pl.plant_id == "PLT-05":                     # ANOMALY 5
                base *= 1.55
            if live:
                base *= (1 - min(0.145, 0.048 * (i - BASELINE_MONTHS + 1)))
            age = float(RNG.uniform(10, 190)) * (1.4 if pl.plant_id == "PLT-05" else 1.0)
            inv_rows.append((
                str(per), i, pl.plant_id, pr.product_id, round(base, 2),
                round(base * pr.price_per_tonne * 0.62, 2), round(age, 1),
                int(age > 150), int(live)))
inventory = pd.DataFrame(inv_rows, columns=[
    "period", "period_idx", "plant_id", "product_id", "qty_on_hand_t",
    "inventory_value", "age_days", "shelf_life_risk", "cs_active"])

# ----------------------------------------------------------------------------
# 3. KPI LAYER - explicit definitions (the gap the deck left open)
# ----------------------------------------------------------------------------
KPI_DEFS = {
    "OEE":                    "mean(batch OEE) - availability x performance x quality, batch-weighted",
    "Yield %":                "sum(actual_qty_t) / sum(planned_qty_t)",
    "Batch Success Rate":     "1 - (failed batches / total batches)",
    "Throughput":             "sum(actual_qty_t) per period",
    "Supplier OTIF":          "sum(on_time_in_full) / count(PO lines)",
    "Lead Time Variance":     "mean(actual_lead_days - planned_lead_days)",
    "Supplier Risk Score":    "0-100 composite = 40%(1-OTIF) + 30%(norm lead variance) + 20%(quality reject rate) + 10%(geo risk)",
    "Formula Yield":          "mean(yield_pct) by formula",
    "Product Margin %":       "(revenue - total_cost) / revenue by product",
    "RM Cost Variance":       "(actual rm_cost_per_t / baseline rm_cost_per_t) - 1",
    "CAPA Effectiveness":     "1 - (recurring CAPA / total CAPA)",
    "Batch Rejection Rate":   "failed batches / total batches",
    "Audit Compliance Score": "0-100 = 50%(CAPA closed on time) + 30%(CAPA effectiveness) + 20%(1 - rejection rate)",
    "Recall Readiness":       "0-100 = % of sold volume with unbroken batch->shipment->customer genealogy",
    "Freight Cost per Tonne": "sum(freight_cost) / sum(qty_t)",
    "Logistics OTIF":         "sum(on_time_in_full) / count(shipments)",
    "Logistics Risk Score":   "0-100 composite = 55%(1-OTIF) + 45%(disruption rate)",
    "Inventory Turns":        "annualised COGS / average inventory value",
    "Working Capital Days":   "inventory value / (COGS/365)",
    "Cost per Batch":         "sum(total_cost) / count(batches)",
    "Gross Margin %":         "(revenue - total_cost) / revenue",
}

def norm(x, lo, hi):
    return float(np.clip((x - lo) / (hi - lo), 0, 1))

GEO = {"Low": 0.15, "Medium": 0.5, "High": 0.9}

def kpi_block(bdf, pdf, sdf, idf, cdf):
    cogs = bdf.total_cost.sum()
    inv_avg = idf.groupby("period").inventory_value.sum().mean()
    traced = sdf.qty_t.sum() / max(bdf.sold_qty_t.sum(), 1)
    return {
        "oee": bdf.oee.mean(),
        "yield_pct": bdf.actual_qty_t.sum() / bdf.planned_qty_t.sum(),
        "batch_success": 1 - bdf.qc_failed.mean(),
        "throughput": bdf.actual_qty_t.sum(),
        "cost_per_batch": bdf.total_cost.sum() / len(bdf),
        "gross_margin_pct": (bdf.revenue.sum() - bdf.total_cost.sum()) / max(bdf.revenue.sum(), 1),
        "revenue": bdf.revenue.sum(),
        "supplier_otif": pdf.on_time_in_full.mean(),
        "lead_time_var": pdf.lead_time_variance.mean(),
        "logistics_otif": sdf.on_time_in_full.mean(),
        "freight_per_t": sdf.freight_cost.sum() / max(sdf.qty_t.sum(), 1),
        "logistics_risk": 100 * (0.55 * (1 - sdf.on_time_in_full.mean()) + 0.45 * sdf.disruption_flag.mean()),
        "capa_effectiveness": 1 - cdf.recurring.mean() if len(cdf) else 1.0,
        "rejection_rate": bdf.qc_failed.mean(),
        "audit_score": 100 * (0.5 * (cdf.closed_on_time.mean() if len(cdf) else 1)
                              + 0.3 * (1 - (cdf.recurring.mean() if len(cdf) else 0))
                              + 0.2 * (1 - bdf.qc_failed.mean())),
        "recall_readiness": 100 * min(1.0, traced + 0.42),
        "inventory_value": inv_avg,
        "inventory_turns": cogs / max(inv_avg, 1) * (12 / max(bdf.period.nunique(), 1)),
        "working_capital_days": inv_avg / max(cogs / (30.4 * bdf.period.nunique()), 1),
        "shelf_life_risk_pct": idf.shelf_life_risk.mean(),
    }

def slice_all(pidx_from=None, pidx_to=None):
    f = lambda d: d[(d.period_idx >= (pidx_from if pidx_from is not None else -1)) &
                    (d.period_idx <= (pidx_to if pidx_to is not None else 999))]
    return kpi_block(f(batches), f(pos), f(shipments), f(inventory), f(capa))

current = slice_all(MONTHS - 3, MONTHS - 1)           # latest quarter
prior = slice_all(MONTHS - 6, MONTHS - 4)             # prior quarter
baseline = slice_all(0, BASELINE_MONTHS - 1)          # pre-ChemicalSphere
live = slice_all(BASELINE_MONTHS, MONTHS - 1)         # post-ChemicalSphere

# monthly trend series
trend = []
for i, per in enumerate(PERIODS):
    k = slice_all(i, i)
    trend.append({"period": str(per), "idx": i, "cs_active": int(i >= BASELINE_MONTHS),
                  "oee": round(k["oee"], 4), "yield": round(k["yield_pct"], 4),
                  "margin": round(k["gross_margin_pct"], 4),
                  "otif": round(k["supplier_otif"], 4),
                  "rejection": round(k["rejection_rate"], 4),
                  "inventory": round(k["inventory_value"], 0),
                  "throughput": round(k["throughput"], 0)})

# ----------------------------------------------------------------------------
# 4. ENTITY SCORECARDS
# ----------------------------------------------------------------------------
sup = pos[pos.period_idx >= MONTHS - 6].groupby("supplier_id").agg(
    otif=("on_time_in_full", "mean"), ltv=("lead_time_variance", "mean"),
    rej=("quality_reject", "mean"), value=("po_value", "sum")).reset_index()
sup = sup.merge(suppliers[["supplier_id", "supplier_name", "geo_risk", "region"]], on="supplier_id")
sup["risk_score"] = [round(100 * (0.40 * (1 - r.otif) + 0.30 * norm(r.ltv, 0, 25)
                                 + 0.20 * r.rej + 0.10 * GEO[r.geo_risk]), 1)
                     for r in sup.itertuples()]
sup = sup.sort_values("risk_score", ascending=False)

plant_sc = batches[batches.period_idx >= MONTHS - 6].groupby("plant_id").agg(
    oee=("oee", "mean"), yld=("yield_pct", "mean"), rej=("qc_failed", "mean"),
    tput=("actual_qty_t", "sum"), margin=("gross_margin", "sum"),
    cost=("total_cost", "sum"), rev=("revenue", "sum")).reset_index()
plant_sc = plant_sc.merge(plants[["plant_id", "plant_name", "region"]], on="plant_id")
plant_sc["margin_pct"] = plant_sc.margin / plant_sc.rev
plant_sc = plant_sc.sort_values("oee")

form_sc = batches[batches.period_idx >= MONTHS - 6].groupby(["formula_id", "product_family"]).agg(
    yld=("yield_pct", "mean"), rmc=("rm_cost_per_t", "mean"), rev=("revenue", "sum"),
    cost=("total_cost", "sum"), rej=("qc_failed", "mean"), vol=("actual_qty_t", "sum")).reset_index()
form_sc = form_sc.merge(formulas[["formula_id", "formula_name"]], on="formula_id")
form_sc["margin_pct"] = (form_sc.rev - form_sc.cost) / form_sc.rev
base_rmc = batches[batches.period_idx < 6].groupby("formula_id").rm_cost_per_t.mean()
form_sc["rm_var"] = form_sc.formula_id.map(base_rmc)
form_sc["rm_var"] = form_sc.rmc / form_sc.rm_var - 1
form_sc = form_sc.sort_values("margin_pct")

inv_sc = inventory[inventory.period_idx == MONTHS - 1].groupby("plant_id").agg(
    value=("inventory_value", "sum"), risk=("shelf_life_risk", "mean"),
    age=("age_days", "mean")).reset_index().merge(plants[["plant_id", "plant_name"]], on="plant_id")
inv_sc = inv_sc.sort_values("value", ascending=False)

# ----------------------------------------------------------------------------
# 5. AGENT RULE LAYER - thresholds -> recommendations (the "what to do next")
# ----------------------------------------------------------------------------
THRESHOLDS = {
    "oee_floor": 0.78, "yield_floor": 0.88, "otif_floor": 0.90,
    "risk_ceiling": 28.0, "margin_floor": 0.12, "rm_var_ceiling": 0.14,
    "rejection_ceiling": 0.07, "capa_recur_ceiling": 0.34, "shelf_risk_ceiling": 0.30,
}

agents = []

def add(agent, sev, entity, signal, finding, action, impact, domain):
    agents.append({"agent": agent, "severity": sev, "entity": entity, "signal": signal,
                   "finding": finding, "action": action, "impact": impact, "domain": domain})

# Production Optimization Agent
for r in plant_sc.itertuples():
    if r.oee < THRESHOLDS["oee_floor"]:
        gap = (THRESHOLDS["oee_floor"] - r.oee)
        add("Production Optimization Agent", "Critical" if r.oee < 0.72 else "High",
            f"{r.plant_name} ({r.plant_id})", f"OEE {r.oee:.1%} vs floor {THRESHOLDS['oee_floor']:.0%}",
            f"Sustained OEE shortfall with yield at {r.yld:.1%} and rejection at {r.rej:.1%}.",
            f"Rebalance ~{gap*100:.0f}% of {r.plant_id} volume to PLT-04 / PLT-02; trigger asset reliability review on the constraint unit.",
            f"+{gap*r.tput:,.0f} t recoverable throughput per quarter", "Manufacturing")

# Formula Intelligence Agent
for r in form_sc.itertuples():
    if r.margin_pct < THRESHOLDS["margin_floor"] or r.rm_var > THRESHOLDS["rm_var_ceiling"]:
        add("Formula Intelligence Agent", "Critical" if r.margin_pct < 0.12 else "High",
            f"{r.formula_name} ({r.formula_id})",
            f"Margin {r.margin_pct:.1%} | RM cost variance {r.rm_var:+.1%}",
            f"Recipe economics deteriorating; yield {r.yld:.1%} against a {r.product_family} portfolio norm.",
            "Run substitution scenario on the two highest-cost ingredients; re-qualify alternate grade and reprice contract tier.",
            f"${(THRESHOLDS['margin_floor']-r.margin_pct)*r.rev:,.0f} annualised margin recovery at current volume",
            "Formula")

# Supplier Risk Agent
for r in sup.itertuples():
    if r.risk_score > THRESHOLDS["risk_ceiling"] or r.otif < THRESHOLDS["otif_floor"]:
        add("Supplier Risk Agent", "Critical" if r.risk_score > 40 else "High",
            f"{r.supplier_name} ({r.supplier_id})",
            f"Risk score {r.risk_score:.0f}/100 | OTIF {r.otif:.1%} | lead variance {r.ltv:+.1f} d",
            f"{r.geo_risk} geopolitical exposure compounding delivery deterioration across {r.region}.",
            "Dual-source top 3 materials; shift 35% of spend to a qualified alternate and raise safety stock one cycle.",
            f"${r.value*0.35:,.0f} spend de-risked; exposure window cut by ~{r.ltv:.0f} days", "Supply Chain")

# Compliance Agent
capa_recent = capa[capa.period_idx >= MONTHS - 6]
for fam, g in capa_recent.groupby("product_family"):
    if g.recurring.mean() > THRESHOLDS["capa_recur_ceiling"]:
        top_cause = g.root_cause.mode()[0]
        add("Compliance Agent", "Critical" if g.recurring.mean() > 0.38 else "High",
            f"{fam} product line",
            f"CAPA recurrence {g.recurring.mean():.1%} | {len(g)} open investigations",
            f"Dominant root cause: {top_cause}. Recurrence indicates ineffective corrective action.",
            "Escalate to a line-level CAPA effectiveness review; pre-stage recall simulation and refresh GHS/REACH dossiers for affected batches.",
            f"{len(g)} batches brought to audit-ready traceability", "Quality")

# Inventory Intelligence Agent
for r in inv_sc.itertuples():
    if r.risk > THRESHOLDS["shelf_risk_ceiling"]:
        add("Inventory Intelligence Agent", "High", f"{r.plant_name} ({r.plant_id})",
            f"Shelf-life risk {r.risk:.1%} | avg age {r.age:.0f} d | ${r.value:,.0f} held",
            "Slow-moving stock ageing past the safe-resale window at this node.",
            "Reposition to nearest demand region, convert to lower-grade blend, or throttle replenishment for two cycles.",
            f"${r.value*0.14:,.0f} working capital released", "Financial")

# CFO Agent
mgap = THRESHOLDS["margin_floor"] - current["gross_margin_pct"]
add("CFO Agent", "High" if mgap > 0 else "Medium", "Enterprise portfolio",
    f"Gross margin {current['gross_margin_pct']:.1%} | inventory turns {current['inventory_turns']:.1f} | WC {current['working_capital_days']:.0f} d",
    "Commodity index shock is transmitting into cost per batch faster than price realisation.",
    "Rationalise the bottom-quartile formula set, pull forward inventory reduction on the two highest-value nodes, and reprice indexed contracts.",
    f"${current['inventory_value']*0.12:,.0f} working capital + margin protection", "Financial")

sev_rank = {"Critical": 0, "High": 1, "Medium": 2}
agents.sort(key=lambda a: sev_rank[a["severity"]])

# ----------------------------------------------------------------------------
# 6. OUTCOME TRACKER - baseline vs ChemicalSphere-active
# ----------------------------------------------------------------------------
def delta(k, inv=False):
    b, l = baseline[k], live[k]
    d = (l - b) / abs(b) if b else 0
    return {"baseline": b, "live": l, "delta_pct": -d if inv else d}

outcomes = [
    {"label": "Inventory carrying value", "target": "10-15% reduction", "unit": "$", **delta("inventory_value", inv=True)},
    {"label": "Plant yield", "target": "5-10% improvement", "unit": "%", **delta("yield_pct")},
    {"label": "Supplier OTIF", "target": "20-30% faster decisions", "unit": "%", **delta("supplier_otif")},
    {"label": "Batch rejection rate", "target": "Reduced batch failures", "unit": "%", **delta("rejection_rate", inv=True)},
    {"label": "Audit compliance score", "target": "Improved readiness", "unit": "pts", **delta("audit_score")},
    {"label": "Working capital days", "target": "Better WC performance", "unit": "days", **delta("working_capital_days", inv=True)},
    {"label": "Gross margin", "target": "Margin protection", "unit": "%", **delta("gross_margin_pct")},
    {"label": "Inventory turns", "target": "Higher velocity", "unit": "x", **delta("inventory_turns")},
]

# knowledge-graph traversal sample (batch genealogy for the recall demo)
demo_batch = batches[(batches.qc_failed == 1) & (batches.formula_id == "FRM-09")].iloc[0]
demo_ship = shipments[shipments.batch_id == demo_batch.batch_id]
genealogy = {
    "batch_id": demo_batch.batch_id,
    "plant": plants.set_index("plant_id").loc[demo_batch.plant_id, "plant_name"],
    "formula": formulas.set_index("formula_id").loc[demo_batch.formula_id, "formula_name"],
    "materials": recipe[recipe.formula_id == demo_batch.formula_id]
                 .merge(raw_materials, on="material_id")[["material_name", "proportion", "hazard_class"]]
                 .to_dict("records"),
    "suppliers": suppliers.sample(3, random_state=3)[["supplier_id", "supplier_name", "geo_risk"]].to_dict("records"),
    "shipments": demo_ship[["shipment_id", "customer_id", "qty_t", "mode"]].head(4).to_dict("records"),
    "customers": customers.sample(3, random_state=5)[["customer_id", "customer_name", "region"]].to_dict("records"),
}

# ----------------------------------------------------------------------------
# 7. EXPORT
# ----------------------------------------------------------------------------
for name, df in [("dim_plant", plants), ("dim_supplier", suppliers), ("dim_raw_material", raw_materials),
                 ("dim_formula", formulas), ("dim_product", products), ("dim_customer", customers),
                 ("dim_carrier", carriers), ("bridge_recipe", recipe), ("fact_batch", batches),
                 ("fact_capa", capa), ("fact_purchase_order", pos), ("fact_shipment", shipments),
                 ("fact_inventory", inventory)]:
    df.to_csv(os.path.join(CSV_DIR, f"{name}.csv"), index=False)

payload = {
    "meta": {
        "generated": "2026-09-15", "months": MONTHS, "baseline_months": BASELINE_MONTHS,
        "batches": len(batches), "pos": len(pos), "shipments": len(shipments),
        "capa": len(capa), "plants": len(plants), "formulas": len(formulas),
        "suppliers": len(suppliers), "periods": [str(p) for p in PERIODS],
    },
    "kpi_defs": KPI_DEFS,
    "thresholds": THRESHOLDS,
    "current": current, "prior": prior, "baseline": baseline, "live": live,
    "trend": trend,
    "suppliers": sup.round(4).to_dict("records"),
    "plants": plant_sc.round(4).to_dict("records"),
    "formulas": form_sc.round(4).to_dict("records"),
    "inventory": inv_sc.round(4).to_dict("records"),
    "agents": agents,
    "outcomes": outcomes,
    "genealogy": genealogy,
}

with open(os.path.join(OUT, "data.js"), "w") as f:
    f.write("/* ChemicalSphere(TM) simulated decision layer - generated by generate_chemicalsphere_data.py */\n")
    f.write("window.CS_DATA = " + json.dumps(payload, indent=1, default=float) + ";\n")

print(f"batches={len(batches):,}  pos={len(pos):,}  shipments={len(shipments):,}  capa={len(capa):,}")
print(f"agent recommendations={len(agents)}")
print("wrote data.js and csv/*.csv")
