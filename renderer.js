// renderer.js - Frontend logic for the Electron app

// ============================================================================
// TAB NAVIGATION AND INTERFACE MANAGEMENT
// ============================================================================

// Tab management variables
let currentTab = null;

// Initialize the tabbed interface when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing interface...');
    initializeTabInterface();
    
    // Check for persistent inventory data
    setTimeout(() => {
        checkPersistentInventoryStatus();
    }, 1000); // Delay to ensure UI is ready
    
    // Load persistent order data
    setTimeout(() => {
        loadPersistentOrderData();
    }, 1500); // Load after inventory check
});

function initializeTabInterface() {
    // Get tab elements
    const orderTab = document.getElementById('orderTab');
    const outsTab = document.getElementById('outsTab');
    const reportsTab = document.getElementById('reportsTab');
 
    // Get content elements
    const welcomeScreen = document.getElementById('welcomeScreen');
    const orderContent = document.getElementById('orderContent');
    const outsContent = document.getElementById('outsContent');
    const reportsContent = document.getElementById('reportsContent');
    
    // Add event listeners for tabs
    if (orderTab) {
        orderTab.addEventListener('click', () => switchToTab('order'));
    }
    
    if (outsTab) {
        outsTab.addEventListener('click', () => switchToTab('outs'));
    }
    
    if (reportsTab) {
        reportsTab.addEventListener('click', () => switchToTab('reports'));
    }
    
    // Settings button removed - API functionality moved to Tools menu
    
    // Initialize phantom tab functionality
    initializePhantomTab();
    
    // Initialize learning insights functionality
    initializeLearningInsights();
    
    // Show welcome screen by default
    showWelcomeScreen();
}

async function switchToTab(tabName) {
    currentTab = tabName;
    
    // Get elements
    const welcomeScreen = document.getElementById('welcomeScreen');
    const orderContent = document.getElementById('orderContent');
    const outsContent = document.getElementById('outsContent');
    const reportsContent = document.getElementById('reportsContent'); // Added missing variable declaration
    const orderTab = document.getElementById('orderTab');
    const outsTab = document.getElementById('outsTab');
    const reportsTab = document.getElementById('reportsTab');
    
    // Hide all content
    if (welcomeScreen) welcomeScreen.style.display = 'none';
    if (orderContent) orderContent.style.display = 'none';
    if (outsContent) outsContent.style.display = 'none';
    if (reportsContent) reportsContent.style.display = 'none';
    
    // Remove active class from all tabs
    if (orderTab) orderTab.classList.remove('active');
    if (outsTab) outsTab.classList.remove('active');
    if (reportsTab) reportsTab.classList.remove('active');
    
    // Clean up phantom state if switching away from outs tab
    if (currentTab === 'outs' && tabName !== 'outs') {
        savePhantomInventoryState(); // Save current state before switching
    }

    // Show appropriate content and activate tab
    switch (tabName) {
        case 'order':
            if (orderContent) orderContent.style.display = 'flex';
            if (orderTab) orderTab.classList.add('active');
            console.log('Switched to Order tab');
            break;
        case 'outs':
            if (outsContent) outsContent.style.display = 'flex';
            if (outsTab) outsTab.classList.add('active');
            console.log('Switched to Outs tab');
            
            // Initialize phantom interface immediately, then restore state
            const phantomResults = document.getElementById('phantomResults');
            if (phantomResults) {
                // First ensure the unified interface exists
                if (!window.phantomInventoryState || !window.phantomInventoryState.interfaceHtml) {
                    console.log('No existing phantom interface, initializing fresh...');
                    await handleUnifiedPhantomWorkflow();
                } else {
                    console.log('Restoring existing phantom inventory state...');
                    await restorePhantomInventoryState();
                }
                
                // Force display the analysis view immediately if no other view is selected
                setTimeout(() => {
                    if (!window.phantomInventoryState.currentView || window.phantomInventoryState.currentView === 'analysis') {
                        const analysisView = document.getElementById('analysisView');
                        if (analysisView) {
                            analysisView.style.display = 'block';
                            // Ensure the analysis tab is active
                            const analysisTab = document.querySelector('[data-view="analysis"]');
                            if (analysisTab) {
                                analysisTab.classList.add('active');
                            }
                        }
                    }
                }, 50);
            } else {
                console.log('Phantom results container not found, skipping state restoration');
            }
            break;
        case 'reports':
            if (reportsContent) reportsContent.style.display = 'flex';
            if (reportsTab) reportsTab.classList.add('active');
            console.log('Switched to Reports tab');
            
            // Display learning insights when switching to reports tab
            setTimeout(() => {
                displayLearningInsights();
            }, 100);
            break;
        default:
            showWelcomeScreen();
            break;
    }
}

function showWelcomeScreen() {
    currentTab = null;
    
    // Get elements
    const welcomeScreen = document.getElementById('welcomeScreen');
    const orderContent = document.getElementById('orderContent');
    const outsContent = document.getElementById('outsContent');
    const orderTab = document.getElementById('orderTab');
    const outsTab = document.getElementById('outsTab');
    const reportsTab = document.getElementById('reportsTab');
    
    // Hide all tab content
    if (orderContent) orderContent.style.display = 'none';
    if (outsContent) outsContent.style.display = 'none';
    if (reportsContent) reportsContent.style.display = 'none';
    
    // Remove active class from all tabs
    if (orderTab) orderTab.classList.remove('active');
    if (outsTab) outsTab.classList.remove('active');
    if (reportsTab) reportsTab.classList.remove('active');
    
    // Show welcome screen
    if (welcomeScreen) welcomeScreen.style.display = 'flex';
    
    console.log('Showing welcome screen');
}

// Settings button removed - API configuration now only accessible through Tools menu

// ============================================================================
// LEARNING INSIGHTS FUNCTIONALITY
// ============================================================================

function initializeLearningInsights() {
    console.log('Initializing learning insights functionality...');
    
    // Initialize learning insights data store
    window.learningInsights = {
        lastAnalysis: null,
        seasonalIntelligence: null,
        trendAnalysis: null,
        dataQuality: null,
        forecastAccuracy: null,
        algorithmEvolution: null
    };
    
    // Load any stored learning data
    loadStoredLearningData();
}

function loadStoredLearningData() {
    try {
        // Try to load from localStorage or other persistent storage
        const storedData = localStorage.getItem('tinkLearningData');
        if (storedData) {
            window.learningInsights = JSON.parse(storedData);
            console.log('Loaded stored learning data');
        }
    } catch (error) {
        console.log('No stored learning data found, starting fresh');
    }
}

function updateLearningInsights(analysisData) {
    console.log('Updating learning insights with new analysis data...');
    
    if (!analysisData) return;
    
    // Extract learning insights from analysis data
    const insights = extractLearningInsights(analysisData);
    
    // Update the global learning insights object
    window.learningInsights = {
        ...window.learningInsights,
        ...insights,
        lastUpdated: new Date().toISOString()
    };
    
    // Save to persistent storage
    saveLearningData();
    
    // Update the display if we're on the reports tab
    if (currentTab === 'reports') {
        displayLearningInsights();
    }
}

function extractLearningInsights(analysisData) {
    const insights = {
        lastAnalysis: {
            date: new Date().toISOString(),
            itemsProcessed: analysisData.totalItems || 0,
            ordersGenerated: analysisData.orderCount || 0,
            totalRecommendations: analysisData.recommendationCount || 0
        }
    };
    
    // Extract seasonal intelligence data
    if (analysisData.seasonalSummary) {
        insights.seasonalIntelligence = {
            seasonalItems: analysisData.seasonalSummary.seasonalItemsDetected || 0,
            highVolatilityItems: analysisData.seasonalSummary.highVolatilityItems || 0,
            prePeakAdjustments: analysisData.seasonalSummary.prePeakAdjustments || 0,
            safetyStockApplications: analysisData.seasonalSummary.enhancedSafetyStock || 0,
            trendingUpItems: analysisData.seasonalSummary.trendingUpItems || 0,
            trendingDownItems: analysisData.seasonalSummary.trendingDownItems || 0
        };
    }
    
    // Extract trend analysis data
    if (analysisData.trendSummary) {
        insights.trendAnalysis = {
            decliningItems: analysisData.trendSummary.decliningItems || 0,
            sharpDeclineItems: analysisData.trendSummary.sharpRecentDecline || 0,
            historicalHighDeclines: analysisData.trendSummary.declinedFromHistoricalHighs || 0,
            trendAdjustments: analysisData.trendSummary.trendAdjustments || 0
        };
    }
    
    // Extract data quality insights
    if (analysisData.dataQualityIssues) {
        insights.dataQuality = {
            totalIssues: analysisData.dataQualityIssues.length || 0,
            correctionsApplied: analysisData.correctionsApplied || 0,
            issueTypes: analysisData.dataQualityIssues.map(issue => issue.issues).slice(0, 5)
        };
    }
    
    // Extract forecast accuracy data
    if (analysisData.forecastAccuracy) {
        insights.forecastAccuracy = {
            overallAccuracy: calculateOverallAccuracy(analysisData.forecastAccuracy) || 0,
            trendAdjustmentsCount: analysisData.trendAdjustmentsCount || 0,
            overstockPreventions: analysisData.overstockPreventionApplied || 0
        };
    }
    
    return insights;
}

function calculateOverallAccuracy(forecastData) {
    if (!forecastData || !Array.isArray(forecastData)) return 0;
    
    // Calculate accuracy based on trend-adjusted forecasts
    const trendAdjusted = forecastData.filter(item => item.trendAdjusted).length;
    const total = forecastData.length;
    
    return total > 0 ? Math.round((trendAdjusted / total) * 100) : 0;
}

function displayLearningInsights() {
    console.log('Displaying learning insights...');
    
    const insights = window.learningInsights;
    
    if (!insights) {
        displayEmptyLearningState();
        return;
    }
    
    // Update seasonal intelligence
    updateSeasonalIntelligenceDisplay(insights.seasonalIntelligence);
    
    // Update trend analysis
    updateTrendAnalysisDisplay(insights.trendAnalysis);
    
    // Update data quality
    updateDataQualityDisplay(insights.dataQuality);
    
    // Update forecast accuracy
    updateForecastAccuracyDisplay(insights.forecastAccuracy);
    
    // Update manager feedback
    updateManagerFeedbackDisplay();
    
    // Update last analysis summary
    updateLastAnalysisSummary(insights.lastAnalysis);
    
    // Update learning highlights
    updateLearningHighlights(insights);
}

function updateSeasonalIntelligenceDisplay(seasonalData) {
    if (!seasonalData) return;
    
    const elements = {
        seasonalItemsCount: document.getElementById('seasonalItemsCount'),
        highVolatilityCount: document.getElementById('highVolatilityCount'),
        prePeakAdjustments: document.getElementById('prePeakAdjustments'),
        safetyStockApplications: document.getElementById('safetyStockApplications')
    };
    
    if (elements.seasonalItemsCount) elements.seasonalItemsCount.textContent = seasonalData.seasonalItems || 0;
    if (elements.highVolatilityCount) elements.highVolatilityCount.textContent = seasonalData.highVolatilityItems || 0;
    if (elements.prePeakAdjustments) elements.prePeakAdjustments.textContent = seasonalData.prePeakAdjustments || 0;
    if (elements.safetyStockApplications) elements.safetyStockApplications.textContent = seasonalData.safetyStockApplications || 0;
}

function updateTrendAnalysisDisplay(trendData) {
    if (!trendData) return;
    
    const elements = {
        trendingUpCount: document.getElementById('trendingUpCount'),
        trendingDownCount: document.getElementById('trendingDownCount'),
        decliningCount: document.getElementById('decliningCount')
    };
    
    // Use seasonal data for trending up/down if available
    const seasonalData = window.learningInsights?.seasonalIntelligence;
    
    if (elements.trendingUpCount) elements.trendingUpCount.textContent = seasonalData?.trendingUpItems || 0;
    if (elements.trendingDownCount) elements.trendingDownCount.textContent = seasonalData?.trendingDownItems || 0;
    if (elements.decliningCount) elements.decliningCount.textContent = trendData.decliningItems || 0;
}

function updateDataQualityDisplay(qualityData) {
    if (!qualityData) return;
    
    const elements = {
        dataIssuesCount: document.getElementById('dataIssuesCount'),
        correctionsApplied: document.getElementById('correctionsApplied'),
        qualityImprovements: document.getElementById('qualityImprovements')
    };
    
    if (elements.dataIssuesCount) elements.dataIssuesCount.textContent = qualityData.totalIssues || 0;
    if (elements.correctionsApplied) elements.correctionsApplied.textContent = qualityData.correctionsApplied || 0;
    
    // Display quality improvements
    if (elements.qualityImprovements && qualityData.issueTypes) {
        const improvementsHtml = qualityData.issueTypes.slice(0, 3).map(issue => 
            `<div class="quality-improvement-item">• Detected and handled: ${issue}</div>`
        ).join('');
        elements.qualityImprovements.innerHTML = improvementsHtml || '<div class="quality-improvement-item">• No specific quality issues detected</div>';
    }
}

function updateForecastAccuracyDisplay(accuracyData) {
    if (!accuracyData) return;
    
    const elements = {
        overallAccuracy: document.getElementById('overallAccuracy'),
        trendAdjustmentsCount: document.getElementById('trendAdjustmentsCount'),
        overstockPreventions: document.getElementById('overstockPreventions')
    };
    
    if (elements.overallAccuracy) elements.overallAccuracy.textContent = `${accuracyData.overallAccuracy || 0}%`;
    if (elements.trendAdjustmentsCount) elements.trendAdjustmentsCount.textContent = accuracyData.trendAdjustmentsCount || 0;
    if (elements.overstockPreventions) elements.overstockPreventions.textContent = accuracyData.overstockPreventions || 0;
}

async function updateManagerFeedbackDisplay() {
    try {
        // Get feedback data from localStorage and main process
        const localFeedback = JSON.parse(localStorage.getItem('tinkFeedbackData') || '[]');
        let allFeedback = localFeedback;
        
        // Try to get additional feedback from main process
        if (window.electronAPI && window.electronAPI.invoke) {
            try {
                const result = await window.electronAPI.invoke('get-feedback-data');
                if (result.success && result.data) {
                    allFeedback = [...localFeedback, ...result.data];
                }
            } catch (error) {
                console.warn('Could not fetch feedback from main process:', error);
            }
        }
        
        // Remove duplicates based on timestamp and SKU
        const uniqueFeedback = allFeedback.filter((feedback, index, self) => 
            index === self.findIndex(f => f.timestamp === feedback.timestamp && f.sku === feedback.sku)
        );
        
        // Calculate metrics
        const totalFeedback = uniqueFeedback.length;
        const notNeededCount = uniqueFeedback.filter(f => f.feedbackType === 'not-needed').length;
        const tooMuchCount = uniqueFeedback.filter(f => f.feedbackType === 'too-much').length;
        const notEnoughCount = uniqueFeedback.filter(f => f.feedbackType === 'not-enough').length;
        const improvementCount = uniqueFeedback.filter(f => f.managerRecommendation && f.managerRecommendation !== f.tinkRecommendation).length;
        
        // Update display elements
        const elements = {
            'totalFeedbackCount': totalFeedback,
            'improvementCount': improvementCount,
            'notNeededCount': notNeededCount,
            'tooMuchCount': tooMuchCount,
            'notEnoughCount': notEnoughCount
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
        
        // Generate insights
        updateFeedbackInsights(uniqueFeedback);
        
    } catch (error) {
        console.error('Error updating manager feedback display:', error);
        
        // Set default values on error
        const defaultElements = ['totalFeedbackCount', 'improvementCount', 'notNeededCount', 'tooMuchCount', 'notEnoughCount'];
        defaultElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = '0';
            }
        });
    }
}

function updateFeedbackInsights(feedbackData) {
    const insightsContainer = document.getElementById('feedbackInsights');
    if (!insightsContainer || feedbackData.length === 0) {
        if (insightsContainer) {
            insightsContainer.innerHTML = `
                <div class="insight-item">
                    <span class="insight-icon">💡</span>
                    <span class="insight-text">No feedback received yet. Use the WTF button on suggested orders to provide feedback.</span>
                </div>
            `;
        }
        return;
    }
    
    const insights = [];
    
    // Calculate average adjustment percentages
    const adjustments = feedbackData
        .filter(f => f.managerRecommendation && f.tinkRecommendation)
        .map(f => {
            const tink = parseInt(f.tinkRecommendation) || 0;
            const manager = parseInt(f.managerRecommendation) || 0;
            return { tink, manager, diff: manager - tink, percentage: tink > 0 ? ((manager - tink) / tink) * 100 : 0 };
        });
    
    if (adjustments.length > 0) {
        const avgAdjustment = adjustments.reduce((sum, adj) => sum + adj.percentage, 0) / adjustments.length;
        if (Math.abs(avgAdjustment) > 5) {
            insights.push({
                icon: avgAdjustment > 0 ? '📈' : '📉',
                text: `Managers typically adjust recommendations ${Math.abs(avgAdjustment).toFixed(1)}% ${avgAdjustment > 0 ? 'upward' : 'downward'}`
            });
        }
    }
    
    // Most common feedback type
    const feedbackTypes = {
        'not-needed': feedbackData.filter(f => f.feedbackType === 'not-needed').length,
        'too-much': feedbackData.filter(f => f.feedbackType === 'too-much').length,
        'not-enough': feedbackData.filter(f => f.feedbackType === 'not-enough').length
    };
    
    const mostCommon = Object.entries(feedbackTypes).reduce((a, b) => feedbackTypes[a[0]] > feedbackTypes[b[0]] ? a : b);
    if (mostCommon[1] > 0) {
        const typeLabels = {
            'not-needed': 'items marked as not needed',
            'too-much': 'quantities reduced by managers',
            'not-enough': 'quantities increased by managers'
        };
        insights.push({
            icon: '🎯',
            text: `Most common feedback: ${typeLabels[mostCommon[0]]} (${mostCommon[1]} cases)`
        });
    }
    
    // Recent feedback trend
    const recentFeedback = feedbackData.filter(f => {
        const feedbackDate = new Date(f.timestamp);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return feedbackDate > weekAgo;
    });
    
    if (recentFeedback.length > 0) {
        insights.push({
            icon: '⏰',
            text: `${recentFeedback.length} feedback submissions in the last 7 days`
        });
    }
    
    // Render insights
    insightsContainer.innerHTML = insights.map(insight => `
        <div class="insight-item">
            <span class="insight-icon">${insight.icon}</span>
            <span class="insight-text">${insight.text}</span>
        </div>
    `).join('') || `
        <div class="insight-item">
            <span class="insight-icon">📊</span>
            <span class="insight-text">Feedback analysis will appear here as more data is collected</span>
        </div>
    `;
}

function updateLastAnalysisSummary(analysisData) {
    if (!analysisData) return;
    
    const elements = {
        lastAnalysisDate: document.getElementById('lastAnalysisDate'),
        itemsProcessed: document.getElementById('itemsProcessed'),
        ordersGenerated: document.getElementById('ordersGenerated'),
        totalRecommendations: document.getElementById('totalRecommendations')
    };
    
    if (elements.lastAnalysisDate && analysisData.date) {
        const date = new Date(analysisData.date);
        elements.lastAnalysisDate.textContent = date.toLocaleString();
    }
    
    if (elements.itemsProcessed) elements.itemsProcessed.textContent = analysisData.itemsProcessed || 0;
    if (elements.ordersGenerated) elements.ordersGenerated.textContent = analysisData.ordersGenerated || 0;
    if (elements.totalRecommendations) elements.totalRecommendations.textContent = analysisData.totalRecommendations || 0;
}

function updateLearningHighlights(insights) {
    const highlightsList = document.getElementById('learningHighlights');
    if (!highlightsList) return;
    
    const highlights = generateLearningHighlights(insights);
    
    const highlightsHtml = highlights.map(highlight => `
        <div class="highlight-item">
            <span class="highlight-icon">${highlight.icon}</span>
            <span class="highlight-text">${highlight.text}</span>
        </div>
    `).join('');
    
    highlightsList.innerHTML = highlightsHtml || '<div class="highlight-item"><span class="highlight-icon">📊</span><span class="highlight-text">Run an analysis to see learning highlights</span></div>';
}

function generateLearningHighlights(insights) {
    const highlights = [];
    
    // Seasonal intelligence highlights
    if (insights.seasonalIntelligence?.seasonalItems > 0) {
        highlights.push({
            icon: '🌟',
            text: `Identified ${insights.seasonalIntelligence.seasonalItems} seasonal items for better inventory planning`
        });
    }
    
    if (insights.seasonalIntelligence?.safetyStockApplications > 1000) {
        highlights.push({
            icon: '🛡️',
            text: `Applied enhanced safety stock to ${insights.seasonalIntelligence.safetyStockApplications} items`
        });
    }
    
    // Trend analysis highlights
    if (insights.trendAnalysis?.trendAdjustments > 100) {
        highlights.push({
            icon: '📈',
            text: `Made ${insights.trendAnalysis.trendAdjustments} trend-based forecast adjustments`
        });
    }
    
    // Data quality highlights
    if (insights.dataQuality?.correctionsApplied > 0) {
        highlights.push({
            icon: '🔧',
            text: `Automatically corrected ${insights.dataQuality.correctionsApplied} data quality issues`
        });
    }
    
    // Forecast accuracy highlights
    if (insights.forecastAccuracy?.overstockPreventions > 1000) {
        highlights.push({
            icon: '💰',
            text: `Prevented overstock situations ${insights.forecastAccuracy.overstockPreventions} times`
        });
    }
    
    return highlights.slice(0, 5); // Limit to 5 highlights
}

function displayEmptyLearningState() {
    console.log('Displaying empty learning state...');
    
    // Set all counters to 0 or empty state
    const elements = [
        'seasonalItemsCount', 'highVolatilityCount', 'prePeakAdjustments', 'safetyStockApplications',
        'trendingUpCount', 'trendingDownCount', 'decliningCount',
        'dataIssuesCount', 'correctionsApplied', 
        'overallAccuracy', 'trendAdjustmentsCount', 'overstockPreventions',
        'lastAnalysisDate', 'itemsProcessed', 'ordersGenerated', 'totalRecommendations'
    ];
    
    elements.forEach(elementId => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = elementId === 'overallAccuracy' ? '0%' : 
                                  elementId === 'lastAnalysisDate' ? 'Never' : '0';
        }
    });
    
    // Show empty state message in highlights
    const highlightsList = document.getElementById('learningHighlights');
    if (highlightsList) {
        highlightsList.innerHTML = `
            <div class="highlight-item">
                <span class="highlight-icon">🎯</span>
                <span class="highlight-text">Run an inventory analysis to see what Tink learns from your data</span>
            </div>
            <div class="highlight-item">
                <span class="highlight-icon">📊</span>
                <span class="highlight-text">Each analysis improves Tink's understanding of your inventory patterns</span>
            </div>
            <div class="highlight-item">
                <span class="highlight-icon">🧠</span>
                <span class="highlight-text">Machine learning insights will appear here after your first analysis</span>
            </div>
        `;
    }
}

function saveLearningData() {
    try {
        localStorage.setItem('tinkLearningData', JSON.stringify(window.learningInsights));
        console.log('Learning data saved to localStorage');
    } catch (error) {
        console.warn('Failed to save learning data:', error);
    }
}

// ============================================================================
// PHANTOM INVENTORY TAB FUNCTIONALITY
// ============================================================================

function initializePhantomTab() {
    // Initialize phantom inventory controls
    const runPhantomBtn = document.getElementById('runPhantomInventoryBtn');
    const verifySelectedBtn = document.getElementById('verifySelectedBtn');
    const exportPhantomResultsBtn = document.getElementById('exportPhantomResultsBtn');
    const selectAllPhantoms = document.getElementById('selectAllPhantoms');
    const startWorkflowBtn = document.getElementById('startPhantomWorkflowBtn');
    const phantomFileInput = document.getElementById('phantomFileInput');
    
    // Initialize phantom inventory state management
    window.phantomInventoryState = {
        currentView: 'setup', // setup, analysis, verification, validation
        analysisResults: null,
        verificationData: null,
        validationData: null,
        reportsData: null,
        isInitialized: false,
        currentStore: null,
        lastAnalysisTime: null,
        interfaceHtml: null, // Store the current interface HTML
        hasData: false // Flag to track if we have any data to persist
    };
    
    // Connect the new welcome screen button to the unified workflow
    if (startWorkflowBtn) {
        startWorkflowBtn.addEventListener('click', async () => {
            console.log('Start phantom workflow button clicked - running unified workflow...');
            await handleUnifiedPhantomWorkflow();
        });
    }
    
    if (runPhantomBtn) {
        runPhantomBtn.addEventListener('click', async () => {
            console.log('Phantom inventory button clicked - running unified workflow...');
            await handleUnifiedPhantomWorkflow();
        });
    }
    
    if (verifySelectedBtn) {
        verifySelectedBtn.addEventListener('click', handleVerifySelected);
    }
    
    if (exportPhantomResultsBtn) {
        exportPhantomResultsBtn.addEventListener('click', handleExportPhantomResults);
    }
    
    if (selectAllPhantoms) {
        selectAllPhantoms.addEventListener('change', handleSelectAllPhantoms);
    }
    
    // Initialize file input handler
    if (phantomFileInput) {
        phantomFileInput.addEventListener('change', handlePhantomFileSelection);
    }
    
    // Initialize phantom system setup controls
    initializePhantomSystemSetup();
}

function initializePhantomSystemSetup() {
    const initializeBtn = document.getElementById('initializePhantomBtn');
    const storeSelect = document.getElementById('phantomStoreSelect');
    const systemInfoBtn = document.getElementById('phantomSystemInfoBtn');
    
    if (initializeBtn) {
        initializeBtn.addEventListener('click', handlePhantomSystemInitialization);
    }
    
    if (storeSelect) {
        storeSelect.addEventListener('change', (e) => {
            if (initializeBtn) {
                initializeBtn.disabled = !e.target.value;
            }
        });
    }
    
    if (systemInfoBtn) {
        systemInfoBtn.addEventListener('click', showPhantomSystemInfo);
    }
    
    // Check phantom system status when tab initializes
    checkPhantomSystemStatus();
}

// ============================================================================
// PHANTOM INVENTORY DATA PERSISTENCE
// ============================================================================

