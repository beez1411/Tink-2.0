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

// Global storage for on order data
let onOrderData = {};

// Load on order data from localStorage on startup
function loadOnOrderData() {
    const saved = localStorage.getItem('onOrderData');
    if (saved) {
        try {
            onOrderData = JSON.parse(saved);
            console.log('Loaded on order data:', onOrderData);
        } catch (error) {
            console.error('Error loading on order data:', error);
            onOrderData = {};
        }
    }
}

// Save on order data to localStorage
function saveOnOrderData() {
    try {
        localStorage.setItem('onOrderData', JSON.stringify(onOrderData));
        console.log('Saved on order data:', onOrderData);
    } catch (error) {
        console.error('Error saving on order data:', error);
    }
}

// Clear on order data
function clearOnOrderData() {
    onOrderData = {};
    localStorage.removeItem('onOrderData');
    console.log('Cleared on order data');
}

// Get on order quantity for a specific SKU
function getOnOrderQuantity(sku) {
    return onOrderData[sku] || 0;
}

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
    
    // Completion modal event handlers removed - no longer needed
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

// Processing modal functions
function showProcessingModal() {
    const robotAnimationContainer = document.getElementById('robotAnimationContainer');
    if (robotAnimationContainer) {
        robotAnimationContainer.style.display = 'flex';
        
        // Reset modal state to processing
        const processingState = document.getElementById('processingState');
        const completionState = document.getElementById('completionState');
        if (processingState && completionState) {
            processingState.style.display = 'block';
            completionState.style.display = 'none';
        }
    }
}

function hideProcessingModal() {
    const robotAnimationContainer = document.getElementById('robotAnimationContainer');
    if (robotAnimationContainer) {
        robotAnimationContainer.style.display = 'none';
    }
}

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
    try {
        if (!selectedFile) {
            alert('Please select an inventory file first');
            return;
        }

        showProcessingModal();
        
        // Check if Delete On Order is checked
        const deleteOnOrderCheckbox = document.getElementById('deleteOnOrder');
        if (deleteOnOrderCheckbox && deleteOnOrderCheckbox.checked) {
            clearOnOrderData();
            deleteOnOrderCheckbox.checked = false; // Uncheck after clearing
        }

        const daysThresholdValue = parseInt(daysThreshold.value) || 14;
        
        console.log('Starting suggested order analysis...');
        console.log('=== SUGGESTED ORDER DEBUG ===');
        console.log('On order data being passed:', onOrderData);
        console.log('On order items count:', Object.keys(onOrderData).length);
        if (Object.keys(onOrderData).length > 0) {
            console.log('Sample on order items:', Object.entries(onOrderData).slice(0, 5));
        }
        console.log('=== END SUGGESTED ORDER DEBUG ===');
        
        const result = await window.api.processFile({
            filePath: selectedFile.path,
            scriptType: 'suggested_order',
            daysThreshold: daysThresholdValue,
            onOrderData: onOrderData // Pass the on order data to the analysis
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
            
            // Hide processing modal and show results directly
            hideProcessingModal();
            
        } else {
            throw new Error(result.message || 'Unknown error occurred');
        }
        
    } catch (error) {
        console.error('Suggested Order Error:', error);
        alert('Error processing suggested order: ' + (error.message || error.toString()));
        hideProcessingModal();
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
    
    // Set up progress listener for direct AceNet processing
    window.electronAPI.onAcenetProgress((data) => {
        console.log(`AceNet Progress: ${data.current}/${data.total} - ${data.message}`);
        // Update progress popup
        progressPopup.updateProgress(data.current, data.total, data.message);
    });
    
    // Also set up the legacy processing-update listener for file-based processing
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
            
            // Check if error is due to user cancellation
            const errorMessage = result.error || 'Unknown error';
            if (errorMessage.toLowerCase().includes('cancelled by user')) {
                showCancellationPopup();
            } else {
                alert('AceNet check failed: ' + errorMessage);
            }
        }
    } catch (error) {
        // Close progress popup
        if (progressPopup) {
            progressPopup.close();
        }
        
        console.error('AceNet Error:', error);
        const errorMessage = error.message || error.toString();
        
        // Check if error is due to user cancellation
        if (errorMessage.toLowerCase().includes('cancelled by user')) {
            showCancellationPopup();
        } else {
            alert('Error running AceNet check: ' + errorMessage);
        }
    } finally {
        runCheckAceNetBtn.disabled = false;
        window.api.removeAllListeners('processing-update');
        window.electronAPI.removeAcenetProgressListener();
    }
});

