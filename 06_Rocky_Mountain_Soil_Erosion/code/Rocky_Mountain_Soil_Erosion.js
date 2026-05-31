// ============================================================
// ROCKY MOUNTAIN NATIONAL PARK SOIL EROSION RISK
// FINAL PORTFOLIO-READY GOOGLE EARTH ENGINE VERSION
//
// Purpose:
// Create a simplified RUSLE-style soil erosion risk screening map
// for Rocky Mountain National Park.
//
// Model:
// Soil Loss Proxy = R * K * LS * C * P
//
// Inputs:
// - R: CHIRPS annual rainfall proxy
// - K: constant soil erodibility proxy
// - LS: slope-derived terrain factor
// - C: Sentinel-2 NDVI vegetation-cover factor
// - P: conservation practice factor, constant = 1
//
// Outputs:
// ✅ Classified erosion risk map
// ✅ Continuous normalized soil loss map
// ✅ Extreme hotspot layer
// ✅ Summary statistics
// ✅ Portfolio hero export
// ✅ Supporting map exports
// ✅ Summary CSV export
//
// NOTE:
// This is a screening-level erosion susceptibility model,
// not a field-calibrated RUSLE implementation.
// ============================================================


// --------------------
// 1) STUDY AREA
// --------------------
var park = ee.FeatureCollection('WCMC/WDPA/current/polygons')
  .filter(ee.Filter.eq('NAME', 'Rocky Mountain National Park'));

var parkGeom = park.geometry();

Map.centerObject(park, 10);


// --------------------
// 2) CLEAN BASEMAP
// --------------------
var grayStyle = [
  {elementType: 'geometry', stylers: [{color: '#f2f2f2'}]},
  {elementType: 'labels.text.fill', stylers: [{color: '#666666'}]},
  {elementType: 'labels.text.stroke', stylers: [{color: '#ffffff'}]},
  {featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{color: '#c9c9c9'}]},
  {featureType: 'road', elementType: 'geometry', stylers: [{color: '#ffffff'}]},
  {featureType: 'road', elementType: 'geometry.stroke', stylers: [{color: '#dddddd'}]},
  {featureType: 'poi', stylers: [{visibility: 'off'}]},
  {featureType: 'transit', stylers: [{visibility: 'off'}]},
  {featureType: 'water', elementType: 'geometry', stylers: [{color: '#dbe9f4'}]}
];

Map.setOptions('GRAY', {'GRAY': grayStyle});
Map.setOptions('GRAY');


// --------------------
// 3) PARK OUTLINE
// --------------------
var parkOutline = ee.Image().byte().paint({
  featureCollection: park,
  color: 1,
  width: 2
});

var parkOutlineLayer = ui.Map.Layer(
  parkOutline.updateMask(parkOutline),
  {palette: ['#222222']},
  'Park boundary',
  true,
  1
);


// --------------------
// 4) PARAMETERS
// --------------------
var analysisYear = 2022;

var rainfallStart = analysisYear + '-01-01';
var rainfallEnd = analysisYear + '-12-31';

var vegetationStart = analysisYear + '-06-01';
var vegetationEnd = analysisYear + '-09-30';

var exportFolder = 'GEE_Exports';

var statsScale = 180;


// --------------------
// 5) DEM + TERRAIN
// --------------------
var dem = ee.Image('USGS/SRTMGL1_003')
  .select('elevation')
  .clip(parkGeom);

var slopeDeg = ee.Terrain.slope(dem)
  .rename('slope_deg');

var slopeRad = slopeDeg.multiply(Math.PI / 180);

var slopePct = slopeRad
  .tan()
  .multiply(100)
  .rename('slope_pct');


// --------------------
// 6) R FACTOR — RAINFALL PROXY
// --------------------
var annualRain = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
  .filterDate(rainfallStart, rainfallEnd)
  .filterBounds(parkGeom)
  .sum()
  .rename('annual_rain_mm')
  .clip(parkGeom);

// Simplified rainfall erosivity proxy
var R = annualRain
  .multiply(0.5)
  .rename('R');


// --------------------
// 7) K FACTOR — SOIL ERODIBILITY PROXY
// --------------------
var K = ee.Image.constant(0.20)
  .rename('K')
  .clip(parkGeom);


