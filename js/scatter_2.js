// import Chart from 'chart.js/auto'

const Chart = window.Chart;

async function loadData() {
  const [mainData, ictAllData] = await Promise.all([
    fetch('data/DATA.json').then(r => r.json()),
    fetch('data/ICT_all.json').then(r => r.json()),
  ]);
  return { mainData, ictAllData };
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

    const regressionParams = {
    'dcPerCapita,ictEmp': { slope: 0.1325174785167506, intercept: 2.377389145332625 },  // H_5
    'dcPerCapita,ictEmp,clean': { slope: 0.11393475019010298, intercept: 2.4751304624319332 },  // H_5C
    'dcPerCapita,ictRnd': { slope: 1.3809508211194146, intercept: 16.577951442541384 },  // H_6b
    'dcPerCapita,ictRnd,clean': { slope: 1.3768670965433527, intercept: 15.163560341035751 }, // H_6bC
  };


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

  function buildChart(yKey, xKey) {
    const allFiltered = cleaned.filter(r => r[xKey] != null && r[yKey] != null);

    const xBounds = getIQROutliers(allFiltered.map(r => r[xKey]));
    const yBounds = getIQROutliers(allFiltered.map(r => r[yKey]));

    const isOutlier = (r) =>
      r[xKey] < xBounds.lower || r[xKey] > xBounds.upper ||
      r[yKey] < yBounds.lower || r[yKey] > yBounds.upper;

    const filtered = showOutliers
      ? allFiltered
      : allFiltered.filter(r => !isOutlier(r));

    const cleanSuffix = !showOutliers ? ',clean' : '';
    const regKey = `${xKey},${yKey}${cleanSuffix}`;
    const reg = regressionParams[regKey] ?? null;

    const regressionDataset = reg ? (() => {
      const xVals = filtered.map(r => r[xKey]);
      const xMin = Math.min(...xVals);
      const xMax = Math.max(...xVals);
      return {
        label: `Regression${!showOutliers ? ' (clean)' : ''}`,
        data: [
          { x: xMin, y: reg.slope * xMin + reg.intercept },
          { x: xMax, y: reg.slope * xMax + reg.intercept },
        ],
        type: 'line',
        borderColor: 'rgba(255, 160, 0, 0.95)',
        borderWidth: 3,
        pointRadius: 0,
        fill: false,
        tension: 0,
        showLine: true,
        order: 2,
      };
    })() : null;

    if (chart) chart.destroy();
    chart = new Chart(document.getElementById('acquisitions2'), {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: `${axisLabels[xKey]}  vs ${axisLabels[yKey]}`,
            data: filtered.map(r => ({ x: r[xKey], y: r[yKey], label: r.country })),
            backgroundColor: filtered.map(r =>
              isOutlier(r)
                ? 'rgba(255, 60, 60, 0.8)'      // red = outlier
                : 'rgba(99, 107, 255, 0.6)'     // blue = normal
            ),
          },
          ...(regressionDataset ? [regressionDataset] : [])
        ]
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
                  `DC/million: ${p.x.toFixed(2)}`,
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
buildChart('ictGva', 'dcPctConsumption');

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