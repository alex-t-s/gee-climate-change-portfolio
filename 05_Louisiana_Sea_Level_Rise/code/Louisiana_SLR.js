// ============================================================
// Coastal Louisiana Sea Level Rise (SLR) Exposure Mapping
// Top-10% upgrades (clean + recruiter-ready):
// ✅ Multi-scenario SLR (0.5 / 1.0 / 2.0 m) selector
// ✅ Permanent water mask (JRC GSW) + slope mask (reduces bathtub artifacts)
// ✅ Speckle cleanup: focal mode + minimum mapping unit (connected pixels)
// ✅ Parish exposure stats (km² + %) + CSV export
// ✅ Clean cartography: muted basemap, semi-transparent overlay, tidy legend
//
// NOTE: This is a screening-level “bathtub” exposure map (static DEM), not a
// hydrodynamic inundation model.
// ============================================================


// --------------------
// 1) Area of Interest: Coastal Parishes (LA)
// --------------------
var parishes = ee.FeatureCollection('TIGER/2018/Counties')
  .filter(ee.Filter.eq('STATEFP', '22')); // Louisiana

var coastalNames = [
  'Plaquemines','St. Bernard','Jefferson','Orleans','Lafourche','Terrebonne',
  'St. Mary','Iberia','Vermilion','Cameron','St. Tammany','St. Charles',
  'St. John the Baptist','St. James','Ascension'
];

var coastalParishes = parishes.filter(ee.Filter.inList('NAME', coastalNames));
var aoi = coastalParishes.geometry();

Map.centerObject(coastalParishes, 8);


// --------------------
// 2) Basemap styling (muted)
// --------------------
var grayStyle = [
  {elementType: 'geometry', stylers: [{color: '#f2f2f2'}]},
  {elementType: 'labels.text.fill', stylers: [{color: '#6b6b6b'}]},
  {elementType: 'labels.text.stroke', stylers: [{color: '#ffffff'}]},
  {featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{color: '#c9c9c9'}]},
  {featureType: 'road', elementType: 'geometry', stylers: [{color: '#ffffff'}]},
  {featureType: 'road', elementType: 'geometry.stroke', stylers: [{color: '#d7d7d7'}]},
  {featureType: 'poi', stylers: [{visibility: 'off'}]},
  {featureType: 'transit', stylers: [{visibility: 'off'}]},
  {featureType: 'water', elementType: 'geometry', stylers: [{color: '#d9e7f5'}]}
];
Map.setOptions('GRAY', {'GRAY': grayStyle});
Map.setOptions('GRAY');


// --------------------
// 3) DEM + slope
// --------------------
var dem = ee.Image('NASA/NASADEM_HGT/001')
  .select('elevation')
  .clip(aoi);

var slope = ee.Terrain.slope(dem).rename('slope');


// --------------------
// 4) Permanent water mask (JRC GSW occurrence)
// --------------------
var gswOcc = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
  .select('occurrence')
  .clip(aoi);

var notPermanentWater = gswOcc.lt(90);


// --------------------
// 5) Scenario + cleanup parameters
// --------------------
var scenarios = [0.5, 1.0, 2.0];
var DEFAULT_SLR = 1.0;

var MAX_SLOPE_DEG = 5;       // suppress steep pixels
var SMOOTH_RADIUS_PX = 1;    // light smoothing
var MIN_PATCH_PIXELS = 50;   // remove tiny speckle patches


// --------------------
// 6) Visualization
// --------------------
var demVis = {
  min: -2,
  max: 10,
  palette: ['#2b83ba', '#abdda4', '#fdae61', '#d7191c']
};

var inundationVis = {palette: ['#d73027']}; // red overlay


// --------------------
// 7) Inundation builder (bathtub proxy + cleanup)
// --------------------
function makeInundation(slrMeters) {
  slrMeters = ee.Number(slrMeters);

  // bathtub threshold
  var raw = dem.lte(slrMeters).rename('inund_raw');

  // refinement masks
  var slopeMask = slope.lte(MAX_SLOPE_DEG);

  var masked = raw
    .updateMask(notPermanentWater)
    .updateMask(slopeMask);

  // clean speckle (binary majority-like)
  var smoothed = masked
    .unmask(0)
    .focal_mode({radius: SMOOTH_RADIUS_PX, units: 'pixels'})
    .rename('inund_smoothed');

  // minimum mapping unit
  var connected = smoothed.connectedPixelCount(100, true);
  var cleaned = smoothed.updateMask(connected.gte(MIN_PATCH_PIXELS));

  return cleaned.selfMask().rename('inundation');
}