// --------------------
// 8) LS FACTOR — SLOPE LENGTH/STEEPNESS PROXY
// --------------------
var LS = slopePct
  .divide(9)
  .pow(1.3)
  .clamp(0, 15)
  .rename('LS');


// --------------------
// 9) C FACTOR — VEGETATION COVER FROM SENTINEL-2
// --------------------
function maskS2Clouds(img) {
  var qa = img.select('QA60');

  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return img
    .updateMask(mask)
    .divide(10000)
    .copyProperties(img, ['system:time_start']);
}

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterDate(vegetationStart, vegetationEnd)
  .filterBounds(parkGeom)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 40))
  .map(maskS2Clouds);

var s2Median = s2
  .median()
  .clip(parkGeom);

var ndvi = s2Median
  .normalizedDifference(['B8', 'B4'])
  .rename('NDVI');

// Higher NDVI = lower erosion cover factor
var C = ndvi.expression(
  'exp(-2 * n / (1.0001 - n))',
  {n: ndvi}
)
  .clamp(0, 1)
  .rename('C');


// --------------------
// 10) P FACTOR — CONSERVATION PRACTICE PROXY
// --------------------
var P = ee.Image.constant(1)
  .rename('P')
  .clip(parkGeom);


// --------------------
// 11) SOIL LOSS PROXY
// --------------------
var soilLoss = R
  .multiply(K)
  .multiply(LS)
  .multiply(C)
  .multiply(P)
  .rename('soil_loss')
  .clip(parkGeom);

var soilLossSmooth = soilLoss
  .focal_mean({
    radius: 1,
    units: 'pixels'
  })
  .rename('soil_loss');


// --------------------
// 12) SAFE HELPERS
// --------------------
function safeNumber(value, fallback) {
  return ee.Number(
    ee.Algorithms.If(value, value, fallback)
  );
}

function safeDictNumber(dict, key, fallback) {
  dict = ee.Dictionary(dict);
  return ee.Number(
    ee.Algorithms.If(dict.contains(key), dict.get(key), fallback)
  );
}


// --------------------
// 13) PERCENTILE BREAKS
// --------------------
var pctStats = soilLossSmooth.reduceRegion({
  reducer: ee.Reducer.percentile([25, 50, 75, 95]),
  geometry: parkGeom,
  scale: statsScale,
  bestEffort: true,
  tileScale: 4,
  maxPixels: 1e13
});

var p25 = safeDictNumber(pctStats, 'soil_loss_p25', 5);
var p50 = safeDictNumber(pctStats, 'soil_loss_p50', 15);
var p75 = safeDictNumber(pctStats, 'soil_loss_p75', 30);
var p95 = safeDictNumber(pctStats, 'soil_loss_p95', 60);


// --------------------
// 14) CLASSIFICATION
// --------------------
var low = soilLossSmooth.gt(0)
  .and(soilLossSmooth.lte(p25))
  .multiply(1);

var moderate = soilLossSmooth.gt(p25)
  .and(soilLossSmooth.lte(p50))
  .multiply(2);

var high = soilLossSmooth.gt(p50)
  .and(soilLossSmooth.lte(p75))
  .multiply(3);

var veryHigh = soilLossSmooth.gt(p75)
  .and(soilLossSmooth.lt(p95))
  .multiply(4);

var riskClass = low
  .add(moderate)
  .add(high)
  .add(veryHigh)
  .selfMask()
  .rename('risk_class');

var hotspots = soilLossSmooth
  .gte(p95)
  .selfMask()
  .rename('extreme_hotspots');

var soilLossNorm = soilLossSmooth
  .divide(p95)
  .clamp(0, 1)
  .rename('soil_loss_norm');

var soilLossNormDisplay = soilLossNorm
  .updateMask(soilLossSmooth.gt(1));


// --------------------
// 15) VISUALIZATION
// --------------------
var classVis = {
  min: 1,
  max: 4,
  palette: [
    '#fff7bc',
    '#fec44f',
    '#fc8d59',
    '#d7301f'
  ]
};

var continuousVis = {
  min: 0,
  max: 1,
  palette: [
    '#ffffcc',
    '#fed976',
    '#fd8d3c',
    '#e31a1c',
    '#800026'
  ]
};

var hotspotVis = {
  palette: ['#4d0000']
};

var slopeVis = {
  min: 0,
  max: 45,
  palette: ['#f7fbff', '#c6dbef', '#6baed6', '#2171b5']
};