async function restorePhantomInventoryState() {
    console.log('Restoring phantom inventory state...');
    
    // Only restore if we're currently on the outs tab
    if (currentTab !== 'outs') {
        console.log('Not on outs tab, skipping phantom state restoration');
        return;
    }
    
    // Check if we have existing data to restore
    if (window.phantomInventoryState && window.phantomInventoryState.hasData) {
        console.log('Found existing phantom inventory data, restoring...');
        
        // Check if the phantom interface already exists
        const existingInterface = document.querySelector('.phantom-unified-container');
        if (!existingInterface) {
            console.log('No existing interface found, creating fresh interface...');
            showUnifiedPhantomInterface();
        } else {
            console.log('Existing interface found, reusing it...');
        }
        
        // Use setTimeout to ensure DOM is ready before switching views
        setTimeout(() => {
            // Restore the current view
            const viewToRestore = window.phantomInventoryState.currentView || 'analysis';
            console.log('Restoring view:', viewToRestore);
            
            // Ensure the view content is properly displayed
            document.querySelectorAll('.phantom-view-content').forEach(view => {
                view.style.display = 'none';
            });
            
            const targetView = document.getElementById(viewToRestore + 'View');
            if (targetView) {
                targetView.style.display = 'block';
                console.log('Successfully displayed view:', viewToRestore);
            }
            
            // Update tab buttons
            document.querySelectorAll('.phantom-tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            const activeTab = document.querySelector(`[data-view="${viewToRestore}"]`);
            if (activeTab) {
                activeTab.classList.add('active');
            }
            
            // Update state
            window.phantomInventoryState.currentView = viewToRestore;
        }, 50); // Reduced timeout for faster response
        
        console.log('Successfully restored phantom inventory state');
        return;
    }
    
    // No existing data, initialize fresh
    console.log('No existing phantom inventory data found, initializing fresh...');
    await handleUnifiedPhantomWorkflow();
}

function savePhantomInventoryState() {
    console.log('Saving phantom inventory state...');
    
    if (!window.phantomInventoryState) {
        window.phantomInventoryState = {};
    }
    
    // Save the current interface HTML
    const phantomResults = document.getElementById('phantomResults');
    if (phantomResults && phantomResults.innerHTML.trim()) {
        window.phantomInventoryState.interfaceHtml = phantomResults.innerHTML;
        window.phantomInventoryState.hasData = true;
        console.log('Saved phantom inventory interface HTML');
    }
}

// ============================================================================
// UNIFIED PHANTOM INVENTORY WORKFLOW
// ============================================================================

async function handleUnifiedPhantomWorkflow() {
    console.log('Starting unified phantom inventory workflow...');
    
    try {
        // Try to get the current store from various possible sources
        const storeSelectElement = document.getElementById('storeSelect');
        let currentStore = null;
        
        // Check if we have a store in the phantom state
        if (window.phantomInventoryState.currentStore && window.phantomInventoryState.currentStore.id) {
            currentStore = window.phantomInventoryState.currentStore.id;
        } else if (storeSelectElement && storeSelectElement.value) {
            currentStore = storeSelectElement.value;
        } else {
            // Try to load preferred store first, otherwise use default
            const preferredStore = loadPreferredPhantomStore();
            currentStore = preferredStore || '16719'; // Default to first store
            console.log('No store specified, defaulting to:', currentStore, preferredStore ? '(from saved preference)' : '(system default)');
            
            // Set the default store in the phantom state
            window.phantomInventoryState.currentStore = {
                id: currentStore,
                displayName: getStoreDisplayName(currentStore)
            };
        }
        
        // Initialize phantom system if not already initialized
        await initializePhantomSystemForStore(currentStore);
        
        // Show the unified phantom interface
        showUnifiedPhantomInterface();
        
        // Check system status and proceed accordingly
        await checkPhantomSystemAndProceed();
        
    } catch (error) {
        console.error('Error in unified phantom workflow:', error);
        await showAlert('Error starting phantom inventory workflow: ' + error.message, 'error');
    }
}

async function initializePhantomSystemForStore(storeId) {
    console.log('Initializing phantom system for store:', storeId);
    
    try {
        // Check current status first
        const statusCheck = await window.electronAPI.invoke('phantom-get-status');
        
        if (statusCheck.success && statusCheck.data.isInitialized && 
            statusCheck.data.currentStore && statusCheck.data.currentStore.id === storeId) {
            console.log('Phantom system already initialized for this store');
            window.phantomInventoryState.isInitialized = true;
            window.phantomInventoryState.currentStore = statusCheck.data.currentStore;
            return true;
        }
        
        // If system is set up but not initialized, try force initialization first
        if (statusCheck.success && statusCheck.data.isSetup && !statusCheck.data.isInitialized) {
            console.log('Phantom system is set up but not initialized, trying force initialization...');
            const forceInitResult = await window.electronAPI.invoke('phantom-force-initialize');
            
            if (forceInitResult.success) {
                console.log('Phantom system force initialized successfully');
                window.phantomInventoryState.isInitialized = true;
                window.phantomInventoryState.currentStore = statusCheck.data.currentStore;
                return true;
            }
        }
        
        // Initialize the phantom system for the selected store
        console.log('Completing phantom setup for store:', storeId);
        const initResult = await window.electronAPI.invoke('phantom-complete-setup', storeId);
        
        if (initResult.success) {
            console.log('Phantom system setup completed successfully');
            window.phantomInventoryState.isInitialized = true;
            window.phantomInventoryState.currentStore = { id: storeId, displayName: `Store ${storeId}` };
            return true;
        } else {
            throw new Error(initResult.error || 'Failed to initialize phantom system');
        }
        
    } catch (error) {
        console.error('Error initializing phantom system:', error);
        await showAlert('Failed to initialize phantom system: ' + error.message, 'error');
        return false;
    }
}

function showUnifiedPhantomInterface() {
    console.log('Showing unified phantom interface...');
    
    const phantomResults = document.getElementById('phantomResults');
    const phantomPlaceholder = document.getElementById('phantomPlaceholder');
    const phantomWelcome = document.getElementById('phantomWelcome');
    
    if (!phantomResults) {
        console.error('Phantom results container not found');
        return;
    }
    
    // Hide the old placeholder if it exists
    if (phantomPlaceholder) {
        phantomPlaceholder.style.display = 'none';
        console.log('Hidden phantom placeholder');
    }
    
    // Hide the welcome screen if it exists
    if (phantomWelcome) {
        phantomWelcome.style.display = 'none';
        console.log('Hidden phantom welcome screen');
    }
    
    // Show the phantom results container
    phantomResults.style.display = 'block';
    
    // Create the unified interface
    const unifiedInterface = createUnifiedPhantomInterface();
    phantomResults.innerHTML = unifiedInterface;
    
    // Initialize the interface interactions
    initializeUnifiedPhantomInteractions();
    
    // Setup store preference functionality
    setTimeout(() => {
        setupPhantomStorePreference();
    }, 100); // Small delay to ensure DOM elements are ready
    
    // Save the initial interface state
    savePhantomInventoryState();
    
    console.log('Unified phantom interface displayed successfully');
}

// ============================================================================
// FILE HANDLING FUNCTIONS
// ============================================================================

function handlePhantomFileSelection(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('Phantom file selected:', file.name);
    
    // Update file info in settings panel if visible
    const fileNameSpan = document.getElementById('phantomFileName');
    const fileSizeSpan = document.getElementById('phantomFileSize');
    const fileInfoDiv = document.getElementById('phantomFileInfo');
    
    if (fileNameSpan) fileNameSpan.textContent = file.name;
    if (fileSizeSpan) fileSizeSpan.textContent = formatFileSize(file.size);
    if (fileInfoDiv) fileInfoDiv.style.display = 'block';
    
    // Store file info globally
    window.phantomInventoryState.selectedFile = {
        name: file.name,
        size: file.size,
        path: file.path
    };
    
    showAlert(`Inventory file "${file.name}" selected successfully. You can now run the phantom analysis.`, 'success');
}

function createUnifiedPhantomInterface() {
    return `
        <div class="phantom-unified-container">
            <!-- Header with navigation tabs -->
            <div class="phantom-nav-tabs">
                <button class="phantom-tab-btn active" data-view="analysis" onclick="switchPhantomView('analysis')">
                    <span class="tab-icon">🔍</span> Analysis
                </button>
                <button class="phantom-tab-btn" data-view="verification" onclick="switchPhantomView('verification')">
                    <span class="tab-icon">📋</span> Verification
                </button>
                <button class="phantom-tab-btn" data-view="validation" onclick="switchPhantomView('validation')">
                    <span class="tab-icon">✅</span> Validation
                </button>
            </div>
            
            <!-- Consolidated Status and Action Bar -->
            <div class="phantom-status-bar">
                <div class="phantom-status-left">
                    <div class="status-indicator">
                        <span class="status-light status-ready"></span>
                        <span class="status-text">System Ready</span>
                    </div>
                    <div class="store-selector-main">
                        Store: 
                        <select id="phantomStoreSelect" class="store-dropdown" onchange="changePhantomStore(this.value)">
                            <option value="16719">16719 - Fairview</option>
                            <option value="17521">17521 - Eagle</option>
                            <option value="18179">18179 - Broadway</option>
                            <option value="18181">18181 - State</option>
                        </select>
                        <div class="remember-store-container">
                            <label class="checkbox-label remember-store-label">
                                <input type="checkbox" id="rememberPhantomStore" />
                                <span class="checkmark"></span>
                                Remember Store
                            </label>
                        </div>
                    </div>
                    <div class="last-analysis">
                        Last Analysis: <span id="lastAnalysisTime">Never</span>
                    </div>
                </div>
                <div class="phantom-status-right">
                    <div class="phantom-action-buttons">
                        <!-- Analysis Actions -->
                        <button class="btn btn-primary phantom-action-btn" id="runAnalysisBtn" onclick="runUnifiedPhantomAnalysis()" data-view="analysis">
                            <span class="btn-icon">🔍</span> Run Analysis
                        </button>
                        <button class="btn btn-secondary phantom-action-btn" id="refreshInventoryBtn" onclick="document.getElementById('phantomFileInput').click()" data-view="analysis">
                            <span class="btn-icon">🔄</span> Refresh Data
                        </button>
                        <button class="btn btn-warning phantom-action-btn" id="clearInventoryBtn" onclick="clearPersistentInventory()" data-view="analysis" style="display: none;">
                            <span class="btn-icon">🗑️</span> Clear Saved Data
                        </button>
                        
                        <!-- Verification Actions - REMOVED Generate button, users click sheet tabs directly -->
                        
                        <!-- Validation Actions -->
                        <button class="btn btn-success phantom-action-btn" id="finalizeValidationBtn" onclick="finalizeValidation()" data-view="validation" style="display: none;">
                            <span class="btn-icon">✅</span> Finalize Validation
                        </button>
                        

                    </div>
                </div>
            </div>
            
            <!-- Analysis View -->
            <div class="phantom-view-content" id="analysisView" style="display: block;">
                <div class="phantom-analysis-panel">
                    <div class="analysis-content" id="analysisContent">
                        <div class="analysis-placeholder">
                            <div class="placeholder-icon">👻</div>
                            <h4>Ready for Analysis</h4>
                            <p>Click "Run Analysis" to identify phantom inventory candidates.</p>
                            <div class="quick-start-actions">
                                <div class="file-input-wrapper">
                                    <input type="file" id="phantomFileInput" accept=".txt" style="display: none;" />
                                    <button class="btn btn-outline-secondary" onclick="document.getElementById('phantomFileInput').click()">
                                        <span class="btn-icon">📁</span> Import Inventory
                                    </button>
                                </div>
                                <div id="phantomFileInfo" class="file-info" style="display: none;">
                                    <small><strong>File:</strong> <span id="phantomFileName"></span> (<span id="phantomFileSize"></span>)</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Verification View -->
            <div class="phantom-view-content" id="verificationView" style="display: none;">
                <div class="phantom-verification-panel">
                    <div class="verification-content" id="verificationContent">
                        <div class="verification-placeholder">
                            <div class="placeholder-icon">📋</div>
                            <h4>Ready for Verification</h4>
                            <p id="verificationPlaceholderText">Run analysis first, then click on individual sheet tabs to generate PDFs for physical counting.</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Validation View -->
            <div class="phantom-view-content" id="validationView" style="display: none;">
                <div class="phantom-validation-panel">
                    <div class="validation-content" id="validationContent">
                        <div class="validation-placeholder">
                            <div class="placeholder-icon">✅</div>
                            <h4>Validation Center</h4>
                            <p>Review and validate the active verification sheet results. Enter actual counts to complete the validation process.</p>
                            <div class="quick-start-actions" style="margin-top: 30px;">
                                <button class="btn btn-primary" onclick="switchPhantomView('verification')">
                                    <span class="btn-icon">📋</span> Go to Verification
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            

        </div>
    `;
}

function initializeUnifiedPhantomInteractions() {
    console.log('Initializing unified phantom interactions...');
    
    // Update current store display
    updatePhantomStoreDisplay();
    
    // Initialize view switching
    window.switchPhantomView = switchPhantomView;
    window.runUnifiedPhantomAnalysis = runUnifiedPhantomAnalysis;
    window.generateVerificationSheets = generateVerificationSheets;
    window.printVerificationSheets = printVerificationSheets;



    window.refreshInventoryData = refreshInventoryData;
    
    // Initialize phantom file input handler for the dynamically created elements
    initializePhantomFileInputHandler();
    
    // Initialize store change function
    window.changePhantomStore = changePhantomStore;
}

function switchPhantomView(viewName) {
    console.log('Switching to phantom view:', viewName);
    
    // CLEAR ALL DATASET TABLES FROM ALL VIEWS FIRST
    clearAllDatasetTables();
    
    // Update tab buttons
    document.querySelectorAll('.phantom-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
    
    // Update view content
    document.querySelectorAll('.phantom-view-content').forEach(view => {
        view.style.display = 'none';
    });
    document.getElementById(viewName + 'View').style.display = 'block';
    
    // Update action button visibility
    document.querySelectorAll('.phantom-action-btn').forEach(btn => {
        btn.style.display = 'none';
    });
    document.querySelectorAll(`[data-view="${viewName}"]`).forEach(btn => {
        if (btn.classList.contains('phantom-action-btn')) {
            btn.style.display = 'flex';
        }
    });
    
    // Update state BEFORE handling view switch
    window.phantomInventoryState.currentView = viewName;
    
    // Handle view-specific logic and data persistence
    handlePhantomViewSwitch(viewName);
    
    // Save the updated state for persistence
    savePhantomInventoryState();
}

// Function to clear all dataset tables from all views
function clearAllDatasetTables() {
    console.log('Clearing all dataset tables from all views');
    
    // Clear from all possible containers
    const containers = [
        'analysisContent',
        'verificationContent', 
        'validationContent',
        'reportsContent',
        'phantomResults'
    ];
    
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            // Remove all dataset tables
            const tables = container.querySelectorAll('.order-table-container, .phantom-table, .order-table');
            tables.forEach(table => {
                if (table.closest('.verification-detailed-items')) {
                    // Keep verification tables that are in the detailed items section
                    return;
                }
                console.log(`Removing dataset table from ${containerId}`);
                table.remove();
            });
        }
    });
}

// Handle view-specific logic when switching phantom tabs
function handlePhantomViewSwitch(viewName) {
    console.log('Handling phantom view switch to:', viewName);
    
    switch (viewName) {
        case 'analysis':
            // Ensure analysis view is properly displayed
            setTimeout(() => {
                // ONLY restore analysis results if we're on the analysis tab
                if (window.phantomInventoryState.analysisResults) {
                    displayUnifiedPhantomResults(window.phantomInventoryState.analysisResults);
                }
                // Ensure file input is visible
                const fileInput = document.getElementById('phantomFileInput');
                const fileInfo = document.getElementById('phantomFileInfo');
                if (fileInput) fileInput.style.display = 'none';
                if (fileInfo && window.phantomInventoryState.lastImportedFile) {
                    fileInfo.style.display = 'block';
                    document.getElementById('phantomFileName').textContent = window.phantomInventoryState.lastImportedFile.name;
                    document.getElementById('phantomFileSize').textContent = window.phantomInventoryState.lastImportedFile.size;
                }
            }, 100);
            break;
            
        case 'verification':
            // Update verification placeholder with dynamic content
            updateVerificationPlaceholder();
            
            // Check if we have analysis data to work with
            if (window.phantomInventoryState.analysisResults && 
                window.phantomInventoryState.analysisResults.phantomCandidates &&
                window.phantomInventoryState.analysisResults.phantomCandidates.length > 0) {
                
                // Display available candidate count for verification
                displayVerificationPreview(window.phantomInventoryState.analysisResults.phantomCandidates);
                
                // If we already have generated verification data, show it
                if (window.phantomInventoryState.verificationData) {
                    displayVerificationSheets(window.phantomInventoryState.verificationData);
                }
            }
            break;
            
        case 'validation':
            // Update validation interface based on available data
            updateValidationInterface();
            break;
            

    }
}

// Update verification placeholder with dynamic content
function updateVerificationPlaceholder() {
    const placeholderText = document.getElementById('verificationPlaceholderText');
    const placeholderBtn = document.getElementById('generateVerificationPlaceholderBtn');
    
    if (window.phantomInventoryState.analysisResults && 
        window.phantomInventoryState.analysisResults.phantomCandidates &&
        window.phantomInventoryState.analysisResults.phantomCandidates.length > 0) {
        
        const candidateCount = window.phantomInventoryState.analysisResults.phantomCandidates.length;
        if (placeholderText) {
            placeholderText.innerHTML = `Analysis found <strong>${candidateCount} phantom candidates</strong> ready for physical verification.`;
        }
        if (placeholderBtn) {
            placeholderBtn.disabled = false;
        }
    } else {
        if (placeholderText) {
            placeholderText.textContent = 'Run analysis first to generate verification sheets for physical counting.';
        }
        if (placeholderBtn) {
            placeholderBtn.disabled = true;
        }
    }
}

// Update validation interface based on available data
function updateValidationInterface() {
    if (window.phantomInventoryState.verificationData || 
        (window.phantomInventoryState.analysisResults && 
         window.phantomInventoryState.analysisResults.phantomCandidates &&
         window.phantomInventoryState.analysisResults.phantomCandidates.length > 0)) {
        displayValidationInterface();
    } else {
        // Show placeholder when no data is available
        const validationContent = document.getElementById('validationContent');
        if (validationContent) {
            // Keep the placeholder from createUnifiedPhantomInterface - it's already appropriate
        }
    }
}



// Display verification preview showing available candidates
function displayVerificationPreview(phantomCandidates) {
    const verificationContent = document.getElementById('verificationContent');
    if (!verificationContent) return;
    
    const candidateCount = phantomCandidates.length;
    const highRisk = phantomCandidates.filter(item => (item.riskScore || 0) > 70).length;
    const mediumRisk = phantomCandidates.filter(item => (item.riskScore || 0) > 40 && (item.riskScore || 0) <= 70).length;
    const lowRisk = phantomCandidates.filter(item => (item.riskScore || 0) <= 40).length;
    
    verificationContent.innerHTML = `
        <div class="verification-preview">
            <div class="verification-preview-header">
                <div class="placeholder-icon">📋</div>
                <h4>Ready for Verification</h4>
                <p>Analysis found <strong>${candidateCount} phantom candidates</strong> ready for physical verification.</p>
            </div>
            
            <div class="verification-stats">
                <div class="stat-card high-risk">
                    <div class="stat-number">${highRisk}</div>
                    <div class="stat-label">High Risk</div>
                    <div class="stat-bar">
                        <div class="stat-fill" style="width: ${candidateCount > 0 ? (highRisk / candidateCount * 100) : 0}%"></div>
                    </div>
                </div>
                
                <div class="stat-card medium-risk">
                    <div class="stat-number">${mediumRisk}</div>
                    <div class="stat-label">Medium Risk</div>
                    <div class="stat-bar">
                        <div class="stat-fill" style="width: ${candidateCount > 0 ? (mediumRisk / candidateCount * 100) : 0}%"></div>
                    </div>
                </div>
                
                <div class="stat-card low-risk">
                    <div class="stat-number">${lowRisk}</div>
                    <div class="stat-label">Low Risk</div>
                    <div class="stat-bar">
                        <div class="stat-fill" style="width: ${candidateCount > 0 ? (lowRisk / candidateCount * 100) : 0}%"></div>
                    </div>
                </div>
            </div>
            
            <div class="verification-preview-actions">
                <button class="btn btn-secondary" onclick="switchPhantomView('analysis')">
                    <span class="btn-icon">🔙</span> Back to Analysis
                </button>
            </div>
            
            <div class="verification-preview-note">
                <p><strong>Note:</strong> Click on individual sheet tabs to generate PDFs for physical counting.</p>
            </div>
        </div>
    `;
}

// Display message when no analysis data is available
function displayNoAnalysisDataMessage(currentView) {
    const content = currentView === 'verification' ? 
        document.getElementById('verificationContent') : 
        document.getElementById('validationContent');
    
    if (!content) return;
    
    const viewName = currentView === 'verification' ? 'Verification' : 'Validation';
    const icon = currentView === 'verification' ? '📋' : '✅';
    
    content.innerHTML = `
        <div class="no-data-placeholder">
            <div class="placeholder-icon">${icon}</div>
            <h4>No Analysis Data Available</h4>
            <p>Please run phantom inventory analysis first to generate data for ${viewName.toLowerCase()}.</p>
            <div class="placeholder-actions">
                <button class="btn btn-primary" onclick="switchPhantomView('analysis')">
                    <span class="btn-icon">🔍</span> Go to Analysis
                </button>
            </div>
        </div>
    `;
}

// Display message when no verification data is available
function displayNoVerificationDataMessage() {
    const validationContent = document.getElementById('validationContent');
    if (!validationContent) return;
    
    validationContent.innerHTML = `
        <div class="no-data-placeholder">
            <div class="placeholder-icon">✅</div>
            <h4>No Verification Data</h4>
            <p>Please generate verification sheets first to enable validation functionality.</p>
            <div class="placeholder-actions">
                <button class="btn btn-primary" onclick="switchPhantomView('verification')">
                    <span class="btn-icon">📋</span> Go to Verification
                </button>
            </div>
        </div>
    `;
}



function updatePhantomStoreDisplay() {
    console.log('Updating phantom store display...');
    
    const currentStore = document.getElementById('phantomCurrentStore');
    if (currentStore && window.phantomInventoryState.currentStore) {
        currentStore.textContent = window.phantomInventoryState.currentStore.displayName || window.phantomInventoryState.currentStore.id;
    }
}

async function checkPhantomSystemAndProceed() {
    console.log('Checking phantom system status...');
    
    try {
        const statusCheck = await window.electronAPI.invoke('phantom-get-status');
        
        if (statusCheck.success && statusCheck.data.isInitialized) {
            console.log('Phantom system is ready');
            updatePhantomSystemStatus('ready', 'System Ready', statusCheck.data.currentStore?.displayName || 'Unknown');
            
            // Update store info
            if (statusCheck.data.currentStore) {
                window.phantomInventoryState.currentStore = statusCheck.data.currentStore;
                updatePhantomStoreDisplay();
            }
            
        } else {
            console.log('Phantom system needs initialization');
            updatePhantomSystemStatus('warning', 'System Initializing', 'Please wait...');
        }
        
    } catch (error) {
        console.error('Error checking phantom system:', error);
        updatePhantomSystemStatus('error', 'System Error', error.message);
    }
}

function updatePhantomSystemStatus(status, text, storeInfo) {
    const statusLight = document.querySelector('.status-light');
    const statusText = document.querySelector('.status-text');
    
    if (statusLight) {
        statusLight.className = `status-light status-${status}`;
    }
    
    if (statusText) {
        statusText.textContent = text;
    }
    
    if (storeInfo) {
        updatePhantomStoreDisplay();
    }
}

function handlePhantomDetection() {
    console.log('Running phantom detection...');
    
    // Get phantom detection settings
    const enableMLLearning = document.getElementById('enableMLLearning')?.checked || false;
    const enableNetworkSync = document.getElementById('enableNetworkSync')?.checked || false;
    const enableVerificationWorkflow = document.getElementById('enableVerificationWorkflow')?.checked || false;
    
    // Hide placeholder and show processing
    const phantomPlaceholder = document.getElementById('phantomPlaceholder');
    const phantomResults = document.getElementById('phantomResults');
    
    if (phantomPlaceholder) phantomPlaceholder.style.display = 'none';
    
    // Show phantom inventory processing modal
    console.log('About to show phantom inventory modal...');
    
    // Reset phantom processing steps first
    const phantomSteps = ['phantom-step1', 'phantom-step2', 'phantom-step3', 'phantom-step4', 'phantom-step5'];
    phantomSteps.forEach(stepId => {
        const step = document.getElementById(stepId);
        if (step) {
            step.style.opacity = '0';
            step.style.transform = 'translateX(-20px)';
        }
    });
    
    showProcessingModal('phantomInventorySearchingState');
    
    // Animate processing steps
    animatePhantomProcessingSteps();
    
    // Run phantom inventory analysis
    runPhantomInventoryAnalysis();
}

function animatePhantomProcessingSteps() {
    console.log('animatePhantomProcessingSteps called');
    const steps = ['phantom-step1', 'phantom-step2', 'phantom-step3', 'phantom-step4', 'phantom-step5'];
    
    steps.forEach((stepId, index) => {
        setTimeout(() => {
            const step = document.getElementById(stepId);
            if (step) {
                step.style.opacity = '1';
                step.style.transform = 'translateX(0)';
                console.log(`Animated step: ${stepId}`);
            } else {
                console.log(`Step element not found: ${stepId}`);
            }
        }, index * 1000);
    });
}

// ============================================================================
// UNIFIED PHANTOM ANALYSIS FUNCTIONS
// ============================================================================

async function runUnifiedPhantomAnalysis() {
    console.log('Running unified phantom analysis...');
    
    try {
        // Check for persistent inventory data first
        const persistentInfo = await window.electronAPI.invoke('get-persistent-inventory-info');
        if (persistentInfo.success) {
            console.log('Using persistent inventory data:', persistentInfo.info);
            // No popup needed - user can see the data is loaded from the UI
        }
        
        // Show processing state
        showProcessingModal('phantomInventorySearchingState');
        // Initialize phantom step animations
        setTimeout(() => {
            initializeStepAnimation('phantomInventorySearchingState');
        }, 200);
        animatePhantomProcessingSteps();
        
        // Get inventory data
        const inventoryData = await getInventoryDataForAnalysis();
        if (!inventoryData) {
            hideProcessingModal();
            return;
        }
        
        console.log(`Found ${inventoryData.length} inventory items for phantom analysis`);
        
        // Run the phantom inventory analysis (ML and Network Sync always enabled)
        const result = await window.electronAPI.invoke('phantom-analyze-inventory', inventoryData);
        
        // Hide processing modal
        hideProcessingModal();
        
        if (result.success) {
            // Store results in state
            window.phantomInventoryState.analysisResults = result.data;
            
            // ENSURE WE'RE ON THE ANALYSIS TAB FIRST
            if (window.phantomInventoryState.currentView !== 'analysis') {
                console.log('Switching to analysis view to display results');
                switchPhantomView('analysis');
            }
            
            // Force display results immediately with a small delay to ensure DOM is ready
            setTimeout(() => {
                console.log('Force displaying analysis results...');
                displayUnifiedPhantomResults(result.data);
                
                // Update verification placeholder with new data
                updateVerificationPlaceholder();
                
                // Auto-generate verification sheets after analysis
                generateVerificationSheets();
                
                // Also ensure other interfaces are ready
                updateValidationInterface();
            }, 100);
            
            // Update last analysis time
            const now = new Date().toLocaleString();
            const lastAnalysisElement = document.getElementById('lastAnalysisTime');
            if (lastAnalysisElement) {
                lastAnalysisElement.textContent = now;
            }
            
            // Analysis complete - UI will show results automatically, no popup needed
            console.log(`Analysis complete! Found ${result.data.phantomCandidates?.length || 0} phantom inventory candidates.`);
            
        } else {
            await showAlert('Phantom inventory analysis failed: ' + (result.error || 'Unknown error'), 'error');
        }
        
    } catch (error) {
        console.error('Error running unified phantom analysis:', error);
        hideProcessingModal();
        await showAlert('Error running phantom inventory analysis: ' + error.message, 'error');
    }
}

