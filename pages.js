/* ChemicalSphere(TM) - per-page render logic. Depends on globals defined in index.html's inline script. */
const PAGE_STATE = {};
function bar(v,max,col){return `<div class="bar"><i style="width:${Math.min(100,v/max*100)}%;background:${col}"></i></div>`;}
function kpiFlat(label,valueStr,sparkSeries){
  return `<div class="kpi2"><div class="kpi2-label">${label}</div>
    <div class="kpi2-row"><div class="kpi2-value">${valueStr}</div></div>
    <div class="kpi2-spark">${spark(sparkSeries,'#0B1E3D')}</div></div>`;
}
function windowKpis(months){
  const t=D.trend, n=t.length;
  const cur=t.slice(n-months), pri=t.slice(Math.max(0,n-2*months), n-months);
  function agg(win){
    const revenue=win.reduce((a,b)=>a+b.revenue,0);
    const batches=win.reduce((a,b)=>a+b.batches,0);
    const cost=win.reduce((a,b)=>a+b.revenue*b.prime_cost_pct,0);
    return {revenue, batches, avg_batch_value: revenue/Math.max(batches,1), prime_cost_pct: cost/Math.max(revenue,1), margin_pct: 1-cost/Math.max(revenue,1)};
  }
  return {cur:agg(cur), pri:agg(pri.length?pri:cur)};
}
function reldelta(a,b){ return b? (a-b)/Math.abs(b) : 0; }

/* ================= OVERVIEW ================= */
function renderOverview(){
  const el=document.getElementById('page-overview');
  const qc=[
    {id:'exec', t:'Executive Command Center', d:'The full estate scorecard: KPIs, agent findings, and revenue decomposition.'},
    {id:'plant', t:'Plant Performance', d:'OEE, yield and rejection by plant.'},
    {id:'formula', t:'Formula & Product Mix', d:'Margin and RM cost variance by recipe.'},
    {id:'supplychain', t:'Supply Chain', d:'Supplier risk ranking and OTIF.'},
    {id:'demand', t:'Demand Forecasting', d:'3-month throughput and revenue forecast.'},
    {id:'modelintel', t:'Model Intelligence', d:'What each agent watches, and why it fires.'},
  ];
  el.innerHTML=`
    <div class="sec"><div class="tiles2">
      ${kpiTile2('Net Revenue (Latest Qtr)', usd(D.current.revenue), reldelta(D.current.revenue,D.prior.revenue), false, trendSlice(8,'revenue'))}
      ${kpiTile2('Batches (Latest Qtr)', num(D.current.batches), reldelta(D.current.batches,D.prior.batches), false, trendSlice(8,'batches'))}
      ${kpiFlat('Active Plants', D.meta.plants+'', trendSlice(8,'throughput'))}
      ${kpiFlat('Open Recommendations', D.agents.length+'', trendSlice(8,'rejection'))}
    </div></div>
    <div class="sec"><div class="sechead"><h2>Where to go next</h2></div>
      <div class="qgrid">${qc.map(q=>`<div class="qcard" onclick="navigate('${q.id}')"><div class="qt">${q.t}</div><div class="qd">${q.d}</div><div class="qa">Open →</div></div>`).join('')}</div>
    </div>
    <div class="sec"><div class="sechead"><h2>Outcome Tracker</h2><p>Baseline (months 1–18) vs ChemicalSphere™ active (months 19–24)</p></div>
      <div class="ogrid">${D.outcomes.map(o=>{
        const f=v=>o.unit==='$'?usd(v):o.unit==='%'?pct(v):o.unit==='days'?v.toFixed(0)+' d':o.unit==='x'?v.toFixed(1)+'x':v.toFixed(0);
        const g=o.delta_pct>0;
        return `<div class="out"><div class="ol">${o.label}</div><div class="ot">${o.target}</div>
          <div class="ov"><span class="b">${f(o.baseline)}</span><span class="a">${f(o.live)}</span>
          <span class="d ${g?'up':'dn'}">${g?'▲':'▼'} ${(Math.abs(o.delta_pct)*100).toFixed(1)}%</span></div></div>`;
      }).join('')}</div>
    </div>`;
  document.getElementById('scope-overview').innerHTML=`<b>Scope:</b> All ${D.meta.plants} plants, ${D.meta.formulas} formulas, ${D.meta.suppliers} suppliers &middot; Generated ${D.meta.generated}`;
}

