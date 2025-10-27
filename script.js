const fileInput = document.getElementById('json-files-input');
const fileCount = document.getElementById('file-count');
const dropZone = document.getElementById('drop-zone');

fileInput.addEventListener('change', () => {
    updateFileCount(fileInput.files);
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    fileInput.files = e.dataTransfer.files;
    updateFileCount(fileInput.files);
});

function updateFileCount(files) {
    fileCount.textContent = `${files.length} file(s) selected`;
}

const loader = document.getElementById('loader');
const errorMessage = document.getElementById('error-message');
const summarySection = document.getElementById('summary-section');
const chartsSection = document.getElementById('charts-section');

async function handleFileProcessing() {
    const fileInput = document.getElementById('json-files-input');
    const files = fileInput.files;

    if (files.length === 0) {
        showError('Please select your Spotify JSON files first.');
        return;
    }

    resetUI();
    loader.classList.remove('hidden');

    try {
        let allStreams = [];
        for (const file of files) {
            const fileContent = await readFileAsText(file);
            const jsonData = JSON.parse(fileContent);
            if (Array.isArray(jsonData)) {
                allStreams = allStreams.concat(jsonData);
            }
        }

        const standardizedStreams = allStreams.map(standardizeStreamData);

        if (standardizedStreams.length > 0) {
            const validStreams = standardizedStreams.filter(stream => {
                const streamDate = new Date(stream.endTime);
                return stream.msPlayed > 0 &&
                       stream.trackName &&
                       stream.artistName &&
                       stream.endTime &&
                       !isNaN(streamDate.getTime());
            });
            displayDashboard(validStreams);
        } else {
            showError('No streaming data found in the selected files.');
        }
    } catch (error) {
        showError('Error reading or parsing files. Please make sure they are valid JSON files.');
        console.error(error);
    } finally {
        loader.classList.add('hidden');
    }
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function standardizeStreamData(stream) {
    // Handles variations in Spotify's JSON export format.
    return {
        endTime: stream.endTime || stream.ts,
        artistName: stream.artistName || stream.master_metadata_album_artist_name,
        trackName: stream.trackName || stream.master_metadata_track_name,
        msPlayed: stream.msPlayed || stream.ms_played,
    };
}

function displayDashboard(data) {
    if (data.length === 0) {
        showError('No valid streaming history could be found in your files. Please ensure the files are correct and contain playable tracks.');
        return;
    }
    summarySection.classList.remove('hidden');
    chartsSection.classList.remove('hidden');

    displaySummaryStats(data);

    // Chart Creations
    const listeningOverTime = getListeningOverTime(data);
    createLineChart('listening-over-time-chart', 'Listening Over Time (Hours per Month)', listeningOverTime.labels, listeningOverTime.data);

    const topArtists = getTopItems(data, 'artistName', 10);
    if (topArtists.labels.length > 0) {
        createBarChart('top-artists-chart', 'Top 10 Artists', topArtists.labels, topArtists.data);
    }

    const topTracks = getTopItems(data, 'trackName', 10);
    if (topTracks.labels.length > 0) {
        createBarChart('top-tracks-chart', 'Top 10 Tracks', topTracks.labels, topTracks.data);
    }

    const hourlyActivity = getHourlyActivity(data);
    createBarChart('hourly-activity-chart', 'Listening Activity by Hour', hourlyActivity.labels, hourlyActivity.data, 'Plays');

    const dailyActivity = getDailyActivity(data);
    createBarChart('daily-activity-chart', 'Listening Activity by Day of Week', dailyActivity.labels, dailyActivity.data, 'Plays');
}

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

    statsContainer.innerHTML = Object.entries(stats).map(([key, value]) => `
        <div class="stat-item">
            <h3>${value}</h3>
            <p>${key}</p>
        </div>
    `).join('');
}

function getListeningOverTime(data) {
    const monthlyHours = {};

    data.forEach(stream => {
        const date = new Date(stream.endTime);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyHours[monthYear] = (monthlyHours[monthYear] || 0) + stream.msPlayed;
    });

    const sortedMonths = Object.keys(monthlyHours).sort();

    return {
        labels: sortedMonths.map(month => new Date(month + '-01').toLocaleString('default', { month: 'short', year: 'numeric' })),
        data: sortedMonths.map(month => parseFloat((monthlyHours[month] / 3600000).toFixed(2))) // ms to hours
    };
}


function getTopItems(data, itemKey, count) {
    const itemCounts = data.reduce((acc, stream) => {
        const item = stream[itemKey];
        if(item) {
            acc[item] = (acc[item] || 0) + stream.msPlayed;
        }
        return acc;
    }, {});

    const sortedItems = Object.entries(itemCounts).sort(([, a], [, b]) => b - a).slice(0, count);
    return {
        labels: sortedItems.map(([label]) => label),
        data: sortedItems.map(([, msPlayed]) => parseFloat((msPlayed / 60000).toFixed(2))) // ms to minutes
    };
}

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

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

function resetUI() {
    summarySection.classList.add('hidden');
    chartsSection.classList.add('hidden');
    errorMessage.classList.add('hidden');
}

// Chart.js reusable functions
let charts = {};
function createChart(canvasId, type, title, labels, data, label, options = {}) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }
    charts[canvasId] = new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                backgroundColor: 'rgba(29, 185, 84, 0.2)',
                borderColor: 'rgba(29, 185, 84, 1)',
                borderWidth: 1,
                pointBackgroundColor: 'rgba(29, 185, 84, 1)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: title,
                    color: '#fff',
                    font: { size: 16 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#b3b3b3' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#b3b3b3' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            },
            ...options
        }
    });
}

function createBarChart(canvasId, title, labels, data, label = 'Minutes Played') {
    createChart(canvasId, 'bar', title, labels, data, label);
}

function createLineChart(canvasId, title, labels, data, label = 'Hours Played') {
    createChart(canvasId, 'line', title, labels, data, label);
}
