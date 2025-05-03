import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

document.addEventListener('DOMContentLoaded', async () => {

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const titleElement = document.querySelector('.projects-title');

renderProjects(projects, projectsContainer, 'h2');

if (titleElement && projects) {
    titleElement.textContent = `${projects.length} Projects`;
}

let selectedIndex = -1;

let svg = d3.select('svg');

// This function will render both the pie chart and legend
function renderPieChart(projectsGiven) {
  // Re-calculate rolled data
  let rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year,
  );
  
  // Re-calculate data
  let data = rolledData.map(([year, count]) => {
    return { value: count, label: year };
  });

  // Re-calculate slice generator, arc data, arc, etc.
  let sliceGenerator = d3.pie().value((d) => d.value);
  let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  let arcData = sliceGenerator(data);
  let arcs = arcData.map((d) => arcGenerator(d));
  let colors = d3.scaleOrdinal(d3.schemeTableau10);

  // Clear existing paths and legends before rendering
  svg.selectAll('path').remove();
  d3.select('.legend').selectAll('li').remove();

  // Update pie chart paths
  arcs.forEach((arc, idx) => {
    svg
      .append('path')
      .attr('d', arc)
      .attr('fill', colors(idx))
      .on('click', () => {
        // Toggle selection based on clicked index
        selectedIndex = selectedIndex === idx ? -1 : idx;

        // Update pie chart slices with 'selected' class
        svg.selectAll('path')
          .attr('class', (_, i) => (i === selectedIndex ? 'selected' : 'pie-slice'));

        // Update legend with 'selected' class
        d3.select('.legend')
          .selectAll('li')
          .attr('class', (_, i) => (i === selectedIndex ? 'selected' : 'legend_items'));

        // Filter projects based on the selected slice
        if (selectedIndex === -1) {
          renderProjects(projects, projectsContainer, 'h2');
        } else {
          let selectedLabel = data[selectedIndex].label;

          // Filter the projects based on the selected label
          let filteredProjects = projects.filter(project => project.year === selectedLabel);

          // Render filtered projects
          renderProjects(filteredProjects, projectsContainer, 'h2');
        }
      });
  });

  // Update legend
  let legend = d3.select('.legend');
  data.forEach((d, idx) => {
    legend
      .append('li')
      .attr('style', `--color:${colors(idx)}`)
      .attr('class', 'legend_items')
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
  });

  // Apply selected class to legend items when a slice is selected
  legend
    .selectAll('li')
    .attr('class', (_, idx) => (idx === selectedIndex ? 'selected' : 'legend_items'));
}

// Initial render for the entire project data
renderPieChart(projects);

// Set up search input to filter projects
let searchInput = document.querySelector('.searchBar');
searchInput.addEventListener('change', (event) => {
  let query = event.target.value.toLowerCase(); // capture the search query
  
  // Filter projects based on the search query
  let filteredProjects = projects.filter((project) => {
    let values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query); // filter projects based on query
  });

  // Re-render the filtered projects and pie chart
  renderProjects(filteredProjects, projectsContainer, 'h2');
  renderPieChart(filteredProjects); // re-render pie chart based on filtered projects
});
});