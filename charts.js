const formatMoney = (value) => {
    if (value >= 1e9) return `$${d3.format(".2~f")(value / 1e9)}B`;
    if (value >= 1e6) return `$${d3.format(".2~f")(value / 1e6)}M`;
    if (value >= 1e3) return `$${d3.format(".2~f")(value / 1e3)}K`;
    return `$${d3.format(",.0f")(value)}`;
};

const formatExactMoney = (value) => d3.format("$,.0f")(value);
const formatExactRatio = (value) => `${d3.format(",.6~f")(value)}×`;
const titanicBarColor = "#1f5a3a";

const divideByPositive = (numerator, denominator) =>
    Number.isFinite(numerator) &&
    Number.isFinite(denominator) &&
    denominator > 0
        ? numerator / denominator
        : NaN;

const multiplyFinite = (value, multiplier) =>
    Number.isFinite(value) && Number.isFinite(multiplier)
        ? value * multiplier
        : NaN;

function calculateMovieMetrics(movie) {
    const inflationRate = divideByPositive(
        movie["Infl. Adj. Dom. BO (USD)"],
        movie["Domestic Box Office (USD)"]
    );
    const budget = movie["Production Budget (USD)"];

    return {
        ...movie,
        "Inflation_Rate_2024": inflationRate,
        "Infl. Adj. Budget (USD)": multiplyFinite(budget, inflationRate),
        "Infl. Adj. Intl. BO (USD)": multiplyFinite(
            movie["International Box Office (USD)"],
            inflationRate
        ),
        "Infl. Adj. WW BO (USD)": multiplyFinite(
            movie["Worldwide Box Office (USD)"],
            inflationRate
        ),
        "Infl. Adj. Opening Weekend (USD)": multiplyFinite(
            movie["Opening Weekend (USD)"],
            inflationRate
        ),
        "Dom. BO by Budget": divideByPositive(
            movie["Domestic Box Office (USD)"],
            budget
        ),
        "Intl. BO by Budget": divideByPositive(
            movie["International Box Office (USD)"],
            budget
        ),
        "WW BO by Budget": divideByPositive(
            movie["Worldwide Box Office (USD)"],
            budget
        ),
        "Open Wknd by Budget": divideByPositive(
            movie["Opening Weekend (USD)"],
            budget
        )
    };
}

const genrePalette = [
    "#4e79a7", "#f28e2b", "#e15759", "#76b7b2",
    "#59a14f", "#edc949", "#af7aa1", "#ff9da7",
    "#9c755f", "#bab0ab", "#17becf", "#8c564b", "#bcbd22"
];

function getAvailableGenres(movies) {
    return Array.from(new Set(
        movies
            .filter((movie) =>
                movie.Genre?.trim() &&
                Number.isFinite(movie["Worldwide Box Office (USD)"])
            )
            .map((movie) => movie.Genre.trim())
    )).sort(d3.ascending);
}

function createGenreButtons(controls, genres, selectedGenres, genreColor, onChange) {
    if (genres.length === 0) {
        controls.text("No genre data available.");
        return;
    }

    controls.text(null);
    const genreOptions = controls.append("div")
        .attr("class", "genre-options");
    const selectAllButton = genreOptions.append("button")
        .attr("type", "button")
        .attr("class", "metric-button genre-action-button")
        .text("Select all");
    const buttons = genreOptions.selectAll(".genre-option")
        .data(genres)
        .join("button")
        .attr("type", "button")
        .attr("class", "metric-button genre-option")
        .style("--genre-color", (genre) => genreColor(genre))
        .attr("aria-pressed", (genre) =>
            selectedGenres.has(genre) ? "true" : "false"
        )
        .text((genre) => genre);
    const clearButton = genreOptions.append("button")
        .attr("type", "button")
        .attr("class", "metric-button genre-action-button")
        .attr("aria-label", "Clear all genres");
    clearButton.append("span")
        .attr("aria-hidden", "true")
        .attr("class", "clear-icon")
        .text("×");
    clearButton.append("span").text("Clear");

    const updateButtonStates = () => {
        buttons
            .classed("is-active", (genre) => selectedGenres.has(genre))
            .attr("aria-pressed", (genre) =>
                selectedGenres.has(genre) ? "true" : "false"
            );
    };
    updateButtonStates();

    selectAllButton.on("click", () => {
        genres.forEach((genre) => selectedGenres.add(genre));
        updateButtonStates();
        onChange();
    });
    clearButton.on("click", () => {
        selectedGenres.clear();
        updateButtonStates();
        onChange();
    });

    buttons.on("click", (_, selectedGenre) => {
        if (selectedGenres.has(selectedGenre)) {
            selectedGenres.delete(selectedGenre);
        } else {
            selectedGenres.add(selectedGenre);
        }
        updateButtonStates();
        onChange();
    });
}

