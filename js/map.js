// Map Rendering Module

// Store references for map refresh
let mapSvg = null;
let mapProjection = null;
let mapPath = null;
let geoJsonData = null;
let currentArrestData = {};

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
 * Get arrest count for a state from current data
 * @param {string} stateName - State name
 * @returns {number} - Arrest count
 */
function getArrestCount(stateName) {
  const normalized = normalizeStateName(stateName);
  return currentArrestData[normalized] || 0;
}

/**
 * Get maximum arrest count from current data
 * @returns {number}
 */
function getMaxArrestCount() {
  const values = Object.values(currentArrestData);
  return values.length > 0 ? Math.max(...values, 1) : 1;
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
      currentArrestData = await loadArrestData();
    } catch (error) {
      // Silent fail - use empty data if Firestore unavailable
      currentArrestData = {};
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
    updateLegend(maxCount);

    // Update stats
    updateStats();

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
    currentArrestData = await loadArrestData();
    const maxCount = getMaxArrestCount();
    updateMapColors(maxCount);
    updateLegend(maxCount);
    updateStats();
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
      const count = getArrestCount(rawName);
      return getColor(count, maxCount);
    });
}

/**
 * Handle mouse enter on state
 */
function handleMouseEnter(event, d) {
  const rawName = d.properties.name || d.properties.NAME || 'Unknown';
  const count = getArrestCount(rawName);
  showTooltip(event, rawName, count);
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
 * Update legend with actual arrest count range
 * @param {number} maxCount - Maximum arrest count
 */
function updateLegend(maxCount) {
  const lowLabel = document.querySelector('.legend-low');
  const highLabel = document.querySelector('.legend-high');

  if (lowLabel) lowLabel.textContent = '0';
  if (highLabel) highLabel.textContent = maxCount.toString();
}

/**
 * Update statistics display
 */
function updateStats() {
  const totalEl = document.getElementById('total-arrests');
  const statesEl = document.getElementById('states-with-data');
  const updatedEl = document.getElementById('last-updated');

  if (totalEl) {
    const total = Object.values(currentArrestData).reduce((sum, count) => sum + count, 0);
    totalEl.textContent = total.toLocaleString();
  }

  if (statesEl) {
    const statesWithData = Object.keys(currentArrestData).filter(k => currentArrestData[k] > 0).length;
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
        const count = getArrestCount(rawName);
        showTooltip(event, rawName, count);
      })
      .on('mousemove', handleMouseMove)
      .on('mouseleave', hideTooltip);
  });
}