async function getInventoryDataForAnalysis() {
    let inventoryData = null;
    
    // First check for phantom selected file (highest priority)
    if (window.phantomSelectedFile) {
        console.log('Using phantom selected file for analysis:', window.phantomSelectedFile.name, 'Path:', window.phantomSelectedFile.path);
        
        try {
            // Store the phantom file info globally so the main process can access it
            window.selectedFile = {
                path: window.phantomSelectedFile.path,
                name: window.phantomSelectedFile.name,
                size: window.phantomSelectedFile.size,
                isPhantomFile: true
            };
            
            console.log('Set selectedFile for main process:', window.selectedFile);
            
            // Use IPC to get the inventory data from main process (which can read files)
            const result = await window.electronAPI.invoke('get-inventory-data');
            console.log('IPC result from get-inventory-data:', result.success, result.error);
            
            if (result.success && result.data && result.data.length > 0) {
                inventoryData = result.data;
                console.log(`✅ Successfully loaded phantom file data with ${inventoryData.length} items`);
                return inventoryData;
            } else {
                console.error('❌ Failed to read inventory data:', result.error);
                await showAlert('Failed to read phantom inventory file: ' + (result.error || 'Unknown error'), 'error');
                return null;
            }
        } catch (error) {
            console.error('❌ Error reading phantom file via IPC:', error);
            await showAlert('Error reading phantom file: ' + error.message, 'error');
            return null;
        }
    }
    
    // Try to get data from global variables
    if (window.latestInventoryData && window.latestInventoryData.length > 0) {
        inventoryData = window.latestInventoryData;
    } else if (window.processedData && window.processedData.length > 0) {
        inventoryData = window.processedData;
    } else {
        // If no processed data, try to get inventory data through the IPC handler
        try {
            const result = await window.electronAPI.invoke('get-inventory-data');
            if (result.success && result.data && result.data.length > 0) {
                inventoryData = result.data;
            } else {
                await showAlert('No inventory data available. Please load an inventory file first.', 'warning');
                return null;
            }
        } catch (error) {
            await showAlert('Error accessing inventory data: ' + error.message, 'error');
            return null;
        }
    }
    
    return inventoryData;
}

function displayUnifiedPhantomResults(data) {
    console.log('Displaying unified phantom results:', data);
    
    const analysisContent = document.getElementById('analysisContent');
    if (!analysisContent) {
        console.log('analysisContent not found');
        return;
    }
    
    // Store current view for verification but don't block rendering
    const currentView = window.phantomInventoryState?.currentView || 'analysis';
    console.log('Current view when displaying results:', currentView);
    
    // Always proceed with rendering if analysis content exists - let the CSS handle visibility
    
    // Save the analysis results to state for persistence
    if (window.phantomInventoryState) {
        window.phantomInventoryState.analysisResults = data;
        window.phantomInventoryState.lastAnalysisTime = new Date().toLocaleString();
        console.log('Saved analysis results to phantom inventory state');
    }
    
    const phantomCandidates = data.phantomCandidates || [];
    const totalItems = data.totalItems || 0;
    const highRiskItems = phantomCandidates.filter(item => (item.riskScore || 0) > 70).length;
    const totalValue = phantomCandidates.reduce((sum, item) => sum + ((item.unitCost || 0) * (item.currentStock || 0)), 0);
    
    analysisContent.innerHTML = `
        <div class="analysis-results full-height">

            <div class="order-table-container">
                <table class="order-table phantom-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>SKU</th>
                            <th>Description</th>
                            <th>SOH</th>
                            <th>Risk Score</th>
                            <th>COST</th>
                            <th>Total</th>
                            <th>Delete</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${phantomCandidates.map((item, index) => `
                            <tr data-index="${index}">
                                <td>${index + 1}</td>
                                <td title="${item.partNumber || 'N/A'}">${item.partNumber || 'N/A'}</td>
                                <td title="${item.description || 'N/A'}">${item.description || 'N/A'}</td>
                                <td>${item.currentStock || 0}</td>
                                <td>
                                    <span class="risk-score risk-${getRiskLevel(item.riskScore || 0)}">${item.riskScore || 0}</span>
                                </td>
                                <td class="cost-cell">
                                    <div>$${(item.unitCost || 0).toFixed(2)}</div>
                                </td>
                                <td class="total-cell">$${((item.unitCost || 0) * (item.currentStock || 0)).toFixed(2)}</td>
                                <td><button class="btn btn-danger btn-sm btn-icon" onclick="removePhantomCandidate(${index})" title="Delete item">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3,6 5,6 21,6"></polyline>
                                        <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"></path>
                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                    </svg>
                                </button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Initialize editable cells and interactions
    initializePhantomResultsInteractions();
    
    // Save the current state for persistence
    savePhantomInventoryState();
}

function getRiskLevel(score) {
    if (score > 70) return 'high';
    if (score > 40) return 'medium';
    return 'low';
}

function initializePhantomResultsInteractions() {
    // Initialize select all checkbox
    const selectAllCheckbox = document.getElementById('selectAllPhantomResults');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('.phantom-result-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
        });
    }
    
    // Initialize editable cells
    document.querySelectorAll('.editable-cell').forEach(cell => {
        cell.addEventListener('dblclick', function() {
            makePhantomCellEditable(this);
        });
    });
    
    // Initialize priority selects
    document.querySelectorAll('.priority-select').forEach(select => {
        select.addEventListener('change', function() {
            updatePhantomCandidatePriority(this.dataset.index, this.value);
        });
    });
}

function makePhantomCellEditable(cell) {
    const currentValue = cell.textContent.trim();
    const field = cell.dataset.field;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    input.className = 'editable-input';
    
    input.addEventListener('blur', function() {
        savePhantomCellEdit(cell, this.value, field);
    });
    
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            this.blur();
        }
    });
    
    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
}

function savePhantomCellEdit(cell, newValue, field) {
    const row = cell.closest('tr');
    const index = row.dataset.index;
    
    // Update the phantom candidate data
    if (window.phantomInventoryState.analysisResults && 
        window.phantomInventoryState.analysisResults.phantomCandidates && 
        window.phantomInventoryState.analysisResults.phantomCandidates[index]) {
        
        window.phantomInventoryState.analysisResults.phantomCandidates[index][field] = newValue;
    }
    
    // Update the cell display
    cell.textContent = newValue;
    cell.classList.add('cell-edited');
    
    console.log(`Updated phantom candidate ${index} field ${field} to: ${newValue}`);
}

function updatePhantomCandidatePriority(index, priority) {
    if (window.phantomInventoryState.analysisResults && 
        window.phantomInventoryState.analysisResults.phantomCandidates && 
        window.phantomInventoryState.analysisResults.phantomCandidates[index]) {
        
        window.phantomInventoryState.analysisResults.phantomCandidates[index].priority = priority;
        console.log(`Updated phantom candidate ${index} priority to: ${priority}`);
    }
}

