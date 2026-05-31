// ============================================================
// CALIFORNIA TERRAIN-BASED SOLAR SUITABILITY DASHBOARD
// FINAL PORTFOLIO-READY VERSION
//
// Purpose:
// Identify terrain-based solar suitability across California using
// slope, aspect, and elevation derived from SRTM DEM.
//
// Important note:
// This is a terrain-screening model.
// It does NOT include measured solar irradiance, grid access,
// land ownership, permitting constraints, or protected lands.
//
// Features:
// ✅ Terrain-based solar suitability index 0–100
// ✅ Slope score
// ✅ Aspect score
// ✅ Elevation score
// ✅ Top 10% suitability zones
// ✅ County summaries
// ✅ Histogram
// ✅ Clean UI
// ✅ Legend bottom-right
// ✅ Portfolio exports
// ✅ County CSV export
// ✅ Statewide summary CSV export
// ============================================================


// -------------------------------
// 1) SETTINGS
// -------------------------------
var stateName = 'California';
var exportFolder = 'GEE_Exports';


// -------------------------------
// 2) BOUNDARIES
// -------------------------------
var states = ee.FeatureCollection('TIGER/2018/States');
var state = states.filter(ee.Filter.eq('NAME', stateName));
var stateGeom = state.geometry();

var stateFP = ee.Feature(state.first()).get('STATEFP');

var counties = ee.FeatureCollection('TIGER/2018/Counties')
  .filter(ee.Filter.eq('STATEFP', stateFP));

Map.centerObject(state, 6);


// -------------------------------
// 3) MUTED BASEMAP
// -------------------------------
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


// -------------------------------
// 4) DEM + TERRAIN
// -------------------------------
var dem = ee.Image('USGS/SRTMGL1_003')
  .select('elevation')
  .clip(stateGeom);

var slope = ee.Terrain.slope(dem)
  .rename('slope_deg');

var aspect = ee.Terrain.aspect(dem)
  .rename('aspect_deg');


// -------------------------------
// 5) SOLAR SUITABILITY MODEL
// -------------------------------
// Slope score:
// 0–5 degrees = best
// 5–15 degrees = moderate
// 15–30 degrees = lower
// >30 degrees = unsuitable
var slopeScore = slope.expression(
  '(s <= 5) ? 100' +
  ': (s <= 15) ? (100 - ((s - 5) / 10) * 50)' +
  ': (s <= 30) ? (50 - ((s - 15) / 15) * 50)' +
  ': 0',
  {s: slope}
)
  .clamp(0, 100)
  .rename('slope_score');

// Aspect score:
// South-facing terrain is preferred in the Northern Hemisphere.
// 180 degrees = south-facing = best.
var aspectRad = aspect.multiply(Math.PI / 180);

var aspectScore = aspectRad
  .subtract(Math.PI)
  .cos()
  .unitScale(-1, 1)
  .multiply(100)
  .rename('aspect_score');

// Elevation score:
// Lower and moderate elevation terrain is favored.
// Very high alpine terrain receives a lower score.
var elevationScore = dem.expression(
  '(e <= 1000) ? 100' +
  ': (e <= 2000) ? 85' +
  ': (e <= 3000) ? 55' +
  ': 25',
  {e: dem}
)
  .clamp(0, 100)
  .rename('elevation_score');

// Weighted terrain-based suitability:
// Slope remains most important, but elevation reduces
// overemphasis on steep/high mountain terrain.
var suitability = slopeScore.multiply(0.50)
  .add(aspectScore.multiply(0.25))
  .add(elevationScore.multiply(0.25))
  .rename('solar_suitability')
  .clip(stateGeom);

// Light smoothing for portfolio display
var suitabilityDisplay = suitability
  .focal_mean({
    radius: 1,
    units: 'pixels'
  })
  .rename('solar_suitability');


// -------------------------------
// 6) SAFE HELPERS
// -------------------------------
function safeNumber(value, fallback) {
  return ee.Number(
    ee.Algorithms.If(value, value, fallback)
  );
}

