/**
 * Run ML Data Cleanup Now
 * This script will perform a factory reset of all ML data
 */

const MLDataCleanup = require('./js/ml-data-cleanup');

async function runCleanupNow() {
    console.log('🧹 Starting ML Data Factory Reset...\n');
    
    const cleanup = new MLDataCleanup();
    
    try {
        // Show what will be cleaned first
        console.log('📋 Preview of data to be cleaned:');
        const preview = await cleanup.getCleanupPreview();
        
        const totalFiles = preview.storeMLFiles.length + 
                          preview.syncFiles.length + 
                          preview.workflowFiles.length + 
                          preview.timestampFiles.length +
                          (preview.cloudSyncCache ? 1 : 0) +
                          (preview.apiConfig ? 1 : 0);
        
        if (totalFiles === 0) {
            console.log('✅ No ML data found - system is already clean!');
            return;
        }
        
        console.log(`📊 Found ${totalFiles} items to clean:`);
        preview.storeMLFiles.forEach(file => console.log(`  🗑️ ${file}`));
        preview.syncFiles.forEach(file => console.log(`  🗑️ ${file}`));
        preview.workflowFiles.forEach(file => console.log(`  🗑️ ${file}`));
        preview.timestampFiles.forEach(file => console.log(`  🗑️ ${file}`));
        if (preview.cloudSyncCache) console.log(`  🗑️ cloud-sync/ directory`);
        if (preview.apiConfig) console.log(`  🗑️ api-config.json`);
        
        console.log('\n🚀 Performing factory reset...');
        
        // Perform the cleanup
        const result = await cleanup.resetToFactoryDefaults();
        
        if (result.success) {
            console.log(`\n✅ Factory reset completed successfully!`);
            console.log(`📊 Removed ${result.filesRemoved} files/directories`);
            console.log('\n🎯 Next steps:');
            console.log('1. Restart your Tink app');
            console.log('2. Check the "What did Tink Learn?" section');
            console.log('3. Run a phantom inventory test');
            console.log('4. Verify fresh learning data appears');
        } else {
            console.error(`❌ Factory reset failed: ${result.error}`);
        }
        
    } catch (error) {
        console.error('❌ Cleanup script failed:', error.message);
    }
}

// Run the cleanup
runCleanupNow();
