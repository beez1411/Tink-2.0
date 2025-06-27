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

// Get DOM elements for part number file upload
const partNumberFileInput = document.getElementById('acenetPartFile');
const uploadPartNumberBtn = document.getElementById('uploadPartNumberBtn');

// Global storage for suggested order results
let suggestedOrderResults = {
    orderData: [],
    partNumbers: [],
    hasResults: false
};

// Global storage for on order data
let onOrderData = {};

// Global storage for AceNet results (for Excel export)
let globalAceNetResults = null;

// Remember Me functionality
function loadRememberedCredentials() {
    const rememberedData = localStorage.getItem('rememberedCredentials');
    if (rememberedData) {
        try {
            const credentials = JSON.parse(rememberedData);
            
            // Load username
            if (credentials.username && usernameInput) {
                usernameInput.value = credentials.username;
            }
            
            // Load password
            if (credentials.password && passwordInput) {
                passwordInput.value = credentials.password;
            }
            
            // Load store selection
            if (credentials.storeNumber && storeNumberInput) {
                storeNumberInput.value = credentials.storeNumber;
            }
            
            // Check the remember me checkbox
            const rememberMeCheckbox = document.getElementById('rememberMe');
            if (rememberMeCheckbox) {
                rememberMeCheckbox.checked = true;
            }
            
            console.log('Loaded remembered credentials for username:', credentials.username);
        } catch (error) {
            console.error('Error loading remembered credentials:', error);
        }
    }
}

function saveRememberedCredentials() {
    const rememberMeCheckbox = document.getElementById('rememberMe');
    
    if (rememberMeCheckbox && rememberMeCheckbox.checked) {
        const credentials = {
            username: usernameInput ? usernameInput.value : '',
            password: passwordInput ? passwordInput.value : '',
            storeNumber: storeNumberInput ? storeNumberInput.value : ''
        };
        
        try {
            localStorage.setItem('rememberedCredentials', JSON.stringify(credentials));
            console.log('Saved credentials for username:', credentials.username);
        } catch (error) {
            console.error('Error saving remembered credentials:', error);
        }
    }
}

function clearRememberedCredentials() {
    localStorage.removeItem('rememberedCredentials');
    console.log('Cleared remembered credentials');
}

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

// Function to check and adjust sidebar scrolling
function checkSidebarScrolling() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    
    const sidebarHeight = sidebar.clientHeight;
    const sidebarScrollHeight = sidebar.scrollHeight;
    
    // If content is overflowing, ensure scrolling is enabled
    if (sidebarScrollHeight > sidebarHeight) {
        sidebar.style.overflowY = 'auto';
        sidebar.style.paddingRight = '16px'; // Account for scrollbar
        console.log('Sidebar scrolling enabled - content overflowing');
    } else {
        sidebar.style.overflowY = 'hidden';
        sidebar.style.paddingRight = '20px'; // Original padding
    }
}

