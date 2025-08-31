# Enhanced Phantom Inventory Detection System - Setup Guide

## Overview

This enhanced system provides machine learning-powered phantom inventory detection with multi-store synchronization capabilities. It learns from verification results across all 4 stores to continuously improve accuracy.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Enhanced Phantom Detector                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   PhantomML     │  │  Multi-Store    │  │  Verification   │  │
│  │   Learning      │  │     Sync        │  │   Workflow      │  │
│  │                 │  │                 │  │                 │  │
│  │ • Sales History │  │ • Cross-Store   │  │ • Daily Lists   │  │
│  │ • Seasonal      │  │   Learning      │  │ • Tracking      │  │
│  │ • Categories    │  │ • Data Sync     │  │ • Reporting     │  │
│  │ • Trends        │  │ • Recommendations│  │ • ML Feedback   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

### 1. Install Dependencies

```bash
npm install exceljs
```

### 2. Copy Files to Your Tink Installation

Copy these files to your `js/` directory:
- `phantom-inventory-ml.js`
- `multi-store-sync.js`
- `verification-workflow.js`
- `enhanced-phantom-detector.js`

### 3. Configure Each Store

Create a configuration file for each store:

```javascript
// store-config.js
const storeConfigs = {
    'STORE_001': {
        name: 'Main Street Hardware',
        location: 'Main Street',
        timezone: 'America/New_York'
    },
    'STORE_002': {
        name: 'Downtown Hardware',
        location: 'Downtown',
        timezone: 'America/New_York'
    },
    'STORE_003': {
        name: 'Suburban Hardware',
        location: 'Suburban Plaza',
        timezone: 'America/New_York'
    },
    'STORE_004': {
        name: 'Industrial Hardware',
        location: 'Industrial District',
        timezone: 'America/New_York'
    }
};

module.exports = storeConfigs;
```

## Usage Examples

### Basic Setup

```javascript
const EnhancedPhantomDetector = require('./js/enhanced-phantom-detector');
const storeConfigs = require('./store-config');

// Initialize for your store
const storeId = 'STORE_001'; // Change for each store
const detector = new EnhancedPhantomDetector(storeId, storeConfigs[storeId]);

// Initialize the system
async function initializeSystem() {
    const result = await detector.initialize();
    console.log('System initialized:', result);
}
```

### Daily Phantom Inventory Analysis

```javascript
// Load your inventory data
async function loadInventoryData() {
    const fs = require('fs').promises;
    const data = await fs.readFile('Inventory.txt', 'utf8');
    const lines = data.split('\n');
    const headers = lines[0].split('\t');
    
    return lines.slice(1).map(line => {
        const values = line.split('\t');
        const item = {};
        headers.forEach((header, index) => {
            item[header] = values[index] || '';
        });
        return item;
    });
}

// Run daily analysis
async function runDailyAnalysis() {
    const inventoryData = await loadInventoryData();
    const results = await detector.analyzeInventory(inventoryData);
    
    console.log(`Found ${results.phantomCandidates.length} phantom inventory candidates`);
    
    // Generate daily verification list
    const verificationList = await detector.generateDailyVerificationList(inventoryData);
    console.log(`Generated verification list: ${verificationList.dailyList} items`);
    
    return results;
}
```

### Recording Verification Results

```javascript
// When someone physically verifies an item
async function recordVerification(partNumber, systemStock, physicalStock, notes) {
    const predicted = {
        riskScore: 85,
        isPhantomInventoryCandidate: true,
        riskFactors: ['Order multiple anomaly', 'No recent sales'],
        systemStock: systemStock
    };
    
    const result = await detector.recordVerificationResult(
        partNumber, 
        predicted, 
        physicalStock, 
        notes
    );
    
    console.log('Verification recorded:', result);
    return result;
}

// Batch record multiple verifications
async function batchRecordVerifications(verifications) {
    const results = await detector.batchCompleteVerifications(verifications);
    console.log(`Batch completed: ${results.length} verifications`);
    return results;
}
```