/* ================= EXECUTIVE COMMAND CENTER ================= */
function renderExec(months){
  months = months || PAGE_STATE.exec || 6;
  PAGE_STATE.exec = months;
  const {cur,pri} = windowKpis(months);
  const el=document.getElementById('page-exec');
  const sp = k => trendSlice(8,k);
  el.innerHTML=`
    <div class="sec"><div class="tiles2">
      ${kpiTile2('Net Revenue', usd(cur.revenue), reldelta(cur.revenue,pri.revenue), false, sp('revenue'))}
      ${kpiTile2('Batches (Transactions)', num(cur.batches), reldelta(cur.batches,pri.batches), false, sp('batches'))}
      ${kpiTile2('Avg Batch Value', usd(cur.avg_batch_value), reldelta(cur.avg_batch_value,pri.avg_batch_value), false, sp('avg_batch_value'))}
      ${kpiTile2('Prime Cost %', pct(cur.prime_cost_pct), reldelta(cur.prime_cost_pct,pri.prime_cost_pct), true, sp('prime_cost_pct'))}
      ${kpiTile2('Gross Margin %', pct(cur.margin_pct), reldelta(cur.margin_pct,pri.margin_pct), false, sp('margin'))}
    </div></div>
    <div class="sec"><div class="sechead"><h2>What The Platform Noticed</h2><p>${D.agents.length} open recommendations, ranked by severity · rule layer fired against ${num(D.meta.batches)} batches</p></div>
      ${agentGrid(D.agents)}
    </div>
    <div class="two">
      <div class="card" id="exec-decomp"></div>
      <div class="card"><h3 class="ct">Net revenue, with 3-month moving average<span class="note">Monthly batch-spine revenue</span></h3><div id="exec-combo"></div></div>
    </div>`;
  decompWidget(document.getElementById('exec-decomp'),
    'Is growth coming from volume or price?',
    'Revenue movement decomposed against the prior period of equal length. Volume effect plus price effect reconciles exactly to the revenue change.',
    [{v:pct(D.revenue_decomposition.revenue_growth_pct), l:'Revenue growth'},
     {v:pct(D.revenue_decomposition.volume_effect_pct), l:'Volume effect'},
     {v:pct(D.revenue_decomposition.price_effect_pct), l:'Price/mix effect'}],
    [{label:'Volume', dollars:D.revenue_decomposition.volume_effect_dollars},
     {label:'Price/Mix', dollars:D.revenue_decomposition.price_effect_dollars}],
    Math.abs(D.revenue_decomposition.volume_effect_dollars) > Math.abs(D.revenue_decomposition.price_effect_dollars)
      ? 'Volume is carrying the movement rather than price, which is the healthier of the two.'
      : 'Price/mix is carrying the movement rather than volume — worth checking whether it holds if a competitor reprices.');
  const periods = D.trend.slice(-months).map(t=>t.period);
  const bars = D.trend.slice(-months).map(t=>t.revenue);
  const ma = movingAvg(bars,3);
  comboChart(document.getElementById('exec-combo'), periods, bars, ma, {fmt:usd, barLabel:'Monthly revenue', maLabel:'3-month average', lineColor:'#0B1E3D'});
  document.getElementById('scope-exec').innerHTML=`<b>Scope:</b> All ${D.meta.plants} plants &middot; <b>Window:</b> trailing ${months} months vs the ${months} months before &middot; Compared against the prior period of equal length`;
}
function setMonths(pageId, months, btnEl){
  document.querySelectorAll('#filters-'+pageId+' .chip').forEach(c=>c.classList.remove('on'));
  btnEl.classList.add('on');
  if(pageId==='exec') renderExec(months);
}
function setRegion(pageId, region){
  if(pageId==='plant') renderPlant(region);
  if(pageId==='supplychain') renderSupplyChain(region);
  if(pageId==='customer') renderCustomer(region);
}

/* ================= PLANT PERFORMANCE ================= */
function renderPlant(region){
  region = region || PAGE_STATE.plant_region || 'ALL';
  PAGE_STATE.plant_region = region;
  const rows = D.plants.filter(p=>region==='ALL'||p.region===region);
  const el=document.getElementById('page-plant');
  const avg=k=>rows.reduce((a,b)=>a+b[k],0)/Math.max(rows.length,1);
  const maxTput=Math.max(...rows.map(r=>r.tput),1);
  el.innerHTML=`
    <div class="sec"><div class="tiles2">
      ${kpiFlat('Estate OEE', pct(avg('oee')), trendSlice(8,'oee'))}
      ${kpiFlat('Estate Yield', pct(avg('yld')), trendSlice(8,'yield'))}
      ${kpiFlat('Estate Rejection', pct(avg('rej')), trendSlice(8,'rejection'))}
      ${kpiFlat('Estate Margin', pct(avg('margin_pct')), trendSlice(8,'margin'))}
    </div></div>
    <div class="sec"><div class="sechead"><h2>Findings for Manufacturing</h2></div>
      ${agentGrid(D.agents.filter(a=>a.domain==='Manufacturing'))}
    </div>
    <div class="card"><h3 class="ct">Plant scorecard<span class="note">Latest rolling 6 months · sorted worst OEE first · rows in red breach the OEE floor</span></h3>
    <table><tr><th>Plant</th><th>Region</th><th class="n">OEE</th><th class="n">Yield</th><th class="n">Reject</th><th class="n">Margin</th><th>Throughput</th></tr>
    ${rows.map(p=>`<tr data-code="${p.plant_id}" class="${p.oee<D.thresholds.oee_floor?'alert':''}">
      <td><b>${p.plant_name}</b><br><small style="color:#8A93A3">${p.plant_id}</small></td>
      <td>${p.region}</td><td class="n">${pct(p.oee)}</td><td class="n">${pct(p.yld)}</td>
      <td class="n">${pct(p.rej)}</td><td class="n">${pct(p.margin_pct)}</td>
      <td>${bar(p.tput,maxTput,'#770107')}</td></tr>`).join('')}
    </table></div>`;
  document.getElementById('scope-plant').innerHTML=`<b>Scope:</b> ${rows.length} of ${D.meta.plants} plants${region!=='ALL'?' in '+region:''} &middot; latest rolling 6 months`;
}

/* ================= FORMULA & PRODUCT MIX ================= */
function renderFormula(){
  const el=document.getElementById('page-formula');
  const maxRev=Math.max(...D.family_mix.map(f=>f.revenue),1);
  el.innerHTML=`
    <div class="sec"><div class="sechead"><h2>Findings for Formula</h2></div>
      ${agentGrid(D.agents.filter(a=>a.domain==='Formula'))}
    </div>
    <div class="two">
      <div class="card"><h3 class="ct">Revenue by product family<span class="note">Latest rolling 6 months</span></h3>
        ${D.family_mix.map(f=>`<div class="pareto-row"><div class="pn">${f.product_family}</div>
          <div class="decomp-track"><div class="decomp-fill" style="width:${Math.max(2,f.revenue/maxRev*100)}%;background:#3C6B2A">${usd(f.revenue)}</div></div>
          <div class="pv">${pct0(f.revenue_share)}</div></div>`).join('')}
      </div>
      <div class="card"><h3 class="ct">Formula profitability<span class="note">Rows in red breach margin floor or RM variance ceiling</span></h3>
      <table><tr><th>Formula</th><th>Family</th><th class="n">Yield</th><th class="n">RM Var</th><th class="n">Margin</th></tr>
      ${D.formulas.map(f=>`<tr data-code="${f.formula_id}" class="${f.margin_pct<D.thresholds.margin_floor||f.rm_var>D.thresholds.rm_var_ceiling?'alert':''}">
        <td><b>${f.formula_name}</b><br><small style="color:#8A93A3">${f.formula_id}</small></td>
        <td>${f.product_family}</td><td class="n">${pct(f.yld)}</td>
        <td class="n" style="color:${f.rm_var>0.15?'#B3261E':'#5B5B5B'}">${f.rm_var>0?'+':''}${pct(f.rm_var)}</td>
        <td class="n"><b>${pct(f.margin_pct)}</b></td></tr>`).join('')}
      </table></div>
    </div>`;
  document.getElementById('scope-formula').innerHTML=`<b>Scope:</b> ${D.meta.formulas} formulas across ${D.family_mix.length} product families &middot; latest rolling 6 months`;
}

