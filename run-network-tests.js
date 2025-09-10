/**
 * Quick test runner for Tink 2.0 networking
 */

const TinkNetworkTester = require('./test-networking-setup.js');

async function runTests() {
    const tester = new TinkNetworkTester({
        dropletIP: '178.128.185.6',
        apiKey: 'tink-ml-sync-a8b3fd7db46dd67d434aa5a74821fd64'
    });

    await tester.runAllTests();
}

runTests().catch(console.error);
