/**
 * Tooltip functionality for the crime map
 * Displays state name and crime count on hover
 */

/**
 * Show tooltip with state information
 * @param {Event} event - Mouse event
 * @param {string} stateName - Name of the state
 * @param {number} count - Crime count for the state
 */
function showTooltip(event, stateName, count) {
  const tooltip = document.getElementById('tooltip');
  const stateLabel = document.getElementById('state-name');
  const countLabel = document.getElementById('crime-count');

  // Use textContent for security (prevents XSS)
  stateLabel.textContent = stateName;
  countLabel.textContent = count;

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