// --------------------
// 8) Parish outline + map layers
// --------------------
var parishOutline = coastalParishes.style({
  color: 'ffffff',
  fillColor: '00000000',
  width: 2
});

var layerDEM = ui.Map.Layer(dem, demVis, 'Elevation (m)', true, 0.55);
var layerInund = ui.Map.Layer(makeInundation(DEFAULT_SLR), inundationVis,
  'Potential inundation (≤ 1.0 m)', true, 0.45);
var layerParishes = ui.Map.Layer(parishOutline, {}, 'Coastal parishes', true, 1.0);

Map.layers().reset([layerDEM, layerInund, layerParishes]);


// --------------------
// 9) Exposure stats by parish (km² + %)
// --------------------
function parishExposureTable(inundationImg) {
  var area = ee.Image.pixelArea().rename('area');
  var inundArea = area.updateMask(inundationImg);

  var fc = coastalParishes.map(function (f) {
    var geom = f.geometry();

    var inund_m2 = ee.Number(inundArea.reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: geom,
      scale: 30,
      maxPixels: 1e13
    }).get('area'));

    var total_m2 = ee.Number(area.reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: geom,
      scale: 30,
      maxPixels: 1e13
    }).get('area'));

    var inund_km2 = inund_m2.divide(1e6);
    var inund_pct = inund_m2.divide(total_m2).multiply(100);

    return f.set({
      inund_km2: inund_km2,
      inund_pct: inund_pct
    });
  });

  return fc.sort('inund_km2', false);
}


// --------------------
// 10) UI Panel (no unsupported 'overflow' style)
// --------------------
var panel = ui.Panel({
  style: {
    position: 'top-left',
    width: '360px',
    padding: '12px',
    backgroundColor: 'white'
  }
});

panel.add(ui.Label('Coastal Louisiana Sea Level Rise Exposure', {
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 6px 0'
}));

panel.add(ui.Label(
  'Google Earth Engine | NASADEM + JRC Global Surface Water\n' +
  'Screening-level SLR exposure (static DEM) with cleanup + parish stats.',
  {fontSize: '12px', color: '#444', margin: '0 0 10px 0'}
));

// Scenario selector
panel.add(ui.Label('SLR scenario (meters)', {fontWeight: 'bold', margin: '6px 0 4px 0'}));

var slrSelect = ui.Select({
  items: scenarios.map(function(x){ return x.toFixed(1); }),
  value: DEFAULT_SLR.toFixed(1),
  style: {stretch: 'horizontal'}
});
panel.add(slrSelect);

// Inundation opacity
panel.add(ui.Label('Inundation opacity', {fontSize: '11px', color: '#666', margin: '8px 0 2px 0'}));
var inundOpacity = ui.Slider({
  min: 0, max: 1, value: 0.45, step: 0.05,
  style: {stretch: 'horizontal'}
});
panel.add(inundOpacity);

// Legend
panel.add(ui.Label('Legend', {fontWeight: 'bold', margin: '10px 0 4px 0'}));

function legendRow(color, name) {
  var colorBox = ui.Label({style: {backgroundColor: color, padding: '8px', margin: '0 0 6px 0'}});
  var description = ui.Label({value: name, style: {margin: '0 0 6px 6px', fontSize: '12px'}});
  return ui.Panel({widgets: [colorBox, description], layout: ui.Panel.Layout.Flow('horizontal')});
}

panel.add(legendRow('#d73027', 'Potential inundation (scenario)'));
panel.add(legendRow('#2b83ba', 'Lower elevation'));
panel.add(legendRow('#d7191c', 'Higher elevation'));

// Stats section (simple, no overflow style)
panel.add(ui.Label('Parish exposure (top 8)', {fontWeight: 'bold', margin: '10px 0 4px 0'}));
var statsBox = ui.Panel({style: {margin: '0 0 0 0'}});
panel.add(statsBox);

panel.add(ui.Label(
  'Refinements: permanent-water mask + slope ≤ ' + MAX_SLOPE_DEG +
  '° + smoothing + min patch (' + MIN_PATCH_PIXELS + ' px).',
  {fontSize: '10px', color: '#666', margin: '8px 0 0 0'}
));

