// import Chart from 'chart.js/auto'

const Chart = window.Chart;

async function loadData() {
  const [mainData, ictAllData] = await Promise.all([
    fetch('data/DATA.json').then(r => r.json()),
    fetch('data/ICT_all.json').then(r => r.json()),
  ]);
  return { mainData, ictAllData };
}

function getLatestValue(obj) {
  // Get the latest available year value from the object
  const years = ['2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016', '2015', '2014'];
  for (const year of years) {
    if (obj[year] !== undefined && obj[year] !== null && obj[year] !== '') {
      return obj[year];
    }
  }
  return null;
}

(async () => {
  const { mainData, ictAllData } = await loadData();

  const parseNum = (val) => val ? parseFloat(val.toString().replace(/[",]/g, '.')) : null;

  // Create lookup map for ICT data from ICT_all
  const ictMap = {};
  ictAllData.forEach(row => {
    const countryName = row.country || row.COUNTRY;
    ictMap[countryName] = {
      ictGva: parseNum(row.ICT_GVA),
      ictEmp: parseNum(row.ICT_EMP),
      ictRnd: parseNum(row.ICT_RnD),
    };
  });

  const cleaned = mainData.map(row => ({
    country: row.COUNTRY,
    dcPerCapita: parseNum(row["DC/CAPITA"])*1000000,
    dcPctConsumption: parseNum(row["DC_%_E_CONSUMPTIOM"]),
    ictGva: ictMap[row.COUNTRY]?.ictGva,
    ictEmp: ictMap[row.COUNTRY]?.ictEmp,
    ictRnd: ictMap[row.COUNTRY]?.ictRnd,
    gdp: row.GDP ? parseFloat(row.GDP) : null,
  }));
  const axisLabels = {
  dcPerCapita:      'DC per million inhabitants',
  dcPctConsumption: 'DC % of Energy Consumption',
  ictGva:           'ICT Gross Value Added (%)',
  ictEmp:           'ICT Employment Share (%)',
  ictRnd:           'ICT R&D Spending (% of GDP)',
  gdp:              'GDP per capita (USD)',
};

  const filtered = cleaned.filter(r => r.dcPerCapita && r.ictEmp);

let chart;
let showOutliers = true;

function getIQROutliers(arr) {
  const sorted = [...arr].filter(v => v != null).sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return { lower, upper };
}

function buildChart(yKey,xKey) {
  const allFiltered = cleaned.filter(r => r[xKey] != null && r[yKey] != null);

  const xBounds = getIQROutliers(allFiltered.map(r => r[xKey]));
  const yBounds = getIQROutliers(allFiltered.map(r => r[yKey]));

  const isOutlier = (r) =>
    r[xKey] < xBounds.lower || r[xKey] > xBounds.upper ||
    r[yKey] < yBounds.lower || r[yKey] > yBounds.upper;

  // ✅ either show all, or strip outliers out
  const filtered = showOutliers
    ? allFiltered
    : allFiltered.filter(r => !isOutlier(r));

  if (chart) chart.destroy();
  chart = new Chart(document.getElementById('acquisitions2'), {
    type: 'scatter',
    data: {
      datasets: [{
        label: `${axisLabels[xKey]} vs ${axisLabels[yKey]}`,
        data: filtered.map(r => ({ x: r[xKey], y: r[yKey], label: r.country })),
        backgroundColor: filtered.map(r =>
          isOutlier(r)
            ? 'rgba(255, 60, 60, 0.8)'      // red = outlier
            : 'rgba(99, 107, 255, 0.6)'     // blue = normal
        ),

      }]
    },
    options: {
      scales: {
        x: { title: { display: true, text: axisLabels[xKey] } },
        y: { title: { display: true, text: axisLabels[yKey] } },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => {
              const p = context.raw;
              return [
                `Country: ${p.label}`,
                `${axisLabels[xKey]}: ${p.x.toFixed(2)}`,
                `${axisLabels[yKey]}: ${p.y.toFixed(3)}`,
              ];
            }
          }
        }
      }
    }
  });
}

// Initial render
buildChart('ictEmp', 'dcPerCapita');

document.getElementById('yAxis2').addEventListener('change', (e) => {
  const [xKey, yKey] = e.target.value.split(',').map(s => s.trim());
  buildChart(yKey, xKey);
});

document.getElementById('toggleOutliers2').addEventListener('click', () => {
  showOutliers = !showOutliers;
  document.getElementById('toggleOutliers2').textContent =
    showOutliers ? 'Hide Outliers' : 'Show Outliers';

  const val = document.getElementById('yAxis2').value.split(',').map(s => s.trim());
  buildChart(val[1], val[0]);
});
})();