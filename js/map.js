// ─── Config ───────────────────────────────────────────────────────────────────

const VARIABLES = {
  DC_CAPITA:  { label: "Data centers per million inhabitants", fmt: v => (v * 1e6).toFixed(2) },
  DC_SHARE:   { label: "DC share of national energy (%)",      fmt: v => v.toFixed(2) + "%" },
  HH_PRICES:  { label: "Household electricity price (€/kWh)", fmt: v => "€" + v.toFixed(4) },
  NH_PRICES:  { label: "Non-household price (€/kWh)",         fmt: v => "€" + v.toFixed(4) },
  ICT_GVA:    { label: "ICT Gross Value Added (%)",           fmt: v => v.toFixed(2) + "%" },
  ICT_EMP:    { label: "ICT Employment Share (%)",            fmt: v => v.toFixed(2) + "%" },
  ICT_RnD:    { label: "ICT R&D Spending (%)",                fmt: v => v.toFixed(2) + "%" },
  GDP:        { label: "GDP per capita (€)",                  fmt: v => "€" + Math.round(v).toLocaleString() },
};

const FLAGS = {
  AL:"🇦🇱", AT:"🇦🇹", BE:"🇧🇪", BA:"🇧🇦", BG:"🇧🇬", HR:"🇭🇷", CY:"🇨🇾", CZ:"🇨🇿",
  DK:"🇩🇰", EE:"🇪🇪", FI:"🇫🇮", FR:"🇫🇷", GE:"🇬🇪", DE:"🇩🇪", GR:"🇬🇷", HU:"🇭🇺",
  IS:"🇮🇸", IE:"🇮🇪", IT:"🇮🇹", LV:"🇱🇻", LI:"🇱🇮", LT:"🇱🇹", LU:"🇱🇺", MK:"🇲🇰",
  MT:"🇲🇹", MD:"🇲🇩", NL:"🇳🇱", NO:"🇳🇴", PL:"🇵🇱", PT:"🇵🇹", RO:"🇷🇴", RS:"🇷🇸",
  SK:"🇸🇰", SI:"🇸🇮", ES:"🇪🇸", SE:"🇸🇪", GB:"🇬🇧",
};

const NAME_TO_ISO2 = {
  "Albania":"AL","Austria":"AT","Belgium":"BE","Bosnia and Herzegovina":"BA",
  "Bulgaria":"BG","Croatia":"HR","Cyprus":"CY","Czechia":"CZ","Denmark":"DK",
  "Estonia":"EE","Finland":"FI","France":"FR","Georgia":"GE","Germany":"DE",
  "Greece":"GR","Hungary":"HU","Iceland":"IS","Ireland":"IE","Italy":"IT",
  "Latvia":"LV","Liechtenstein":"LI","Lithuania":"LT","Luxembourg":"LU",
  "Czech Republic":"CZ","Macedonia":"MK","Malta":"MT","Moldova":"MD","Netherlands":"NL","Norway":"NO",
  "Poland":"PL","Portugal":"PT","Romania":"RO","Serbia":"RS","Slovakia":"SK",
  "Slovenia":"SI","Spain":"ES","Sweden":"SE","United Kingdom":"GB",
};

const OUTLIERS = new Set(["Ireland","Netherlands","Denmark","Luxembourg","Liechtenstein","Iceland"]);

// ─── State ────────────────────────────────────────────────────────────────────

let currentVar  = "DC_CAPITA";
let currentView = "map";
let searchTerm  = "";
let pinnedIso   = null;
let rows        = [];
let geo         = null;

// ─── Parse helpers ────────────────────────────────────────────────────────────

