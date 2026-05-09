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

const NAME_TO_ISO2 = {
  "Albania":"AL", "Austria":"AT", "Belgium":"BE", "Bosnia and Herzegovina":"BA",
  "Bulgaria":"BG", "Croatia":"HR", "Cyprus":"CY", "Czechia":"CZ", "Denmark":"DK",
  "Estonia":"EE", "Finland":"FI", "France":"FR", "Georgia":"GE", "Germany":"DE",
  "Greece":"GR", "Hungary":"HU", "Iceland":"IS", "Ireland":"IE", "Italy":"IT",
  "Latvia":"LV", "Liechtenstein":"LI", "Lithuania":"LT", "Luxembourg":"LU",
  "Macedonia":"MK", "Malta":"MT", "Moldova":"MD", "Netherlands":"NL", "Norway":"NO",
  "Poland":"PL", "Portugal":"PT", "Romania":"RO", "Serbia":"RS", "Slovakia":"SK",
  "Slovenia":"SI", "Spain":"ES", "Sweden":"SE", "United Kingdom":"GB",
};

const OUTLIERS = new Set(["Ireland", "Netherlands", "Denmark", "Luxembourg", "Liechtenstein", "Iceland"]);

// ─── State ────────────────────────────────────────────────────────────────────

let currentVar = "DC_CAPITA";
let rows = [];
let geo  = null;

// ─── Parse helpers ────────────────────────────────────────────────────────────

function parseNum(str) {
  if (!str || str.toString().trim() === "") return null;
  // Handle both comma and dot as decimal separator
  const parsed = parseFloat(str.toString().trim().replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
}

// Normalise country names to handle "UnitedKingdom" → "United Kingdom" etc.
function normaliseName(raw) {
  return raw.toString().trim()
    .replace("UnitedKingdom", "United Kingdom")
    .replace("Bosnia and Hercegovina", "Bosnia and Herzegovina");
}

// ─── Merge DATA.json + ICT_all.json into rows ─────────────────────────────────

function buildRows(mainData, ictData) {
  // Build ICT lookup keyed by lowercase country name
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
    // DATA.json uses "COUNTRY", "DC/CAPITA", "DC_%_E_CONSUMPTIOM", etc.
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
  }).filter(d => d.iso2); // drop rows with unrecognised country names
}

// ─── Load data, then draw ─────────────────────────────────────────────────────

Promise.all([
  fetch("data/europe.geojson").then(r => r.json()),
  fetch("data/DATA.json").then(r => r.json()),       // ← JSON, not TSV
  fetch("data/ICT_all.json").then(r => r.json()),
]).then(([geojson, mainData, ictData]) => {
  geo  = geojson.features;
  rows = buildRows(mainData, ictData);

  console.log("Rows parsed:", rows.length);
  console.log("Sample:", rows.slice(0, 3));
  console.log("ICT_GVA non-null:", rows.filter(r => r.ICT_GVA != null).length);
  console.log("ICT_EMP non-null:", rows.filter(r => r.ICT_EMP != null).length);
  console.log("ICT_RnD non-null:", rows.filter(r => r.ICT_RnD != null).length);

  draw();
}).catch(err => {
  console.error("Load error:", err);
  document.getElementById("map-container").innerHTML =
    `<p style="padding:1rem;color:red;">Failed to load data: ${err.message}</p>`;
});

// ─── Draw map ─────────────────────────────────────────────────────────────────

function draw() {
  const meta = VARIABLES[currentVar];
  const svg  = document.getElementById("europe-map");
  const W    = svg.parentElement.clientWidth || 800;
  const H    = Math.round(W * 0.62);

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width",  W);
  svg.setAttribute("height", H);
  svg.innerHTML = "";

const proj = d3.geoMercator().center([10, 53]).scale(W * 0.7).translate([W / 2, H / 2]);
  const path  = d3.geoPath().projection(proj);

  const vals      = rows.map(r => r[currentVar]).filter(v => v != null);
  const [mn, mx]  = d3.extent(vals);
  const sorted = [...vals].sort((a, b) => a - b);
const p95 = sorted[Math.floor(sorted.length * 0.95)];
const colorMax = Math.min(mx, p95);
const color = d3.scaleSequential(d3.interpolateOranges).domain([mn, colorMax]);
  const lookup = {};
  rows.forEach(r => { lookup[r.iso2] = r[currentVar]; });

  d3.select(svg)
    .selectAll("path")
    .data(geo)
    .join("path")
    .attr("d", path)
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.5)
    .attr("fill", f => {
      const val = lookup[f.properties.ISO2];
      return (val != null) ? color(val) : "#e0ddd6";
    })
    .on("mousemove", (event, f) => showTooltip(event, f, meta, lookup))
    .on("mouseleave", hideTooltip);

  drawLegend(color, mn, mx, meta);
  drawTable(meta);
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function showTooltip(event, feature, meta, lookup) {
  const iso  = feature.properties.ISO2;
  const val  = lookup[iso];
  const name = feature.properties.NAME || iso || "Unknown";
  const tip  = document.getElementById("map-tooltip");
  tip.style.display = "block";
  tip.style.left    = (event.offsetX + 12) + "px";
  tip.style.top     = (event.offsetY - 10) + "px";
  tip.innerHTML     = `<strong>${name}</strong><br>${val != null ? meta.fmt(val) : "No data"}`;
}

function hideTooltip() {
  document.getElementById("map-tooltip").style.display = "none";
}

// ─── Legend ───────────────────────────────────────────────────────────────────

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

// ─── Table ────────────────────────────────────────────────────────────────────

function drawTable(meta) {
  document.getElementById("table-heading").textContent = meta.label;

  const sorted = [...rows]
    .filter(r => r[currentVar] != null)
    .sort((a, b) => b[currentVar] - a[currentVar]);

  document.getElementById("table-body").innerHTML = sorted.map(r => `
    <tr>
      <td>${r.name}</td>
      <td class="num-cell">${meta.fmt(r[currentVar])}</td>
      <td>${r.outlier ? "⚠ Yes" : "—"}</td>
    </tr>
  `).join("");
}

// ─── Dropdown + resize ────────────────────────────────────────────────────────

document.getElementById("variable-select").addEventListener("change", e => {
  currentVar = e.target.value;
  draw();
});

window.addEventListener("resize", draw);