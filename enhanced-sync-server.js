/**
 * Enhanced Tink ML Sync Server with Database Integration
 * Handles intelligent feedback learning data across multiple stores
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

// Database configuration
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'tink_user',
    password: process.env.DB_PASSWORD || 'secure_password',
    database: process.env.DB_NAME || 'tink_feedback_learning',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let dbPool;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize database connection
async function initializeDatabase() {
    try {
        dbPool = mysql.createPool(DB_CONFIG);
        
        // Test connection
        const connection = await dbPool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
        
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// Authentication middleware
function validateApiKey(req, res, next) {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/api/health', async (req, res) => {
    try {
        let dbStatus = 'disconnected';
        let storeCount = 0;
        
        if (dbPool) {
            try {
                const [rows] = await dbPool.execute('SELECT COUNT(*) as count FROM stores WHERE is_active = TRUE');
                storeCount = rows[0].count;
                dbStatus = 'connected';
            } catch (dbError) {
                dbStatus = 'error';
            }
        }
        
        res.json({
            status: 'healthy',
            database: dbStatus,
            activeStores: storeCount,
            version: '2.0',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Health check failed' });
    }
});

// ============================================================================
// STORE MANAGEMENT
// ============================================================================

// Register/update store information
app.post('/api/stores/register', validateApiKey, async (req, res) => {
    try {
        const { storeId, storeName, location, region, managerName } = req.body;
        
        if (!storeId || !storeName) {
            return res.status(400).json({ error: 'Store ID and name are required' });
        }
        
        const query = `
            INSERT INTO stores (store_id, store_name, location, region, manager_name)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            store_name = VALUES(store_name),
            location = VALUES(location),
            region = VALUES(region),
            manager_name = VALUES(manager_name),
            updated_at = CURRENT_TIMESTAMP
        `;
        
        await dbPool.execute(query, [storeId, storeName, location, region, managerName]);
        
        res.json({ 
            success: true, 
            message: `Store ${storeId} registered successfully` 
        });
        
    } catch (error) {
        console.error('Store registration error:', error);
        res.status(500).json({ error: 'Failed to register store' });
    }
});

// ============================================================================
// MANAGER FEEDBACK & OVERRIDES
// ============================================================================

// Submit manager feedback
app.post('/api/feedback/submit', validateApiKey, async (req, res) => {
    try {
        const {
            storeId,
            sku,
            tinkRecommendation,
            managerRecommendation,
            feedbackType,
            comments,
            managerName,
            orderContext
        } = req.body;
        
        if (!storeId || !sku || !tinkRecommendation || !feedbackType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const connection = await dbPool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // 1. Insert feedback history
            const feedbackQuery = `
                INSERT INTO feedback_history 
                (store_id, sku, tink_recommendation, manager_recommendation, feedback_type, comments, manager_name, order_context)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            await connection.execute(feedbackQuery, [
                storeId, sku, tinkRecommendation, managerRecommendation, 
                feedbackType, comments, managerName, JSON.stringify(orderContext || {})
            ]);
            
            // 2. Create or update manager override
            const currentMultiplier = calculateMultiplier(tinkRecommendation, managerRecommendation, feedbackType);
            const managerPref = calculateManagerPreference(managerRecommendation, feedbackType);
            
            const overrideQuery = `
                INSERT INTO manager_overrides 
                (store_id, sku, original_tink_recommendation, manager_preference, feedback_type, current_multiplier, comments, manager_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                manager_preference = VALUES(manager_preference),
                feedback_type = VALUES(feedback_type),
                current_multiplier = VALUES(current_multiplier),
                comments = VALUES(comments),
                manager_name = VALUES(manager_name),
                updated_at = CURRENT_TIMESTAMP
            `;
            
            await connection.execute(overrideQuery, [
                storeId, sku, tinkRecommendation, managerPref, 
                feedbackType, currentMultiplier, comments, managerName
            ]);
            
            await connection.commit();
            
            res.json({ 
                success: true, 
                message: 'Feedback submitted successfully',
                override: {
                    sku: sku,
                    managerPreference: managerPref,
                    multiplier: currentMultiplier
                }
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Feedback submission error:', error);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

// Get manager overrides for a store
app.get('/api/overrides/:storeId', validateApiKey, async (req, res) => {
    try {
        const { storeId } = req.params;
        
        const query = `
            SELECT mo.*, sk.description, sk.category
            FROM manager_overrides mo
            JOIN skus sk ON mo.sku = sk.sku
            WHERE mo.store_id = ? AND mo.is_active = TRUE
            ORDER BY mo.updated_at DESC
        `;
        
        const [rows] = await dbPool.execute(query, [storeId]);
        
        res.json({ 
            success: true, 
            overrides: rows 
        });
        
    } catch (error) {
        console.error('Get overrides error:', error);
        res.status(500).json({ error: 'Failed to get overrides' });
    }
});

// Apply overrides to order recommendations
app.post('/api/overrides/apply', validateApiKey, async (req, res) => {
    try {
        const { storeId, orderRecommendations } = req.body;
        
        if (!storeId || !Array.isArray(orderRecommendations)) {
            return res.status(400).json({ error: 'Store ID and order recommendations are required' });
        }
        
        // Get active overrides for this store
        const query = `
            SELECT sku, manager_preference, current_multiplier, feedback_type, confidence
            FROM manager_overrides 
            WHERE store_id = ? AND is_active = TRUE
        `;
        
        const [overrides] = await dbPool.execute(query, [storeId]);
        const overrideMap = new Map(overrides.map(o => [o.sku, o]));
        
        // Apply overrides to recommendations
        const adjustedRecommendations = orderRecommendations.map(item => {
            const override = overrideMap.get(item.sku || item.partNumber);
            
            if (override) {
                const originalQty = item.recommendedQuantity || item.quantity || 0;
                const adjustedQty = Math.round(originalQty * override.current_multiplier);
                
                return {
                    ...item,
                    originalRecommendation: originalQty,
                    recommendedQuantity: adjustedQty,
                    quantity: adjustedQty,
                    overrideApplied: true,
                    overrideReason: `Manager preference: ${override.feedback_type}`,
                    overrideMultiplier: override.current_multiplier,
                    overrideConfidence: override.confidence
                };
            }
            
            return {
                ...item,
                overrideApplied: false
            };
        });
        
        res.json({ 
            success: true, 
            adjustedRecommendations: adjustedRecommendations,
            overridesApplied: adjustedRecommendations.filter(item => item.overrideApplied).length
        });
        
    } catch (error) {
        console.error('Apply overrides error:', error);
        res.status(500).json({ error: 'Failed to apply overrides' });
    }
});

// ============================================================================
// SALES TREND TRACKING
// ============================================================================

// Update sales data
app.post('/api/sales/update', validateApiKey, async (req, res) => {
    try {
        const { storeId, salesData } = req.body;
        
        if (!storeId || !Array.isArray(salesData)) {
            return res.status(400).json({ error: 'Store ID and sales data are required' });
        }
        
        const connection = await dbPool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            for (const sale of salesData) {
                const { sku, weekEndingDate, unitsSold, avgWeeklySales, revenue, stockOnHand } = sale;
                
                const query = `
                    INSERT INTO sales_trends 
                    (store_id, sku, week_ending_date, units_sold, avg_weekly_sales, revenue, stock_on_hand)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                    units_sold = VALUES(units_sold),
                    avg_weekly_sales = VALUES(avg_weekly_sales),
                    revenue = VALUES(revenue),
                    stock_on_hand = VALUES(stock_on_hand)
                `;
                
                await connection.execute(query, [
                    storeId, sku, weekEndingDate, unitsSold || 0, 
                    avgWeeklySales || 0, revenue || 0, stockOnHand || 0
                ]);
            }
            
            await connection.commit();
            
            res.json({ 
                success: true, 
                message: `Updated ${salesData.length} sales records` 
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Sales update error:', error);
        res.status(500).json({ error: 'Failed to update sales data' });
    }
});

// ============================================================================
// OVERRIDE ADJUSTMENT SUGGESTIONS
// ============================================================================

// Get override adjustment suggestions
app.get('/api/suggestions/:storeId', validateApiKey, async (req, res) => {
    try {
        const { storeId } = req.params;
        const minConfidence = parseFloat(req.query.minConfidence) || 0.75;
        const minGrowthRate = parseFloat(req.query.minGrowthRate) || 25.0;
        
        const query = `CALL GetOverrideAdjustmentSuggestions(?, ?, ?)`;
        
        const [rows] = await dbPool.execute(query, [storeId, minConfidence, minGrowthRate]);
        
        const suggestions = rows[0].map(row => ({
            sku: row.sku,
            description: row.description,
            currentOverride: row.current_override,
            suggestedQuantity: row.suggested_quantity,
            growthRate: row.growth_rate,
            confidence: row.confidence,
            overrideAge: row.override_age_weeks,
            impactScore: row.growth_rate * row.recent_4week_avg,
            reason: `Sales increased by ${row.growth_rate.toFixed(1)}% over ${row.override_age_weeks.toFixed(1)} weeks`,
            salesTrend: {
                recent4WeekAvg: row.recent_4week_avg,
                previous4WeekAvg: row.previous_4week_avg
            }
        }));
        
        res.json({ 
            success: true, 
            suggestions: suggestions 
        });
        
    } catch (error) {
        console.error('Get suggestions error:', error);
        res.status(500).json({ error: 'Failed to get suggestions' });
    }
});

// Accept override adjustment
app.post('/api/suggestions/accept', validateApiKey, async (req, res) => {
    try {
        const { storeId, sku, newQuantity, reason, managerName } = req.body;
        
        if (!storeId || !sku || !newQuantity || !reason) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const connection = await dbPool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // Get current override
            const [currentOverride] = await connection.execute(
                'SELECT manager_preference FROM manager_overrides WHERE store_id = ? AND sku = ? AND is_active = TRUE',
                [storeId, sku]
            );
            
            if (currentOverride.length === 0) {
                throw new Error('Override not found');
            }
            
            const previousQuantity = currentOverride[0].manager_preference;
            
            // Record the adjustment
            await connection.execute(`
                INSERT INTO override_adjustments 
                (store_id, sku, previous_quantity, new_quantity, adjustment_reason, accepted_by, manager_name)
                VALUES (?, ?, ?, ?, ?, 'system-suggestion', ?)
            `, [storeId, sku, previousQuantity, newQuantity, reason, managerName]);
            
            // Update the override
            const newMultiplier = newQuantity / 100; // This should be calculated based on original Tink recommendation
            await connection.execute(`
                UPDATE manager_overrides 
                SET manager_preference = ?, current_multiplier = ?, updated_at = CURRENT_TIMESTAMP
                WHERE store_id = ? AND sku = ? AND is_active = TRUE
            `, [newQuantity, newMultiplier, storeId, sku]);
            
            await connection.commit();
            
            res.json({ 
                success: true, 
                message: 'Override adjustment accepted',
                adjustment: {
                    sku: sku,
                    previousQuantity: previousQuantity,
                    newQuantity: newQuantity,
                    reason: reason
                }
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Accept adjustment error:', error);
        res.status(500).json({ error: 'Failed to accept adjustment' });
    }
});

// ============================================================================
// ANALYTICS & INSIGHTS
// ============================================================================

// Get store analytics
app.get('/api/analytics/:storeId', validateApiKey, async (req, res) => {
    try {
        const { storeId } = req.params;
        
        // Get override effectiveness
        const [effectiveness] = await dbPool.execute(`
            SELECT * FROM override_effectiveness WHERE store_id = ?
        `, [storeId]);
        
        // Get recent feedback trends
        const [feedbackTrends] = await dbPool.execute(`
            SELECT 
                feedback_type,
                COUNT(*) as count,
                AVG(CASE WHEN manager_recommendation IS NOT NULL 
                    THEN manager_recommendation / tink_recommendation 
                    ELSE NULL END) as avg_adjustment_ratio
            FROM feedback_history 
            WHERE store_id = ? AND submitted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY feedback_type
        `, [storeId]);
        
        // Get top overridden SKUs
        const [topOverrides] = await dbPool.execute(`
            SELECT 
                mo.sku, 
                sk.description, 
                mo.feedback_type,
                mo.current_multiplier,
                COUNT(fh.id) as feedback_count
            FROM manager_overrides mo
            JOIN skus sk ON mo.sku = sk.sku
            LEFT JOIN feedback_history fh ON mo.store_id = fh.store_id AND mo.sku = fh.sku
            WHERE mo.store_id = ? AND mo.is_active = TRUE
            GROUP BY mo.sku, sk.description, mo.feedback_type, mo.current_multiplier
            ORDER BY feedback_count DESC
            LIMIT 10
        `, [storeId]);
        
        res.json({
            success: true,
            analytics: {
                effectiveness: effectiveness[0] || {},
                feedbackTrends: feedbackTrends,
                topOverrides: topOverrides
            }
        });
        
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculateMultiplier(tinkRecommendation, managerRecommendation, feedbackType) {
    switch (feedbackType) {
        case 'not-needed':
            return 0;
        case 'too-much':
        case 'not-enough':
            return managerRecommendation ? (managerRecommendation / tinkRecommendation) : 0.5;
        default:
            return 1.0;
    }
}

function calculateManagerPreference(managerRecommendation, feedbackType) {
    switch (feedbackType) {
        case 'not-needed':
            return 0;
        case 'too-much':
        case 'not-enough':
            return parseInt(managerRecommendation) || 0;
        default:
            return parseInt(managerRecommendation) || 0;
    }
}

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function startServer() {
    console.log('🚀 Starting Enhanced Tink ML Sync Server...');
    
    // Initialize database
    const dbConnected = await initializeDatabase();
    if (!dbConnected) {
        console.log('⚠️ Starting server without database connection');
    }
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Enhanced Tink ML Sync Server running on port ${PORT}`);
        console.log(`📊 Database: ${dbConnected ? 'Connected' : 'Disconnected'}`);
        console.log(`🔑 API Key: ${API_KEY ? 'Configured' : 'Not configured'}`);
    });
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down server...');
    if (dbPool) {
        await dbPool.end();
        console.log('📊 Database connections closed');
    }
    process.exit(0);
});

startServer();