function renderGenreLegend(legend, data, genreColor) {
    const visibleGenres = Array.from(new Set(data.map((row) => row.genre)));
    const legendItems = legend.selectAll(".genre-legend-item")
        .data(visibleGenres, (genre) => genre)
        .join((enter) => {
            const items = enter.append("span")
                .attr("class", "genre-legend-item")
                .attr("role", "listitem");
            items.append("span")
                .attr("class", "genre-legend-swatch")
                .attr("aria-hidden", "true");
            items.append("span").attr("class", "genre-legend-label");
            return items;
        });
    legendItems.select(".genre-legend-swatch")
        .style("background-color", (genre) => genreColor(genre));
    legendItems.select(".genre-legend-label").text((genre) => genre);
}

function setMovieBandScale(scale, data, plotWidth) {
    scale
        .domain(data.map((row) => row.label))
        .range([0, plotWidth * Math.min(data.length, 10) / 10]);
}

function addBarHover(bars, chart, xAxis, x, y, formatValue) {
    const valueLabel = chart.selectAll(".bar-value")
        .data([null])
        .join("text")
        .attr("class", "bar-value")
        .attr("text-anchor", "middle")
        .attr("pointer-events", "none")
        .attr("aria-hidden", "true");

    valueLabel.style("opacity", 0);
    xAxis.selectAll(".tick text").classed("is-hovered", false);

    bars
        .on("mouseenter.bar-value", (_, row) => {
            valueLabel
                .attr("x", x(row.label) + x.bandwidth() / 2)
                .attr("y", y(row.value) - 6)
                .text(formatValue(row.value))
                .style("opacity", 1);
            xAxis.selectAll(".tick text")
                .classed("is-hovered", (label) => label === row.label);
        })
        .on("mouseleave.bar-value", () => {
            valueLabel.style("opacity", 0);
            xAxis.selectAll(".tick text").classed("is-hovered", false);
        });
}

function revealBarsWhenSectionVisible(container) {
    if (container.node().closest(".section")?.classList.contains("is-visible")) {
        requestAnimationFrame(() => container.classed("bars-visible", true));
    }
}

