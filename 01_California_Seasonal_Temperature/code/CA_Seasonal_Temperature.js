// ============================================================
// CALIFORNIA SEASONAL TEMPERATURE + ANOMALY DASHBOARD
// FINAL CLEAN PORTFOLIO VERSION
// Fixes:
// ✅ Moves legend to bottom-right
// ✅ Prevents legend from overlapping left dashboard panel
// ✅ Keeps county boundaries optional
// ✅ Keeps chart smaller and cleaner
// ✅ Exports maps with boundaries
// ============================================================

var stateName = 'California';
var TARGET_YEAR = 2024;
var BASELINE_START = 1991;
var BASELINE_END = 2020;
var exportFolder = 'GEE_Exports';

var states = ee.FeatureCollection('TIGER/2018/States');
var state = states.filter(ee.Filter.eq('NAME', stateName));
var stateGeom = state.geometry();
var stateFP = ee.Feature(state.first()).get('STATEFP');

var counties = ee.FeatureCollection('TIGER/2018/Counties')
  .filter(ee.Filter.eq('STATEFP', stateFP));

Map.centerObject(state, 6);

var grayStyle = [
  {elementType: 'geometry', stylers: [{color: '#f2f2f2'}]},
  {elementType: 'labels.text.fill', stylers: [{color: '#666666'}]},
  {elementType: 'labels.text.stroke', stylers: [{color: '#ffffff'}]},
  {featureType: 'road', stylers: [{visibility: 'off'}]},
  {featureType: 'poi', stylers: [{visibility: 'off'}]},
  {featureType: 'transit', stylers: [{visibility: 'off'}]},
  {featureType: 'water', elementType: 'geometry', stylers: [{color: '#dbe9f4'}]}
];

Map.setOptions('GRAY', {'GRAY': grayStyle});
Map.setOptions('GRAY');

var era5 = ee.ImageCollection('ECMWF/ERA5_LAND/MONTHLY_AGGR')
  .select('temperature_2m');

function toCelsius(img) {
  return ee.Image(img)
    .subtract(273.15)
    .rename('temp_c')
    .copyProperties(img, ['system:time_start']);
}

var seasonMonths = {
  'Winter': [12, 1, 2],
  'Spring': [3, 4, 5],
  'Summer': [6, 7, 8],
  'Fall': [9, 10, 11]
};

var seasonList = ['Winter', 'Spring', 'Summer', 'Fall'];
var modeList = ['Mean Temperature', 'Temperature Anomaly'];

function seasonalMeanForYear(year, seasonName) {
  year = ee.Number(year);
  var months = ee.List(seasonMonths[seasonName]);

  var images = months.map(function(m) {
    m = ee.Number(m);
    var imgYear = ee.Number(ee.Algorithms.If(m.eq(12), year.subtract(1), year));
    var start = ee.Date.fromYMD(imgYear, m, 1);
    var end = start.advance(1, 'month');

    return era5.filterDate(start, end)
      .mean()
      .select('temperature_2m');
  });

  return ee.ImageCollection.fromImages(images)
    .map(toCelsius)
    .mean()
    .rename('temp_c')
    .clip(stateGeom);
}

function seasonalBaseline(startYear, endYear, seasonName) {
  var years = ee.List.sequence(startYear, endYear);

  return ee.ImageCollection.fromImages(
    years.map(function(y) {
      return seasonalMeanForYear(y, seasonName);
    })
  ).mean().rename('temp_c').clip(stateGeom);
}

function currentSeason(seasonName) {
  return seasonalMeanForYear(TARGET_YEAR, seasonName).rename('temp_c');
}

function anomalySeason(seasonName) {
  return currentSeason(seasonName)
    .subtract(seasonalBaseline(BASELINE_START, BASELINE_END, seasonName))
    .rename('temp_anomaly_c')
    .clip(stateGeom);
}

function seasonalImageForMode(seasonName, modeName) {
  return modeName === 'Mean Temperature'
    ? currentSeason(seasonName).rename('value')
    : anomalySeason(seasonName).rename('value');
}

var meanVis = {
  min: 0,
  max: 35,
  palette: ['#2c7bb6', '#74add1', '#abd9e9', '#ffffbf', '#fdae61', '#f46d43', '#d73027']
};

var anomalyVis = {
  min: -5,
  max: 5,
  palette: ['#313695', '#74add1', '#e0f3f8', '#ffffbf', '#fdae61', '#f46d43', '#a50026']
};

