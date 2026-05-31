# Methodology

## California Seasonal Temperature Dashboard

### Project Objective

The objective of this project is to analyze seasonal temperature patterns across California and identify departures from historical climate conditions through anomaly mapping.

The project utilizes ERA5-Land climate reanalysis data to calculate seasonal average temperatures and compare 2024 conditions against a 1991–2020 baseline.

---

## Study Area

The study area consists of the State of California, United States.

Administrative boundaries were obtained from TIGER/2018 State and County datasets.

---

## Data Sources

### ERA5-Land Monthly Aggregates

Provider: ECMWF

Variable:

* 2-meter air temperature

Temporal Coverage:

* Baseline Period: 1991–2020
* Analysis Year: 2024

Spatial Resolution:

* Approximately 9 km

---

## Workflow

### Step 1: Data Preparation

Monthly ERA5-Land temperature data were loaded into Google Earth Engine.

Temperature values were converted from Kelvin to Celsius using:

Temperature (°C) = Kelvin − 273.15

Fahrenheit values were calculated for dashboard display.

---

### Step 2: Seasonal Aggregation

Months were grouped into four climatological seasons:

Winter:

* December
* January
* February

Spring:

* March
* April
* May

Summer:

* June
* July
* August

Fall:

* September
* October
* November

Seasonal mean temperatures were calculated by averaging monthly values.

---

### Step 3: Baseline Construction

A climatological baseline was generated using data from 1991 through 2020.

For each season:

1. Seasonal averages were calculated for each year.
2. Seasonal means were averaged across the baseline period.
3. Baseline rasters were generated for statewide comparison.

---

### Step 4: Temperature Anomaly Calculation

Temperature anomalies were calculated as:

Anomaly = 2024 Temperature − Baseline Temperature

Positive values indicate warmer-than-average conditions.

Negative values indicate cooler-than-average conditions.

---

### Step 5: County-Level Statistics

County boundaries were used to calculate:

* Mean seasonal temperature
* Mean anomaly
* County rankings

Zonal statistics were computed within Google Earth Engine.

---

## Outputs

### Raster Products

* Winter Mean Temperature
* Spring Mean Temperature
* Summer Mean Temperature
* Fall Mean Temperature
* Seasonal Temperature Anomalies

### Tabular Outputs

* County Seasonal Temperature Summary
* County Temperature Anomaly Summary
* Statewide Seasonal Statistics

---

## Limitations

ERA5-Land is a modeled climate product and may not capture local microclimate conditions.

County-level averages can mask substantial variation within large counties.

Anomalies represent departures from a historical baseline and should not be interpreted as long-term climate trends.

---

## Skills Demonstrated

* Climate GIS
* Time-Series Analysis
* Raster Processing
* Spatial Statistics
* Dashboard Development
* Google Earth Engine