/* ================= SUPPLY CHAIN ================= */
function renderSupplyChain(region){
  region = region || PAGE_STATE.supplychain_region || 'ALL';
  PAGE_STATE.supplychain_region = region;
  const rows = D.suppliers.filter(s=>region==='ALL'||s.region===region);
  const el=document.getElementById('page-supplychain');
  el.innerHTML=`
    <div class="sec"><div class="tiles2">
      ${kpiTile2('Supplier OTIF', pct(D.current.supplier_otif), reldelta(D.current.supplier_otif,D.prior.supplier_otif), false, trendSlice(8,'otif'))}
      ${kpiTile2('Logistics OTIF', pct(D.current.logistics_otif), reldelta(D.current.logistics_otif,D.prior.logistics_otif), false, trendSlice(8,'otif'))}
      ${kpiTile2('Lead Time Variance', D.current.lead_time_var.toFixed(1)+' d', reldelta(D.current.lead_time_var,D.prior.lead_time_var), true, trendSlice(8,'otif'))}
    </div></div>
    <div class="sec"><div class="sechead"><h2>Findings for Supply Chain</h2></div>
      ${agentGrid(D.agents.filter(a=>a.domain==='Supply Chain'))}
    </div>
    <div class="card"><h3 class="ct">Supplier risk ranking<span class="note">Latest rolling 6 months · rows in red exceed the risk ceiling</span></h3>
    <table><tr><th>Supplier</th><th>Geo</th><th class="n">OTIF</th><th class="n">Lead Var</th><th class="n">Risk</th><th></th></tr>
    ${rows.map(s=>`<tr data-code="${s.supplier_id}" class="${s.risk_score>D.thresholds.risk_ceiling?'alert':''}">
      <td><b>${s.supplier_name}</b><br><small style="color:#8A93A3">${s.supplier_id}</small></td>
      <td><span class="pill" style="background:${GEO_COL[s.geo_risk]}">${s.geo_risk}</span></td>
      <td class="n">${pct0(s.otif)}</td><td class="n">${s.ltv>0?'+':''}${s.ltv.toFixed(1)}d</td>
      <td class="n"><b>${s.risk_score.toFixed(0)}</b></td>
      <td>${bar(s.risk_score,60,s.risk_score>28?'#B3261E':'#D9531E')}</td></tr>`).join('')}
    </table></div>`;
  document.getElementById('scope-supplychain').innerHTML=`<b>Scope:</b> ${rows.length} of ${D.meta.suppliers} suppliers${region!=='ALL'?' in '+region:''} &middot; latest rolling 6 months`;
}

/* ================= INVENTORY & WASTE ================= */
function renderInventory(){
  const el=document.getElementById('page-inventory');
  const maxVal=Math.max(...D.inventory.map(i=>i.value),1);
  el.innerHTML=`
    <div class="sec"><div class="tiles2">
      ${kpiTile2('Inventory Value', usd(D.current.inventory_value), reldelta(D.current.inventory_value,D.prior.inventory_value), true, trendSlice(8,'inventory'))}
      ${kpiTile2('Inventory Turns', D.current.inventory_turns.toFixed(1)+'x', reldelta(D.current.inventory_turns,D.prior.inventory_turns), false, trendSlice(8,'inventory'))}
      ${kpiTile2('Working Capital Days', D.current.working_capital_days.toFixed(0)+' d', reldelta(D.current.working_capital_days,D.prior.working_capital_days), true, trendSlice(8,'inventory'))}
    </div></div>
    <div class="sec"><div class="sechead"><h2>Findings for Inventory</h2></div>
      ${agentGrid(D.agents.filter(a=>a.agent==='Inventory Intelligence Agent'))}
    </div>
    <div class="card"><h3 class="ct">Inventory &amp; shelf-life exposure<span class="note">Rows in red exceed the shelf-life risk ceiling</span></h3>
    <table><tr><th>Plant</th><th class="n">Value</th><th class="n">Avg Age</th><th class="n">Shelf Risk</th><th class="n">Value at Risk</th><th></th></tr>
    ${D.inventory.map(i=>`<tr data-code="${i.plant_id}" class="${i.risk>D.thresholds.shelf_risk_ceiling?'alert':''}">
      <td><b>${i.plant_name}</b></td><td class="n">${usd(i.value)}</td>
      <td class="n">${i.age.toFixed(0)} d</td><td class="n">${pct0(i.risk)}</td>
      <td class="n">${usd(i.value_at_risk)}</td>
      <td>${bar(i.value,maxVal,'#1E7A73')}</td></tr>`).join('')}
    </table></div>`;
  document.getElementById('scope-inventory').innerHTML=`<b>Scope:</b> ${D.meta.plants} plants &middot; latest month snapshot`;
}