// Additional utility functions for the unified interface
function selectAllPhantomCandidates() {
    const checkboxes = document.querySelectorAll('.phantom-result-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
}

function deselectAllPhantomCandidates() {
    const checkboxes = document.querySelectorAll('.phantom-result-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
}

function editSelectedCandidates() {
    const selectedCheckboxes = document.querySelectorAll('.phantom-result-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
        showAlert('Please select at least one item to edit.', 'warning');
        return;
    }
    
    // Enable editing mode for selected rows
    selectedCheckboxes.forEach(checkbox => {
        const row = checkbox.closest('tr');
        const editableCells = row.querySelectorAll('.editable-cell');
        editableCells.forEach(cell => {
            cell.style.backgroundColor = '#e3f2fd';
            cell.style.border = '1px solid #2196f3';
        });
    });
    
    showAlert('Selected items are now in edit mode. Double-click cells to edit values.', 'info');
}

function removeSelectedCandidates() {
    const selectedCheckboxes = document.querySelectorAll('.phantom-result-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
        showAlert('Please select at least one item to remove.', 'warning');
        return;
    }
    
    if (confirm(`Are you sure you want to remove ${selectedCheckboxes.length} selected items?`)) {
        const indicesToRemove = [];
        selectedCheckboxes.forEach(checkbox => {
            const index = parseInt(checkbox.dataset.index);
            indicesToRemove.push(index);
        });
        
        // Remove from data (in reverse order to maintain indices)
        indicesToRemove.sort((a, b) => b - a).forEach(index => {
            if (window.phantomInventoryState.analysisResults && 
                window.phantomInventoryState.analysisResults.phantomCandidates) {
                window.phantomInventoryState.analysisResults.phantomCandidates.splice(index, 1);
            }
        });
        
        // Refresh the display
        displayUnifiedPhantomResults(window.phantomInventoryState.analysisResults);
        
        showAlert(`Removed ${selectedCheckboxes.length} items from the analysis.`, 'success');
    }
}



function removePhantomCandidate(index) {
    // Remove from data directly - no confirmation needed
    if (window.phantomInventoryState.analysisResults && 
        window.phantomInventoryState.analysisResults.phantomCandidates) {
        window.phantomInventoryState.analysisResults.phantomCandidates.splice(index, 1);
    }
    
    // Refresh the display
    displayUnifiedPhantomResults(window.phantomInventoryState.analysisResults);
    
    // No popup needed - user can see the item was removed from the UI
    console.log('Phantom candidate removed.');
}

function exportAnalysisResults() {
    if (!window.phantomInventoryState.analysisResults) {
        showAlert('No analysis results to export.', 'warning');
        return;
    }
    
    // Use existing export functionality
    handleExportPhantomResults();
}

function refreshInventoryData() {
    showAlert('Refreshing inventory data...', 'info');
    // You could implement inventory refresh logic here
    // For now, just show a message
    setTimeout(() => {
        showAlert('Inventory data refreshed. Re-run analysis to see updated results.', 'success');
    }, 1000);
}

async function runPhantomInventoryAnalysis() {
    try {
        console.log('Starting phantom inventory analysis...');
        
        // Check if phantom system is initialized
        console.log('Checking phantom system status...');
        const statusCheck = await window.electronAPI.invoke('phantom-get-status');
        console.log('Status check result:', statusCheck);
        
        if (!statusCheck.success || !statusCheck.data.isInitialized) {
            hideProcessingModal();
            await showAlert('Phantom inventory system is not initialized. Please initialize it in the System Setup section first.', 'warning');
            return;
        }
        
        // Get the current inventory data - use existing global data
        let inventoryData = null;
        
        // Try to get data from global variables first
        if (window.latestInventoryData && window.latestInventoryData.length > 0) {
            inventoryData = window.latestInventoryData;
        } else if (window.processedData && window.processedData.length > 0) {
            inventoryData = window.processedData;
        } else {
            // If no processed data, try to get inventory data through the IPC handler
            // This will use the improved logic in main.js to find inventory data
            try {
                const result = await window.electronAPI.invoke('get-inventory-data');
                if (result.success && result.data && result.data.length > 0) {
                    inventoryData = result.data;
                } else {
                    hideProcessingModal();
                    await showAlert('No inventory data available. Please load an inventory file first.', 'warning');
                    return;
                }
            } catch (error) {
                hideProcessingModal();
                await showAlert('Error accessing inventory data: ' + error.message, 'error');
                return;
            }
        }
        
        console.log(`Found ${inventoryData.length} inventory items for phantom analysis`);
        
        // Run the phantom inventory analysis using the correct IPC handler
        const result = await window.electronAPI.invoke('phantom-analyze-inventory', inventoryData);
        
        // Hide processing modal
        hideProcessingModal();
        
        if (result.success) {
            // Display results in the phantom tab
            displayPhantomResults(result.data);
        } else {
            await showAlert('Phantom inventory analysis failed: ' + (result.error || 'Unknown error'), 'error');
        }
        
    } catch (error) {
        console.error('Error running phantom inventory analysis:', error);
        hideProcessingModal();
        await showAlert('Error running phantom inventory analysis: ' + error.message, 'error');
    }
}

// ============================================================================
// VERIFICATION SHEET FUNCTIONS
// ============================================================================

async function generateVerificationSheets() {
    console.log('Generating verification sheets...');
    
    try {
        if (!window.phantomInventoryState.analysisResults || 
            !window.phantomInventoryState.analysisResults.phantomCandidates || 
            window.phantomInventoryState.analysisResults.phantomCandidates.length === 0) {
            await showAlert('No phantom analysis results available. Please run analysis first.', 'warning');
            return;
        }
        
        const phantomCandidates = window.phantomInventoryState.analysisResults.phantomCandidates;
        console.log(`Generating verification sheets for ${phantomCandidates.length} phantom candidates...`);
        
        // Generate verification data (in-memory only, no Excel file yet)
        const verificationData = await window.electronAPI.invoke('phantom-generate-verification-data', {
            phantomCandidates: phantomCandidates,
            generateExcel: false  // Don't create Excel file until user explicitly requests it
        });
        
        if (verificationData.success) {
            // DEBUG: Log the received verification data
            console.log('Received verification data:', verificationData);
            console.log('Total sheets:', verificationData.totalSheets);
            console.log('Verification sheets:', verificationData.verificationSheets);
            
            // Store verification data in state
            window.phantomInventoryState.verificationData = verificationData;
            
            // Initialize verification tracking for validation interface
            if (!window.phantomInventoryState.verificationTracking) {
                window.phantomInventoryState.verificationTracking = {};
            }
            
            // Initialize tracking for each item in verification sheets
            const items = verificationData.items || [];
            items.forEach(item => {
                if (!window.phantomInventoryState.verificationTracking[item.partNumber]) {
                    window.phantomInventoryState.verificationTracking[item.partNumber] = {
                        partNumber: item.partNumber,
                        description: item.description,
                        systemStock: item.currentStock,
                        actualCount: item.currentStock, // Default to system stock for faster validation
                        verified: false,
                        notes: '',
                        verifiedBy: '',
                        verificationDate: null
                    };
                }
            });
            
            // Save state
            savePhantomInventoryState();
            
            // Display results in current view
            displayVerificationSheets(verificationData);
            
            // Use the detailed message from the backend if available
            const message = verificationData.message || 
                `Successfully prepared ${verificationData.totalSheets || 1} verification sheets with ${verificationData.totalCandidates || verificationData.dailyList || 0} total items.`;
            
            // No popup needed - user can see the sheets are generated in the UI
            console.log(message);
            
        } else {
            console.error('Verification generation failed:', verificationData);
            await showAlert('Failed to generate verification sheets: ' + (verificationData.error || 'Unknown error'), 'error');
        }
        
    } catch (error) {
        console.error('Error generating verification sheets:', error);
        await showAlert('Error generating verification sheets: ' + error.message, 'error');
    }
}

// Export verification sheets to Excel (only when user requests)
async function exportVerificationToExcel() {
    console.log('Exporting verification sheets to Excel...');
    
    try {
        if (!window.phantomInventoryState.verificationData) {
            await showAlert('No verification data available. Please generate verification sheets first.', 'warning');
            return;
        }
        
        // Request Excel export from backend
        const exportResult = await window.electronAPI.invoke('phantom-export-verification-excel', {
            verificationData: window.phantomInventoryState.verificationData,
            phantomCandidates: window.phantomInventoryState.analysisResults.phantomCandidates
        });
        
        if (exportResult.success) {
            await showAlert(`Verification sheets exported successfully to: ${exportResult.filePath}`, 'success');
        } else {
            await showAlert('Failed to export verification sheets: ' + (exportResult.error || 'Unknown error'), 'error');
        }
        
    } catch (error) {
        console.error('Error exporting verification sheets:', error);
        await showAlert('Error exporting verification sheets: ' + error.message, 'error');
    }
}

// Print verification sheets (creates temporary Excel file for printing)
async function printVerificationSheetsExcel() {
    console.log('Preparing verification sheets for printing...');
    
    try {
        if (!window.phantomInventoryState.verificationData) {
            await showAlert('No verification data available. Please generate verification sheets first.', 'warning');
            return;
        }
        
        // Create temporary Excel file for printing
        const printResult = await window.electronAPI.invoke('phantom-print-verification-excel', {
            verificationData: window.phantomInventoryState.verificationData,
            phantomCandidates: window.phantomInventoryState.analysisResults.phantomCandidates
        });
        
        if (printResult.success) {
            await showAlert('Verification sheets prepared for printing. File opened in default application.', 'success');
        } else {
            await showAlert('Failed to prepare verification sheets for printing: ' + (printResult.error || 'Unknown error'), 'error');
        }
        
    } catch (error) {
        console.error('Error preparing verification sheets for printing:', error);
        await showAlert('Error preparing verification sheets for printing: ' + error.message, 'error');
    }
}

// Update verification sheets display to include export/print buttons
function displayVerificationSheets(verificationData) {
    const verificationContent = document.getElementById('verificationContent');
    if (!verificationContent) return;
    
    // Handle the different possible data structures
    let candidates = [];
    if (verificationData.data && Array.isArray(verificationData.data)) {
        // If data is an array of candidates
        candidates = verificationData.data;
    } else if (verificationData.data && verificationData.data.items && Array.isArray(verificationData.data.items)) {
        // If data contains items array
        candidates = verificationData.data.items;
    } else if (verificationData.items && Array.isArray(verificationData.items)) {
        // If items is directly available
        candidates = verificationData.items;
    } else if (verificationData.phantomCandidates && Array.isArray(verificationData.phantomCandidates)) {
        // Fallback to phantomCandidates
        candidates = verificationData.phantomCandidates;
    } else {
        console.warn('Could not find candidates array in verification data:', verificationData);
        candidates = [];
    }
    
    const totalCount = candidates.length;
    const locationGroups = verificationData.locationGroups || [];
    
    // NEW: Handle sheet management data
    const totalSheets = verificationData.totalSheets || 1;
    const currentSheet = verificationData.currentSheet || 0;
    const verificationSheets = verificationData.verificationSheets || [];
    
    console.log(`Displaying verification sheets: ${totalSheets} total sheets, current sheet ${currentSheet + 1}`);
    console.log('Verification sheets data:', verificationSheets);
    console.log('Full verification data structure:', verificationData);
    
    verificationContent.innerHTML = `
        <div class="verification-sheets-display">
            <div class="verification-header">
                <h4>Verification Sheets Generated</h4>
                <p>Successfully prepared ${verificationData.totalCandidates || totalCount} phantom candidates across ${totalSheets} verification sheets.</p>
            </div>
            
            <!-- NEW: Sheet Selection Interface -->
            <div class="verification-sheet-selector">
                <div class="sheet-selector-header">
                    <h5>Verification Sheets</h5>
                    <div class="sheet-progress">
                        Sheet ${currentSheet + 1} of ${totalSheets} 
                        ${verificationSheets.length > 0 ? `(${verificationSheets.filter(s => s.status === 'completed').length} completed)` : ''}
                    </div>
                </div>
                
                <div class="sheet-tabs">
                    ${verificationSheets && verificationSheets.length > 0 ? 
                        verificationSheets.map((sheet, index) => `
                            <div class="sheet-tab ${sheet.status === 'active' ? 'active' : ''} ${sheet.status === 'completed' ? 'completed' : ''}" 
                                 onclick="selectVerificationSheet(${sheet.id})" data-sheet-id="${sheet.id}">
                                <div class="sheet-tab-header">
                                    <span class="sheet-name">${sheet.name}</span>
                                    <span class="sheet-status-icon">
                                        ${sheet.status === 'completed' ? '✓' : sheet.status === 'active' ? '📋' : '⏳'}
                                    </span>
                                </div>
                                <div class="sheet-tab-details">
                                    <span class="sheet-items">${sheet.itemCount} items</span>
                                    ${sheet.highPriorityCount > 0 ? `<span class="sheet-priority">${sheet.highPriorityCount} high priority</span>` : ''}
                                </div>
                            </div>
                        `).join('') 
                        : 
                        `<div class="sheet-tab active">
                            <div class="sheet-tab-header">
                                <span class="sheet-name">Verification Sheet 1</span>
                                <span class="sheet-status-icon">📋</span>
                            </div>
                            <div class="sheet-tab-details">
                                <span class="sheet-items">${totalCount} items</span>
                                <span class="sheet-debug">DEBUG: No sheet data received</span>
                            </div>
                        </div>`
                    }
                </div>
            </div>
            

            
            <div class="verification-actions" id="verificationActions">
                <div class="action-group">
                    <h5>Instructions</h5>
                    <p>Click on any sheet tab above to select it, then use the buttons below to print or send to validation.</p>
                </div>
            </div>
            
        </div>
    </div>
    `;
    
    // Save verification data to state
    if (window.phantomInventoryState) {
        window.phantomInventoryState.verificationData = verificationData;
        savePhantomInventoryState();
    }
}

// Helper functions for risk levels and priorities
function getRiskLevel(score) {
    if (score > 70) return 'high';
    if (score > 40) return 'medium';
    return 'low';
}

function getPriorityClass(score) {
    if (score > 70) return 'priority-high';
    if (score > 40) return 'priority-medium';
    return 'priority-low';
}

function getPriorityLabel(score) {
    if (score > 70) return 'High';
    if (score > 40) return 'Medium';
    return 'Low';
}

// Regenerate verification sheets
async function regenerateVerificationSheets() {
    console.log('Regenerating verification sheets...');
    
    if (!window.phantomInventoryState.analysisResults) {
        await showAlert('No analysis data available. Please run phantom analysis first.', 'warning');
        return;
    }
    
    // Clear existing verification data
    window.phantomInventoryState.verificationData = null;
    
    // Regenerate
    await generateVerificationSheets();
}

// Make functions globally available
window.exportVerificationToExcel = exportVerificationToExcel;
window.printVerificationSheetsExcel = printVerificationSheetsExcel;
window.regenerateVerificationSheets = regenerateVerificationSheets;

// NEW: Sheet management functions
window.selectVerificationSheet = selectVerificationSheet;
window.exportCurrentSheetToExcel = exportCurrentSheetToExcel;
window.printCurrentSheet = printCurrentSheet;
window.exportAllSheetsToExcel = exportAllSheetsToExcel;
window.refreshVerificationSheets = refreshVerificationSheets;

// NEW: Select a verification sheet - shows sheet with action buttons
async function selectVerificationSheet(sheetId) {
    console.log(`Selecting verification sheet ${sheetId}`);
    
    try {
        const result = await window.electronAPI.invoke('phantom-select-sheet', sheetId);
        
        if (result.success) {
            // Store the selected sheet data globally (result.data contains the sheet)
            window.selectedVerificationSheet = result.data;
            window.selectedSheetId = sheetId;
            
            // Update visual selection - move blue highlighting
            updateVerificationSheetSelection(sheetId);
            
            // Display the selected sheet with action buttons
            displaySelectedVerificationSheet(result.data, sheetId);
        } else {
            await showAlert('Failed to select sheet: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error selecting verification sheet:', error);
        await showAlert('Error selecting verification sheet: ' + error.message, 'error');
    }
}

// Update visual selection of verification sheets
function updateVerificationSheetSelection(selectedSheetId) {
    // Remove active class from all sheets - be more specific with selector
    const allSheets = document.querySelectorAll('.verification-sheet-tab, [onclick*="selectVerificationSheet"]');
    allSheets.forEach(sheet => {
        sheet.classList.remove('active');
    });
    
    // Add active class to selected sheet - try multiple selectors to ensure we find it
    let selectedSheet = document.querySelector(`[onclick="selectVerificationSheet(${selectedSheetId})"]`);
    if (!selectedSheet) {
        // Try finding by sheet content
        const allSheetElements = document.querySelectorAll('.verification-sheet-tab');
        allSheetElements.forEach(sheet => {
            if (sheet.textContent.includes(`Verification Sheet ${selectedSheetId + 1}`)) {
                selectedSheet = sheet;
            }
        });
    }
    
    if (selectedSheet) {
        selectedSheet.classList.add('active');
        console.log('Added active class to sheet:', selectedSheetId + 1);
    } else {
        console.warn('Could not find sheet element for ID:', selectedSheetId);
    }
}

// NEW: Display selected verification sheet with action buttons
function displaySelectedVerificationSheet(sheetData, sheetId) {
    const verificationActions = document.getElementById('verificationActions');
    if (!verificationActions) return;
    
    console.log('Sheet data received:', sheetData); // Debug log
    const itemCount = (sheetData && sheetData.items) ? sheetData.items.length : 0;
    
    verificationActions.innerHTML = `
        <div class="action-group">
            <h5>Selected: Verification Sheet ${sheetId + 1}</h5>
            <p><strong>${itemCount} items</strong> ready for verification</p>
            
            <div class="action-buttons">
                <button class="btn btn-primary" onclick="printSelectedSheet()">
                    <span class="btn-icon">🖨️</span> Print Sheet PDF
                </button>
                <button class="btn btn-success" onclick="sendToValidation()">
                    <span class="btn-icon">✅</span> Send to Validation
                </button>
                <button class="btn btn-secondary" onclick="clearSheetSelection()">
                    <span class="btn-icon">🔙</span> Clear Selection
                </button>
            </div>
        </div>
    `;
}

// NEW: Print selected sheet as PDF
async function printSelectedSheet() {
    if (!window.selectedVerificationSheet || window.selectedSheetId === undefined) {
        await showAlert('No sheet selected. Please select a sheet first.', 'warning');
        return;
    }
    
    try {
        console.log('Printing sheet with data:', window.selectedVerificationSheet); // Debug log
        const pdfResult = await window.electronAPI.invoke('phantom-generate-sheet-pdf', {
            sheetData: window.selectedVerificationSheet,
            sheetName: `Verification Sheet ${window.selectedSheetId + 1}`
        });
        
        if (pdfResult.success) {
            // PDF generated and opened - no popup needed, user can see the file opened
            console.log(`PDF generated and opened: Verification Sheet ${window.selectedSheetId + 1}`);
        } else {
            await showAlert('Error generating PDF: ' + (pdfResult.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error generating PDF:', error);
        await showAlert('Error generating PDF: ' + error.message, 'error');
    }
}

// NEW: Send selected sheet to validation
async function sendToValidation() {
    if (!window.selectedVerificationSheet || window.selectedSheetId === undefined) {
        await showAlert('No sheet selected. Please select a sheet first.', 'warning');
        return;
    }
    
    try {
        // Store the sheet data for validation
        console.log('Sending to validation with data:', window.selectedVerificationSheet); // Debug log
        window.validationSheetData = {
            sheetId: window.selectedSheetId,
            sheetName: `Verification Sheet ${window.selectedSheetId + 1}`,
            items: (window.selectedVerificationSheet && window.selectedVerificationSheet.items) ? window.selectedVerificationSheet.items : []
        };
        
        // Switch to validation tab
        switchPhantomView('validation');
        
        // Populate validation interface
        displayValidationInterface();
        
        await showAlert(`Sheet sent to validation: ${window.validationSheetData.items.length} items`, 'success');
    } catch (error) {
        console.error('Error sending to validation:', error);
        await showAlert('Error sending to validation: ' + error.message, 'error');
    }
}

// NEW: Clear sheet selection
function clearSheetSelection() {
    window.selectedVerificationSheet = null;
    window.selectedSheetId = undefined;
    
    const verificationActions = document.getElementById('verificationActions');
    if (verificationActions) {
        verificationActions.innerHTML = `
            <div class="action-group">
                <h5>Instructions</h5>
                <p>Click on any sheet tab above to select it, then use the buttons below to print or send to validation.</p>
            </div>
        `;
    }
}

// Clear persistent inventory data
async function clearPersistentInventory() {
    try {
        const confirmed = await showConfirm(
            'Clear Saved Inventory Data',
            'This will clear the saved inventory file and you will need to load a new file. Continue?',
            'Clear Data',
            'Cancel'
        );
        
        if (confirmed) {
            const result = await window.electronAPI.invoke('clear-persistent-inventory');
            if (result.success) {
                await showAlert('Saved inventory data cleared. Please load a new inventory file.', 'success');
                
                // Hide the clear button and update UI
                const clearBtn = document.getElementById('clearInventoryBtn');
                if (clearBtn) clearBtn.style.display = 'none';
                
                // Update last analysis time
                updateLastAnalysisTime('Never');
                
                // Clear any displayed results
                const analysisContent = document.getElementById('analysisContent');
                if (analysisContent) {
                    analysisContent.innerHTML = `
                        <div class="analysis-placeholder">
                            <div class="placeholder-icon">🔍</div>
                            <h4>Ready for Analysis</h4>
                            <p>Load an inventory file and run analysis to identify phantom inventory items.</p>
                        </div>
                    `;
                }
            } else {
                await showAlert('Error clearing saved data: ' + result.error, 'error');
            }
        }
    } catch (error) {
        console.error('Error clearing persistent inventory:', error);
        await showAlert('Error clearing saved data: ' + error.message, 'error');
    }
}

// Check and display persistent inventory status on load
async function checkPersistentInventoryStatus() {
    try {
        const persistentInfo = await window.electronAPI.invoke('get-persistent-inventory-info');
        if (persistentInfo.success) {
            console.log('Persistent inventory data available:', persistentInfo.info);
            
            // Show the clear button
            const clearBtn = document.getElementById('clearInventoryBtn');
            if (clearBtn) clearBtn.style.display = 'inline-block';
            
            // Update last analysis time
            updateLastAnalysisTime(new Date(persistentInfo.info.loadDate).toLocaleDateString());
            
            return true;
        } else {
            // Hide the clear button
            const clearBtn = document.getElementById('clearInventoryBtn');
            if (clearBtn) clearBtn.style.display = 'none';
            
            return false;
        }
    } catch (error) {
        console.error('Error checking persistent inventory status:', error);
        return false;
    }
}

// Update last analysis time display
function updateLastAnalysisTime(timeText) {
    const lastAnalysisElement = document.getElementById('lastAnalysisTime');
    if (lastAnalysisElement) {
        lastAnalysisElement.textContent = timeText;
    }
}

// Make functions globally available
window.printSelectedSheet = printSelectedSheet;
window.sendToValidation = sendToValidation;
window.clearSheetSelection = clearSheetSelection;
window.clearPersistentInventory = clearPersistentInventory;

// NEW: Export current sheet to Excel
async function exportCurrentSheetToExcel() {
    console.log('Exporting current sheet to Excel...');
    
    try {
        if (!window.phantomInventoryState.verificationData) {
            await showAlert('No verification data available. Please generate verification sheets first.', 'warning');
            return;
        }
        
        // Get current sheet data
        const currentSheetResult = await window.electronAPI.invoke('phantom-get-current-sheet');
        
        if (currentSheetResult.success && currentSheetResult.data.currentSheet) {
            const currentSheet = currentSheetResult.data.currentSheet;
            
            // Export current sheet to Excel - pass full candidates to maintain sheet structure
            const exportResult = await window.electronAPI.invoke('phantom-export-verification-excel', {
                verificationData: {items: currentSheet.items},
                phantomCandidates: window.phantomInventoryState.analysisResults.phantomCandidates,
                exportCurrentSheetOnly: true,
                currentSheetItems: currentSheet.items
            });
            
            if (exportResult.success) {
                await showAlert(`Current sheet exported successfully to: ${exportResult.filePath}`, 'success');
            } else {
                await showAlert('Failed to export current sheet: ' + (exportResult.error || 'Unknown error'), 'error');
            }
        } else {
            await showAlert('No current sheet available to export.', 'warning');
        }
        
    } catch (error) {
        console.error('Error exporting current sheet:', error);
        await showAlert('Error exporting current sheet: ' + error.message, 'error');
    }
}

// NEW: Print current sheet
async function printCurrentSheet() {
    console.log('Printing current sheet...');
    
    try {
        if (!window.phantomInventoryState.verificationData) {
            await showAlert('No verification data available.', 'warning');
            return;
        }
        
        // Get current sheet data
        const currentSheetResult = await window.electronAPI.invoke('phantom-get-current-sheet');
        
        if (currentSheetResult.success && currentSheetResult.data.currentSheet) {
            const currentSheet = currentSheetResult.data.currentSheet;
            
            // Print current sheet - pass full candidates to maintain sheet structure
            const printResult = await window.electronAPI.invoke('phantom-print-verification-excel', {
                verificationData: {items: currentSheet.items},
                phantomCandidates: window.phantomInventoryState.analysisResults.phantomCandidates,
                printCurrentSheetOnly: true,
                currentSheetItems: currentSheet.items
            });
            
            if (printResult.success) {
                await showAlert('Current sheet prepared for printing. File opened in default application.', 'success');
            } else {
                await showAlert('Failed to prepare current sheet for printing: ' + (printResult.error || 'Unknown error'), 'error');
            }
        } else {
            await showAlert('No current sheet available to print.', 'warning');
        }
        
    } catch (error) {
        console.error('Error printing current sheet:', error);
        await showAlert('Error printing current sheet: ' + error.message, 'error');
    }
}

// NEW: Export all sheets to Excel
async function exportAllSheetsToExcel() {
    console.log('Exporting all sheets to Excel...');
    
    try {
        if (!window.phantomInventoryState.verificationData) {
            await showAlert('No verification data available. Please generate verification sheets first.', 'warning');
            return;
        }
        
        // Export all verification data
        const exportResult = await window.electronAPI.invoke('phantom-export-verification-excel', {
            verificationData: window.phantomInventoryState.verificationData,
            phantomCandidates: window.phantomInventoryState.analysisResults.phantomCandidates
        });
        
        if (exportResult.success) {
            await showAlert(`All verification sheets exported successfully to: ${exportResult.filePath}`, 'success');
        } else {
            await showAlert('Failed to export all sheets: ' + (exportResult.error || 'Unknown error'), 'error');
        }
        
    } catch (error) {
        console.error('Error exporting all sheets:', error);
        await showAlert('Error exporting all sheets: ' + error.message, 'error');
    }
}

// NEW: Refresh verification sheets data
async function refreshVerificationSheets() {
    console.log('Refreshing verification sheets...');
    
    try {
        // Get current sheet and summary
        const result = await window.electronAPI.invoke('phantom-get-current-sheet');
        
        if (result.success) {
            const { currentSheet, summary } = result.data;
            
            if (currentSheet) {
                // Update verification data with current sheet
                const verificationData = {
                    ...window.phantomInventoryState.verificationData,
                    items: currentSheet.items,
                    totalSheets: summary.totalSheets,
                    currentSheet: summary.currentSheet,
                    verificationSheets: summary.sheets,
                    totalCandidates: summary.sheets.reduce((sum, sheet) => sum + sheet.itemCount, 0)
                };
                
                // Update state and display
                window.phantomInventoryState.verificationData = verificationData;
                savePhantomInventoryState();
                displayVerificationSheets(verificationData);
            } else {
                await showAlert('No active verification sheet found.', 'warning');
            }
        } else {
            await showAlert('Failed to refresh verification sheets: ' + (result.error || 'Unknown error'), 'error');
        }
        
    } catch (error) {
        console.error('Error refreshing verification sheets:', error);
        await showAlert('Error refreshing verification sheets: ' + error.message, 'error');
    }
}

function initializeVerificationSheetInteractions() {
    // Initialize count inputs for auto-save
    document.querySelectorAll('.count-input').forEach(input => {
        input.addEventListener('change', function() {
            saveVerificationData(this.dataset.partnumber, 'actualCount', this.value);
        });
    });
    
    // Initialize notes inputs for auto-save
    document.querySelectorAll('.notes-input').forEach(input => {
        input.addEventListener('change', function() {
            saveVerificationData(this.dataset.partnumber, 'notes', this.value);
        });
    });
    
    // Initialize verification checkboxes
    document.querySelectorAll('.verify-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            saveVerificationData(this.dataset.partnumber, 'verified', this.checked);
        });
    });
}

function saveVerificationData(partNumber, field, value) {
    // Initialize verification tracking if not exists
    if (!window.phantomInventoryState.verificationTracking) {
        window.phantomInventoryState.verificationTracking = {};
    }
    
    if (!window.phantomInventoryState.verificationTracking[partNumber]) {
        window.phantomInventoryState.verificationTracking[partNumber] = {};
    }
    
    window.phantomInventoryState.verificationTracking[partNumber][field] = value;
    
    console.log(`Saved verification data for ${partNumber}: ${field} = ${value}`);
}

function printAllVerificationSheets() {
    if (!window.phantomInventoryState.verificationData) {
        showAlert('No verification data available.', 'warning');
        return;
    }
    
    const locationGroups = window.phantomInventoryState.verificationData.locationGroups || [];
    locationGroups.forEach((location, index) => {
        setTimeout(() => printLocationSheet(index), index * 500); // Stagger prints
    });
}

function printLocationSheet(locationIndex) {
    if (!window.phantomInventoryState.verificationData || 
        !window.phantomInventoryState.verificationData.locationGroups ||
        !window.phantomInventoryState.verificationData.locationGroups[locationIndex]) {
        showAlert('Location sheet not found.', 'warning');
        return;
    }
    
    const location = window.phantomInventoryState.verificationData.locationGroups[locationIndex];
    const storeName = window.phantomInventoryState.currentStore?.displayName || window.phantomInventoryState.currentStore?.id || 'Unknown Store';
    
    // Create printable content
    const printContent = createPrintableVerificationSheet(location, storeName);
    
    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

function createPrintableVerificationSheet(location, storeName) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Phantom Inventory Verification - ${location.location}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
                .store-info { text-align: right; font-size: 12px; margin-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #333; padding: 8px; text-align: left; }
                th { background-color: #f5f5f5; font-weight: bold; }
                .priority-high { color: #d32f2f; font-weight: bold; }
                .priority-medium { color: #ff9800; font-weight: bold; }
                .priority-low { color: #4caf50; font-weight: bold; }
                .footer { margin-top: 30px; font-size: 12px; color: #666; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            <div class="store-info">
                Store: ${storeName} | Date: ${new Date().toLocaleDateString()} | Time: ${new Date().toLocaleTimeString()}
            </div>
            
            <div class="header">
                <h1>Phantom Inventory Verification Sheet</h1>
                <h2>Location: ${location.location}</h2>
                <p>Total Items: ${location.items.length}</p>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Part Number</th>
                        <th>Description</th>
                        <th>System Stock</th>
                        <th>Priority</th>
                        <th>Verified ☐</th>
                        <th>Actual Count</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    ${location.items.map(item => `
                        <tr>
                            <td>${item.partNumber}</td>
                            <td>${item.description}</td>
                            <td>${item.currentStock}</td>
                            <td class="priority-${item.priority || 'medium'}">${(item.priority || 'medium').toUpperCase()}</td>
                            <td style="width: 60px; text-align: center;">☐</td>
                            <td style="width: 100px; border-bottom: 1px solid #333;"></td>
                            <td style="width: 150px; border-bottom: 1px solid #333;"></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="footer">
                <p><strong>Instructions:</strong></p>
                <ul>
                    <li>Physically count each item in the specified location</li>
                    <li>Record the actual count in the "Actual Count" column</li>
                    <li>Check the "Verified" box when counting is complete</li>
                    <li>Add notes for any discrepancies or issues</li>
                </ul>
                <p><strong>Verification completed by:</strong> _____________________ <strong>Date/Time:</strong> _____________________</p>
            </div>
        </body>
        </html>
    `;
}

function previewLocationSheet(locationIndex) {
    if (!window.phantomInventoryState.verificationData || 
        !window.phantomInventoryState.verificationData.locationGroups ||
        !window.phantomInventoryState.verificationData.locationGroups[locationIndex]) {
        showAlert('Location sheet not found.', 'warning');
        return;
    }
    
    const location = window.phantomInventoryState.verificationData.locationGroups[locationIndex];
    const storeName = window.phantomInventoryState.currentStore?.displayName || window.phantomInventoryState.currentStore?.id || 'Unknown Store';
    
    const printContent = createPrintableVerificationSheet(location, storeName);
    
    const previewWindow = window.open('', '_blank');
    previewWindow.document.write(printContent);
    previewWindow.document.close();
}

function exportVerificationData() {
    if (!window.phantomInventoryState.verificationData) {
        showAlert('No verification data available.', 'warning');
        return;
    }
    
    // Use existing export functionality if available
    if (typeof handleExportPhantomResults === 'function') {
        handleExportPhantomResults();
    } else {
        showAlert('Export functionality not available.', 'warning');
    }
}

function printVerificationSheets() {
    printAllVerificationSheets();
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================



function displayValidationInterface() {
    const validationContent = document.getElementById('validationContent');
    if (!validationContent) return;
    
    // Check if we have sheet data from verification
    if (window.validationSheetData && window.validationSheetData.items) {
        displayValidationSheetInterface();
        return;
    }
    
    const verificationData = window.phantomInventoryState.verificationTracking || {};
    const verifiedItems = Object.keys(verificationData).filter(partNumber => verificationData[partNumber].verified);
    
    // Simple validation interface without the dataset table
    validationContent.innerHTML = `
        <div class="validation-results">
            <div class="validation-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <div>
                    <h4>Validation Center</h4>
                    <p>Review and validate the active verification sheet results. Enter actual counts to complete the validation process.</p>
                </div>
                <button onclick="resetValidationData()" class="btn btn-warning" style="padding: 8px 16px; font-size: 14px;">
                    🔄 Reset Validation Data
                </button>
            </div>
            

            
            <div class="validation-instructions">
                <h5>Instructions:</h5>
                <ul>
                    <li>Use the verification sheets to physically count items</li>
                    <li>Return here to enter the actual counts and validate results</li>
                    <li>Items with matching system and physical counts will be marked as validated</li>
                    <li>Discrepancies will be flagged for review and potential inventory adjustment</li>
                </ul>
            </div>
            
            ${Object.keys(verificationData).length > 0 ? `
            <div class="validation-status">
                <h5>Current Validation Status:</h5>
                <p><strong>${verifiedItems.length}</strong> items validated out of <strong>${Object.keys(verificationData).length}</strong> total items.</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(verifiedItems.length / Object.keys(verificationData).length) * 100}%"></div>
                </div>
            </div>
            ` : ''}
        </div>
    `;
    
    // Save the validation data to state for persistence
    if (window.phantomInventoryState) {
        window.phantomInventoryState.validationData = window.phantomInventoryState.verificationTracking;
        console.log('Saved validation data to phantom inventory state');
    }
    
    // Save the current state for persistence
    savePhantomInventoryState();
}

// NEW: Display validation interface for a specific verification sheet
function displayValidationSheetInterface() {
    const validationContent = document.getElementById('validationContent');
    if (!validationContent || !window.validationSheetData) return;
    
    const sheetData = window.validationSheetData;
    const items = sheetData.items || [];
    
    // Initialize validation tracking for this sheet if not exists
    if (!window.validationTracking) {
        window.validationTracking = {};
    }
    
    // Restore validation data from phantom inventory state if it exists
    if (window.phantomInventoryState && window.phantomInventoryState.validationTracking) {
        console.log('Restoring validation tracking data from phantom inventory state');
        console.log('Saved validation data:', window.phantomInventoryState.validationTracking);
        window.validationTracking = { ...window.phantomInventoryState.validationTracking };
    } else {
        console.log('No saved validation data found, starting fresh');
    }
    
    validationContent.innerHTML = `
        <div class="validation-results">
            <div class="validation-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h4>Validation Data</h4>
                <button onclick="resetValidationData()" class="btn btn-warning" style="padding: 8px 16px; font-size: 14px;">
                    🔄 Reset Validation Data
                </button>
            </div>
            <div class="validation-table-container">
                <table class="validation-table">
                    <thead>
                        <tr>
                            <th>Part Number</th>
                            <th>Description</th>
                            <th>System Stock</th>
                            <th style="text-align: center;">Actual Count</th>
                            <th>Variance</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item, index) => {
                            const systemStock = item.currentStock || item.systemStock || 0;
                            const savedData = window.validationTracking[item.partNumber];
                            
                            // Always use fresh system stock, but use saved actual count if available
                            // Only use saved actual count if the saved system stock matches current system stock
                            let actualCount = systemStock; // Default to system stock
                            if (savedData && savedData.systemStock === systemStock) {
                                actualCount = savedData.actualCount;
                            } else if (savedData) {
                                console.warn(`System stock mismatch for ${item.partNumber}: saved=${savedData.systemStock}, current=${systemStock}. Using current.`);
                            }
                            
                            const variance = actualCount - systemStock;
                            const status = variance === 0 ? 'Match' : 'Discrepancy';
                            const statusClass = variance === 0 ? 'match' : 'discrepancy';
                            
                            return `
                            <tr class="validation-row" data-part-number="${item.partNumber}" data-system-stock="${systemStock}" id="validation-row-${index}">
                                <td><strong>${item.partNumber || 'N/A'}</strong></td>
                                <td>${item.description || 'N/A'}</td>
                                <td class="text-center">${systemStock}</td>
                                <td class="text-center">
                                    <div class="quantity-controls">
                                        <button type="button" class="qty-btn minus-btn" data-index="${index}" data-delta="-1" title="Decrease by 1">-</button>
                                        <input type="number" 
                                               class="qty-input actual-count-input" 
                                               data-index="${index}"
                                               data-part-number="${item.partNumber}"
                                               data-system-stock="${systemStock}"
                                               value="${actualCount}"
                                               min="0">
                                        <button type="button" class="qty-btn plus-btn" data-index="${index}" data-delta="1" title="Increase by 1">+</button>
                                    </div>
                                </td>
                                <td class="text-center variance-cell" id="variance-${index}">${variance === 0 ? '0' : (variance > 0 ? '+' + variance : variance)}</td>
                                <td class="text-center status-cell" id="status-${index}">
                                    <span class="status-badge ${statusClass}">${status}</span>
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

        </div>
    `;
    
    // Add event listeners to inputs after DOM is created
    setTimeout(() => {
        const inputs = document.querySelectorAll('.qty-input.actual-count-input');
        inputs.forEach((input) => {
            input.addEventListener('change', () => updateValidationRow(input));
            input.addEventListener('keyup', () => updateValidationRow(input));
        });
        
        // Add robust event delegation for +/- buttons (handles clicks on inner elements)
        const validationTable = document.querySelector('.validation-table');
        if (validationTable) {
            // Unbind previously attached handler to prevent double-increment
            if (window.__validationBtnHandlerRef) {
                try { validationTable.removeEventListener('click', window.__validationBtnHandlerRef); } catch (_) {}
            }
            const handler = (e) => {
                const btn = e.target.closest('.qty-btn');
                if (!btn || !validationTable.contains(btn)) return;
                e.preventDefault();
                e.stopPropagation();
                adjustActualCountByButton(btn);
            };
            validationTable.addEventListener('click', handler);
            window.__validationBtnHandlerRef = handler;
        }
        
        // Add keyboard shortcut for reset (Ctrl+Shift+R)
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                resetValidationData();
            }
        });
    }, 100);
}

// NEW: Update validation row when actual count is entered
// NEW: Adjust actual count using +/- buttons
function adjustActualCount(index, delta) {
    console.log(`=== adjustActualCount called ===`);
    console.log(`Index: ${index}, Delta: ${delta}`);
    
    const input = document.querySelector(`.qty-input[data-index="${index}"]`);
    if (!input) {
        console.error(`No input found for index ${index}`);
        return;
    }
    
    const currentValue = Math.round(parseFloat(input.value) || 0);
    const newValue = Math.max(0, currentValue + (delta > 0 ? 1 : -1)); // Always step by 1
    
    console.log(`Current value: ${currentValue}`);
    console.log(`New value: ${newValue}`);
    
    // Update the input value
    input.value = newValue;
    
    // Force visual update
    input.style.backgroundColor = '#ffffcc'; // Highlight change
    setTimeout(() => {
        input.style.backgroundColor = '';
    }, 500);
    
    // Update the validation row
    updateValidationRow(index);
    
    console.log(`Input value after update: ${input.value}`);
}

// Alternative handler that resolves the input from the clicked button itself
function adjustActualCountByButton(btn) {
    const index = Number(btn.dataset.index);
    // Force strict +/-1 regardless of any parsing quirks
    const delta = btn.classList.contains('plus-btn') ? 1 : btn.classList.contains('minus-btn') ? -1 : (Number(btn.dataset.delta) || 0);
    const row = btn.closest('tr');
    const input = row ? row.querySelector(`.qty-input[data-index="${index}"]`) : null;
    if (!input) {
        console.error('adjustActualCountByButton: input not found for index', index);
        return;
    }
    const currentValue = Math.round(parseFloat(input.value) || 0);
    const newValue = Math.max(0, currentValue + (delta > 0 ? 1 : -1));
    input.value = String(newValue);
    updateValidationRow(input);
}

function updateValidationRow(indexOrEl) {
    // Accept either an index or an input element
    const input = typeof indexOrEl === 'number'
        ? document.querySelector(`.qty-input[data-index="${indexOrEl}"]`)
        : indexOrEl;
    if (!input) {
        console.error(`updateValidationRow: No input found for`, indexOrEl);
        return;
    }
    
    const actualCount = parseFloat(input.value) || 0;
    // Prefer the row's system stock if present to avoid stale data attributes
    const row = input.closest('tr');
    const rowSystem = row ? parseFloat(row.getAttribute('data-system-stock')) || 0 : 0;
    const dataSystem = parseFloat(input.dataset.systemStock) || 0;
    const systemStock = Number.isFinite(rowSystem) ? rowSystem : dataSystem;
    const partNumber = input.dataset.partNumber || (row ? row.getAttribute('data-part-number') : '');
    
    // Calculate variance (actual - system)
    const variance = actualCount - systemStock;
    
    console.log(`=== Validation Row ${input.dataset.index} (${partNumber}) ===`);
    console.log(`Part: ${partNumber}`);
    console.log(`System Stock: ${systemStock} (type: ${typeof systemStock})`);
    console.log(`Actual Count: ${actualCount} (type: ${typeof actualCount})`);
    console.log(`Variance: ${variance}`);
    console.log(`Input value: "${input.value}"`);
    console.log(`Input dataset:`, input.dataset);
    
    // Check if the displayed system stock matches the data attribute
    const systemStockCell = input.closest('tr').cells[2];
    if (systemStockCell) {
        const displayedSystemStock = systemStockCell.textContent.trim();
        console.log(`Displayed System Stock: "${displayedSystemStock}"`);
        if (displayedSystemStock !== systemStock.toString()) {
            console.warn(`MISMATCH: Displayed (${displayedSystemStock}) vs Data Attribute (${systemStock})`);
        }
    }
    
    // Update variance display
    const varianceCell = row ? row.querySelector(`#variance-${input.dataset.index}`) : document.getElementById(`variance-${input.dataset.index}`);
    if (varianceCell) {
        if (variance === 0) {
            varianceCell.textContent = "0";
        } else {
            varianceCell.textContent = variance > 0 ? `+${variance}` : variance.toString();
        }
        varianceCell.className = `text-center variance-cell ${variance === 0 ? 'match' : variance > 0 ? 'overage' : 'shortage'}`;
    }
    
    // Update status display
    const statusCell = row ? row.querySelector(`#status-${input.dataset.index}`) : document.getElementById(`status-${input.dataset.index}`);
    if (statusCell) {
        if (variance === 0) {
            statusCell.innerHTML = '<span class="status-badge match">Match</span>';
        } else {
            statusCell.innerHTML = '<span class="status-badge discrepancy">Discrepancy</span>';
        }
    }
    
    // Update tracking
    if (!window.validationTracking) window.validationTracking = {};
    window.validationTracking[partNumber] = {
        systemStock,
        actualCount,
        variance,
        validated: true // Mark as validated when user interacts with the input
    };
    
    // Save validation data to phantom inventory state for persistence
    if (window.phantomInventoryState) {
        if (!window.phantomInventoryState.validationTracking) {
            window.phantomInventoryState.validationTracking = {};
        }
        window.phantomInventoryState.validationTracking[partNumber] = window.validationTracking[partNumber];
        // Persist also into validationSheetData for robust reloads
        if (window.validationSheetData && Array.isArray(window.validationSheetData.items)) {
            const target = window.validationSheetData.items.find(i => i.partNumber === partNumber);
            if (target) {
                target.actualCount = actualCount;
            }
        }
        savePhantomInventoryState();
    }
}



// NEW: Validate all entries
function validateAllEntries() {
    if (!window.validationSheetData) return;
    
    const items = window.validationSheetData.items || [];
    let validated = 0;
    let discrepancies = 0;
    
    items.forEach(item => {
        const tracking = window.validationTracking[item.partNumber];
        if (tracking && tracking.validated) {
            validated++;
            if (tracking.variance !== 0) {
                discrepancies++;
            }
        }
    });
    
    if (validated === 0) {
        showAlert('No items have been counted yet. Please enter actual counts first.', 'warning');
        return;
    }
    
    showAlert(`Validation complete: ${validated} items processed, ${discrepancies} discrepancies found.`, 'success');
}

// NEW: Clear validation sheet
function clearValidationSheet() {
    window.validationSheetData = null;
    window.validationTracking = {};
    
    // Also clear from phantom inventory state
    if (window.phantomInventoryState) {
        window.phantomInventoryState.validationTracking = {};
        savePhantomInventoryState();
    }
    
    displayValidationInterface();
}

// Add a function to reset validation data completely
async function resetValidationData() {
    const confirmed = await showConfirm(
        'This will reset all validation data and clear any changes you\'ve made. Are you sure?', 
        'Reset Validation Data'
    );
    
    if (!confirmed) return;
    
    console.log('Resetting all validation data...');
    window.validationTracking = {};
    
    if (window.phantomInventoryState) {
        window.phantomInventoryState.validationTracking = {};
        savePhantomInventoryState();
    }
    
    // Force complete refresh by clearing sheet data and recreating
    if (window.validationSheetData) {
        // Reset all items in the sheet data to have actual count = system stock
        window.validationSheetData.items.forEach(item => {
            const systemStock = item.currentStock || item.systemStock || 0;
            item.actualCount = systemStock;
        });
        
        displayValidationSheetInterface();
        await showAlert('Validation data has been reset successfully!', 'success');
    }
}

// Make new functions globally available
window.updateValidationRow = updateValidationRow;
window.validateAllEntries = validateAllEntries;
window.clearValidationSheet = clearValidationSheet;
window.resetValidationData = resetValidationData;

function findPhantomCandidate(partNumber) {
    if (!window.phantomInventoryState.analysisResults || !window.phantomInventoryState.analysisResults.phantomCandidates) {
        return null;
    }
    
    return window.phantomInventoryState.analysisResults.phantomCandidates.find(item => item.partNumber === partNumber);
}

function getDiscrepancyCount() {
    if (!window.phantomInventoryState.verificationTracking) return 0;
    
    let discrepancies = 0;
    Object.keys(window.phantomInventoryState.verificationTracking).forEach(partNumber => {
        const data = window.phantomInventoryState.verificationTracking[partNumber];
        const phantom = findPhantomCandidate(partNumber);
        const systemStock = phantom?.currentStock || 0;
        const actualCount = parseInt(data.actualCount) || 0;
        
        if (systemStock !== actualCount) {
            discrepancies++;
        }
    });
    
    return discrepancies;
}

function getAccuracyRate() {
    const verificationData = window.phantomInventoryState.verificationTracking || {};
    const totalItems = Object.keys(verificationData).length;
    if (totalItems === 0) return 0;
    
    const discrepancies = getDiscrepancyCount();
    return Math.round(((totalItems - discrepancies) / totalItems) * 100);
}

function getValidationStatus(variance, verified) {
    if (!verified) {
        return { text: 'Not Verified', class: 'status-pending' };
    }
    
    if (variance === 0) {
        return { text: 'Accurate', class: 'status-accurate' };
    } else if (variance > 0) {
        return { text: 'Phantom Confirmed', class: 'status-phantom' };
    } else {
        return { text: 'Over Count', class: 'status-overcount' };
    }
}

async function adjustInventory(partNumber, actualCount) {
    const confirm = await showConfirm(`Adjust inventory for ${partNumber} to ${actualCount} units?`);
    if (confirm) {
        // Here you would typically call an API to adjust the inventory
        // For now, just show a success message
        await showAlert(`Inventory adjustment requested for ${partNumber}: ${actualCount} units`, 'success');
    }
}

// New validation interface functions
function adjustValidationQuantity(partNumber, change) {
    const input = document.querySelector(`input[data-partnumber="${partNumber}"]`);
    if (input) {
        const currentQty = parseInt(input.value) || 0;
        const newQty = Math.max(0, currentQty + change);
        input.value = newQty;
        updateValidationCount(partNumber, newQty);
    }
}

function updateValidationCount(partNumber, newCount) {
    if (!window.phantomInventoryState.verificationTracking) return;
    
    const actualCount = parseInt(newCount) || 0;
    
    // Initialize or update the verification tracking data
    if (!window.phantomInventoryState.verificationTracking[partNumber]) {
        const phantom = findPhantomCandidate(partNumber);
        const systemStock = phantom?.currentStock || 0;
        
        window.phantomInventoryState.verificationTracking[partNumber] = {
            actualCount: actualCount,
            verified: false, // Not verified until adjust button is clicked
            notes: '',
            adjustedAt: new Date().toISOString()
        };
    } else {
        window.phantomInventoryState.verificationTracking[partNumber].actualCount = actualCount;
        // Don't automatically mark as verified - wait for adjust button click
    }
    
    // Update variance display
    updateValidationVariance(partNumber, actualCount);
    
    // Save the updated state
    savePhantomInventoryState();
}

function updateValidationVariance(partNumber, actualCount) {
    const phantom = findPhantomCandidate(partNumber);
    const systemStock = phantom?.currentStock || 0;
    const variance = actualCount - systemStock;
    
    // Find the row and update the variance cell
    const rows = document.querySelectorAll('.validation-row');
    rows.forEach(row => {
        const skuCell = row.cells[0];
        if (skuCell && skuCell.textContent.trim() === partNumber) {
            const varianceCell = row.cells[4]; // Variance column
            if (varianceCell) {
                varianceCell.textContent = `${variance > 0 ? '+' : ''}${variance}`;
                varianceCell.className = `variance ${variance > 0 ? 'positive' : variance < 0 ? 'negative' : ''}`;
            }
            
            // Update status
            const statusCell = row.cells[7]; // Status column (moved to end)
            if (statusCell) {
                const status = getValidationStatus(variance, true);
                statusCell.innerHTML = `<span class="status-badge ${status.class}">${status.text}</span>`;
            }
        }
    });
}

function confirmValidationAdjustment(partNumber, actualCount) {
    if (!window.phantomInventoryState.verificationTracking) return;
    
    // Get the current actual count from the input
    const input = document.querySelector(`input[data-partnumber="${partNumber}"]`);
    const currentActualCount = input ? parseInt(input.value) || 0 : actualCount;
    
    // Mark as adjusted in the tracking data
    if (window.phantomInventoryState.verificationTracking[partNumber]) {
        window.phantomInventoryState.verificationTracking[partNumber].adjusted = true;
        window.phantomInventoryState.verificationTracking[partNumber].adjustedAt = new Date().toISOString();
        window.phantomInventoryState.verificationTracking[partNumber].actualCount = currentActualCount;
        window.phantomInventoryState.verificationTracking[partNumber].verified = true;
    }
    
    // Update button appearance - find the specific button for this part number
    const rows = document.querySelectorAll('.validation-row');
    rows.forEach(row => {
        const skuCell = row.cells[0];
        if (skuCell && skuCell.textContent.trim() === partNumber) {
            const button = row.querySelector('.validation-adjust-btn');
            if (button) {
                button.classList.add('adjusted');
                button.title = 'Confirmed';
                // Force the green styling
                button.style.backgroundColor = '#28a745';
                button.style.borderColor = '#28a745';
                button.style.color = '#ffffff';
            }
        }
    });
    
    // Save the state
    savePhantomInventoryState();
}



async function finalizeValidation() {
    console.log('Finalizing validation and feeding data to ML system...');
    
    // Check both validation tracking sources
    const validationData = window.validationTracking || {};
    const verificationData = window.phantomInventoryState?.verificationTracking || {};
    
    // Use validation data if available, otherwise use verification data
    const dataToProcess = Object.keys(validationData).length > 0 ? validationData : verificationData;
    
    if (Object.keys(dataToProcess).length === 0) {
        await showAlert('No validation data available to finalize.', 'warning');
        return;
    }
    
    console.log(`Processing ${Object.keys(dataToProcess).length} validation items for finalization`);
    
    try {
        // Prepare validation results for ML feedback
        const validationResults = [];
        
        Object.keys(dataToProcess).forEach(partNumber => {
            const data = dataToProcess[partNumber];
            const phantom = findPhantomCandidate(partNumber);
            
            if (phantom) {
                const systemStock = data.systemStock || phantom.currentStock || 0;
                const actualCount = parseInt(data.actualCount) || 0;
                const isPhantom = systemStock > actualCount; // True phantom if system shows more than actual
                
                validationResults.push({
                    partNumber: partNumber,
                    systemStock: systemStock,
                    actualCount: actualCount,
                    wasPhantom: isPhantom,
                    riskScore: phantom.riskScore,
                    category: phantom.category,
                    unitCost: phantom.unitCost,
                    riskFactors: phantom.riskFactors,
                    notes: data.notes || '',
                    verifiedBy: data.verifiedBy || 'Unknown',
                    verificationDate: new Date().toISOString()
                });
            }
        });
        
        // Allow finalization even if no validation results - user may want to finalize empty state
        if (validationResults.length === 0) {
            console.log('No validation results found, but allowing finalization to proceed.');
        }
        
        // Send validation results to ML system for learning
        console.log(`Sending ${validationResults.length} validation results to ML system...`);
        const mlFeedbackResult = await window.electronAPI.invoke('phantom-ml-feedback', validationResults);
        
        if (mlFeedbackResult.success) {
            // Update the phantom inventory state
            window.phantomInventoryState.validationData = {
                results: validationResults,
                summary: {
                    totalValidated: validationResults.length,
                    phantomsConfirmed: validationResults.filter(item => item.wasPhantom).length,
                    accuracy: mlFeedbackResult.data.accuracy || 0,
                    learningImprovement: mlFeedbackResult.data.learningImprovement || 0
                },
                completedAt: new Date().toISOString()
            };
            
            // Save state
            savePhantomInventoryState();
            
            // NEW: Handle sheet progression
            if (mlFeedbackResult.data.sheetCompletion) {
                const { sheetCompletion } = mlFeedbackResult.data;
                
                // Clear verification tracking for completed sheet
                window.phantomInventoryState.verificationTracking = {};
                
                if (sheetCompletion.hasNextSheet && sheetCompletion.nextSheet) {
                    // Move to next sheet
                    const nextSheetNum = sheetCompletion.nextSheet.id + 1;
                    
                    await showAlert(
                        `✅ Sheet ${sheetCompletion.completedSheet.id + 1} completed successfully!\n\n` +
                        `🎯 ML accuracy improved by ${(mlFeedbackResult.data.learningImprovement || 0).toFixed(1)}%\n` +
                        `📊 System accuracy: ${(mlFeedbackResult.data.accuracy || 0).toFixed(1)}%\n\n` +
                        `Moving to Sheet ${nextSheetNum} (${sheetCompletion.nextSheet.items.length} items)...`,
                        'success'
                    );
                    
                    // Initialize verification tracking for next sheet
                    sheetCompletion.nextSheet.items.forEach(item => {
                        window.phantomInventoryState.verificationTracking[item.partNumber] = {
                            partNumber: item.partNumber,
                            description: item.description,
                            systemStock: item.currentStock,
                            actualCount: item.currentStock,
                            verified: false,
                            notes: '',
                            verifiedBy: '',
                            verificationDate: null
                        };
                    });
                    
                    savePhantomInventoryState();
                    
                    // Refresh verification sheets to show next sheet
                    await refreshVerificationSheets();
                    
                    // Stay on verification tab to show next sheet
                    switchPhantomView('verification');
                    
                } else {
                    // All sheets completed
                    await showAlert(
                        `🎉 All verification sheets completed!\n\n` +
                        `✅ Processed ${validationResults.length} items in final sheet\n` +
                        `🎯 ML accuracy improved by ${(mlFeedbackResult.data.learningImprovement || 0).toFixed(1)}%\n` +
                        `📊 System accuracy: ${(mlFeedbackResult.data.accuracy || 0).toFixed(1)}%\n\n` +
                        `Total sheets completed: ${sheetCompletion.completedSheets}/${sheetCompletion.totalSheets}`,
                        'success'
                    );
                    
                    // Clear all verification data since all sheets are done
                    window.phantomInventoryState.verificationData = null;
                    savePhantomInventoryState();
                    
                    // Validation completed successfully
                    await showAlert('Validation completed successfully!', 'success');
                }
            } else {
                // Fallback to old behavior if no sheet completion data
                // Show success with option to delete verification sheets
                const deleteSheets = await showConfirmWithOptions(
                    'Validation completed successfully!', 
                    `✅ Processed ${validationResults.length} items\n` +
                    `🎯 ML accuracy improved by ${(mlFeedbackResult.data.learningImprovement || 0).toFixed(1)}%\n` +
                    `📊 System accuracy: ${(mlFeedbackResult.data.accuracy || 0).toFixed(1)}%\n\n` +
                    `Would you like to delete the verification sheets to clean up?`,
                    'Keep Sheets',
                    'Delete Sheets'
                );
                
                if (deleteSheets) {
                    // Delete verification sheets and clear verification tracking
                    window.phantomInventoryState.verificationTracking = {};
                    window.phantomInventoryState.verificationData = null;
                    savePhantomInventoryState();
                    await showAlert('Verification sheets deleted successfully.', 'success');
                }
                
                // Validation completed successfully
                await showAlert('Validation completed successfully!', 'success');
            }
            
        } else {
            await showAlert('Error processing validation results: ' + (mlFeedbackResult.error || 'Unknown error'), 'error');
        }
        
    } catch (error) {
        console.error('Error finalizing validation:', error);
        await showAlert('Error finalizing validation: ' + error.message, 'error');
    }
}



// Toggle verification input forms
function toggleVerificationInput() {
    const inputRows = document.querySelectorAll('.verification-input-row');
    const toggleText = document.getElementById('inputToggleText');
    const isVisible = inputRows.length > 0 && inputRows[0].style.display !== 'none';
    
    inputRows.forEach(row => {
        row.style.display = isVisible ? 'none' : 'table-row';
    });
    
    if (toggleText) {
        toggleText.textContent = isVisible ? 'Show Input Forms' : 'Hide Input Forms';
    }
}

// Update verification data
function updateVerificationData(partNumber, field, value) {
    if (!window.phantomInventoryState.verificationTracking) {
        window.phantomInventoryState.verificationTracking = {};
    }
    
    if (!window.phantomInventoryState.verificationTracking[partNumber]) {
        window.phantomInventoryState.verificationTracking[partNumber] = {
            partNumber: partNumber,
            actualCount: null,
            verified: false,
            notes: '',
            verifiedBy: '',
            verificationDate: null
        };
    }
    
    window.phantomInventoryState.verificationTracking[partNumber][field] = value;
    
    // Save state
    savePhantomInventoryState();
    
    console.log(`Updated ${field} for ${partNumber}: ${value}`);
}

// Mark item as verified
function markAsVerified(partNumber) {
    if (!window.phantomInventoryState.verificationTracking || !window.phantomInventoryState.verificationTracking[partNumber]) {
        showAlert('Please enter verification data first.', 'warning');
        return;
    }
    
    const data = window.phantomInventoryState.verificationTracking[partNumber];
    
    // Validate required fields
    if (data.actualCount === null || data.actualCount === '') {
        showAlert('Please enter the actual count before marking as verified.', 'warning');
        return;
    }
    
    // Mark as verified
    data.verified = true;
    data.verificationDate = new Date().toISOString();
    
    // Update button text
    const button = event.target;
    button.textContent = '✓ Verified';
    button.disabled = true;
    button.classList.remove('btn-success');
    button.classList.add('btn-secondary');
    
    // Save state
    savePhantomInventoryState();
    
    showAlert(`Item ${partNumber} marked as verified.`, 'success');
}

// Enhanced confirmation dialog with options
async function showConfirmWithOptions(title, message, option1 = 'Cancel', option2 = 'OK') {
    return new Promise((resolve) => {
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
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
        `;
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 24px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;
        
        modalContent.innerHTML = `
            <div class="modal-header">
                <h3 style="margin: 0 0 16px 0; color: #333;">${title}</h3>
            </div>
            <div class="modal-body">
                <p style="margin: 0 0 20px 0; white-space: pre-line; color: #666; line-height: 1.5;">${message}</p>
            </div>
            <div class="modal-actions" style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="confirmOption1" class="btn btn-secondary" style="padding: 8px 16px;">${option1}</button>
                <button id="confirmOption2" class="btn btn-primary" style="padding: 8px 16px;">${option2}</button>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Handle button clicks
        document.getElementById('confirmOption1').addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(false);
        });
        
        document.getElementById('confirmOption2').addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(true);
        });
        
        // Handle escape key and overlay click
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
                document.removeEventListener('keydown', handleEscape);
                resolve(false);
            }
        };
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                document.removeEventListener('keydown', handleEscape);
                resolve(false);
            }
        });
        
        document.addEventListener('keydown', handleEscape);
        
        // Focus the primary button
        setTimeout(() => {
            document.getElementById('confirmOption2').focus();
        }, 100);
    });
}



// ============================================================================
// FEEDBACK MODAL FUNCTIONS
// ============================================================================

let currentFeedbackData = null;

function showFeedbackModal(index, sku, description, tinkQty) {
    console.log('Showing feedback modal for:', { index, sku, description, tinkQty });
    
    // Store current feedback data
    currentFeedbackData = {
        index: index,
        sku: sku,
        description: description,
        tinkRecommendation: tinkQty,
        timestamp: new Date().toISOString(),
        storeId: window.currentStore || 'unknown'
    };
    
    // Populate modal with item information
    document.getElementById('feedbackSku').textContent = sku;
    document.getElementById('feedbackDescription').textContent = description;
    document.getElementById('feedbackTinkQty').textContent = tinkQty;
    
    // Reset modal state
    resetFeedbackModal();
    
    // Show modal
    document.getElementById('feedbackModal').style.display = 'flex';
}

function closeFeedbackModal() {
    document.getElementById('feedbackModal').style.display = 'none';
    currentFeedbackData = null;
    resetFeedbackModal();
}

function resetFeedbackModal() {
    // Clear all selected states
    document.querySelectorAll('.feedback-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Hide quantity section
    document.getElementById('quantitySection').style.display = 'none';
    
    // Clear inputs
    document.getElementById('feedbackQuantity').value = '';
    document.getElementById('feedbackComment').value = '';
}

function selectFeedbackType(type) {
    console.log('Selected feedback type:', type);
    
    // Update current feedback data
    currentFeedbackData.feedbackType = type;
    
    // Clear previous selections
    document.querySelectorAll('.feedback-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Mark selected button
    event.target.classList.add('selected');
    
    // Show/hide quantity section based on type
    const quantitySection = document.getElementById('quantitySection');
    if (type === 'too-much' || type === 'not-enough') {
        quantitySection.style.display = 'block';
        
        // Pre-populate with a suggested value
        const currentQty = currentFeedbackData.tinkRecommendation;
        let suggestedQty = currentQty;
        
        if (type === 'too-much') {
            suggestedQty = Math.max(0, Math.floor(currentQty * 0.7)); // Suggest 30% less
        } else if (type === 'not-enough') {
            suggestedQty = Math.ceil(currentQty * 1.5); // Suggest 50% more
        }
        
        document.getElementById('feedbackQuantity').value = suggestedQty;
    } else {
        quantitySection.style.display = 'none';
    }
}

async function submitFeedback() {
    if (!currentFeedbackData || !currentFeedbackData.feedbackType) {
        alert('Please select a feedback type before submitting.');
        return;
    }
    
    // Collect feedback data
    const feedbackData = {
        ...currentFeedbackData,
        managerRecommendation: document.getElementById('feedbackQuantity').value || null,
        comments: document.getElementById('feedbackComment').value || '',
        submittedAt: new Date().toISOString()
    };
    
    console.log('Submitting feedback:', feedbackData);
    
    try {
        // Save feedback to persistent storage
        await saveFeedbackData(feedbackData);
        
        // Process feedback for ML learning
        await processFeedbackForML(feedbackData);
        
        // Apply feedback to UI immediately
        applyFeedbackToOrderUI(feedbackData);
        
        // Show success message
        alert('Thank you for your feedback! This will help improve Tink\'s recommendations.');
        
        // Close modal
        closeFeedbackModal();
        
    } catch (error) {
        console.error('Error submitting feedback:', error);
        alert('Error submitting feedback. Please try again.');
    }
}

async function saveFeedbackData(feedbackData) {
    try {
        // Get existing feedback data
        let allFeedback = JSON.parse(localStorage.getItem('tinkFeedbackData') || '[]');
        
        // Add new feedback
        allFeedback.push(feedbackData);
        
        // Keep only last 1000 feedback entries to prevent storage bloat
        if (allFeedback.length > 1000) {
            allFeedback = allFeedback.slice(-1000);
        }
        
        // Save back to localStorage
        localStorage.setItem('tinkFeedbackData', JSON.stringify(allFeedback));
        
        console.log('Feedback saved to localStorage:', feedbackData);
        
        // Also try to save to main process for cross-store sharing
        if (window.electronAPI && window.electronAPI.invoke) {
            await window.electronAPI.invoke('save-feedback-data', feedbackData);
        }
        
    } catch (error) {
        console.error('Error saving feedback data:', error);
        throw error;
    }
}

async function processFeedbackForML(feedbackData) {
    try {
        // Add to learning data for the reports section
        addToLearningData('feedback', {
            type: 'order_feedback',
            sku: feedbackData.sku,
            description: feedbackData.description,
            tinkRecommendation: feedbackData.tinkRecommendation,
            managerRecommendation: feedbackData.managerRecommendation,
            feedbackType: feedbackData.feedbackType,
            comments: feedbackData.comments,
            storeId: feedbackData.storeId,
            timestamp: feedbackData.timestamp
        });
        
        // Here you would integrate with your ML pipeline
        // For now, we'll simulate ML processing
        console.log('Processing feedback for ML learning:', {
            sku: feedbackData.sku,
            originalRecommendation: feedbackData.tinkRecommendation,
            managerRecommendation: feedbackData.managerRecommendation,
            feedbackType: feedbackData.feedbackType,
            improvement: calculateImprovementMetric(feedbackData)
        });
        
    } catch (error) {
        console.error('Error processing feedback for ML:', error);
    }
}

function calculateImprovementMetric(feedbackData) {
    const tinkQty = parseInt(feedbackData.tinkRecommendation) || 0;
    const managerQty = parseInt(feedbackData.managerRecommendation) || 0;
    
    if (feedbackData.feedbackType === 'not-needed') {
        return { type: 'elimination', originalQty: tinkQty, suggestedQty: 0 };
    } else if (feedbackData.feedbackType === 'too-much') {
        return { type: 'reduction', originalQty: tinkQty, suggestedQty: managerQty, reduction: tinkQty - managerQty };
    } else if (feedbackData.feedbackType === 'not-enough') {
        return { type: 'increase', originalQty: tinkQty, suggestedQty: managerQty, increase: managerQty - tinkQty };
    }
    
    return { type: 'unknown' };
}

function applyFeedbackToOrderUI(feedbackData) {
    console.log('Applying feedback to order UI:', feedbackData);
    
    const orderTableBody = document.getElementById('orderTableBody');
    if (!orderTableBody) return;
    
    const rowIndex = feedbackData.index;
    const row = orderTableBody.children[rowIndex];
    
    if (!row) {
        console.warn('Could not find row for index:', rowIndex);
        return;
    }
    
    const qtyInput = row.querySelector('.qty-input');
    if (!qtyInput) {
        console.warn('Could not find quantity input in row:', rowIndex);
        return;
    }
    
    let newQuantity = 0;
    
    switch (feedbackData.feedbackType) {
        case 'not-needed':
            // Remove the item from the order
            newQuantity = 0;
            break;
            
        case 'too-much':
        case 'not-enough':
            // Use manager's recommended quantity
            newQuantity = parseInt(feedbackData.managerRecommendation) || 0;
            break;
            
        default:
            console.warn('Unknown feedback type:', feedbackData.feedbackType);
            return;
    }
    
    // Update the quantity input
    qtyInput.value = newQuantity;
    
    // If quantity is 0, remove the row entirely
    if (newQuantity === 0) {
        row.remove();
        
        // Reindex remaining rows
        Array.from(orderTableBody.children).forEach((remainingRow, newIndex) => {
            remainingRow.cells[0].textContent = newIndex + 1;
            
            // Update all relevant onclick handlers in this row
            const minusBtn = remainingRow.querySelector('.minus-btn');
            const plusBtn = remainingRow.querySelector('.plus-btn');
            const qtyInputInRow = remainingRow.querySelector('.qty-input');
            const wtfBtn = remainingRow.querySelector('.btn-warning');
            const deleteBtn = remainingRow.querySelector('.btn-danger');
            
            if (minusBtn && qtyInputInRow) {
                const minOrderQty = parseInt(qtyInputInRow.dataset.minOrderQty) || 1;
                minusBtn.setAttribute('onclick', `adjustQuantity(${newIndex}, -${minOrderQty})`);
            }
            if (plusBtn && qtyInputInRow) {
                const minOrderQty = parseInt(qtyInputInRow.dataset.minOrderQty) || 1;
                plusBtn.setAttribute('onclick', `adjustQuantity(${newIndex}, ${minOrderQty})`);
            }
            if (qtyInputInRow) {
                qtyInputInRow.dataset.index = newIndex;
                qtyInputInRow.setAttribute('onchange', `updateRowTotal(${newIndex})`);
            }
            if (wtfBtn) {
                const sku = remainingRow.cells[1].textContent.trim();
                const description = remainingRow.cells[2].textContent.trim();
                const currentQty = qtyInputInRow ? qtyInputInRow.value : 0;
                wtfBtn.setAttribute('onclick', `showFeedbackModal(${newIndex}, '${sku}', '${description}', ${currentQty})`);
            }
            if (deleteBtn) {
                deleteBtn.setAttribute('onclick', `removeOrderItem(${newIndex})`);
            }
        });
    } else {
        // Update the row total
        updateRowTotal(rowIndex);
    }
    
    // Update the overall order total
    updateOrderTotal();
    
    // Save the updated order data
    const currentOrderData = getCurrentOrderData();
    savePersistentOrderData(currentOrderData);
    
    console.log('Feedback applied successfully. New quantity:', newQuantity);
}

function getCurrentOrderData() {
    const orderTableBody = document.getElementById('orderTableBody');
    if (!orderTableBody) return [];
    
    const orderData = [];
    Array.from(orderTableBody.children).forEach(row => {
        const sku = row.cells[1].textContent.trim();
        const description = row.cells[2].textContent.trim();
        const currentStock = row.cells[3].textContent.trim();
        const onOrder = row.cells[4].textContent.trim();
        const qtyInput = row.querySelector('.qty-input');
        const costCell = row.cells[6];
        
        if (sku && qtyInput) {
            let cost = 0;
            const costDiv = costCell.querySelector('div');
            if (costDiv) {
                const costMatch = costDiv.textContent.match(/\$?(\d+\.?\d*)/);
                if (costMatch) {
                    cost = parseFloat(costMatch[1]);
                }
            }
            
            orderData.push({
                partNumber: sku,
                sku: sku,
                description: description,
                currentStock: parseInt(currentStock) || 0,
                onOrder: parseInt(onOrder) || 0,
                suggestedQty: parseInt(qtyInput.value) || 0,
                cost: cost,
                minOrderQty: parseInt(qtyInput.dataset.minOrderQty) || 1
            });
        }
    });
    
    return orderData;
}

// ============================================================================
// PERSISTENT ORDER DATA FUNCTIONS
// ============================================================================

function savePersistentOrderData(orderData) {
    try {
        const persistentData = {
            orderData: orderData,
            orderTotal: calculateOrderTotal(orderData),
            savedAt: new Date().toISOString(),
            inventoryFile: window.selectedFile || null
        };
        
        localStorage.setItem('tinkPersistentOrderData', JSON.stringify(persistentData));
        console.log('Order data saved to persistent storage');
        
        // Also save to main process for cross-session persistence
        if (window.electronAPI && window.electronAPI.invoke) {
            window.electronAPI.invoke('save-persistent-order-data', persistentData);
        }
    } catch (error) {
        console.error('Error saving persistent order data:', error);
    }
}

function loadPersistentOrderData() {
    try {
        const stored = localStorage.getItem('tinkPersistentOrderData');
        if (stored) {
            const persistentData = JSON.parse(stored);
            console.log('Loading persistent order data:', persistentData);
            
            // Restore order data
            if (persistentData.orderData && persistentData.orderData.length > 0) {
                populateOrderTable(persistentData.orderData);
                updateOrderTotal();
            }
            
            // Restore inventory file info if available
            if (persistentData.inventoryFile) {
                window.selectedFile = persistentData.inventoryFile;
                updateFileInfo(persistentData.inventoryFile);
            }
            
            return persistentData;
        }
    } catch (error) {
        console.error('Error loading persistent order data:', error);
    }
    return null;
}

function clearOrderData() {
    console.log('Clearing all order data and resetting UI...');
    
    // Show confirmation dialog
    if (!confirm('This will clear all order data and inventory file. Are you sure you want to continue?')) {
        return;
    }
    
    try {
        // Clear order table
        const orderTableBody = document.getElementById('orderTableBody');
        if (orderTableBody) {
            orderTableBody.innerHTML = '';
        }
        
        // Reset order total
        const orderTotalElement = document.getElementById('orderTotalAmount');
        if (orderTotalElement) {
            orderTotalElement.textContent = '$0.00';
        }
        
        // Clear file input and info
        const fileInput = document.getElementById('fileInput');
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        
        if (fileInput) fileInput.value = '';
        if (fileInfo) fileInfo.style.display = 'none';
        if (fileName) fileName.textContent = '';
        if (fileSize) fileSize.textContent = '';
        
        // Reset global variables
        window.selectedFile = null;
        window.latestInventoryData = null;
        
        // Clear persistent storage
        localStorage.removeItem('tinkPersistentOrderData');
        
        // Clear from main process
        if (window.electronAPI && window.electronAPI.invoke) {
            window.electronAPI.invoke('clear-persistent-order-data');
            window.electronAPI.invoke('clear-persistent-inventory');
        }
        
        // Disable run button
        const runBtn = document.getElementById('runSuggestedOrderBtn');
        if (runBtn) {
            runBtn.disabled = true;
        }
        
        console.log('Order data cleared successfully');
        alert('Order data and inventory file cleared successfully. You can now import a new inventory file.');
        
    } catch (error) {
        console.error('Error clearing order data:', error);
        alert('Error clearing order data. Please try again.');
    }
}

function calculateOrderTotal(orderData) {
    if (!orderData || !Array.isArray(orderData)) return 0;
    
    return orderData.reduce((total, item) => {
        const cost = parseFloat(item.cost) || 0;
        const qty = parseInt(item.suggestedQty) || 0;
        return total + (cost * qty);
    }, 0);
}

function updateFileInfo(file) {
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    
    if (fileInfo && fileName && fileSize) {
        fileName.textContent = file.name || 'Unknown';
        fileSize.textContent = file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Unknown';
        fileInfo.style.display = 'block';
    }
}

// ============================================================================
// STORE MANAGEMENT FUNCTIONS
// ============================================================================

async function changePhantomStore(storeId) {
    console.log('Changing phantom store to:', storeId);
    
    if (!storeId) {
        console.warn('No store ID provided');
        return;
    }
    
    // Update the phantom state with the new store
    if (!window.phantomInventoryState) {
        window.phantomInventoryState = {};
    }
    
    try {
        // Save store preference if remember checkbox is checked
        const rememberCheckbox = document.getElementById('rememberPhantomStore');
        if (rememberCheckbox && rememberCheckbox.checked) {
            savePreferredPhantomStore(storeId);
        }
        
        // Initialize the phantom system for the new store
        await initializePhantomForStore(storeId);
        
        // Success message will be shown by initializePhantomForStore if successful
    } catch (error) {
        console.error('Error in changePhantomStore:', error);
        showAlert('Failed to switch to store ' + storeId + ': ' + error.message, 'error');
    }
}

async function initializePhantomForStore(storeId) {
    try {
        console.log('Initializing phantom system for store:', storeId);
        
        // Use the correct phantom-change-store handler
        const result = await window.electronAPI.invoke('phantom-change-store', storeId);
        
        if (result.success) {
            // Update the phantom state
            const storeInfo = getStoreDisplayName(storeId);
            window.phantomInventoryState.currentStore = {
                id: storeId,
                displayName: storeInfo
            };
            window.phantomInventoryState.settings = {
                enableMLLearning: true,
                enableNetworkSync: true
            };
            
            console.log('Phantom system initialized successfully for store:', storeId);
            showAlert(`Switched to store ${storeInfo}. Phantom system initialized.`, 'success');
        } else {
            console.error('Failed to initialize phantom system:', result.error);
            showAlert('Error initializing phantom system: ' + result.error, 'error');
        }
        
    } catch (error) {
        console.error('Error initializing phantom system:', error);
        showAlert('Error initializing phantom system: ' + error.message, 'error');
    }
}

function getStoreDisplayName(storeId) {
    const storeMap = {
        '16719': '16719 - Fairview',
        '17521': '17521 - Eagle', 
        '18179': '18179 - Broadway',
        '18181': '18181 - State'
    };
    return storeMap[storeId] || `Store ${storeId}`;
}

// ============================================================================
// PHANTOM STORE PREFERENCE MANAGEMENT
// ============================================================================

function savePreferredPhantomStore(storeId) {
    try {
        localStorage.setItem('preferredPhantomStore', storeId);
        console.log('Saved preferred phantom store:', storeId);
    } catch (error) {
        console.error('Failed to save preferred phantom store:', error);
    }
}

function loadPreferredPhantomStore() {
    try {
        const savedStore = localStorage.getItem('preferredPhantomStore');
        console.log('Loaded preferred phantom store:', savedStore);
        return savedStore;
    } catch (error) {
        console.error('Failed to load preferred phantom store:', error);
        return null;
    }
}

function clearPreferredPhantomStore() {
    try {
        localStorage.removeItem('preferredPhantomStore');
        console.log('Cleared preferred phantom store');
    } catch (error) {
        console.error('Failed to clear preferred phantom store:', error);
    }
}

function setupPhantomStorePreference() {
    const rememberCheckbox = document.getElementById('rememberPhantomStore');
    const storeSelect = document.getElementById('phantomStoreSelect');
    
    if (!rememberCheckbox || !storeSelect) {
        console.log('Phantom store preference elements not found');
        return;
    }
    
    // Load saved preference on setup
    const savedStore = loadPreferredPhantomStore();
    if (savedStore) {
        storeSelect.value = savedStore;
        rememberCheckbox.checked = true;
        console.log('Applied saved phantom store preference:', savedStore);
        
        // Update phantom state with saved store
        if (window.phantomInventoryState) {
            window.phantomInventoryState.currentStore = {
                id: savedStore,
                displayName: getStoreDisplayName(savedStore)
            };
        }
    }
    
    // Handle remember checkbox changes
    rememberCheckbox.addEventListener('change', (e) => {
        if (!e.target.checked) {
            // If unchecked, clear the saved preference
            clearPreferredPhantomStore();
        } else if (storeSelect.value) {
            // If checked and store is selected, save it
            savePreferredPhantomStore(storeSelect.value);
        }
    });
}

function displayPhantomResults(data) {
    const phantomResults = document.getElementById('phantomResults');
    const phantomTableBody = document.getElementById('phantomTableBody');
    
    if (!phantomResults || !phantomTableBody) {
        console.error('Phantom results elements not found');
        return;
    }
    
    // Clear existing results
    phantomTableBody.innerHTML = '';
    
    // Show results container
    phantomResults.style.display = 'block';
    
    // Process and display phantom candidates
    if (data.phantomCandidates && data.phantomCandidates.length > 0) {
        data.phantomCandidates.forEach(item => {
            const row = document.createElement('tr');
            const moverTypeClass = item.moverType === 'fast-mover' ? 'fast-mover' : 'slow-mover';
            const velocityText = item.moverType === 'fast-mover' ? 
                `${item.baselineVelocity?.toFixed(1) || '0.0'}/wk` : 
                `${item.baselineVelocity?.toFixed(1) || '0.0'}/wk`;
            
            row.innerHTML = `
                <td><input type="checkbox" class="phantom-checkbox" data-partnumber="${item.partNumber}"></td>
                <td>${item.partNumber || 'N/A'}</td>
                <td>${item.description || 'N/A'}</td>
                <td>${item.currentStock || item.systemStock || 0}</td>
                <td><span class="mover-type ${moverTypeClass}">${item.moverType === 'fast-mover' ? 'Fast' : 'Slow'}</span></td>
                <td>${velocityText}</td>
                <td>$${(item.unitCost || 0).toFixed(2)}</td>
                <td><span class="risk-score" data-risk="${item.riskScore}">${item.riskScore}</span></td>
                <td class="risk-factors">
                    ${item.riskFactors.map(factor => `<span class="risk-factor">${factor}</span>`).join('')}
                </td>
            `;
            phantomTableBody.appendChild(row);
        });
        
        // Update summary
        updatePhantomSummary(data);
    } else {
        phantomTableBody.innerHTML = '<tr><td colspan="9">No phantom inventory candidates found.</td></tr>';
    }
    
    // Add sorting functionality
    addPhantomTableSorting();
    
    // Add filtering functionality
    addPhantomTableFiltering();
    
    // Initialize filter count
    updateFilterCount();
    
    // Load verification and system stats
    loadSystemStats();
}

function addPhantomTableSorting() {
    const sortableHeaders = document.querySelectorAll('.phantom-table .sortable');
    
    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const sortBy = header.dataset.sort;
            const isCurrentlyAsc = header.classList.contains('sorted-asc');
            
            // Remove existing sort classes
            sortableHeaders.forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
            
            // Add new sort class
            if (isCurrentlyAsc) {
                header.classList.add('sorted-desc');
                sortPhantomTable(sortBy, 'desc');
            } else {
                header.classList.add('sorted-asc');
                sortPhantomTable(sortBy, 'asc');
            }
        });
    });
}

