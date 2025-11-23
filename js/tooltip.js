/**
 * Tooltip functionality for the crime map
 * Displays state name, arrest count, and FIR count on hover
 */

/**
 * Show tooltip with state information
 * @param {Event} event - Mouse event
 * @param {string} stateName - Name of the state
 * @param {Array} entries - Array of { label, arrests, fir } objects
 */
function showTooltip(event, stateName, entries) {
  const tooltip = document.getElementById('tooltip');
  const content = document.getElementById('tooltip-content');

  // Build tooltip content safely
  content.innerHTML = '';

  // State name header
  const header = document.createElement('strong');
  header.textContent = stateName;
  content.appendChild(header);

  // Add each entry
  entries.forEach(entry => {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'tooltip-entry';

    if (entry.label) {
      const labelSpan = document.createElement('span');
      labelSpan.className = 'tooltip-label';
      labelSpan.textContent = entry.label;
      entryDiv.appendChild(labelSpan);
    }

    const dataDiv = document.createElement('div');
    dataDiv.className = 'tooltip-data';

    const arrestSpan = document.createElement('span');
    const arrestLabel = document.createTextNode('Arrests: ');
    const arrestValue = document.createElement('strong');
    arrestValue.textContent = entry.arrests || 0;
    arrestSpan.appendChild(arrestLabel);
    arrestSpan.appendChild(arrestValue);
    dataDiv.appendChild(arrestSpan);

    const firSpan = document.createElement('span');
    const firLabel = document.createTextNode('FIRs: ');
    const firValue = document.createElement('strong');
    firValue.textContent = entry.fir || 0;
    firSpan.appendChild(firLabel);
    firSpan.appendChild(firValue);
    dataDiv.appendChild(firSpan);

    entryDiv.appendChild(dataDiv);
    content.appendChild(entryDiv);
  });

  tooltip.style.display = 'block';
  moveTooltip(event);
}

/**
 * Move tooltip to follow mouse cursor
 * @param {Event} event - Mouse event
 */
function moveTooltip(event) {
  const tooltip = document.getElementById('tooltip');
  const offset = 15;

  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Get tooltip dimensions
  const tooltipRect = tooltip.getBoundingClientRect();

  // Calculate position
  let left = event.pageX + offset;
  let top = event.pageY + offset;

  // Prevent tooltip from going off-screen horizontally
  if (left + tooltipRect.width > viewportWidth) {
    left = event.pageX - tooltipRect.width - offset;
  }

  // Prevent tooltip from going off-screen vertically
  if (top + tooltipRect.height > viewportHeight + window.scrollY) {
    top = event.pageY - tooltipRect.height - offset;
  }

  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
}

/**
 * Hide the tooltip
 */
function hideTooltip() {
  const tooltip = document.getElementById('tooltip');
  tooltip.style.display = 'none';
}