/* ================= CUSTOMER & REVENUE ================= */
function renderCustomer(region){
  region = region || PAGE_STATE.customer_region || 'ALL';
  PAGE_STATE.customer_region = region;
  const total = D.customers.length;
  const rows = D.customers.filter(c=>region==='ALL'||c.region===region).sort((a,b)=>b.revenue-a.revenue);
  const el=document.getElementById('page-customer');
  const maxRev=Math.max(...rows.map(r=>r.revenue),1);
  el.innerHTML=`
    <div class="sec"><div class="tiles2">
      ${kpiFlat('Customer Revenue (6mo)', usd(rows.reduce((a,b)=>a+b.revenue,0)), trendSlice(8,'revenue'))}
      ${kpiFlat('Top-5 Concentration', pct0(D.customer_concentration), trendSlice(8,'revenue'))}
      ${kpiFlat('Customers', rows.length+'', trendSlice(8,'revenue'))}
    </div></div>
    <div class="card"><h3 class="ct">Customer scorecard<span class="note">Latest rolling 6 months · sorted by revenue</span></h3>
    <table><tr><th>Customer</th><th>Region</th><th>Segment</th><th>Top Family</th><th class="n">Revenue</th><th class="n">OTIF</th><th></th></tr>
    ${rows.map(c=>`<tr data-code="${c.customer_id}">
      <td><b>${c.customer_name}</b><br><small style="color:#8A93A3">${c.customer_id}</small></td>
      <td>${c.region}</td><td>${c.segment}</td><td>${c.product_family||'—'}</td>
      <td class="n">${usd(c.revenue)}</td><td class="n">${pct0(c.otif)}</td>
      <td>${bar(c.revenue,maxRev,'#5B2A86')}</td></tr>`).join('')}
    </table></div>`;
  document.getElementById('scope-customer').innerHTML=`<b>Scope:</b> ${rows.length} of ${total} customers${region!=='ALL'?' in '+region:''} &middot; latest rolling 6 months`;
}

/* ================= DEMAND FORECASTING ================= */
function renderDemand(){
  const el=document.getElementById('page-demand');
  const hist=D.demand_forecast.history;
  const periods=hist.map(h=>h.period);
  el.innerHTML=`
    <div class="two">
      <div class="card"><h3 class="ct">Throughput — history &amp; 3-month forecast<span class="note">Linear trend extrapolation on the trailing 12 months</span></h3><div id="demand-tput"></div>
        <table style="margin-top:10px"><tr><th>Period</th><th class="n">Forecast</th><th class="n">Low</th><th class="n">High</th></tr>
        ${D.demand_forecast.future_periods.map((p,i)=>`<tr><td>${p}</td><td class="n">${num(D.demand_forecast.throughput[i].forecast)}</td><td class="n">${num(D.demand_forecast.throughput[i].low)}</td><td class="n">${num(D.demand_forecast.throughput[i].high)}</td></tr>`).join('')}
        </table></div>
      <div class="card"><h3 class="ct">Revenue — history &amp; 3-month forecast</h3><div id="demand-rev"></div>
        <table style="margin-top:10px"><tr><th>Period</th><th class="n">Forecast</th><th class="n">Low</th><th class="n">High</th></tr>
        ${D.demand_forecast.future_periods.map((p,i)=>`<tr><td>${p}</td><td class="n">${usd(D.demand_forecast.revenue[i].forecast)}</td><td class="n">${usd(D.demand_forecast.revenue[i].low)}</td><td class="n">${usd(D.demand_forecast.revenue[i].high)}</td></tr>`).join('')}
        </table></div>
    </div>`;
  const tput=hist.map(h=>h.throughput);
  comboChart(document.getElementById('demand-tput'), periods, tput, movingAvg(tput,3), {fmt:v=>num(v), barLabel:'Throughput (t)', maLabel:'3-month avg'});
  const rev=hist.map(h=>h.revenue);
  comboChart(document.getElementById('demand-rev'), periods, rev, movingAvg(rev,3), {fmt:usd, barLabel:'Revenue', maLabel:'3-month avg'});
  document.getElementById('scope-demand').innerHTML=`<b>Scope:</b> Trailing 12 months history &middot; 3-month forward forecast`;
}

/* ================= PRODUCTION SCHEDULING OPTIMISER (Labour Optimiser) ================= */
function renderLabour(){
  const el=document.getElementById('page-labour');
  const rows=D.plants.map(p=>({...p, gap: Math.max(0, D.thresholds.oee_floor-p.oee)})).sort((a,b)=>b.gap-a.gap);
  const maxGap=Math.max(...rows.map(r=>r.gap),0.01);
  el.innerHTML=`
    <div class="sec"><div class="sechead"><h2>Findings</h2></div>
      ${agentGrid(D.agents.filter(a=>a.agent==='Production Optimization Agent'))}
    </div>
    <div class="card"><h3 class="ct">OEE gap to floor, by plant<span class="note">Floor = ${pct0(D.thresholds.oee_floor)} &middot; recoverable throughput assumes the gap is closed</span></h3>
    ${rows.map(r=>`<div class="pareto-row"><div class="pn">${r.plant_name}</div>
      <div class="decomp-track"><div class="decomp-fill" style="width:${Math.max(2,r.gap/maxGap*100)}%;background:${r.gap>0?'#D9531E':'#1E7A4A'}">${r.gap>0?'-'+pct0(r.gap):'at/above floor'}</div></div>
      <div class="pv">${num(r.tput)} t</div></div>`).join('')}
    </div>`;
  document.getElementById('scope-labour').innerHTML=`<b>Scope:</b> ${D.meta.plants} plants &middot; latest rolling 6 months`;
}