function parseNum(str) {
  if (!str || str.toString().trim() === "") return null;
  const parsed = parseFloat(str.toString().trim().replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
}

function normaliseName(raw) {
  return raw.toString().trim()
    .replace("UnitedKingdom", "United Kingdom")
    .replace("Bosnia and Hercegovina", "Bosnia and Herzegovina");
}

// ─── Build rows ───────────────────────────────────────────────────────────────

function buildRows(mainData, ictData) {
  const ictMap = new Map();
  ictData.forEach(row => {
    const name = (row.country || row.COUNTRY || "").toString().trim();
    if (!name) return;
    ictMap.set(name.toLowerCase(), {
      ICT_GVA: parseNum(row.ICT_GVA),
      ICT_EMP: parseNum(row.ICT_EMP),
      ICT_RnD: parseNum(row.ICT_RnD),
    });
  });

  return mainData.map(row => {
    const name = normaliseName(row.COUNTRY || row.country || "");
    const key  = name.toLowerCase();
    const ict  = ictMap.get(key) || { ICT_GVA: null, ICT_EMP: null, ICT_RnD: null };
    return {
      name,
      iso2:      NAME_TO_ISO2[name] || null,
      DC_CAPITA: parseNum(row["DC/CAPITA"]),
      DC_SHARE:  parseNum(row["DC_%_E_CONSUMPTIOM"]),
      HH_PRICES: parseNum(row["HH_PRICES"]),
      NH_PRICES: parseNum(row["NH_PRICES"]),
      ICT_GVA:   ict.ICT_GVA,
      ICT_EMP:   ict.ICT_EMP,
      ICT_RnD:   ict.ICT_RnD,
      GDP:       parseNum(row["GDP"]),
      outlier:   OUTLIERS.has(name),
    };
  }).filter(d => d.iso2);
}

// ─── Load ─────────────────────────────────────────────────────────────────────

Promise.all([
  fetch("data/europe.geojson").then(r => r.json()),
  fetch("data/DATA.json").then(r => r.json()),
  fetch("data/ICT_all.json").then(r => r.json()),
]).then(([geojson, mainData, ictData]) => {
  geo  = geojson.features;
  rows = buildRows(mainData, ictData);
  console.log("ICT countries loaded:", ictData.length);

  console.log("Rows parsed:", rows.length);
  console.log("Sample:", rows.slice(0, 3));

  refresh();
}).catch(err => {
  console.error("Load error:", err);
  document.getElementById("map-container").innerHTML =
    `<p style="padding:1rem;color:red;">Failed to load data: ${err.message}</p>`;
});

// ─── Colour scale (unchanged from original) ───────────────────────────────────

function makeColorScale() {
  const vals   = rows.map(r => r[currentVar]).filter(v => v != null);
  const [mn, mx] = d3.extent(vals);
  const sorted = [...vals].sort((a, b) => a - b);
  const p95    = sorted[Math.floor(sorted.length * 0.95)];
  const colorMax = Math.min(mx, p95);
  return { color: d3.scaleSequential(d3.interpolateOranges).domain([mn, colorMax]), mn, mx };
}

// ─── Stat cards ───────────────────────────────────────────────────────────────

function updateStats() {
  const meta   = VARIABLES[currentVar];
  const valid  = rows.filter(r => r[currentVar] != null);
  const sorted = [...valid].sort((a, b) => b[currentVar] - a[currentVar]);
  if (!sorted.length) return;
  const vals   = valid.map(r => r[currentVar]);
  const mean   = vals.reduce((a, b) => a + b, 0) / vals.length;
  const nOut   = valid.filter(r => r.outlier).length;

  document.getElementById("stat-row").innerHTML = `
    <div class="stat-card">
      <div class="sc-label">Highest</div>
      <div class="sc-val">${meta.fmt(sorted[0][currentVar])}</div>
      <div class="sc-sub">${FLAGS[sorted[0].iso2] || ""} ${sorted[0].name}</div>
    </div>
    <div class="stat-card">
      <div class="sc-label">Lowest</div>
      <div class="sc-val">${meta.fmt(sorted[sorted.length - 1][currentVar])}</div>
      <div class="sc-sub">${FLAGS[sorted[sorted.length-1].iso2] || ""} ${sorted[sorted.length - 1].name}</div>
    </div>
    <div class="stat-card">
      <div class="sc-label">Average</div>
      <div class="sc-val">${meta.fmt(mean)}</div>
      <div class="sc-sub">across ${valid.length} countries</div>
    </div>
    <div class="stat-card">
      <div class="sc-label">Outliers</div>
      <div class="sc-val">${nOut}</div>
      <div class="sc-sub">excluded from OLS regression</div>
    </div>`;
}

// ─── Map ──────────────────────────────────────────────────────────────────────

function drawMap() {
  const meta = VARIABLES[currentVar];
  const svg  = document.getElementById("europe-map");
  const W    = svg.parentElement.clientWidth || 800;
  const H    = Math.round(W * 0.62);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width",  W);
  svg.setAttribute("height", H);
  svg.innerHTML = "";

  const proj = d3.geoMercator().center([10, 53]).scale(W * 0.7).translate([W / 2, H / 2]);
  const path = d3.geoPath().projection(proj);
  // Clip path rendering to the SVG viewport to prevent Russia/Turkey coordinates
  // from overflowing D3's path serialiser (causes "string did not match" error)
  proj.clipExtent([[0, 0], [W, H]]);

  const { color, mn, mx } = makeColorScale();
  const lookup = {};
  const rankMap = {};
  const sorted  = rows.filter(r => r[currentVar] != null).sort((a, b) => b[currentVar] - a[currentVar]);
  sorted.forEach((r, i) => { rankMap[r.iso2] = i + 1; });
  rows.forEach(r => { lookup[r.iso2] = r[currentVar]; });

  d3.select(svg)
    .selectAll("path")
    .data(geo)
    .join("path")
    .attr("d", f => { try { return path(f) || ""; } catch(e) { return ""; } })
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.5)
    .attr("fill", f => {
      const iso = f.properties.ISO2;
      const val = lookup[iso];
      if (val == null) return "#e0ddd6";
      if (searchTerm) {
        const row = rows.find(r => r.iso2 === iso);
        if (row && !row.name.toLowerCase().includes(searchTerm)) return "#eeecea";
      }
      return color(val);
    })
    .attr("stroke-width", f => f.properties.ISO2 === pinnedIso ? 2.5 : 0.5)
    .attr("stroke", f => f.properties.ISO2 === pinnedIso ? "#333" : "#fff")
    .attr("cursor", f => lookup[f.properties.ISO2] != null ? "pointer" : "default")
    .on("mousemove", (event, f) => {
      const iso  = f.properties.ISO2;
      const val  = lookup[iso];
      const name = f.properties.NAME || iso || "Unknown";
      const row  = rows.find(r => r.iso2 === iso);
      const tip  = document.getElementById("map-tooltip");
      tip.style.display = "block";
      tip.style.left = (event.offsetX + 14) + "px";
      tip.style.top  = (event.offsetY - 44) + "px";
      const outlierTag = row?.outlier
        ? ` <span style="font-size:10px;background:#fef3cd;color:#856404;padding:1px 6px;border-radius:8px;font-weight:700">outlier</span>` : "";
      const rankTag = rankMap[iso] ? `<span style="color:#aaa;font-size:10px;margin-left:6px">#${rankMap[iso]} of ${sorted.length}</span>` : "";
      tip.innerHTML = `<strong>${FLAGS[iso] || ""} ${name}</strong>${outlierTag}<br>${val != null ? meta.fmt(val) : "No data"}${rankTag}`;
    })
    .on("mouseleave", () => { document.getElementById("map-tooltip").style.display = "none"; })
    .on("click", (event, f) => {
      const iso = f.properties.ISO2;
      if (!lookup[iso] == null) return;
      const row = rows.find(r => r.iso2 === iso);
      if (!row) return;
      pinnedIso = iso;
      showDetail(row, rankMap[iso], sorted.length);
      drawMap();
    });

  // outlier dots
  const outlierFeatures = geo.filter(f => {
    const row = rows.find(r => r.iso2 === f.properties.ISO2);
    return row?.outlier && row[currentVar] != null;
  });
  d3.select(svg).selectAll("circle.out-dot")
    .data(outlierFeatures)
    .join("circle")
    .attr("class", "out-dot")
    .attr("cx", f => path.centroid(f)[0])
    .attr("cy", f => path.centroid(f)[1])
    .attr("r", 4)
    .attr("fill", "#EF9F27")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .attr("pointer-events", "none");

  drawLegend(color, mn, mx, meta);
}