function renderBarChart(elementId, data, options) {
    const container = d3.select(`#${elementId}`);
    container.classed("bars-visible", false);
    container.text(null);

    if (data.length === 0) {
        container.text("No data available for this chart.");
        return;
    }

    const width = Math.max(container.node().clientWidth, 360);
    const height = 480;
    const margin = { top: 20, right: 24, bottom: 180, left: 88 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "presentation")
        .style("width", "100%")
        .style("height", "auto");

    const x = d3.scaleBand().padding(0.2);
    setMovieBandScale(x, data, innerWidth);
    const y = d3.scaleLinear()
        .domain([
            0,
            options.domainMax ?? d3.max(data, (row) => row.value) * 1.08
        ])
        .nice()
        .range([innerHeight, 0]);

    const chart = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    chart.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(() => ""))
        .call((axis) => axis.select(".domain").remove());

    chart.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(options.formatAxis));

    const xAxis = chart.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x));
    xAxis.selectAll("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-50)")
        .attr("dx", "-0.65em")
        .attr("dy", "0.15em");

    const bars = chart.selectAll(".bar")
        .data(data)
        .join("rect")
        .attr("class", (row) => row.label === "Titanic" ? "bar is-titanic" : "bar")
        .attr("x", (row) => x(row.label))
        .attr("y", (row) => y(row.value))
        .attr("width", x.bandwidth())
        .attr("height", (row) => innerHeight - y(row.value))
        .style("--bar-order", (_, index) => index);
    bars.append("title").text((row) => options.formatTooltip(row));

    addBarHover(
        bars,
        chart,
        xAxis,
        x,
        y,
        options.formatValue
    );

    svg.append("text")
        .attr("class", "axis-label")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(20,${margin.top + innerHeight / 2}) rotate(-90)`)
        .text(options.yLabel);
    svg.append("text")
        .attr("class", "axis-label")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height - 8)
        .text(options.xLabel);

    revealBarsWhenSectionVisible(container);
}

function createMovieRankingChart(elementId, movies, sharedDomains) {
    const container = d3.select(`#${elementId}`);
    const genreControls = d3.select("#ranking-genre-controls");
    const genreLegend = d3.select("#ranking-genre-legend");
    const availableGenres = getAvailableGenres(movies);
    const selectedGenres = new Set(availableGenres.slice(0, 1));
    const genreColor = d3.scaleOrdinal(availableGenres, genrePalette);
    container.classed("bars-visible", false);
    container.text(null);

    const width = Math.max(container.node().clientWidth, 360);
    const height = 480;
    const margin = { top: 20, right: 24, bottom: 180, left: 88 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const markets = {
        domestic: {
            label: "domestic",
            axisLabelPrefix: "Domestic",
            fields: {
                raw: "Domestic Box Office (USD)",
                inflation: "Infl. Adj. Dom. BO (USD)",
                budget: "Dom. BO by Budget"
            }
        },
        worldwide: {
            label: "worldwide",
            axisLabelPrefix: "Worldwide",
            fields: {
                raw: "Worldwide Box Office (USD)",
                inflation: "Infl. Adj. WW BO (USD)",
                budget: "WW BO by Budget"
            }
        }
    };
    const measures = {
        raw: {
            label: "box office",
            axisLabel: "Box Office Earnings (USD)",
            format: formatMoney,
            formatValue: formatExactMoney,
            domainMax: sharedDomains.usd
        },
        inflation: {
            label: "inflation-adjusted box office",
            axisLabel: "Inflation-Adjusted Box Office Earnings (USD)",
            format: formatMoney,
            formatValue: formatExactMoney,
            domainMax: sharedDomains.usd
        },
        budget: {
            label: "box office-to-budget ratio",
            axisLabel: "Box Office Earnings over Production Budget",
            format: (value) => `${d3.format(".2~f")(value)}×`,
            formatValue: formatExactRatio,
            domainMax: sharedDomains.budgetRatio
        }
    };

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "presentation")
        .style("width", "100%")
        .style("height", "auto");
    const x = d3.scaleBand().padding(0.2);
    const y = d3.scaleLinear().range([innerHeight, 0]);
    const chart = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    const grid = chart.append("g").attr("class", "grid");
    const yAxis = chart.append("g").attr("class", "axis y-axis");
    const xAxis = chart.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0,${innerHeight})`);
    const axisLabel = svg.append("text")
        .attr("class", "axis-label")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(20,${margin.top + innerHeight / 2}) rotate(-90)`);
    svg.append("text")
        .attr("class", "axis-label")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height - 8)
        .text("Movie Title");

    let selectedMarket = "worldwide";
    let selectedMeasure = "raw";

    function update(animate) {
        const market = markets[selectedMarket];
        const measure = measures[selectedMeasure];
        const field = market.fields[selectedMeasure];
        const data = movies
            .filter((movie) =>
                (availableGenres.length === 0 || selectedGenres.has(movie.Genre?.trim())) &&
                Number.isFinite(movie[field]) &&
                (selectedMeasure !== "budget" || movie[field] > 0)
            )
            .sort((a, b) => d3.descending(a[field], b[field]))
            .slice(0, 10)
            .map((movie) => ({
                label: movie["Movie Name"],
                value: movie[field],
                genre: movie.Genre?.trim()
            }));

        setMovieBandScale(x, data, innerWidth);
        y.domain([0, measure.domainMax]).nice();

        const transition = animate
            ? svg.transition().duration(1000).ease(d3.easeCubicInOut)
            : null;
        const gridAxis = d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(() => "");
        const valueAxis = d3.axisLeft(y).ticks(5).tickFormat(measure.format);
        const categoryAxis = d3.axisBottom(x);

        if (transition) {
            grid.transition(transition).call(gridAxis);
            yAxis.transition(transition).call(valueAxis);
            xAxis.transition(transition).call(categoryAxis);
        } else {
            grid.call(gridAxis);
            yAxis.call(valueAxis);
            xAxis.call(categoryAxis);
        }

        xAxis.selectAll("text")
            .attr("text-anchor", "end")
            .attr("transform", "rotate(-50)")
            .attr("dx", "-0.65em")
            .attr("dy", "0.15em");
        axisLabel.text(`${market.axisLabelPrefix} ${measure.axisLabel}`);

        const bars = chart.selectAll(".movie-bar")
            .data(data, (row) => row.label);
        const entering = bars.enter()
            .append("rect")
            .attr("class", "bar movie-bar genre-bar")
            .attr("x", (row) => animate ? innerWidth + x.bandwidth() : x(row.label))
            .attr("y", (row) => animate ? y(row.value) : innerHeight)
            .attr("width", x.bandwidth())
            .attr("height", (row) => animate ? innerHeight - y(row.value) : 0)
            .style("opacity", animate ? 0 : 1);
        entering.append("title");

        const merged = entering.merge(bars);

        merged.style("fill", (row) => genreColor(row.genre));
        merged.select("title")
            .text((row) => `${row.label}: ${measure.formatValue(row.value)}`);
        addBarHover(merged, chart, xAxis, x, y, measure.formatValue);

        if (transition) {
            bars.exit()
                .transition(transition)
                .attr("y", innerHeight)
                .attr("height", 0)
                .style("opacity", 0)
                .remove();
            merged.transition(transition)
                .attr("x", (row) => x(row.label))
                .attr("y", (row) => y(row.value))
                .attr("width", x.bandwidth())
                .attr("height", (row) => innerHeight - y(row.value))
                .style("opacity", 1);
        } else {
            bars.exit().remove();
            merged
                .attr("x", (row) => x(row.label))
                .attr("y", (row) => y(row.value))
                .attr("width", x.bandwidth())
                .attr("height", (row) => innerHeight - y(row.value))
                .style("opacity", 1);
        }

        renderGenreLegend(genreLegend, data, genreColor);

        const chartDescription = availableGenres.length === 0
            ? `Top ten by ${market.label} ${measure.label}`
            : selectedGenres.size > 0
                ? `Top ten by ${market.label} ${measure.label} across ${selectedGenres.size} selected genre${selectedGenres.size === 1 ? "" : "s"}`
                : `Select one or more genres to view the top ten by ${market.label} ${measure.label}`;
        document.getElementById("ranking-caption").textContent = chartDescription;
        container.attr("aria-label", chartDescription);
    }

    createGenreButtons(
        genreControls,
        availableGenres,
        selectedGenres,
        genreColor,
        () => update(true)
    );

    const marketButtons = d3.selectAll(".metric-button[data-market]");
    marketButtons.on("click", function() {
        const selectedButton = this;
        const marketKey = this.dataset.market;
        if (marketKey === selectedMarket) return;
        selectedMarket = marketKey;
        marketButtons
            .classed("is-active", function() { return this === selectedButton; })
            .attr("aria-pressed", function() { return this === selectedButton ? "true" : "false"; });
        update(true);
    });

    const measureButtons = d3.selectAll(".metric-button[data-measure]");
    measureButtons.on("click", function() {
        const selectedButton = this;
        const measureKey = this.dataset.measure;
        if (measureKey === selectedMeasure) return;
        selectedMeasure = measureKey;
        measureButtons
            .classed("is-active", function() { return this === selectedButton; })
            .attr("aria-pressed", function() { return this === selectedButton ? "true" : "false"; });
        update(true);
    });

    update(false);
    revealBarsWhenSectionVisible(container);
}