function safeFormat(v, digits) {
  return (typeof v === 'number' && isFinite(v)) ? v.toFixed(digits) : 'N/A';
}

function safeDictNumber(dict, key, fallback) {
  dict = ee.Dictionary(dict);
  return ee.Number(
    ee.Algorithms.If(dict.contains(key), dict.get(key), fallback)
  );
}


// -------------------------------
// 7) PERCENTILES + HOTSPOTS
// -------------------------------
var percentiles = suitabilityDisplay.reduceRegion({
  reducer: ee.Reducer.percentile([5, 90, 95]),
  geometry: stateGeom,
  scale: 1000,
  bestEffort: true,
  maxPixels: 1e13
});

var p5 = safeDictNumber(percentiles, 'solar_suitability_p5', 0);
var p90 = safeDictNumber(percentiles, 'solar_suitability_p90', 80);
var p95 = safeDictNumber(percentiles, 'solar_suitability_p95', 100);

var p5v = p5.getInfo();
var p95v = p95.getInfo();

if (p5v === null || p5v === undefined || !isFinite(p5v)) p5v = 0;
if (p95v === null || p95v === undefined || !isFinite(p95v)) p95v = 100;
if (p95v <= p5v) {
  p5v = 0;
  p95v = 100;
}

var hotspots = suitabilityDisplay
  .gte(p90)
  .selfMask()
  .rename('solar_hotspots');


// -------------------------------
// 8) VISUALIZATION
// -------------------------------
var suitabilityVis = {
  min: p5v,
  max: p95v,
  palette: [
    '#f7f7f7',
    '#d9ef8b',
    '#fee08b',
    '#fdae61',
    '#d73027'
  ]
};

var hotspotVis = {
  palette: ['#7f0000']
};

var slopeVis = {
  min: 0,
  max: 30,
  palette: [
    '#f7fbff',
    '#c6dbef',
    '#6baed6',
    '#2171b5'
  ]
};

var aspectVis = {
  min: 0,
  max: 360,
  palette: [
    '#313695',
    '#74add1',
    '#ffffbf',
    '#fdae61',
    '#a50026'
  ]
};

var elevationScoreVis = {
  min: 0,
  max: 100,
  palette: [
    '#d73027',
    '#fdae61',
    '#ffffbf',
    '#d9ef8b',
    '#1a9850'
  ]
};


// -------------------------------
// 9) OUTLINES
// -------------------------------
var stateOutline = ee.Image().byte().paint({
  featureCollection: state,
  color: 1,
  width: 1
});

var countyOutline = ee.Image().byte().paint({
  featureCollection: counties,
  color: 1,
  width: 1
});


// -------------------------------
// 10) MAP LAYERS
// -------------------------------
var suitabilityLayer = ui.Map.Layer(
  suitabilityDisplay,
  suitabilityVis,
  'Solar suitability',
  true,
  0.9
);

var hotspotLayer = ui.Map.Layer(
  hotspots,
  hotspotVis,
  'Top 10% solar suitability zones',
  true,
  0.45
);

var countyLayer = ui.Map.Layer(
  countyOutline.updateMask(countyOutline),
  {palette: ['#777777']},
  'County boundaries',
  true,
  0.25
);

var stateLayer = ui.Map.Layer(
  stateOutline.updateMask(stateOutline),
  {palette: ['#111111']},
  'California boundary',
  true,
  1
);

var slopeLayer = ui.Map.Layer(
  slope,
  slopeVis,
  'Slope context',
  false,
  0.65
);

var aspectLayer = ui.Map.Layer(
  aspect,
  aspectVis,
  'Aspect context',
  false,
  0.65
);

var elevationScoreLayer = ui.Map.Layer(
  elevationScore,
  elevationScoreVis,
  'Elevation score context',
  false,
  0.65
);

Map.layers().reset([
  suitabilityLayer,
  hotspotLayer,
  countyLayer,
  stateLayer,
  slopeLayer,
  aspectLayer,
  elevationScoreLayer
]);


