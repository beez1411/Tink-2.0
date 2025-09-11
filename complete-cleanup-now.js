/**
 * Complete ML Data Cleanup - Files + localStorage
 * This script performs a complete cleanup of all ML learning data
 */

const MLDataCleanup = require('./js/ml-data-cleanup');

async function completeCleanup() {
    console.log('🧹 Starting Complete ML Data Cleanup...\n');
    
    const cleanup = new MLDataCleanup();
    
    try {
        // 1. Clean file system data
        console.log('📁 Step 1: Cleaning file system data...');
        const fileResult = await cleanup.resetToFactoryDefaults();
        
        if (fileResult.success) {
            console.log(`✅ File cleanup completed - removed ${fileResult.filesRemoved} files`);
        } else {
            console.error(`❌ File cleanup failed: ${fileResult.error}`);
        }
        
        // 2. Generate localStorage cleanup script
        console.log('\n💾 Step 2: Generating localStorage cleanup script...');
        const localStorageScript = cleanup.getLocalStorageCleanupScript(false); // false = don't keep config
        
        console.log('📋 localStorage cleanup script generated.');
        console.log('🎯 To complete the cleanup, run this in your browser console (F12):');
        console.log('\n' + '='.repeat(80));
        console.log(localStorageScript);
        console.log('='.repeat(80));
        
        console.log('\n🚀 Complete cleanup instructions:');
        console.log('1. ✅ File system cleanup completed automatically');
        console.log('2. 🔧 Copy and paste the script above into your browser console (F12)');
        console.log('3. 🔄 Restart your Tink app');
        console.log('4. 📊 Check "What did Tink Learn?" - should show fresh data');
        
    } catch (error) {
        console.error('❌ Complete cleanup failed:', error.message);
    }
}

// Run the complete cleanup
completeCleanup();
