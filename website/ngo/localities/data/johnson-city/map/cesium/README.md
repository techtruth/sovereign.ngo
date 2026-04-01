# Johnson City Cesium Layer Pack

This folder contains Cesium-optimized GeoJSON layers generated from the raw map exports in `../`.

## Why this exists

- Raw civic GIS exports are often too heavy for smooth in-browser Cesium rendering.
- The build process reduces geometry density and removes non-essential attributes.
- Output layers are tailored for the locality briefing map.

## Build

Run from repo root:

```bash
node website/ngo/localities/data/johnson-city/map/build-cesium-layers.js
```

Generated outputs:

- `city_limits.cesium.geojson`
- `county_boundaries.cesium.geojson`
- `transit_routes.cesium.geojson`
- `transit_stops.cesium.geojson`
- `hospitals.cesium.geojson`
- `build-summary.json`
