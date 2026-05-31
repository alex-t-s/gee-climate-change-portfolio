// ============================================================
// EVERGLADES HYDROPERIOD ANALYSIS
// FINAL WORKING PORTFOLIO VERSION
//
// Purpose:
// Analyze long-term surface-water persistence and hydroperiod change
// in the Everglades using JRC Global Surface Water YearlyHistory.
//
// Final fixes:
// ✅ Focused Everglades AOI
// ✅ Map layer displays correctly
// ✅ Less noisy than original version
// ✅ Threshold reduced from 8% to 5%
// ✅ Patch cleanup reduced from 30 pixels to 8 pixels
// ✅ Fixed significant trend area calculation
// ✅ Working summary metrics
// ✅ Portfolio map exports
// ✅ CSV summary export
//
// Hydroperiod = % of years classified as seasonal or permanent water.
// ============================================================


// --------------------
// 1) STUDY AREA
// --------------------
var aoi = ee.Geometry.Rectangle([
  -81.55, 25.05,
  -80.25, 26.85
]);

Map.centerObject(aoi, 9);


// --------------------
// 2) MUTED BASEMAP
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
  {featureType: 'water', elementType: 'geometry', stylers: [{color: '#d9e7f5'}]}
];

Map.setOptions('GRAY', {'GRAY': grayStyle});
Map.setOptions('GRAY');


// --------------------
// 3) AOI OUTLINE
// --------------------
var aoiFeature = ee.FeatureCollection([ee.Feature(aoi)]);

var aoiOutline = ee.Image().byte().paint({
  featureCollection: aoiFeature,
  color: 1,
  width: 2
});

var aoiLayer = ui.Map.Layer(
  aoiOutline.updateMask(aoiOutline),
  {palette: ['#111111']},
  'AOI boundary',
  true,
  0.9
);


// --------------------
// 4) JRC YEARLY WATER DATA
// --------------------
var jrc = ee.ImageCollection('JRC/GSW1_4/YearlyHistory')
  .filterBounds(aoi)
  .filterDate('1984-01-01', '2020-12-31');

// waterClass:
// 0 = no data
// 1 = not water
// 2 = seasonal water
// 3 = permanent water
var waterBinary = jrc.map(function(img) {
  var wc = img.select('waterClass');

  var water = wc.eq(2).or(wc.eq(3))
    .rename('water')
    .toFloat();

  return water
    .updateMask(wc.neq(0))
    .copyProperties(img, ['system:time_start']);
});


// --------------------
// 5) HYDROPERIOD
// --------------------
function hydroperiodPercent(collection) {
  return collection
    .sum()
    .divide(collection.count())
    .multiply(100)
    .clip(aoi);
}

var before = waterBinary.filterDate('1984-01-01', '2000-12-31');
var after  = waterBinary.filterDate('2001-01-01', '2020-12-31');

var hpBefore = hydroperiodPercent(before).rename('hp_before');
var hpAfter  = hydroperiodPercent(after).rename('hp_after');

var hpChangeRaw = hpAfter
  .subtract(hpBefore)
  .rename('hp_change_raw')
  .clip(aoi);


// --------------------
// 6) CLEAN CHANGE MAP
// --------------------
var DEFAULT_THRESHOLD = 5;
var MIN_PATCH_PIXELS = 8;

var hpChangeSmooth = hpChangeRaw
  .focal_mean({
    radius: 1,
    units: 'pixels'
  })
  .rename('hp_change_smooth');

function cleanChangeLayer(threshold) {
  threshold = ee.Number(threshold);

  var thresholded = hpChangeSmooth
    .updateMask(hpChangeSmooth.abs().gte(threshold))
    .rename('hp_change_thresholded');

  var patchMask = thresholded
    .unmask(0)
    .neq(0);

  var patchSize = patchMask.connectedPixelCount(100, true);

  return thresholded
    .updateMask(patchSize.gte(MIN_PATCH_PIXELS))
    .rename('hp_change_clean');
}

var hpChangeDisplay = cleanChangeLayer(DEFAULT_THRESHOLD);


// --------------------
// 7) TREND ANALYSIS
// --------------------
var startYear = 1984;
var endYear = 2020;
var years = ee.List.sequence(startYear, endYear);

var annual = ee.ImageCollection.fromImages(
  years.map(function(y) {
    y = ee.Number(y);

    var start = ee.Date.fromYMD(y, 1, 1);
    var end = start.advance(1, 'year');

    var pctWater = waterBinary
      .filterDate(start, end)
      .mean()
      .multiply(100)
      .rename('pctWater');

    var yearBand = ee.Image.constant(y)
      .toFloat()
      .rename('year');

    return pctWater
      .addBands(yearBand)
      .set('year', y)
      .set('system:time_start', start.millis());
  })
);

