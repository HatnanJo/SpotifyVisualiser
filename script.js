// Global variable to hold chart instances for later destruction.
let charts = {};

// --- DOM Element References ---
const fileInput = document.getElementById('json-files-input');
const fileCount = document.getElementById('file-count');
const dropZone = document.getElementById('drop-zone');
const processBtn = document.getElementById('process-files-btn');
const loader = document.getElementById('loader');
const errorMessage = document.getElementById('error-message');
const summarySection = document.getElementById('summary-section');
const chartsSection = document.getElementById('charts-section');

// --- Event Listeners ---

// Listen for clicks on the main "Process Files" button.
processBtn.addEventListener('click', handleFileProcessing);

// Update the file count label when files are selected via the input.
fileInput.addEventListener('change', () => {
    updateFileCount(fileInput.files);
});

// --- Drag and Drop Event Handlers ---

// Prevent default browser behavior for dragover.
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

// Remove the dragover class when the user's cursor leaves the drop zone.
dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

// Handle the file drop event.
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    // Assign the dropped files to the file input.
    fileInput.files = e.dataTransfer.files;
    updateFileCount(fileInput.files);
});

/**
 * Updates the file count display.
 * @param {FileList} files - The list of files selected by the user.
 */
function updateFileCount(files) {
    fileCount.textContent = `${files.length} file(s) selected`;
}


// --- Core Application Logic ---

/**
 * Main function to handle the file processing workflow.
 * Reads, parses, and validates user-uploaded JSON files.
 */
async function handleFileProcessing() {
    const files = fileInput.files;

    if (files.length === 0) {
        showError('Please select your Spotify JSON files first.');
        return;
    }

    // Reset the UI to a clean state before processing.
    resetUI();
    loader.classList.remove('hidden');

    try {
        let allStreams = [];
        // Loop through each file, read its content, and parse it as JSON.
        for (const file of files) {
            const fileContent = await readFileAsText(file);
            const jsonData = JSON.parse(fileContent);
            if (Array.isArray(jsonData)) {
                allStreams = allStreams.concat(jsonData);
            }
        }

        // Standardize the data to a consistent format.
        const standardizedStreams = allStreams.map(standardizeStreamData);

        if (standardizedStreams.length > 0) {
            // Filter out invalid or incomplete stream data.
            const validStreams = standardizedStreams.filter(stream => {
                const streamDate = new Date(stream.endTime);
                return stream.msPlayed > 0 &&
                       stream.trackName &&
                       stream.artistName &&
                       stream.endTime &&
                       !isNaN(streamDate.getTime());
            });
            // Display the dashboard with the valid data.
            displayDashboard(validStreams);
        } else {
            showError('No streaming data found in the selected files.');
        }
    } catch (error) {
        showError('Error reading or parsing files. Please make sure they are valid JSON files.');
        console.error(error);
    } finally {
        // Always hide the loader when processing is complete.
        loader.classList.add('hidden');
    }
}

/**
 * Reads a file's content as text.
 * @param {File} file - The file to read.
 * @returns {Promise<string>} A promise that resolves with the file's text content.
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

/**
 * Standardizes a single stream object to a consistent format.
 * This handles variations in Spotify's JSON export format over time.
 * @param {object} stream - The original stream object.
 * @returns {object} A standardized stream object.
 */
function standardizeStreamData(stream) {
    // Handles variations in Spotify's JSON export format.
    return {
        endTime: stream.endTime || stream.ts,
        artistName: stream.artistName || stream.master_metadata_album_artist_name,
        trackName: stream.trackName || stream.master_metadata_track_name,
        msPlayed: stream.msPlayed || stream.ms_played,
    };
}

/**
 * Displays the main dashboard, including summary stats and charts.
 * @param {Array<object>} data - The array of valid stream data.
 */