// -------------------------------
// 11) SUMMARY STATS
// -------------------------------
var totalArea = ee.Image.pixelArea()
  .rename('area')
  .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: stateGeom,
    scale: 1000,
    bestEffort: true,
    maxPixels: 1e13
  });

var totalAreaM2 = safeDictNumber(totalArea, 'area', 1);

var meanSuitability = safeDictNumber(
  suitabilityDisplay.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: stateGeom,
    scale: 1000,
    bestEffort: true,
    maxPixels: 1e13
  }),
  'solar_suitability',
  0
);

var maxSuitability = safeDictNumber(
  suitabilityDisplay.reduceRegion({
    reducer: ee.Reducer.max(),
    geometry: stateGeom,
    scale: 1000,
    bestEffort: true,
    maxPixels: 1e13
  }),
  'solar_suitability',
  0
);

var highSuitMask = suitabilityDisplay.gte(70);

var highSuitArea = safeDictNumber(
  ee.Image.pixelArea()
    .rename('area')
    .updateMask(highSuitMask)
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: stateGeom,
      scale: 1000,
      bestEffort: true,
      maxPixels: 1e13
    }),
  'area',
  0
);

var hotspotArea = safeDictNumber(
  ee.Image.pixelArea()
    .rename('area')
    .updateMask(hotspots)
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: stateGeom,
      scale: 1000,
      bestEffort: true,
      maxPixels: 1e13
    }),
  'area',
  0
);

var highSuitPct = highSuitArea.divide(totalAreaM2).multiply(100);
var hotspotPct = hotspotArea.divide(totalAreaM2).multiply(100);


// -------------------------------
// 12) COUNTY SUMMARY
// -------------------------------
var countyStats = suitabilityDisplay.reduceRegions({
  collection: counties,
  reducer: ee.Reducer.mean(),
  scale: 1000
}).map(function(f) {
  return f.set({
    mean_suitability: f.get('mean')
  });
}).sort('mean_suitability', false);


// -------------------------------
// 13) HISTOGRAM CHART
// -------------------------------
var histChart = ui.Chart.image.histogram({
  image: suitabilityDisplay,
  region: stateGeom,
  scale: 1000,
  maxPixels: 1e13
}).setOptions({
  title: '',
  hAxis: {title: 'Suitability Index'},
  vAxis: {title: 'Pixel Count'},
  height: 160,
  legend: {position: 'none'},
  colors: ['#d95f0e']
});


// -------------------------------
// 14) UI PANEL
// -------------------------------
var panel = ui.Panel({
  style: {
    position: 'top-left',
    width: '395px',
    padding: '12px',
    backgroundColor: 'white'
  }
});

panel.add(ui.Label(stateName + ' Terrain-Based Solar Suitability', {
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 6px 0'
}));

panel.add(ui.Label(
  'Terrain-based solar suitability screening derived from slope, aspect, and elevation. Higher values indicate flatter, more south-facing, lower-to-moderate elevation terrain.',
  {
    fontSize: '12px',
    color: '#444',
    margin: '0 0 10px 0'
  }
));

panel.add(ui.Label('Layers', {
  fontWeight: 'bold',
  margin: '8px 0 4px 0'
}));

var countyCheckbox = ui.Checkbox('Show county boundaries', true);
var hotspotCheckbox = ui.Checkbox('Show top 10% suitability zones', true);
var slopeCheckbox = ui.Checkbox('Show slope context', false);
var aspectCheckbox = ui.Checkbox('Show aspect context', false);
var elevationCheckbox = ui.Checkbox('Show elevation score context', false);

panel.add(countyCheckbox);
panel.add(hotspotCheckbox);
panel.add(slopeCheckbox);
panel.add(aspectCheckbox);
panel.add(elevationCheckbox);

