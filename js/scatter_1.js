const Chart = window.Chart;

async function loadData() {
  const response = await fetch('data/DATA.json');
  return await response.json();
}

(async () => {
  const data = await loadData();

  const parseNum = (val) => val ? parseFloat(val.replace(',', '.')) : null;

  const cleaned = data.map(row => ({
    country: row.COUNTRY,
    dcPerCapita: parseNum(row["DC/CAPITA"]) * 1000000,
    dcPctConsumption: parseNum(row["DC_%_E_CONSUMPTIOM"]),
    nhPrices: parseNum(row.NH_PRICES),
    hhPrices: parseNum(row.HH_PRICES),
    gdp: row.GDP ? parseFloat(row.GDP) : null,
  }));
  const axisLabels = {
    dcPerCapita: 'DC per million inhabitants',
    dcPctConsumption: 'DC % of Energy Consumption',
    hhPrices: 'HH Prices (€/kWh)',
    nhPrices: 'NH Prices (€/kWh)',
    gdp: 'GDP per capita (USD)',
  };
  const regressionParams = {
    'dcPerCapita,hhPrices': { slope: 0.005500224044664439, intercept: 0.24557562863833676 },  // H_0
    'dcPerCapita,hhPrices,clean': { slope: 0.009294842791605494, intercept: 0.2255552259268553 },  // H_0C
    'dcPctConsumption,hhPrices': { slope: 0.008979088253278075, intercept: 0.2669307282703828 },  // H_1
    'dcPctConsumption,hhPrices,clean': { slope: 0.042988116099567764, intercept: 0.22962319873479525 }, // H_1C
  };


  const filtered = cleaned.filter(r => r.dcPerCapita && r.hhPrices);

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
        borderColor: 'rgba(255, 160, 0, 0.9)',
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        tension: 0,
      };
    })() : null;

    if (chart) chart.destroy();
    chart = new Chart(document.getElementById('acquisitions'), {
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
  buildChart('hhPrices', 'dcPerCapita');

  document.getElementById('yAxis').addEventListener('change', (e) => {
    const [xKey, yKey] = e.target.value.split(',').map(s => s.trim());
    buildChart(yKey, xKey);
  });

  document.getElementById('toggleOutliers').addEventListener('click', () => {
    showOutliers = !showOutliers;
    document.getElementById('toggleOutliers').textContent =
      showOutliers ? 'Hide Outliers' : 'Show Outliers';

    const val = document.getElementById('yAxis').value.split(',').map(s => s.trim());
    buildChart(val[1], val[0]);
  });
})();