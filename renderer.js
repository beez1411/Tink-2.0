// renderer.js - Frontend logic for the Electron app

let selectedFile = null;

// DOM elements - Updated to match actual HTML structure
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const runSuggestedOrderBtn = document.getElementById('runSuggestedOrderBtn');
const runCheckAceNetBtn = document.getElementById('runCheckAceNetBtn');
const daysThreshold = document.getElementById('daysThreshold');
const acenetOptions = document.getElementById('acenetOptions');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const storeNumberInput = document.getElementById('storeNumber');

// Global storage for suggested order results
let suggestedOrderResults = {
    orderData: [],
    partNumbers: [],
    hasResults: false
};

// Ensure input fields work properly
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing input fields...');
    
    // Force enable input fields
    const inputFields = document.querySelectorAll('#acenetOptions input, #acenetOptions select');
    inputFields.forEach(field => {
        field.style.pointerEvents = 'auto';
        field.style.userSelect = 'text';
        field.disabled = false;
        field.readOnly = false;
        
        // Remove any potential tabindex issues
        if (field.tabIndex < 0) {
            field.tabIndex = 0;
        }
    });
    
    // Specifically handle username and password fields
    if (usernameInput) {
        usernameInput.style.pointerEvents = 'auto';
        usernameInput.style.userSelect = 'text';
        usernameInput.disabled = false;
        usernameInput.readOnly = false;
        usernameInput.tabIndex = 1;
    }
    
    if (passwordInput) {
        passwordInput.style.pointerEvents = 'auto';
        passwordInput.style.userSelect = 'text';
        passwordInput.disabled = false;
        passwordInput.readOnly = false;
        passwordInput.tabIndex = 2;
    }
    
    if (storeNumberInput) {
        storeNumberInput.style.pointerEvents = 'auto';
        storeNumberInput.disabled = false;
        storeNumberInput.tabIndex = 3;
    }
    
    console.log('Input fields initialization complete');
    
    // Modal event handlers
    const closeModalBtn = document.getElementById('closeModalBtn');
    const toggleDebugBtn = document.getElementById('toggleDebugBtn');
    const debugSection = document.getElementById('debugSection');
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            const robotAnimationContainer = document.getElementById('robotAnimationContainer');
            if (robotAnimationContainer) {
                robotAnimationContainer.style.display = 'none';
                
                // Reset modal state for next time
                const processingState = document.getElementById('processingState');
                const completionState = document.getElementById('completionState');
                if (processingState && completionState) {
                    processingState.style.display = 'block';
                    completionState.style.display = 'none';
                }
                
                // Reset debug section
                if (debugSection) {
                    debugSection.style.display = 'none';
                }
                if (toggleDebugBtn) {
                    toggleDebugBtn.textContent = 'Show Details';
                }
            }
        });
    }
    
    if (toggleDebugBtn && debugSection) {
        toggleDebugBtn.addEventListener('click', () => {
            if (debugSection.style.display === 'none') {
                debugSection.style.display = 'block';
                toggleDebugBtn.textContent = 'Hide Details';
            } else {
                debugSection.style.display = 'none';
                toggleDebugBtn.textContent = 'Show Details';
            }
        });
    }
    
    // Close modal when clicking outside
    const robotAnimationContainer = document.getElementById('robotAnimationContainer');
    if (robotAnimationContainer) {
        robotAnimationContainer.addEventListener('click', (e) => {
            if (e.target === robotAnimationContainer) {
                if (closeModalBtn) closeModalBtn.click();
            }
        });
    }
});