var stateOutline = ee.Image().byte().paint({
  featureCollection: state,
  color: 1,
  width: 2
});

var countyOutline = ee.Image().byte().paint({
  featureCollection: counties,
  color: 1,
  width: 1
});

var tempLayer = ui.Map.Layer(ee.Image(0).selfMask(), anomalyVis, 'Temperature Anomaly', true, 0.9);

var countyLayer = ui.Map.Layer(
  countyOutline.updateMask(countyOutline),
  {palette: ['#777777']},
  'County boundaries',
  true,
  0.45
);

var stateLayer = ui.Map.Layer(
  stateOutline.updateMask(stateOutline),
  {palette: ['#111111']},
  'California boundary',
  true,
  1
);

Map.layers().reset([tempLayer, countyLayer, stateLayer]);

function formatTempDual(valueC) {
  if (typeof valueC !== 'number' || !isFinite(valueC)) return 'N/A';
  var valueF = valueC * 9 / 5 + 32;
  return valueC.toFixed(1) + ' °C / ' + valueF.toFixed(1) + ' °F';
}

function formatAnomalyDual(valueC) {
  if (typeof valueC !== 'number' || !isFinite(valueC)) return 'N/A';
  var valueF = valueC * 9 / 5;
  return valueC.toFixed(1) + ' °C / ' + valueF.toFixed(1) + ' °F';
}

function seasonalStateMetric(seasonName) {
  var current = currentSeason(seasonName);
  var anomaly = anomalySeason(seasonName);

  var currentStat = current.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: stateGeom,
    scale: 5000,
    bestEffort: true,
    maxPixels: 1e13
  });

  var anomalyStat = anomaly.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: stateGeom,
    scale: 5000,
    bestEffort: true,
    maxPixels: 1e13
  });

  return {
    current: ee.Number(currentStat.get('temp_c')),
    anomaly: ee.Number(anomalyStat.get('temp_anomaly_c'))
  };
}

function countySummary(seasonName, modeName) {
  var img = seasonalImageForMode(seasonName, modeName);

  return img.reduceRegions({
    collection: counties,
    reducer: ee.Reducer.mean(),
    scale: 5000
  }).map(function(f) {
    return f.set({
      season: seasonName,
      mode: modeName,
      value_c: f.get('mean')
    });
  }).sort('value_c', false);
}

function monthlyChart() {
  var months = ee.List.sequence(1, 12);

  var features = months.map(function(m) {
    m = ee.Number(m);
    var start = ee.Date.fromYMD(TARGET_YEAR, m, 1);
    var end = start.advance(1, 'month');

    var img = era5.filterDate(start, end)
      .mean()
      .select('temperature_2m')
      .subtract(273.15)
      .rename('temp_c')
      .clip(stateGeom);

    var stat = img.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: stateGeom,
      scale: 5000,
      bestEffort: true,
      maxPixels: 1e13
    });

    var c = ee.Number(stat.get('temp_c'));
    var f = c.multiply(9).divide(5).add(32);

    return ee.Feature(null, {
      month: m,
      temp_c: c,
      temp_f: f
    });
  });

  return ui.Chart.feature.byFeature(
    ee.FeatureCollection(features),
    'month',
    ['temp_c', 'temp_f']
  ).setChartType('LineChart').setOptions({
    title: '',
    hAxis: {title: 'Month'},
    vAxis: {title: 'Temperature'},
    height: 150,
    lineWidth: 2,
    pointSize: 3,
    legend: {position: 'bottom'}
  });
}

// -------------------------------
// UI PANEL
// -------------------------------
var panel = ui.Panel({
  style: {
    position: 'top-left',
    width: '395px',
    padding: '12px',
    backgroundColor: 'white'
  }
});

panel.add(ui.Label('California Seasonal Temperature Dashboard', {
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 6px 0'
}));

panel.add(ui.Label(
  'Seasonal air temperature and anomaly mapping using ERA5-Land monthly aggregates. Anomaly compares 2024 against a 1991–2020 baseline.',
  {fontSize: '12px', color: '#444', margin: '0 0 10px 0'}
));

panel.add(ui.Label('Season', {fontWeight: 'bold'}));

var seasonSelect = ui.Select({
  items: seasonList,
  value: 'Summer',
  style: {stretch: 'horizontal'}
});
panel.add(seasonSelect);