// ─── Legend (original + minor tweak) ─────────────────────────────────────────

function drawLegend(color, mn, mx, meta) {
  const svg = d3.select("#legend-bar").attr("width", 200).attr("height", 14);
  svg.selectAll("*").remove();
  const grad = svg.append("defs").append("linearGradient").attr("id", "leg-grad");
  d3.range(11).forEach(i => {
    grad.append("stop")
      .attr("offset", `${i * 10}%`)
      .attr("stop-color", color(mn + (i / 10) * (mx - mn)));
  });
  svg.append("rect").attr("width", 200).attr("height", 14).attr("fill", "url(#leg-grad)");
  document.getElementById("legend-min").textContent = meta.fmt(mn);
  document.getElementById("legend-max").textContent = meta.fmt(mx);
}

// ─── Country detail strip ─────────────────────────────────────────────────────

function showDetail(row, rank, total) {
  const meta = VARIABLES[currentVar];
  const val  = row[currentVar];
  if (val == null) return;
  document.getElementById("cd-flag").textContent = FLAGS[row.iso2] || "";
  document.getElementById("cd-name").textContent = row.name;
  document.getElementById("cd-val").textContent  = meta.fmt(val);
  document.getElementById("cd-rank").textContent = `Ranked #${rank} of ${total}`;
  document.getElementById("cd-outlier").style.display = row.outlier ? "inline-block" : "none";
  document.getElementById("country-detail").classList.add("visible");
}

