// ============================================================
// PORTFOLIO VERSION — Louisiana Low-Elevation Population Exposure
// FINAL FIXED VERSION
//
// Fixes:
// ✅ Correct p90 hotspot threshold: risk_log_p90
// ✅ Correct p75 high exposure threshold: risk_log_p75
// ✅ Top 5 Parishes display in correct panel location
// ✅ No more High Exposure N/A% if valid data exists
// ✅ Cleaner portfolio-ready UI and exports
// ============================================================


// --------------------
// 1) Study Area
// --------------------
var states = ee.FeatureCollection('TIGER/2018/States');

var parishes = ee.FeatureCollection('TIGER/2018/Counties')
  .filter(ee.Filter.eq('STATEFP', '22'));

var louisiana = states.filter(ee.Filter.eq('NAME', 'Louisiana'));
var aoi = louisiana.geometry();

Map.centerObject(louisiana, 6);


// --------------------
// 2) Muted basemap
// --------------------
var grayStyle = [
  {elementType: 'geometry', stylers: [{color: '#f5f5f5'}]},
  {elementType: 'labels.text.fill', stylers: [{color: '#6b6b6b'}]},
  {elementType: 'labels.text.stroke', stylers: [{color: '#ffffff'}]},
  {featureType: 'road', stylers: [{visibility: 'off'}]},
  {featureType: 'poi', stylers: [{visibility: 'off'}]},
  {featureType: 'transit', stylers: [{visibility: 'off'}]},
  {featureType: 'water', elementType: 'geometry', stylers: [{color: '#dce9f7'}]}
];

Map.setOptions('GRAY', {'GRAY': grayStyle});
Map.setOptions('GRAY');


// --------------------
// 3) Data
// --------------------
var dem = ee.Image('USGS/SRTMGL1_003')
  .select('elevation')
  .clip(aoi);

var population = ee.ImageCollection('WorldPop/GP/100m/pop')
  .filterDate('2020-01-01', '2020-12-31')
  .mean()
  .rename('pop')
  .clip(aoi);

var water = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
  .select('occurrence')
  .clip(aoi);

var notWater = water.lt(90);


// --------------------
// 4) Elevation weighting model
// --------------------
// Full exposure weight at <=10 m
// Gradual taper from 10–25 m
// Zero above 25 m
var elevWeight = dem.expression(
  'e <= 10 ? 1 : e <= 25 ? (25 - e) / 15 : 0',
  {e: dem}
).rename('elev_weight');


// --------------------
// 5) Exposure surface
// --------------------
var risk = population
  .updateMask(notWater)
  .multiply(elevWeight)
  .rename('risk');

var riskSmooth = risk
  .focal_mean({radius: 2, units: 'pixels'})
  .rename('risk_smooth');

var riskLog = riskSmooth
  .add(1)
  .log10()
  .rename('risk_log');


// --------------------
// 6) Percentile thresholds
// --------------------
var percentileStats = riskLog.reduceRegion({
  reducer: ee.Reducer.percentile([2, 75, 90, 98]),
  geometry: aoi,
  scale: 100,
  bestEffort: true,
  maxPixels: 1e13
});

var p2 = ee.Number(percentileStats.get('risk_log_p2'));
var p75 = ee.Number(percentileStats.get('risk_log_p75'));
var p90 = ee.Number(percentileStats.get('risk_log_p90'));
var p98 = ee.Number(percentileStats.get('risk_log_p98'));

var hotspots = riskLog.gte(p90).selfMask().rename('hotspots');
var highExposureMask = riskLog.gte(p75).selfMask().rename('high_exposure');


// --------------------
// 7) Visualization
// --------------------
var minVal = p2.getInfo();
var maxVal = p98.getInfo();

if (minVal === null || minVal === undefined || !isFinite(minVal)) minVal = 0;
if (maxVal === null || maxVal === undefined || !isFinite(maxVal)) maxVal = 2.3;
if (maxVal <= minVal) {
  minVal = 0;
  maxVal = 2.3;
}

var riskVis = {
  min: minVal,
  max: maxVal,
  palette: [
    '#fff5f0',
    '#fcbba1',
    '#fc9272',
    '#fb6a4a',
    '#de2d26',
    '#99000d'
  ]
};

var hotspotVis = {
  palette: ['#4a0000']
};


// --------------------
// 8) Map layers
// --------------------
var hillshade = ee.Terrain.hillshade(dem).clip(aoi);

var hillshadeLayer = ui.Map.Layer(
  hillshade,
  {min: 0, max: 255},
  'Hillshade',
  true,
  0.06
);