panel.add(ui.Label('Suitability layer opacity', {
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

var meanLabel = ui.Label('Statewide mean suitability: calculating...', {fontSize: '12px'});
var maxLabel = ui.Label('Statewide maximum suitability: calculating...', {fontSize: '12px'});
var highSuitLabel = ui.Label('Area with suitability ≥70: calculating...', {fontSize: '12px'});
var hotspotLabel = ui.Label('Top 10% suitability zone area: calculating...', {fontSize: '12px'});

panel.add(meanLabel);
panel.add(maxLabel);
panel.add(highSuitLabel);
panel.add(hotspotLabel);

panel.add(ui.Label('Top 5 counties', {
  fontWeight: 'bold',
  margin: '10px 0 4px 0'
}));

var countySummaryPanel = ui.Panel();
panel.add(countySummaryPanel);

panel.add(ui.Label('Statewide suitability distribution', {
  fontWeight: 'bold',
  margin: '10px 0 4px 0'
}));

panel.add(ui.Label(
  'Higher values indicate flatter, south-facing terrain with favorable elevation conditions.',
  {
    fontSize: '10px',
    color: '#666',
    margin: '0 0 6px 0'
  }
));

var chartPanel = ui.Panel({
  style: {
    height: '180px',
    stretch: 'horizontal'
  }
});
chartPanel.add(histChart);
panel.add(chartPanel);

panel.add(ui.Label(
  'Data: USGS SRTM DEM; TIGER/2018 States and Counties.',
  {
    fontSize: '10px',
    color: '#666',
    margin: '10px 0 0 0'
  }
));

panel.add(ui.Label(
  'Note: Terrain-screening model only; does not include measured irradiance, land ownership, transmission access, or permitting constraints.',
  {
    fontSize: '10px',
    color: '#666',
    margin: '6px 0 0 0'
  }
));

Map.add(panel);


// -------------------------------
// 15) LEGEND — BOTTOM RIGHT
// -------------------------------
var legendPanel = ui.Panel({
  style: {
    position: 'bottom-right',
    padding: '10px',
    backgroundColor: 'white',
    width: '285px'
  }
});

legendPanel.add(ui.Label('Terrain-Based Solar Suitability Index', {
  fontWeight: 'bold',
  fontSize: '14px',
  margin: '0 0 6px 0'
}));

legendPanel.add(ui.Label('Relative suitability, 0–100', {
  fontSize: '11px',
  color: '#666',
  margin: '0 0 6px 0'
}));

var colorBar = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),
  params: {
    bbox: [0, 0, 1, 0.1],
    dimensions: '250x18',
    format: 'png',
    min: 0,
    max: 1,
    palette: suitabilityVis.palette
  },
  style: {
    stretch: 'horizontal',
    margin: '0 0 4px 0'
  }
});

legendPanel.add(colorBar);

legendPanel.add(ui.Label('Low suitability      Moderate      High suitability', {
  fontSize: '10px'
}));

legendPanel.add(ui.Label(
  'Dark red overlay = top 10% solar suitability zones.',
  {
    fontSize: '10px',
    color: '#666',
    margin: '8px 0 0 0'
  }
));

Map.add(legendPanel);


// -------------------------------
// 16) POPULATE METRICS
// -------------------------------
meanSuitability.evaluate(function(v) {
  meanLabel.setValue('Statewide mean suitability: ' + safeFormat(v, 1) + ' / 100');
});

maxSuitability.evaluate(function(v) {
  maxLabel.setValue('Statewide maximum suitability: ' + safeFormat(v, 1) + ' / 100');
});

highSuitPct.evaluate(function(v) {
  highSuitLabel.setValue('Area with suitability ≥70: ' + safeFormat(v, 1) + '% of state');
});

hotspotPct.evaluate(function(v) {
  hotspotLabel.setValue('Top 10% suitability zone area: ' + safeFormat(v, 1) + '% of state');
});