// Backup initialization function that can be called from main process
window.initializeInputFields = function() {
    console.log('Forcing input field initialization...');
    
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');
    const storeField = document.getElementById('storeNumber');
    
    if (usernameField) {
        usernameField.style.pointerEvents = 'auto';
        usernameField.style.userSelect = 'text';
        usernameField.style.webkitUserSelect = 'text';
        usernameField.disabled = false;
        usernameField.readOnly = false;
        usernameField.tabIndex = 1;
        usernameField.style.opacity = '1';
        usernameField.style.visibility = 'visible';
    }
    
    if (passwordField) {
        passwordField.style.pointerEvents = 'auto';
        passwordField.style.userSelect = 'text';
        passwordField.style.webkitUserSelect = 'text';
        passwordField.disabled = false;
        passwordField.readOnly = false;
        passwordField.tabIndex = 2;
        passwordField.style.opacity = '1';
        passwordField.style.visibility = 'visible';
    }
    
    if (storeField) {
        storeField.style.pointerEvents = 'auto';
        storeField.disabled = false;
        storeField.tabIndex = 3;
        storeField.style.opacity = '1';
        storeField.style.visibility = 'visible';
    }
    
    // Force focus capability
    const acenetOptions = document.getElementById('acenetOptions');
    if (acenetOptions) {
        acenetOptions.style.pointerEvents = 'auto';
    }
    
    console.log('Input field force initialization complete');
};

// Additional initialization after window is fully loaded
window.addEventListener('load', () => {
    console.log('Window fully loaded, ensuring input field accessibility...');
    
    // Double-check input field accessibility
    setTimeout(() => {
        window.initializeInputFields();
        console.log('Input fields are now fully accessible');
    }, 100);
    
    // Also run another check after a longer delay to ensure everything is ready
    setTimeout(() => {
        window.initializeInputFields();
        console.log('Final input field accessibility check complete');
    }, 500);
});

// Order display elements
const orderDisplaySection = document.getElementById('orderDisplaySection');
const orderTableBody = document.getElementById('orderTableBody');
const orderTotalAmount = document.getElementById('orderTotalAmount');
const addItemBtn = document.getElementById('addItemBtn');
// Removed saveOrderBtn and saveToPOBtn declarations - buttons no longer exist

// AceNet results elements
const acenetResultsSection = document.getElementById('acenetResultsSection');
const acenetResultsTableContainer = document.getElementById('acenetResultsTableContainer');
const printAcenetResultsBtn = document.getElementById('printAcenetResultsBtn');

// Robot animation
const robotAnimationContainer = document.getElementById('robotAnimationContainer');

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
            runCheckAceNetBtn.disabled = false; // Enable AceNet button when file is selected
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
            runCheckAceNetBtn.disabled = false; // Enable AceNet button when file is selected
        }
});

// Run Suggested Order button
runSuggestedOrderBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    
    // Show robot animation
    robotAnimationContainer.style.display = 'flex';
    runSuggestedOrderBtn.disabled = true;
    
    // Set up progress listener
    window.api.onProcessingUpdate((data) => {
        if (data.type === 'log') {
            console.log('Processing:', data.message);
        } else if (data.type === 'error') {
            console.error('Error:', data.message);
        }
    });
    
    try {
        const result = await window.api.processFile({
            filePath: selectedFile.path,
            scriptType: 'suggested_order',
            daysThreshold: parseInt(daysThreshold.value),
            skipFileOutput: true
        });
        
        if (result.success) {
            console.log('Analysis result:', result);
            console.log('Order data received:', result.orderData);
            
            // Store results in memory for AceNet to use
            suggestedOrderResults.orderData = result.orderData || [];
            suggestedOrderResults.partNumbers = result.orderData ? 
                result.orderData.map(item => item.partNumber || item.sku || '').filter(pn => pn) : [];
            suggestedOrderResults.hasResults = true;
            
            console.log(`Stored ${suggestedOrderResults.partNumbers.length} part numbers for AceNet use`);
            
            // Check if we have order data to display
            if (result.orderData && result.orderData.length > 0) {
                console.log(`Found ${result.orderData.length} items to display in UI`);
                console.log('First item structure:', result.orderData[0]);
                
                // Show order display section
                orderDisplaySection.style.display = 'block';
        
                // Make sure the suggested order panel is visible
                const suggestedOrderPanel = document.getElementById('suggestedOrderPanel');
                if (suggestedOrderPanel) {
                    suggestedOrderPanel.style.display = 'flex';
                    suggestedOrderPanel.classList.add('active');
                }
                
                // Populate order table with the returned data
                populateOrderTable(result.orderData);
                
                // Calculate and display total
                updateOrderTotal();
            }
            
            // Transition to completion state instead of alert
            showCompletionModal(result);
        } else {
            // Hide robot animation
            robotAnimationContainer.style.display = 'none';
            alert('Processing failed: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        // Hide robot animation
        robotAnimationContainer.style.display = 'none';
        console.error('Suggested Order Error:', error);
        alert('Error processing suggested order: ' + (error.message || error.toString()));
    } finally {
        runSuggestedOrderBtn.disabled = false;
        window.api.removeAllListeners('processing-update');
    }
});