var fit = annual
  .select(['year', 'pctWater'])
  .reduce(ee.Reducer.linearFit());

var slope = fit
  .select('scale')
  .rename('slope_pct_per_year')
  .clip(aoi);

var corr = annual
  .select(['year', 'pctWater'])
  .reduce(ee.Reducer.pearsonsCorrelation());

var r = corr
  .select('correlation')
  .rename('r')
  .clip(aoi);

var N_YEARS = endYear - startYear + 1;
var DF = N_YEARS - 2;
var T_CRIT = 2.03;
var R_CRIT = T_CRIT / Math.sqrt(T_CRIT * T_CRIT + DF);

var sigMask = r.abs().gte(R_CRIT);

var slopeSig = slope
  .updateMask(sigMask)
  .rename('slope_sig_pct_per_year');


// --------------------
// 8) VISUALIZATION
// --------------------
var hpPalette = [
  '#f7fbff',
  '#deebf7',
  '#c6dbef',
  '#9ecae1',
  '#6baed6',
  '#3182bd',
  '#08519c'
];

var changePalette = [
  '#b2182b',
  '#ef8a62',
  '#f7f7f7',
  '#67a9cf',
  '#2166ac'
];

var hpVis = {
  min: 0,
  max: 100,
  palette: hpPalette
};

var changeVis = {
  min: -30,
  max: 30,
  palette: changePalette
};

var slopeVis = {
  min: -2,
  max: 2,
  palette: changePalette
};


// --------------------
// 9) SUMMARY METRICS
// --------------------
var statsScale = 300;

function safeNumber(value, fallback) {
  return ee.Number(
    ee.Algorithms.If(value, value, fallback)
  );
}

function meanValue(image, bandName) {
  return safeNumber(
    image.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: aoi,
      scale: statsScale,
      bestEffort: true,
      maxPixels: 1e13
    }).get(bandName),
    0
  );
}

function areaPct(maskImage) {
  var area = ee.Image.pixelArea().rename('area');

  var maskedArea = safeNumber(
    area.updateMask(maskImage)
      .reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: statsScale,
        bestEffort: true,
        maxPixels: 1e13
      }).get('area'),
    0
  );

  var totalArea = safeNumber(
    area.reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: statsScale,
      bestEffort: true,
      maxPixels: 1e13
    }).get('area'),
    1
  );

  return maskedArea.divide(totalArea).multiply(100);
}

var meanBefore = meanValue(hpBefore, 'hp_before');
var meanAfter = meanValue(hpAfter, 'hp_after');
var meanChange = meanValue(hpChangeSmooth, 'hp_change_smooth');

var increasedPct = areaPct(hpChangeSmooth.gte(DEFAULT_THRESHOLD));
var decreasedPct = areaPct(hpChangeSmooth.lte(DEFAULT_THRESHOLD * -1));
var sigTrendPct = areaPct(sigMask);


// --------------------
// 10) MAP LAYERS
// --------------------
var layerChange = ui.Map.Layer(
  hpChangeDisplay,
  changeVis,
  'Hydroperiod change',
  true,
  0.8
);

var layerBefore = ui.Map.Layer(
  hpBefore,
  hpVis,
  'Hydroperiod 1984–2000',
  false,
  0.85
);

var layerAfter = ui.Map.Layer(
  hpAfter,
  hpVis,
  'Hydroperiod 2001–2020',
  false,
  0.85
);

var layerSlope = ui.Map.Layer(
  slope,
  slopeVis,
  'Trend slope',
  false,
  0.85
);

var layerSlopeSig = ui.Map.Layer(
  slopeSig,
  slopeVis,
  'Significant trend only',
  false,
  0.9
);

Map.layers().reset([
  layerChange,
  layerBefore,
  layerAfter,
  layerSlope,
  layerSlopeSig,
  aoiLayer
]);


// --------------------
// 11) UI PANEL
// --------------------
var panel = ui.Panel({
  style: {
    position: 'top-left',
    width: '405px',
    padding: '12px',
    backgroundColor: 'white'
  }
});

panel.add(ui.Label('Everglades Hydroperiod Analysis', {
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 6px 0'
}));

panel.add(ui.Label(
  'Surface-water persistence and change analysis using JRC Global Surface Water YearlyHistory. Hydroperiod = percentage of years classified as seasonal or permanent water.',
  {
    fontSize: '12px',
    color: '#444',
    margin: '0 0 10px 0'
  }
));