panel.add(ui.Label(
  'Data: NASADEM (NASA), JRC Global Surface Water, TIGER/2018 Counties',
  {fontSize: '10px', color: '#666', margin: '10px 0 0 0'}
));

Map.add(panel);


// --------------------
// 11) Render scenario + update stats
// --------------------
function renderScenario(slrMetersString) {
  var slr = ee.Number.parse(slrMetersString);
  var inund = makeInundation(slr);

  layerInund.setEeObject(inund);
  layerInund.setName('Potential inundation (≤ ' + slrMetersString + ' m)');
  layerInund.setOpacity(inundOpacity.getValue());

  // Update stats
  statsBox.clear();
  var table = parishExposureTable(inund);

  // Display top 8
  var topList = table.toList(8);
  for (var i = 0; i < 8; i++) {
    var f = ee.Feature(topList.get(i));
    ee.Dictionary({
      name: f.get('NAME'),
      km2: ee.Number(f.get('inund_km2')).format('%.1f'),
      pct: ee.Number(f.get('inund_pct')).format('%.1f')
    }).evaluate(function(d){
      statsBox.add(ui.Label(
        d.name + ': ' + d.km2 + ' km² (' + d.pct + '%)',
        {fontSize: '12px', margin: '0 0 4px 0'}
      ));
    });
  }
}

slrSelect.onChange(function(val){ renderScenario(val); });
inundOpacity.onChange(function(val){ layerInund.setOpacity(val); });

// initial render
renderScenario(DEFAULT_SLR.toFixed(1));


// --------------------
// 12) EXPORTS (optional)
// --------------------
// Tip: Export RAW inundation (0/1 mask) for GIS workflows, style in QGIS/ArcGIS.
// Uncomment the loop to queue exports for all scenarios.

function exportScenario(slrMeters) {
  var slrStr = slrMeters.toFixed(1);
  var inund = makeInundation(slrMeters);

  Export.image.toDrive({
    image: inund,
    description: 'LA_Inundation_' + slrStr + 'm_RAW',
    folder: 'GEE_Exports',
    fileNamePrefix: 'LA_Inundation_' + slrStr + 'm_RAW',
    region: aoi,
    scale: 30,
    maxPixels: 1e13
  });

  var inundStyled = inund.visualize({palette: ['#d73027']});
  Export.image.toDrive({
    image: inundStyled,
    description: 'LA_Inundation_' + slrStr + 'm_Styled',
    folder: 'GEE_Exports',
    fileNamePrefix: 'LA_Inundation_' + slrStr + 'm_Styled',
    region: aoi,
    scale: 30,
    maxPixels: 1e13
  });
}

// Uncomment to export all scenarios:
// scenarios.forEach(function(s){ exportScenario(s); });


// Export default scenario exposure table as CSV
var exposureFC = parishExposureTable(makeInundation(DEFAULT_SLR))
  .select(['NAME', 'inund_km2', 'inund_pct', 'STATEFP', 'COUNTYFP']);

Export.table.toDrive({
  collection: exposureFC,
  description: 'LA_Parish_Exposure_' + DEFAULT_SLR.toFixed(1) + 'm_CSV',
  folder: 'GEE_Exports',
  fileNamePrefix: 'LA_Parish_Exposure_' + DEFAULT_SLR.toFixed(1) + 'm',
  fileFormat: 'CSV'
});

// ============================================================
// 13) EXPORT MAPS (PORTFOLIO SET)
// ============================================================

// Helper: add parish boundary for clean visuals
function addBoundary(img) {
  return img.blend(
    coastalParishes.style({
      color: 'ffffff',
      fillColor: '00000000',
      width: 2
    })
  );
}

// Helper export function
function exportStyled(slrMeters) {
  var slrStr = slrMeters.toFixed(1);
  var inund = makeInundation(slrMeters);

  var styled = inund.visualize({palette: ['#d73027']});
  var finalImg = addBoundary(styled);

  Export.image.toDrive({
    image: finalImg,
    description: 'LA_SLR_' + slrStr + 'm',
    folder: 'GEE_Exports',
    fileNamePrefix: 'LA_SLR_' + slrStr + 'm',
    region: aoi,
    scale: 30,
    maxPixels: 1e13
  });
}

// ------------------------------
// EXPORT 3 SCENARIOS
// ------------------------------
exportStyled(0.5);
exportStyled(1.0);
exportStyled(2.0);