### Integration with Existing Tink System

```javascript
// In your main.js or renderer.js
const EnhancedPhantomDetector = require('./js/enhanced-phantom-detector');

// Add to your existing inventory analysis
async function enhancedInventoryAnalysis() {
    const detector = new EnhancedPhantomDetector('STORE_001', {
        name: 'Your Store Name',
        location: 'Your Location'
    });
    
    await detector.initialize();
    
    // Get inventory data from your existing system
    const inventoryData = await getInventoryData(); // Your existing function
    
    // Run enhanced analysis
    const results = await detector.analyzeInventory(inventoryData);
    
    // Display results in your UI
    displayPhantomInventoryResults(results);
    
    // Generate reports
    const report = await detector.generateComprehensiveReport();
    console.log(`Report generated: ${report.filename}`);
}
```

## Multi-Store Network Setup

### 1. Register All Stores

Run this once to set up the network:

```javascript
const MultiStoreSyncManager = require('./js/multi-store-sync');

async function setupStoreNetwork() {
    const syncManager = new MultiStoreSyncManager();
    
    // Register all stores
    await syncManager.registerStore('STORE_001', {
        name: 'Main Street Hardware',
        location: 'Main Street'
    });
    
    await syncManager.registerStore('STORE_002', {
        name: 'Downtown Hardware',
        location: 'Downtown'
    });
    
    await syncManager.registerStore('STORE_003', {
        name: 'Suburban Hardware',
        location: 'Suburban Plaza'
    });
    
    await syncManager.registerStore('STORE_004', {
        name: 'Industrial Hardware',
        location: 'Industrial District'
    });
    
    console.log('Store network established');
}
```

### 2. Enable Automatic Synchronization

```javascript
// In each store's system
async function enableAutoSync() {
    const detector = new EnhancedPhantomDetector('STORE_001', storeConfigs['STORE_001']);
    await detector.initialize();
    
    // Schedule automatic operations
    detector.scheduleAutomaticOperations(async () => {
        return await loadInventoryData(); // Your inventory loading function
    });
    
    console.log('Automatic sync enabled');
}
```

## Verification Workflow

### 1. Generate Daily Verification Sheets

```javascript
async function generateDailySheets() {
    const inventoryData = await loadInventoryData();
    const result = await detector.generateDailyVerificationList(inventoryData);
    
    console.log(`Generated sheets for ${result.locationGroups} locations`);
    console.log(`Estimated time: ${result.estimatedTime} minutes`);
    
    // The system automatically creates Excel files for printing
    return result;
}
```

### 2. Track Verification Progress

```javascript
// Start verification
async function startVerification(verificationId, employeeName) {
    const verification = await detector.verificationWorkflow.startVerification(
        verificationId, 
        employeeName
    );
    
    console.log(`Started verification for ${verification.partNumber}`);
    return verification;
}

// Complete verification
async function completeVerification(verificationId, physicalCount, notes) {
    const result = await detector.completeVerification(verificationId, {
        physicalCount: physicalCount,
        notes: notes,
        verifiedBy: 'Employee Name'
    });
    
    console.log(`Completed verification: ${result.results.discrepancy} discrepancy`);
    return result;
}
```

## Monitoring and Reporting

### 1. System Statistics

```javascript
async function getSystemHealth() {
    const stats = detector.getSystemStats();
    
    console.log('System Health:');
    console.log(`ML Accuracy: ${stats.systemHealth.mlAccuracy}%`);
    console.log(`Network Connected: ${stats.systemHealth.networkConnected}`);
    console.log(`Verification Backlog: ${stats.systemHealth.verificationBacklog}`);
    console.log(`Last Sync: ${stats.systemHealth.lastSync}`);
    
    return stats;
}
```

### 2. Generate Reports

```javascript
async function generateReports() {
    // Comprehensive system report
    const systemReport = await detector.generateComprehensiveReport();
    console.log(`System report: ${systemReport.filename}`);
    
    // Verification-specific report
    const verificationReport = await detector.verificationWorkflow.generateVerificationReport();
    console.log(`Verification report: ${verificationReport.filename}`);
    
    return { systemReport, verificationReport };
}
```

