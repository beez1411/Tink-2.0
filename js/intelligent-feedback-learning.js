/**
 * Intelligent Manager Feedback Learning System
 * 
 * This system learns from manager feedback and intelligently adjusts recommendations
 * while monitoring sales trends to suggest override adjustments when appropriate.
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class IntelligentFeedbackLearning {
    constructor(storeId = 'default') {
        this.storeId = storeId;
        
        // Use user data directory
        const userDataDir = path.join(os.homedir(), '.tink2-data');
        this.overridesFile = path.join(userDataDir, `manager_overrides_${storeId}.json`);
        this.salesTrendsFile = path.join(userDataDir, `sales_trends_${storeId}.json`);
        this.learningMetricsFile = path.join(userDataDir, `learning_metrics_${storeId}.json`);
        
        // Manager overrides: SKU -> override data
        this.managerOverrides = new Map();
        
        // Sales trend tracking: SKU -> sales history
        this.salesTrends = new Map();
        
        // Learning metrics for system improvement
        this.learningMetrics = {
            totalOverrides: 0,
            successfulAdjustments: 0,
            overrideAccuracy: 0,
            avgSalesGrowthDetected: 0,
            lastAnalysis: null
        };
        
        // Configuration
        this.config = {
            // Minimum sales increase % to trigger override adjustment suggestion
            salesGrowthThreshold: 25, // 25% increase
            
            // Minimum time period to track before suggesting adjustments (weeks)
            minimumTrackingPeriod: 8,
            
            // Confidence threshold for suggesting override changes
            confidenceThreshold: 0.75,
            
            // Maximum override adjustment per suggestion (multiplier)
            maxAdjustmentMultiplier: 1.5,
            
            // Minimum number of sales data points needed
            minSalesDataPoints: 4
        };
    }

    /**
     * Initialize the learning system
     */
    async initialize() {
        try {
            await this.loadOverrides();
            await this.loadSalesTrends();
            await this.loadLearningMetrics();
            console.log(`Intelligent Feedback Learning initialized for store ${this.storeId}`);
            return true;
        } catch (error) {
            console.error('Failed to initialize Intelligent Feedback Learning:', error);
            return false;
        }
    }

    /**
     * Record manager feedback and create/update override
     */
    async recordManagerFeedback(feedbackData) {
        try {
            const { sku, tinkRecommendation, managerRecommendation, feedbackType, comments, timestamp } = feedbackData;
            
            // Get or create override entry
            let override = this.managerOverrides.get(sku) || {
                sku: sku,
                originalTinkRecommendation: tinkRecommendation,
                managerPreference: managerRecommendation,
                feedbackType: feedbackType,
                createdAt: timestamp,
                lastUpdated: timestamp,
                feedbackHistory: [],
                salesAtOverride: null,
                currentMultiplier: 1.0,
                adjustmentHistory: [],
                confidence: 1.0, // Start with high confidence in manager's decision
                comments: comments
            };

            // Add this feedback to history
            override.feedbackHistory.push({
                tinkRecommendation,
                managerRecommendation,
                feedbackType,
                timestamp,
                comments
            });

            // Update override based on feedback type
            switch (feedbackType) {
                case 'too-much':
                    override.managerPreference = parseInt(managerRecommendation);
                    override.currentMultiplier = override.managerPreference / tinkRecommendation;
                    break;
                    
                case 'too-little':
                case 'not-enough':
                    override.managerPreference = parseInt(managerRecommendation);
                    override.currentMultiplier = override.managerPreference / tinkRecommendation;
                    break;
                    
                case 'not-needed':
                    override.managerPreference = 0;
                    override.currentMultiplier = 0;
                    break;
            }

            override.lastUpdated = timestamp;
            this.managerOverrides.set(sku, override);

            // Update learning metrics
            this.learningMetrics.totalOverrides++;
            
            // Save data
            await this.saveOverrides();
            await this.saveLearningMetrics();

            console.log(`Recorded manager override for ${sku}: ${tinkRecommendation} → ${override.managerPreference}`);
            
            return override;
            
        } catch (error) {
            console.error('Error recording manager feedback:', error);
            throw error;
        }
    }

    /**
     * Apply manager overrides to order recommendations
     */
    applyManagerOverrides(orderRecommendations) {
        const adjustedRecommendations = [];
        
        for (const item of orderRecommendations) {
            const override = this.managerOverrides.get(item.sku || item.partNumber);
            
            if (override) {
                // Apply the manager's override
                const originalQty = item.recommendedQuantity || item.quantity;
                const adjustedQty = Math.round(originalQty * override.currentMultiplier);
                
                adjustedRecommendations.push({
                    ...item,
                    originalRecommendation: originalQty,
                    recommendedQuantity: adjustedQty,
                    quantity: adjustedQty,
                    overrideApplied: true,
                    overrideReason: `Manager preference: ${override.feedbackType}`,
                    overrideMultiplier: override.currentMultiplier,
                    overrideConfidence: override.confidence
                });
            } else {
                adjustedRecommendations.push({
                    ...item,
                    overrideApplied: false
                });
            }
        }
        
        return adjustedRecommendations;
    }

    /**
     * Update sales data for trend analysis
     */
    async updateSalesData(sku, salesData) {
        try {
            let trend = this.salesTrends.get(sku) || {
                sku: sku,
                salesHistory: [],
                weeklyAverages: [],
                growthRate: 0,
                lastAnalyzed: null
            };

            // Add new sales data point
            trend.salesHistory.push({
                period: new Date().toISOString(),
                sales: salesData.weeklySales || salesData.sales || 0,
                avgWeeklySales: salesData.avgWeeklySales || 0
            });

            // Keep only last 26 weeks (6 months) of data
            if (trend.salesHistory.length > 26) {
                trend.salesHistory = trend.salesHistory.slice(-26);
            }

            // Calculate growth rate
            if (trend.salesHistory.length >= 4) {
                trend.growthRate = this.calculateGrowthRate(trend.salesHistory);
            }

            trend.lastAnalyzed = new Date().toISOString();
            this.salesTrends.set(sku, trend);

            await this.saveSalesTrends();
            
        } catch (error) {
            console.error('Error updating sales data:', error);
        }
    }

    /**
     * Analyze sales trends and suggest override adjustments
     */
    async analyzeTrendsAndSuggestAdjustments() {
        const suggestions = [];
        
        try {
            for (const [sku, override] of this.managerOverrides) {
                const salesTrend = this.salesTrends.get(sku);
                
                if (!salesTrend || salesTrend.salesHistory.length < this.config.minSalesDataPoints) {
                    continue;
                }

                // Check if sales have grown significantly since override was created
                const suggestion = this.evaluateOverrideAdjustment(sku, override, salesTrend);
                
                if (suggestion) {
                    suggestions.push(suggestion);
                }
            }

            // Sort suggestions by confidence and impact
            suggestions.sort((a, b) => (b.confidence * b.impactScore) - (a.confidence * a.impactScore));
            
            return suggestions;
            
        } catch (error) {
            console.error('Error analyzing trends:', error);
            return [];
        }
    }

    /**
     * Evaluate if an override should be adjusted based on sales trends
     */
    evaluateOverrideAdjustment(sku, override, salesTrend) {
        try {
            // Calculate time since override was created
            const overrideAge = (new Date() - new Date(override.createdAt)) / (1000 * 60 * 60 * 24 * 7); // weeks
            
            if (overrideAge < this.config.minimumTrackingPeriod) {
                return null; // Too early to suggest changes
            }

            // Calculate sales growth since override
            const growthRate = salesTrend.growthRate;
            
            if (growthRate < this.config.salesGrowthThreshold) {
                return null; // Not enough growth to warrant adjustment
            }

            // Calculate suggested new quantity
            const growthMultiplier = Math.min(
                1 + (growthRate / 100), 
                this.config.maxAdjustmentMultiplier
            );
            
            const currentPreference = override.managerPreference;
            const suggestedQuantity = Math.round(currentPreference * growthMultiplier);
            
            // Calculate confidence based on various factors
            const confidence = this.calculateAdjustmentConfidence(override, salesTrend, growthRate);
            
            if (confidence < this.config.confidenceThreshold) {
                return null; // Not confident enough in the suggestion
            }

            return {
                sku: sku,
                currentOverride: currentPreference,
                suggestedQuantity: suggestedQuantity,
                growthRate: growthRate,
                confidence: confidence,
                impactScore: this.calculateImpactScore(salesTrend, growthRate),
                reason: `Sales increased by ${growthRate.toFixed(1)}% over ${overrideAge.toFixed(1)} weeks`,
                overrideAge: overrideAge,
                salesTrend: salesTrend.salesHistory.slice(-8) // Last 8 weeks
            };
            
        } catch (error) {
            console.error('Error evaluating override adjustment:', error);
            return null;
        }
    }

    /**
     * Calculate growth rate from sales history
     */
    calculateGrowthRate(salesHistory) {
        if (salesHistory.length < 4) return 0;
        
        // Compare recent 4 weeks average to previous 4 weeks average
        const recent = salesHistory.slice(-4);
        const previous = salesHistory.slice(-8, -4);
        
        if (previous.length === 0) return 0;
        
        const recentAvg = recent.reduce((sum, item) => sum + item.sales, 0) / recent.length;
        const previousAvg = previous.reduce((sum, item) => sum + item.sales, 0) / previous.length;
        
        if (previousAvg === 0) return 0;
        
        return ((recentAvg - previousAvg) / previousAvg) * 100;
    }

    /**
     * Calculate confidence in adjustment suggestion
     */
    calculateAdjustmentConfidence(override, salesTrend, growthRate) {
        let confidence = 0.5; // Base confidence
        
        // Higher confidence for consistent growth
        const consistentGrowth = this.isGrowthConsistent(salesTrend.salesHistory);
        if (consistentGrowth) confidence += 0.2;
        
        // Higher confidence for higher growth rates
        if (growthRate > 50) confidence += 0.2;
        else if (growthRate > 30) confidence += 0.1;
        
        // Higher confidence if override has been stable (no recent changes)
        const daysSinceLastUpdate = (new Date() - new Date(override.lastUpdated)) / (1000 * 60 * 60 * 24);
        if (daysSinceLastUpdate > 30) confidence += 0.1;
        
        // Lower confidence if there have been many adjustments
        if (override.adjustmentHistory.length > 3) confidence -= 0.1;
        
        return Math.min(Math.max(confidence, 0), 1);
    }

    /**
     * Calculate impact score for prioritizing suggestions
     */
    calculateImpactScore(salesTrend, growthRate) {
        const recentSales = salesTrend.salesHistory.slice(-4).reduce((sum, item) => sum + item.sales, 0);
        return (recentSales * growthRate) / 100; // Higher for high-volume, high-growth items
    }

    /**
     * Check if growth is consistent (not just a spike)
     */
    isGrowthConsistent(salesHistory) {
        if (salesHistory.length < 6) return false;
        
        const recent6 = salesHistory.slice(-6);
        let increasingWeeks = 0;
        
        for (let i = 1; i < recent6.length; i++) {
            if (recent6[i].sales > recent6[i-1].sales) {
                increasingWeeks++;
            }
        }
        
        return increasingWeeks >= 4; // At least 4 out of 5 weeks showing growth
    }

    /**
     * Accept a suggested override adjustment
     */
    async acceptOverrideAdjustment(sku, newQuantity, reason) {
        try {
            const override = this.managerOverrides.get(sku);
            if (!override) return false;

            // Record the adjustment
            override.adjustmentHistory.push({
                previousQuantity: override.managerPreference,
                newQuantity: newQuantity,
                reason: reason,
                timestamp: new Date().toISOString(),
                acceptedBy: 'system-suggestion'
            });

            override.managerPreference = newQuantity;
            override.lastUpdated = new Date().toISOString();

            this.managerOverrides.set(sku, override);
            
            // Update metrics
            this.learningMetrics.successfulAdjustments++;
            
            await this.saveOverrides();
            await this.saveLearningMetrics();

            console.log(`Accepted override adjustment for ${sku}: ${override.adjustmentHistory.slice(-1)[0].previousQuantity} → ${newQuantity}`);
            return true;
            
        } catch (error) {
            console.error('Error accepting override adjustment:', error);
            return false;
        }
    }

    /**
     * Get override information for a specific SKU
     */
    getOverrideInfo(sku) {
        return this.managerOverrides.get(sku) || null;
    }

    /**
     * Get all overrides for reporting
     */
    getAllOverrides() {
        return Array.from(this.managerOverrides.values());
    }

    /**
     * Get learning metrics
     */
    getLearningMetrics() {
        return {
            ...this.learningMetrics,
            totalActiveOverrides: this.managerOverrides.size,
            avgOverrideAge: this.calculateAverageOverrideAge()
        };
    }

    /**
     * Calculate average age of overrides
     */
    calculateAverageOverrideAge() {
        if (this.managerOverrides.size === 0) return 0;
        
        const now = new Date();
        let totalAge = 0;
        
        for (const override of this.managerOverrides.values()) {
            const age = (now - new Date(override.createdAt)) / (1000 * 60 * 60 * 24); // days
            totalAge += age;
        }
        
        return totalAge / this.managerOverrides.size;
    }

    // Data persistence methods
    async loadOverrides() {
        try {
            const data = await fs.readFile(this.overridesFile, 'utf8');
            const overrides = JSON.parse(data);
            this.managerOverrides = new Map(overrides);
        } catch (error) {
            console.log(`No existing overrides found for store ${this.storeId}, starting fresh`);
        }
    }

    async saveOverrides() {
        try {
            const data = Array.from(this.managerOverrides.entries());
            await fs.writeFile(this.overridesFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving overrides:', error);
        }
    }

    async loadSalesTrends() {
        try {
            const data = await fs.readFile(this.salesTrendsFile, 'utf8');
            const trends = JSON.parse(data);
            this.salesTrends = new Map(trends);
        } catch (error) {
            console.log(`No existing sales trends found for store ${this.storeId}, starting fresh`);
        }
    }

    async saveSalesTrends() {
        try {
            const data = Array.from(this.salesTrends.entries());
            await fs.writeFile(this.salesTrendsFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving sales trends:', error);
        }
    }

    async loadLearningMetrics() {
        try {
            const data = await fs.readFile(this.learningMetricsFile, 'utf8');
            this.learningMetrics = JSON.parse(data);
        } catch (error) {
            console.log(`No existing learning metrics found for store ${this.storeId}, starting fresh`);
        }
    }

    async saveLearningMetrics() {
        try {
            await fs.writeFile(this.learningMetricsFile, JSON.stringify(this.learningMetrics, null, 2));
        } catch (error) {
            console.error('Error saving learning metrics:', error);
        }
    }
}

module.exports = IntelligentFeedbackLearning;
