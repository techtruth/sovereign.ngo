#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const sourceDir = __dirname;
const outDir = path.join(sourceDir, 'cesium');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const writeJson = (filePath, value) => fs.writeFileSync(filePath, JSON.stringify(value));
const ensureDir = (dirPath) => fs.mkdirSync(dirPath, { recursive: true });

const roundCoord = (value, places = 6) => Number(Number(value).toFixed(places));

const sqDistance = (a, b) => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return (dx * dx) + (dy * dy);
};

const sqSegmentDistance = (p, a, b) => {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;

  if (dx !== 0 || dy !== 0) {
    const t = (((p[0] - x) * dx) + ((p[1] - y) * dy)) / ((dx * dx) + (dy * dy));
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = p[0] - x;
  dy = p[1] - y;
  return (dx * dx) + (dy * dy);
};

const simplifyRdp = (coords, tolerance) => {
  if (!Array.isArray(coords) || coords.length <= 2) return coords || [];
  const sqTolerance = tolerance * tolerance;
  const markers = new Uint8Array(coords.length);
  markers[0] = 1;
  markers[coords.length - 1] = 1;

  const stack = [[0, coords.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let maxSqDist = 0;
    let index = -1;

    for (let i = first + 1; i < last; i += 1) {
      const sqDist = sqSegmentDistance(coords[i], coords[first], coords[last]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (maxSqDist > sqTolerance && index > -1) {
      markers[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  const simplified = [];
  for (let i = 0; i < coords.length; i += 1) {
    if (markers[i]) simplified.push(coords[i]);
  }
  return simplified;
};

const normalizePoint = (coord) => [roundCoord(coord[0]), roundCoord(coord[1])];

const simplifyLine = (coords, tolerance) => {
  const points = (coords || [])
    .filter((coord) => Array.isArray(coord) && coord.length >= 2 && Number.isFinite(coord[0]) && Number.isFinite(coord[1]))
    .map(normalizePoint);
  if (points.length <= 2) return points;
  return simplifyRdp(points, tolerance);
};

const simplifyRing = (coords, tolerance) => {
  const ring = (coords || [])
    .filter((coord) => Array.isArray(coord) && coord.length >= 2 && Number.isFinite(coord[0]) && Number.isFinite(coord[1]))
    .map(normalizePoint);

  if (ring.length < 4) return ring;

  const first = ring[0];
  const last = ring[ring.length - 1];
  const closed = first[0] === last[0] && first[1] === last[1];
  const openRing = closed ? ring.slice(0, -1) : ring.slice();
  const simplified = simplifyRdp(openRing, tolerance);

  while (simplified.length < 3 && openRing.length > simplified.length) {
    simplified.push(openRing[simplified.length]);
  }

  if (simplified.length < 3) return ring;
  simplified.push([simplified[0][0], simplified[0][1]]);
  return simplified;
};

const simplifyGeometry = (geometry, tolerance) => {
  if (!geometry || typeof geometry !== 'object') return null;
  const { type, coordinates } = geometry;
  if (!type || coordinates == null) return null;

  if (type === 'Point') {
    if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
    return { type, coordinates: normalizePoint(coordinates) };
  }

  if (type === 'MultiPoint') {
    const points = (coordinates || [])
      .filter((coord) => Array.isArray(coord) && coord.length >= 2)
      .map(normalizePoint);
    return { type, coordinates: points };
  }

  if (type === 'LineString') {
    return { type, coordinates: simplifyLine(coordinates, tolerance) };
  }

  if (type === 'MultiLineString') {
    const lines = (coordinates || [])
      .map((line) => simplifyLine(line, tolerance))
      .filter((line) => Array.isArray(line) && line.length >= 2);
    return { type, coordinates: lines };
  }

  if (type === 'Polygon') {
    const rings = (coordinates || [])
      .map((ring, index) => simplifyRing(ring, index === 0 ? tolerance : tolerance * 0.7))
      .filter((ring) => Array.isArray(ring) && ring.length >= 4);
    return { type, coordinates: rings };
  }

  if (type === 'MultiPolygon') {
    const polygons = (coordinates || [])
      .map((poly) => (poly || [])
        .map((ring, index) => simplifyRing(ring, index === 0 ? tolerance : tolerance * 0.7))
        .filter((ring) => Array.isArray(ring) && ring.length >= 4))
      .filter((poly) => Array.isArray(poly) && poly.length > 0);
    return { type, coordinates: polygons };
  }

  return null;
};

const pickProps = (props, keys) => {
  const out = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(props, key) && props[key] !== null && props[key] !== '') {
      out[key] = props[key];
    }
  }
  return out;
};

const summarizeCoords = (geometry) => {
  const count = (coords) => {
    if (Array.isArray(coords) && typeof coords[0] === 'number') return 1;
    if (Array.isArray(coords)) return coords.reduce((sum, item) => sum + count(item), 0);
    return 0;
  };
  return geometry ? count(geometry.coordinates) : 0;
};

const transformFile = ({
  inputFile,
  outputFile,
  tolerance,
  propertyKeys,
  staticProps = {}
}) => {
  const src = readJson(path.join(sourceDir, inputFile));
  const inputFeatures = Array.isArray(src.features) ? src.features : [];

  let inCoords = 0;
  let outCoords = 0;
  const outFeatures = [];

  for (const feature of inputFeatures) {
    const geometry = simplifyGeometry(feature.geometry, tolerance);
    if (!geometry) continue;
    inCoords += summarizeCoords(feature.geometry);
    outCoords += summarizeCoords(geometry);

    const props = feature.properties && typeof feature.properties === 'object' ? feature.properties : {};
    const selected = pickProps(props, propertyKeys);
    outFeatures.push({
      type: 'Feature',
      properties: { ...selected, ...staticProps },
      geometry
    });
  }

  const out = {
    type: 'FeatureCollection',
    name: outputFile.replace(/\.geojson$/i, ''),
    features: outFeatures
  };

  const outPath = path.join(outDir, outputFile);
  writeJson(outPath, out);
  const inSize = fs.statSync(path.join(sourceDir, inputFile)).size;
  const outSize = fs.statSync(outPath).size;

  return {
    inputFile,
    outputFile,
    inFeatures: inputFeatures.length,
    outFeatures: outFeatures.length,
    inCoords,
    outCoords,
    inSize,
    outSize
  };
};

const main = () => {
  ensureDir(outDir);

  const reports = [];
  reports.push(transformFile({
    inputFile: 'City_Limits.geojson',
    outputFile: 'city_limits.cesium.geojson',
    tolerance: 0.00012,
    propertyKeys: ['NAME', 'GEOTYPE', 'SQ_MI_CALC'],
    staticProps: { layerType: 'city_boundary' }
  }));
  reports.push(transformFile({
    inputFile: 'County_Boundaries.geojson',
    outputFile: 'county_boundaries.cesium.geojson',
    tolerance: 0.00025,
    propertyKeys: ['NAME', 'FULLFIPS', 'SQ_MI_CALC'],
    staticProps: { layerType: 'county_boundary' }
  }));
  reports.push(transformFile({
    inputFile: 'Transit_Routes.geojson',
    outputFile: 'transit_routes.cesium.geojson',
    tolerance: 0.00005,
    propertyKeys: ['Route_Name', 'Time'],
    staticProps: { layerType: 'transit_route' }
  }));
  reports.push(transformFile({
    inputFile: 'Transit_Stops.geojson',
    outputFile: 'transit_stops.cesium.geojson',
    tolerance: 0,
    propertyKeys: ['Stop_Code', 'Stop_Name', 'Seating'],
    staticProps: { layerType: 'transit_stop' }
  }));
  reports.push(transformFile({
    inputFile: 'Hospitals.geojson',
    outputFile: 'hospitals.cesium.geojson',
    tolerance: 0,
    propertyKeys: ['NAME', 'OWNER', 'OWNTYPE', 'FULLADDR', 'NUMBEDS', 'PHONE'],
    staticProps: { layerType: 'hospital' }
  }));

  const summary = reports.map((report) => ({
    input: report.inputFile,
    output: report.outputFile,
    features: `${report.outFeatures}/${report.inFeatures}`,
    coords: `${report.outCoords}/${report.inCoords}`,
    sizeKB: `${Math.round(report.outSize / 1024)}/${Math.round(report.inSize / 1024)}`
  }));

  writeJson(path.join(outDir, 'build-summary.json'), {
    generatedAt: new Date().toISOString(),
    layers: summary
  });

  console.log('Cesium layer pack built:');
  for (const row of summary) {
    console.log(`- ${row.output} (features ${row.features}, coords ${row.coords}, sizeKB ${row.sizeKB})`);
  }
};

main();