/* ================= WASTE & SHELF-LIFE RISK ================= */
function renderWaste(){
  const el=document.getElementById('page-waste');
  const periods=D.shelf_life_forecast.history.map(h=>h.period);
  const risk=D.shelf_life_forecast.history.map(h=>h.risk);
  const sorted=[...D.inventory].sort((a,b)=>b.value_at_risk-a.value_at_risk);
  const maxVar=Math.max(...sorted.map(r=>r.value_at_risk),1);
  el.innerHTML=`
    <div class="two">
      <div class="card"><h3 class="ct">Shelf-life risk share — history &amp; forecast</h3><div id="waste-combo"></div>
        <table style="margin-top:10px"><tr><th>Period</th><th class="n">Forecast</th><th class="n">Low</th><th class="n">High</th></tr>
        ${D.shelf_life_forecast.future_periods.map((p,i)=>`<tr><td>${p}</td><td class="n">${pct0(D.shelf_life_forecast.risk[i].forecast)}</td><td class="n">${pct0(D.shelf_life_forecast.risk[i].low)}</td><td class="n">${pct0(D.shelf_life_forecast.risk[i].high)}</td></tr>`).join('')}
        </table></div>
      <div class="card"><h3 class="ct">Value at risk by plant<span class="note">Inventory value × shelf-life risk share</span></h3>
      <table><tr><th>Plant</th><th class="n">Value</th><th class="n">Risk</th><th class="n">Value at Risk</th><th></th></tr>
      ${sorted.map(r=>`<tr><td><b>${r.plant_name}</b></td><td class="n">${usd(r.value)}</td><td class="n">${pct0(r.risk)}</td><td class="n">${usd(r.value_at_risk)}</td><td>${bar(r.value_at_risk,maxVar,'#8A6D1F')}</td></tr>`).join('')}
      </table></div>
    </div>`;
  comboChart(document.getElementById('waste-combo'), periods, risk, movingAvg(risk,3), {fmt:pct0, barLabel:'Shelf-life risk share', maLabel:'3-month avg'});
  document.getElementById('scope-waste').innerHTML=`<b>Scope:</b> ${D.meta.plants} plants &middot; trailing 12 months history &middot; 3-month forward forecast`;
}

/* ================= MARGIN WHAT-IF ================= */
function renderMarginWhatif(){
  const el=document.getElementById('page-marginwhatif');
  el.innerHTML=`
    <div class="card"><div class="whatif-grid">
      <div class="whatif-controls">
        <label>Formula</label>
        <select id="wf-formula">${D.margin_whatif.map(f=>`<option value="${f.formula_id}">${f.formula_name} (${f.formula_id})</option>`).join('')}</select>
        <label>Raw-material cost change <span class="rangeval" id="wf-rmval">0%</span></label>
        <input type="range" id="wf-rm" min="-30" max="30" value="0" step="1">
        <label>Yield change <span class="rangeval" id="wf-ylval">0%</span></label>
        <input type="range" id="wf-yl" min="-15" max="15" value="0" step="1">
      </div>
      <div>
        <div class="whatif-result">
          <div class="box"><div class="v" id="wf-margin">—</div><div class="l">New margin %</div></div>
          <div class="box"><div class="v" id="wf-delta">—</div><div class="l">Margin pts vs baseline</div></div>
          <div class="box"><div class="v" id="wf-dollar">—</div><div class="l">Annualised $ impact</div></div>
        </div>
        <div id="wf-bars"></div>
      </div>
    </div></div>`;
  const sel=document.getElementById('wf-formula'), rm=document.getElementById('wf-rm'), yl=document.getElementById('wf-yl');
  function recompute(){
    const f=D.margin_whatif.find(x=>x.formula_id===sel.value);
    const rmDelta=+rm.value/100, ylDelta=+yl.value/100;
    document.getElementById('wf-rmval').textContent=(rmDelta>=0?'+':'')+(rmDelta*100).toFixed(0)+'%';
    document.getElementById('wf-ylval').textContent=(ylDelta>=0?'+':'')+(ylDelta*100).toFixed(0)+'%';
    // Calibrate the per-tonne cost model to reconcile exactly with the true baseline
    // margin at zero deltas, then flex the calibrated model by the slider deltas.
    const baselineCostPerSoldT = f.price*(1-f.margin_pct_baseline);
    const modeledBaselineCost = (f.rm_cost_per_t+f.conv_cost_per_t)/f.yield_pct;
    const k = baselineCostPerSoldT/modeledBaselineCost;
    const newYield=Math.max(0.2, f.yield_pct*(1+ylDelta));
    const costPerSoldT=k*(f.rm_cost_per_t*(1+rmDelta)+f.conv_cost_per_t)/newYield;
    const newMargin=(f.price-costPerSoldT)/f.price;
    const deltaPts=newMargin-f.margin_pct_baseline;
    document.getElementById('wf-margin').textContent=pct(newMargin);
    const deltaEl=document.getElementById('wf-delta');
    deltaEl.textContent=(deltaPts>=0?'+':'')+(deltaPts*100).toFixed(1)+' pts';
    deltaEl.style.color=deltaPts>=0?'#1E7A4A':'#B3261E';
    document.getElementById('wf-dollar').textContent=usd(deltaPts*f.revenue);
    const maxb=Math.max(Math.abs(f.margin_pct_baseline), Math.abs(newMargin), 0.01);
    document.getElementById('wf-bars').innerHTML=`
      <div class="decomp-barrow"><div class="bl">Baseline</div><div class="decomp-track"><div class="decomp-fill" style="width:${Math.max(2,Math.abs(f.margin_pct_baseline)/maxb*100)}%;background:#8A93A3">${pct(f.margin_pct_baseline)}</div></div></div>
      <div class="decomp-barrow"><div class="bl">What-if</div><div class="decomp-track"><div class="decomp-fill" style="width:${Math.max(2,Math.abs(newMargin)/maxb*100)}%;background:${newMargin>=f.margin_pct_baseline?'#3C6B2A':'#B3261E'}">${pct(newMargin)}</div></div></div>`;
  }
  sel.onchange=recompute; rm.oninput=recompute; yl.oninput=recompute;
  sel.value='FRM-09'; recompute();
  document.getElementById('scope-marginwhatif').innerHTML=`<b>Scope:</b> ${D.margin_whatif.length} formulas &middot; baseline = latest rolling 6 months`;
}

