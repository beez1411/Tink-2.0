/**
 * Phantom Inventory Window - Frontend Logic
 * Handles all UI interactions for the separate phantom inventory window
 */

class PhantomInventoryWindow {
    constructor() {
        console.log('Phantom popup - Constructor called');
        this.currentStore = null;
        this.isInitialized = false;
        this.lastAnalysisResults = null;
        this.statusCheckRetries = 0;
        this.maxStatusCheckRetries = 10;
        
        // Show loading indicator immediately
        this.showStatus('Phantom Inventory Window loaded. Initializing...', 'info');
        
        this.bindEvents();
        this.checkInitialState();
    }



    bindEvents() {
        console.log('Phantom popup - bindEvents called');
        
        // Store selection
        const storeSelect = document.getElementById('storeSelect');
        console.log('Phantom popup - storeSelect element:', storeSelect);
        if (storeSelect) {
            storeSelect.addEventListener('change', (e) => {
                const initBtn = document.getElementById('initializeBtn');
                initBtn.disabled = !e.target.value;
            });
        }

        // Initialize button
        const initializeBtn = document.getElementById('initializeBtn');
        console.log('Phantom popup - initializeBtn element:', initializeBtn);
        if (initializeBtn) {
            initializeBtn.addEventListener('click', () => {
                this.initializeSystem();
            });
        }

        // Main control buttons
        const analyzeBtn = document.getElementById('analyzeBtn');
        console.log('Phantom popup - analyzeBtn element:', analyzeBtn);
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                console.log('Phantom popup - analyzeBtn clicked');
                this.analyzePhantomInventory();
            });
        }

        const verificationBtn = document.getElementById('verificationBtn');
        console.log('Phantom popup - verificationBtn element:', verificationBtn);
        if (verificationBtn) {
            verificationBtn.addEventListener('click', () => {
                console.log('Phantom popup - verificationBtn clicked');
                this.generateVerificationList();
            });
        }



        // Event listeners removed - now using direct invoke calls for better error handling
    }

    async checkInitialState() {
        this.showStatus('Checking system status...', 'info');
        
        // Check if electronAPI is available
        if (!window.electronAPI) {
            this.showStatus('ERROR: window.electronAPI is not available. Preload script may not be loaded.', 'error');
            return;
        }
        
        this.showStatus('electronAPI is available, making IPC call...', 'info');
        
        try {
            // Check if system is already initialized
            const response = await window.electronAPI.invoke('phantom-get-status');
            console.log('Phantom popup - Status check response:', response);
            this.showStatus('Status response received: ' + JSON.stringify(response), 'info');
            
            if (response.success && response.data) {
                const status = response.data;
                console.log('Phantom popup - Status data:', status);
                this.showStatus('Status data: isSetup=' + status.isSetup + ', isInitialized=' + status.isInitialized + ', currentStore=' + (status.currentStore ? status.currentStore.displayName : 'None'), 'info');
                
                // If system is set up and initialized, show main controls
                if (status.isSetup && status.isInitialized && status.currentStore) {
                    console.log('Phantom popup - System is ready, showing main controls');
                    this.currentStore = status.currentStore.id;
                    this.isInitialized = true;
                    this.showMainControls();
                    
                    // Update network stats if available
                    if (status.systemStats && status.systemStats.networkStats) {
                        this.updateNetworkStats(status.systemStats.networkStats);
                    }
                    
                    // Update store selection
                    document.getElementById('storeSelect').value = status.currentStore.id;
                    document.getElementById('storeSelect').disabled = true;
                    
                    // Update setup section
                    const setupSection = document.getElementById('setupSection');
                    setupSection.innerHTML = `
                        <h2><span class="status-indicator status-ready"></span>System Ready</h2>
                        <p>Connected to store: <strong>${status.currentStore.displayName || 'Unknown'}</strong></p>
                        <p>System initialized and ready for phantom inventory detection.</p>
                    `;
                } else if (status.isSetup && status.currentStore) {
                    // System is set up but not initialized - show initialize button
                    console.log('Phantom popup - System is set up but not initialized, showing initialize button');
                    document.getElementById('storeSelect').value = status.currentStore.id;
                    document.getElementById('storeSelect').disabled = true;
                    
                    const setupSection = document.getElementById('setupSection');
                    setupSection.innerHTML = `
                        <h2><span class="status-indicator status-setup"></span>System Setup</h2>
                        <p>Store selected: <strong>${status.currentStore.displayName}</strong></p>
                        <p>Click Initialize System to start the phantom inventory detector.</p>
                        <div class="row">
                            <div class="col-md-6">
                                <label class="form-label">Store Location:</label>
                                <select id="storeSelect" class="form-select" disabled>
                                    <option value="${status.currentStore.id}">${status.currentStore.displayName}</option>
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">&nbsp;</label>
                                <button id="initializeBtn" class="btn btn-phantom-action">
                                    Initialize System
                                </button>
                            </div>
                        </div>
                    `;
                    
                    // Re-bind the initialize button event
                    document.getElementById('initializeBtn').addEventListener('click', () => {
                        this.initializeSystem();
                    });
                } else {
                    // System is not set up or has an unexpected state
                    console.log('Phantom popup - System is not set up or has unexpected state');
                    console.log('Phantom popup - isSetup:', status.isSetup, 'isInitialized:', status.isInitialized, 'currentStore:', status.currentStore);
                    
                    this.showStatus('System state: isSetup=' + status.isSetup + ', isInitialized=' + status.isInitialized + ', phantomDetectorReady=' + status.phantomDetectorReady, 'info');
                    
                    // Try to force initialization if we have a phantom detector ready
                    if (status.phantomDetectorReady && status.currentStore) {
                        console.log('Phantom popup - Phantom detector is ready, forcing initialization');
                        this.showStatus('Phantom detector is ready, forcing initialization...', 'info');
                        this.currentStore = status.currentStore.id;
                        this.isInitialized = true;
                        this.showMainControls();
                        
                        // Update store selection
                        document.getElementById('storeSelect').value = status.currentStore.id;
                        document.getElementById('storeSelect').disabled = true;
                        
                        // Update setup section
                        const setupSection = document.getElementById('setupSection');
                        setupSection.innerHTML = `
                            <h2><span class="status-indicator status-ready"></span>System Ready</h2>
                            <p>Connected to store: <strong>${status.currentStore.displayName || 'Unknown'}</strong></p>
                            <p>System initialized and ready for phantom inventory detection.</p>
                        `;
                    } else {
                        // Add a manual retry button for debugging
                        this.showStatus(`
                            <div class="alert alert-warning">
                                <h5>System Status Check</h5>
                                <p>System state unclear. Debug info:</p>
                                <ul>
                                    <li>isSetup: ${status.isSetup}</li>
                                    <li>isInitialized: ${status.isInitialized}</li>
                                    <li>currentStore: ${status.currentStore ? status.currentStore.displayName : 'None'}</li>
                                    <li>phantomDetectorReady: ${status.phantomDetectorReady}</li>
                                </ul>
                                <button onclick="window.location.reload()" class="btn btn-primary">Refresh Window</button>
                                <button onclick="phantomWindowInstance.checkInitialState()" class="btn btn-secondary">Retry Status Check</button>
                                <button onclick="phantomWindowInstance.forceShowMainControls()" class="btn btn-warning">Force Show Controls</button>
                            </div>
                        `, 'warning');
                    }
                }
            } else {
                console.log('Phantom popup - No response data received');
            }
        } catch (error) {
            console.error('Error checking initial state:', error);
            this.showStatus('ERROR checking initial state: ' + error.message, 'error');
        }
        
        // If system is not initialized, retry after a short delay
        if (!this.isInitialized && this.statusCheckRetries < this.maxStatusCheckRetries) {
            this.statusCheckRetries++;
            console.log(`Phantom popup - System not initialized, retrying in 2 seconds... (${this.statusCheckRetries}/${this.maxStatusCheckRetries})`);
            setTimeout(() => {
                this.checkInitialState();
            }, 2000);
        } else if (!this.isInitialized) {
            console.log('Phantom popup - Max retries reached, system still not initialized');
            this.showStatus('System initialization failed. Please try refreshing the window or check the main application.', 'error');
        }
    }

    async initializeSystem() {
        const storeId = document.getElementById('storeSelect').value;
        if (!storeId) return;

        this.showStatus('Initializing system...', 'info');
        this.setButtonState('initializeBtn', true);

        try {
            const result = await window.electronAPI.invoke('phantom-complete-setup', storeId);
            if (result.success) {
                this.handleSetupComplete(result);
            } else {
                this.handleError(result.error);
            }
        } catch (error) {
            this.handleError(error);
            this.setButtonState('initializeBtn', false);
        }
    }

    handleSetupComplete(data) {
        if (data.success) {
            this.currentStore = data.store ? data.store.id : 'Unknown';
            this.isInitialized = true;
            this.showMainControls();
            this.showStatus(`System initialized for store: ${data.store ? data.store.displayName : 'Unknown'}`, 'success');
            
            // Update network stats if available
            if (data.systemStats && data.systemStats.networkStats) {
                this.updateNetworkStats(data.systemStats.networkStats);
            }
            
            // Update setup section
            const setupSection = document.getElementById('setupSection');
            setupSection.innerHTML = `
                <h2><span class="status-indicator status-ready"></span>System Ready</h2>
                <p>Connected to store: <strong>${data.store ? data.store.displayName : 'Unknown'}</strong></p>
                <p>System initialized and ready for phantom inventory detection.</p>
            `;
        } else {
            this.handleError(data.error);
            this.setButtonState('initializeBtn', false);
        }
    }

    async analyzePhantomInventory() {
        console.log('Phantom popup - analyzePhantomInventory called, isInitialized:', this.isInitialized);
        if (!this.isInitialized) {
            console.log('Phantom popup - System not initialized, returning early');
            return;
        }

        console.log('Phantom popup - Starting analysis...');
        this.showStatus('Getting inventory data...', 'info');
        this.setAllButtonsState(true);

        try {
            // Get inventory data from main window
            console.log('Phantom popup - Getting inventory data...');
            const inventoryResponse = await window.electronAPI.invoke('get-inventory-data');
            console.log('Phantom popup - Inventory response:', inventoryResponse);
            if (!inventoryResponse.success) {
                throw new Error(inventoryResponse.error);
            }

            const inventoryData = inventoryResponse.data;

            // Step 1: Analyze phantom inventory
            this.showStatus('Analyzing phantom inventory...', 'info');
            const phantomResult = await window.electronAPI.invoke('phantom-analyze', inventoryData);
            
            if (!phantomResult.success) {
                throw new Error('Phantom analysis failed: ' + phantomResult.error);
            }

            // Display results
            const combinedResults = {
                success: true,
                data: {
                    phantomInventory: phantomResult.data,
                    totalItems: inventoryData.length
                }
            };

            this.handleCombinedAnalysisComplete(combinedResults);
            
        } catch (error) {
            this.handleError(error);
            this.setAllButtonsState(false);
        }
    }

    handleAnalysisComplete(data) {
        this.setAllButtonsState(false);
        
        if (data.success) {
            const results = data.results;
            let statusHtml = `
                <div class="alert alert-success">
                    <h4>Analysis Complete</h4>
                    <p><strong>Total Items Analyzed:</strong> ${results.totalAnalyzed}</p>
                    <p><strong>Phantom Inventory Detected:</strong> ${results.phantomCount}</p>
                    <p><strong>High Risk Items:</strong> ${results.highRiskCount}</p>
                    <p><strong>Average Risk Score:</strong> ${results.averageRiskScore.toFixed(2)}</p>
                </div>
            `;

            if (results.topRisks && results.topRisks.length > 0) {
                statusHtml += `
                    <div class="mt-3">
                        <h5>Top Risk Items:</h5>
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Part Number</th>
                                        <th>Description</th>
                                        <th>Risk Score</th>
                                        <th>Primary Risk</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${results.topRisks.map(item => `
                                        <tr>
                                            <td>${item.partNumber}</td>
                                            <td>${item.description || 'N/A'}</td>
                                            <td><span class="badge bg-danger">${item.riskScore.toFixed(2)}</span></td>
                                            <td>${item.primaryRisk}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            }

            this.showStatus(statusHtml, 'success');
            this.updateNetworkStats(data.networkStats);
        } else {
            this.handleError(data.error);
        }
    }

    async generateVerificationList() {
        if (!this.isInitialized) return;
        
        if (!this.lastAnalysisResults) {
            this.showStatus('No analysis results available. Please run analysis first.', 'warning');
            return;
        }

        this.showStatus('Generating verification lists...', 'info');

        try {
            // Get inventory data from main window
            const inventoryResponse = await window.electronAPI.invoke('get-inventory-data');
            if (!inventoryResponse.success) {
                throw new Error(inventoryResponse.error);
            }

            const inventoryData = inventoryResponse.data;
            
            // Call the verification generation IPC handler
            this.showStatus('Creating Excel verification sheets...', 'info');
            const result = await window.electronAPI.invoke('phantom-generate-verification', inventoryData);
            
            if (result.success) {
                const message = `
                    Verification Lists Generated Successfully!
                    
                    Total Candidates: ${result.totalCandidates}
                    Daily Verification Items: ${result.dailyList}
                    Location Groups: ${result.locationGroups}
                    Estimated Time: ${result.estimatedTime} minutes
                    High Priority Items: ${result.highPriorityItems}
                    
                    Excel file saved to: ${result.filename || 'Desktop or project folder'}
                `;
                
                this.showStatus(message, 'success');
            } else {
                throw new Error(result.error || 'Failed to generate verification lists');
            }
            
        } catch (error) {
            console.error('Error generating verification lists:', error);
            this.showStatus('Error generating verification lists: ' + error.message, 'error');
        }
    }
    
    getSelectedItems() {
        const selectedItems = [];
        
        // Get selected phantom inventory items
        const phantomCheckboxes = document.querySelectorAll('#phantom-tab .item-checkbox:checked');
        phantomCheckboxes.forEach(checkbox => {
            const row = checkbox.closest('tr');
            const item = this.extractItemFromRow(row, 'phantom');
            if (item) {
                selectedItems.push(item);
            }
        });
        
        // If no items are selected, use all high-priority phantom items
        if (selectedItems.length === 0) {
            const allPhantomItems = this.lastAnalysisResults.phantomInventory.phantomCandidates || [];
            
            // Add high-priority phantom items
            allPhantomItems.forEach(item => {
                if ((item.riskScore || 0) > 70) {
                    selectedItems.push({
                        ...item,
                        type: 'phantom',
                        priority: 'high'
                    });
                }
            });
        }
        
        return selectedItems;
    }
    
    extractItemFromRow(row, type) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 5) return null;
        
        const item = {
            type: type,
            partNumber: cells[1].textContent.trim(),
            description: cells[2].textContent.trim(),
            currentStock: parseInt(cells[3].textContent.trim()) || 0,
            riskScore: parseFloat(cells[4].textContent.trim()) || 0,
            priority: this.getPriorityFromScore(parseFloat(cells[4].textContent.trim()) || 0)
        };
        
        return item;
    }
    
    getPriorityFromScore(score) {
        if (score > 70) return 'high';
        if (score > 40) return 'medium';
        return 'low';
    }
    
    createVerificationLists(selectedItems) {
        // Group items by priority and type
        const groupedItems = {
            high: { phantom: [] },
            medium: { phantom: [] },
            low: { phantom: [] }
        };
        
        selectedItems.forEach(item => {
            const priority = item.priority || this.getPriorityFromScore(item.riskScore || 0);
            const type = item.type || 'phantom';
            
            if (groupedItems[priority] && groupedItems[priority][type]) {
                groupedItems[priority][type].push(item);
            }
        });
        
        const verificationLists = [];
        
        // Create high priority verification list
        if (groupedItems.high.phantom.length > 0) {
            verificationLists.push({
                name: 'High Priority Verification',
                priority: 'high',
                description: 'Urgent items requiring immediate verification',
                items: [...groupedItems.high.phantom],
                color: '#dc3545'
            });
        }
        
        // Create medium priority verification list
        if (groupedItems.medium.phantom.length > 0) {
            verificationLists.push({
                name: 'Medium Priority Verification',
                priority: 'medium',
                description: 'Items requiring verification within 3-5 days',
                items: [...groupedItems.medium.phantom],
                color: '#ffc107'
            });
        }
        
        // Create low priority verification list
        if (groupedItems.low.phantom.length > 0) {
            verificationLists.push({
                name: 'Low Priority Verification',
                priority: 'low',
                description: 'Items for routine verification',
                items: [...groupedItems.low.phantom],
                color: '#28a745'
            });
        }
        
        // Create location-based lists if we have location data
        const locationLists = this.createLocationBasedLists(selectedItems);
        verificationLists.push(...locationLists);
        
        return verificationLists;
    }
    
    createLocationBasedLists(selectedItems) {
        // Group items by location (simulated - in real implementation this would come from inventory data)
        const locationGroups = {};
        
        selectedItems.forEach(item => {
            // Simulate location assignment based on part number prefix or category
            const location = this.getLocationFromPartNumber(item.partNumber);
            
            if (!locationGroups[location]) {
                locationGroups[location] = [];
            }
            locationGroups[location].push(item);
        });
        
        const locationLists = [];
        
        Object.keys(locationGroups).forEach(location => {
            if (locationGroups[location].length > 0) {
                locationLists.push({
                    name: `${location} Verification List`,
                    priority: 'location',
                    description: `Items to verify in ${location} section`,
                    items: locationGroups[location],
                    color: '#17a2b8',
                    location: location
                });
            }
        });
        
        return locationLists;
    }
    
    getLocationFromPartNumber(partNumber) {
        // Simple location assignment logic (in real implementation this would be more sophisticated)
        const prefix = partNumber.substring(0, 2).toUpperCase();
        
        const locationMap = {
            'HA': 'Hardware',
            'PL': 'Plumbing',
            'EL': 'Electrical',
            'GA': 'Garden',
            'TO': 'Tools',
            'PA': 'Paint',
            'LU': 'Lumber',
            'AU': 'Automotive'
        };
        
        return locationMap[prefix] || 'General';
    }
    
    displayVerificationLists(verificationLists) {
        const statusContent = document.getElementById('statusContent');
        
        let html = `
            <div class="verification-lists-container">
                <div class="verification-header">
                    <h3>Generated Verification Lists</h3>
                    <p>Lists have been generated and are ready for download or printing.</p>
                </div>
                
                <div class="verification-lists">
        `;
        
        verificationLists.forEach((list, index) => {
            html += `
                <div class="verification-list-card" style="border-left: 4px solid ${list.color}">
                    <div class="list-header">
                        <h4>${list.name}</h4>
                        <span class="item-count">${list.items.length} items</span>
                    </div>
                    <p class="list-description">${list.description}</p>
                    
                    <div class="list-preview">
                        <table class="verification-preview-table">
                            <thead>
                                <tr>
                                    <th>Part Number</th>
                                    <th>Description</th>
                                    <th>Current Stock</th>
                                    <th>Risk Score</th>
                                    <th>Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.items.slice(0, 5).map(item => `
                                    <tr>
                                        <td>${item.partNumber}</td>
                                        <td>${item.description}</td>
                                        <td>${item.currentStock}</td>
                                        <td>${item.riskScore}</td>
                                        <td><span class="type-badge ${item.type}">${item.type === 'phantom' ? 'Phantom' : 'Stock-Out'}</span></td>
                                    </tr>
                                `).join('')}
                                ${list.items.length > 5 ? `<tr><td colspan="5" class="more-items">...and ${list.items.length - 5} more items</td></tr>` : ''}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="list-actions">
                        <button class="btn btn-primary" onclick="phantomWindow.downloadVerificationList(${index})">
                            Download List
                        </button>
                        <button class="btn btn-secondary" onclick="phantomWindow.printVerificationList(${index})">
                            Print List
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
                
                <div class="verification-actions">
                    <button class="btn btn-success" onclick="phantomWindow.downloadAllVerificationLists()">
                        Download All Lists
                    </button>
                    <button class="btn btn-info" onclick="phantomWindow.generateVerificationReport()">
                        Generate Verification Report
                    </button>
                    <button class="btn btn-warning" onclick="phantomWindow.backToResults()">
                        Back to Results
                    </button>
                </div>
            </div>
        `;
        
        statusContent.innerHTML = html;
        
        // Store verification lists for download
        this.verificationLists = verificationLists;
    }
    
    generateVerificationFiles(verificationLists) {
        verificationLists.forEach((list, index) => {
            const csvContent = this.generateCSV(list);
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            
            // Store the download URLs for later use
            list.downloadUrl = url;
            list.filename = `${list.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        });
    }
    
    generateCSV(list) {
        const headers = ['Part Number', 'Description', 'Current Stock', 'Risk Score', 'Type', 'Priority'];
        
        if (list.items.some(item => item.predictedDays)) {
            headers.push('Predicted Days');
        }
        
        if (list.location) {
            headers.push('Location');
        }
        
        let csv = headers.join(',') + '\n';
        
        list.items.forEach(item => {
            const row = [
                `"${item.partNumber || ''}"`,
                `"${item.description || ''}"`,
                item.currentStock || 0,
                item.riskScore || 0,
                item.type || 'phantom',
                item.priority || 'medium'
            ];
            
            if (list.items.some(i => i.predictedDays)) {
                row.push(item.predictedDays || '');
            }
            
            if (list.location) {
                row.push(`"${list.location}"`);
            }
            
            csv += row.join(',') + '\n';
        });
        
        return csv;
    }
    
    // Helper methods for verification list actions
    downloadVerificationList(index) {
        if (this.verificationLists && this.verificationLists[index]) {
            const list = this.verificationLists[index];
            const a = document.createElement('a');
            a.href = list.downloadUrl;
            a.download = list.filename;
            a.click();
            
            this.showStatus(`Downloaded: ${list.filename}`, 'success');
        }
    }
    
    printVerificationList(index) {
        if (this.verificationLists && this.verificationLists[index]) {
            const list = this.verificationLists[index];
            const printWindow = window.open('', '_blank');
            
            printWindow.document.write(`
                <html>
                    <head>
                        <title>${list.name}</title>
                        <style>
                            body { font-family: Arial, sans-serif; margin: 20px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                            th { background-color: #f8f9fa; }
                            .header { border-bottom: 2px solid #333; margin-bottom: 20px; }
                            .type-badge { padding: 2px 6px; border-radius: 3px; font-size: 0.8em; }
                            .phantom { background: #667eea; color: white; }
            
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1>${list.name}</h1>
                            <p>${list.description}</p>
                            <p>Generated: ${new Date().toLocaleString()}</p>
                            <p>Items: ${list.items.length}</p>
                        </div>
                        
                        <table>
                            <thead>
                                <tr>
                                    <th>Part Number</th>
                                    <th>Description</th>
                                    <th>Current Stock</th>
                                    <th>Risk Score</th>
                                    <th>Type</th>
                                    <th>Priority</th>
                                    <th>Verified</th>
                                    <th>Actual Count</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.items.map(item => `
                                    <tr>
                                        <td>${item.partNumber}</td>
                                        <td>${item.description}</td>
                                        <td>${item.currentStock}</td>
                                        <td>${item.riskScore}</td>
                                        <td><span class="type-badge ${item.type}">${item.type === 'phantom' ? 'Phantom' : 'Stock-Out'}</span></td>
                                        <td>${item.priority}</td>
                                        <td style="width: 60px;">☐</td>
                                        <td style="width: 80px; border-bottom: 1px solid #333;"></td>
                                        <td style="width: 150px; border-bottom: 1px solid #333;"></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </body>
                </html>
            `);
            
            printWindow.document.close();
            printWindow.print();
            
            this.showStatus(`Print dialog opened for: ${list.name}`, 'info');
        }
    }
    
    downloadAllVerificationLists() {
        if (this.verificationLists) {
            this.verificationLists.forEach((list, index) => {
                setTimeout(() => {
                    this.downloadVerificationList(index);
                }, index * 500); // Stagger downloads
            });
        }
    }
    
    generateVerificationReport() {
        if (!this.verificationLists) return;
        
        const report = {
            generatedDate: new Date().toISOString(),
            totalLists: this.verificationLists.length,
            totalItems: this.verificationLists.reduce((sum, list) => sum + list.items.length, 0),
            lists: this.verificationLists.map(list => ({
                name: list.name,
                priority: list.priority,
                itemCount: list.items.length,
                items: list.items
            })),
            summary: {
                highPriorityItems: this.verificationLists.filter(l => l.priority === 'high').reduce((sum, list) => sum + list.items.length, 0),
                mediumPriorityItems: this.verificationLists.filter(l => l.priority === 'medium').reduce((sum, list) => sum + list.items.length, 0),
                lowPriorityItems: this.verificationLists.filter(l => l.priority === 'low').reduce((sum, list) => sum + list.items.length, 0)
            }
        };
        
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `verification-report-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showStatus('Verification report generated and downloaded.', 'success');
    }
    
    backToResults() {
        if (this.lastAnalysisResults) {
                        this.createPhantomResultsInterface(
                this.lastAnalysisResults.phantomInventory,
                this.lastAnalysisResults.totalItems
            );
        }
    }

    handleVerificationComplete(data) {
        this.setAllButtonsState(false);
        
        if (data.success) {
            const statusHtml = `
                <div class="alert alert-success">
                    <h4>Verification List Generated</h4>
                    <p><strong>Items for Verification:</strong> ${data.verificationCount}</p>
                    <p><strong>High Priority Items:</strong> ${data.highPriorityCount}</p>
                    <p><strong>Excel File:</strong> <a href="#" onclick="window.electronAPI.openFile('${data.excelFile}')">${data.excelFile}</a></p>
                </div>
                <div class="mt-3">
                    <h5>Verification Instructions:</h5>
                    <ol>
                        <li>Print the Excel verification sheet</li>
                        <li>Visit each location listed in priority order</li>
                        <li>Count actual physical inventory</li>
                        <li>Record findings in the verification sheet</li>
                        <li>Return to system to input verification results</li>
                    </ol>
                </div>
            `;
            
            this.showStatus(statusHtml, 'success');
        } else {
            this.handleError(data.error);
        }
    }



    async showSystemStats() {
        if (!this.isInitialized) return;

        this.showStatus('Loading system statistics...', 'info');
        this.setAllButtonsState(true);

        try {
            await window.electronAPI.invoke('phantom-get-stats');
        } catch (error) {
            this.handleError(error);
            this.setAllButtonsState(false);
        }
    }

    handleStatsComplete(data) {
        this.setAllButtonsState(false);
        
        if (data.success) {
            const stats = data.stats;
            let statusHtml = `
                <div class="alert alert-info">
                    <h4>System Statistics</h4>
                    <div class="row">
                        <div class="col-md-6">
                            <p><strong>Total Verifications:</strong> ${stats.totalVerifications}</p>
                            <p><strong>Accuracy Rate:</strong> ${(stats.accuracy * 100).toFixed(1)}%</p>
                            <p><strong>Categories Learned:</strong> ${stats.categories.length}</p>
                        </div>
                        <div class="col-md-6">
                            <p><strong>Network Stores:</strong> ${stats.networkStats.totalStores}</p>
                            <p><strong>Network Accuracy:</strong> ${(stats.networkStats.averageAccuracy * 100).toFixed(1)}%</p>
                            <p><strong>Last Sync:</strong> ${stats.networkStats.lastSync || 'Never'}</p>
                        </div>
                    </div>
                </div>
            `;

            if (stats.recommendations && stats.recommendations.length > 0) {
                statusHtml += `
                    <div class="mt-3">
                        <h5>Network Recommendations:</h5>
                        <ul class="list-group">
                            ${stats.recommendations.map(rec => `
                                <li class="list-group-item">
                                    <span class="badge bg-${rec.priority === 'high' ? 'danger' : 'warning'}">${rec.priority}</span>
                                    ${rec.message}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `;
            }

            this.showStatus(statusHtml, 'info');
            this.updateNetworkStats(stats.networkStats);
        } else {
            this.handleError(data.error);
        }
    }

    async syncNetworkData() {
        if (!this.isInitialized) return;

        this.showStatus('Synchronizing with network...', 'info');
        this.setAllButtonsState(true);

        try {
            await window.electronAPI.invoke('phantom-sync-network');
        } catch (error) {
            this.handleError(error);
            this.setAllButtonsState(false);
        }
    }

    handleSyncComplete(data) {
        this.setAllButtonsState(false);
        
        if (data.success) {
            const statusHtml = `
                <div class="alert alert-success">
                    <h4>Network Sync Complete</h4>
                    <p><strong>Stores Synchronized:</strong> ${data.syncedStores}</p>
                    <p><strong>Network Verifications:</strong> ${data.consolidatedVerifications}</p>
                    <p><strong>Improved Accuracy:</strong> ${(data.improvedAccuracy * 100).toFixed(1)}%</p>
                </div>
            `;
            
            this.showStatus(statusHtml, 'success');
            this.updateNetworkStats(data.networkStats);
        } else {
            this.handleError(data.error);
        }
    }

    async exportReports() {
        if (!this.isInitialized) return;

        this.showStatus('Exporting reports...', 'info');
        this.setAllButtonsState(true);

        try {
            await window.electronAPI.invoke('phantom-export-reports');
        } catch (error) {
            this.handleError(error);
            this.setAllButtonsState(false);
        }
    }

    handleExportComplete(data) {
        this.setAllButtonsState(false);
        
        if (data.success) {
            const statusHtml = `
                <div class="alert alert-success">
                    <h4>Reports Exported</h4>
                    <p><strong>Export File:</strong> <a href="#" onclick="window.electronAPI.openFile('${data.exportFile}')">${data.exportFile}</a></p>
                    <p>Network data and statistics have been exported for analysis and backup.</p>
                </div>
            `;
            
            this.showStatus(statusHtml, 'success');
        } else {
            this.handleError(data.error);
        }
    }

    showMainControls() {
        console.log('Phantom popup - showMainControls called');
        const mainControls = document.getElementById('mainControls');
        const networkStats = document.getElementById('networkStats');
        
        console.log('Phantom popup - mainControls element:', mainControls);
        console.log('Phantom popup - networkStats element:', networkStats);
        
        if (mainControls) {
            mainControls.style.display = 'grid';
            console.log('Phantom popup - mainControls displayed');
            this.showStatus('Main controls are now visible. You can proceed with phantom inventory analysis.', 'success');
        } else {
            console.log('Phantom popup - mainControls element not found!');
            this.showStatus('ERROR: Main controls element not found in DOM', 'error');
        }
        
        if (networkStats) {
            networkStats.style.display = 'grid';
            console.log('Phantom popup - networkStats displayed');
        } else {
            console.log('Phantom popup - networkStats element not found!');
        }
    }
    
    forceShowMainControls() {
        console.log('Phantom popup - forceShowMainControls called');
        this.showStatus('Forcing main controls to show...', 'info');
        this.currentStore = '18181'; // Set the store ID based on the logs
        this.isInitialized = true;
        this.showMainControls();
        
        // Update setup section
        const setupSection = document.getElementById('setupSection');
        if (setupSection) {
            setupSection.innerHTML = `
                <h2><span class="status-indicator status-ready"></span>System Ready (Forced)</h2>
                <p>Connected to store: <strong>18181 - State</strong></p>
                <p>System manually initialized and ready for phantom inventory detection.</p>
            `;
        }
    }

    showStatus(message, type = 'info') {
        const statusContent = document.getElementById('statusContent');
        const alertClass = type === 'success' ? 'alert-success' : 
                          type === 'error' ? 'alert-danger' : 
                          type === 'warning' ? 'alert-warning' : 'alert-info';
        
        if (statusContent) {
            statusContent.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;
        } else {
            console.error('statusContent element not found, message was:', message);
            // Try to find any content area and add the message
            const body = document.body;
            if (body) {
                const alertDiv = document.createElement('div');
                alertDiv.className = `alert ${alertClass}`;
                alertDiv.innerHTML = message;
                body.appendChild(alertDiv);
            }
        }
    }

    updateNetworkStats(stats) {
        if (!stats) return;

        document.getElementById('totalStores').textContent = stats.activeStores || 0;
        document.getElementById('totalVerifications').textContent = stats.totalVerifications || 0;
        document.getElementById('networkAccuracy').textContent = `${((stats.averageAccuracy || 0) * 100).toFixed(1)}%`;
        
        const lastSync = stats.lastSync ? new Date(stats.lastSync).toLocaleDateString() : 'Never';
        document.getElementById('lastSync').textContent = lastSync;
    }

    setButtonState(buttonId, disabled) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = disabled;
        }
    }

    setAllButtonsState(disabled) {
        const buttons = ['analyzeBtn', 'verificationBtn'];
        buttons.forEach(id => this.setButtonState(id, disabled));
    }

    handleError(error) {
        console.error('Phantom Inventory Error:', error);
        this.showStatus(`Error: ${error.message || error}`, 'error');
        this.setAllButtonsState(false);
    }

    handleCombinedAnalysisComplete(data) {
        this.setAllButtonsState(false);
        
        if (data.success) {
            const phantomData = data.data.phantomInventory;
            
            // Create phantom inventory results interface
            this.createPhantomResultsInterface(phantomData, data.data.totalItems);
            
            // Store results for verification list generation
            this.lastAnalysisResults = data.data;
            
        } else {
            this.handleError(data.error);
        }
    }

    createPhantomResultsInterface(phantomData, totalItems) {
        const statusContent = document.getElementById('statusContent');
        
        statusContent.innerHTML = `
            <div class="results-interface">
                <div class="results-header">
                    <h3>Phantom Inventory Analysis Results</h3>
                    <div class="results-summary">
                        <span class="summary-item">Total Items: <strong>${totalItems}</strong></span>
                        <span class="summary-item">Phantom Candidates: <strong>${phantomData.phantomCandidates?.length || 0}</strong></span>
                    </div>
                </div>
                
                <div class="results-content">
                    <div class="tab-content active" id="phantom-tab">
                        <div class="results-controls">
                            <button class="btn btn-primary" id="selectAllPhantom">Select All</button>
                            <button class="btn btn-secondary" id="deselectAllPhantom">Deselect All</button>
                            <button class="btn btn-warning" id="editSelectedPhantom">Edit Selected</button>
                            <button class="btn btn-danger" id="removeSelectedPhantom">Remove Selected</button>
                        </div>
                        <div class="editable-table-container">
                            ${this.createEditablePhantomTable(phantomData.phantomCandidates || [])}
                        </div>
                    </div>
                </div>
                
                <div class="results-actions">
                    <button class="btn btn-success" id="generateVerificationListBtn">Generate Verification Lists</button>
                    <button class="btn btn-info" id="exportResultsBtn">Export Results</button>
                    <button class="btn btn-primary" id="saveChangesBtn">Save Changes</button>
                </div>
            </div>
        `;
        
        this.initializeResultsInterface();
    }
    
    createEditablePhantomTable(phantomCandidates) {
        if (!phantomCandidates || phantomCandidates.length === 0) {
            return '<p class="text-muted">No phantom inventory candidates found.</p>';
        }
        
        return `
            <table class="editable-results-table">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="selectAllPhantomCheckbox"></th>
                        <th>Part Number</th>
                        <th>Description</th>
                        <th>Current Stock</th>
                        <th>Risk Score</th>
                        <th>Priority</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${phantomCandidates.map((item, index) => `
                        <tr data-id="${index}" data-type="phantom">
                            <td><input type="checkbox" class="item-checkbox"></td>
                            <td class="editable" data-field="partNumber">${item.partNumber || ''}</td>
                            <td class="editable" data-field="description">${item.description || ''}</td>
                            <td class="editable" data-field="currentStock">${item.currentStock || 0}</td>
                            <td class="editable" data-field="riskScore">${item.riskScore || 0}</td>
                            <td>
                                <select class="priority-select" data-field="priority">
                                    <option value="high" ${(item.riskScore || 0) > 70 ? 'selected' : ''}>High</option>
                                    <option value="medium" ${(item.riskScore || 0) > 40 && (item.riskScore || 0) <= 70 ? 'selected' : ''}>Medium</option>
                                    <option value="low" ${(item.riskScore || 0) <= 40 ? 'selected' : ''}>Low</option>
                                </select>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-info edit-item">Edit</button>
                                <button class="btn btn-sm btn-danger remove-item">Remove</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    

    

    
    initializeResultsInterface() {
        // Tab switching
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.dataset.tab;
                
                // Update active button
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Update active content
                tabContents.forEach(content => content.classList.remove('active'));
                document.getElementById(`${tabName}-tab`).classList.add('active');
            });
        });
        
        // Checkbox functionality
        this.initializeCheckboxes();
        
        // Editable cells
        this.initializeEditableCells();
        
        // Action buttons
        this.initializeActionButtons();
    }
    
    initializeCheckboxes() {
        // Select all functionality
        const selectAllPhantom = document.getElementById('selectAllPhantomCheckbox');
        
        if (selectAllPhantom) {
            selectAllPhantom.addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll('#phantom-tab .item-checkbox');
                checkboxes.forEach(cb => cb.checked = e.target.checked);
            });
        }
    }
    
    initializeEditableCells() {
        const editableCells = document.querySelectorAll('.editable');
        
        editableCells.forEach(cell => {
            cell.addEventListener('click', () => {
                this.makeEditable(cell);
            });
        });
    }
    
    makeEditable(cell) {
        const currentValue = cell.textContent;
        const field = cell.dataset.field;
        
        cell.innerHTML = `<input type="text" class="cell-input" value="${currentValue}">`;
        
        const input = cell.querySelector('.cell-input');
        input.focus();
        input.select();
        
        const saveChanges = () => {
            const newValue = input.value;
            cell.textContent = newValue;
            cell.dataset.modified = 'true';
            
            // Update the stored results
            this.updateStoredResults(cell, newValue);
        };
        
        input.addEventListener('blur', saveChanges);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveChanges();
            }
        });
    }
    
    updateStoredResults(cell, newValue) {
        const row = cell.closest('tr');
        const itemId = row.dataset.id;
        const itemType = row.dataset.type;
        const field = cell.dataset.field;
        
        if (this.lastAnalysisResults) {
            if (itemType === 'phantom' && this.lastAnalysisResults.phantomInventory.phantomCandidates[itemId]) {
                this.lastAnalysisResults.phantomInventory.phantomCandidates[itemId][field] = newValue;
            
            }
        }
    }
    
    initializeActionButtons() {
        // Generate verification list
        const generateBtn = document.getElementById('generateVerificationListBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.generateVerificationList();
            });
        }
        
        // Export results
        const exportBtn = document.getElementById('exportResultsBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportResults();
            });
        }
        
        // Save changes
        const saveBtn = document.getElementById('saveChangesBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveChanges();
            });
        }
        
        // Selection controls
        this.initializeSelectionControls();
        
        // Item action buttons
        this.initializeItemActions();
    }
    
    initializeSelectionControls() {
        // Select all buttons
        const selectAllPhantom = document.getElementById('selectAllPhantom');
        const deselectAllPhantom = document.getElementById('deselectAllPhantom');

        
        if (selectAllPhantom) {
            selectAllPhantom.addEventListener('click', () => {
                document.querySelectorAll('#phantom-tab .item-checkbox').forEach(cb => cb.checked = true);
            });
        }
        
        if (deselectAllPhantom) {
            deselectAllPhantom.addEventListener('click', () => {
                document.querySelectorAll('#phantom-tab .item-checkbox').forEach(cb => cb.checked = false);
            });
        }
        

    }
    
    initializeItemActions() {
        // Edit buttons
        document.querySelectorAll('.edit-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                this.editItem(row);
            });
        });
        
        // Remove buttons
        document.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                this.removeItem(row);
            });
        });
    }
    
    editItem(row) {
        const cells = row.querySelectorAll('.editable');
        cells.forEach(cell => {
            cell.style.backgroundColor = '#fff3cd';
            cell.style.cursor = 'pointer';
        });
        
        this.showStatus('Click on any cell to edit. Press Enter to save changes.', 'info');
    }
    
    removeItem(row) {
        if (confirm('Are you sure you want to remove this item?')) {
            row.remove();
            this.showStatus('Item removed successfully.', 'success');
        }
    }
    
    saveChanges() {
        const modifiedCells = document.querySelectorAll('[data-modified="true"]');
        
        if (modifiedCells.length > 0) {
            this.showStatus(`Saved ${modifiedCells.length} changes successfully.`, 'success');
            
            // Remove modification flags
            modifiedCells.forEach(cell => {
                cell.removeAttribute('data-modified');
                cell.style.backgroundColor = '';
            });
        } else {
            this.showStatus('No changes to save.', 'info');
        }
    }
    
    exportResults() {
        // Create exportable data
        const exportData = {
            phantomInventory: this.lastAnalysisResults.phantomInventory,
            exportDate: new Date().toISOString()
        };
        
        // Create download link
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `phantom-analysis-results-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showStatus('Results exported successfully.', 'success');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Phantom popup - DOM loaded, creating PhantomInventoryWindow...');
    
    // Add a visual indicator that the JavaScript is loading
    const statusContent = document.getElementById('statusContent');
    if (statusContent) {
        statusContent.innerHTML = '<div class="alert alert-info">JavaScript loaded, initializing phantom inventory window...</div>';
    }
    
    // Create instance and store globally for debugging
    window.phantomWindowInstance = new PhantomInventoryWindow();
});

// File opening capability is now handled by the main electronAPI from preload.js 