var ndviVis = {
  min: 0,
  max: 0.8,
  palette: ['#ffffcc', '#c2e699', '#78c679', '#238443']
};


// --------------------
// 16) MAP LAYERS
// --------------------
var layerClassified = ui.Map.Layer(
  riskClass,
  classVis,
  'Soil erosion risk classes',
  true,
  0.65
);

var layerContinuous = ui.Map.Layer(
  soilLossNormDisplay,
  continuousVis,
  'Soil loss continuous',
  false,
  0.75
);

var layerHotspots = ui.Map.Layer(
  hotspots,
  hotspotVis,
  'Extreme hotspots top 5%',
  true,
  0.95
);

var layerSlope = ui.Map.Layer(
  slopeDeg,
  slopeVis,
  'Slope context',
  false,
  0.65
);

var layerNDVI = ui.Map.Layer(
  ndvi,
  ndviVis,
  'NDVI vegetation context',
  false,
  0.75
);

Map.layers().reset([
  layerClassified,
  layerContinuous,
  layerHotspots,
  layerSlope,
  layerNDVI,
  parkOutlineLayer
]);


// --------------------
// 17) SUMMARY STATS
// --------------------
var pixelArea = ee.Image.pixelArea().rename('area');

var totalAreaM2 = ee.Number(parkGeom.area(1));
var totalAreaKm2 = totalAreaM2.divide(1e6);

function classArea(mask) {
  var result = pixelArea
    .updateMask(mask)
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: parkGeom,
      scale: statsScale,
      bestEffort: true,
      tileScale: 4,
      maxPixels: 1e13
    });

  return safeDictNumber(result, 'area', 0);
}

function areaPct(areaM2) {
  return areaM2
    .divide(totalAreaM2)
    .multiply(100);
}

var meanSoilLoss = safeDictNumber(
  soilLossSmooth.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: parkGeom,
    scale: statsScale,
    bestEffort: true,
    tileScale: 4,
    maxPixels: 1e13
  }),
  'soil_loss',
  0
);

var maxSoilLoss = safeDictNumber(
  soilLossSmooth.reduceRegion({
    reducer: ee.Reducer.max(),
    geometry: parkGeom,
    scale: statsScale,
    bestEffort: true,
    tileScale: 4,
    maxPixels: 1e13
  }),
  'soil_loss',
  0
);

var lowArea = classArea(
  soilLossSmooth.gt(0).and(soilLossSmooth.lte(p25))
);

var moderateArea = classArea(
  soilLossSmooth.gt(p25).and(soilLossSmooth.lte(p50))
);

var highArea = classArea(
  soilLossSmooth.gt(p50).and(soilLossSmooth.lte(p75))
);

var veryHighArea = classArea(
  soilLossSmooth.gt(p75).and(soilLossSmooth.lt(p95))
);

var hotspotArea = classArea(
  soilLossSmooth.gte(p95)
);

var lowPct = areaPct(lowArea);
var moderatePct = areaPct(moderateArea);
var highPct = areaPct(highArea);
var veryHighPct = areaPct(veryHighArea);
var hotspotPct = areaPct(hotspotArea);

var highRiskPct = highPct.add(veryHighPct);
var hotspotAreaKm2 = hotspotArea.divide(1e6);


// --------------------
// 18) UI PANEL
// --------------------
var panel = ui.Panel({
  style: {
    position: 'top-left',
    width: '410px',
    padding: '12px',
    backgroundColor: 'white'
  }
});

panel.add(ui.Label('Rocky Mountain National Park Soil Erosion Risk', {
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 6px 0'
}));

panel.add(ui.Label(
  'Simplified RUSLE-style annual soil loss screening model using CHIRPS rainfall, SRTM terrain, Sentinel-2 vegetation cover, and WDPA park boundaries.',
  {
    fontSize: '12px',
    color: '#444',
    margin: '0 0 10px 0'
  }
));


// --------------------
// 19) LAYER CONTROLS
// --------------------
panel.add(ui.Label('Layers', {
  fontWeight: 'bold',
  margin: '8px 0 4px 0'
}));

function addToggle(label, layer, shown) {
  var cb = ui.Checkbox(label, shown);
  cb.onChange(function(checked) {
    layer.setShown(checked);
  });
  panel.add(cb);
}