function sortPhantomTable(sortBy, direction) {
    const tableBody = document.getElementById('phantomTableBody');
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    
    rows.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortBy) {
            case 'partNumber':
                aValue = a.cells[1].textContent.trim();
                bValue = b.cells[1].textContent.trim();
                break;
            case 'description':
                aValue = a.cells[2].textContent.trim();
                bValue = b.cells[2].textContent.trim();
                break;
            case 'stock':
                aValue = parseInt(a.cells[3].textContent.trim()) || 0;
                bValue = parseInt(b.cells[3].textContent.trim()) || 0;
                break;
            case 'moverType':
                aValue = a.cells[4].textContent.trim();
                bValue = b.cells[4].textContent.trim();
                // Fast movers should come first in ascending order
                if (aValue === 'Fast' && bValue === 'Slow') return -1;
                if (aValue === 'Slow' && bValue === 'Fast') return 1;
                return 0;
            case 'velocity':
                aValue = parseFloat(a.cells[5].textContent.replace('/wk', '')) || 0;
                bValue = parseFloat(b.cells[5].textContent.replace('/wk', '')) || 0;
                break;
            case 'unitCost':
                aValue = parseFloat(a.cells[5].textContent.replace('$', '')) || 0;
                bValue = parseFloat(b.cells[5].textContent.replace('$', '')) || 0;
                break;
            case 'riskScore':
                aValue = parseInt(a.cells[7].textContent.trim()) || 0;
                bValue = parseInt(b.cells[7].textContent.trim()) || 0;
                break;
            default:
                return 0;
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        } else {
            return direction === 'asc' ? aValue - bValue : bValue - aValue;
        }
    });
    
    // Clear and repopulate table
    tableBody.innerHTML = '';
    rows.forEach(row => tableBody.appendChild(row));
    
    // Update filter count
    updateFilterCount();
}