panel.add(ui.Label('Summary Metrics', {
  fontWeight: 'bold',
  margin: '8px 0 4px 0'
}));

var beforeLabel = ui.Label('Mean hydroperiod 1984–2000: calculating...', {fontSize: '12px'});
var afterLabel = ui.Label('Mean hydroperiod 2001–2020: calculating...', {fontSize: '12px'});
var changeLabel = ui.Label('Mean hydroperiod change: calculating...', {fontSize: '12px'});
var increaseLabel = ui.Label('Area with increased hydroperiod: calculating...', {fontSize: '12px'});
var decreaseLabel = ui.Label('Area with decreased hydroperiod: calculating...', {fontSize: '12px'});
var sigLabel = ui.Label('Approx. significant trend area: calculating...', {fontSize: '12px'});

panel.add(beforeLabel);
panel.add(afterLabel);
panel.add(changeLabel);
panel.add(increaseLabel);
panel.add(decreaseLabel);
panel.add(sigLabel);

function fmt(v, digits) {
  return (typeof v === 'number' && isFinite(v)) ? v.toFixed(digits) : 'N/A';
}

meanBefore.evaluate(function(v) {
  beforeLabel.setValue('Mean hydroperiod 1984–2000: ' + fmt(v, 1) + '%');
});

meanAfter.evaluate(function(v) {
  afterLabel.setValue('Mean hydroperiod 2001–2020: ' + fmt(v, 1) + '%');
});

meanChange.evaluate(function(v) {
  changeLabel.setValue('Mean hydroperiod change: ' + fmt(v, 1) + ' percentage points');
});

increasedPct.evaluate(function(v) {
  increaseLabel.setValue('Area with increased hydroperiod ≥ ' + DEFAULT_THRESHOLD + '%: ' + fmt(v, 1) + '%');
});

decreasedPct.evaluate(function(v) {
  decreaseLabel.setValue('Area with decreased hydroperiod ≤ -' + DEFAULT_THRESHOLD + '%: ' + fmt(v, 1) + '%');
});

sigTrendPct.evaluate(function(v) {
  sigLabel.setValue('Approx. significant trend area: ' + fmt(v, 1) + '%');
});


// --------------------
// 12) LAYER CONTROLS
// --------------------
panel.add(ui.Label('Layers', {
  fontWeight: 'bold',
  margin: '10px 0 4px 0'
}));

function addToggle(label, layer, shown) {
  var cb = ui.Checkbox(label, shown);
  cb.onChange(function(checked) {
    layer.setShown(checked);
    refreshLegend();
  });
  panel.add(cb);
}

addToggle('Hydroperiod change', layerChange, true);
addToggle('Hydroperiod 1984–2000', layerBefore, false);
addToggle('Hydroperiod 2001–2020', layerAfter, false);
addToggle('Trend slope', layerSlope, false);
addToggle('Significant trend only', layerSlopeSig, false);
addToggle('AOI boundary', aoiLayer, true);


// --------------------
// 13) THRESHOLD CONTROL
// --------------------
panel.add(ui.Label('Change threshold', {
  fontWeight: 'bold',
  margin: '10px 0 2px 0'
}));

var thresholdLabel = ui.Label(DEFAULT_THRESHOLD + '%', {
  fontSize: '11px',
  color: '#444'
});

var thresholdSlider = ui.Slider({
  min: 3,
  max: 20,
  value: DEFAULT_THRESHOLD,
  step: 1,
  style: {stretch: 'horizontal'}
});

thresholdSlider.onChange(function(value) {
  thresholdLabel.setValue(value + '%');
  layerChange.setEeObject(cleanChangeLayer(value));
});

panel.add(thresholdSlider);
panel.add(thresholdLabel);


// --------------------
// 14) OPACITY
// --------------------
panel.add(ui.Label('Layer opacity', {
  fontSize: '11px',
  color: '#666',
  margin: '8px 0 2px 0'
}));

var opacitySlider = ui.Slider({
  min: 0,
  max: 1,
  value: 0.8,
  step: 0.05,
  style: {stretch: 'horizontal'}
});

opacitySlider.onChange(function(value) {
  layerChange.setOpacity(value);
  layerBefore.setOpacity(value);
  layerAfter.setOpacity(value);
  layerSlope.setOpacity(value);
  layerSlopeSig.setOpacity(value);
});

panel.add(opacitySlider);


// --------------------
// 15) LEGEND
// --------------------
var legendPanel = ui.Panel({
  style: {margin: '10px 0 0 0'}
});
panel.add(legendPanel);

