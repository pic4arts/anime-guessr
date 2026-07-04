const { spawn } = require('child_process');
const { startServer } = require('./server');

startServer();

setTimeout(() => {
    const browser = spawn('cmd.exe', ['/c', 'start', '', 'http://localhost:3000'], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
    });

    browser.unref();
}, 1000);
