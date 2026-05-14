# Living Along Data Centers

Interactive web report for a bachelor thesis that investigates investments in AI infrastructure and the socio-economic impact of data centers across Europe.

## Overview

This repository contains a static web report built for a Czech Technical University (CTU) bachelor thesis completed in May 2026. The report presents:

- An overview of the dataset and research variables
- Formal hypotheses on energy prices and ICT sector effects
- An interactive choropleth map for exploring country-level indicators
- Regression and correlation results with visual summaries

The project is designed as an interactive supplement to the written thesis, making empirical findings easy to explore.

## Key Features

- **Home dashboard** with thesis title, key statistics, and variable definitions
- **Hypotheses page** outlining research questions and expected relationships
- **Explore Data page** with an interactive Europe map showing country-level values
- **Results page** with Chart.js visualizations of Spearman correlations and regression outcomes
- **Data-driven analysis** using Eurostat, Data Center Map, and ICT statistics

## Tech Stack

- HTML / CSS / JavaScript
- Chart.js for charts
- D3 for map rendering and geographic visualization

## Repository Structure

- `index.html` – main report landing page
- `hypotheses.html` – thesis hypotheses and theoretical motivation
- `map.html` – interactive choropleth map of Europe
- `results.html` – results and charts from empirical analysis
- `css/style.css` – site styling
- `js/` – page scripts and visualization logic
  - `js/map.js` – map data processing and D3 rendering
  - `js/results.js` – Chart.js results visualization
  - `js/scatter_1.js`, `js/scatter_2.js` – scatter plot components
- `data/` – dataset files used by the report
  - `europe.geojson` – geographic boundaries for Europe
  - `DATA.json`, `ICT_all.json`, `ICT_EMP.json`, `ICT_GVA.json`, `ICT_RnD.json` – analysis data
- `package.json` – build and development scripts

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open the local URL provided by Parcel in your browser.

4. For a production build:

```bash
npm run build
```

> The report is also viewable as a static site by opening (https://dia-jen.github.io/web_report_bt/) directly, but a local server ensures all data imports and routes work correctly.

## Data Sources

The analysis uses European data related to:

- data center capacity and energy consumption
- household and non-household electricity prices
- GDP per capita
- ICT gross value added, employment share, and R&D spending

Sources include Eurostat, JRC/industry reports, and open geospatial data for Europe.

## Thesis Context

- Author: Diana Jenčíková
- Institution: Czech Technical University in Prague
- Faculty: Faculty of Information Technology
- Supervisor: PhDr. Ing. Tomáš Evan, Ph.D.
- Year: 2026

## Notes

This web report is intended as an interactive companion to the written bachelor thesis, providing a hands-on way to explore the empirical evidence behind the research conclusions.