panel.add(ui.Label('Map Mode', {fontWeight: 'bold', margin: '10px 0 4px 0'}));

var modeSelect = ui.Select({
  items: modeList,
  value: 'Temperature Anomaly',
  style: {stretch: 'horizontal'}
});
panel.add(modeSelect);

var countyCheckbox = ui.Checkbox('Show county boundaries', true);
panel.add(countyCheckbox);

panel.add(ui.Label('Layer opacity', {
  fontSize: '11px',
  color: '#666',
  margin: '8px 0 2px 0'
}));

var opacitySlider = ui.Slider({
  min: 0,
  max: 1,
  value: 0.9,
  step: 0.05,
  style: {stretch: 'horizontal'}
});
panel.add(opacitySlider);

panel.add(ui.Label('Summary Metrics', {
  fontWeight: 'bold',
  margin: '10px 0 4px 0'
}));

var meanMetricLabel = ui.Label('Statewide seasonal mean: calculating...', {fontSize: '12px'});
var anomalyMetricLabel = ui.Label('Statewide anomaly: calculating...', {fontSize: '12px'});

panel.add(meanMetricLabel);
panel.add(anomalyMetricLabel);

panel.add(ui.Label('Top 5 counties', {
  fontWeight: 'bold',
  margin: '10px 0 4px 0'
}));

var countySummaryPanel = ui.Panel();
panel.add(countySummaryPanel);

panel.add(ui.Label('2024 monthly statewide mean temperature', {
  fontWeight: 'bold',
  margin: '10px 0 4px 0'
}));

var chartPanel = ui.Panel({
  style: {
    height: '180px',
    stretch: 'horizontal'
  }
});
chartPanel.add(monthlyChart());
panel.add(chartPanel);

panel.add(ui.Label(
  'Data: ECMWF ERA5-Land Monthly Aggregates; TIGER/2018 States and Counties.',
  {fontSize: '10px', color: '#666', margin: '10px 0 0 0'}
));

Map.add(panel);

// -------------------------------
// LEGEND — MOVED TO BOTTOM-RIGHT
// -------------------------------
var legend = ui.Panel({
  style: {
    position: 'bottom-right',
    padding: '10px',
    backgroundColor: 'white',
    width: '290px'
  }
});

function makeColorBar(palette) {
  return ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0),
    params: {
      bbox: [0, 0, 1, 0.1],
      dimensions: '250x18',
      format: 'png',
      min: 0,
      max: 1,
      palette: palette
    },
    style: {stretch: 'horizontal', margin: '0 0 4px 0'}
  });
}

function refreshLegend(modeName) {
  legend.clear();

  if (modeName === 'Mean Temperature') {
    legend.add(ui.Label('Mean Air Temperature', {
      fontWeight: 'bold',
      fontSize: '14px'
    }));

    legend.add(makeColorBar(meanVis.palette));
    legend.add(ui.Label('0°C / 32°F      17.5°C / 63.5°F      35°C / 95°F', {
      fontSize: '10px'
    }));
  } else {
    legend.add(ui.Label('Temperature Anomaly', {
      fontWeight: 'bold',
      fontSize: '14px'
    }));

    legend.add(makeColorBar(anomalyVis.palette));
    legend.add(ui.Label('-5°C / -9°F            0            +5°C / +9°F', {
      fontSize: '10px'
    }));
  }
}

Map.add(legend);

