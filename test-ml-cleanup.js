/**
 * Test script for ML Data Cleanup functionality
 * Run this to test the cleanup system before deployment
 */

const MLDataCleanup = require('./js/ml-data-cleanup');

async function testCleanup() {
    console.log('🧪 Testing ML Data Cleanup System\n');
    
    const cleanup = new MLDataCleanup();
    
    try {
        // 1. Get cleanup preview
        console.log('📋 Getting cleanup preview...');
        const preview = await cleanup.getCleanupPreview();
        
        console.log('Preview Results:');
        console.log(`  Store ML Files: ${preview.storeMLFiles.length}`);
        preview.storeMLFiles.forEach(file => console.log(`    - ${file}`));
        
        console.log(`  Sync Files: ${preview.syncFiles.length}`);
        preview.syncFiles.forEach(file => console.log(`    - ${file}`));
        
        console.log(`  Workflow Files: ${preview.workflowFiles.length}`);
        preview.workflowFiles.forEach(file => console.log(`    - ${file}`));
        
        console.log(`  Timestamp Files: ${preview.timestampFiles.length}`);
        preview.timestampFiles.forEach(file => console.log(`    - ${file}`));
        
        console.log(`  Cloud Sync Cache: ${preview.cloudSyncCache ? 'Yes' : 'No'}`);
        console.log(`  API Config: ${preview.apiConfig ? 'Yes' : 'No'}`);
        
        const totalFiles = preview.storeMLFiles.length + 
                          preview.syncFiles.length + 
                          preview.workflowFiles.length + 
                          preview.timestampFiles.length +
                          (preview.cloudSyncCache ? 1 : 0) +
                          (preview.apiConfig ? 1 : 0);
        
        console.log(`\n📊 Total items that would be cleaned: ${totalFiles}`);
        
        if (totalFiles === 0) {
            console.log('✅ No ML data found - system is already clean!');
            return;
        }
        
        // 2. Ask user if they want to proceed with cleanup
        console.log('\n⚠️  This is a test script. To actually clean data, use:');
        console.log('   - window.api.cleanMLDataOnly() - Keep API config');
        console.log('   - window.api.resetMLDataFactory() - Remove everything');
        console.log('\n🔧 Or use the cleanup methods in Enhanced Phantom Detector');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testCleanup();