addToggle('Risk classes', layerClassified, true);
addToggle('Continuous soil loss', layerContinuous, false);
addToggle('Extreme hotspots', layerHotspots, true);
addToggle('Slope context', layerSlope, false);
addToggle('NDVI context', layerNDVI, false);
addToggle('Park boundary', parkOutlineLayer, true);

panel.add(ui.Label('Risk layer opacity', {
  fontSize: '11px',
  color: '#666',
  margin: '8px 0 2px 0'
}));

var opacitySlider = ui.Slider({
  min: 0,
  max: 1,
  value: 0.65,
  step: 0.05,
  style: {stretch: 'horizontal'}
});

opacitySlider.onChange(function(val) {
  layerClassified.setOpacity(val);
  layerContinuous.setOpacity(val);
});

panel.add(opacitySlider);


// --------------------
// 20) LEGEND
// --------------------
panel.add(ui.Label('Legend', {
  fontWeight: 'bold',
  margin: '10px 0 4px 0'
}));

function legendRow(color, label) {
  var colorBox = ui.Label('', {
    backgroundColor: color,
    padding: '8px',
    margin: '0 0 6px 0'
  });

  var desc = ui.Label(label, {
    margin: '0 0 6px 6px',
    fontSize: '12px'
  });

  return ui.Panel(
    [colorBox, desc],
    ui.Panel.Layout.Flow('horizontal')
  );
}

panel.add(legendRow('#fff7bc', 'Low risk: 0–25th percentile'));
panel.add(legendRow('#fec44f', 'Moderate risk: 25th–50th percentile'));
panel.add(legendRow('#fc8d59', 'High risk: 50th–75th percentile'));
panel.add(legendRow('#d7301f', 'Very high risk: 75th–95th percentile'));
panel.add(legendRow('#4d0000', 'Extreme hotspots: top 5%'));


// --------------------
// 21) SUMMARY UI
// --------------------
panel.add(ui.Label('Summary', {
  fontWeight: 'bold',
  margin: '10px 0 4px 0'
}));

function fmtNumber(v, digits) {
  return (typeof v === 'number' && isFinite(v)) ? v.toFixed(digits) : 'N/A';
}

var meanLabel = ui.Label('Mean soil loss: calculating...', {fontSize: '12px'});
var maxLabel = ui.Label('Maximum soil loss: calculating...', {fontSize: '12px'});
var areaLabel = ui.Label('Mapped park area: calculating...', {fontSize: '12px'});
var highRiskLabel = ui.Label('High + very high risk area: calculating...', {fontSize: '12px'});
var hotspotLabel = ui.Label('Extreme hotspot area: calculating...', {fontSize: '12px'});
var breakdown1 = ui.Label('Low: calculating...', {fontSize: '12px'});
var breakdown2 = ui.Label('Moderate: calculating...', {fontSize: '12px'});
var breakdown3 = ui.Label('High: calculating...', {fontSize: '12px'});
var breakdown4 = ui.Label('Very high: calculating...', {fontSize: '12px'});

panel.add(meanLabel);
panel.add(maxLabel);
panel.add(areaLabel);
panel.add(highRiskLabel);
panel.add(hotspotLabel);
panel.add(breakdown1);
panel.add(breakdown2);
panel.add(breakdown3);
panel.add(breakdown4);

panel.add(ui.Label(
  'Highest risk zones are associated with steep slopes, sparse vegetation, and concentrated drainage corridors. Extreme hotspots indicate priority areas for conservation planning and field validation.',
  {
    fontSize: '10px',
    color: '#666',
    margin: '10px 0 0 0'
  }
));

panel.add(ui.Label(
  'Data: CHIRPS rainfall, SRTM DEM, Sentinel-2 SR Harmonized, WDPA protected-area boundaries.',
  {
    fontSize: '10px',
    color: '#666',
    margin: '8px 0 0 0'
  }
));

Map.add(panel);


// --------------------
// 22) POPULATE STATS
// --------------------
meanSoilLoss.evaluate(function(v) {
  meanLabel.setValue('Mean soil loss proxy: ' + fmtNumber(v, 2));
});

maxSoilLoss.evaluate(function(v) {
  maxLabel.setValue('Maximum soil loss proxy: ' + fmtNumber(v, 2));
});

