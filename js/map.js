// ─── Config ───────────────────────────────────────────────────────────────────

const VARIABLES = {
  DC_CAPITA:  { label: "Data centers per million inhabitants", fmt: v => (v * 1e6).toFixed(2) },
  DC_SHARE:   { label: "DC share of national energy (%)",      fmt: v => v.toFixed(2) + "%" },
  HH_PRICES:  { label: "Household electricity price (€/kWh)", fmt: v => "€" + v.toFixed(4) },
  NH_PRICES:  { label: "Non-household price (€/kWh)",         fmt: v => "€" + v.toFixed(4) },
  GDP:        { label: "GDP per capita (€)",                  fmt: v => "€" + Math.round(v).toLocaleString() },
};

// Maps your country names to ISO2 codes (needed to join with GeoJSON)
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
let rows = [];   // cleaned data rows
let geo  = null; // GeoJSON features

// ─── Parse TSV ────────────────────────────────────────────────────────────────

function parseNum(str) {
  if (!str || str.trim() === "") return null;
  return parseFloat(str.trim().replace(",", ".")) || null;
}

function parseTSV(text) {
  const lines = text.trim().split("\n").slice(1); // skip header
  return lines.map(line => {
    const [COUNTRY, DC_CAPITA, DC_SHARE, NH_PRICES, HH_PRICES, GDP] = line.split("\t");
    const name = COUNTRY.trim();
    return {
      name,
      iso2:      NAME_TO_ISO2[name] || null,
      DC_CAPITA: parseNum(DC_CAPITA),
      DC_SHARE:  parseNum(DC_SHARE),
      HH_PRICES: parseNum(HH_PRICES),
      NH_PRICES: parseNum(NH_PRICES),
      GDP:       parseNum(GDP),
      outlier:   OUTLIERS.has(name),
    };
  }).filter(d => d.iso2); // drop rows without a known ISO code
}

// ─── Load both files, then draw ───────────────────────────────────────────────

Promise.all([
  fetch("data/europe.geojson").then(r => r.json()),
  fetch("data/DATA.tsv").then(r => r.text()),
]).then(([geojson, tsvText]) => {
  geo  = geojson.features;
  rows = parseTSV(tsvText);
  draw();
}).catch(err => {
  document.getElementById("map-container").innerHTML =
    `<p style="padding:1rem;color:red;">Failed to load data: ${err.message}</p>`;
});

// ─── Draw map ─────────────────────────────────────────────────────────────────

function draw() {
  const meta   = VARIABLES[currentVar];
  const svg    = document.getElementById("europe-map");
  const W      = svg.parentElement.clientWidth || 800;
  const H      = Math.round(W * 0.62);

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width",  W);
  svg.setAttribute("height", H);
  svg.innerHTML = "";

  // D3 projection & path
  const proj = d3.geoMercator().center([15, 54]).scale(W * 1.1).translate([W / 2, H / 2]);
  const path = d3.geoPath().projection(proj);

  // Color scale from min → max of current variable
  const vals   = rows.map(r => r[currentVar]).filter(v => v != null);
  const [mn, mx] = d3.extent(vals);
  const color  = d3.scaleSequential(d3.interpolateGreens).domain([mn, mx]);

  // iso2 → value lookup for quick access
  const lookup = {};
  rows.forEach(r => { lookup[r.iso2] = r[currentVar]; });

  // Draw each country path
  const svgD3 = d3.select(svg);
  svgD3.selectAll("path")
    .data(geo)
    .join("path")
    .attr("d", path)
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.5)
    .attr("fill", f => {
      const iso = f.properties.ISO2;
      const val = lookup[iso];
      return val != null ? color(val) : "#e0ddd6";
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
  const svg  = d3.select("#legend-bar").attr("width", 200).attr("height", 14);
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
      <td>${r.iso2}</td>
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