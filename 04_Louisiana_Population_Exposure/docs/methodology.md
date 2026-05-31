# Methodology

## Louisiana Population Exposure Assessment

### Project Objective

The purpose of this project is to identify areas where population concentrations overlap with low-elevation coastal environments that may be vulnerable to future climate-related hazards including sea-level rise, storm surge, and coastal flooding.

The analysis combines population distribution data with elevation and hydrologic constraints to create a screening-level population exposure model.

This project is intended to support climate resilience planning, vulnerability assessments, and environmental risk communication.

---

## Study Area

The study area consists of the State of Louisiana, with emphasis on low-lying coastal and near-coastal regions.

Parish boundaries were used for administrative reporting and statistical summaries.

---

## Data Sources

### WorldPop Population Data

Provider:

* WorldPop Project

Spatial Resolution:

* Approximately 100 meters

Purpose:

* Estimate spatial distribution of population

---

### NASADEM Digital Elevation Model

Provider:

* NASA

Spatial Resolution:

* 30 meters

Purpose:

* Identify low-elevation environments

---

### JRC Global Surface Water

Provider:

* European Commission Joint Research Centre

Purpose:

* Remove permanent water bodies from analysis

---

### TIGER/2018 Parish Boundaries

Provider:

* U.S. Census Bureau

Purpose:

* Parish-level statistical reporting

---

## Workflow

### Step 1: Population Surface Preparation

WorldPop population data were loaded and clipped to Louisiana.

The dataset provides estimated population counts per grid cell and serves as the primary representation of human exposure.

---

### Step 2: Elevation-Based Vulnerability Screening

Elevation values were extracted from NASADEM.

Lower elevations received higher exposure weighting because low-lying landscapes are generally more susceptible to flooding and sea-level rise impacts.

Higher elevations received lower exposure weighting.

---

### Step 3: Water Masking

Permanent water bodies were identified using the JRC Global Surface Water dataset.

Permanent water pixels were removed to ensure exposure calculations focused on inhabited land areas.

---

### Step 4: Exposure Surface Development

Population density and elevation weighting were combined to create a relative exposure surface.

Areas containing both:

* Higher population density
* Lower elevation

received higher exposure scores.

---

### Step 5: Spatial Smoothing

A neighborhood smoothing operation was applied to reduce isolated pixel noise and improve visualization.

This process emphasizes broader exposure patterns rather than individual pixel anomalies.

---

### Step 6: Hotspot Identification

Percentile thresholds were calculated statewide.

Areas within the highest exposure percentile range were classified as hotspot zones.

These areas represent locations where concentrated population and environmental vulnerability intersect.

---

### Step 7: Parish-Level Summaries

Exposure statistics were summarized for each parish.

Outputs include:

* Mean exposure values
* Relative rankings
* Parish comparison metrics

---

## Outputs

### Raster Products

* Population Exposure Surface
* Exposure Hotspots
* Population Base Layer
* Elevation Weight Layer

### Tabular Outputs

* Parish Exposure Summary Table

### Dashboard Components

* Exposure Map
* Summary Statistics
* Parish Rankings
* Distribution Charts

---

## Key Findings

The analysis highlights several population centers located within low-elevation landscapes where future climate-related hazards may create elevated vulnerability.

Results demonstrate how population and physical geography can be integrated to support resilience planning.

---

## Limitations

This project is a screening-level assessment.

The model does not include:

* Flood frequency
* Storm surge simulations
* Levee protection systems
* Building-level exposure
* Infrastructure vulnerability
* Future population projections

Exposure scores should be interpreted as relative indicators rather than direct measures of risk.

---

## Skills Demonstrated

* Climate Vulnerability Assessment
* Population Analysis
* Environmental GIS
* Raster Modeling
* Risk Mapping
* Spatial Statistics
* Google Earth Engine

