let moviesData;
let selectedYear = 2020;
let selectedGenre = 'all';

// Load CSV data
Promise.all([d3.csv('Data/movies.csv')]).then(function (values) {
    moviesData = values[0];
    renderStackedBarChart(moviesData); 
    initializeScatterplot(); 
    renderChoroplethMap(moviesData);
});

let currentSceneIndex = 0;
const scenes = ['scene1', 'scene2', 'scene3'];

function showScene(sceneId) {
    document.querySelectorAll('.scene').forEach(scene => {
        scene.style.display = 'none';
    });
    document.getElementById(sceneId).style.display = 'block';
}

function showNextScene() {
    currentSceneIndex = (currentSceneIndex + 1) % scenes.length;
    showScene(scenes[currentSceneIndex]);
}

function showPrevScene() {
    currentSceneIndex = (currentSceneIndex - 1 + scenes.length) % scenes.length;
    showScene(scenes[currentSceneIndex]);
}

function renderChoroplethMap(data) {
    d3.select("#choropleth-map").html("");

    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const width = 960 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;

    const svg = d3.select("#choropleth-map").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
 

    const projection = d3.geoMercator()
        .scale(150)
        .translate([width / 2, height / 1.5]);

    const path = d3.geoPath().projection(projection);

    // Group data by country and count number of movies
    const moviesByCountry = Array.from(d3.group(data, d => d.country), ([key, value]) => ({ key, value: value.length }));

    const maxMovies = d3.max(moviesByCountry, d => d.value);

    const color = d3.scaleSequential(d3.interpolateBlues)
    .domain([0, Math.log(maxMovies + 1)]); // Using log scale

    // Load and display the World
    d3.json('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson').then(world => {
        const countries = world.features;

        // Bind data to the SVG and create one path per GeoJSON feature
        svg.selectAll("path")
            .data(countries)
            .enter().append("path")
            .attr("d", path).style("opacity", 0.5)
            .attr("fill", d => {
                const countryData = moviesByCountry.find(c => c.key === d.properties.name); 
                return countryData ? color(countryData.value) : '#ccc';
            })
            .attr("stroke", "#333").style("fill-opacity", 0.75)
            .on("mouseover", function(event, d) {
                const countryData = moviesByCountry.find(c => c.key === d.properties.name);
                const tooltipText = countryData ? `Country: ${d.properties.name}<br>Movies: ${countryData.value}` : `Country: ${d.properties.name}<br>Movies: 0`;

                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                tooltip.html(tooltipText)
                    .style("left", (event.pageX + 5) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function(d) {
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });

   // Annotations
   const normalizeCountryName = (name) => name.toLowerCase().replace(/\s+/g, '');
   const highestProductionCountry = moviesByCountry.reduce((max, country) => country.value > max.value ? country : max, moviesByCountry[0]);
   const highestCountryGeoJSON = countries.find(c => normalizeCountryName(c.properties.name) === normalizeCountryName(highestProductionCountry.key));
   const [x, y] = path.centroid(highestCountryGeoJSON); 

   const annotation = [{
       note: {
           label: '',
           title: "Highest Movie Production"
       },
       connector: {
           end: "dot",
           type: "line",
           lineType: "vertical",
           endScale: 1
       },
       color: "#7F2803",
       x: x,
       y: y + 30,
       dy: -70,
       dx: 70
   }];

   const makeAnnotations = d3.annotation()
       .type(d3.annotationLabel)
       .annotations(annotation);

   svg.append("g")
       .attr("class", "annotation-group")
       .call(makeAnnotations);
    });

    // Tooltip
    const tooltip = d3.select("#tooltip") 
        .style("opacity", 0); 
}

function renderStackedBarChart(data) {
    d3.select("#stacked-bar-chart").html("");

    const margin = { top: 20, right: 350, bottom: 30, left: 40 };
    const width = 1460 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;
    const customColors = [
        '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
        '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5', '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5',
        '#393b79', '#5254a3', '#6b6ecf', '#9c9ede', '#637939', '#8ca252', '#b5cf6b', '#cedb9c', '#8c6d31', '#bd9e39'
    ];

    const svg = d3.select("#stacked-bar-chart").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    const genres = Array.from(new Set(data.map(d => d.genre)));
    const years = Array.from(new Set(data.map(d => d.year)));

    const x = d3.scaleBand()
        .domain(years)
        .rangeRound([0, width])
        .padding(0.1);

    const y = d3.scaleLinear()
        .rangeRound([height, 0]).nice();

    const color = d3.scaleOrdinal()
        .domain(genres)
        .range(customColors);

    const stack = d3.stack()
        .keys(genres)
        .value((d, key) => d[key]);

    const processedData = years.map(year => {
        const yearData = { year };
        genres.forEach(genre => {
            yearData[genre] = data.filter(d => d.year == year && d.genre === genre).length;
        });
        return yearData;
    });

    const layers = stack(processedData);

    y.domain([0, d3.max(layers, layer => d3.max(layer, d => d[1])) + 10]);

    const layer = svg.selectAll(".layer")
        .data(layers)
        .enter().append("g")
        .attr("class", "layer")
        .attr("fill", d => color(d.key))


    const tooltip = d3.select("#tooltip")
        .style("opacity", 0);

    // Add rectangles for the stacked bar chart with tooltip event handlers
    layer.selectAll("rect")
        .data(d => d)
        .enter().append("rect")
        .attr("x", d => x(d.data.year))
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .style("opacity", 0.75)
        .attr("width", x.bandwidth())
        .on("mouseover", function (event, d) {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html("Year: " + d.data.year + "<br/>" + "Count: " + (d[1] - d[0]))
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
    svg.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x));

    svg.append("g")
        .attr("class", "axis axis--y")
        .call(d3.axisLeft(y).ticks(10, "s"));

    // Add legend
    const legend = svg.selectAll(".legend")
        .data(genres)
        .enter().append("g")
        .attr("class", "legend")
        .attr("transform", (d, i) => "translate(180," + i * 20 + ")");

    legend.append("rect")
        .attr("x", width + 20)
        .attr("width", 18)
        .style("opacity", 0.75)
        .attr("height", 18)
        .style("fill", color);

    legend.append("text")
        .attr("x", width + 45)
        .attr("y", 9)
        .attr("dy", ".35em")
        .style("text-anchor", "start")
        .text(d => d);

    const annotationsData = [
        {
            year: "1994",
            genre: "Comedy",
            text: "1994: 40.5% Comedy movies",
            x: x("1994") + x.bandwidth() / 2 + 70,
            y: y(layers[genres.indexOf("Comedy")].find(d => d.data.year == "1994")[1]),
            dx: width - (x("1994") + x.bandwidth() / 2) - 20,
            dy: -10
        },
        {
            year: "2016",
            genre: "Action",
            text: "2016: 32.0% Action movies",
            x: x("2016") + x.bandwidth() / 2 + 80,
            y: y(layers[genres.indexOf("Action")].find(d => d.data.year == "2016")[1]),
            dx: width - (x("2016") + x.bandwidth() / 2) - 10,
            dy: -10
        }
    ];
    const annotations = annotationsData.map(annotation => ({
        note: {
            label: annotation.text,
            title: annotation.genre + " Movies",
            wrap: 200,
            bgPadding: 5,
            titleColor: "#7F2803",  // Title text color
            labelColor: "#7F2803"   // Label text color
        },
        connector: {
            end: "dot",             // Can be none, or arrow or dot
            type: "line",           // Type of connector
            lineType: "vertical",   // Line type
            endScale: 1             // Dot size
        },
        color: "#7F2803",           // Color for the annotation elements
        x: annotation.x,
        y: annotation.y +15,
        dy: annotation.dy,
        dx: annotation.dx
    }));

    const makeAnnotations = d3.annotation()
        .type(d3.annotationLabel)
        .annotations(annotations);

    // Apply annotations to the SVG
    svg.append("g")
        .attr("class", "annotation-group")
        .call(makeAnnotations);

}

function renderScatterplot(data) {
    d3.select("#scatterplot").html("");

    const margin = { top: 120, right: 150, bottom: 50, left: 120 };
    const width = 1460 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;
    const customColors = [
        '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
        '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5', '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5',
        '#393b79', '#5254a3', '#6b6ecf', '#9c9ede', '#637939', '#8ca252', '#b5cf6b', '#cedb9c', '#8c6d31', '#bd9e39'
    ];
    const svg = d3.select("#scatterplot").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    const tooltip = d3.select("#tooltip")
        .style("opacity", 0);

    // Convert budget and gross to numbers
    data.forEach(d => {
        d.budget = +d.budget;
        d.gross = +d.gross;
    });

    const genres = Array.from(new Set(data.map(d => d.genre)));

    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.budget)]).nice()
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.gross)]).nice()
        .range([height, 0]);

    const color = d3.scaleOrdinal()
        .domain(genres)
        .range(customColors);

    svg.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x));

    svg.append("g")
        .attr("class", "axis axis--y")
        .call(d3.axisLeft(y));

    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 10)
        .style("text-anchor", "middle")
        .text("Budget ($)");

    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 20)
        .style("text-anchor", "middle")
        .text("Gross ($)");

    svg.selectAll(".dot")
        .data(data)
        .enter().append("circle")
        .attr("class", "dot")
        .attr("r", 5)
        .attr("cx", d => x(d.budget))
        .attr("cy", d => y(d.gross))
        .style("fill", d => color(d.genre))
        .style("opacity", 0.75)
        .on("mouseover", function (event, d) {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html("Movie: " + d.name + "<br/>Budget: $" + d.budget + "<br/>Gross: $" + d.gross)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function (d) {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    // Add legend
    const legend = svg.selectAll(".legend")
        .data(genres)
        .enter().append("g")
        .attr("class", "legend")
        .attr("transform", (d, i) => "translate(0," + i * 20 + ")");

    legend.append("rect")
        .attr("x", width + 20)
        .attr("width", 18)
        .attr("height", 18).style("opacity", 0.75)
        .style("fill", color);

    legend.append("text")
        .attr("x", width + 45)
        .attr("y", 9)
        .attr("dy", ".35em")
        .style("text-anchor", "start")
        .text(d => d);

    // Add annotation for highest grossing movie
    const highestGrossingMovie = data.reduce((max, movie) => movie.gross > max.gross ? movie : max, data[0]); 

    const annotation = [{
        note: {
            label: highestGrossingMovie.name,
            title: "Highest Grossing Movie",
            wrap: 190,           // Adjust the wrap width
            titleFontSize: 12,   // Adjust title font size
            labelFontSize: 10    // Adjust label font size
        },
        type: d3.annotationCalloutCircle,
        subject: {
            radius: 20,
            radiusPadding: 10
        },
        color: ["#7F2803"],
        x: x(highestGrossingMovie.budget),
        y: y(highestGrossingMovie.gross),
        dy: -70,
        dx: 70
    }]; 


    const makeAnnotations = d3.annotation()
        .type(d3.annotationCalloutCircle)
        .annotations(annotation);

    svg.append("g")
        .attr("class", "annotation-group")
        .call(makeAnnotations);
}

// Function to update scatterplot based on selected year
function updateScatterplot(year) {
    if (year != 'all') {
        const filteredData = moviesData.filter(d => d.year == year);
        renderScatterplot(filteredData);
    }
    else
        renderScatterplot(moviesData);

}

// Populate year selector and initialize scatterplot
function initializeScatterplot() {
    const years = Array.from(new Set(moviesData.map(d => d.year)));
    const yearSelector = document.getElementById('yearSelector');
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.text = year;
        yearSelector.add(option);
    });

    yearSelector.addEventListener('change', function () {
        updateScatterplot(this.value);
    });

    // Initial render with all data
    renderScatterplot(moviesData);
}