/* ================= SUPPLY DEPENDENCY ================= */
function renderSupplyDep(){
  const el=document.getElementById('page-supplydep');
  const top=D.supplier_concentration[0];
  el.innerHTML=`
    <div class="sec"><div class="tiles2">
      ${kpiFlat('Most Concentrated Material', top.material_name, [top.hhi*0.95,top.hhi])}
      ${kpiFlat('HHI (that material)', num(top.hhi), [top.hhi*0.95,top.hhi])}
      ${kpiFlat('Top Supplier Share', pct0(top.top_supplier_share), [top.top_supplier_share*0.95,top.top_supplier_share])}
    </div></div>
    <div class="card"><h3 class="ct">If ${top.top_supplier_name} failed tomorrow</h3>
      <p style="font-size:12.5px;color:var(--grey);line-height:1.6">${top.top_supplier_name} carries ${pct0(top.top_supplier_share)} of estate spend on ${top.material_name}
      (${usd(top.total_spend*top.top_supplier_share)} of ${usd(top.total_spend)} total, trailing 12 months), across ${top.supplier_count} qualified suppliers for that material.
      An HHI of ${num(top.hhi)} puts this ${top.concentrated?'above the concentration threshold — a single-supplier disruption would force allocation, not just re-sourcing.':'inside a broadly diversified band.'}</p>
    </div>
    <div class="card"><h3 class="ct">Raw-material supplier concentration<span class="note">Trailing 12 months &middot; rows in red exceed the concentration threshold</span></h3>
    <table><tr><th>Material</th><th class="n">Total Spend</th><th class="n">Suppliers</th><th class="n">HHI</th><th>Top Supplier</th><th class="n">Share</th></tr>
    ${D.supplier_concentration.map(r=>`<tr class="${r.concentrated?'alert':''}">
      <td>${r.material_name}</td><td class="n">${usd(r.total_spend)}</td><td class="n">${r.supplier_count}</td>
      <td class="n">${num(r.hhi)}</td><td>${r.top_supplier_name}</td><td class="n">${pct0(r.top_supplier_share)}</td></tr>`).join('')}
    </table></div>`;
  document.getElementById('scope-supplydep').innerHTML=`<b>Scope:</b> ${D.supplier_concentration.length} raw materials &middot; trailing 12 months of PO spend`;
}

/* ================= FORMULA CHANGE IMPACT (Menu Change Impact) ================= */
function renderMenuImpact(){
  const el=document.getElementById('page-menuimpact');
  const formulaIds=[...new Set(D.recipe_detail.map(r=>r.formula_id))];
  el.innerHTML=`
    <div class="card">
      <label style="font-size:11px;color:var(--grey);text-transform:uppercase;letter-spacing:.5px;font-weight:700">Formula</label>
      <select id="mi-formula" class="selfilter" style="margin:8px 0 16px;display:block;width:280px">
      ${formulaIds.map(id=>{const n=D.recipe_detail.find(r=>r.formula_id===id).formula_name; return `<option value="${id}">${n} (${id})</option>`;}).join('')}
      </select>
      <div id="mi-body"></div>
    </div>`;
  const sel=document.getElementById('mi-formula');
  function render(){
    const rows=D.recipe_detail.filter(r=>r.formula_id===sel.value).sort((a,b)=>b.cost_share-a.cost_share);
    const top=rows[0];
    document.getElementById('mi-body').innerHTML=`
      <p style="font-size:12.5px;color:var(--grey);margin-bottom:14px;line-height:1.6"><b style="color:var(--ink)">${top.material_name}</b> is the highest-leverage ingredient in this
      recipe at ${pct0(top.cost_share)} of raw-material cost — qualifying an alternate grade or supplier for it moves the formula's cost base further than any other single lever.</p>
      ${rows.map(r=>`<div class="pareto-row"><div class="pn">${r.material_name} <span class="badge-hazard">${r.hazard_class}</span></div>
        <div class="decomp-track"><div class="decomp-fill" style="width:${Math.max(2,r.cost_share*100)}%;background:#3C6B2A">${pct0(r.cost_share)}</div></div>
        <div class="pv">${pct0(r.proportion)} of mass</div></div>`).join('')}`;
  }
  sel.onchange=render; render();
  document.getElementById('scope-menuimpact').innerHTML=`<b>Scope:</b> ${formulaIds.length} formulas &middot; BOM cost-share analysis`;
}