var riskLayer = ui.Map.Layer(
  riskLog,
  riskVis,
  'Population exposure',
  true,
  0.9
);

var hotspotLayer = ui.Map.Layer(
  hotspots,
  hotspotVis,
  'Top 10% hotspots',
  true,
  0.6
);

var parishLayer = ui.Map.Layer(
  parishes.style({
    color: '888888',
    width: 0.5,
    fillColor: '00000000'
  }),
  {},
  'Parish boundaries',
  false,
  0.35
);

var outlineLayer = ui.Map.Layer(
  louisiana.style({
    color: '000000',
    fillColor: '00000000',
    width: 1.5
  }),
  {},
  'Louisiana boundary',
  true,
  1
);

Map.layers().reset([
  hillshadeLayer,
  riskLayer,
  hotspotLayer,
  parishLayer,
  outlineLayer
]);


// --------------------
// 9) Parish analysis
// --------------------
var parishStats = riskSmooth.reduceRegions({
  collection: parishes,
  reducer: ee.Reducer.sum(),
  scale: 100
}).map(function(f) {
  return f.set('exposed_population', f.get('sum'));
});

var topParishes = parishStats
  .sort('exposed_population', false)
  .limit(5);


// --------------------
// 10) Summary metrics
// --------------------
var totalExposed = ee.Number(riskSmooth.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: aoi,
  scale: 100,
  bestEffort: true,
  maxPixels: 1e13
}).get('risk_smooth'));

var totalArea = ee.Number(ee.Image.pixelArea().reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: aoi,
  scale: 100,
  bestEffort: true,
  maxPixels: 1e13
}).get('area'));

var exposedArea = ee.Number(ee.Image.pixelArea()
  .updateMask(riskSmooth.gt(0))
  .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 100,
    bestEffort: true,
    maxPixels: 1e13
  }).get('area'));

var exposedAreaPct = exposedArea
  .divide(totalArea)
  .multiply(100);

var highArea = ee.Number(ee.Image.pixelArea()
  .updateMask(highExposureMask)
  .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 100,
    bestEffort: true,
    maxPixels: 1e13
  }).get('area'));

var highPct = highArea
  .divide(totalArea)
  .multiply(100);


// --------------------
// 11) UI panel
// --------------------
var panel = ui.Panel({
  style: {
    position: 'top-left',
    width: '390px',
    padding: '12px',
    backgroundColor: 'white'
  }
});

panel.add(ui.Label('Louisiana Population Exposure (≤10m)', {
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 6px 0'
}));

panel.add(ui.Label(
  'Highlights where population is most vulnerable to sea-level rise. Exposure is weighted by low elevation, smoothed for readability, and masked over permanent water.',
  {
    fontSize: '12px',
    color: '#555',
    margin: '0 0 10px 0'
  }
));

var totalLabel = ui.Label('Exposed population: calculating...', {
  fontSize: '12px',
  margin: '0 0 6px 0'
});

var areaLabel = ui.Label('State area with nonzero exposure: calculating...', {
  fontSize: '12px',
  margin: '0 0 6px 0'
});

var highLabel = ui.Label('High exposure zones (Top 25%): calculating...', {
  fontSize: '12px',
  margin: '0 0 10px 0'
});

panel.add(totalLabel);
panel.add(areaLabel);
panel.add(highLabel);


// Metrics
totalExposed.evaluate(function(v) {
  var formatted = Math.round(v || 0).toLocaleString();
  totalLabel.setValue('Exposed population: ' + formatted);
});

exposedAreaPct.evaluate(function(v) {
  var formatted = (typeof v === 'number' && isFinite(v)) ? v.toFixed(1) : 'N/A';
  areaLabel.setValue('State area with nonzero exposure: ' + formatted + '%');
});

highPct.evaluate(function(v) {
  var formatted = (typeof v === 'number' && isFinite(v)) ? v.toFixed(1) : 'N/A';
  highLabel.setValue('High exposure zones (Top 25%): ' + formatted + '%');
});


// Layer controls
panel.add(ui.Label('Risk layer opacity', {
  fontSize: '11px',
  color: '#666',
  margin: '6px 0 2px 0'
}));

var opacitySlider = ui.Slider({
  min: 0,
  max: 1,
  value: 0.9,
  step: 0.05,
  style: {stretch: 'horizontal'}
});

opacitySlider.onChange(function(val) {
  riskLayer.setOpacity(val);
});

panel.add(opacitySlider);

var parishCheckbox = ui.Checkbox('Show parish boundaries', false);
parishCheckbox.onChange(function(checked) {
  parishLayer.setShown(checked);
});
panel.add(parishCheckbox);