// Function to get current part numbers from the order display table
function getCurrentOrderPartNumbers() {
    const partNumbers = [];
    
    // First, try to get part numbers from the visible table
    const rows = orderTableBody.querySelectorAll('tr');
    console.log(`Found ${rows.length} rows in order table`);
    
    rows.forEach((row, index) => {
        // Part number is in the second column (index 1)
        const partNumberCell = row.cells[1];
        // Quantity is in the sixth column (index 5) - this is the quantity controls column
        const quantityCell = row.cells[5];
        
        console.log(`Row ${index}: cells count = ${row.cells.length}`);
        
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
            
            // Get quantity from the quantity input field within the quantity controls
            const qtyInput = quantityCell.querySelector('.qty-input');
            if (qtyInput) {
                quantity = parseInt(qtyInput.value) || 0;
            }
            
            console.log(`Row ${index}: partNumber='${partNumber}', quantity=${quantity}`);
            
            // Only add non-empty part numbers with quantity > 0
            if (partNumber && partNumber !== '' && quantity > 0) {
                partNumbers.push(partNumber);
            }
        }
    });
    
    console.log('Extracted part numbers from order table (with qty > 0):', partNumbers);
    
    // If no part numbers found from table but we have suggested order results, use those
    if (partNumbers.length === 0 && suggestedOrderResults.hasResults && suggestedOrderResults.partNumbers.length > 0) {
        console.log('No part numbers found in table, falling back to stored suggested order results');
        console.log('Available part numbers from suggested order:', suggestedOrderResults.partNumbers);
        return suggestedOrderResults.partNumbers.slice(); // Return a copy
    }
    
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
        
        // Calculate cost and total
        const cost = item.cost || 0;
        const suggestedQty = item.suggestedQty || 0;
        const total = cost * suggestedQty;
        
        // Get on order quantity for this SKU
        const sku = item.partNumber || item.sku || '';
        const onOrderQty = getOnOrderQuantity(sku);
        
        // Get minimum order quantity for this item
        const minOrderQty = item.minOrderQty || 1;
        
        // Build row
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td title="${sku}">${sku}</td>
            <td title="${item.description || 'No Description'}">${item.description || 'No Description'}</td>
            <td>${item.currentStock != null ? item.currentStock : ''}</td>
            <td>${onOrderQty}</td>
            <td class="quantity-cell">
                <div class="quantity-controls">
                    <button class="qty-btn minus-btn" onclick="adjustQuantity(${index}, -${minOrderQty})" title="Decrease by ${minOrderQty}">-</button>
                    <input type="number" value="${suggestedQty}" min="0" class="qty-input" data-index="${index}" data-cost="${cost}" data-min-order-qty="${minOrderQty}" onchange="updateRowTotal(${index})" title="Min Order Qty: ${minOrderQty}">
                    <button class="qty-btn plus-btn" onclick="adjustQuantity(${index}, ${minOrderQty})" title="Increase by ${minOrderQty}">+</button>
                </div>
            </td>
            <td class="cost-cell">
                <div>$${cost.toFixed(2)}</div>
                <small style="color: #6c757d; font-size: 10px;">MOQ: ${minOrderQty}</small>
            </td>
            <td class="total-cell" id="total-${index}">$${total.toFixed(2)}</td>
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
    
    // Format currency with commas for thousands
    const formattedTotal = totalCost.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD'
    });
    
    orderTotalAmount.textContent = formattedTotal;
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
        const defaultMinOrderQty = 1; // Default MOQ for manually added items
        
        row.innerHTML = `
            <td>${newIndex + 1}</td>
            <td><input type="text" class="form-control" placeholder="Enter SKU"></td>
            <td><input type="text" class="form-control" placeholder="Enter description"></td>
            <td><input type="number" class="form-control" placeholder="SOH" value="0" min="0"></td>
            <td><input type="number" class="form-control" placeholder="On ORD" value="0" min="0"></td>
            <td class="quantity-cell">
                <div class="quantity-controls">
                    <button class="qty-btn minus-btn" onclick="adjustQuantity(${newIndex}, -${defaultMinOrderQty})" title="Decrease by ${defaultMinOrderQty}">-</button>
                    <input type="number" value="0" min="0" class="qty-input" data-index="${newIndex}" data-cost="0" data-min-order-qty="${defaultMinOrderQty}" onchange="updateRowTotal(${newIndex})" title="Min Order Qty: ${defaultMinOrderQty}">
                    <button class="qty-btn plus-btn" onclick="adjustQuantity(${newIndex}, ${defaultMinOrderQty})" title="Increase by ${defaultMinOrderQty}">+</button>
                </div>
            </td>
            <td>
                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <input type="number" class="form-control cost-input" placeholder="Cost" value="0" min="0" step="0.01" onchange="updateItemCost(${newIndex})" style="margin-bottom: 2px;">
                    <input type="number" class="form-control moq-input" placeholder="MOQ" value="${defaultMinOrderQty}" min="1" onchange="updateItemMOQ(${newIndex})" title="Minimum Order Quantity" style="font-size: 11px; height: 24px;">
                </div>
            </td>
            <td class="total-cell" id="total-${newIndex}">$0.00</td>
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

// Save On Order button handler
const saveOnOrderBtn = document.getElementById('saveOnOrderBtn');
if (saveOnOrderBtn) {
    saveOnOrderBtn.addEventListener('click', () => {
        // Get current order data and save as on order
        const rows = orderTableBody.querySelectorAll('tr');
        const newOnOrderData = {};
        
        console.log('=== SAVE ON ORDER DEBUG ===');
        console.log('Processing', rows.length, 'rows');
        
        rows.forEach((row, index) => {
            // Get SKU from the row
            const skuCell = row.cells[1];
            let sku = '';
            
            const skuInput = skuCell.querySelector('input');
            if (skuInput) {
                sku = skuInput.value.trim();
                console.log(`Row ${index}: SKU from input:`, sku);
            } else {
                sku = skuCell.textContent.trim();
                console.log(`Row ${index}: SKU from text:`, sku);
            }
            
            if (sku) {
                // Get current quantity
                const qtyInput = row.querySelector('.qty-input');
                const currentQty = parseInt(qtyInput.value) || 0;
                console.log(`Row ${index}: Quantity:`, currentQty);
                
                if (currentQty > 0) {
                    // Add to existing on order quantity
                    const existingOnOrder = getOnOrderQuantity(sku);
                    const newTotal = existingOnOrder + currentQty;
                    newOnOrderData[sku] = newTotal;
                    console.log(`Row ${index}: SKU "${sku}" - existing: ${existingOnOrder}, adding: ${currentQty}, new total: ${newTotal}`);
                }
            }
        });
        
        console.log('New on order data:', newOnOrderData);
        console.log('Existing on order data before merge:', onOrderData);
        
        // Merge with existing on order data
        Object.assign(onOrderData, newOnOrderData);
        saveOnOrderData();
        
        console.log('Final on order data after merge:', onOrderData);
        console.log('=== END SAVE ON ORDER DEBUG ===');
        
        // Show confirmation
        alert(`Saved ${Object.keys(newOnOrderData).length} items to On Order. Total items on order: ${Object.keys(onOrderData).length}`);
        
        // Refresh the display to show updated on order quantities
        if (suggestedOrderResults.hasResults && suggestedOrderResults.orderData) {
            populateOrderTable(suggestedOrderResults.orderData);
        }
    });
}

// Delete On Order checkbox handler
const deleteOnOrderCheckbox = document.getElementById('deleteOnOrder');
if (deleteOnOrderCheckbox) {
    deleteOnOrderCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            if (confirm('This will clear all On Order data. Are you sure?')) {
                clearOnOrderData();
                console.log('On Order data cleared');
                
                // Refresh the display if there's current order data
                if (suggestedOrderResults.hasResults && suggestedOrderResults.orderData) {
                    populateOrderTable(suggestedOrderResults.orderData);
                }
            } else {
                // Uncheck the checkbox if user cancels
                e.target.checked = false;
            }
        }
    });
}

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
    
    // Process each category (only non-empty categories are now passed from backend)
    categorizedResults.forEach((category, index) => {
        console.log(`Display Category ${index}:`, {
            name: category.name,
            partsCount: category.parts ? category.parts.length : 'NO_PARTS',
            hasPartsArray: Array.isArray(category.parts),
            parts: category.parts
        });
        
        // Only display categories with parts (empty categories are already filtered out)
        if (category.parts && Array.isArray(category.parts) && category.parts.length > 0) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'acenet-category';
            
            const categoryHeader = document.createElement('h4');
            categoryHeader.textContent = `${category.name} (${category.parts.length} items)`;
            categoryHeader.style.color = category.color || '#333';
            categoryDiv.appendChild(categoryHeader);
            
            const partsList = document.createElement('ul');
            partsList.className = 'parts-list';
            
            category.parts.forEach(part => {
                const listItem = document.createElement('li');
                
                // Check if this part needs manual review
                const partData = typeof part === 'object' ? part : { partNumber: part };
                const partNumber = partData.partNumber || part;
                
                // Create text content
                let displayText = partNumber;
                if (partData.needsManualReview) {
                    displayText += ' ⚠️ (NEEDS MANUAL REVIEW)';
                    listItem.style.backgroundColor = '#fff3cd';
                    listItem.style.border = '1px solid #ffeaa7';
                    listItem.style.padding = '5px';
                    listItem.style.borderRadius = '3px';
                    listItem.title = 'This item was flagged as "Not in AceNet" but may need manual verification. Please double-check this part number in AceNet directly.';
                }
                
                listItem.textContent = displayText;
                listItem.style.fontSize = '14px';
                listItem.style.marginBottom = '5px';
                partsList.appendChild(listItem);
            });
            
            categoryDiv.appendChild(partsList);
            resultsContainer.appendChild(categoryDiv);
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
    popup.querySelector('#pauseProcessBtn').addEventListener('click', async () => {
        isPaused = !isPaused;
        const btn = popup.querySelector('#pauseProcessBtn');
        btn.textContent = isPaused ? 'Resume' : 'Pause';
        btn.className = isPaused ? 'btn btn-success' : 'btn btn-warning';
        
        try {
            if (isPaused) {
                const result = await window.electronAPI.acenetPause();
                if (result.success) {
                    console.log('Process paused successfully');
                } else {
                    console.error('Failed to pause process:', result.error);
                }
            } else {
                const result = await window.electronAPI.acenetResume();
                if (result.success) {
                    console.log('Process resumed successfully');
                } else {
                    console.error('Failed to resume process:', result.error);
                }
            }
        } catch (error) {
            console.error('Failed to control process:', error);
            // Revert button state on error
            isPaused = !isPaused;
            btn.textContent = isPaused ? 'Resume' : 'Pause';
            btn.className = isPaused ? 'btn btn-success' : 'btn btn-warning';
        }
    });
    
    popup.querySelector('#cancelProcessBtn').addEventListener('click', async () => {
        if (confirm('Are you sure you want to cancel the AceNet check process?')) {
            try {
                const result = await window.electronAPI.acenetCancel();
                if (result.success) {
                    isCancelled = true;
                    popup.remove();
                    console.log('Process cancelled successfully');
                } else {
                    console.error('Failed to cancel process:', result.error);
                    alert('Failed to cancel process. Please try again.');
                }
            } catch (error) {
                console.error('Failed to cancel process:', error);
                alert('Failed to cancel process. Please try again.');
            }
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

// Simple cancellation popup for user-friendly messaging
function showCancellationPopup() {
    const popup = document.createElement('div');
    popup.className = 'cancellation-popup';
    
    popup.innerHTML = `
        <div class="cancellation-popup-content">
            <div class="cancellation-icon">❌</div>
            <h3>Process Cancelled</h3>
            <p>The AceNet check process has been cancelled successfully.</p>
            <button id="closeCancellationBtn" class="btn btn-primary">OK</button>
        </div>
    `;
    
    // Add styles for cancellation popup
    const style = document.createElement('style');
    style.textContent = `
        .cancellation-popup {
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
        .cancellation-popup-content {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            min-width: 300px;
            max-width: 400px;
            text-align: center;
        }
        .cancellation-icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
        .cancellation-popup-content h3 {
            margin: 0 0 15px 0;
            color: #333;
            font-size: 20px;
        }
        .cancellation-popup-content p {
            margin: 0 0 25px 0;
            color: #666;
            font-size: 14px;
            line-height: 1.4;
        }
        .cancellation-popup-content button {
            padding: 10px 30px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            background: #007bff;
            color: white;
            font-size: 14px;
        }
        .cancellation-popup-content button:hover {
            background: #0056b3;
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(popup);
    
    // Add event listener for OK button
    popup.querySelector('#closeCancellationBtn').addEventListener('click', () => {
        popup.remove();
        style.remove(); // Also remove the styles
    });
}

// showCompletionModal function removed - no longer needed

// Function to adjust quantity with + and - buttons (now supports MOQ increments)
function adjustQuantity(index, change) {
    const row = orderTableBody.children[index];
    if (row) {
        const qtyInput = row.querySelector('.qty-input');
        const currentQty = parseInt(qtyInput.value) || 0;
        const minOrderQty = parseInt(qtyInput.dataset.minOrderQty) || 1;
        
        let newQty;
        if (change > 0) {
            // Increasing quantity - use the MOQ increment
            newQty = currentQty + Math.abs(change);
        } else {
            // Decreasing quantity - use the MOQ decrement, but don't go below 0
            const decreaseAmount = Math.abs(change);
            newQty = Math.max(0, currentQty - decreaseAmount);
        }
        
        qtyInput.value = newQty;
        updateRowTotal(index);
        updateOrderTotal();
    }
}

// Function to update individual row total
function updateRowTotal(index) {
    const row = orderTableBody.children[index];
    if (row) {
        const qtyInput = row.querySelector('.qty-input');
        const totalCell = row.querySelector('.total-cell');
        const qty = parseInt(qtyInput.value) || 0;
        const minOrderQty = parseInt(qtyInput.dataset.minOrderQty) || 1;
        const cost = parseFloat(qtyInput.dataset.cost) || 0;
        
        // Validate quantity against MOQ - show warning if not divisible by MOQ
        if (qty > 0 && qty % minOrderQty !== 0) {
            qtyInput.style.backgroundColor = '#fff3cd';
            qtyInput.title = `Warning: Quantity should be in multiples of ${minOrderQty} (MOQ). Current: ${qty}`;
        } else {
            qtyInput.style.backgroundColor = '';
            qtyInput.title = `Min Order Qty: ${minOrderQty}`;
        }
        
        const total = qty * cost;
        totalCell.textContent = `$${total.toFixed(2)}`;
    }
    updateOrderTotal();
}

// Function to update item cost for manually added items
function updateItemCost(index) {
    const row = orderTableBody.children[index];
    if (row) {
        const costInput = row.querySelector('.cost-input');
        const qtyInput = row.querySelector('.qty-input');
        const newCost = parseFloat(costInput.value) || 0;
        
        // Update the data-cost attribute
        qtyInput.dataset.cost = newCost;
        
        // Update the row total
        updateRowTotal(index);
    }
}

// Function to update minimum order quantity for manually added items
function updateItemMOQ(index) {
    const row = orderTableBody.children[index];
    if (row) {
        const moqInput = row.querySelector('.moq-input');
        const qtyInput = row.querySelector('.qty-input');
        const minusBtn = row.querySelector('.minus-btn');
        const plusBtn = row.querySelector('.plus-btn');
        
        const newMOQ = Math.max(1, parseInt(moqInput.value) || 1);
        moqInput.value = newMOQ; // Ensure the input shows the corrected value
        
        // Update the data attribute and button handlers
        qtyInput.dataset.minOrderQty = newMOQ;
        qtyInput.title = `Min Order Qty: ${newMOQ}`;
        
        // Update button onclick handlers and titles
        minusBtn.setAttribute('onclick', `adjustQuantity(${index}, -${newMOQ})`);
        minusBtn.title = `Decrease by ${newMOQ}`;
        
        plusBtn.setAttribute('onclick', `adjustQuantity(${index}, ${newMOQ})`);
        plusBtn.title = `Increase by ${newMOQ}`;
    }
}

// Load on order data when the page loads
loadOnOrderData();

// Add collapsible functionality for AceNet Results
document.addEventListener('DOMContentLoaded', function() {
    const acenetToggle = document.getElementById('acenetResultsToggle');
    const acenetContent = document.getElementById('acenetCollapsibleContent');
    
    if (acenetToggle && acenetContent) {
        acenetToggle.addEventListener('click', function() {
            const isCollapsed = acenetToggle.classList.contains('collapsed');
            
            if (isCollapsed) {
                // Expand
                acenetToggle.classList.remove('collapsed');
                acenetContent.classList.remove('collapsed');
            } else {
                // Collapse
                acenetToggle.classList.add('collapsed');
                acenetContent.classList.add('collapsed');
            }
        });
    }
});

// Auto-updater event listeners
if (window.api) {
    // Listen for update available
    window.api.onUpdateAvailable((info) => {
        showUpdateNotification('Update Available', `Version ${info.version} is available. It will be downloaded in the background.`);
    });
    
    // Listen for download progress
    window.api.onDownloadProgress((progressObj) => {
        updateDownloadProgress(progressObj.percent);
    });
    
    // Listen for update downloaded
    window.api.onUpdateDownloaded((info) => {
        showUpdateReadyNotification(`Version ${info.version} has been downloaded and is ready to install.`);
    });
}

// Update notification functions
function showUpdateNotification(title, message) {
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
        <div class="update-content">
            <h3>${title}</h3>
            <p>${message}</p>
        </div>
    `;
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

function showUpdateReadyNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
        <div class="update-content">
            <h3>Update Ready</h3>
            <p>${message}</p>
            <div class="update-buttons">
                <button id="installUpdate">Restart & Install</button>
                <button id="dismissUpdate">Later</button>
            </div>
        </div>
    `;
    document.body.appendChild(notification);
    
    // Add event listeners
    notification.querySelector('#installUpdate').addEventListener('click', () => {
        window.api.restartApp();
    });
    
    notification.querySelector('#dismissUpdate').addEventListener('click', () => {
        notification.remove();
    });
}

function updateDownloadProgress(percent) {
    const existingNotification = document.querySelector('.update-notification');
    if (existingNotification) {
        let progressBar = existingNotification.querySelector('.progress-bar');
        if (!progressBar) {
            const progressContainer = document.createElement('div');
            progressContainer.innerHTML = `
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                    <span id="updateProgressText">${Math.round(percent)}%</span>
                </div>
            `;
            existingNotification.querySelector('.update-content').appendChild(progressContainer);
            progressBar = progressContainer.querySelector('.progress-bar');
        }
        
        const progressFill = progressBar.querySelector('.progress-fill');
        const progressText = progressBar.querySelector('#updateProgressText');
        
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressText) progressText.textContent = `${Math.round(percent)}%`;
    }
}

