let filmsData = [];
let filteredData = [];

async function loadData() {
    try {
        const response = await fetch('films_data.json');
        filmsData = await response.json();
        
        filteredData = [...filmsData];
        
        populateFilterOptions();
        
        renderTable();
        renderChart();
        
        setupEventListeners();
    } catch (error) {
        console.error('Error loading data:', error);
        document.querySelector('.data-table').innerHTML = '<p>Error loading data. Please try again later.</p>';
    }
}

function populateFilterOptions() {
    const countries = [...new Set(filmsData.map(film => film.country))].sort();
    const countrySelect = document.getElementById('country-filter');
    
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        countrySelect.appendChild(option);
    });
    
    const years = filmsData.map(film => film.release_year).filter(year => year);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    
    const yearMin = document.getElementById('year-min');
    const yearMax = document.getElementById('year-max');
    const yearDisplay = document.getElementById('year-range-display');
    
    yearMin.min = minYear;
    yearMin.max = maxYear;
    yearMin.value = minYear;
    
    yearMax.min = minYear;
    yearMax.max = maxYear;
    yearMax.value = maxYear;
    
    yearDisplay.textContent = `${minYear} - ${maxYear}`;
}

function setupEventListeners() {
    const yearMin = document.getElementById('year-min');
    const yearMax = document.getElementById('year-max');
    const yearDisplay = document.getElementById('year-range-display');
    
    yearMin.addEventListener('input', () => {
        if (parseInt(yearMin.value) > parseInt(yearMax.value)) {
            yearMax.value = yearMin.value;
        }
        yearDisplay.textContent = `${yearMin.value} - ${yearMax.value}`;
        applyFilters();
    });
    
    yearMax.addEventListener('input', () => {
        if (parseInt(yearMax.value) < parseInt(yearMin.value)) {
            yearMin.value = yearMax.value;
        }
        yearDisplay.textContent = `${yearMin.value} - ${yearMax.value}`;
        applyFilters();
    });
    
    document.getElementById('country-filter').addEventListener('change', applyFilters);
    
    document.getElementById('sort-by').addEventListener('change', applyFilters);
}

function applyFilters() {
    const yearMin = parseInt(document.getElementById('year-min').value);
    const yearMax = parseInt(document.getElementById('year-max').value);
    const country = document.getElementById('country-filter').value;
    const sortBy = document.getElementById('sort-by').value;
    
    filteredData = filmsData.filter(film => {
        const yearMatch = film.release_year >= yearMin && film.release_year <= yearMax;
        const countryMatch = country === 'all' || film.country === country;
        return yearMatch && countryMatch;
    });
    
    sortData(sortBy);
    
    renderTable();
    renderChart();
}

function sortData(sortBy) {
    switch(sortBy) {
        case 'box_office_desc':
            filteredData.sort((a, b) => b.box_office - a.box_office);
            break;
        case 'box_office_asc':
            filteredData.sort((a, b) => a.box_office - b.box_office);
            break;
        case 'year_desc':
            filteredData.sort((a, b) => b.release_year - a.release_year);
            break;
        case 'year_asc':
            filteredData.sort((a, b) => a.release_year - b.release_year);
            break;
        case 'title_asc':
            filteredData.sort((a, b) => a.title.localeCompare(b.title));
            break;
    }
}

function renderTable() {
    const tableBody = document.querySelector('#films-table tbody');
    tableBody.innerHTML = '';
    
    if (filteredData.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="5" style="text-align: center;">No films match your current filters</td>';
        tableBody.appendChild(emptyRow);
        return;
    }
    
    filteredData.forEach(film => {
        const row = document.createElement('tr');
        
        const formattedRevenue = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(film.box_office);
        
        row.innerHTML = `
            <td>${film.title}</td>
            <td>${film.release_year}</td>
            <td>${film.director}</td>
            <td>${formattedRevenue}</td>
            <td>${film.country}</td>
        `;
        
        tableBody.appendChild(row);
    });
}