## Data Backup and Recovery

### 1. Export Data

```javascript
async function backupData() {
    const filename = await detector.exportAllData();
    console.log(`Data backed up to: ${filename}`);
    
    // Also export network data
    const networkExport = await detector.syncManager.exportNetworkData();
    console.log(`Network data exported to: ${networkExport}`);
    
    return { filename, networkExport };
}
```

### 2. Import Data

```javascript
async function restoreData(backupFilename) {
    const result = await detector.importData(backupFilename);
    
    if (result.success) {
        console.log('Data restored successfully');
    } else {
        console.error('Restore failed:', result.error);
    }
    
    return result;
}
```

## Best Practices

### 1. Daily Routine

```javascript
// Set up daily routine
async function dailyRoutine() {
    console.log('Starting daily phantom inventory routine...');
    
    // 1. Load fresh inventory data
    const inventoryData = await loadInventoryData();
    
    // 2. Run analysis
    const results = await detector.analyzeInventory(inventoryData);
    
    // 3. Generate verification list
    const verificationList = await detector.generateDailyVerificationList(inventoryData);
    
    // 4. Generate reports
    const reports = await generateReports();
    
    // 5. Check system health
    const health = await getSystemHealth();
    
    console.log('Daily routine completed');
    return { results, verificationList, reports, health };
}
```

### 2. Weekly Maintenance

```javascript
// Weekly maintenance tasks
async function weeklyMaintenance() {
    console.log('Starting weekly maintenance...');
    
    // 1. Backup data
    await backupData();
    
    // 2. Clean up old verification data (optional)
    // await cleanupOldData();
    
    // 3. Generate comprehensive reports
    await generateReports();
    
    // 4. Check network health
    const networkStats = detector.syncManager.getNetworkStats();
    console.log('Network stats:', networkStats);
    
    console.log('Weekly maintenance completed');
}
```

## Troubleshooting

### Common Issues

1. **Sync Failures**
   ```javascript
   // Check network connectivity
   const networkStats = detector.syncManager.getNetworkStats();
   if (networkStats.activeStores < 2) {
       console.log('Network connectivity issues detected');
   }
   ```

2. **Low Accuracy**
   ```javascript
   // Check if more verifications are needed
   const mlStats = detector.phantomML.getVerificationStats();
   if (mlStats.totalVerifications < 50) {
       console.log('Need more verifications to improve accuracy');
   }
   ```

3. **Data Corruption**
   ```javascript
   // Restore from backup
   await restoreData('backup_filename.json');
   ```

## Performance Optimization

### 1. Batch Processing

```javascript
// Process large inventories in batches
async function processBatchInventory(inventoryData, batchSize = 1000) {
    const results = [];
    
    for (let i = 0; i < inventoryData.length; i += batchSize) {
        const batch = inventoryData.slice(i, i + batchSize);
        const batchResults = await detector.analyzeInventory(batch);
        results.push(...batchResults.phantomCandidates);
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
}
```

### 2. Caching

```javascript
// Cache frequently accessed data
const cache = new Map();

async function getCachedAnalysis(partNumber) {
    if (cache.has(partNumber)) {
        return cache.get(partNumber);
    }
    
    const analysis = await detector.phantomML.analyzePhantomInventoryML(item);
    cache.set(partNumber, analysis);
    
    return analysis;
}
```

## Security Considerations

1. **Data Protection**: All ML data is stored locally in JSON files
2. **Network Security**: Store sync uses local file sharing only
3. **Access Control**: Implement user authentication in your main application
4. **Backup Encryption**: Consider encrypting backup files

## Support and Maintenance

- Monitor system accuracy regularly
- Perform weekly backups
- Review verification results monthly
- Update store configurations as needed
- Clean up old data periodically

This enhanced system will continuously learn and improve, providing increasingly accurate phantom inventory detection across all your stores. 