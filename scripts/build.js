const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// Ensure TEMP and TMP point to user's writable AppData/Local/Temp on Windows
// to prevent makensis permission errors with C:\Windows\TEMP
if (process.platform === 'win32') {
    const userTemp = process.env.LOCALAPPDATA 
        ? path.join(process.env.LOCALAPPDATA, 'Temp') 
        : os.tmpdir();
    process.env.TEMP = userTemp;
    process.env.TMP = userTemp;
}

const args = process.argv.slice(2);
const builderBin = path.join(__dirname, '..', 'node_modules', '.bin', process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder');

console.log(`[Imress Build] Building with optimal configuration (TEMP: ${process.env.TEMP})...`);

const child = spawn(builderBin, args.length > 0 ? args : ['--win'], {
    stdio: 'inherit',
    env: process.env,
    shell: true
});

child.on('close', (code) => {
    process.exit(code);
});
