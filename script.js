document.getElementById('process-files-btn').addEventListener('click', handleFileProcessing);

async function handleFileProcessing() {
    const fileInput = document.getElementById('json-files-input');
    const files = fileInput.files;

    if (files.length === 0) {
        alert('Please select your Spotify JSON files first.');
        return;
    }

    let allStreams = [];
    try {
        for (const file of files) {
            const fileContent = await readFileAsText(file);
            const jsonData = JSON.parse(fileContent);
            if (Array.isArray(jsonData)) {
                allStreams = allStreams.concat(jsonData);
            }
        }
    } catch (error) {
        alert('Error reading or parsing files. Please make sure you have selected the correct JSON files.');
        console.error(error);
        return;
    }

    if (allStreams.length > 0) {
        displayDashboard(allStreams);
    } else {
        alert('No streaming data found in the selected files.');
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

function displayDashboard(data) {
    document.getElementById('dashboard-section').style.display = 'block';

    const totalListenTime = data.reduce((acc, stream) => acc + stream.msPlayed, 0);
    const totalHours = (totalListenTime / (1000 * 60 * 60)).toFixed(2);
    document.getElementById('stats-container').innerHTML = `<h3>Total Listening Time: ${totalHours} hours</h3>`;

    const topArtists = getTopItems(data, 'artistName', 10);
    createBarChart('top-artists-chart', 'Top 10 Artists', topArtists.labels, topArtists.data);

    const topTracks = getTopItems(data, 'trackName', 10);
    createBarChart('top-tracks-chart', 'Top 10 Tracks', topTracks.labels, topTracks.data);

    const hourlyActivity = getHourlyActivity(data);
    createBarChart('hourly-activity-chart', 'Listening Activity by Hour', hourlyActivity.labels, hourlyActivity.data, 'Plays');

    const dailyActivity = getDailyActivity(data);
    createBarChart('daily-activity-chart', 'Listening Activity by Day of Week', dailyActivity.labels, dailyActivity.data, 'Plays');
}

function getTopItems(data, itemKey, count) {
    const itemCounts = data.reduce((acc, stream) => {
        const item = stream[itemKey];
        acc[item] = (acc[item] || 0) + stream.msPlayed;
        return acc;
    }, {});

    const sortedItems = Object.entries(itemCounts).sort(([, a], [, b]) => b - a).slice(0, count);
    return {
        labels: sortedItems.map(([label]) => label),
        data: sortedItems.map(([, msPlayed]) => (msPlayed / (1000 * 60)).toFixed(2)) // in minutes
    };
}

function getHourlyActivity(data) {
    const hourlyCounts = new Array(24).fill(0);
    data.forEach(stream => {
        const hour = new Date(stream.endTime).getHours();
        hourlyCounts[hour]++;
    });

    return {
        labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        data: hourlyCounts
    };
}

function getDailyActivity(data) {
    const dailyCounts = new Array(7).fill(0);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    data.forEach(stream => {
        const day = new Date(stream.endTime).getDay();
        dailyCounts[day]++;
    });

    return {
        labels: days,
        data: dailyCounts
    };
}

let charts = {};

function createBarChart(canvasId, title, labels, data, label = 'Minutes Played') {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }
    charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                backgroundColor: 'rgba(29, 185, 84, 0.5)',
                borderColor: 'rgba(29, 185, 84, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: title
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}