function makeColorBar(palette) {
  return ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0),
    params: {
      bbox: [0, 0, 1, 0.1],
      dimensions: '260x18',
      format: 'png',
      min: 0,
      max: 1,
      palette: palette
    },
    style: {
      stretch: 'horizontal',
      margin: '0 0 4px 0'
    }
  });
}

function setLegend(title, minLabel, midLabel, maxLabel, palette) {
  legendPanel.clear();

  legendPanel.add(ui.Label(title, {
    fontWeight: 'bold',
    margin: '0 0 4px 0'
  }));

  legendPanel.add(makeColorBar(palette));

  var labels = ui.Panel({
    layout: ui.Panel.Layout.Flow('horizontal'),
    style: {stretch: 'horizontal'}
  });

  labels.add(ui.Label(minLabel, {fontSize: '10px'}));
  labels.add(ui.Label('', {stretch: 'horizontal'}));
  labels.add(ui.Label(midLabel, {fontSize: '10px'}));
  labels.add(ui.Label('', {stretch: 'horizontal'}));
  labels.add(ui.Label(maxLabel, {fontSize: '10px'}));

  legendPanel.add(labels);
}

function refreshLegend() {
  if (layerSlopeSig.getShown()) {
    setLegend('Significant trend (% water/year)', '-2', '0', '+2', changePalette);
  } else if (layerSlope.getShown()) {
    setLegend('Trend slope (% water/year)', '-2', '0', '+2', changePalette);
  } else if (layerAfter.getShown()) {
    setLegend('Hydroperiod 2001–2020 (%)', '0', '50', '100', hpPalette);
  } else if (layerBefore.getShown()) {
    setLegend('Hydroperiod 1984–2000 (%)', '0', '50', '100', hpPalette);
  } else {
    setLegend('Hydroperiod change (percentage points)', '-30', '0', '+30', changePalette);
  }
}

refreshLegend();

panel.add(ui.Label(
  'Recommended hero view: Hydroperiod change + AOI boundary only.',
  {
    fontSize: '10px',
    color: '#666',
    margin: '10px 0 0 0'
  }
));

panel.add(ui.Label(
  'Data: JRC Global Surface Water YearlyHistory, 1984–2020.',
  {
    fontSize: '10px',
    color: '#666',
    margin: '8px 0 0 0'
  }
));

Map.add(panel);


// ============================================================
// 16) EXPORTS
// ============================================================
var exportFolder = 'GEE_Exports';

function addAOIBorder(rgbImage) {
  return rgbImage.blend(
    aoiOutline.visualize({
      palette: ['111111'],
      forceRgbOutput: true
    })
  );
}

function exportStyled(image, vis, name) {
  Export.image.toDrive({
    image: addAOIBorder(image.visualize(vis)),
    description: name,
    folder: exportFolder,
    fileNamePrefix: name,
    region: aoi,
    scale: 30,
    maxPixels: 1e13
  });
}

exportStyled(
  hpChangeDisplay,
  changeVis,
  'Everglades_Hydroperiod_Change_Hero'
);

exportStyled(
  hpBefore,
  hpVis,
  'Everglades_Hydroperiod_1984_2000'
);

exportStyled(
  hpAfter,
  hpVis,
  'Everglades_Hydroperiod_2001_2020'
);

exportStyled(
  slope,
  slopeVis,
  'Everglades_Hydroperiod_Trend_Slope'
);

exportStyled(
  slopeSig,
  slopeVis,
  'Everglades_Hydroperiod_Significant_Trend'
);

Export.image.toDrive({
  image: hpChangeSmooth,
  description: 'Everglades_Hydroperiod_Change_RAW',
  folder: exportFolder,
  fileNamePrefix: 'Everglades_Hydroperiod_Change_RAW',
  region: aoi,
  scale: 30,
  maxPixels: 1e13
});

var summaryFC = ee.FeatureCollection([
  ee.Feature(null, {
    project: 'Everglades Hydroperiod Analysis',
    period_1: '1984-2000',
    period_2: '2001-2020',
    mean_hydroperiod_1984_2000: meanBefore,
    mean_hydroperiod_2001_2020: meanAfter,
    mean_change_percentage_points: meanChange,
    increased_area_pct: increasedPct,
    decreased_area_pct: decreasedPct,
    significant_trend_area_pct: sigTrendPct,
    default_threshold_pct: DEFAULT_THRESHOLD,
    data_source: 'JRC Global Surface Water YearlyHistory'
  })
]);

Export.table.toDrive({
  collection: summaryFC,
  description: 'Everglades_Hydroperiod_Summary_CSV',
  folder: exportFolder,
  fileNamePrefix: 'Everglades_Hydroperiod_Summary',
  fileFormat: 'CSV'
});