function createGenreChart(movies, sharedBudgetRatioMax) {
    const container = d3.select("#graph-4");
    const genreControls = d3.select("#genre-controls");
    const genreLegend = d3.select("#genre-legend");
    container.classed("bars-visible", false);
    const availableGenres = getAvailableGenres(movies);

    if (availableGenres.length === 0) {
        genreControls.text("No genre data available.");
        container.text("No genre data available.");
        return;
    }

    const selectedGenres = new Set([availableGenres[0]]);
    const genreColor = d3.scaleOrdinal(availableGenres, genrePalette);
    const width = Math.max(container.node().clientWidth, 360);
    const height = 480;
    const margin = { top: 20, right: 24, bottom: 180, left: 88 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    container.text(null);
    genreControls.text(null);

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "presentation")
        .style("width", "100%")
        .style("height", "auto");
    const x = d3.scaleBand().padding(0.2);
    const y = d3.scaleLinear().range([innerHeight, 0]);
    const chart = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    const grid = chart.append("g").attr("class", "grid");
    const yAxis = chart.append("g").attr("class", "axis y-axis");
    const xAxis = chart.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0,${innerHeight})`);
    svg.append("text")
        .attr("class", "axis-label")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(20,${margin.top + innerHeight / 2}) rotate(-90)`)
        .text("Worldwide Box Office over Production Budget");
    svg.append("text")
        .attr("class", "axis-label")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height - 8)
        .text("Movie Title");

    function update(animate) {
        const data = movies
            .filter((movie) =>
                selectedGenres.has(movie.Genre?.trim()) &&
                Number.isFinite(movie["WW BO by Budget"]) &&
                movie["WW BO by Budget"] > 0
            )
            .sort((a, b) =>
                d3.descending(a["WW BO by Budget"], b["WW BO by Budget"])
            )
            .slice(0, 10)
            .map((movie) => ({
                label: movie["Movie Name"],
                value: movie["WW BO by Budget"],
                genre: movie.Genre.trim()
            }));

        setMovieBandScale(x, data, innerWidth);
        y.domain([0, sharedBudgetRatioMax]).nice();

        const transition = animate
            ? svg.transition().duration(1000).ease(d3.easeCubicInOut)
            : null;
        const gridAxis = d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(() => "");
        const valueAxis = d3.axisLeft(y).ticks(5)
            .tickFormat((value) => `${d3.format(".2~f")(value)}×`);
        const categoryAxis = d3.axisBottom(x);

        if (transition) {
            grid.transition(transition).call(gridAxis);
            yAxis.transition(transition).call(valueAxis);
            xAxis.transition(transition).call(categoryAxis);
        } else {
            grid.call(gridAxis);
            yAxis.call(valueAxis);
            xAxis.call(categoryAxis);
        }

        xAxis.selectAll("text")
            .attr("text-anchor", "end")
            .attr("transform", "rotate(-50)")
            .attr("dx", "-0.65em")
            .attr("dy", "0.15em");

        const bars = chart.selectAll(".movie-bar")
            .data(data, (row) => row.label);
        const entering = bars.enter()
            .append("rect")
            .attr("class", "bar movie-bar genre-bar")
            .attr("x", (row) => animate ? innerWidth + x.bandwidth() : x(row.label))
            .attr("y", (row) => animate ? y(row.value) : innerHeight)
            .attr("width", x.bandwidth())
            .attr("height", (row) => animate ? innerHeight - y(row.value) : 0)
            .style("opacity", animate ? 0 : 1);
        entering.append("title");

        const merged = entering.merge(bars);

        merged
            .classed("is-titanic", (row) => row.label === "Titanic")
            .style("fill", (row) =>
                row.label === "Titanic" ? titanicBarColor : genreColor(row.genre)
            );
        merged.select("title")
            .text((row) => `${row.label}: ${formatExactRatio(row.value)}`);
        addBarHover(merged, chart, xAxis, x, y, formatExactRatio);

        if (transition) {
            bars.exit()
                .transition(transition)
                .attr("y", innerHeight)
                .attr("height", 0)
                .style("opacity", 0)
                .remove();
            bars.transition(transition)
                .attr("x", (row) => x(row.label))
                .attr("y", (row) => y(row.value))
                .attr("width", x.bandwidth())
                .attr("height", (row) => innerHeight - y(row.value))
                .style("opacity", 1);
            entering.transition(transition)
                .attr("x", (row) => x(row.label))
                .attr("y", (row) => y(row.value))
                .attr("width", x.bandwidth())
                .attr("height", (row) => innerHeight - y(row.value))
                .style("opacity", 1);
        } else {
            bars.exit().remove();
            merged
                .attr("x", (row) => x(row.label))
                .attr("y", (row) => y(row.value))
                .attr("width", x.bandwidth())
                .attr("height", (row) => innerHeight - y(row.value))
                .style("opacity", 1);
        }

        renderGenreLegend(genreLegend, data, genreColor);

        const chartDescription = selectedGenres.size > 0
            ? `Top ten movies across ${selectedGenres.size} selected genre${selectedGenres.size === 1 ? "" : "s"} by box office-to-budget ratio`
            : "Select one or more genres to display the top ten movies by box office-to-budget ratio";
        document.getElementById("genre-caption").textContent = chartDescription;
        container.attr("aria-label", chartDescription);
    }

    createGenreButtons(
        genreControls,
        availableGenres,
        selectedGenres,
        genreColor,
        () => update(true)
    );

    update(false);
    revealBarsWhenSectionVisible(container);
}