function displayDashboard(data) {
    if (data.length === 0) {
        showError('No valid streaming history could be found in your files. Please ensure the files are correct and contain playable tracks.');
        return;
    }
    // Make the summary and chart sections visible.
    summarySection.classList.remove('hidden');
    chartsSection.classList.remove('hidden');

    displaySummaryStats(data);

    // --- Chart Creations ---
    // Each chart creation is wrapped in a try...catch block to prevent a single chart
    // error from breaking the entire dashboard.
    try {
        const listeningOverTime = getListeningOverTime(data);
        createLineChart('listening-over-time-chart', 'Listening Over Time (Hours per Month)', listeningOverTime.labels, listeningOverTime.data);
    } catch (error) {
        console.error('Error creating Listening Over Time chart:', error);
    }

    try {
        const topArtists = getTopItems(data, 'artistName', 10);
        if (topArtists.labels.length > 0) {
            createBarChart('top-artists-chart', 'Top 10 Artists', topArtists.labels, topArtists.data);
        }
    } catch (error) {
        console.error('Error creating Top Artists chart:', error);
    }

    try {
        const topTracks = getTopItems(data, 'trackName', 10);
        if (topTracks.labels.length > 0) {
            createBarChart('top-tracks-chart', 'Top 10 Tracks', topTracks.labels, topTracks.data);
        }
    } catch (error) {
        console.error('Error creating Top Tracks chart:', error);
    }

    try {
        const hourlyActivity = getHourlyActivity(data);
        createBarChart('hourly-activity-chart', 'Listening Activity by Hour', hourlyActivity.labels, hourlyActivity.data, 'Plays');
    } catch (error) {
        console.error('Error creating Hourly Activity chart:', error);
    }

    try {
        const dailyActivity = getDailyActivity(data);
        createBarChart('daily-activity-chart', 'Listening Activity by Day of Week', dailyActivity.labels, dailyActivity.data, 'Plays');
    } catch (error) {
        console.error('Error creating Daily Activity chart:', error);
    }
}

/**
 * Calculates and displays summary statistics.
 * @param {Array<object>} data - The array of valid stream data.
 */
function displaySummaryStats(data) {
    const statsContainer = document.getElementById('stats-container');
    const totalMs = data.reduce((acc, stream) => acc + stream.msPlayed, 0);
    const totalMinutes = Math.round(totalMs / 60000);
    const totalHours = (totalMinutes / 60).toFixed(1);

    const uniqueArtists = new Set(data.map(s => s.artistName).filter(Boolean)).size;
    const uniqueSongs = new Set(data.map(s => s.trackName).filter(Boolean)).size;

    const stats = {
        'Total plays': data.length.toLocaleString(),
        'Total minutes': totalMinutes.toLocaleString(),
        'Total hours': totalHours.toLocaleString(),
        'Unique artists': uniqueArtists.toLocaleString(),
        'Unique songs': uniqueSongs.toLocaleString()
    };

    // Generate the HTML for the stats and inject it into the container.
    statsContainer.innerHTML = Object.entries(stats).map(([key, value]) => `
        <div class="stat-item">
            <h3>${value}</h3>
            <p>${key}</p>
        </div>
    `).join('');
}


// --- Data Processing Functions ---

/**
 * Calculates total listening time per month.
 * @param {Array<object>} data - The array of valid stream data.
 * @returns {{labels: string[], data: number[]}} - The labels and data for the chart.
 */
function getListeningOverTime(data) {
    const monthlyHours = {};

    data.forEach(stream => {
        const date = new Date(stream.endTime);
        // Create a 'YYYY-MM' key for grouping.
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyHours[monthYear] = (monthlyHours[monthYear] || 0) + stream.msPlayed;
    });

    // Sort months chronologically.
    const sortedMonths = Object.keys(monthlyHours).sort();

    return {
        labels: sortedMonths.map(month => new Date(month + '-01').toLocaleString('default', { month: 'short', year: 'numeric' })),
        data: sortedMonths.map(month => parseFloat((monthlyHours[month] / 3600000).toFixed(2))) // Convert ms to hours
    };
}

/**
 * Gets the top items (e.g., artists or tracks) by total play time.
 * @param {Array<object>} data - The array of valid stream data.
 * @param {string} itemKey - The key to group by (e.g., 'artistName', 'trackName').
 * @param {number} count - The number of top items to return.
 * @returns {{labels: string[], data: number[]}} - The labels and data for the chart.
 */
