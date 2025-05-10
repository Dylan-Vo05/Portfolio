import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

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
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 40 };

  const usableWidth = width - margin.left - margin.right;
  const usableHeight = height - margin.top - margin.bottom;

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
    .data(commits)
    .join('circle')
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', 5)
    .attr('fill', 'steelblue');
}


  
let data = await loadData();
let commits = processCommits(data);;

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);