function addPhantomTableFiltering() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const filterType = button.dataset.filter;
            
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Apply filter
            filterPhantomTable(filterType);
        });
    });
}

function filterPhantomTable(filterType) {
    const tableBody = document.getElementById('phantomTableBody');
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    
    rows.forEach(row => {
        const moverTypeCell = row.cells[4]; // Type column
        const moverTypeText = moverTypeCell.textContent.trim();
        
        let shouldShow = true;
        
        switch (filterType) {
            case 'fast':
                shouldShow = moverTypeText === 'Fast';
                break;
            case 'slow':
                shouldShow = moverTypeText === 'Slow';
                break;
            case 'all':
            default:
                shouldShow = true;
                break;
        }
        
        row.style.display = shouldShow ? '' : 'none';
    });
    
    // Update filter count
    updateFilterCount();
}

function updateFilterCount() {
    const tableBody = document.getElementById('phantomTableBody');
    const visibleRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => row.style.display !== 'none');
    const filterCountElement = document.getElementById('filterCount');
    
    if (filterCountElement) {
        filterCountElement.textContent = `Showing ${visibleRows.length} items`;
    }
}

function updatePhantomSummary(data) {
    const summaryElement = document.getElementById('phantomSummary');
    if (summaryElement) {
        const totalItems = data.totalItems || 0;
        const itemsWithStock = data.itemsWithStock || 0;
        const phantomCandidates = data.phantomCandidates ? data.phantomCandidates.length : 0;
        const fastMovers = data.phantomCandidates ? data.phantomCandidates.filter(item => item.moverType === 'fast-mover').length : 0;
        const slowMovers = data.phantomCandidates ? data.phantomCandidates.filter(item => item.moverType === 'slow-mover').length : 0;
        
        summaryElement.innerHTML = `
            <div class="summary-stats">
                <div class="stat">
                    <span class="stat-value">${totalItems}</span>
                    <span class="stat-label">Total Items</span>
                </div>
                <div class="stat">
                    <span class="stat-value">${phantomCandidates}</span>
                    <span class="stat-label">Phantom Candidates</span>
                </div>
                <div class="stat">
                    <span class="stat-value">${fastMovers}</span>
                    <span class="stat-label">Fast Movers</span>
                </div>
                <div class="stat">
                    <span class="stat-value">${slowMovers}</span>
                    <span class="stat-label">Slow Movers</span>
                </div>
            </div>
        `;
    }
}

function handleVerifySelected() {
    const selectedItems = document.querySelectorAll('#phantomTableBody input[type="checkbox"]:checked');
    console.log(`Verifying ${selectedItems.length} selected items`);
}

function handleExportPhantomResults() {
    console.log('Exporting phantom results...');
    // Implement export functionality
}

function handleSelectAllPhantoms(event) {
    const checkboxes = document.querySelectorAll('#phantomTableBody input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = event.target.checked;
    });
}

// ============================================================================
// PHANTOM SYSTEM SETUP FUNCTIONALITY
// ============================================================================

async function checkPhantomSystemStatus() {
    console.log('Checking phantom system status...');
    
    const statusIcon = document.getElementById('phantomStatusIcon');
    const statusText = document.getElementById('phantomStatusText');
    const storeInfo = document.getElementById('phantomStoreInfo');
    const currentStore = document.getElementById('phantomCurrentStore');
    const storeSelection = document.getElementById('phantomStoreSelection');
    const storeSelect = document.getElementById('phantomStoreSelect');
    const initializeBtn = document.getElementById('initializePhantomBtn');
    const systemInfoBtn = document.getElementById('phantomSystemInfoBtn');
    const runPhantomBtn = document.getElementById('runPhantomInventoryBtn');
    
    // Check if phantom system elements exist in the current window
    if (!statusIcon && !statusText && !storeInfo) {
        console.log('Phantom system UI elements not found in current window - skipping phantom status check');
        return;
    }
    
    try {
        const statusCheck = await window.electronAPI.invoke('phantom-get-status');
        console.log('Phantom system status:', statusCheck);
        
        if (statusCheck.success && statusCheck.data) {
            const status = statusCheck.data;
            
            if (status.isSetup && status.isInitialized) {
                // System is ready
                updatePhantomSystemStatus(
                    '✅', 'status-ready',
                    'System Ready - Phantom inventory detection is active',
                    status.currentStore?.displayName || 'Unknown'
                );
                
                // Show store info, hide selection (only if elements exist)
                if (storeInfo) storeInfo.style.display = 'block';
                if (storeSelection) storeSelection.style.display = 'none';
                if (initializeBtn) initializeBtn.style.display = 'none';
                if (systemInfoBtn) systemInfoBtn.style.display = 'block';
                
                // Enable phantom detection button
                if (runPhantomBtn) runPhantomBtn.disabled = false;
                
            } else if (status.isSetup && !status.isInitialized) {
                // System is set up but not initialized
                updatePhantomSystemStatus(
                    '⚠️', 'status-warning',
                    'System needs initialization',
                    status.currentStore?.displayName || 'Unknown'
                );
                
                // Pre-select the store and show initialize button (only if elements exist)
                if (storeSelect) storeSelect.value = status.currentStore?.id || '';
                if (storeInfo) storeInfo.style.display = 'block';
                if (storeSelection) storeSelection.style.display = 'none';
                if (initializeBtn) {
                    initializeBtn.style.display = 'block';
                    initializeBtn.disabled = false;
                    initializeBtn.textContent = 'Initialize Phantom System';
                }
                if (systemInfoBtn) systemInfoBtn.style.display = 'none';
                
                // Disable phantom detection button
                if (runPhantomBtn) runPhantomBtn.disabled = true;
                
            } else {
                // System is not set up
                updatePhantomSystemStatus(
                    '🔧', 'status-info',
                    'System needs setup - Select your store to begin',
                    null
                );
                
                // Show store selection (only if elements exist)
                if (storeInfo) storeInfo.style.display = 'none';
                if (storeSelection) storeSelection.style.display = 'block';
                if (initializeBtn) {
                    initializeBtn.style.display = 'block';
                    initializeBtn.disabled = true;
                    initializeBtn.textContent = 'Initialize Phantom System';
                }
                if (systemInfoBtn) systemInfoBtn.style.display = 'none';
                
                // Disable phantom detection button
                if (runPhantomBtn) runPhantomBtn.disabled = true;
            }
        } else {
            // Error getting status
            updatePhantomSystemStatus(
                '❌', 'status-error',
                'Error checking system status',
                null
            );
            
            if (storeInfo) storeInfo.style.display = 'none';
            if (storeSelection) storeSelection.style.display = 'block';
            if (initializeBtn) {
                initializeBtn.style.display = 'block';
                initializeBtn.disabled = true;
            }
            if (systemInfoBtn) systemInfoBtn.style.display = 'none';
            
            if (runPhantomBtn) runPhantomBtn.disabled = true;
        }
    } catch (error) {
        console.error('Error checking phantom system status:', error);
        updatePhantomSystemStatus(
            '❌', 'status-error',
            'Failed to check system status',
            null
        );
        
        if (storeInfo) storeInfo.style.display = 'none';
        if (storeSelection) storeSelection.style.display = 'block';
        if (initializeBtn) {
            initializeBtn.style.display = 'block';
            initializeBtn.disabled = true;
        }
        if (systemInfoBtn) systemInfoBtn.style.display = 'none';
        
        if (runPhantomBtn) runPhantomBtn.disabled = true;
    }
}

function updatePhantomSystemStatus(icon, iconClass, text, storeName) {
    const statusIcon = document.getElementById('phantomStatusIcon');
    const statusText = document.getElementById('phantomStatusText');
    const currentStore = document.getElementById('phantomCurrentStore');
    
    if (statusIcon) {
        statusIcon.textContent = icon;
        statusIcon.className = `status-icon ${iconClass}`;
    }
    
    if (statusText) {
        statusText.textContent = text;
    }
    
    if (currentStore && storeName) {
        currentStore.textContent = storeName;
    }
}

async function handlePhantomSystemInitialization() {
    console.log('Phantom system initialization requested');
    
    const storeSelect = document.getElementById('phantomStoreSelect');
    const initializeBtn = document.getElementById('initializePhantomBtn');
    
    if (!storeSelect) {
        console.log('Phantom store select element not found');
        return;
    }
    
    if (!storeSelect.value) {
        await showAlert('Please select a store first', 'warning');
        return;
    }
    
    try {
        // Show loading state
        updatePhantomSystemStatus('⏳', 'status-info', 'Initializing system...', null);
        if (initializeBtn) {
            initializeBtn.disabled = true;
            initializeBtn.textContent = 'Initializing...';
        }
        
        // Initialize the system
        const result = await window.electronAPI.invoke('phantom-complete-setup', storeSelect.value);
        
        if (result.success) {
            await showAlert('Phantom system initialized successfully!', 'success');
            // Refresh the status display
            checkPhantomSystemStatus();
        } else {
            await showAlert(`Failed to initialize phantom system: ${result.error}`, 'error');
            updatePhantomSystemStatus('❌', 'status-error', 'Initialization failed', null);
            if (initializeBtn) {
                initializeBtn.disabled = false;
                initializeBtn.textContent = 'Initialize Phantom System';
            }
        }
    } catch (error) {
        console.error('Error initializing phantom system:', error);
        await showAlert(`Error initializing phantom system: ${error.message}`, 'error');
        updatePhantomSystemStatus('❌', 'status-error', 'Initialization failed', null);
        if (initializeBtn) {
            initializeBtn.disabled = false;
            initializeBtn.textContent = 'Initialize Phantom System';
        }
    }
}

async function showPhantomSystemInfo() {
    try {
        const statusCheck = await window.electronAPI.invoke('phantom-get-status');
        if (statusCheck.success && statusCheck.data) {
            const status = statusCheck.data;
            const message = `
Phantom Inventory System Information:

Store: ${status.currentStore?.displayName || 'Unknown'}
System Status: ${status.isSetup ? 'Configured' : 'Not Configured'}
Initialization: ${status.isInitialized ? 'Active' : 'Inactive'}
Detector Ready: ${status.phantomDetectorReady ? 'Yes' : 'No'}

The phantom inventory system identifies items that show positive stock in the system but may not physically exist on the shelves.
            `;
            await showAlert(message, 'info');
        }
    } catch (error) {
        await showAlert('Error getting system information', 'error');
    }
}

// This function is now unified with the main showProcessingModal function above

function hideProcessingModal() {
    console.log('hideProcessingModal called');
    const robotContainer = document.getElementById('robotAnimationContainer');
    if (robotContainer) {
        robotContainer.style.display = 'none';
        console.log('Robot container hidden');
    }
}

// ============================================================================
// ORIGINAL RENDERER.JS CODE (Modified for tab compatibility)
// ============================================================================

let selectedFile = null;

// Make selectedFile globally accessible
window.selectedFile = null;

// DOM elements - Updated to match actual HTML structure
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const runSuggestedOrderBtn = document.getElementById('runSuggestedOrderBtn');
const runCheckAceNetBtn = document.getElementById('runCheckAceNetBtn');
const runCheckOnPlanogramBtn = document.getElementById('runCheckOnPlanogramBtn');
const runPhantomInventoryBtn = document.getElementById('runPhantomInventoryBtn');
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
let lastCheckType = 'acenet'; // Track the type of the last check performed