// Run Check AceNet button
runCheckAceNetBtn.addEventListener('click', async () => {
    const currentUsernameInput = document.getElementById('username');
    const currentPasswordInput = document.getElementById('password');
    const currentStoreInput = document.getElementById('storeNumber');
    
    if (!currentUsernameInput.value || !currentPasswordInput.value || !currentStoreInput.value) {
        alert('Please fill in all AceNet credentials');
        return;
    }
    
    // Check for input source - either uploaded part numbers file or current order table
    const partNumberFile = document.getElementById('acenetPartFile');
    let partNumbers = [];
    let useInMemoryResults = false;
    
    if (partNumberFile && partNumberFile.files.length > 0) {
        // User uploaded a part numbers file - we'll let the backend handle this
        console.log('Using uploaded part numbers file');
    } else {
        // Extract part numbers from current order display table (accounts for user additions/deletions)
        partNumbers = getCurrentOrderPartNumbers();
        
        if (partNumbers.length > 0) {
            useInMemoryResults = true;
            console.log(`Using ${partNumbers.length} part numbers from current order display`);
        } else {
            alert('No part numbers available. Please run Suggested Order first or add items manually.');
            return;
        }
    }
    
    // Create progress tracking popup - no robot animation for AceNet
    const progressPopup = createProgressPopup(useInMemoryResults ? partNumbers.length : 0);
    runCheckAceNetBtn.disabled = true;
    
    // Set up progress listener
    window.api.onProcessingUpdate((data) => {
        if (data.type === 'log') {
            console.log('AceNet Processing:', data.message);
        } else if (data.type === 'error') {
            console.error('AceNet Error:', data.message);
        } else if (data.type === 'progress') {
            console.log(`AceNet Progress: ${data.current}/${data.total} - ${data.message}`);
            // Update progress popup
            progressPopup.updateProgress(data.current, data.total, data.message);
        }
    });
    
    try {
        let result;
        
        if (useInMemoryResults) {
            // Use in-memory part numbers - call a new direct AceNet processing function
            result = await window.api.processAceNetDirect({
                partNumbers: partNumbers,
                username: currentUsernameInput.value,
                password: currentPasswordInput.value,
                store: currentStoreInput.value
            });
            console.log('AceNet Direct Result:', result);
        } else {
            // Use uploaded file - existing file-based processing
            const fileResult = await window.api.selectFile();
            if (!fileResult) {
                alert('Failed to select part numbers file');
                return;
            }
            
            result = await window.api.processFile({
                filePath: fileResult.path,
                scriptType: 'check_acenet',
                username: currentUsernameInput.value,
                password: currentPasswordInput.value,
                store: currentStoreInput.value,
                sheetName: 'Big Beautiful Order'
            });
        }
        
        if (result.success) {
            console.log('AceNet process completed successfully');
            console.log('Result categorizedResults:', result.categorizedResults);
            console.log('Result totalProcessed:', result.totalProcessed);
            
            // Debug: Log detailed categorization results
            if (result.categorizedResults && Array.isArray(result.categorizedResults)) {
                console.log('=== CATEGORIZATION DEBUG ===');
                result.categorizedResults.forEach((category, index) => {
                    console.log(`Category ${index}:`, {
                        name: category.name,
                        key: category.key,
                        partsCount: category.parts ? category.parts.length : 'NO_PARTS_ARRAY',
                        parts: category.parts || 'UNDEFINED',
                        color: category.color
                    });
                });
                console.log('=== END CATEGORIZATION DEBUG ===');
            }
            
            // Debug: Log raw results from backend
            if (result.results && Array.isArray(result.results)) {
                console.log('=== RAW RESULTS DEBUG ===');
                result.results.forEach((item, index) => {
                    console.log(`Result ${index}:`, {
                        partNumber: item.partNumber,
                        category: item.category,
                        details: item.details
                    });
                });
                console.log('=== END RAW RESULTS DEBUG ===');
            }
            
            // Close progress popup
            progressPopup.close();
            
            // Show AceNet results section
            acenetResultsSection.style.display = 'block';
            
            // Make sure the panel is visible and active
            const acenetPanel = document.getElementById('acenetResultsPanel');
            if (acenetPanel) {
                acenetPanel.classList.add('active');
            }
            
            // Display results in the UI with better error handling
            if (result.categorizedResults && Array.isArray(result.categorizedResults)) {
                try {
                    displayAceNetResults(result.categorizedResults);
                    
                    const totalParts = result.categorizedResults.reduce((sum, category) => {
                        return sum + ((category && category.parts && Array.isArray(category.parts)) ? category.parts.length : 0);
                    }, 0);
                    
                    console.log('Showing completion popup for', totalParts, 'parts');
                    // Show completion popup with error handling
                    showCompletionPopup(result, totalParts);
                } catch (displayError) {
                    console.error('Error displaying AceNet results:', displayError);
                    // Show basic completion popup on display error
                    showCompletionPopup(result, result.totalProcessed || 0);
                }
            } else {
                console.log('No categorized results or invalid format, showing basic completion popup');
                // Show basic completion popup when no valid categorized results
                showCompletionPopup(result, result.totalProcessed || 0);
            }
        } else {
            // Close progress popup
            progressPopup.close();
            
            alert('AceNet check failed: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        // Close progress popup
        if (progressPopup) {
            progressPopup.close();
        }
        
        console.error('AceNet Error:', error);
        alert('Error running AceNet check: ' + (error.message || error.toString()));
    } finally {
        runCheckAceNetBtn.disabled = false;
        window.api.removeAllListeners('processing-update');
    }
});

// Function to get current part numbers from the order display table
function getCurrentOrderPartNumbers() {
    const partNumbers = [];
    
    // Get all rows from the order table body
    const rows = orderTableBody.querySelectorAll('tr');
    
    rows.forEach(row => {
        // Part number is in the second column (index 1)
        const partNumberCell = row.cells[1];
        // Quantity is in the eighth column (index 7) - the editable input field
        const quantityCell = row.cells[7];
        
        if (partNumberCell && quantityCell) {
            let partNumber = '';
            let quantity = 0;
            
            // Check if it's an input field (for manually added items) or text content
            const input = partNumberCell.querySelector('input');
            if (input) {
                partNumber = input.value.trim();
            } else {
                partNumber = partNumberCell.textContent.trim();
            }
            
            // Get quantity from the quantity input field
            const qtyInput = quantityCell.querySelector('input');
            if (qtyInput) {
                quantity = parseInt(qtyInput.value) || 0;
            }
            
            // Only add non-empty part numbers with quantity > 0
            if (partNumber && partNumber !== '' && quantity > 0) {
                partNumbers.push(partNumber);
            }
        }
    });
    
    console.log('Extracted part numbers from order table (with qty > 0):', partNumbers);
    return partNumbers;
}

// Order table management functions
function populateOrderTable(orderData) {
    orderTableBody.innerHTML = '';
    const categoryMap = {
        'steady': { label: 'Steady', class: 'category-badge category-steady' },
        'seasonal': { label: 'Seasonal', class: 'category-badge category-seasonal' },
        'erratic': { label: 'Erratic', class: 'category-badge category-erratic' }
    };
    orderData.forEach((item, index) => {
        // Calculate service level (not displayed)
        // Example: 95% service level (Z=1.65), can be customized per item if needed
        const Z = 1.65;
        const demandStd = item.demandStd || 0;
        const leadTimeWeeks = (item.daysThreshold || 14) / 7;
        const serviceLevel = Z * demandStd * Math.sqrt(leadTimeWeeks);
        // Map category to badge
        let categoryLabel = 'Unknown';
        let categoryClass = 'category-badge';
        if (item.category && categoryMap[item.category.toLowerCase()]) {
            categoryLabel = categoryMap[item.category.toLowerCase()].label;
            categoryClass = categoryMap[item.category.toLowerCase()].class;
        }
        // Build row
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td title="${item.partNumber || item.sku || ''}">${item.partNumber || item.sku || ''}</td>
            <td title="${item.description || 'No Description'}">${item.description || 'No Description'}</td>
            <td><span class="${categoryClass}">${categoryLabel}</span></td>
            <td>${item.currentStock != null ? item.currentStock : ''}</td>
            <td>${item.safetyStock != null ? item.safetyStock : ''}</td>
            <td>${item.suggestedQty != null ? item.suggestedQty : ''}</td>
            <td><input type="number" value="${item.suggestedQty != null ? item.suggestedQty : ''}" min="0" class="qty-input" data-index="${index}" data-cost="${item.cost || 0}"></td>
            <td><button class="btn btn-danger btn-sm btn-icon" onclick="removeOrderItem(${index})" title="Delete item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"></polyline>
                    <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
            </td>
        `;
        orderTableBody.appendChild(row);
    });
    // Add event listeners to quantity inputs
    document.querySelectorAll('.qty-input').forEach(input => {
        input.addEventListener('change', updateOrderTotal);
    });
    updateOrderTotal();
}

function populateAceNetResultsTable(acenetData) {
    const table = document.createElement('table');
    table.className = 'acenet-results-table';
    
    // Create header
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>SKU</th>
            <th>Description</th>
            <th>AceNet Status</th>
            <th>Price</th>
            <th>Availability</th>
        </tr>
    `;
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    acenetData.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.sku || ''}</td>
            <td>${item.description || ''}</td>
            <td>${item.status || 'Unknown'}</td>
            <td>${item.price || 'N/A'}</td>
            <td>${item.availability || 'Unknown'}</td>
        `;
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
    
    acenetResultsTableContainer.innerHTML = '';
    acenetResultsTableContainer.appendChild(table);
}

function updateOrderTotal() {
    let totalItems = 0;
    let totalCost = 0;
    
    document.querySelectorAll('.qty-input').forEach(input => {
        const qty = parseInt(input.value) || 0;
        const cost = parseFloat(input.dataset.cost) || 0;
        
        totalItems += qty;
        totalCost += qty * cost;
    });
    
    if (totalCost > 0) {
        orderTotalAmount.textContent = `${totalItems} items - $${totalCost.toFixed(2)}`;
    } else {
        orderTotalAmount.textContent = `${totalItems} items`;
    }
}

function removeOrderItem(index) {
    const row = orderTableBody.children[index];
    if (row) {
        row.remove();
        updateOrderTotal();
        // Renumber the remaining rows
        Array.from(orderTableBody.children).forEach((row, newIndex) => {
            row.cells[0].textContent = newIndex + 1;
            const removeBtn = row.querySelector('button');
            if (removeBtn) {
                removeBtn.setAttribute('onclick', `removeOrderItem(${newIndex})`);
            }
        });
    }
}

// Order management button handlers
if (addItemBtn) {
    addItemBtn.addEventListener('click', () => {
        const row = document.createElement('tr');
        const newIndex = orderTableBody.children.length;
        row.innerHTML = `
            <td>${newIndex + 1}</td>
            <td><input type="text" class="form-control" placeholder="Enter SKU"></td>
            <td><input type="text" class="form-control" placeholder="Enter description"></td>
            <td><span class="category-badge">Manual</span></td>
            <td><input type="number" class="form-control" placeholder="Stock" value="0" min="0"></td>
            <td><input type="number" class="form-control" placeholder="Safety Stock" value="0" min="0"></td>
            <td>-</td>
            <td><input type="number" value="0" min="0" class="qty-input" data-index="${newIndex}" data-cost="0"></td>
            <td><button class="btn btn-danger btn-sm btn-icon" onclick="removeOrderItem(${newIndex})" title="Delete item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"></polyline>
                    <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
            </td>
        `;
        orderTableBody.appendChild(row);
        
        const qtyInput = row.querySelector('.qty-input');
        qtyInput.addEventListener('change', updateOrderTotal);
    });
}

// Removed save order event listeners - no longer saving files to disk

if (printAcenetResultsBtn) {
    printAcenetResultsBtn.addEventListener('click', () => {
        window.print();
    });
}

// Helper functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const index = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, index)).toFixed(2)) + ' ' + sizes[index];
}

// populateOrderAnalysisDetails function removed - Advanced Order Analysis Summary section removed from UI

// Function to display AceNet results in the UI
function displayAceNetResults(categorizedResults) {
    // Get the results content container
    const resultsContent = document.getElementById('acenetResultsContent');
    if (!resultsContent) {
        console.error('AceNet results content container not found');
        return;
    }
    
    // Clear existing results
    resultsContent.innerHTML = '';
    
    // Create a container for all categories
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'acenet-results-container';
    
    // Debug: Log what we're trying to display
    console.log('=== DISPLAY DEBUG ===');
    console.log('Categories to display:', categorizedResults.length);
    
    // Process each category
    categorizedResults.forEach((category, index) => {
        console.log(`Display Category ${index}:`, {
            name: category.name,
            partsCount: category.parts ? category.parts.length : 'NO_PARTS',
            hasPartsArray: Array.isArray(category.parts),
            parts: category.parts
        });
        
        // Show ALL categories temporarily (including empty ones) for debugging
        if (category.parts && Array.isArray(category.parts)) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'acenet-category';
            
            const categoryHeader = document.createElement('h4');
            if (category.parts.length > 0) {
                categoryHeader.textContent = `${category.name} (${category.parts.length} items)`;
                categoryHeader.style.color = category.color || '#333';
                categoryDiv.appendChild(categoryHeader);
                
                const partsList = document.createElement('ul');
                partsList.className = 'parts-list';
                
                category.parts.forEach(part => {
                    const listItem = document.createElement('li');
                    listItem.textContent = part;
                    listItem.style.fontSize = '14px';
                    listItem.style.marginBottom = '5px';
                    partsList.appendChild(listItem);
                });
                
                categoryDiv.appendChild(partsList);
            } else {
                // Show empty categories with a note for debugging
                categoryHeader.textContent = `${category.name} (0 items) - EMPTY`;
                categoryHeader.style.color = '#999';
                categoryHeader.style.fontStyle = 'italic';
                categoryDiv.appendChild(categoryHeader);
                console.log(`EMPTY CATEGORY: ${category.name}`);
            }
            
            resultsContainer.appendChild(categoryDiv);
        } else {
            console.log(`SKIPPED CATEGORY: ${category.name} - No valid parts array`);
        }
    });
    
    console.log('=== END DISPLAY DEBUG ===');
    
    resultsContent.appendChild(resultsContainer);
}

// Progress tracking popup (similar to Python script)
function createProgressPopup(totalItems) {
    const popup = document.createElement('div');
    popup.className = 'progress-popup';
    popup.innerHTML = `
        <div class="progress-popup-content">
            <h3>Processing Part Numbers</h3>
            <div class="progress-info">
                <div class="progress-text">Initializing...</div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: 0%"></div>
                </div>
                <div class="progress-numbers">0 of ${totalItems} items checked</div>
            </div>
            <div class="progress-buttons">
                <button id="pauseProcessBtn" class="btn btn-warning">Pause</button>
                <button id="cancelProcessBtn" class="btn btn-danger">Cancel</button>
            </div>
        </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .progress-popup {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        }
        .progress-popup-content {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            min-width: 400px;
            text-align: center;
        }
        .progress-info {
            margin: 20px 0;
        }
        .progress-text {
            margin-bottom: 10px;
            font-weight: bold;
        }
        .progress-bar-container {
            width: 100%;
            height: 20px;
            background: #f0f0f0;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #4caf50, #45a049);
            transition: width 0.3s ease;
        }
        .progress-numbers {
            font-size: 14px;
            color: #666;
        }
        .progress-buttons {
            margin-top: 20px;
        }
        .progress-buttons button {
            margin: 0 10px;
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        .btn-warning {
            background: #ffa500;
            color: white;
        }
        .btn-danger {
            background: #f44336;
            color: white;
        }
        .btn-warning:hover {
            background: #ff8c00;
        }
        .btn-danger:hover {
            background: #da190b;
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(popup);
    
    let isPaused = false;
    let isCancelled = false;
    
    // Add event listeners for pause/cancel
    popup.querySelector('#pauseProcessBtn').addEventListener('click', () => {
        isPaused = !isPaused;
        const btn = popup.querySelector('#pauseProcessBtn');
        btn.textContent = isPaused ? 'Resume' : 'Pause';
        btn.className = isPaused ? 'btn btn-success' : 'btn btn-warning';
        
        // TODO: Implement actual pause/resume functionality
        console.log(isPaused ? 'Process paused' : 'Process resumed');
    });
    
    popup.querySelector('#cancelProcessBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to cancel the AceNet check process?')) {
            isCancelled = true;
            popup.remove();
            // TODO: Implement actual cancellation
            console.log('Process cancelled');
        }
    });
    
    return {
        updateProgress: (current, total, message) => {
            if (isCancelled) return;
            
            const progressBar = popup.querySelector('.progress-bar');
            const progressText = popup.querySelector('.progress-text');
            const progressNumbers = popup.querySelector('.progress-numbers');
            
            const percentage = (current / total) * 100;
            progressBar.style.width = percentage + '%';
            progressText.textContent = message || `Processing item ${current}`;
            progressNumbers.textContent = `${current} of ${total} items checked`;
        },
        close: () => {
            popup.remove();
        },
        isPaused: () => isPaused,
        isCancelled: () => isCancelled
    };
}

// Completion popup (similar to Python script)
function showCompletionPopup(result, totalProcessed) {
    const popup = document.createElement('div');
    popup.className = 'completion-popup';
    
    // Create summary of results with null checks
    let summaryText = `Processing Complete!\n\nProcessed ${totalProcessed || 0} part numbers.\n\n`;
    
    // Safely handle categorized results
    if (result && result.categorizedResults && Array.isArray(result.categorizedResults)) {
        try {
            summaryText += 'Results Summary:\n';
            result.categorizedResults.forEach(category => {
                if (category && category.name && category.parts && Array.isArray(category.parts) && category.parts.length > 0) {
                    summaryText += `• ${category.name}: ${category.parts.length} items\n`;
                }
            });
        } catch (error) {
            console.error('Error processing categorized results in completion popup:', error);
            summaryText += 'Results processed - see panel for details.\n';
        }
    } else {
        summaryText += 'Processing completed.\n';
    }
    
    summaryText += '\nResults are displayed in the panel on the right.\nThe browser will remain open for troubleshooting.';
    
    popup.innerHTML = `
        <div class="completion-popup-content">
            <h3>AceNet Check Complete</h3>
            <div class="completion-message">
                <div class="completion-icon">✅</div>
                <div class="completion-summary">${summaryText.replace(/\n/g, '<br>')}</div>
            </div>
            <div class="completion-buttons">
                <button id="closeCompletionBtn" class="btn btn-secondary">Close</button>
                <button id="openExcelBtn" class="btn btn-primary">Open Excel</button>
                <button id="viewResultsBtn" class="btn btn-success">View Results</button>
            </div>
        </div>
    `;
    
    // Add styles for completion popup
    const style = document.createElement('style');
    style.textContent = `
        .completion-popup {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10001;
        }
        .completion-popup-content {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            min-width: 500px;
            max-width: 600px;
            text-align: center;
        }
        .completion-message {
            margin: 20px 0;
        }
        .completion-icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
        .completion-summary {
            text-align: left;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            font-family: monospace;
            font-size: 14px;
            line-height: 1.4;
            white-space: pre-line;
        }
        .completion-buttons {
            margin-top: 30px;
        }
        .completion-buttons button {
            margin: 0 10px;
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
        }
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        .btn-primary {
            background: #007bff;
            color: white;
        }
        .btn-success {
            background: #28a745;
            color: white;
        }
        .btn-secondary:hover {
            background: #5a6268;
        }
        .btn-primary:hover {
            background: #0056b3;
        }
        .btn-success:hover {
            background: #218838;
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(popup);
    
    // Add event listeners
    popup.querySelector('#closeCompletionBtn').addEventListener('click', () => {
        popup.remove();
    });
    
    popup.querySelector('#openExcelBtn').addEventListener('click', async () => {
        // Since we're not creating Excel files anymore, show a message
        alert('Excel files are no longer created for AceNet checks. Results are displayed in the panel on the right.');
        popup.remove();
    });
    
    popup.querySelector('#viewResultsBtn').addEventListener('click', () => {
        // Ensure results section is visible and scroll to it
        const resultsContent = document.getElementById('acenetResultsContent');
        if (resultsContent) {
            resultsContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            acenetResultsSection.scrollIntoView({ behavior: 'smooth' });
        }
        popup.remove();
    });
}

// Show completion modal function
function showCompletionModal(result) {
    // Transition from processing to completion state
    setTimeout(() => {
        const processingState = document.getElementById('processingState');
        const completionState = document.getElementById('completionState');
        
        if (processingState && completionState) {
            processingState.style.display = 'none';
            completionState.style.display = 'block';
            
            // Update content based on results
            const itemsCount = (result.orderData && result.orderData.length) || 0;
            const itemsToOrderCount = document.getElementById('itemsToOrderCount');
            if (itemsToOrderCount) {
                itemsToOrderCount.textContent = itemsCount;
            }
            
            // Populate debug information if available
            if (result.debug) {
                const debugContent = document.getElementById('debugContent');
                if (debugContent) {
                    const debugInfo = [
                        `Total items in file: ${result.debug.totalItems || 'N/A'}`,
                        `Items after filtering: ${result.debug.filteredItems || 'N/A'}`,
                        `Items with forecast > 0: ${result.debug.itemsWithForecast || 'N/A'}`,
                        `Items with stock > 0: ${result.debug.itemsWithStock || 'N/A'}`,
                        `Items below min stock: ${result.debug.itemsBelowMinStock || 'N/A'}`,
                        `Items skipped (MINORDERQTY=0): ${result.debug.itemsSkippedMinOrderQty || 'N/A'}`,
                        `Week columns found: ${result.debug.weekColumnsFound || 'N/A'}`,
                        `Total sales value: ${result.debug.totalSalesValue || 'N/A'}`
                    ];
                    
                    if (itemsCount === 0) {
                        debugInfo.push('');
                        debugInfo.push('Troubleshooting Tips:');
                        debugInfo.push('- If filtered items is 0, check your supplier number');
                        debugInfo.push('- If week columns is 0, check your data format');
                        debugInfo.push('- If total sales is 0, there may be no sales history');
                        debugInfo.push('- Many skipped items indicate non-orderable products');
                    }
                    
                    debugContent.innerHTML = debugInfo.map(line => `<div>${line}</div>`).join('');
                }
            }
        }
    }, 1000); // 1 second delay to show processing completion
}