/* ================= DOCUMENT INTELLIGENCE ================= */
function renderDocIntel(){
  const el=document.getElementById('page-docintel');
  const closedPct=D.capa_recent.filter(c=>c.closed_on_time).length/D.capa_recent.length;
  const g=D.genealogy;
  el.innerHTML=`
    <div class="sec"><div class="tiles2">
      ${kpiTile2('Recall Readiness', D.current.recall_readiness.toFixed(0)+'/100', reldelta(D.current.recall_readiness,D.prior.recall_readiness), false, trendSlice(8,'rejection'))}
      ${kpiTile2('Audit Compliance', D.current.audit_score.toFixed(0)+'/100', reldelta(D.current.audit_score,D.prior.audit_score), false, trendSlice(8,'rejection'))}
      ${kpiFlat('CAPA Closed On Time (recent)', pct0(closedPct), trendSlice(8,'rejection'))}
    </div></div>
    <div class="card"><h3 class="ct">Batch genealogy — recall simulation path<span class="note">Traversal behind every recall recommendation</span></h3>
      <div class="kg">${['Raw Material','Supplier','Purchase Order','Batch','Formula','Finished Product','Customer','Revenue','Margin','Profitability']
        .map(n=>`<span class="node ${n==='Batch'?'hl':''}">${n}</span>`).join('<span class="arw">→</span>')}</div>
      <div class="three">
        <div class="gcol"><h4>Batch under investigation</h4><div><b>${g.batch_id}</b></div><div>${g.plant}</div><div>Formula: ${g.formula}</div>
          <div><small>QC failed · traced upstream and downstream</small></div></div>
        <div class="gcol"><h4>Ingredients &amp; hazard class</h4>${g.materials.map(m=>`<div>${m.material_name} <small>· ${(m.proportion*100).toFixed(0)}% · ${m.hazard_class}</small></div>`).join('')}</div>
        <div class="gcol"><h4>Suppliers implicated</h4>${g.suppliers.map(s=>`<div>${s.supplier_name} <small>· ${s.geo_risk} risk</small></div>`).join('')}</div>
        <div class="gcol"><h4>Shipments affected</h4>${g.shipments.map(s=>`<div>${s.shipment_id} <small>· ${s.qty_t.toFixed(1)} t · ${s.mode}</small></div>`).join('')}</div>
        <div class="gcol"><h4>Customers in recall scope</h4>${g.customers.map(c=>`<div>${c.customer_name} <small>· ${c.region}</small></div>`).join('')}</div>
        <div class="gcol"><h4>Decision memory</h4><div>Prior similar events: 4</div><div>Recommended play: contain &amp; re-qualify</div><div><small>Vector-search match on CAPA history</small></div></div>
      </div>
    </div>
    <div class="card" style="margin-top:14px"><h3 class="ct">Document / dossier log<span class="note">Most recent 25 CAPA records &middot; closed-on-time is the completeness proxy</span></h3>
    <table><tr><th>CAPA</th><th>Period</th><th>Plant</th><th>Formula</th><th>Root Cause</th><th>Recurring</th><th>Closed On Time</th></tr>
    ${D.capa_recent.map(c=>`<tr class="${!c.closed_on_time?'alert':''}"><td>${c.capa_id}</td><td>${c.period}</td><td>${c.plant_name}</td>
      <td>${c.formula_id}</td><td>${c.root_cause}</td><td>${c.recurring?'Yes':'No'}</td><td>${c.closed_on_time?'Yes':'No'}</td></tr>`).join('')}
    </table></div>`;
  document.getElementById('scope-docintel').innerHTML=`<b>Scope:</b> ${D.capa_recent.length} most recent CAPA documents &middot; ${D.meta.capa} total on file`;
}

/* ================= CUSTOMER ECONOMICS (Loyalty Economics) ================= */
function renderLoyalty(){
  const el=document.getElementById('page-loyalty');
  const rows=[...D.customers].sort((a,b)=>b.revenue-a.revenue);
  const total=rows.reduce((a,b)=>a+b.revenue,0);
  let cum=0;
  const maxRev=rows[0].revenue;
  el.innerHTML=`
    <div class="sec"><div class="tiles2">
      ${kpiFlat('Top-5 Revenue Concentration', pct0(D.customer_concentration), [D.customer_concentration*0.95,D.customer_concentration])}
      ${kpiFlat('Total Customers', rows.length+'', [rows.length,rows.length])}
      ${kpiFlat('Total Revenue (6mo)', usd(total), trendSlice(8,'revenue'))}
    </div></div>
    <div class="card"><h3 class="ct">Revenue concentration — Pareto view<span class="note">Sorted by revenue, cumulative share on the right</span></h3>
    ${rows.map(c=>{cum+=c.revenue; return `<div class="pareto-row"><div class="pn">${c.customer_name}</div>
      <div class="decomp-track"><div class="decomp-fill" style="width:${Math.max(2,c.revenue/maxRev*100)}%;background:#5B2A86">${usd(c.revenue)}</div></div>
      <div class="pv">cum ${pct0(cum/total)}</div></div>`;}).join('')}
    </div>`;
  document.getElementById('scope-loyalty').innerHTML=`<b>Scope:</b> ${rows.length} customers &middot; latest rolling 6 months`;
}

/* ================= ACCESS & GOVERNANCE ================= */
const PERSONA_META={
  ALL:{label:'All Domains', domains:['Manufacturing','Supply Chain','Formula','Quality','Logistics','Financial']},
  CEO:{label:'CEO', domains:['Financial','Formula','Manufacturing']},
  COO:{label:'COO', domains:['Manufacturing','Logistics','Quality']},
  CFO:{label:'CFO', domains:['Financial','Formula']},
  CSCO:{label:'Chief Supply Chain Officer', domains:['Supply Chain','Logistics','Financial']},
  CCO:{label:'Chief Compliance Officer', domains:['Quality','Manufacturing']},
};
function renderAccess(){
  const el=document.getElementById('page-access');
  const allDomains=['Manufacturing','Supply Chain','Formula','Quality','Logistics','Financial'];
  el.innerHTML=`
    <div class="card"><h3 class="ct">Role-based domain visibility<span class="note">Which personas see which decision domains across the platform</span></h3>
    <table><tr><th>Role</th>${allDomains.map(d=>`<th>${d}</th>`).join('')}<th class="n">Recommendations Visible</th></tr>
    ${Object.entries(PERSONA_META).map(([k,p])=>{
      const visCount=D.agents.filter(a=>p.domains.includes(a.domain)).length;
      return `<tr><td><b>${p.label}</b></td>${allDomains.map(d=>`<td style="text-align:center">${p.domains.includes(d)?'✓':'—'}</td>`).join('')}<td class="n">${visCount} / ${D.agents.length}</td></tr>`;
    }).join('')}
    </table></div>`;
  document.getElementById('scope-access').innerHTML=`<b>Scope:</b> ${Object.keys(PERSONA_META).length} roles &middot; ${allDomains.length} decision domains`;
}