// Top parishes section
panel.add(ui.Label('Top 5 Parishes', {
  fontWeight: 'bold',
  margin: '10px 0 4px 0'
}));

var parishSummaryPanel = ui.Panel();
panel.add(parishSummaryPanel);

topParishes.evaluate(function(fc) {
  parishSummaryPanel.clear();

  if (!fc || !fc.features || fc.features.length === 0) {
    parishSummaryPanel.add(ui.Label('No parish summary available.'));
    return;
  }

  fc.features.forEach(function(f) {
    var name = f.properties.NAME || 'Unknown';
    var val = Math.round(f.properties.exposed_population || 0);

    parishSummaryPanel.add(ui.Label(name + ': ' + val.toLocaleString(), {
      fontSize: '12px',
      margin: '0 0 4px 0'
    }));
  });
});


// Legend
panel.add(ui.Label('Legend', {
  fontWeight: 'bold',
  margin: '10px 0 4px 0'
}));

function row(color, label) {
  return ui.Panel(
    [
      ui.Label('', {
        backgroundColor: color,
        padding: '8px',
        margin: '0 0 6px 0'
      }),
      ui.Label(label, {
        margin: '0 0 6px 6px',
        fontSize: '12px'
      })
    ],
    ui.Panel.Layout.Flow('horizontal')
  );
}

panel.add(row('#fff5f0', 'Low population exposure'));
panel.add(row('#fb6a4a', 'Moderate exposure'));
panel.add(row('#de2d26', 'High exposure'));
panel.add(row('#4a0000', 'Extreme hotspots (Top 10%)'));

panel.add(ui.Label(
  'Exposure is concentrated along coastal and delta regions, with hotspot clusters indicating priority zones for climate adaptation and planning.',
  {
    fontSize: '11px',
    color: '#555',
    margin: '10px 0 0 0'
  }
));

panel.add(ui.Label(
  'Mapped values use log10(smoothed population + 1) for readability. Elevation weighting is full at ≤10 m and tapers to zero by 25 m.',
  {
    fontSize: '10px',
    color: '#666',
    margin: '10px 0 0 0'
  }
));

panel.add(ui.Label(
  'Data: WorldPop 2020, SRTM DEM, JRC Global Surface Water, TIGER/2018 boundaries.',
  {
    fontSize: '10px',
    color: '#666',
    margin: '8px 0 0 0'
  }
));

Map.add(panel);


// ============================================================
// 12) EXPORTS
// ============================================================

function addBoundary(img) {
  return img.blend(
    louisiana.style({
      color: '000000',
      fillColor: '00000000',
      width: 1.5
    })
  );
}

function exportMap(image, vis, name) {
  var visImg = image.visualize(vis);
  var finalImg = addBoundary(visImg);

  Export.image.toDrive({
    image: finalImg,
    description: name,
    folder: 'GEE_Exports',
    fileNamePrefix: name,
    region: aoi,
    scale: 100,
    maxPixels: 1e13
  });
}


// Main exposure map
exportMap(
  riskLog,
  riskVis,
  'LA_PopExposure_Main'
);

// Hotspot map
exportMap(
  hotspots,
  hotspotVis,
  'LA_PopExposure_Hotspots'
);

// Combined exposure + hotspot hero map
var combined = riskLog.visualize(riskVis)
  .blend(hotspots.visualize({
    palette: ['4a0000'],
    forceRgbOutput: true
  }));

Export.image.toDrive({
  image: addBoundary(combined),
  description: 'LA_PopExposure_Combined_Hero',
  folder: 'GEE_Exports',
  fileNamePrefix: 'LA_PopExposure_Combined_Hero',
  region: aoi,
  scale: 100,
  maxPixels: 1e13
});

// Elevation weighting explanation map
exportMap(
  elevWeight,
  {min: 0, max: 1, palette: ['white', 'blue']},
  'LA_Elevation_Weight'
);

// Population base map
exportMap(
  population,
  {min: 0, max: 1000, palette: ['white', 'purple']},
  'LA_Population_Base'
);

// Raw smoothed exposure raster
Export.image.toDrive({
  image: riskSmooth,
  description: 'LA_PopExposure_Smoothed_RAW',
  folder: 'GEE_Exports',
  fileNamePrefix: 'LA_PopExposure_Smoothed_RAW',
  region: aoi,
  scale: 100,
  maxPixels: 1e13
});

// Parish CSV table
Export.table.toDrive({
  collection: parishStats,
  description: 'LA_PopExposure_Parish_Table',
  folder: 'GEE_Exports',
  fileNamePrefix: 'LA_PopExposure_Parish_Table',
  fileFormat: 'CSV'
});