function updateDashboard() {
  var seasonName = seasonSelect.getValue();
  var modeName = modeSelect.getValue();

  var image = seasonalImageForMode(seasonName, modeName);
  var vis = modeName === 'Mean Temperature' ? meanVis : anomalyVis;

  tempLayer.setEeObject(image);
  tempLayer.setVisParams(vis);
  tempLayer.setName(seasonName + ' ' + modeName);
  tempLayer.setOpacity(opacitySlider.getValue());

  countyLayer.setShown(countyCheckbox.getValue());
  refreshLegend(modeName);

  var metrics = seasonalStateMetric(seasonName);

  metrics.current.evaluate(function(v) {
    meanMetricLabel.setValue(
      'Statewide ' + seasonName.toLowerCase() + ' mean: ' + formatTempDual(v)
    );
  });

  metrics.anomaly.evaluate(function(v) {
    anomalyMetricLabel.setValue(
      'Statewide anomaly vs ' + BASELINE_START + '–' + BASELINE_END + ': ' + formatAnomalyDual(v)
    );
  });

  countySummaryPanel.clear();
  countySummaryPanel.add(ui.Label('Loading counties...', {
    fontSize: '12px',
    color: '#666'
  }));

  countySummary(seasonName, modeName).limit(5).evaluate(function(fc) {
    countySummaryPanel.clear();

    if (!fc || !fc.features || fc.features.length === 0) {
      countySummaryPanel.add(ui.Label('No county summary available.', {fontSize: '12px'}));
      return;
    }

    fc.features.forEach(function(f) {
      var name = f.properties.NAME || 'Unknown';
      var val = f.properties.value_c;

      var text = modeName === 'Mean Temperature'
        ? formatTempDual(val)
        : formatAnomalyDual(val);

      countySummaryPanel.add(ui.Label(name + ': ' + text, {
        fontSize: '12px',
        margin: '0 0 4px 0'
      }));
    });
  });
}

seasonSelect.onChange(updateDashboard);
modeSelect.onChange(updateDashboard);

countyCheckbox.onChange(function(checked) {
  countyLayer.setShown(checked);
});

opacitySlider.onChange(function(value) {
  tempLayer.setOpacity(value);
});

updateDashboard();

// ============================================================
// EXPORTS
// ============================================================

function safeFileMode(modeName) {
  return modeName
    .replace('Mean Temperature', 'Mean_Temperature')
    .replace('Temperature Anomaly', 'Temperature_Anomaly');
}

function addBoundaries(rgbImage, includeCounties) {
  var out = rgbImage;

  if (includeCounties) {
    out = out.blend(
      countyOutline.visualize({
        palette: ['777777'],
        forceRgbOutput: true
      })
    );
  }

  out = out.blend(
    stateOutline.visualize({
      palette: ['111111'],
      forceRgbOutput: true
    })
  );

  return out;
}

function exportMap(seasonName, modeName, includeCounties) {
  var image = seasonalImageForMode(seasonName, modeName);
  var vis = modeName === 'Mean Temperature' ? meanVis : anomalyVis;

  var fileName = 'CA_' + seasonName + '_' + safeFileMode(modeName);

  if (includeCounties) {
    fileName += '_Counties';
  }

  Export.image.toDrive({
    image: addBoundaries(image.visualize(vis), includeCounties),
    description: fileName,
    folder: exportFolder,
    fileNamePrefix: fileName,
    region: stateGeom,
    scale: 4000,
    maxPixels: 1e13
  });
}

// Export all seasons
seasonList.forEach(function(seasonName) {
  exportMap(seasonName, 'Mean Temperature', false);
  exportMap(seasonName, 'Temperature Anomaly', false);
});

// Hero exports
exportMap('Summer', 'Temperature Anomaly', true);
exportMap('Winter', 'Temperature Anomaly', true);

// County CSVs
function exportCountyTable(seasonName, modeName) {
  var fileName = 'CA_' + seasonName + '_' + safeFileMode(modeName) + '_County_Table';

  Export.table.toDrive({
    collection: countySummary(seasonName, modeName).select([
      'STATEFP',
      'COUNTYFP',
      'NAME',
      'season',
      'mode',
      'value_c'
    ]),
    description: fileName,
    folder: exportFolder,
    fileNamePrefix: fileName,
    fileFormat: 'CSV'
  });
}

seasonList.forEach(function(seasonName) {
  exportCountyTable(seasonName, 'Mean Temperature');
  exportCountyTable(seasonName, 'Temperature Anomaly');
});

// Statewide CSV
var statewideFeatures = [];

seasonList.forEach(function(seasonName) {
  var metrics = seasonalStateMetric(seasonName);

  statewideFeatures.push(ee.Feature(null, {
    state: stateName,
    target_year: TARGET_YEAR,
    baseline_period: BASELINE_START + '-' + BASELINE_END,
    season: seasonName,
    mean_temperature_c: metrics.current,
    anomaly_c: metrics.anomaly
  }));
});

Export.table.toDrive({
  collection: ee.FeatureCollection(statewideFeatures),
  description: 'CA_Temperature_Statewide_Seasonal_Summary',
  folder: exportFolder,
  fileNamePrefix: 'CA_Temperature_Statewide_Seasonal_Summary',
  fileFormat: 'CSV'
});