# Methodology

## California Terrain-Based Solar Suitability

### Project Objective

This project develops a terrain-based solar suitability screening model for California.

The goal is to identify locations with favorable topographic conditions for utility-scale solar development using slope, aspect, and elevation characteristics.

This model evaluates terrain only and does not include infrastructure, land ownership, environmental constraints, or actual solar irradiance.

---

## Study Area

State of California

Boundary Source:

* TIGER/2018 State Boundaries

---

## Data Sources

### NASA SRTM DEM

Provider:

* NASA Shuttle Radar Topography Mission

Resolution:

* 30 meters

Variables Derived:

* Elevation
* Slope
* Aspect

---

## Workflow

### Step 1: Elevation Processing

Elevation values were extracted from SRTM.

Moderate elevations were assigned higher suitability scores.

Very high elevations received reduced scores due to terrain complexity and access constraints.

---

### Step 2: Slope Analysis

Slope was calculated using terrain derivatives.

Suitability scores were assigned as follows:

* Flat terrain = highest suitability
* Moderate slopes = moderate suitability
* Steep terrain = lowest suitability

---

### Step 3: Aspect Analysis

Aspect was calculated from terrain orientation.

South-facing slopes received the highest scores because they generally receive greater solar exposure in the Northern Hemisphere.

North-facing slopes received lower scores.

---

### Step 4: Normalization

Slope, aspect, and elevation layers were normalized to a common 0–100 scale.

This allowed direct comparison among variables.

---

### Step 5: Weighted Overlay

Final suitability was calculated through weighted combination of:

* Slope
* Aspect
* Elevation

The resulting raster represents a relative terrain suitability index.

---

### Step 6: High-Suitability Zone Identification

Pixels within the highest 10% of suitability values were extracted as potential development zones.

---

## Outputs

### Raster Products

* Solar Suitability Index
* Slope Score
* Aspect Score
* Elevation Score
* Top 10% Suitability Zones

### Tabular Outputs

* County Suitability Rankings
* Statewide Summary Statistics

---

## Limitations

This is a terrain screening model.

The analysis does not include:

* Solar irradiance measurements
* Electrical infrastructure
* Land ownership
* Protected lands
* Environmental permitting
* Economic feasibility

Results should be interpreted as terrain suitability only.

---

## Skills Demonstrated

* Suitability Modeling
* Terrain Analysis
* Renewable Energy GIS
* Raster Math
* Multi-Criteria Evaluation
* Google Earth Engine