totalAreaKm2.evaluate(function(v) {
  areaLabel.setValue('Mapped park area: ' + fmtNumber(v, 1) + ' km²');
});

highRiskPct.evaluate(function(v) {
  highRiskLabel.setValue('High + very high risk area: ' + fmtNumber(v, 1) + '%');
});

hotspotAreaKm2.evaluate(function(v) {
  hotspotLabel.setValue('Extreme hotspot area: ' + fmtNumber(v, 1) + ' km²');
});

lowPct.evaluate(function(v) {
  breakdown1.setValue('Low risk: ' + fmtNumber(v, 1) + '%');
});

moderatePct.evaluate(function(v) {
  breakdown2.setValue('Moderate risk: ' + fmtNumber(v, 1) + '%');
});

highPct.evaluate(function(v) {
  breakdown3.setValue('High risk: ' + fmtNumber(v, 1) + '%');
});

veryHighPct.evaluate(function(v) {
  breakdown4.setValue('Very high risk: ' + fmtNumber(v, 1) + '%');
});


// ============================================================
// 23) EXPORTS
// ============================================================
function addBoundary(rgbImage) {
  return rgbImage.blend(
    parkOutline.visualize({
      palette: ['222222'],
      forceRgbOutput: true
    })
  );
}

function exportStyled(image, vis, name) {
  var out = addBoundary(
    image.visualize(vis)
  );

  Export.image.toDrive({
    image: out,
    description: name,
    folder: exportFolder,
    fileNamePrefix: name,
    region: parkGeom,
    scale: 60,
    maxPixels: 1e13
  });
}


// Main portfolio exports
exportStyled(
  riskClass,
  classVis,
  'RMNP_Erosion_Risk_Classified'
);

exportStyled(
  soilLossNormDisplay,
  continuousVis,
  'RMNP_Erosion_Continuous_Normalized'
);

exportStyled(
  hotspots,
  hotspotVis,
  'RMNP_Erosion_Extreme_Hotspots'
);

// Hero export: continuous risk + hotspots + boundary
var combinedHero = soilLossNormDisplay
  .visualize(continuousVis)
  .blend(hotspots.visualize({
    palette: ['4d0000'],
    forceRgbOutput: true
  }))
  .blend(parkOutline.visualize({
    palette: ['222222'],
    forceRgbOutput: true
  }));

Export.image.toDrive({
  image: combinedHero,
  description: 'RMNP_Erosion_Combined_Hero',
  folder: exportFolder,
  fileNamePrefix: 'RMNP_Erosion_Combined_Hero',
  region: parkGeom,
  scale: 60,
  maxPixels: 1e13
});


// Context exports
exportStyled(
  slopeDeg,
  slopeVis,
  'RMNP_Slope_Context'
);

exportStyled(
  ndvi,
  ndviVis,
  'RMNP_NDVI_Context'
);


// Raw raster exports
Export.image.toDrive({
  image: soilLossSmooth,
  description: 'RMNP_Erosion_SoilLoss_RAW',
  folder: exportFolder,
  fileNamePrefix: 'RMNP_Erosion_SoilLoss_RAW',
  region: parkGeom,
  scale: 60,
  maxPixels: 1e13
});


// Summary CSV export
var summaryFC = ee.FeatureCollection([
  ee.Feature(null, {
    project: 'Rocky Mountain National Park Soil Erosion Risk',
    analysis_year: analysisYear,
    mean_soil_loss_proxy: meanSoilLoss,
    max_soil_loss_proxy: maxSoilLoss,
    park_area_km2: totalAreaKm2,
    low_risk_pct: lowPct,
    moderate_risk_pct: moderatePct,
    high_risk_pct: highPct,
    very_high_risk_pct: veryHighPct,
    high_plus_very_high_pct: highRiskPct,
    hotspot_area_km2: hotspotAreaKm2,
    hotspot_pct: hotspotPct,
    data_sources: 'CHIRPS rainfall; SRTM DEM; Sentinel-2 SR Harmonized; WDPA boundaries',
    model_note: 'Simplified RUSLE-style screening model, not field-calibrated RUSLE'
  })
]);

Export.table.toDrive({
  collection: summaryFC,
  description: 'RMNP_Erosion_Summary_CSV',
  folder: exportFolder,
  fileNamePrefix: 'RMNP_Erosion_Summary',
  fileFormat: 'CSV'
});