/* ================= DATA TRUST ================= */
function renderTrust(){
  const el=document.getElementById('page-trust');
  const totalRows=D.data_lineage.reduce((a,b)=>a+b.rows,0);
  el.innerHTML=`
    <div class="sec"><div class="tiles2">
      ${kpiFlat('Source Tables', D.data_lineage.length+'', [D.data_lineage.length,D.data_lineage.length])}
      ${kpiFlat('Total Rows Modelled', num(totalRows), [totalRows,totalRows])}
      ${kpiFlat('Generated', D.meta.generated, [1,1])}
    </div></div>
    <div class="card"><h3 class="ct">Data lineage<span class="note">Fact/dimension tables and the Oracle source system each maps to</span></h3>
    <table><tr><th>Table</th><th class="n">Rows</th><th>Source System</th><th>Grain</th></tr>
    ${D.data_lineage.map(t=>`<tr><td><code>${t.table}</code></td><td class="n">${num(t.rows)}</td><td>${t.source}</td><td>${t.grain}</td></tr>`).join('')}
    </table></div>`;
  document.getElementById('scope-trust').innerHTML=`<b>Scope:</b> ${D.data_lineage.length} tables underpinning every page in this platform`;
}

/* ================= DECISION GRAIN ================= */
function renderGrain(){
  const el=document.getElementById('page-grain');
  el.innerHTML=`
    <div class="card"><h3 class="ct">Decision audit log<span class="note">Every recommendation the rule layer fired this period, in severity order</span></h3>
    <table><tr><th>Severity</th><th>Domain</th><th>Agent</th><th>Entity</th><th>Signal</th><th>Action</th><th>Impact</th></tr>
    ${D.agents.map(a=>`<tr><td><span class="pill" style="background:${a.severity==='Critical'?'#B3261E':a.severity==='High'?'#D9531E':'#8A6D1F'}">${a.severity}</span></td>
      <td>${a.domain}</td><td>${a.agent}</td><td>${a.entity}</td><td style="font-family:Consolas,monospace;font-size:11px">${a.signal}</td>
      <td style="max-width:220px">${a.action}</td><td>${a.impact}</td></tr>`).join('')}
    </table></div>`;
  document.getElementById('scope-grain').innerHTML=`<b>Scope:</b> ${D.agents.length} decisions on file for the current period`;
}

/* ================= MARGIN RECONCILIATION ================= */
function renderReconciliation(){
  const el=document.getElementById('page-reconciliation');
  const b=D.margin_bridge;
  const steps=[
    {label:'Baseline margin', v:b.baseline_margin_dollars, isTotal:true},
    {label:'Volume effect', v:b.volume_effect},
    {label:'Price/mix effect', v:b.price_mix_effect},
    {label:'Cost efficiency', v:b.cost_efficiency_effect},
    {label:'Live margin', v:b.live_margin_dollars, isTotal:true},
  ];
  const maxAbs=Math.max(...steps.map(s=>Math.abs(s.v)),1);
  el.innerHTML=`
    <div class="card"><h3 class="ct">Margin bridge: baseline → ChemicalSphere-active<span class="note">Average $ per month &middot; volume + price/mix + cost efficiency reconciles exactly to the change</span></h3>
    ${steps.map(s=>`<div class="decomp-barrow"><div class="bl">${s.label}</div>
      <div class="decomp-track"><div class="decomp-fill" style="width:${Math.max(2,Math.abs(s.v)/maxAbs*100)}%;background:${s.isTotal?'#0B1E3D':(s.v>=0?'#3C6B2A':'#B3261E')}">${usd(s.v)}</div></div></div>`).join('')}
    <div class="decomp-foot">Baseline average margin was ${usd(b.baseline_margin_dollars)}/month; the estate now runs at ${usd(b.live_margin_dollars)}/month —
      a swing of ${usd(b.live_margin_dollars-b.baseline_margin_dollars)}, split across volume, price/mix and underlying cost efficiency.</div>
    </div>`;
  document.getElementById('scope-reconciliation').innerHTML=`<b>Scope:</b> Baseline (months 1–18) vs ChemicalSphere-active (months 19–24), normalised to a monthly rate`;
}

/* ================= MODEL INTELLIGENCE ================= */
function renderModelIntel(){
  const el=document.getElementById('page-modelintel');
  el.innerHTML=`
    <div class="card"><h3 class="ct">Agent rule catalog<span class="note">What each agent watches, and the threshold that fires it</span></h3>
    <table><tr><th>Agent</th><th>Domain</th><th>Watches</th><th>Threshold</th><th>Logic</th></tr>
    ${D.agent_rules.map(r=>{const v=D.thresholds[r.threshold_key]; return `<tr><td><b>${r.agent}</b></td><td>${r.domain}</td><td>${r.watches}</td>
      <td><code>${r.threshold_key} = ${v<1?pct0(v):v}</code></td><td style="color:var(--grey)">${r.logic}</td></tr>`;}).join('')}
    </table></div>
    <div class="card" style="margin-top:14px"><h3 class="ct">KPI definitions<span class="note">Every KPI surfaced anywhere in this platform, defined</span></h3>
    <table><tr><th>KPI</th><th>Definition</th></tr>
    ${Object.entries(D.kpi_defs).map(([k,v])=>`<tr><td><b>${k}</b></td><td style="color:var(--grey)">${v}</td></tr>`).join('')}
    </table></div>`;
  document.getElementById('scope-modelintel').innerHTML=`<b>Scope:</b> ${D.agent_rules.length} agents &middot; ${Object.keys(D.kpi_defs).length} KPI definitions &middot; ${Object.keys(D.thresholds).length} thresholds`;
}

/* ================= BOOTSTRAP: render every page once ================= */
renderOverview(); renderExec(6); renderPlant('ALL'); renderFormula(); renderSupplyChain('ALL');
renderInventory(); renderCustomer('ALL'); renderDemand(); renderLabour(); renderWaste();
renderMarginWhatif(); renderSupplyDep(); renderMenuImpact(); renderDocIntel(); renderLoyalty();
renderAccess(); renderTrust(); renderGrain(); renderReconciliation(); renderModelIntel();