function initializeSectionAnimations() {
    const panels = document.querySelectorAll(".header, .section");
    if (!("IntersectionObserver" in window)) return;

    document.body.classList.add("has-scroll-animations");
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            entry.target.querySelectorAll(".graph").forEach((graph) => {
                graph.classList.add("bars-visible");
            });
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.3 });

    panels.forEach((panel) => observer.observe(panel));
}

async function loadCharts() {
    const rows = await d3.csv("Complete_Movie_Data.csv", d3.autoType);
    const movies = rows
        .filter((row) => row["Movie Name"])
        .map(calculateMovieMetrics);
    const usdScaleMax = d3.max(
        movies.flatMap((movie) => [
            movie["Domestic Box Office (USD)"],
            movie["Worldwide Box Office (USD)"],
            movie["Infl. Adj. Dom. BO (USD)"],
            movie["Infl. Adj. WW BO (USD)"]
        ]).filter(Number.isFinite)
    );
    const budgetRatioScaleMax = d3.max(
        movies.filter((movie) =>
            Number.isFinite(movie["WW BO by Budget"]) &&
            movie["WW BO by Budget"] > 0
        ),
        (movie) => movie["WW BO by Budget"]
    );
    const topMovies = (field, requirePositive = false) => movies
        .filter((movie) =>
            Number.isFinite(movie[field]) &&
            (!requirePositive || movie[field] > 0)
        )
        .sort((a, b) => d3.descending(a[field], b[field]))
        .slice(0, 10)
        .map((movie) => ({ label: movie["Movie Name"], value: movie[field] }));

    renderBarChart("graph-domestic", topMovies("Domestic Box Office (USD)"), {
        xLabel: "Movie Title",
        yLabel: "Domestic Box Office Earnings (USD)",
        formatAxis: formatMoney,
        formatValue: formatExactMoney,
        formatTooltip: (row) => `${row.label}: ${formatExactMoney(row.value)}`
    });

    renderBarChart("graph-1", topMovies("Worldwide Box Office (USD)"), {
        xLabel: "Movie Title",
        yLabel: "Box Office Earnings (USD)",
        formatAxis: formatMoney,
        formatValue: formatExactMoney,
        formatTooltip: (row) => `${row.label}: ${formatExactMoney(row.value)}`
    });

    renderBarChart("graph-2", topMovies("Infl. Adj. WW BO (USD)"), {
        xLabel: "Movie Title",
        yLabel: "Adjusted Box Office Earnings (USD)",
        formatAxis: formatMoney,
        formatValue: formatExactMoney,
        formatTooltip: (row) => `${row.label}: ${formatExactMoney(row.value)}`
    });

    renderBarChart("graph-3", topMovies("WW BO by Budget", true), {
        xLabel: "Movie Title",
        yLabel: "Box Office Earnings over Production Budget",
        formatAxis: (value) => `${d3.format(".2~f")(value)}×`,
        formatValue: formatExactRatio,
        formatTooltip: (row) => `${row.label}: ${formatExactRatio(row.value)} budget`
    });

    createGenreChart(movies, budgetRatioScaleMax);
    createMovieRankingChart("graph-5", movies, {
        usd: usdScaleMax,
        budgetRatio: budgetRatioScaleMax
    });
}

initializeSectionAnimations();

loadCharts().catch((error) => {
    console.error("Could not load the movie charts:", error);
    document.querySelectorAll(".graph").forEach((container) => {
        container.textContent =
            "Charts could not load. Run this page through a local web server and check that Complete_Movie_Data.csv is beside index.html.";
    });
});
