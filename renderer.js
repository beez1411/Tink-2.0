// renderer.js - Frontend logic for the Electron app

let selectedFile = null;

// DOM elements
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const runSuggestedOrderBtn = document.getElementById('runSuggestedOrderBtn');
const runCheckAceNetBtn = document.getElementById('runCheckAceNetBtn');
const checkDepsBtn = document.getElementById('checkDepsBtn');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const logOutput = document.getElementById('logOutput');
const daysThreshold = document.getElementById('daysThreshold');
const currentMonth = document.getElementById('currentMonth');
const acenetOptions = document.getElementById('acenetOptions');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const storeNumberInput = document.getElementById('storeNumber');
const sheetNameInput = document.getElementById('sheetName');

// File selection handling
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        const result = await window.api.selectFile();
        if (result) {
            selectedFile = result;
            fileName.textContent = result.name;
            fileSize.textContent = formatFileSize(result.size);
            fileInfo.style.display = 'block';
            runSuggestedOrderBtn.disabled = false;
            addLog(`File selected: ${result.name}`, 'info');
        }
    }
});

document.querySelector('.file-input-label').addEventListener('click', async (e) => {
    e.preventDefault();
    const result = await window.api.selectFile();
    if (result) {
        selectedFile = result;
        fileName.textContent = result.name;
        fileSize.textContent = formatFileSize(result.size);
        fileInfo.style.display = 'block';
        runSuggestedOrderBtn.disabled = false;
        addLog(`File selected: ${result.name}`, 'info');
    }
});

// Run Suggested Order button
runSuggestedOrderBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    acenetOptions.style.display = 'none';
    progressSection.style.display = 'block';
    runSuggestedOrderBtn.disabled = true;
    progressFill.style.width = '0%';
    logOutput.innerHTML = '';
    addLog('Starting Suggested Order processing...', 'info');
    window.api.onProcessingUpdate((data) => {
        if (data.type === 'log') {
            addLog(data.message, 'info');
            updateProgressFromLog(data.message);
        } else if (data.type === 'error') {
            addLog(data.message, 'error');
        }
    });
    try {
        const result = await window.api.processFile({
            filePath: selectedFile.path,
            scriptType: 'suggested_order',
            daysThreshold: parseInt(daysThreshold.value),
            currentMonth: parseInt(currentMonth.value)
        });
        if (result.success) {
            progressFill.style.width = '100%';
            addLog('Processing completed successfully!', 'success');
            addLog(`Output saved to: ${result.outputFile}`, 'success');
        } else {
            addLog('Processing failed: ' + result.error, 'error');
        }
    } catch (error) {
        addLog('Error: ' + error.message, 'error');
    } finally {
        runSuggestedOrderBtn.disabled = false;
        window.api.removeAllListeners('processing-update');
    }
});

// Run Check AceNet button
runCheckAceNetBtn.addEventListener('click', async () => {
    acenetOptions.style.display = 'block';
    progressSection.style.display = 'block';
    logOutput.innerHTML = '';
    addLog('Starting AceNet check...', 'info');
    window.api.onProcessingUpdate((data) => {
        if (data.type === 'log') {
            addLog(data.message, 'info');
            updateProgressFromLog(data.message);
        } else if (data.type === 'error') {
            addLog(data.message, 'error');
        }
    });
    try {
        // Always use the Desktop output file from Suggested Order
        const desktop = require('os').homedir() + '/Desktop';
        const suggestedOrderFile = `${desktop}/Suggested Order -- ${new Date().toISOString().split('T')[0]}.xlsx`;
        const result = await window.api.processFile({
            filePath: suggestedOrderFile,
            scriptType: 'check_acenet',
            daysThreshold: parseInt(daysThreshold.value),
            currentMonth: parseInt(currentMonth.value),
            username: usernameInput.value,
            password: passwordInput.value,
            store: storeNumberInput.value,
            sheetName: sheetNameInput.value
        });
        if (result.success) {
            progressFill.style.width = '100%';
            addLog('AceNet check completed successfully!', 'success');
            addLog(`Output saved to: ${result.outputFile}`, 'success');
        } else {
            addLog('AceNet check failed: ' + result.error, 'error');
        }
    } catch (error) {
        addLog('Error: ' + error.message, 'error');
    } finally {
        window.api.removeAllListeners('processing-update');
    }
});

// Check dependencies button
checkDepsBtn.addEventListener('click', async () => {
    progressSection.style.display = 'block';
    logOutput.innerHTML = '';
    addLog('Checking Python dependencies...', 'info');
    try {
        const deps = await window.api.checkDependencies();
        for (const [name, info] of Object.entries(deps)) {
            if (info.installed) {
                addLog(`✓ ${name} (${info.version || 'installed'})`, 'success');
            } else {
                addLog(`✗ ${name} - Not installed`, 'error');
            }
        }
        const allInstalled = Object.values(deps).every(d => d.installed);
        if (!allInstalled) {
            addLog('Some dependencies are missing.', 'warning');
            const installBtn = document.createElement('button');
            installBtn.textContent = 'Install Missing Dependencies';
            installBtn.className = 'btn btn-primary';
            installBtn.style.marginTop = '10px';
            installBtn.onclick = installDependencies;
            logOutput.appendChild(installBtn);
        } else {
            addLog('All dependencies are installed!', 'success');
        }
    } catch (error) {
        addLog('Error checking dependencies: ' + error.message, 'error');
    }
});

// Install dependencies function
async function installDependencies() {
    addLog('Installing dependencies...', 'info');
    window.api.onInstallUpdate((data) => {
        if (data.type === 'log') {
            addLog(data.message, 'info');
        } else if (data.type === 'error') {
            addLog(data.message, 'error');
        }
    });
    try {
        const result = await window.api.installDependencies();
        if (result.success) {
            addLog('Dependencies installed successfully!', 'success');
        } else {
            addLog('Installation failed: ' + result.error, 'error');
        }
    } catch (error) {
        addLog('Error installing dependencies: ' + error.message, 'error');
    } finally {
        window.api.removeAllListeners('install-update');
    }
}

// Helper functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const index = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, index)).toFixed(2)) + ' ' + sizes[index];
}

function addLog(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    const indicator = document.createElement('span');
    indicator.className = `status-indicator status-${type === 'info' ? 'ready' : type === 'success' ? 'ready' : type === 'warning' ? 'processing' : 'error'}`;
    entry.appendChild(indicator);
    entry.appendChild(document.createTextNode(message));
    logOutput.appendChild(entry);
    logOutput.scrollTop = logOutput.scrollHeight;
}

function updateProgressFromLog(message) {
    if (message.includes('Processing chunk')) {
        const match = message.match(/chunk (\d+)/);
        if (match) {
            const chunk = parseInt(match[1]);
            progressFill.style.width = Math.min(chunk * 10, 90) + '%';
        }
    } else if (message.includes('Cluster Centers')) {
        progressFill.style.width = '50%';
    } else if (message.includes('order saved to')) {
        progressFill.style.width = '100%';
    }
}

// Initialize current month
currentMonth.value = new Date().getMonth() + 1;