// Function to ensure all sidebar elements are accessible
function ensureSidebarAccessibility() {
    const sidebar = document.querySelector('.sidebar');
    const checkAceNetBtn = document.getElementById('runCheckAceNetBtn');
    const rememberMeCheckbox = document.getElementById('rememberMe');
    
    if (!sidebar || !checkAceNetBtn) return;
    
    // Check if the last elements are visible
    const sidebarRect = sidebar.getBoundingClientRect();
    const checkAceNetRect = checkAceNetBtn.getBoundingClientRect();
    
    // If the Check AceNet button is below the visible area
    if (checkAceNetRect.bottom > sidebarRect.bottom) {
        console.log('Check AceNet button is not fully visible, enabling scrolling');
        sidebar.style.overflowY = 'auto';
        
        // Add visual indicator for scrolling
        if (!sidebar.querySelector('.scroll-indicator')) {
            const scrollIndicator = document.createElement('div');
            scrollIndicator.className = 'scroll-indicator';
            scrollIndicator.innerHTML = '⬇️ Scroll for more options';
            scrollIndicator.style.cssText = `
                position: sticky;
                bottom: 0;
                background: linear-gradient(transparent, #f4f6fa);
                text-align: center;
                padding: 8px;
                font-size: 0.8em;
                color: #666;
                pointer-events: none;
            `;
            sidebar.appendChild(scrollIndicator);
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

// Add a manual accessibility fix button for users
function addAccessibilityFixButton() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || sidebar.querySelector('.accessibility-fix-btn')) return;
    
    const fixButton = document.createElement('button');
    fixButton.className = 'btn btn-secondary accessibility-fix-btn';
    fixButton.innerHTML = '🔧 Fix Input Fields';
    fixButton.title = 'Click if username/password fields are not working (alternative to Ctrl+Shift+I)';
    fixButton.style.cssText = `
        font-size: 0.8em;
        padding: 0.3rem 0.6rem;
        margin-top: 0.5rem;
        background: #ffc107;
        border-color: #ffc107;
        color: #000;
    `;
    
    fixButton.addEventListener('click', () => {
        console.log('Manual accessibility fix triggered by user');
        forceInputFieldAccessibility();
        
        // Provide visual feedback
        fixButton.innerHTML = '✅ Fixed!';
        setTimeout(() => {
            fixButton.innerHTML = '🔧 Fix Input Fields';
        }, 2000);
    });
    
    // Insert before the Check AceNet button
    const checkAceNetBtn = document.getElementById('runCheckAceNetBtn');
    if (checkAceNetBtn) {
        sidebar.insertBefore(fixButton, checkAceNetBtn);
    }
}

// Enhanced accessibility function with better detection
function forceInputFieldAccessibility() {
    // Only run if fields are actually inaccessible to avoid layout interference
    let fixedAny = false;
    
    ['username', 'password', 'storeNumber'].forEach((fieldId) => {
        const field = document.getElementById(fieldId);
        if (field) {
            const computedStyle = getComputedStyle(field);
            const isInaccessible = field.disabled || 
                                   field.readOnly || 
                                   computedStyle.pointerEvents === 'none' ||
                                   computedStyle.visibility === 'hidden' ||
                                   computedStyle.opacity === '0';
            
            // Only apply fixes if field is actually inaccessible
            if (isInaccessible) {
                console.log(`Fixing accessibility for ${fieldId}`);
                field.disabled = false;
                field.readOnly = false;
                field.style.pointerEvents = 'auto';
                field.style.userSelect = 'text';
                field.style.opacity = '1';
                field.style.visibility = 'visible';
                field.tabIndex = fieldId === 'username' ? 1 : fieldId === 'password' ? 2 : 3;
                
                // Ensure the field is focusable
                field.setAttribute('aria-hidden', 'false');
                field.removeAttribute('readonly');
                field.removeAttribute('disabled');
                
                fixedAny = true;
            }
        }
    });
    
    if (fixedAny) {
        console.log('Applied accessibility fixes to input fields');
    }
    
    return fixedAny;
}

// Ensure input fields work properly
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing input fields...');
    
    // Initial setup
    forceInputFieldAccessibility();
    
    // Load remembered credentials if they exist
    loadRememberedCredentials();
    
    // Connect the HTML Fix Input Fields button to functionality
    const fixButton = document.getElementById('fixInputFieldsBtn');
    if (fixButton) {
        fixButton.addEventListener('click', () => {
            console.log('Manual accessibility fix triggered by user');
            forceInputFieldAccessibility();
            
            // Provide visual feedback
            const originalText = fixButton.innerHTML;
            fixButton.innerHTML = '✅ Fixed!';
            setTimeout(() => {
                fixButton.innerHTML = originalText;
            }, 2000);
        });
    }
    
    // Remember Me functionality event listeners
    const rememberMeCheckbox = document.getElementById('rememberMe');
    if (rememberMeCheckbox) {
        rememberMeCheckbox.addEventListener('change', () => {
            if (rememberMeCheckbox.checked) {
                // Save current credentials when checkbox is checked
                saveRememberedCredentials();
            } else {
                // Clear saved credentials when checkbox is unchecked
                clearRememberedCredentials();
            }
        });
    }
    
    // Add event listeners to save credentials when they change (if remember me is checked)
    const credentialInputs = [usernameInput, passwordInput, storeNumberInput];
    credentialInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                const rememberMe = document.getElementById('rememberMe');
                if (rememberMe && rememberMe.checked) {
                    saveRememberedCredentials();
                }
            });
            
            input.addEventListener('change', () => {
                const rememberMe = document.getElementById('rememberMe');
                if (rememberMe && rememberMe.checked) {
                    saveRememberedCredentials();
                }
            });
        }
    });
    
    // Minimal periodic checks to avoid layout interference
    setInterval(forceInputFieldAccessibility, 15000); // Check every 15 seconds - much less aggressive
    
    console.log('Input fields initialization complete with simplified monitoring');
    
    // Check sidebar accessibility after DOM is loaded
    setTimeout(() => {
        checkSidebarScrolling();
        ensureSidebarAccessibility();
        // addAccessibilityFixButton(); // Removed - button now exists in HTML at bottom
    }, 500);
    
    // Completion modal event handlers removed - no longer needed
});