// Global storage for stock-out prediction results (for Excel export)
let globalStockOutResults = null;

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
    
    // Fix Input Fields functionality (now triggered from menu)
    function handleFixInputFields() {
        console.log('Manual accessibility fix triggered by user');
        forceInputFieldAccessibility();
        
        // Show notification since we don't have a button to change text
        showAlert('Input fields accessibility fixed!', 'success');
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
function showProcessingModal(stateId = 'processingState') {
    console.log('showProcessingModal called with stateId:', stateId);
    
    const robotAnimationContainer = document.getElementById('robotAnimationContainer');
    const states = ['processingState', 'stockOutSearchingState', 'phantomInventorySearchingState', 'completionState'];
    
    if (robotAnimationContainer) {
        robotAnimationContainer.style.display = 'flex';
        console.log('Robot container shown');
        
        // Hide all states
        states.forEach(state => {
            const element = document.getElementById(state);
            if (element) {
                element.style.display = 'none';
                console.log(`Hidden state: ${state}`);
            } else {
                console.log(`State element not found: ${state}`);
            }
        });
        
        // Show requested state
        const targetState = document.getElementById(stateId);
        if (targetState) {
            targetState.style.display = 'block';
            console.log(`Showing state: ${stateId}`);
        } else {
            console.error(`Target state not found: ${stateId}`);
        }
    } else {
        console.error('Robot container not found');
    }
}

function showStockOutProcessingModal() {
    const robotAnimationContainer = document.getElementById('robotAnimationContainer');
    if (robotAnimationContainer) {
        robotAnimationContainer.style.display = 'flex';
        
        // Reset modal state to stock-out searching
        const processingState = document.getElementById('processingState');
        const completionState = document.getElementById('completionState');
        const stockOutSearchingState = document.getElementById('stockOutSearchingState');
        
        if (processingState) {
            processingState.style.display = 'none';
        }
        if (completionState) {
            completionState.style.display = 'none';
        }
        if (stockOutSearchingState) {
            stockOutSearchingState.style.display = 'block';
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
        // Use the selected file directly instead of opening another dialog
        // In Electron, file.path should contain the full path
        selectedFile = {
            path: file.path || file.webkitRelativePath || file.name, // Use file.path for local files
            name: file.name,
            size: file.size
        };
        
        // Update global reference
        window.selectedFile = selectedFile;
        
        fileName.textContent = selectedFile.name;
        fileSize.textContent = formatFileSize(selectedFile.size);
        fileInfo.style.display = 'block';
        runSuggestedOrderBtn.disabled = false;
        runCheckAceNetBtn.disabled = false; // Enable AceNet button when file is selected
        runCheckOnPlanogramBtn.disabled = false; // Enable Planogram button when file is selected
        runPhantomInventoryBtn.disabled = false; // Enable Phantom Inventory button when file is selected
        
        console.log('File selected via input:', selectedFile);
        console.log('File path available:', !!file.path, 'Path:', file.path);
        console.log('File webkitRelativePath available:', !!file.webkitRelativePath, 'Path:', file.webkitRelativePath);
    }
});

// Phantom Inventory file selection handling
const phantomFileInput = document.getElementById('phantomFileInput');
const phantomFileName = document.getElementById('phantomFileName');
const phantomFileSize = document.getElementById('phantomFileSize');
const phantomFileInfo = document.getElementById('phantomFileInfo');

if (phantomFileInput) {
    phantomFileInput.addEventListener('click', async (e) => {
        e.preventDefault();
        
        try {
            // Use the same reliable file selection method as the main file input
            const result = await window.api.selectFile();
            if (result) {
                // Create a separate phantom file reference
                const phantomFile = {
                    path: result.path,
                    name: result.name,
                    size: result.size
                };
                
                // Store in a separate variable to avoid conflicting with main inventory
                window.phantomSelectedFile = phantomFile;
                
                // Update UI elements only if they exist
                if (phantomFileName) phantomFileName.textContent = phantomFile.name;
                if (phantomFileSize) phantomFileSize.textContent = formatFileSize(phantomFile.size);
                if (phantomFileInfo) phantomFileInfo.style.display = 'block';
                
                // Enable the phantom inventory button when a file is selected
                const runPhantomInventoryBtn = document.getElementById('runPhantomInventoryBtn');
                if (runPhantomInventoryBtn) {
                    runPhantomInventoryBtn.disabled = false;
                }
                
                console.log('Phantom file selected:', phantomFile);
                await showAlert(`Inventory file "${phantomFile.name}" loaded successfully for phantom analysis.`, 'success');
            }
        } catch (error) {
            console.error('Error selecting phantom file:', error);
            await showAlert('Error selecting file: ' + error.message, 'error');
        }
    });
}

const fileInputLabel = document.querySelector('.file-input-label');
if (fileInputLabel) {
    fileInputLabel.addEventListener('click', async (e) => {
        e.preventDefault();
        const result = await window.api.selectFile();
        if (result) {
            selectedFile = result;
            window.selectedFile = selectedFile; // Update global reference
            const fileName = document.getElementById('fileName');
            const fileSize = document.getElementById('fileSize');
            const fileInfo = document.getElementById('fileInfo');
            if (fileName) fileName.textContent = result.name;
            if (fileSize) fileSize.textContent = formatFileSize(result.size);
            if (fileInfo) fileInfo.style.display = 'block';
            
            const runSuggestedOrderBtn = document.getElementById('runSuggestedOrderBtn');
            const runCheckAceNetBtn = document.getElementById('runCheckAceNetBtn');
            const runCheckOnPlanogramBtn = document.getElementById('runCheckOnPlanogramBtn');
            const runPhantomInventoryBtn = document.getElementById('runPhantomInventoryBtn');
            
            if (runSuggestedOrderBtn) runSuggestedOrderBtn.disabled = false;
            if (runCheckAceNetBtn) runCheckAceNetBtn.disabled = false; // Enable AceNet button when file is selected
            if (runCheckOnPlanogramBtn) runCheckOnPlanogramBtn.disabled = false; // Enable Planogram button when file is selected
            if (runPhantomInventoryBtn) runPhantomInventoryBtn.disabled = false; // Enable Phantom Inventory button when file is selected
        }
    });
}

// Run Suggested Order button
runSuggestedOrderBtn.addEventListener('click', async () => {
    try {
            if (!selectedFile) {
        await showAlert('Please select an inventory file first', 'warning');
        return;
    }

        showProcessingModal();
        // Initialize step animations
        setTimeout(() => {
            initializeStepAnimation('processingState');
        }, 200);
        
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
        
        let processOptions = {
            scriptType: 'suggested_order',
            daysThreshold: daysThresholdValue,
            onOrderData: onOrderData // Pass the on order data to the analysis
        };
        
        // Check if we're using API data or file data
        if (selectedFile.isApiData) {
            processOptions.apiData = selectedFile.data;
            processOptions.filePath = null; // No file path for API data
        } else {
            processOptions.filePath = selectedFile.path;
        }
        
        const result = await window.api.processFile(processOptions);
        
        if (result.success) {
            console.log('Analysis result:', result);
            console.log('Order data received:', result.orderData);
            
            // EXTRACT LEARNING INSIGHTS FROM ANALYSIS RESULTS
            if (result.debug) {
                console.log('Extracting learning insights from analysis debug data...');
                
                // Create learning insights data structure
                const learningData = {
                    totalItems: result.debug.totalItems || 0,
                    orderCount: result.orderData?.length || 0,
                    recommendationCount: result.orderData?.length || 0,
                    seasonalSummary: {
                        seasonalItemsDetected: result.debug.seasonalItemsDetected || 0,
                        highVolatilityItems: result.debug.volatileItemsDetected || 0,
                        prePeakAdjustments: result.debug.seasonalPeakAdjustments || 0,
                        enhancedSafetyStock: result.debug.enhancedSafetyStockApplications || 0,
                        trendingUpItems: result.debug.trendingUpItems || 0,
                        trendingDownItems: result.debug.trendingDownItems || 0
                    },
                    trendSummary: {
                        decliningItems: result.debug.decliningItems || 0,
                        sharpRecentDecline: result.debug.sharpDeclineItems || 0,
                        declinedFromHistoricalHighs: result.debug.historicalHighDeclines || 0,
                        trendAdjustments: result.debug.trendAdjustmentsCount || 0
                    },
                    dataQualityIssues: result.debug.dataQualityIssues ? 
                        Array.from({length: result.debug.dataQualityIssues}, (_, i) => ({issues: `Data quality issue ${i+1}`})) : [],
                    correctionsApplied: result.debug.correctionsApplied || 0,
                    forecastAccuracy: result.debug.forecastAccuracyLog || [],
                    trendAdjustmentsCount: result.debug.trendAdjustmentsCount || 0,
                    overstockPreventionApplied: result.debug.overstockPrevention || 0
                };
                
                // Update learning insights with the extracted data
                updateLearningInsights(learningData);
            }
            
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
            lastCheckType = 'acenet'; // Track that this was a standard AceNet check
            
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

// Enhanced Phantom Inventory Detection button - opens popup window
// (Duplicate event listener removed - using the one at line 133 instead)



// Function to populate table with stock-out prediction data
function populateStockOutTable(stockOutData) {
    orderTableBody.innerHTML = '';
    
    stockOutData.forEach((item, index) => {
        // Calculate cost and total
        const cost = item.cost || 0;
        const suggestedQty = item.suggestedQty || 0;
        const total = cost * suggestedQty;
        
        // Get on order quantity for this SKU
        const sku = item.partNumber || item.sku || '';
        const onOrderQty = getOnOrderQuantity(sku);
        
        // Get minimum order quantity for this item
        const minOrderQty = item.minOrderQty || 1;
        
        // Create confidence badge
        const confidence = item.confidence || 0;
        const confidenceClass = confidence >= 70 ? 'high' : confidence >= 50 ? 'medium' : 'low';
        const confidenceBadge = `<span class="confidence-badge confidence-${confidenceClass}" title="Confidence: ${confidence}%">${confidence}%</span>`;
        
        // Create velocity info
        const velocityInfo = `
            <div title="Baseline: ${item.baselineVelocity?.toFixed(2) || 0}/week, Recent: ${item.recentVelocity?.toFixed(2) || 0}/week">
                Drop: ${item.dropPercentage?.toFixed(1) || 0}%
            </div>
        `;
        
        // Build row with stock-out specific information
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td title="${sku}">${sku}</td>
            <td title="${item.description || 'No Description'}">
                ${item.description || 'No Description'}
                <br><small style="color: #e94f37; font-size: 10px;">${confidenceBadge} ${velocityInfo}</small>
            </td>
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
            </td>
            <td class="total-cell" id="total-${index}">$${total.toFixed(2)}</td>
            <td class="actions-cell">
                <button class="btn btn-warning btn-sm btn-icon" onclick="showFeedbackModal(${index}, '${sku}', '${item.description || 'No Description'}', ${suggestedQty})" title="Provide feedback on this recommendation">
                    WTF
                </button>
                <button class="btn btn-danger btn-sm btn-icon" onclick="removeOrderItem(${index})" title="Delete item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6"></polyline>
                        <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
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
            <td class="actions-cell">
                <button class="btn btn-warning btn-sm btn-icon" onclick="showFeedbackModal(${index}, '${sku}', '${item.description || 'No Description'}', ${suggestedQty})" title="Provide feedback on this recommendation">
                    WTF
                </button>
                <button class="btn btn-danger btn-sm btn-icon" onclick="removeOrderItem(${index})" title="Delete item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6"></polyline>
                        <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
            </td>
        `;
        orderTableBody.appendChild(row);
    });
    // Add event listeners to quantity inputs
    document.querySelectorAll('.qty-input').forEach(input => {
        input.addEventListener('change', updateOrderTotal);
    });
    updateOrderTotal();
    
    // Save persistent order data
    savePersistentOrderData(orderData);
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
    console.log(`Attempting to remove item at index: ${index}, total rows: ${orderTableBody.children.length}`);
    
    // Validate index
    if (index < 0 || index >= orderTableBody.children.length) {
        console.error(`Invalid index ${index} for deletion. Valid range: 0-${orderTableBody.children.length - 1}`);
        return;
    }
    
    const row = orderTableBody.children[index];
    if (row) {
        row.remove();
        updateOrderTotal();
        
        console.log(`Row ${index} removed. Renumbering ${orderTableBody.children.length} remaining rows...`);
        
        // Renumber the remaining rows
        Array.from(orderTableBody.children).forEach((row, newIndex) => {
            row.cells[0].textContent = newIndex + 1;
            
            // Update all relevant onclick handlers in this row
            // Update quantity adjustment buttons
            const minusBtn = row.querySelector('.minus-btn');
            const plusBtn = row.querySelector('.plus-btn');
            const qtyInput = row.querySelector('.qty-input');
            
            if (minusBtn) {
                const minOrderQty = parseInt(qtyInput.dataset.minOrderQty) || 1;
                minusBtn.setAttribute('onclick', `adjustQuantity(${newIndex}, -${minOrderQty})`);
            }
            if (plusBtn) {
                const minOrderQty = parseInt(qtyInput.dataset.minOrderQty) || 1;
                plusBtn.setAttribute('onclick', `adjustQuantity(${newIndex}, ${minOrderQty})`);
            }
            if (qtyInput) {
                qtyInput.dataset.index = newIndex;
                qtyInput.setAttribute('onchange', `updateRowTotal(${newIndex})`);
            }
            
            // Update delete button - be more specific with selector
            const deleteBtn = row.querySelector('.btn-danger.btn-icon');
            if (deleteBtn) {
                deleteBtn.setAttribute('onclick', `removeOrderItem(${newIndex})`);
            }
            
            // Update cost and MOQ inputs if present (for manually added items)
            const costInput = row.querySelector('.cost-input');
            const moqInput = row.querySelector('.moq-input');
            if (costInput) {
                costInput.setAttribute('onchange', `updateItemCost(${newIndex})`);
            }
                         if (moqInput) {
                 moqInput.setAttribute('onchange', `updateItemMOQ(${newIndex})`);
             }
             
             console.log(`Updated row ${newIndex} handlers`);
         });
         
         console.log(`Renumbering complete. Table now has ${orderTableBody.children.length} rows.`);
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
                    
                    // Get cost if available - FIXED: Cost is in column 6, not 5
                    const costCell = row.cells[6]; // COST/MOQ column
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
                        // Get the original item data using the row index for supplier number
                        const qtyInput = row.querySelector('.qty-input');
                        const dataIndex = qtyInput ? parseInt(qtyInput.getAttribute('data-index')) : index;
                        const originalItem = suggestedOrderResults.orderData && suggestedOrderResults.orderData[dataIndex];
                        const supplierNumber = originalItem ? originalItem.supplierNumber : '10';
                        
                        orderData.push({
                            partNumber: sku,
                            quantity: quantity,
                            cost: cost,
                            supplierNumber: supplierNumber
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
            // Check if we have stored results
            if (!globalAceNetResults || !globalAceNetResults.categorizedResults) {
                const checkTypeName = lastCheckType === 'planogram' ? 'On Planogram' : 'AceNet';
                await showAlert(`No ${checkTypeName} results available. Please run ${checkTypeName} check first.`, 'warning');
                return;
            }
            
            // Export results to Excel using the appropriate check type
            const exportResult = await window.api.exportAceNetResults(globalAceNetResults, lastCheckType);
            
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

// Display On Planogram results (filtered for asterisk items)
function displayOnPlanogramResults(categorizedResults) {
    const resultsContent = document.getElementById('acenetResultsContent');
    const resultsTitle = document.querySelector('#acenetResultsToggle');
    
    // Update title to reflect this is a planogram check
    if (resultsTitle) {
        resultsTitle.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            On Planogram Check Results
            <svg class="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
        `;
    }
    
    resultsContent.innerHTML = '';
    
    // Filter results to show only "Has Asterisk" items (opposite of "No Asterisk")
    const planogramResults = categorizedResults.filter(category => 
        category.key === 'hasAsterisk' || // This will be our new category
        category.key === 'cancelled' || // Still show cancelled items
        category.key === 'notInAceNet' // Still show not in AceNet items
    );
    
    if (planogramResults.length === 0) {
        resultsContent.innerHTML = '<p>No items found that should be on planogram (no items with asterisk in discovery).</p>';
        return;
    }
    
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'acenet-categorized-results';
    
    planogramResults.forEach((category, index) => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category-section';
        
        const categoryTitle = document.createElement('h3');
        categoryTitle.className = `category-header category-${category.key}`;
        categoryTitle.textContent = category.name;
        
        categoryDiv.appendChild(categoryTitle);
        
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
                listItem.title = 'This item was flagged but may need manual verification.';
            }
            
            listItem.textContent = displayText;
            listItem.style.fontSize = '14px';
            listItem.style.marginBottom = '5px';
            partsList.appendChild(listItem);
        });
        
        categoryDiv.appendChild(partsList);
        resultsContainer.appendChild(categoryDiv);
    });
    
    resultsContent.appendChild(resultsContainer);
}

// Show completion popup for On Planogram check
function showOnPlanogramCompletionPopup(result) {
    const modal = document.createElement('div');
    modal.className = 'popup-overlay';
    modal.innerHTML = `
        <div class="popup-content size-large">
            <div class="popup-header">
                <span class="popup-icon success">✅</span>
                <h3 class="popup-title">On Planogram Check Complete!</h3>
            </div>
            <div class="popup-body">
                <div class="popup-summary">
                    <div class="popup-summary-item">
                        <span class="popup-summary-label">Total Items Checked:</span>
                        <span class="popup-summary-value">${result.totalProcessed || 0}</span>
                    </div>
                    <div class="popup-summary-item">
                        <span class="popup-summary-label">Items With Asterisk Found:</span>
                        <span class="popup-summary-value">${getAsteriskCount(result.categorizedResults)}</span>
                    </div>
                </div>
                <div class="completion-features">
                    <div class="feature-item">
                        <div class="feature-icon">📋</div>
                        <span>Results displayed in AceNet section</span>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon">📊</div>
                        <span>Export to Excel available</span>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon">🏪</div>
                        <span>Missing inventory that should be stocked</span>
                    </div>
                </div>
            </div>
            <div class="popup-actions">
                <button id="closePlanogramCompleteBtn" class="popup-btn secondary">Close</button>
                <button id="exportPlanogramResultsBtn" class="popup-btn primary">Export to Excel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event handlers
    document.getElementById('closePlanogramCompleteBtn').addEventListener('click', () => {
        modal.remove();
    });
    
    document.getElementById('exportPlanogramResultsBtn').addEventListener('click', async () => {
        try {
            // Pass 'planogram' as the check type for planogram exports
            const exportResult = await window.api.exportAceNetResults(result, 'planogram');
            
            if (exportResult.success) {
                const openFile = await showConfirm(`Excel file created successfully!\nLocation: ${exportResult.filePath}\n\nWould you like to open the file now?`, 'Open Excel File');
                
                if (openFile) {
                    await window.api.openFile(exportResult.filePath);
                }
            } else {
                await showAlert('Error creating Excel file: ' + exportResult.error, 'error');
            }
        } catch (error) {
            console.error('Excel export error:', error);
            await showAlert('Error creating Excel file: ' + error.message, 'error');
        }
        
        modal.remove();
    });
}

// Helper function to count asterisk items
function getAsteriskCount(categorizedResults) {
    const asteriskCategory = categorizedResults.find(cat => cat.key === 'hasAsterisk');
    return asteriskCategory ? asteriskCategory.parts.length : 0;
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
    
    summaryText += '\n✅ Final verification completed - "Not in AceNet" items were double-checked.\nResults are displayed in the panel on the right.\nThe browser will remain open for troubleshooting.';
    
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
            // Export results to Excel - pass 'acenet' for standard AceNet checks
            const exportResult = await window.api.exportAceNetResults(result, 'acenet');
            
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
                    
                    // Enable the Check On Planogram button
                    runCheckOnPlanogramBtn.disabled = false;
                    
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
    
    // Run On Planogram from upload button
    const runOnPlanogramFromUploadBtn = document.getElementById('runOnPlanogramFromUploadBtn');
    if (runOnPlanogramFromUploadBtn) {
        runOnPlanogramFromUploadBtn.addEventListener('click', () => {
            hideFileUploadModal();
            // Trigger the Check On Planogram button
            const checkOnPlanogramBtn = document.getElementById('runCheckOnPlanogramBtn');
            if (checkOnPlanogramBtn && !checkOnPlanogramBtn.disabled) {
                checkOnPlanogramBtn.click();
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

// Run Check On Planogram button
runCheckOnPlanogramBtn.addEventListener('click', async () => {
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
        console.log(`Using ${partNumbers.length} part numbers from current order display for Planogram check`);
    } else {
        await showAlert('No part numbers available. Please run Suggested Order first or upload a part number file.', 'warning');
        return;
    }
    
    // Create progress tracking popup - no robot animation for AceNet
    const progressPopup = createProgressPopup(partNumbers.length);
    runCheckOnPlanogramBtn.disabled = true;
    
    // Set up progress listener for direct AceNet processing
    window.electronAPI.onAcenetProgress((data) => {
        console.log(`On Planogram Progress: ${data.current}/${data.total} - ${data.message}`);
        // Update progress popup
        progressPopup.updateProgress(data.current, data.total, data.message);
    });
    
    // Also set up the legacy processing-update listener for file-based processing
    window.api.onProcessingUpdate((data) => {
        if (data.type === 'log') {
            console.log('On Planogram Processing:', data.message);
        } else if (data.type === 'error') {
            console.error('On Planogram Error:', data.message);
        } else if (data.type === 'progress') {
            console.log(`On Planogram Progress: ${data.current}/${data.total} - ${data.message}`);
            // Update progress popup
            progressPopup.updateProgress(data.current, data.total, data.message);
        }
    });
    
    try {
        // Run AceNet check with On Planogram filtering
        const result = await window.api.processAceNetDirect({
            partNumbers: partNumbers,
            username: currentUsernameInput.value,
            password: currentPasswordInput.value,
            store: currentStoreInput.value,
            checkType: 'planogram' // New parameter to indicate this is a planogram check
        });
        
        // Close progress popup
        progressPopup.close();
        
        if (result.success) {
            // Store results globally for export functionality
            globalAceNetResults = result;
            lastCheckType = 'planogram'; // Track that this was a planogram check
            
            // Display results with planogram-specific filtering
            displayOnPlanogramResults(result.categorizedResults);
            
            // Show AceNet results section
            const acenetResultsSection = document.getElementById('acenetResultsSection');
            const acenetResultsPanel = document.getElementById('acenetResultsPanel');
            
            acenetResultsSection.style.display = 'block';
            acenetResultsPanel.classList.add('active');
            
            // Layout is managed automatically through CSS classes
            
            // Auto-expand the results
            const acenetToggle = document.getElementById('acenetResultsToggle');
            const acenetContent = document.getElementById('acenetCollapsibleContent');
            if (acenetToggle && acenetContent) {
                acenetToggle.classList.remove('collapsed');
                acenetContent.classList.remove('collapsed');
            }
            
            // Show completion popup with export options
            showOnPlanogramCompletionPopup(result);
            
        } else {
            // Close progress popup
            progressPopup.close();
            
            // Check if error is due to user cancellation
            const errorMessage = result.error || 'Unknown error';
            if (errorMessage.toLowerCase().includes('cancelled by user')) {
                showCancellationPopup();
            } else {
                await showAlert('On Planogram check failed: ' + errorMessage, 'error');
            }
        }
    } catch (error) {
        // Close progress popup
        if (progressPopup) {
            progressPopup.close();
        }
        
        console.error('On Planogram Error:', error);
        const errorMessage = error.message || error.toString();
        
        // Check if error is due to user cancellation
        if (errorMessage.toLowerCase().includes('cancelled by user')) {
            showCancellationPopup();
        } else {
            await showAlert('Error running On Planogram check: ' + errorMessage, 'error');
        }
    } finally {
        runCheckOnPlanogramBtn.disabled = false;
        window.api.removeAllListeners('processing-update');
        window.electronAPI.removeAcenetProgressListener();
    }
});

// Helper functions

// Function to show stock-out completion popup with export option
function showStockOutCompletionPopup(result) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'popup-overlay';
        
        const popup = document.createElement('div');
        popup.className = 'popup-content alert';
        
        const stats = result.stats || {};
        
        popup.innerHTML = `
            <div class="popup-header">
                <div class="popup-icon success">🎯</div>
                <h3 class="popup-title">Stock-Out Analysis Complete!</h3>
            </div>
            <div class="popup-body">
                <div class="popup-summary">
                    <div class="popup-summary-item">
                        <span class="popup-summary-label">Items with Stock-Out Risk:</span>
                        <span class="popup-summary-value">${result.predictions.length}</span>
                    </div>
                    <div class="popup-summary-item">
                        <span class="popup-summary-label">High Confidence Predictions:</span>
                        <span class="popup-summary-value">${stats.high_confidence || 0}</span>
                    </div>
                    <div class="popup-summary-item">
                        <span class="popup-summary-label">Medium Confidence Predictions:</span>
                        <span class="popup-summary-value">${stats.medium_confidence || 0}</span>
                    </div>
                    <div class="popup-summary-item">
                        <span class="popup-summary-label">Low Confidence Predictions:</span>
                        <span class="popup-summary-value">${stats.low_confidence || 0}</span>
                    </div>
                    <div class="popup-summary-item">
                        <span class="popup-summary-label">Average Confidence:</span>
                        <span class="popup-summary-value">${stats.average_confidence ? stats.average_confidence.toFixed(1) + '%' : '0%'}</span>
                    </div>
                </div>
                <p class="popup-message">
                    Results are displayed in the table below. You can review and adjust quantities, 
                    then export to Excel if needed.
                </p>
            </div>
            <div class="popup-actions">
                <button class="popup-btn secondary" id="closeStockOutPopup">Close</button>
                <button class="popup-btn success" id="exportStockOutBtn">Export to Excel</button>
            </div>
        `;
        
        overlay.appendChild(popup);
        document.body.appendChild(overlay);
        
        // Handle close button
        const closeBtn = popup.querySelector('#closeStockOutPopup');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve();
        });
        
        // Handle export button
        const exportBtn = popup.querySelector('#exportStockOutBtn');
        exportBtn.addEventListener('click', async () => {
            try {
                exportBtn.disabled = true;
                exportBtn.textContent = 'Exporting...';
                
                if (globalStockOutResults) {
                    const exportResult = await window.exportAPI.exportStockOutPredictions(globalStockOutResults);
                    
                    if (exportResult.success) {
                        await showAlert(`Excel file exported successfully!\n\nSaved to: ${exportResult.filename}`, 'success');
                    } else {
                        await showAlert(`Export failed: ${exportResult.error}`, 'error');
                    }
                } else {
                    await showAlert('No stock-out results to export', 'warning');
                }
                
                exportBtn.disabled = false;
                exportBtn.textContent = 'Export to Excel';
                
            } catch (error) {
                console.error('Export error:', error);
                await showAlert(`Export failed: ${error.message}`, 'error');
                exportBtn.disabled = false;
                exportBtn.textContent = 'Export to Excel';
            }
        });
        
        // Handle escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', handleEscape);
                resolve();
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        // Handle overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', handleEscape);
                resolve();
            }
        });
    });
}

// ============================================================================
// API Configuration Handling
// ============================================================================

// API Configuration State
let apiConfigState = {
    isConfigured: false,
    isEnabled: false,
    isLoading: false,
    currentConfig: null
};

// DOM Elements for API Configuration
// API status elements removed from sidebar - all API functionality moved to Tools menu
const apiConfigModal = document.getElementById('apiConfigModal');
const apiConfigForm = document.getElementById('apiConfigForm');

// Initialize API configuration on load
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApiConfiguration();
});

// API Configuration Event Listeners (now handled via menu)
// configureApiBtn removed from sidebar - functionality moved to Tools menu

// Add menu action listeners
window.api.onOpenApiConfiguration(() => {
    openApiConfigModal();
});

window.api.onToggleApiMode(() => {
    toggleApiMode();
});

window.api.onPhantomShowStats(() => {
    showPhantomStats();
});

window.api.onPhantomSyncNetwork(() => {
    syncPhantomNetwork();
});

window.api.onPhantomExportReports(() => {
    exportPhantomReports();
});

window.api.onRefreshApiData(() => {
    refreshApiInventoryData();
});

window.api.onTestApiConnection(() => {
    testApiConnection();
});

window.api.onFixInputFields(() => {
    handleFixInputFields();
});

// Initialize API configuration
async function initializeApiConfiguration() {
    try {
        // Check if the API is ready before calling
        if (!window.api || !window.api.getApiConfigSummary) {
            console.log('API not ready yet, skipping configuration initialization');
            updateApiStatus({ paladin: { enabled: false, configured: false } });
            return;
        }
        
        const response = await window.api.getApiConfigSummary();
        
        if (response.success) {
            updateApiStatus(response.data);
        } else {
            console.error('Failed to get API configuration:', response.error);
            updateApiStatus({ paladin: { enabled: false, configured: false } });
        }
    } catch (error) {
        console.error('Error initializing API configuration:', error);
        // Fallback to default status if handler not ready
        updateApiStatus({ paladin: { enabled: false, configured: false } });
    }
}

// Update API status display
function updateApiStatus(configSummary) {
    apiConfigState.isConfigured = configSummary.paladin.configured;
    apiConfigState.isEnabled = configSummary.paladin.enabled;
    
    // API status UI removed from sidebar - all API functionality moved to Tools menu
    // Status is now managed internally for functionality, no visual updates needed
}

// Open API configuration modal
async function openApiConfigModal() {
    try {
        const response = await window.api.getApiConfig();
        
        if (response.success) {
            populateApiConfigForm(response.data);
            apiConfigModal.style.display = 'flex';
            
            // Set up modal event listeners
            setupApiConfigModalListeners();
        } else {
            await showAlert('Failed to load API configuration: ' + response.error, 'error');
        }
    } catch (error) {
        console.error('Error opening API config modal:', error);
        await showAlert('Error opening API configuration: ' + error.message, 'error');
    }
}

// Populate API configuration form
function populateApiConfigForm(config) {
    // Paladin API settings
    document.getElementById('apiBaseUrl').value = config.paladin.baseURL || '';
    document.getElementById('apiStoreId').value = config.paladin.storeId || '';
    document.getElementById('apiUsername').value = config.paladin.username || '';
    document.getElementById('apiPassword').value = config.paladin.password || '';
    document.getElementById('apiKey').value = config.paladin.apiKey || '';
    
    // Advanced settings
    document.getElementById('apiTimeout').value = config.paladin.timeout / 1000 || 30;
    document.getElementById('apiPageSize').value = config.paladin.pageSize || 100;
    document.getElementById('apiMaxRetries').value = config.paladin.maxRetries || 3;
    document.getElementById('apiRetryDelay').value = config.paladin.retryDelay || 1000;
    document.getElementById('apiIncludeZeroStock').checked = config.paladin.includeZeroStock || false;
    document.getElementById('apiDefaultSupplier').value = config.paladin.defaultSupplierFilter || '';
    
    // General settings
    document.getElementById('preferApiOverFiles').checked = config.general.preferApiOverFiles || false;
    document.getElementById('autoRefreshInterval').value = config.general.autoRefreshInterval / 60000 || 5;
    
    // Update connection status
    updateConnectionStatus(config.paladin.lastTestResult);
}

// Setup API configuration modal listeners
function setupApiConfigModalListeners() {
    const modal = apiConfigModal;
    
    // Close modal handlers
    const closeBtn = modal.querySelector('#closeApiConfigModal');
    const cancelBtn = modal.querySelector('#cancelConfigBtn');
    
    closeBtn.addEventListener('click', closeApiConfigModal);
    cancelBtn.addEventListener('click', closeApiConfigModal);
    
    // Form action handlers
    const testBtn = modal.querySelector('#testConnectionBtn');
    const resetBtn = modal.querySelector('#resetConfigBtn');
    const saveBtn = modal.querySelector('#saveConfigBtn');
    
    testBtn.addEventListener('click', testApiConnectionFromModal);
    resetBtn.addEventListener('click', resetApiConfiguration);
    saveBtn.addEventListener('click', saveApiConfiguration);
    
    // Tab handling
    const tabButtons = modal.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(e.target.dataset.tab);
        });
    });
    
    // Modal overlay click to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeApiConfigModal();
        }
    });
}

// Switch authentication tabs
function switchTab(tabName) {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Close API configuration modal
function closeApiConfigModal() {
    apiConfigModal.style.display = 'none';
    
    // Remove event listeners to prevent memory leaks
    const modal = apiConfigModal;
    const buttons = modal.querySelectorAll('button');
    buttons.forEach(button => {
        button.removeEventListener('click', () => {});
    });
}

// Test API connection from modal
async function testApiConnectionFromModal() {
    const testBtn = document.getElementById('testConnectionBtn');
    const connectionStatus = document.getElementById('connectionStatus');
    
    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    
    updateConnectionStatus({ success: null, message: 'Testing connection...' });
    
    try {
        const response = await window.api.testApiConnection();
        
        if (response.success) {
            updateConnectionStatus(response.data);
        } else {
            updateConnectionStatus({ success: false, message: response.error });
        }
    } catch (error) {
        updateConnectionStatus({ success: false, message: error.message });
    } finally {
        testBtn.disabled = false;
        testBtn.textContent = 'Test Connection';
    }
}

// Update connection status indicator
function updateConnectionStatus(testResult) {
    const statusIndicator = document.querySelector('#connectionStatus .status-indicator');
    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('.status-text');
    
    if (!testResult) {
        statusDot.className = 'status-dot status-unknown';
        statusText.textContent = 'Not Tested';
        return;
    }
    
    if (testResult.success === null) {
        statusDot.className = 'status-dot status-testing';
        statusText.textContent = testResult.message || 'Testing...';
    } else if (testResult.success) {
        statusDot.className = 'status-dot status-enabled';
        statusText.textContent = testResult.message || 'Connected';
    } else {
        statusDot.className = 'status-dot status-disabled';
        statusText.textContent = testResult.message || 'Connection Failed';
    }
}

// Reset API configuration
async function resetApiConfiguration() {
    const confirmed = await showConfirm('Are you sure you want to reset the API configuration to defaults?');
    
    if (confirmed) {
        try {
            const response = await window.api.resetApiConfig();
            
            if (response.success) {
                await showAlert('Configuration reset successfully', 'success');
                
                // Reload the configuration
                const configResponse = await window.api.getApiConfig();
                if (configResponse.success) {
                    populateApiConfigForm(configResponse.data);
                }
            } else {
                await showAlert('Failed to reset configuration: ' + response.error, 'error');
            }
        } catch (error) {
            await showAlert('Error resetting configuration: ' + error.message, 'error');
        }
    }
}

// Save API configuration
async function saveApiConfiguration() {
    const saveBtn = document.getElementById('saveConfigBtn');
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        const formData = collectApiConfigFormData();
        
        const response = await window.api.updateApiConfig(formData);
        
        if (response.success) {
            await showAlert('Configuration saved successfully', 'success');
            closeApiConfigModal();
            
            // Refresh API status
            await initializeApiConfiguration();
        } else {
            await showAlert('Failed to save configuration: ' + response.error, 'error');
        }
    } catch (error) {
        await showAlert('Error saving configuration: ' + error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Configuration';
    }
}

// Collect API configuration form data
function collectApiConfigFormData() {
    return {
        paladin: {
            baseURL: document.getElementById('apiBaseUrl').value,
            storeId: document.getElementById('apiStoreId').value,
            username: document.getElementById('apiUsername').value,
            password: document.getElementById('apiPassword').value,
            apiKey: document.getElementById('apiKey').value,
            timeout: parseInt(document.getElementById('apiTimeout').value) * 1000,
            pageSize: parseInt(document.getElementById('apiPageSize').value),
            maxRetries: parseInt(document.getElementById('apiMaxRetries').value),
            retryDelay: parseInt(document.getElementById('apiRetryDelay').value),
            includeZeroStock: document.getElementById('apiIncludeZeroStock').checked,
            defaultSupplierFilter: document.getElementById('apiDefaultSupplier').value || null
        },
        general: {
            preferApiOverFiles: document.getElementById('preferApiOverFiles').checked,
            autoRefreshInterval: parseInt(document.getElementById('autoRefreshInterval').value) * 60000
        }
    };
}

// Toggle API mode
async function toggleApiMode() {
    const enabled = !apiConfigState.isEnabled;
    
    try {
        const response = await window.api.setApiEnabled(enabled);
        
        if (response.success) {
            await initializeApiConfiguration();
            
            if (enabled) {
                await showAlert('API mode enabled. Tink will now use API data instead of file uploads.', 'success');
                
                // Automatically refresh data if enabled
                if (apiConfigState.isConfigured) {
                    await refreshApiInventoryData();
                }
            } else {
                await showAlert('API mode disabled. File upload mode restored.', 'info');
            }
        } else {
            await showAlert('Failed to toggle API mode: ' + response.error, 'error');
        }
    } catch (error) {
        await showAlert('Error toggling API mode: ' + error.message, 'error');
    }
}

// Refresh API inventory data
async function refreshApiInventoryData() {
    if (!apiConfigState.isEnabled || !apiConfigState.isConfigured) {
        await showAlert('API is not enabled or configured', 'warning');
        return;
    }
    
    await showAlert('Refreshing API data...', 'info');
    
    try {
        // Set up progress listener
        window.api.onApiInventoryProgress((progress) => {
            console.log(`API Progress: ${progress.current}/${progress.total} (${progress.page}/${progress.totalPages})`);
        });
        
        const response = await window.api.getApiInventoryData();
        
        if (response.success) {
            // Update the selected file state to use API data
            selectedFile = {
                path: 'API_DATA',
                name: `API Data (${response.totalItems} items)`,
                size: response.totalItems,
                isApiData: true,
                data: response.data
            };
            
            // Update global reference
            window.selectedFile = selectedFile;
            
            // Update UI to show API data is loaded
            fileName.textContent = selectedFile.name;
            fileSize.textContent = `${response.totalItems} items`;
            fileInfo.style.display = 'block';
            
            // Enable buttons
            runSuggestedOrderBtn.disabled = false;
            runCheckAceNetBtn.disabled = false;
            runCheckOnPlanogramBtn.disabled = false;
            runPhantomInventoryBtn.disabled = false;
            
            await showAlert(`Successfully loaded ${response.totalItems} items from API`, 'success');
        } else {
            await showAlert('Failed to refresh API data: ' + response.error, 'error');
        }
    } catch (error) {
        await showAlert('Error refreshing API data: ' + error.message, 'error');
    } finally {
        // Clean up progress listener
        window.api.removeApiInventoryProgressListener();
    }
}

// Test API connection (main UI)
async function testApiConnection() {
    await showAlert('Testing API connection...', 'info');
    
    try {
        const response = await window.api.testApiConnection();
        
        if (response.success && response.data.success) {
            await showAlert('API connection successful!', 'success');
        } else {
            await showAlert('API connection failed: ' + (response.data?.message || response.error), 'error');
        }
    } catch (error) {
        await showAlert('Error testing API connection: ' + error.message, 'error');
    }
}

// Add CSS for spinning animation
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Phantom Inventory Tools Functions
async function showPhantomStats() {
    try {
        await showAlert('Loading phantom inventory statistics...', 'info');
        
        const response = await window.api.invoke('phantom-get-stats');
        
        if (response.success) {
            const stats = response.stats;
            const message = `
                Phantom Inventory Statistics:
                
                Total Verifications: ${stats.totalVerifications}
                Accuracy Rate: ${(stats.accuracy * 100).toFixed(1)}%
                Categories Learned: ${stats.categories.length}
                
                Network Stats:
                Network Stores: ${stats.networkStats.totalStores}
                Network Accuracy: ${(stats.networkStats.averageAccuracy * 100).toFixed(1)}%
                Last Sync: ${stats.networkStats.lastSync || 'Never'}
            `;
            
            await showAlert(message, 'success');
        } else {
            await showAlert('Failed to get phantom inventory statistics: ' + response.error, 'error');
        }
    } catch (error) {
        console.error('Error showing phantom stats:', error);
        await showAlert('Error loading phantom inventory statistics: ' + error.message, 'error');
    }
}

async function syncPhantomNetwork() {
    try {
        await showAlert('Synchronizing phantom network data...', 'info');
        
        const response = await window.api.invoke('phantom-sync-network');
        
        if (response.success) {
            const message = `
                Network Sync Complete:
                
                Stores Synchronized: ${response.syncedStores}
                Network Verifications: ${response.consolidatedVerifications}
                Improved Accuracy: ${(response.improvedAccuracy * 100).toFixed(1)}%
            `;
            
            await showAlert(message, 'success');
        } else {
            await showAlert('Failed to sync phantom network data: ' + response.error, 'error');
        }
    } catch (error) {
        console.error('Error syncing phantom network:', error);
        await showAlert('Error synchronizing phantom network data: ' + error.message, 'error');
    }
}

async function exportPhantomReports() {
    try {
        await showAlert('Exporting phantom inventory reports...', 'info');
        
        const response = await window.api.invoke('phantom-export-reports');
        
        if (response.success) {
            const message = `
                Reports Exported Successfully:
                
                Export File: ${response.exportFile}
                
                Network data and statistics have been exported for analysis and backup.
            `;
            
            await showAlert(message, 'success');
        } else {
            await showAlert('Failed to export phantom reports: ' + response.error, 'error');
        }
    } catch (error) {
        console.error('Error exporting phantom reports:', error);
        await showAlert('Error exporting phantom inventory reports: ' + error.message, 'error');
    }
}

// ============================================================================
// VERIFICATION QUEUE & SYSTEM MANAGEMENT
// ============================================================================

async function loadSystemStats() {
    try {
        const response = await window.electronAPI.invoke('phantom-get-system-stats');
        if (response.success) {
            updateSystemStatsDisplay(response.data);
        }
    } catch (error) {
        console.error('Error loading system stats:', error);
    }
}

function updateSystemStatsDisplay(stats) {
    // Update verification stats
    const verificationStats = document.getElementById('verificationStats');
    const pendingCount = document.getElementById('pendingCount');
    const activeCount = document.getElementById('activeCount');
    const completedCount = document.getElementById('completedCount');
    
    if (verificationStats && stats.verification) {
        verificationStats.style.display = 'block';
        if (pendingCount) pendingCount.textContent = stats.verification.pending || 0;
        if (activeCount) activeCount.textContent = stats.verification.active || 0;
        if (completedCount) completedCount.textContent = stats.verification.completed || 0;
    }
    
    // Update network stats
    const networkStats = document.getElementById('networkStats');
    const networkStoreCount = document.getElementById('networkStoreCount');
    const networkVerificationCount = document.getElementById('networkVerificationCount');
    const networkAccuracy = document.getElementById('networkAccuracy');
    
    if (networkStats && stats.network) {
        networkStats.style.display = 'block';
        if (networkStoreCount) networkStoreCount.textContent = stats.network.totalStores || 0;
        if (networkVerificationCount) networkVerificationCount.textContent = stats.network.totalVerifications || 0;
        if (networkAccuracy) networkAccuracy.textContent = `${Math.round(stats.network.accuracy * 100) || 0}%`;
    }
    
    // Update ML stats
    const mlStats = document.getElementById('mlStats');
    const mlTrainingCount = document.getElementById('mlTrainingCount');
    const mlAccuracy = document.getElementById('mlAccuracy');
    const mlCategories = document.getElementById('mlCategories');
    
    if (mlStats && stats.ml) {
        mlStats.style.display = 'block';
        if (mlTrainingCount) mlTrainingCount.textContent = stats.ml.trainingData || 0;
        if (mlAccuracy) mlAccuracy.textContent = `${Math.round(stats.ml.accuracy * 100) || 0}%`;
        if (mlCategories) mlCategories.textContent = stats.ml.categories || 0;
    }
}

// Verification Queue Management
async function showVerificationQueue() {
    const modal = document.getElementById('verificationQueueModal');
    if (modal) {
        modal.style.display = 'flex';
        await loadVerificationQueueData();
    }
}

function closeVerificationQueueModal() {
    const modal = document.getElementById('verificationQueueModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function loadVerificationQueueData() {
    try {
        const response = await window.electronAPI.invoke('phantom-get-verification-queue');
        if (response.success) {
            populateVerificationQueue(response.data);
        }
    } catch (error) {
        console.error('Error loading verification queue:', error);
    }
}

function populateVerificationQueue(data) {
    // Populate pending verifications
    const pendingList = document.getElementById('pendingVerificationsList');
    if (pendingList && data.pending) {
        pendingList.innerHTML = '';
        data.pending.forEach(item => {
            const row = document.createElement('tr');
            const priority = item.verificationPriority >= 80 ? 'high' : item.verificationPriority >= 60 ? 'medium' : 'low';
            row.innerHTML = `
                <td><span class="priority-badge priority-${priority}">${priority.toUpperCase()}</span></td>
                <td>${item.partNumber}</td>
                <td>${item.description}</td>
                <td>${item.currentStock}</td>
                <td>${item.riskScore}</td>
                <td>${item.location}</td>
                <td>${item.estimatedTime}min</td>
                <td>
                    <button class="btn btn-small btn-primary" onclick="startVerification('${item.id}')">Start</button>
                    <button class="btn btn-small btn-secondary" onclick="viewItemDetails('${item.id}')">Details</button>
                </td>
            `;
            pendingList.appendChild(row);
        });
    }
    
    // Populate active verifications
    const activeList = document.getElementById('activeVerificationsList');
    if (activeList && data.active) {
        activeList.innerHTML = '';
        data.active.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.partNumber}</td>
                <td>${item.description}</td>
                <td>${item.currentStock}</td>
                <td>${item.assignedTo}</td>
                <td>${new Date(item.startedAt).toLocaleString()}</td>
                <td>
                    <button class="btn btn-small btn-success" onclick="completeVerification('${item.id}')">Complete</button>
                    <button class="btn btn-small btn-warning" onclick="pauseVerification('${item.id}')">Pause</button>
                </td>
            `;
            activeList.appendChild(row);
        });
    }
    
    // Populate completed verifications
    const completedList = document.getElementById('completedVerificationsList');
    if (completedList && data.completed) {
        completedList.innerHTML = '';
        data.completed.forEach(item => {
            const row = document.createElement('tr');
            const discrepancy = item.results.discrepancy;
            const discrepancyClass = discrepancy === 0 ? 'status-completed' : discrepancy > 0 ? 'status-pending' : 'status-active';
            row.innerHTML = `
                <td>${item.partNumber}</td>
                <td>${item.description}</td>
                <td>${item.currentStock}</td>
                <td>${item.results.physicalCount}</td>
                <td><span class="verification-status ${discrepancyClass}">${discrepancy > 0 ? '+' : ''}${discrepancy}</span></td>
                <td>${item.results.verifiedBy}</td>
                <td>${new Date(item.completedAt).toLocaleString()}</td>
            `;
            completedList.appendChild(row);
        });
    }
}