function closeDetail() {
  pinnedIso = null;
  document.getElementById("country-detail").classList.remove("visible");
  drawMap();
}

// ─── Ranking bar view ─────────────────────────────────────────────────────────

function drawBar() {
  const meta   = VARIABLES[currentVar];
  const valid  = rows.filter(r => r[currentVar] != null);
  const sorted = [...valid].sort((a, b) => b[currentVar] - a[currentVar]);
  const filtered = sorted.filter(r => !searchTerm || r.name.toLowerCase().includes(searchTerm));
  const maxVal = filtered[0]?.[currentVar] || 1;
  const minVal = filtered[filtered.length - 1]?.[currentVar] || 0;
  const { color } = makeColorScale();

  document.getElementById("bar-container").innerHTML = filtered.map((r, i) => {
    const rank = sorted.indexOf(r) + 1;
    const pct  = ((r[currentVar] / maxVal) * 100).toFixed(1);
    const col  = color(r[currentVar]);
    const label = r.name.length > 15 ? r.name.slice(0, 14) + "…" : r.name;
    return `<div class="bar-row" onclick="selectFromBar('${r.iso2}')">
      <span class="bar-country">${FLAGS[r.iso2] || ""} ${label}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:${pct}%;background:${col}"></div>
      </div>
      <span class="bar-val">${meta.fmt(r[currentVar])}</span>
      ${r.outlier
        ? '<span class="bar-out-dot" title="IQR outlier — excluded from regression"></span>'
        : '<span style="width:7px;display:inline-block"></span>'}
    </div>`;
  }).join("");
}

function selectFromBar(iso) {
  const row    = rows.find(r => r.iso2 === iso);
  const sorted = rows.filter(r => r[currentVar] != null).sort((a, b) => b[currentVar] - a[currentVar]);
  const rank   = sorted.findIndex(r => r.iso2 === iso) + 1;
  if (row) showDetail(row, rank, sorted.length);
}

// ─── Table (original behaviour preserved) ─────────────────────────────────────

function drawTable() {
  const meta   = VARIABLES[currentVar];
  document.getElementById("table-heading").textContent = meta.label;
  const sorted = [...rows]
    .filter(r => r[currentVar] != null)
    .sort((a, b) => b[currentVar] - a[currentVar]);
  document.getElementById("table-body").innerHTML = sorted.map(r => `
    <tr${r.outlier ? ' style="background:#fffbf2"' : ''}>
      <td>${FLAGS[r.iso2] || ""} ${r.name}</td>
      <td class="num-cell">${meta.fmt(r[currentVar])}</td>
      <td>${r.outlier ? "⚠ Yes" : "—"}</td>
    </tr>`).join("");
}

// ─── View toggle ──────────────────────────────────────────────────────────────

function setView(v) {
  currentView = v;
  document.getElementById("map-panel").style.display = v === "map" ? "block" : "none";
  document.getElementById("bar-panel").style.display = v === "bar" ? "block" : "none";
  document.getElementById("btn-map").classList.toggle("active", v === "map");
  document.getElementById("btn-bar").classList.toggle("active", v === "bar");
  closeDetail();
  if (v === "map") drawMap(); else drawBar();
}

// ─── Refresh (called on any state change) ─────────────────────────────────────

function refresh() {
  updateStats();
  drawTable();
  if (currentView === "map") drawMap(); else drawBar();
}

// ─── Event listeners ──────────────────────────────────────────────────────────

document.getElementById("variable-select").addEventListener("change", e => {
  currentVar = e.target.value;
  pinnedIso  = null;
  document.getElementById("country-detail").classList.remove("visible");
  refresh();
});

document.getElementById("country-search").addEventListener("input", e => {
  searchTerm = e.target.value.toLowerCase().trim();
  if (currentView === "map") drawMap(); else drawBar();
});

window.addEventListener("resize", () => {
  if (currentView === "map") drawMap();
});