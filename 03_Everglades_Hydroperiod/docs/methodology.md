# Methodology

## Everglades Hydroperiod Analysis

### Project Objective

The purpose of this project is to evaluate long-term surface-water persistence and hydrologic change within the Florida Everglades.

Hydroperiod is defined as the percentage of years that a location is classified as seasonal or permanent water.

---

## Study Area

Florida Everglades

The analysis was limited to a focused Everglades Area of Interest (AOI) to improve performance and reduce noise from surrounding regions.

---

## Data Sources

### JRC Global Surface Water Yearly History

Provider:

* Joint Research Centre (European Commission)

Temporal Coverage:

* 1984–2020

Spatial Resolution:

* 30 meters

Water Classes:

* No Water
* Seasonal Water
* Permanent Water

---

## Workflow

### Step 1: Annual Water Classification

Yearly water classification layers were loaded for all available years.

Pixels classified as seasonal or permanent water were considered hydrologically active.

---

### Step 2: Hydroperiod Calculation

Hydroperiod was calculated as:

Hydroperiod (%) =
(Number of Water Years ÷ Total Years) × 100

Values range from:

* 0% = never water
* 100% = always water

---

### Step 3: Historical Comparison

Two periods were analyzed:

1984–2000

2001–2020

Hydroperiod was calculated independently for each period.

---

### Step 4: Change Detection

Hydroperiod change was calculated as:

2001–2020 Hydroperiod − 1984–2000 Hydroperiod

Positive values indicate increased water persistence.

Negative values indicate decreased water persistence.

---

### Step 5: Trend Analysis

Linear trends were estimated using annual hydroperiod observations.

Trend slope indicates direction and magnitude of hydrologic change.

---

### Step 6: Significant Trend Mapping

Only statistically meaningful trends were retained in the significant trend layer.

Small isolated artifacts were removed using connected-pixel filtering.

---

## Outputs

### Raster Products

* Hydroperiod Change
* Hydroperiod 1984–2000
* Hydroperiod 2001–2020
* Trend Slope
* Significant Trend Layer

### Tabular Outputs

* Hydroperiod Summary Statistics

---

## Limitations

Hydroperiod estimates depend on satellite observations and classification accuracy.

Short-duration flooding events may not always be captured.

Observed changes may reflect both climatic variability and water-management practices.

This project is intended as a screening-level hydrologic assessment.

---

## Skills Demonstrated

* Environmental Monitoring
* Surface Water Analysis
* Change Detection
* Remote Sensing
* Time-Series GIS
* Google Earth Engine