// Store Selection & Network Sync
async function changeStore() {
    const storeSelect = document.getElementById('storeSelect');
    const selectedStore = storeSelect.value;
    
    if (selectedStore) {
        try {
            const response = await window.electronAPI.invoke('phantom-change-store', selectedStore);
            if (response.success) {
                await showAlert('Store changed successfully. System will reinitialize.', 'success');
                location.reload(); // Reload to reinitialize with new store
            } else {
                await showAlert('Failed to change store: ' + response.error, 'error');
            }
        } catch (error) {
            await showAlert('Error changing store: ' + error.message, 'error');
        }
    }
}

async function syncNetworkData() {
    try {
        const response = await window.electronAPI.invoke('phantom-sync-network-new');
        if (response.success) {
            await showAlert('Network sync completed successfully!', 'success');
            loadSystemStats(); // Refresh stats
        } else {
            await showAlert('Network sync failed: ' + response.error, 'error');
        }
    } catch (error) {
        await showAlert('Error syncing network: ' + error.message, 'error');
    }
}

// ML Data Management
async function showMlDataModal() {
    const modal = document.getElementById('mlDataModal');
    if (modal) {
        modal.style.display = 'flex';
        await loadMlData();
    }
}

function closeMlDataModal() {
    const modal = document.getElementById('mlDataModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function loadMlData() {
    try {
        const response = await window.electronAPI.invoke('phantom-get-ml-data');
        if (response.success) {
            populateMlData(response.data);
        }
    } catch (error) {
        console.error('Error loading ML data:', error);
    }
}

function populateMlData(data) {
    // Populate ML overview
    const mlOverviewStats = document.getElementById('mlOverviewStats');
    if (mlOverviewStats && data.overview) {
        mlOverviewStats.innerHTML = `
            <div class="ml-stat-grid">
                <div class="ml-stat-card">
                    <h5>Total Verifications</h5>
                    <span class="ml-stat-value">${data.overview.totalVerifications}</span>
                </div>
                <div class="ml-stat-card">
                    <h5>Accuracy Rate</h5>
                    <span class="ml-stat-value">${Math.round(data.overview.accuracy * 100)}%</span>
                </div>
                <div class="ml-stat-card">
                    <h5>Learning Progress</h5>
                    <span class="ml-stat-value">${data.overview.learningProgress}%</span>
                </div>
                <div class="ml-stat-card">
                    <h5>Last Updated</h5>
                    <span class="ml-stat-value">${new Date(data.overview.lastUpdated).toLocaleDateString()}</span>
                </div>
            </div>
        `;
    }
    
    // Populate category stats
    const mlCategoryStats = document.getElementById('mlCategoryStats');
    if (mlCategoryStats && data.categories) {
        let categoryHtml = '<div class="category-stats-grid">';
        Object.entries(data.categories).forEach(([category, stats]) => {
            categoryHtml += `
                <div class="category-stat-card">
                    <h6>${category}</h6>
                    <div class="category-details">
                        <span>Verifications: ${stats.totalVerifications}</span>
                        <span>Accuracy: ${Math.round(stats.accuracy * 100)}%</span>
                        <span>Avg Discrepancy: ${stats.avgDiscrepancy.toFixed(1)}</span>
                    </div>
                </div>
            `;
        });
        categoryHtml += '</div>';
        mlCategoryStats.innerHTML = categoryHtml;
    }
}

// Event listeners for new UI components
document.addEventListener('DOMContentLoaded', () => {
    // Verification queue button
    const viewVerificationQueueBtn = document.getElementById('viewVerificationQueueBtn');
    if (viewVerificationQueueBtn) {
        viewVerificationQueueBtn.addEventListener('click', showVerificationQueue);
    }
    
    // Store selection
    const storeSelect = document.getElementById('storeSelect');
    if (storeSelect) {
        storeSelect.addEventListener('change', () => {
            const changeStoreBtn = document.getElementById('changeStoreBtn');
            if (changeStoreBtn) {
                changeStoreBtn.textContent = 'Apply Changes';
                changeStoreBtn.classList.add('btn-primary');
                changeStoreBtn.classList.remove('btn-warning');
            }
        });
    }
    
    // Store change button
    const changeStoreBtn = document.getElementById('changeStoreBtn');
    if (changeStoreBtn) {
        changeStoreBtn.addEventListener('click', changeStore);
    }
    
    // Network sync button
    const syncNetworkBtn = document.getElementById('syncNetworkBtn');
    if (syncNetworkBtn) {
        syncNetworkBtn.addEventListener('click', syncNetworkData);
    }
    
    // ML data button
    const viewMLDataBtn = document.getElementById('viewMLDataBtn');
    if (viewMLDataBtn) {
        viewMLDataBtn.addEventListener('click', showMlDataModal);
    }
    
    // Tab management for modals
    document.querySelectorAll('.verification-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            const modal = tab.closest('.verification-queue-content');
            
            // Remove active from all tabs
            modal.querySelectorAll('.verification-tab').forEach(t => t.classList.remove('active'));
            modal.querySelectorAll('.verification-tab-content').forEach(content => content.style.display = 'none');
            
            // Add active to clicked tab
            tab.classList.add('active');
            const content = modal.querySelector(`#${tabName}Verifications, #ml${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
            if (content) content.style.display = 'block';
        });
    });
});

// Fix duplicate processing issue
let isPhantomAnalysisRunning = false;

// Override the original function to prevent duplicates
const originalRunPhantomInventoryAnalysis = runPhantomInventoryAnalysis;
async function runPhantomInventoryAnalysis() {
    if (isPhantomAnalysisRunning) {
        console.log('Phantom analysis already running, skipping duplicate');
        return;
    }
    
    isPhantomAnalysisRunning = true;
    
    try {
        await originalRunPhantomInventoryAnalysis();
        
        // Refresh system stats after analysis
        setTimeout(() => {
            loadSystemStats();
        }, 1000);
    } finally {
        isPhantomAnalysisRunning = false;
    }
}

// Global functions for onclick handlers
window.closeVerificationQueueModal = closeVerificationQueueModal;
window.closeMlDataModal = closeMlDataModal;
window.startVerification = async function(verificationId) {
    const assignedTo = prompt('Enter name of person assigned to this verification:');
    if (assignedTo) {
        try {
            const response = await window.electronAPI.invoke('phantom-start-verification', verificationId, assignedTo);
            if (response.success) {
                await showAlert('Verification started successfully!', 'success');
                loadVerificationQueueData();
            } else {
                await showAlert('Failed to start verification: ' + response.error, 'error');
            }
        } catch (error) {
            await showAlert('Error starting verification: ' + error.message, 'error');
        }
    }
};

window.completeVerification = async function(verificationId) {
    const physicalCount = prompt('Enter the actual physical count:');
    const notes = prompt('Enter any notes (optional):');
    
    if (physicalCount !== null) {
        try {
            const response = await window.electronAPI.invoke('phantom-complete-verification-new', verificationId, {
                physicalCount: parseInt(physicalCount),
                notes: notes || ''
            });
            if (response.success) {
                await showAlert('Verification completed successfully!', 'success');
                loadVerificationQueueData();
                loadSystemStats(); // Refresh stats
            } else {
                await showAlert('Failed to complete verification: ' + response.error, 'error');
            }
        } catch (error) {
            await showAlert('Error completing verification: ' + error.message, 'error');
        }
    }
};

window.viewItemDetails = function(verificationId) {
    showAlert('Item details feature coming soon!', 'info');
};

window.pauseVerification = async function(verificationId) {
    showAlert('Pause verification feature coming soon!', 'info');
};

window.startSelectedVerifications = function() {
    showAlert('Start selected verifications feature coming soon!', 'info');
};

// Initialize phantom file input handler for dynamically created elements
function initializePhantomFileInputHandler() {
    console.log('Initializing phantom file input handler...');
    
    const phantomFileInput = document.getElementById('phantomFileInput');
    if (phantomFileInput) {
        // Remove any existing event listeners to avoid duplicates
        phantomFileInput.replaceWith(phantomFileInput.cloneNode(true));
        const newPhantomFileInput = document.getElementById('phantomFileInput');
        
        newPhantomFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                console.log('Phantom file selected:', file.name);
                
                // Create a separate phantom file reference
                const phantomFile = {
                    path: file.path || file.webkitRelativePath || file.name,
                    name: file.name,
                    size: file.size
                };
                
                // Store in a separate variable
                window.phantomSelectedFile = phantomFile;
                
                // Update UI elements if they exist
                const phantomFileName = document.getElementById('phantomFileName');
                const phantomFileSize = document.getElementById('phantomFileSize');
                const phantomFileInfo = document.getElementById('phantomFileInfo');
                
                if (phantomFileName) phantomFileName.textContent = phantomFile.name;
                if (phantomFileSize) phantomFileSize.textContent = formatFileSize(phantomFile.size);
                if (phantomFileInfo) phantomFileInfo.style.display = 'block';
                
                // Show success message
                await showAlert(`Inventory file "${file.name}" selected successfully. You can now run phantom analysis.`, 'success');
                
                console.log('Phantom file stored:', phantomFile);
            }
        });
        
        console.log('Phantom file input handler initialized');
    }
}

// Refresh inventory data function
async function refreshInventoryData() {
    console.log('Refreshing inventory data...');
    
    try {
        // Check if we have a selected phantom file
        if (window.phantomSelectedFile) {
            await showAlert('Using selected phantom inventory file: ' + window.phantomSelectedFile.name, 'info');
            return;
        }
        
        // Check if we have global inventory data
        if (window.latestInventoryData && window.latestInventoryData.length > 0) {
            await showAlert(`Using current inventory data (${window.latestInventoryData.length} items)`, 'info');
            return;
        }
        
        if (window.processedData && window.processedData.length > 0) {
            await showAlert(`Using processed inventory data (${window.processedData.length} items)`, 'info');
            return;
        }
        
        // Try to get inventory data through IPC
        const result = await window.electronAPI.invoke('get-inventory-data');
        if (result.success && result.data && result.data.length > 0) {
            await showAlert(`Refreshed inventory data (${result.data.length} items)`, 'success');
            return;
        }
        
        await showAlert('No inventory data available. Please import an inventory file.', 'warning');
        
    } catch (error) {
        console.error('Error refreshing inventory data:', error);
        await showAlert('Error refreshing inventory data: ' + error.message, 'error');
    }
}

// Initialize step animation for processing modals
function initializeStepAnimation(stateId) {
    const state = document.getElementById(stateId);
    if (!state) return;
    
    const steps = state.querySelectorAll('.step');
    let currentStep = 0;
    
    // Animate steps sequentially
    function animateNextStep() {
        if (currentStep < steps.length) {
            // Mark previous step as completed
            if (currentStep > 0) {
                steps[currentStep - 1].classList.remove('active');
                steps[currentStep - 1].classList.add('completed');
            }
            
            // Activate current step
            steps[currentStep].classList.add('active');
            currentStep++;
            
            // Continue to next step after delay
            const delay = Math.random() * 1500 + 800; // Random delay between 800-2300ms
            setTimeout(animateNextStep, delay);
        } else {
            // Mark final step as completed
            if (steps.length > 0) {
                steps[steps.length - 1].classList.remove('active');
                steps[steps.length - 1].classList.add('completed');
            }
        }
    }
    
    // Start animation with small delay
    setTimeout(animateNextStep, 500);
}

// Enhanced hideProcessingModal function
function enhancedHideProcessingModal() {
    const processingModal = document.getElementById('processingModal');
    if (processingModal) {
        // Add fade out animation
        processingModal.style.opacity = '0';
        processingModal.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            processingModal.style.display = 'none';
            processingModal.style.opacity = '1';
            processingModal.style.transform = 'scale(1)';
        }, 300);
    }
}

// ============================================================================
// HELPER FUNCTIONS FOR NEW VALIDATION AND REPORTS INTERFACES
// ============================================================================

// Validation helper functions
function loadActiveVerificationSheet() {
    showAlert('Loading active verification sheet...', 'info');
    // TODO: Implement loading active verification sheet functionality
}

function validateAllMatchingItems() {
    showAlert('Auto-validating matching items...', 'info');
    // TODO: Implement auto-validation functionality
}

function exportValidationResults() {
    showAlert('Exporting validation results...', 'info');
    // TODO: Implement export validation results functionality
}

// Reports helper functions
function generateExecutiveSummary() {
    showAlert('Generating executive summary...', 'info');
    // TODO: Implement executive summary generation
}

function generateDetailedReport() {
    showAlert('Generating detailed report...', 'info');
    // TODO: Implement detailed report generation
}

function generateVerificationReport() {
    showAlert('Generating verification report...', 'info');
    // TODO: Implement verification report generation
}

function exportAllReports() {
    showAlert('Exporting all reports...', 'info');
    // TODO: Implement export all reports functionality
}

// Placeholder message functions
function displayNoVerificationDataMessage() {
    const validationContent = document.getElementById('validationContent');
    if (validationContent) {
        validationContent.innerHTML = `
            <div class="validation-placeholder">
                <div class="placeholder-icon">⚠️</div>
                <h4>No Verification Data</h4>
                <p>Complete verification sheets first to access validation features.</p>
                <button class="btn btn-primary" onclick="switchPhantomView('verification')">
                    Go to Verification
                </button>
            </div>
        `;
    }
}

function displayNoReportsDataMessage() {
    const reportsContent = document.getElementById('reportsContent');
    if (reportsContent) {
        reportsContent.innerHTML = `
            <div class="reports-placeholder">
                <div class="placeholder-icon">📊</div>
                <h4>No Analysis Data</h4>
                <p>Run analysis first to generate reports.</p>
                <button class="btn btn-primary" onclick="switchPhantomView('analysis')">
                    Go to Analysis
                </button>
            </div>
        `;
    }
}







