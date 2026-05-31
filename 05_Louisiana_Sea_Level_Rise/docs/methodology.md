# Methodology

## Louisiana Sea-Level Rise Exposure Analysis

### Project Objective

The objective of this project is to evaluate potential land exposure under multiple sea-level rise scenarios across coastal Louisiana.

The project uses digital elevation data, hydrologic constraints, and parish-level statistics to identify areas that may be susceptible to future inundation.

The analysis is intended as a screening-level planning tool for climate adaptation and coastal resilience applications.

---

## Study Area

The study area includes the State of Louisiana with emphasis on coastal and low-elevation environments.

Parish boundaries were used for statistical reporting.

---

## Data Sources

### NASADEM Digital Elevation Model

Provider:

* NASA

Spatial Resolution:

* 30 meters

Purpose:

* Elevation-based inundation screening

---

### JRC Global Surface Water

Provider:

* European Commission Joint Research Centre

Purpose:

* Identification of permanent water bodies

---

### TIGER/2018 Parish Boundaries

Provider:

* U.S. Census Bureau

Purpose:

* Parish-level reporting

---

## Sea-Level Rise Scenarios

Three hypothetical scenarios were evaluated:

### Scenario A

0.5 meters

Represents moderate sea-level rise conditions.

---

### Scenario B

1.0 meter

Represents a commonly used planning scenario for long-term adaptation studies.

---

### Scenario C

2.0 meters

Represents a high-end screening scenario.

---

## Workflow

### Step 1: Elevation Preparation

NASADEM elevation data were loaded and clipped to Louisiana.

The DEM serves as the foundation for all inundation calculations.

---

### Step 2: Water Body Removal

Permanent water bodies were identified using the JRC Global Surface Water dataset.

Existing water surfaces were excluded from inundation calculations.

---

### Step 3: Elevation Threshold Mapping

For each scenario:

* 0.5 m
* 1.0 m
* 2.0 m

Pixels below the specified elevation threshold were identified.

---

### Step 4: Coastal Connectivity Screening

Distance-to-water calculations were used to prioritize areas connected to existing coastal water systems.

This step reduces isolated inland depressions that are unlikely to experience direct marine inundation.

---

### Step 5: Slope Filtering

Slope constraints were applied to remove unrealistic isolated terrain artifacts.

This produces a more coherent inundation surface.

---

### Step 6: Exposure Statistics

Exposure areas were summarized by parish.

Metrics include:

* Total exposed area
* Relative parish rankings
* Scenario comparisons

---

## Outputs

### Raster Products

* SLR 0.5m Scenario
* SLR 1.0m Scenario
* SLR 2.0m Scenario
* Elevation Context Layer
* Distance-to-Water Mask

### Tables

* Parish Exposure Summary (0.5m)
* Parish Exposure Summary (1.0m)
* Parish Exposure Summary (2.0m)

---

## Key Findings

Results illustrate how potential exposure expands substantially under higher sea-level rise scenarios.

The 1.0-meter scenario provides a useful balance between conservative and high-end planning assumptions and serves as the primary portfolio visualization.

---

## Limitations

This project is not a hydrodynamic flood model.

The analysis does not simulate:

* Tides
* Storm surge
* Wave action
* Subsidence
* Levee performance
* Groundwater effects

Results should be interpreted as screening-level inundation potential.

---

## Skills Demonstrated

* Coastal GIS
* Climate Adaptation Planning
* Sea-Level Rise Analysis
* Raster Processing
* Hazard Mapping
* Environmental Modeling
* Google Earth Engine