function renderChart() {
    d3.select('#chart').html('');
    
    if (filteredData.length === 0) {
        d3.select('#chart')
            .append('div')
            .attr('class', 'no-data')
            .style('text-align', 'center')
            .style('padding', '100px 0')
            .style('color', '#636e72')
            .text('No data available for the current filters');
        return;
    }
    
    const margin = {top: 30, right: 120, bottom: 50, left: 200};
    const width = document.getElementById('chart').clientWidth - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    
    const svg = d3.select('#chart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    const chartData = filteredData.slice(0, 15);
    
    const x = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d.box_office)])
        .range([0, width]);
    
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d => {
            return '$' + d3.format('.1s')(d);
        }))
        .selectAll('text')
        .attr('transform', 'translate(-10,0)rotate(-45)')
        .style('text-anchor', 'end')
        .style('font-size', '12px')
        .style('fill', '#636e72');
    
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 5)
        .style('font-size', '14px')
        .style('fill', '#636e72')
        .text('Box Office Revenue (USD)');
    
    const y = d3.scaleBand()
        .domain(chartData.map(d => d.title))
        .range([0, height])
        .padding(0.2);
    
    svg.append('g')
        .call(d3.axisLeft(y))
        .selectAll('text')
        .attr('dy', null)
        .style('font-size', '12px')
        .style('fill', '#636e72')
        .call(wrap, margin.left - 20);
    
    const colorScale = d3.scaleLinear()
        .domain([d3.min(chartData, d => d.release_year), d3.max(chartData, d => d.release_year)])
        .range(['#0984e3', '#00b894']);
    
    svg.selectAll('myRect')
        .data(chartData)
        .enter()
        .append('rect')
        .attr('x', 0)
        .attr('y', d => y(d.title))
        .attr('width', 0)
        .attr('height', y.bandwidth())
        .attr('fill', d => colorScale(d.release_year))
        .attr('rx', 4)
        .attr('ry', 4)
        .transition()
        .duration(800)
        .delay((d, i) => i * 50)
        .attr('width', d => x(d.box_office));
    
    svg.selectAll('rect')
        .on('mouseover', function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('opacity', 0.8)
                .attr('stroke', '#2d3436')
                .attr('stroke-width', 2);
            
            const tooltip = svg.append('g')
                .attr('class', 'tooltip')
                .attr('opacity', 0);
            
            tooltip.append('rect')
                .attr('x', x(d.box_office) + 10)
                .attr('y', y(d.title) - 15)
                .attr('width', 180)
                .attr('height', 80)
                .attr('fill', 'white')
                .attr('rx', 8)
                .attr('ry', 8)
                .attr('stroke', '#dfe6e9')
                .attr('stroke-width', 1);
            
            tooltip.append('text')
                .attr('x', x(d.box_office) + 20)
                .attr('y', y(d.title) + 5)
                .attr('font-weight', 'bold')
                .text(d.title);
            
            tooltip.append('text')
                .attr('x', x(d.box_office) + 20)
                .attr('y', y(d.title) + 25)
                .attr('font-size', '12px')
                .attr('fill', '#636e72')
                .text(`${d.release_year} • ${d.director}`);
            
            tooltip.append('text')
                .attr('x', x(d.box_office) + 20)
                .attr('y', y(d.title) + 45)
                .attr('font-size', '14px')
                .attr('font-weight', 'bold')
                .attr('fill', '#0984e3')
                .text(`$${d3.format(',.0f')(d.box_office)}`);
            
            tooltip.transition()
                .duration(200)
                .attr('opacity', 1);
        })
        .on('mouseout', function() {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('opacity', 1)
                .attr('stroke-width', 0);
            
            svg.selectAll('.tooltip').remove();
        });
    
    function wrap(text, width) {
        text.each(function() {
            const text = d3.select(this);
            const words = text.text().split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const lineHeight = 1.1;
            const y = text.attr('y');
            const dy = parseFloat(text.attr('dy') || 0);
            let tspan = text.text(null).append('tspan').attr('x', -10).attr('y', y).attr('dy', dy + 'em');
            
            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(' '));
                if (tspan.node().getComputedTextLength() > width) {
                    line.pop();
                    tspan.text(line.join(' '));
                    line = [word];
                    tspan = text.append('tspan').attr('x', -10).attr('y', y).attr('dy', ++lineNumber * lineHeight + dy + 'em').text(word);
                }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', loadData);

window.addEventListener('resize', () => {
    if (filteredData.length > 0) {
        renderChart();
    }
});