function getTopItems(data, itemKey, count) {
    const itemCounts = data.reduce((acc, stream) => {
        const item = stream[itemKey];
        if(item) {
            acc[item] = (acc[item] || 0) + stream.msPlayed;
        }
        return acc;
    }, {});

    // Sort items by play time in descending order and take the top 'count'.
    const sortedItems = Object.entries(itemCounts).sort(([, a], [, b]) => b - a).slice(0, count);
    return {
        labels: sortedItems.map(([label]) => label),
        data: sortedItems.map(([, msPlayed]) => parseFloat((msPlayed / 60000).toFixed(2))) // Convert ms to minutes
    };
}

/**
 * Calculates listening activity by hour of the day.
 * @param {Array<object>} data - The array of valid stream data.
 * @returns {{labels: string[], data: number[]}} - The labels and data for the chart.
 */
function getHourlyActivity(data) {
    const hourlyCounts = new Array(24).fill(0);
    data.forEach(stream => {
        hourlyCounts[new Date(stream.endTime).getHours()]++;
    });
    return {
        labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        data: hourlyCounts
    };
}

/**
 * Calculates listening activity by day of the week.
 * @param {Array<object>} data - The array of valid stream data.
 * @returns {{labels: string[], data: number[]}} - The labels and data for the chart.
 */
function getDailyActivity(data) {
    const dailyCounts = new Array(7).fill(0);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    data.forEach(stream => {
        dailyCounts[new Date(stream.endTime).getDay()]++;
    });
    return {
        labels: days,
        data: dailyCounts
    };
}


// --- UI Utility Functions ---

/**
 * Displays an error message to the user.
 * @param {string} message - The error message to display.
 */
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

/**
 * Resets the UI by hiding the summary, charts, and error messages.
 */
function resetUI() {
    summarySection.classList.add('hidden');
    chartsSection.classList.add('hidden');
    errorMessage.classList.add('hidden');
}


// --- Chart.js Reusable Functions ---
/**
 * A generic function to create or update a chart.
 * @param {string} canvasId - The ID of the canvas element.
 * @param {string} type - The type of chart (e.g., 'bar', 'line').
 * @param {string} title - The title of the chart.
 * @param {Array<string>} labels - The labels for the x-axis.
 * @param {Array<number>} data - The data points for the y-axis.
 * @param {string} label - The label for the dataset.
 */
function createChart(canvasId, type, title, labels, data, label) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    // If a chart instance already exists for this canvas, destroy it first.
    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }
    // Create a new chart and store it in the global 'charts' object.
    charts[canvasId] = new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                backgroundColor: 'rgba(29, 185, 84, 0.2)', // Spotify green
                borderColor: 'rgba(29, 185, 84, 1)',
                borderWidth: 1,
                pointBackgroundColor: 'rgba(29, 185, 84, 1)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: title,
                    color: '#fff',
                    font: {
                        size: 16
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#b3b3b3'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#b3b3b3'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}

/**
 * A helper function to create a bar chart.
 * @param {string} canvasId - The ID of the canvas element.
 * @param {string} title - The title of the chart.
 * @param {Array<string>} labels - The labels for the x-axis.
 * @param {Array<number>} data - The data points for the y-axis.
 * @param {string} [label='Minutes Played'] - The label for the dataset.
 */
function createBarChart(canvasId, title, labels, data, label = 'Minutes Played') {
    createChart(canvasId, 'bar', title, labels, data, label);
}

/**
 * A helper function to create a line chart.
 * @param {string} canvasId - The ID of the canvas element.
 * @param {string} title - The title of the chart.
 * @param {Array<string>} labels - The labels for the x-axis.
 * @param {Array<number>} data - The data points for the y-axis.
 * @param {string} [label='Hours Played'] - The label for the dataset.
 */
function createLineChart(canvasId, title, labels, data, label = 'Hours Played') {
    createChart(canvasId, 'line', title, labels, data, label);
}