// Backup initialization function that can be called from main process
window.initializeInputFields = function() {
    console.log('Forcing input field initialization...');
    forceInputFieldAccessibility();
    console.log('Input field force initialization complete');
};

// Additional initialization after window is fully loaded
window.addEventListener('load', () => {
    console.log('Window fully loaded, ensuring input field accessibility...');
    
    // Double-check input field accessibility
    setTimeout(() => {
        window.initializeInputFields();
        // Load remembered credentials again as backup
        loadRememberedCredentials();
        console.log('Input fields are now fully accessible');
    }, 100);
    
    // Also run another check after a longer delay to ensure everything is ready
    setTimeout(() => {
        window.initializeInputFields();
        checkSidebarScrolling();
        ensureSidebarAccessibility();
        // Load credentials one more time to ensure they're set
        loadRememberedCredentials();
        console.log('Final input field accessibility check complete');
    }, 500);
});

// Handle window resize events
window.addEventListener('resize', () => {
    // Debounce the resize handler
    clearTimeout(window.resizeTimeout);
    window.resizeTimeout = setTimeout(() => {
        console.log('Window resized, checking sidebar accessibility...');
        checkSidebarScrolling();
        ensureSidebarAccessibility();
    }, 250);
});

// Order display elements
const orderDisplaySection = document.getElementById('orderDisplaySection');
const orderTableBody = document.getElementById('orderTableBody');
const orderTotalAmount = document.getElementById('orderTotalAmount');
const addItemBtn = document.getElementById('addItemBtn');
const saveToPOBtn = document.getElementById('saveToPOBtn');

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
        await showAlert('Please select an inventory file first', 'warning');
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
            
            // CLEAR ANY EXISTING DATA - Override previous uploaded file or suggested order results
            orderTableBody.innerHTML = '';
            suggestedOrderResults = {
                orderData: [],
                partNumbers: [],
                hasResults: false
            };
            
            console.log('Cleared existing order data - switching to suggested order mode');
            
            // Clear any uploaded file input
            const partNumberFileInput = document.getElementById('acenetPartFile');
            if (partNumberFileInput) {
                partNumberFileInput.value = '';
                console.log('Cleared uploaded file input');
            }
            
            // Store results in memory for AceNet to use
            suggestedOrderResults.orderData = result.orderData || [];
            suggestedOrderResults.partNumbers = result.orderData ? 
                result.orderData.map(item => item.partNumber || item.sku || '').filter(pn => pn) : [];
            suggestedOrderResults.hasResults = true;
            suggestedOrderResults.source = 'suggested_order'; // Track the source
            
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
            
            // CRITICAL: Force input field accessibility after suggested order
            setTimeout(() => {
                forceInputFieldAccessibility();
                console.log('Forced input accessibility after suggested order');
            }, 100);
            
        } else {
            throw new Error(result.message || 'Unknown error occurred');
        }
        
    } catch (error) {
        console.error('Suggested Order Error:', error);
        await showAlert('Error processing suggested order: ' + (error.message || error.toString()), 'error');
        hideProcessingModal();
    }
});

