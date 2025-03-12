const { exec } = require('child_process');
const path = require('path');

// Start the server
const server = exec('node server.js', (error, stdout, stderr) => {
    if (error) {
        console.error(`Error: ${error}`);
        return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
});

// Open browser after server starts using Windows 'start' command
setTimeout(() => {
    exec('start http://localhost:3000');
}, 1000);

// Log server output
server.stdout.on('data', (data) => {
    console.log(data.toString());
});

server.stderr.on('data', (data) => {
    console.error(data.toString());
});