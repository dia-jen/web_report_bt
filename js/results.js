/**
 * results.js
 * Renders Chart.js charts on the results page.
 * All data is hardcoded from the thesis tables — no external file needed.
 */

// ─── Shared chart defaults ───────────────────────────────────────────────────

Chart.defaults.font.family = "Roboto";
Chart.defaults.color = "#4a4a4a";

// ─── Color palette ────────────────────────────────────────────────────────────

const COLOR_HIGH   = "#f56e0f";   // p < 0.001
const COLOR_MID    = "#b46731";   // p < 0.05
const COLOR_BORDER = "#878787";   // borderline
const COLOR_NONE   = "#878787";   // not significant
const COLOR_MUTED  = "#878787";

// ─── Helper: significance color ──────────────────────────────────────────────

function sigColor(p) {
  if (p < 0.001) return COLOR_HIGH;
  if (p < 0.01)  return COLOR_MID;
  if (p < 0.05)  return COLOR_MID;
  if (p < 0.10)  return COLOR_NONE;
  return COLOR_NONE;
}

// ─── 1. Spearman overview bar chart ─────────────────────────────────────────

const spearmanData = [
  // Price hypotheses
  { label: "H0",    rho: 0.5504, p: 0.000613 },
  { label: "H1",     rho: 0.5730, p: 0.000397 },
  { label: "H2",    rho: 0.2985, p: 0.091579 },
  { label: "H3",     rho: 0.2985, p: 0.091488 },
  // ICT hypotheses
  { label: "H4",    rho: 0.2056, p: 0.26719  },
  { label: "H5",   rho: 0.7030, p: 0.00002  },
  { label: "H6",    rho: 0.1923, p: 0.31758  },
  { label: "H4b",  rho: 0.3399, p: 0.06135  },
  { label: "H5b",   rho: 0.3641, p: 0.05218  },
  { label: "H6b",  rho: 0.5591, p: 0.00162  },
];

function sigLabel(p) {
  if (p < 0.001) return "***";
  if (p < 0.01)  return "**";
  if (p < 0.05)  return "*";
  if (p < 0.10)  return "†";
  return "ns";
}

const spearmanCtx = document.getElementById("spearman-chart").getContext("2d");

new Chart(spearmanCtx, {
  type: "bar",
  data: {
    labels: spearmanData.map(d => d.label),
    datasets: [{
      label: "Spearman ρ",
      data: spearmanData.map(d => d.rho),
      backgroundColor: spearmanData.map(d => sigColor(d.p)),
      borderWidth: 0,
      borderRadius: 2,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => spearmanData[items[0].dataIndex].label.replace("\n", " — "),
          label: (item) => {
            const d = spearmanData[item.dataIndex];
            return [
              `ρ = ${d.rho.toFixed(4)}`,
              `p = ${d.p.toFixed(5)}`,
              `Significance: ${sigLabel(d.p)}`
            ];
          }
        }
      },
      // inline significance label above each bar
      datalabels: {
        display: false  // enable if you add chartjs-plugin-datalabels
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 }, maxRotation: 30 }
      },
      y: {
        min: 0, max: 1,
        title: { display: true, text: "Spearman ρ", font: { size: 12 } },
        grid: { color: "#e8e4dc" },
        ticks: {
          callback: v => v.toFixed(1)
        }
      }
    }
  }
});