countyStats.limit(5).evaluate(function(fc) {
  countySummaryPanel.clear();

  if (!fc || !fc.features || fc.features.length === 0) {
    countySummaryPanel.add(ui.Label('No county summary available.', {fontSize: '12px'}));
    return;
  }

  fc.features.forEach(function(f) {
    var name = f.properties.NAME || 'Unknown';
    var val = f.properties.mean_suitability;

    countySummaryPanel.add(ui.Label(
      name + ': ' + safeFormat(val, 1) + ' / 100',
      {
        fontSize: '12px',
        margin: '0 0 4px 0'
      }
    ));
  });
});


// -------------------------------
// 17) UI EVENTS
// -------------------------------
countyCheckbox.onChange(function(checked) {
  countyLayer.setShown(checked);
});

hotspotCheckbox.onChange(function(checked) {
  hotspotLayer.setShown(checked);
});

slopeCheckbox.onChange(function(checked) {
  slopeLayer.setShown(checked);
});

aspectCheckbox.onChange(function(checked) {
  aspectLayer.setShown(checked);
});

elevationCheckbox.onChange(function(checked) {
  elevationScoreLayer.setShown(checked);
});

opacitySlider.onChange(function(value) {
  suitabilityLayer.setOpacity(value);
});


// ============================================================
// 18) EXPORTS
// ============================================================

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

function exportStyled(image, vis, name, includeCounties) {
  var finalImage = addBoundaries(
    image.visualize(vis),
    includeCounties
  );

  Export.image.toDrive({
    image: finalImage,
    description: name,
    folder: exportFolder,
    fileNamePrefix: name,
    region: stateGeom,
    scale: 1000,
    maxPixels: 1e13
  });
}


// Portfolio maps
exportStyled(
  suitabilityDisplay,
  suitabilityVis,
  'CA_Solar_Suitability_Main',
  true
);

exportStyled(
  hotspots,
  hotspotVis,
  'CA_Solar_Suitability_Top10Pct_Zones',
  true
);

exportStyled(
  slope,
  slopeVis,
  'CA_Solar_Slope_Context',
  true
);

exportStyled(
  aspect,
  aspectVis,
  'CA_Solar_Aspect_Context',
  true
);

exportStyled(
  elevationScore,
  elevationScoreVis,
  'CA_Solar_Elevation_Score_Context',
  true
);

// Combined hero map
var comboExport = suitabilityDisplay
  .visualize(suitabilityVis)
  .blend(hotspots.visualize({
    palette: ['7f0000'],
    forceRgbOutput: true
  }));

Export.image.toDrive({
  image: addBoundaries(comboExport, true),
  description: 'CA_Solar_Suitability_Hotspots_Hero',
  folder: exportFolder,
  fileNamePrefix: 'CA_Solar_Suitability_Hotspots_Hero',
  region: stateGeom,
  scale: 1000,
  maxPixels: 1e13
});


// County CSV
Export.table.toDrive({
  collection: countyStats.select([
    'STATEFP',
    'COUNTYFP',
    'NAME',
    'mean_suitability'
  ]),
  description: 'CA_Solar_County_Suitability_Table',
  folder: exportFolder,
  fileNamePrefix: 'CA_Solar_County_Suitability_Table',
  fileFormat: 'CSV'
});


// Statewide summary CSV
var summaryFC = ee.FeatureCollection([
  ee.Feature(null, {
    project: 'California Terrain-Based Solar Suitability',
    statewide_mean_suitability: meanSuitability,
    statewide_max_suitability: maxSuitability,
    area_suitability_gte_70_pct: highSuitPct,
    top_10_pct_suitability_zone_area_pct: hotspotPct,
    model_note: 'Terrain-screening model based on slope, aspect, and elevation; does not include measured irradiance, land ownership, transmission access, or permitting constraints.',
    data_sources: 'USGS SRTM DEM; TIGER/2018 boundaries'
  })
]);

Export.table.toDrive({
  collection: summaryFC,
  description: 'CA_Solar_Statewide_Summary',
  folder: exportFolder,
  fileNamePrefix: 'CA_Solar_Statewide_Summary',
  fileFormat: 'CSV'
});