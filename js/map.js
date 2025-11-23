// Map Rendering Module

// Store references for map refresh
let mapSvg = null;
let mapProjection = null;
let mapPath = null;
let geoJsonData = null;
let currentMapData = {};
let currentRawData = {};

/**
 * State name mapping for matching GeoJSON names to data
 * Maps various name formats to normalized lowercase names
 */
const stateNameMap = {
  'andaman and nicobar islands': 'andaman and nicobar',
  'andaman and nicobar': 'andaman and nicobar',
  'andaman & nicobar': 'andaman and nicobar',
  'andhra pradesh': 'andhra pradesh',
  'arunachal pradesh': 'arunachal pradesh',
  'assam': 'assam',
  'bihar': 'bihar',
  'chandigarh': 'chandigarh',
  'chhattisgarh': 'chhattisgarh',
  'dadra and nagar haveli': 'dadra and nagar haveli',
  'dadra and nagar haveli and daman and diu': 'dadra and nagar haveli',
  'daman and diu': 'daman and diu',
  'delhi': 'delhi',
  'nct of delhi': 'delhi',
  'goa': 'goa',
  'gujarat': 'gujarat',
  'haryana': 'haryana',
  'himachal pradesh': 'himachal pradesh',
  'jammu and kashmir': 'jammu and kashmir',
  'jammu & kashmir': 'jammu and kashmir',
  'jharkhand': 'jharkhand',
  'karnataka': 'karnataka',
  'kerala': 'kerala',
  'ladakh': 'ladakh',
  'lakshadweep': 'lakshadweep',
  'madhya pradesh': 'madhya pradesh',
  'maharashtra': 'maharashtra',
  'manipur': 'manipur',
  'meghalaya': 'meghalaya',
  'mizoram': 'mizoram',
  'nagaland': 'nagaland',
  'odisha': 'odisha',
  'orissa': 'odisha',
  'puducherry': 'puducherry',
  'pondicherry': 'puducherry',
  'punjab': 'punjab',
  'rajasthan': 'rajasthan',
  'sikkim': 'sikkim',
  'tamil nadu': 'tamil nadu',
  'telangana': 'telangana',
  'tripura': 'tripura',
  'uttar pradesh': 'uttar pradesh',
  'uttarakhand': 'uttarakhand',
  'uttaranchal': 'uttarakhand',
  'west bengal': 'west bengal'
};

/**
 * Normalize state name for matching
 * @param {string} name - State name from GeoJSON
 * @returns {string} - Normalized lowercase name
 */
function normalizeStateName(name) {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  return stateNameMap[lower] || lower;
}

/**
 * Get data for a state from current map data
 * @param {string} stateName - State name
 * @returns {object} - { arrests, fir }
 */
function getStateData(stateName) {
  const normalized = normalizeStateName(stateName);
  return currentMapData[normalized] || { arrests: 0, fir: 0 };
}

/**
 * Get maximum arrest count from current data
 * @returns {number}
 */
function getMaxArrestCount() {
  const values = Object.values(currentMapData);
  if (values.length === 0) return 1;
  const max = Math.max(...values.map(v => v.arrests || 0));
  return max > 0 ? max : 1;
}

/**
 * Get color based on arrest count
 * Uses a green -> yellow -> red gradient matching the legend
 * @param {number} count - Arrest count
 * @param {number} max - Maximum arrest count
 * @returns {string} - RGB color string
 */
