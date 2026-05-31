# Methodology

## Rocky Mountain National Park Soil Erosion Risk Assessment

### Project Objective

The purpose of this project is to identify areas within Rocky Mountain National Park that may be more susceptible to soil erosion.

A simplified erosion susceptibility model was developed using rainfall, terrain, and vegetation indicators inspired by concepts from the Revised Universal Soil Loss Equation (RUSLE).

The project is intended to support environmental monitoring, conservation planning, and landscape management.

---

## Study Area

Rocky Mountain National Park, Colorado, USA.

The study area was derived from protected-area boundaries and clipped to the park extent.

---

## Data Sources

### CHIRPS Rainfall

Provider:

* Climate Hazards Group

Purpose:

* Rainfall erosivity proxy

---

### NASA SRTM DEM

Provider:

* NASA

Purpose:

* Terrain and slope calculations

---

### Sentinel-2 Surface Reflectance

Provider:

* European Space Agency

Purpose:

* Vegetation condition assessment

---

### WDPA Protected Areas

Provider:

* World Database on Protected Areas

Purpose:

* National park boundary definition

---

## Workflow

### Step 1: Rainfall Factor

CHIRPS precipitation data were aggregated to represent relative rainfall intensity across the study area.

Higher rainfall totals generally correspond to greater erosion potential.

---

### Step 2: Terrain Factor

Slope was derived from the DEM.

Steeper slopes were assigned higher erosion susceptibility because they promote runoff and soil transport.

---

### Step 3: Vegetation Factor

Normalized Difference Vegetation Index (NDVI) was calculated from Sentinel-2 imagery.

Higher vegetation cover reduces erosion susceptibility by stabilizing soils and reducing runoff velocity.

Areas with sparse vegetation received higher risk scores.

---

### Step 4: Normalization

All model components were normalized to a common scale.

This allows comparison and combination of variables with different units.

---

### Step 5: Composite Erosion Index

Rainfall, slope, and vegetation factors were combined to create a continuous erosion susceptibility surface.

Higher values indicate relatively greater erosion potential.

---

### Step 6: Risk Classification

Continuous results were classified into categories:

* Very Low
* Low
* Moderate
* High
* Very High

These classes provide a more interpretable representation of erosion susceptibility.

---

### Step 7: Hotspot Identification

Extreme erosion zones were extracted using percentile thresholds.

These hotspots represent locations that may warrant closer monitoring or management attention.

---

## Outputs

### Raster Products

* Classified Erosion Risk
* Continuous Erosion Surface
* Extreme Hotspots
* Slope Context Layer
* NDVI Context Layer

### Tables

* Park Summary Statistics

### Dashboard Components

* Risk Map
* Summary Metrics
* Histogram
* Hotspot Layer

---

## Key Findings

Results indicate that erosion susceptibility is strongly influenced by steep terrain and vegetation cover.

Hotspot areas generally occur where steep slopes coincide with reduced vegetative protection.

---

## Limitations

This project is a simplified susceptibility model and is not a complete RUSLE implementation.

The model does not include:

* Soil texture
* Detailed land cover classifications
* Runoff measurements
* Sediment transport modeling
* Field validation

Results should be interpreted as relative erosion susceptibility rather than actual soil loss rates.

---

## Skills Demonstrated

* Environmental GIS
* Terrain Analysis
* Remote Sensing
* Raster Modeling
* Conservation Planning
* Risk Assessment
* Google Earth Engine

