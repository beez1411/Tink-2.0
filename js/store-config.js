/**
 * Store Configuration for Enhanced Phantom Inventory System
 * Contains configuration for all 4 hardware stores
 */

const storeConfigs = {
    '16719': {
        id: '16719',
        name: 'Fairview',
        fullName: 'Fairview Hardware',
        location: 'Fairview',
        timezone: 'America/Denver', // Adjust timezone as needed
        displayName: '16719 - Fairview'
    },
    '17521': {
        id: '17521',
        name: 'Eagle',
        fullName: 'Eagle Hardware',
        location: 'Eagle',
        timezone: 'America/Denver',
        displayName: '17521 - Eagle'
    },
    '18179': {
        id: '18179',
        name: 'Broadway',
        fullName: 'Broadway Hardware',
        location: 'Broadway',
        timezone: 'America/Denver',
        displayName: '18179 - Broadway'
    },
    '18181': {
        id: '18181',
        name: 'State',
        fullName: 'State Hardware',
        location: 'State',
        timezone: 'America/Denver',
        displayName: '18181 - State'
    }
};

/**
 * Get store configuration by ID
 */
function getStoreConfig(storeId) {
    return storeConfigs[storeId] || null;
}

/**
 * Get all store configurations
 */
function getAllStoreConfigs() {
    return storeConfigs;
}

/**
 * Get store options for UI dropdown
 */
function getStoreOptions() {
    return Object.values(storeConfigs).map(store => ({
        value: store.id,
        label: store.displayName,
        name: store.name,
        fullName: store.fullName
    }));
}

/**
 * Validate store ID
 */
function isValidStoreId(storeId) {
    return storeConfigs.hasOwnProperty(storeId);
}

module.exports = {
    storeConfigs,
    getStoreConfig,
    getAllStoreConfigs,
    getStoreOptions,
    isValidStoreId
}; 