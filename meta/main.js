import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

async function loadData() {
    const data = await d3.csv('loc.csv', (row) => ({
      ...row,
      line: Number(row.line), // or just +row.line
      depth: Number(row.depth),
      length: Number(row.length),
      date: new Date(row.date + 'T00:00' + row.timezone),
      datetime: new Date(row.datetime),
    }));
  
    return data;
  }

function processCommits(data) {
    return d3
      .groups(data, (d) => d.commit)
      .map(([commit, lines]) => {
        let first = lines[0];
        let { author, date, time, timezone, datetime } = first;
        let ret = {
          id: commit,
          url: 'https://github.com/Dylan-Vo05/Portfolio/commit/' + commit,
          author,
          date,
          time,
          timezone,
          datetime,
          hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
          totalLines: lines.length,
        };
  
        Object.defineProperty(ret, 'lines', {
          value: lines,
          writable: false,
          enumerable: false,
          configurable: false
        });
  
        return ret;
      });
    }

function renderCommitInfo(data, commits) {

    const fileLengths = d3.rollups(
      data,
      (v) => d3.max(v, (v) => v.line),
      (d) => d.file,
    );

    const workByPeriod = d3.rollups(
      data,
      (v) => v.length,
      (d) => new Date(d.datetime).toLocaleString('en', { dayPeriod: 'short' }),
    );

    // Create the dl element
    const dl = d3.select('#stats').append('dl').attr('class', 'stats');

    dl.append('dt').html('Total Files');
    dl.append('dd').text(d3.group(data, d => d.file).size);
  
    // Add total LOC
    dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
    dl.append('dd').text(data.length);
  
    // Add total commits
    dl.append('dt').text('Total commits');
    dl.append('dd').text(commits.length);
   
    // Add more stats as needed...
    dl.append('dt').text('Avg File Length');
    dl.append('dd').text(d3.mean(fileLengths, (d) => d[1]));

    dl.append('dt').text('Max Depth');
    dl.append('dd').text(d3.max(data, d => d.depth));

    dl.append('dt').text('Most Productive');
    dl.append('dd').text(d3.greatest(workByPeriod, (d) => d[1])?.[0]);
    }

function renderScatterPlot(data, commits) {

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`);

  const xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .range([margin.left, margin.left + usableWidth])
    .nice();

  const yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([margin.top + usableHeight, margin.top]);

  // Add gridlines behind
  svg.append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(
      d3.axisLeft(yScale)
        .tickSize(-usableWidth)
        .tickFormat('')
    );

  // Add Y axis
  svg.append('g')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(
      d3.axisLeft(yScale)
        .tickFormat(d => `${String(d).padStart(2, '0')}:00`)
    );

  // Add X axis
  svg.append('g')
    .attr('transform', `translate(0, ${margin.top + usableHeight})`)
    .call(d3.axisBottom(xScale));

  // Add dots
  svg.append('g')
    .attr('class', 'dots')
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', 5)
    .attr('fill', 'steelblue')
    .attr('r', (d) => rScale(d.totalLines))
    .style('fill-opacity', 0.7) // Add transparency for overlapping dots
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1); // Full opacity on hover
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });

  createBrushSelector(svg);
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');

  if (Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });
}

function createBrushSelector(svg) {
  svg.call(d3.brush().on('start brush end', brushed));

  // Raise dots and everything after overlay
  svg.selectAll('.dots, .overlay ~ *').raise();
}
 
function brushed(event) {
  const selection = event.selection;
  d3.selectAll('circle').classed('selected', (d) =>
    isCommitSelected(selection, d),
  );
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }
  const [x0, x1] = selection.map((d) => d[0]); 
  const [y0, y1] = selection.map((d) => d[1]); 
  const x = xScale(commit.datetime); 
  const y = yScale(commit.hourFrac); 
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector('#selection-count');
  countElement.textContent = `${
    selectedCommits.length || 'No'
  } commits selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }
  const requiredCommits = selectedCommits.length ? selectedCommits : commits;
  const lines = requiredCommits.flatMap((d) => d.lines);

  // Use d3.rollup to count lines per language
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  // Update DOM with breakdown
  container.innerHTML = '';

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);

    container.innerHTML += `
            <dt>${language}</dt>
            <dd>${count} lines (${formatted})</dd>
        `;
  }
}

function onTimeSliderChange() {
  const slider = document.getElementById("commit-progress");
  commitProgress = +slider.value;

  commitMaxTime = timeScale.invert(commitProgress);

  const timeDisplay = document.getElementById("commit-time");
  timeDisplay.textContent = commitMaxTime.toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });

  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);

  updateScatterPlot(data, filteredCommits);
  updateFileDisplay(filteredCommits);
}

function updateScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 20 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3.select("#chart").select("svg");

  xScale.domain(d3.extent(commits, (d) => d.datetime));
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  rScale.domain([minLines, maxLines]);

  const xAxis = d3.axisBottom(xScale);
  svg.select("g.x-axis").call(xAxis);

  const dots = svg.select("g.dots");

  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  dots
    .selectAll("circle")
    .data(sortedCommits, (d) => d.id) // use a key if available
    .join("circle")
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    .attr("fill", "steelblue")
    .style("fill-opacity", 0.7)
    .on("mouseenter", (event, commit) => {
      d3.select(event.currentTarget).style("fill-opacity", 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget).style("fill-opacity", 0.7);
      updateTooltipVisibility(false);
    });
}

function updateFileDisplay(filteredCommits) {
  const lines = filteredCommits.flatMap((d) => d.lines);

  let files = d3
  .groups(lines, (d) => d.file)
  .map(([name, lines]) => {
    return {
      name,
      lines,
      type: d3.mode(lines.map((d) => d.type)), // most common type for coloring
    };
  })
  .sort((a, b) => b.lines.length - a.lines.length); // sort by number of lines, descending

  const filesContainer = d3
    .select("#files")
    .selectAll("div")
    .data(files, (d) => d.name)
    .join(
      (enter) =>
        enter.append("div").call((div) => {
          div.append("dt").append("code");
          div.append("dd");
        }),
      (update) => update,
      (exit) => exit.remove())
    .attr('style', (d) => `--color: ${colors(d.type)}`);

  filesContainer.select("dt > code").html(
    (d) =>
      `${d.name}<br><small>${d.lines.length} lines</small>`
  );

  // Clear and draw individual line dots inside dd
  filesContainer
    .select("dd")
    .selectAll("div")
    .data((d) => d.lines)
    .join("div")
    .attr("class", "loc");
}

function onStepEnter(response) {
  const currentCommit = response.element.__data__;
  commitMaxTime = currentCommit.datetime;

  // Filter the commits shown on the scatter plot up to this commit
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);

  // Update scatter plot and file list
  updateScatterPlot(data, filteredCommits);
  updateFileDisplay(filteredCommits);

  // Update the progress slider visually (optional, for sync)
  const slider = document.getElementById("commit-progress");
  slider.value = timeScale(commitMaxTime);

  // Update textual display of time (optional)
  const timeDisplay = document.getElementById("commit-time");
  timeDisplay.textContent = commitMaxTime.toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });
}



let data = await loadData();
let commits = processCommits(data);
let commitProgress = 100;
let filteredCommits = commits;
let colors = d3.scaleOrdinal(d3.schemeTableau10);

const width = 1000;
const height = 600;
const margin = { top: 10, right: 10, bottom: 30, left: 40 };
const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

const usableWidth = width - margin.left - margin.right;
const usableHeight = height - margin.top - margin.bottom;

let xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .range([margin.left, margin.left + usableWidth])
    .nice();

let yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([margin.top + usableHeight, margin.top]);

let timeScale = d3
  .scaleTime()
  .domain([
    d3.min(commits, (d) => d.datetime),
    d3.max(commits, (d) => d.datetime),
  ])
  .range([0, 100]);


let commitMaxTime = timeScale.invert(commitProgress);   

document.getElementById("commit-progress").addEventListener("input", onTimeSliderChange);
    
const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
const rScale = d3
  .scaleSqrt() // Change only this line
  .domain([minLines, maxLines])
  .range([2, 30]);

d3.select('#scatter-story')
  .selectAll('.step')
  .data(commits)
  .join('div')
  .attr('class', 'step')
  .datum(d => d) // Ensure data is bound correctly
  .html(
    (d, i) => `
		On ${d.datetime.toLocaleString('en', {
      dateStyle: 'full',
      timeStyle: 'short',
    })},
		I made <a href="${d.url}" target="_blank">${
      i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'
    }</a>.
		I edited ${d.totalLines} lines across ${
      d3.rollups(
        d.lines,
        (D) => D.length,
        (d) => d.file,
      ).length
    } files.
		Then I looked over all I had made, and I said 'Eh, good enough'.
	`,
  );

function setupScroller() {
  const scroller = scrollama();

  scroller
    .setup({
      container: '#scrolly-1',
      step: '#scatter-story .step',  // Make sure this matches your structure
      offset: 0.5, // 0.5 means trigger when middle of step hits center of viewport
      debug: false, // Add temporarily to see if scroll is triggering
    })
    .onStepEnter(onStepEnter);

  window.addEventListener('resize', scroller.resize);
}

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);
onTimeSliderChange();
setupScroller();