// Run Check AceNet button
runCheckAceNetBtn.addEventListener('click', async () => {
    const currentUsernameInput = document.getElementById('username');
    const currentPasswordInput = document.getElementById('password');
    const currentStoreInput = document.getElementById('storeNumber');
    
    if (!currentUsernameInput.value || !currentPasswordInput.value || !currentStoreInput.value) {
        await showAlert('Please fill in all AceNet credentials', 'warning');
        return;
    }
    
    // Extract part numbers from current order display table
    // This covers both uploaded files (which populate the table) and suggested order results
    const partNumbers = getCurrentOrderPartNumbers();
    
    if (partNumbers.length > 0) {
        console.log(`Using ${partNumbers.length} part numbers from current order display`);
    } else {
        await showAlert('No part numbers available. Please run Suggested Order first or upload a part number file.', 'warning');
        return;
    }
    
    // Create progress tracking popup - no robot animation for AceNet
    const progressPopup = createProgressPopup(partNumbers.length);
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
        
        // Use in-memory part numbers - call direct AceNet processing function
        result = await window.api.processAceNetDirect({
            partNumbers: partNumbers,
            username: currentUsernameInput.value,
            password: currentPasswordInput.value,
            store: currentStoreInput.value
        });
        console.log('AceNet Direct Result:', result);
        
        if (result.success) {
            console.log('AceNet process completed successfully');
            console.log('Result categorizedResults:', result.categorizedResults);
            console.log('Result totalProcessed:', result.totalProcessed);
            
            // Store results globally for Excel export functionality
            globalAceNetResults = result;
            
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
                await showAlert('AceNet check failed: ' + errorMessage, 'error');
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
            await showAlert('Error running AceNet check: ' + errorMessage, 'error');
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
    saveOnOrderBtn.addEventListener('click', async () => {
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
        await showAlert(`Saved ${Object.keys(newOnOrderData).length} items to On Order. Total items on order: ${Object.keys(onOrderData).length}`, 'success');
        
        // Refresh the display to show updated on order quantities
        if (suggestedOrderResults.hasResults && suggestedOrderResults.orderData) {
            populateOrderTable(suggestedOrderResults.orderData);
        }
    });
}

// Save to PO button handler
if (saveToPOBtn) {
    saveToPOBtn.addEventListener('click', async () => {
        try {
            // Get current order data from the table
            const rows = orderTableBody.querySelectorAll('tr');
            const orderData = [];
            
            rows.forEach((row, index) => {
                // Get SKU from the row
                const skuCell = row.cells[1];
                let sku = '';
                
                const skuInput = skuCell.querySelector('input');
                if (skuInput) {
                    sku = skuInput.value.trim();
                } else {
                    sku = skuCell.textContent.trim();
                }
                
                if (sku) {
                    // Get quantity
                    const qtyInput = row.querySelector('.qty-input');
                    const quantity = parseInt(qtyInput.value) || 0;
                    
                    // Get cost if available
                    const costCell = row.cells[6]; // Cost/MOQ column
                    let cost = '';
                    
                    // First check for input field (manually added items)
                    const costInput = costCell.querySelector('input.cost-input');
                    if (costInput) {
                        const costValue = parseFloat(costInput.value) || 0;
                        cost = costValue.toFixed(2);
                    } else {
                        // For regular items, cost is in a div - extract from text
                        const costDiv = costCell.querySelector('div');
                        if (costDiv) {
                            const costText = costDiv.textContent.trim();
                            // Extract number from $XX.XX format
                            const costMatch = costText.match(/\$?(\d+\.?\d*)/);
                            if (costMatch) {
                                cost = parseFloat(costMatch[1]).toFixed(2);
                            }
                        }
                    }
                    
                    // Only include items with quantity > 0
                    if (quantity > 0) {
                        orderData.push({
                            partNumber: sku,
                            quantity: quantity,
                            cost: cost
                        });
                    }
                }
            });
            
                if (orderData.length === 0) {
        await showAlert('No items with quantities > 0 found to save to PO.', 'warning');
        return;
    }
            
            // Call the API to save the PO file
            const result = await window.api.saveToPO(orderData);
            
            if (result.success) {
                await showAlert(`PO file saved successfully!\nLocation: ${result.filePath}\nDirectory: ${result.directory}\nItems saved: ${orderData.length}`, 'success');
            } else {
                const errorMessage = result.details ? 
                    `Error saving PO file: ${result.error}\n\nDetails: ${result.details}` :
                    `Error saving PO file: ${result.error}`;
                await showAlert(errorMessage, 'error');
            }
            
        } catch (error) {
            console.error('Save to PO error:', error);
            await showAlert('Error saving PO file: ' + error.message, 'error');
        }
    });
}

// Delete On Order checkbox handler
const deleteOnOrderCheckbox = document.getElementById('deleteOnOrder');
if (deleteOnOrderCheckbox) {
    deleteOnOrderCheckbox.addEventListener('change', async (e) => {
        if (e.target.checked) {
            const confirmed = await showConfirm('This will clear all On Order data. Are you sure?', 'Clear On Order Data');
            if (confirmed) {
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

// Open in Excel button for AceNet results
const openExcelAcenetResultsBtn = document.getElementById('openExcelAcenetResultsBtn');
if (openExcelAcenetResultsBtn) {
    openExcelAcenetResultsBtn.addEventListener('click', async () => {
        try {
            // Check if we have stored AceNet results
            if (!globalAceNetResults || !globalAceNetResults.categorizedResults) {
                await showAlert('No AceNet results available. Please run AceNet check first.', 'warning');
                return;
            }
            
            // Export results to Excel using the same functionality as the completion popup
            const exportResult = await window.api.exportAceNetResults(globalAceNetResults);
            
            if (exportResult.success) {
                // Show success message and ask if user wants to open the file
                const openFile = await showConfirm(`Excel file created successfully!\nLocation: ${exportResult.filePath}\n\nWould you like to open the file now?`, 'Open Excel File');
                
                if (openFile) {
                    // Open the file using the system default application
                    await window.api.openFile(exportResult.filePath);
                }
            } else {
                await showAlert('Error creating Excel file: ' + exportResult.error, 'error');
            }
        } catch (error) {
            console.error('Excel export error:', error);
            await showAlert('Error creating Excel file: ' + error.message, 'error');
        }
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
            <div class="popup-header">
                <span class="popup-icon">⚙️</span>
                <h3 class="popup-title">Processing Part Numbers</h3>
            </div>
            <div class="popup-progress">
                <div class="popup-progress-text">Initializing...</div>
                <div class="popup-progress-bar">
                    <div class="popup-progress-fill" style="width: 0%"></div>
                </div>
                <div class="popup-progress-numbers">0 of ${totalItems} items checked</div>
            </div>
            <div class="popup-actions">
                <button id="pauseProcessBtn" class="popup-btn warning">Pause</button>
                <button id="cancelProcessBtn" class="popup-btn danger">Cancel</button>
            </div>
        </div>
    `;
    
    // No need for inline styles - using standardized CSS classes
    
    document.body.appendChild(popup);
    
    let isPaused = false;
    let isCancelled = false;
    
    // Add event listeners for pause/cancel
    popup.querySelector('#pauseProcessBtn').addEventListener('click', async () => {
        isPaused = !isPaused;
        const btn = popup.querySelector('#pauseProcessBtn');
        btn.textContent = isPaused ? 'Resume' : 'Pause';
        btn.className = isPaused ? 'popup-btn success' : 'popup-btn warning';
        
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
            btn.className = isPaused ? 'popup-btn success' : 'popup-btn warning';
        }
    });
    
    popup.querySelector('#cancelProcessBtn').addEventListener('click', async () => {
        const confirmed = await showConfirm('Are you sure you want to cancel the AceNet check process?', 'Cancel Process');
        if (confirmed) {
            try {
                const result = await window.electronAPI.acenetCancel();
                if (result.success) {
                    isCancelled = true;
                    popup.remove();
                    console.log('Process cancelled successfully');
                } else {
                    console.error('Failed to cancel process:', result.error);
                    await showAlert('Failed to cancel process. Please try again.', 'error');
                }
            } catch (error) {
                console.error('Failed to cancel process:', error);
                await showAlert('Failed to cancel process. Please try again.', 'error');
            }
        }
    });
    
    return {
        updateProgress: (current, total, message) => {
            if (isCancelled) return;
            
            const progressBar = popup.querySelector('.popup-progress-fill');
            const progressText = popup.querySelector('.popup-progress-text');
            const progressNumbers = popup.querySelector('.popup-progress-numbers');
            
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
            <div class="popup-header">
                <span class="popup-icon success">✅</span>
                <h3 class="popup-title">AceNet Check Complete</h3>
            </div>
            <div class="popup-body">
                <div class="popup-message">${summaryText.replace(/\n/g, '<br>')}</div>
            </div>
            <div class="popup-actions">
                <button id="closeCompletionBtn" class="popup-btn secondary">Close</button>
                <button id="openExcelBtn" class="popup-btn primary">Open Excel</button>
                <button id="viewResultsBtn" class="popup-btn success">View Results</button>
            </div>
        </div>
    `;
    
    // No need for inline styles - using standardized CSS classes
    
    document.body.appendChild(popup);
    
    // Add event listeners
    popup.querySelector('#closeCompletionBtn').addEventListener('click', () => {
        popup.remove();
    });
    
    popup.querySelector('#openExcelBtn').addEventListener('click', async () => {
        try {
            // Export results to Excel
            const exportResult = await window.api.exportAceNetResults(result);
            
            if (exportResult.success) {
                // Show success message and ask if user wants to open the file
                const openFile = await showConfirm(`Excel file created successfully!\nLocation: ${exportResult.filePath}\n\nWould you like to open the file now?`, 'Open Excel File');
                
                if (openFile) {
                    // Open the file using the system default application
                    await window.api.openFile(exportResult.filePath);
                }
            } else {
                await showAlert('Error creating Excel file: ' + exportResult.error, 'error');
            }
        } catch (error) {
            console.error('Excel export error:', error);
            await showAlert('Error creating Excel file: ' + error.message, 'error');
        }
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
            <div class="popup-header">
                <span class="popup-icon error">❌</span>
                <h3 class="popup-title">Process Cancelled</h3>
            </div>
            <div class="popup-body">
                <p class="popup-message">The AceNet check process has been cancelled successfully.</p>
            </div>
            <div class="popup-actions">
                <button id="closeCancellationBtn" class="popup-btn primary">OK</button>
            </div>
        </div>
    `;
    
    // No need for inline styles - using standardized CSS classes
    
    document.body.appendChild(popup);
    
    // Add event listener for OK button
    popup.querySelector('#closeCancellationBtn').addEventListener('click', () => {
        popup.remove();
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
    
    // Listen for update errors
    window.api.onUpdateError((error) => {
        console.error('Auto-update error:', error);
        showUpdateErrorNotification(error.message);
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

function showUpdateErrorNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'update-notification error';
    notification.innerHTML = `
        <div class="update-content">
            <h3>Update Error</h3>
            <p>${message}</p>
            <div class="update-buttons">
                <button id="dismissError">Dismiss</button>
            </div>
        </div>
    `;
    document.body.appendChild(notification);
    
    // Add event listener
    notification.querySelector('#dismissError').addEventListener('click', () => {
        notification.remove();
    });
    
    // Auto remove after 10 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 10000);
}

// Event listener for upload button
if (uploadPartNumberBtn) {
    uploadPartNumberBtn.addEventListener('click', () => {
        partNumberFileInput.click(); // Trigger file dialog
    });
}

// Event listener for part number file upload
if (partNumberFileInput) {
    partNumberFileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            try {
                // Show file upload modal
                showFileUploadModal();
                
                // Process the uploaded file to extract part numbers
                const result = await window.api.processPartNumberFile(file.path);
                
                if (result.success && result.partNumbers.length > 0) {
                    // Show success state with file information
                    setTimeout(() => {
                        showFileUploadSuccess(result.partNumbers.length, file.name);
                    }, 2500); // Wait for processing animation to complete
                    
                    // CLEAR ANY EXISTING DATA - Override previous suggested order or file results
                    orderTableBody.innerHTML = '';
                    suggestedOrderResults = {
                        orderData: [],
                        partNumbers: [],
                        hasResults: false
                    };
                    
                    console.log('Cleared existing order data - switching to uploaded file mode');
                    
                    // Create order data from part numbers
                    const orderData = result.partNumbers.map((partNumber, index) => ({
                        partNumber: partNumber,
                        sku: partNumber,
                        description: 'Uploaded Part Number',
                        currentStock: 0,
                        onOrder: 0,
                        suggestedQty: 1,
                        cost: 0,
                        minOrderQty: 1,
                        total: 0
                    }));
                    
                    // Update global storage with new data
                    suggestedOrderResults = {
                        orderData: orderData,
                        partNumbers: result.partNumbers,
                        hasResults: true,
                        source: 'uploaded_file' // Track the source
                    };
                    
                    // Populate the order table
                    populateOrderTable(orderData);
                    
                    // Show the order display section
                    orderDisplaySection.style.display = 'block';
                    
                    // CRITICAL: Add the 'active' class to make the panel visible
                    const suggestedOrderPanel = document.getElementById('suggestedOrderPanel');
                    if (suggestedOrderPanel) {
                        suggestedOrderPanel.classList.add('active');
                        console.log('Added active class to suggested order panel');
                    }
                    
                    // Scroll to the suggested order section to make it visible
                    setTimeout(() => {
                        orderDisplaySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                    
                    // Enable the Check AceNet button  
                    runCheckAceNetBtn.disabled = false;
                    
                                // CRITICAL: Handle input field locking specific to file uploads
            setTimeout(async () => {
                // Check if fields became locked after file processing
                const usernameField = document.getElementById('username');
                const passwordField = document.getElementById('password');
                
                if (usernameField && (usernameField.disabled || usernameField.readOnly || 
                    getComputedStyle(usernameField).pointerEvents === 'none')) {
                    console.log('Input fields locked after file upload - applying DevTools fix');
                    try {
                        // Single, clean DevTools toggle to unlock fields
                        await window.api.toggleDevTools();
                        console.log('DevTools toggle applied for file upload field unlock');
                    } catch (error) {
                        console.error('DevTools toggle failed:', error);
                        // Fallback to simple field unlock
                        [usernameField, passwordField].forEach(field => {
                            if (field) {
                                field.disabled = false;
                                field.readOnly = false;
                                field.style.pointerEvents = 'auto';
                            }
                        });
                    }
                } else {
                    console.log('Input fields remain accessible after file upload');
                }
            }, 500);
                    
                    // Success message is now handled by the modal
                    
                } else if (result.success && result.partNumbers.length === 0) {
                    hideFileUploadModal();
                    await showAlert('No part numbers found in the uploaded file. Please check the file format and content.', 'warning');
                } else {
                    hideFileUploadModal();
                    await showAlert('Failed to process file: ' + (result.error || 'Unknown error'), 'error');
                }
                
            } catch (error) {
                hideFileUploadModal();
                console.error('Error processing part number file:', error);
                await showAlert('Error processing file: ' + error.message, 'error');
            }
        }
    });
}

// File Upload Modal Functions
function showFileUploadModal() {
    const fileUploadModal = document.getElementById('fileUploadModal');
    if (fileUploadModal) {
        fileUploadModal.style.display = 'flex';
        
        // Reset to processing state
        const processingState = document.getElementById('fileUploadProcessingState');
        const successState = document.getElementById('fileUploadSuccessState');
        if (processingState && successState) {
            processingState.style.display = 'block';
            successState.style.display = 'none';
        }
        
        // Animate through processing steps
        animateFileUploadSteps();
    }
}

function hideFileUploadModal() {
    const fileUploadModal = document.getElementById('fileUploadModal');
    if (fileUploadModal) {
        fileUploadModal.style.display = 'none';
    }
}

function showFileUploadSuccess(partCount, fileName) {
    const processingState = document.getElementById('fileUploadProcessingState');
    const successState = document.getElementById('fileUploadSuccessState');
    
    if (processingState && successState) {
        processingState.style.display = 'none';
        successState.style.display = 'block';
        
        // Update success information
        const partCountElement = document.getElementById('uploadedPartCount');
        const fileNameElement = document.getElementById('uploadedFileName');
        
        if (partCountElement) partCountElement.textContent = partCount;
        if (fileNameElement) fileNameElement.textContent = fileName;
    }
}

function animateFileUploadSteps() {
    const steps = document.querySelectorAll('.file-upload-steps .processing-step');
    let currentStep = 0;
    
    const animateStep = () => {
        if (currentStep > 0) {
            steps[currentStep - 1].classList.remove('current');
            steps[currentStep - 1].classList.add('completed');
        }
        
        if (currentStep < steps.length) {
            steps[currentStep].classList.add('current');
            currentStep++;
            setTimeout(animateStep, 800); // 800ms between steps
        }
    };
    
    // Reset all steps
    steps.forEach(step => {
        step.classList.remove('current', 'completed');
    });
    
    // Start animation
    setTimeout(animateStep, 300);
}

// File Upload Modal Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Close file upload modal button
    const closeFileUploadBtn = document.getElementById('closeFileUploadBtn');
    if (closeFileUploadBtn) {
        closeFileUploadBtn.addEventListener('click', () => {
            hideFileUploadModal();
        });
    }
    
    // Run AceNet from upload button
    const runAceNetFromUploadBtn = document.getElementById('runAceNetFromUploadBtn');
    if (runAceNetFromUploadBtn) {
        runAceNetFromUploadBtn.addEventListener('click', () => {
            hideFileUploadModal();
            // Trigger the Check AceNet button
            const checkAceNetBtn = document.getElementById('runCheckAceNetBtn');
            if (checkAceNetBtn && !checkAceNetBtn.disabled) {
                checkAceNetBtn.click();
            }
        });
    }
});

// =================================================================
// STANDARDIZED POPUP HELPER FUNCTIONS
// =================================================================

// Show standardized alert popup
function showAlert(message, type = 'info', title = null) {
    return new Promise((resolve) => {
        const popup = document.createElement('div');
        popup.className = 'popup-overlay';
        
        const iconMap = {
            'info': '💡',
            'success': '✅', 
            'error': '❌',
            'warning': '⚠️'
        };
        
        const defaultTitles = {
            'info': 'Information',
            'success': 'Success',
            'error': 'Error', 
            'warning': 'Warning'
        };
        
        popup.innerHTML = `
            <div class="popup-content size-medium alert">
                <div class="popup-header">
                    <span class="popup-icon ${type}">${iconMap[type] || iconMap.info}</span>
                    <h3 class="popup-title">${title || defaultTitles[type] || defaultTitles.info}</h3>
                </div>
                <div class="popup-body">
                    <div class="popup-message" style="white-space: pre-line; text-align: center; font-family: inherit;">${message}</div>
                </div>
                <div class="popup-actions">
                    <button class="popup-btn primary" id="alertOkBtn">OK</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        popup.querySelector('#alertOkBtn').addEventListener('click', () => {
            popup.remove();
            resolve();
        });
        
        // Close on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                popup.remove();
                document.removeEventListener('keydown', handleEscape);
                resolve();
            }
        };
        document.addEventListener('keydown', handleEscape);
    });
}

// Show standardized confirm popup
function showConfirm(message, title = 'Confirm Action') {
    return new Promise((resolve) => {
        const popup = document.createElement('div');
        popup.className = 'popup-overlay';
        
        popup.innerHTML = `
            <div class="popup-content size-medium confirmation">
                <div class="popup-header">
                    <span class="popup-icon warning">❓</span>
                    <h3 class="popup-title">${title}</h3>
                </div>
                <div class="popup-body">
                    <div class="popup-message" style="white-space: pre-line; text-align: center; font-family: inherit;">${message}</div>
                </div>
                <div class="popup-actions">
                    <button class="popup-btn secondary" id="confirmCancelBtn">Cancel</button>
                    <button class="popup-btn primary" id="confirmOkBtn">OK</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        popup.querySelector('#confirmOkBtn').addEventListener('click', () => {
            popup.remove();
            resolve(true);
        });
        
        popup.querySelector('#confirmCancelBtn').addEventListener('click', () => {
            popup.remove();
            resolve(false);
        });
        
        // Close on escape key (defaults to cancel)
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                popup.remove();
                document.removeEventListener('keydown', handleEscape);
                resolve(false);
            }
        };
        document.addEventListener('keydown', handleEscape);
    });
}