function getColor(count, max) {
  if (count === 0) return '#e2e8f0'; // Light gray for no data

  const ratio = count / max;

  // Color stops: #48bb78 (green) -> #ecc94b (yellow) -> #f56565 (red)
  let r, g, b;

  if (ratio <= 0.5) {
    // Green (#48bb78) to Yellow (#ecc94b)
    const t = ratio * 2;
    r = Math.round(72 + (236 - 72) * t);
    g = Math.round(187 + (201 - 187) * t);
    b = Math.round(120 + (75 - 120) * t);
  } else {
    // Yellow (#ecc94b) to Red (#f56565)
    const t = (ratio - 0.5) * 2;
    r = Math.round(236 + (245 - 236) * t);
    g = Math.round(201 + (101 - 201) * t);
    b = Math.round(75 + (101 - 75) * t);
  }

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Initialize and render the map
 */
async function initMap() {
  try {
    // Load GeoJSON (only once)
    if (!geoJsonData) {
      const response = await fetch('assets/india-states.json');
      if (!response.ok) throw new Error('Failed to load map data');
      geoJsonData = await response.json();
    }

    // Load arrest data from Firestore
    try {
      const data = await loadArrestData();
      currentMapData = data.mapData || {};
      currentRawData = data.rawData || {};
    } catch (error) {
      // Silent fail - use empty data if Firestore unavailable
      currentMapData = {};
      currentRawData = {};
    }

    const maxCount = getMaxArrestCount();

    // Create SVG if not exists
    const mapContainer = document.getElementById('map');
    if (!mapSvg) {
      const width = 900;
      const height = 800;

      mapSvg = d3.select('#map')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

      // Add background
      mapSvg.append('rect')
        .attr('width', width)
        .attr('height', height)
        .attr('fill', '#f0f4f8');

      // Projection for India
      mapProjection = d3.geoMercator()
        .center([82, 23])
        .scale(1100)
        .translate([width / 2, height / 2]);

      mapPath = d3.geoPath().projection(mapProjection);

      // Create group for states (fills)
      const statesGroup = mapSvg.append('g').attr('class', 'states-group');

      // Draw state fills
      statesGroup.selectAll('path')
        .data(geoJsonData.features)
        .enter()
        .append('path')
        .attr('d', mapPath)
        .attr('class', 'state')
        .attr('data-state', d => d.properties.name || d.properties.NAME || '')
        .on('mouseenter', handleMouseEnter)
        .on('mousemove', handleMouseMove)
        .on('mouseleave', handleMouseLeave);

      // Draw borders on top (separate layer for uniform borders)
      const bordersGroup = mapSvg.append('g').attr('class', 'borders-group');
      bordersGroup.selectAll('path')
        .data(geoJsonData.features)
        .enter()
        .append('path')
        .attr('d', mapPath)
        .attr('class', 'state-border');

      // Add enlarged hit areas for small territories (Lakshadweep, etc.)
      addEnlargedHitAreas();
    }

    // Update colors based on data
    updateMapColors(maxCount);

    // Update legend
    updateLegend();

    // Update stats
    updateStats();

    // Update data table
    updateDataTable();

  } catch (error) {
    // Silent fail - show user-friendly error without exposing details
    const mapEl = document.getElementById('map');
    if (mapEl) {
      mapEl.innerHTML = '<p class="error-message">Error loading map. Please refresh the page.</p>';
    }
  }
}

/**
 * Refresh map with latest data from Firestore
 */
async function refreshMap() {
  try {
    const data = await loadArrestData();
    currentMapData = data.mapData || {};
    currentRawData = data.rawData || {};
    const maxCount = getMaxArrestCount();
    updateMapColors(maxCount);
    updateLegend();
    updateStats();
    updateDataTable();
  } catch (error) {
    // Silent fail - don't expose errors
  }
}

/**
 * Update map colors based on current data
 * @param {number} maxCount - Maximum arrest count
 */
function updateMapColors(maxCount) {
  if (!mapSvg) return;

  mapSvg.selectAll('path.state')
    .transition()
    .duration(300)
    .style('fill', function(d) {
      const rawName = d.properties.name || d.properties.NAME || '';
      const data = getStateData(rawName);
      return getColor(data.arrests, maxCount);
    });
}

/**
 * Build tooltip entries for a state
 * Special handling for Delhi to show both Delhi Police and CBI
 */
function buildTooltipEntries(stateName) {
  const normalized = normalizeStateName(stateName);
  const entries = [];

  if (normalized === 'delhi') {
    // Show Delhi Police and CBI separately
    const delhiData = currentRawData['delhi'] || { arrests: 0, fir: 0 };
    const cbiData = currentRawData['cbi'] || { arrests: 0, fir: 0 };

    entries.push({
      label: 'Delhi Police',
      arrests: delhiData.arrests,
      fir: delhiData.fir
    });
    entries.push({
      label: 'CBI',
      arrests: cbiData.arrests,
      fir: cbiData.fir
    });
  } else {
    const data = currentRawData[normalized] || { arrests: 0, fir: 0 };
    entries.push({
      label: null,
      arrests: data.arrests,
      fir: data.fir
    });
  }

  return entries;
}

/**
 * Handle mouse enter on state
 */
function handleMouseEnter(event, d) {
  const rawName = d.properties.name || d.properties.NAME || 'Unknown';
  const entries = buildTooltipEntries(rawName);
  showTooltip(event, rawName, entries);
  d3.select(this).style('stroke-width', '2px');
}

/**
 * Handle mouse move on state
 */
function handleMouseMove(event) {
  moveTooltip(event);
}

/**
 * Handle mouse leave from state
 */
function handleMouseLeave() {
  hideTooltip();
  d3.select(this).style('stroke-width', '1px');
}

/**
 * Update legend with actual count ranges
 */
function updateLegend() {
  const values = Object.values(currentMapData);
  const maxArrests = values.length > 0 ? Math.max(...values.map(v => v.arrests || 0)) : 0;
  const maxFir = values.length > 0 ? Math.max(...values.map(v => v.fir || 0)) : 0;

  const arrestLow = document.getElementById('arrest-low');
  const arrestHigh = document.getElementById('arrest-high');
  const firLow = document.getElementById('fir-low');
  const firHigh = document.getElementById('fir-high');

  if (arrestLow) arrestLow.textContent = '0';
  if (arrestHigh) arrestHigh.textContent = maxArrests.toString();
  if (firLow) firLow.textContent = '0';
  if (firHigh) firHigh.textContent = maxFir.toString();
}

/**
 * Update statistics display
 */
function updateStats() {
  const totalArrestsEl = document.getElementById('total-arrests');
  const totalFirEl = document.getElementById('total-fir');
  const statesEl = document.getElementById('states-with-data');
  const updatedEl = document.getElementById('last-updated');

  const values = Object.values(currentMapData);

  if (totalArrestsEl) {
    const total = values.reduce((sum, d) => sum + (d.arrests || 0), 0);
    totalArrestsEl.textContent = total.toLocaleString();
  }

  if (totalFirEl) {
    const total = values.reduce((sum, d) => sum + (d.fir || 0), 0);
    totalFirEl.textContent = total.toLocaleString();
  }

  if (statesEl) {
    const statesWithData = Object.keys(currentMapData).filter(k =>
      (currentMapData[k].arrests || 0) > 0 || (currentMapData[k].fir || 0) > 0
    ).length;
    statesEl.textContent = statesWithData.toString();
  }

  if (updatedEl) {
    updatedEl.textContent = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
}

/**
 * Update the data table with state-wise breakdown
 * Shows all states including those with 0 data
 */
function updateDataTable() {
  const tableBody = document.getElementById('data-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = '';

  // Get all valid states
  const allStates = getValidStatesList();
  const rows = [];

  allStates.forEach(state => {
    // Skip 'cbi' in the loop - we'll handle it specially with Delhi
    if (state === 'cbi') return;

    const data = currentRawData[state] || { arrests: 0, fir: 0 };
    let displayName = state.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    // Special handling for Delhi - show as Delhi (Delhi Police)
    if (state === 'delhi') {
      displayName = 'Delhi (Delhi Police)';
    }

    rows.push({
      name: displayName,
      arrests: data.arrests || 0,
      fir: data.fir || 0,
      sortKey: state
    });

    // Add CBI entry right after Delhi
    if (state === 'delhi') {
      const cbiData = currentRawData['cbi'] || { arrests: 0, fir: 0 };
      rows.push({
        name: 'Delhi (CBI)',
        arrests: cbiData.arrests || 0,
        fir: cbiData.fir || 0,
        sortKey: 'delhi_cbi'
      });
    }
  });

  // Sort: 1) By arrests (desc), 2) By FIR (desc), 3) Alphabetically for zeros
  rows.sort((a, b) => {
    // First: entries with arrests come first (sorted by arrest count desc)
    if (a.arrests > 0 || b.arrests > 0) {
      if (a.arrests !== b.arrests) return b.arrests - a.arrests;
    }
    // Second: entries with FIR but no arrests
    if (a.arrests === 0 && b.arrests === 0) {
      if (a.fir > 0 || b.fir > 0) {
        if (a.fir !== b.fir) return b.fir - a.fir;
      }
    }
    // Third: alphabetical for entries with same values
    return a.sortKey.localeCompare(b.sortKey);
  });

  rows.forEach(row => {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const td2 = document.createElement('td');
    const td3 = document.createElement('td');
    td1.textContent = row.name;
    td2.textContent = row.arrests;
    td3.textContent = row.fir;
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tableBody.appendChild(tr);
  });
}

/**
 * Add enlarged invisible hit areas for small territories
 * Makes it easier to hover/click on small islands like Lakshadweep
 */
function addEnlargedHitAreas() {
  if (!mapSvg || !geoJsonData || !mapProjection) return;

  // Small territories that need enlarged hit areas
  const smallTerritories = [
    { name: 'lakshadweep', coords: [72.8, 10.5], radius: 25 },
    { name: 'andaman and nicobar', coords: [92.7, 11.7], radius: 20 }
  ];

  const hitAreaGroup = mapSvg.append('g').attr('class', 'hit-areas');

  smallTerritories.forEach(territory => {
    // Find the feature data for this territory
    const feature = geoJsonData.features.find(f => {
      const name = (f.properties.name || f.properties.NAME || '').toLowerCase();
      return normalizeStateName(name) === territory.name;
    });

    if (!feature) return;

    // Get projected coordinates
    const projected = mapProjection(territory.coords);

    // Create invisible circle for larger hit area
    hitAreaGroup.append('circle')
      .attr('cx', projected[0])
      .attr('cy', projected[1])
      .attr('r', territory.radius)
      .attr('class', 'hit-area')
      .attr('data-state', feature.properties.name || feature.properties.NAME || '')
      .style('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mouseenter', function(event) {
        const rawName = feature.properties.name || feature.properties.NAME || 'Unknown';
        const entries = buildTooltipEntries(rawName);
        showTooltip(event, rawName, entries);
      })
      .on('mousemove', handleMouseMove)
      .on('mouseleave', hideTooltip);
  });
}
