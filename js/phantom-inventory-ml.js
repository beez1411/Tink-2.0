/**
 * Velocity-Based Phantom Inventory Detection System
 * Focuses on detecting items that deviate significantly from their normal sales patterns
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Velocity-Based Phantom Inventory Detection
 */
class PhantomInventoryML {
    constructor(storeId = 'default') {
        this.storeId = storeId;
        this.verificationResults = new Map();
        this.categoryPatterns = new Map();
        this.multiStoreData = new Map();
        this.learningRate = 0.1;
        this.dataFile = `phantom_ml_data_${storeId}.json`;
        this.multiStoreFile = 'phantom_ml_multi_store.json';
        
        // Initialize model weights to prevent null reference errors
        this.modelWeights = {
            velocityDrop: 0.8,
            stockAmount: 0.3,
            unitCost: 0.5,
            riskScore: 0.9
        };
        
        // Detection thresholds - based on business logic, not user preference
        this.FAST_MOVER_THRESHOLD = 1.0;    // 1+ units/week = fast mover
        this.VELOCITY_DROP_THRESHOLD = 0.7;  // 70% velocity drop is suspicious
        this.SLOW_MOVER_STAGNATION_MONTHS = 12; // 12+ months for slow movers
        this.MODERATE_STAGNATION_MONTHS = 6;    // 6+ months for moderate items
        this.HIGH_VALUE_THRESHOLD = 50;         // $50+ items get extra attention
        this.VERY_HIGH_VALUE_THRESHOLD = 100;   // $100+ items get even more attention
        
        // Learning data will be initialized later via explicit call
    }

    /**
     * Initialize learning data from file
     */
    async initializeLearningData() {
        try {
            const data = await fs.readFile(this.dataFile, 'utf8');
            const savedData = JSON.parse(data);
            
            // Restore verification results
            if (savedData.verificationResults) {
                this.verificationResults = new Map(savedData.verificationResults);
            }
            
            // Restore category patterns
            if (savedData.categoryPatterns) {
                this.categoryPatterns = new Map(savedData.categoryPatterns);
            }
            
        } catch (error) {
            console.log(`No existing ML data found for store ${this.storeId}, starting fresh`);
        }
    }

    /**
     * Main phantom inventory analysis - velocity-based approach
     */
    async analyzePhantomInventoryML(item) {
        const currentStock = parseInt(item.STOCKONHAND || 0);
        
        // Skip if no stock showing
        if (currentStock <= 0) {
            return { 
                riskScore: 0, 
                riskFactors: [], 
                category: 'no-stock',
                isPhantomInventoryCandidate: false,
                verificationPriority: 0,
                systemStock: 0
            };
        }

        // Calculate baseline and recent velocity
        const baselineVelocity = this.calculateBaselineVelocity(item);
        const recentVelocity = this.calculateRecentVelocity(item);
        
        let analysisResult;
        
        // Determine analysis approach based on velocity
        if (baselineVelocity >= this.FAST_MOVER_THRESHOLD) {
            analysisResult = this.analyzeFastMoverPhantom(item, baselineVelocity, recentVelocity);
        } else {
            analysisResult = this.analyzeSlowMoverPhantom(item, baselineVelocity);
        }
        
        // Add common risk factors
        this.addCommonRiskFactors(item, analysisResult);
        
        // Calculate verification priority
        const verificationPriority = this.calculateVerificationPriority(item, analysisResult.riskScore);
        
        // Enhanced thresholds to prioritize fast movers
        let isCandidate = false;
        let moverType = 'unknown';
        const unitCost = parseFloat(item.UNITCOST || 0);
        
        if (baselineVelocity >= this.FAST_MOVER_THRESHOLD) {
            // Fast movers: lower threshold for inclusion
            isCandidate = analysisResult.riskScore >= 40;
            moverType = 'fast-mover';
        } else {
            // Slow movers: higher threshold and additional criteria
            isCandidate = analysisResult.riskScore >= 70 && unitCost > 25; // Only high-value slow movers
            moverType = 'slow-mover';
        }
        
        return {
            riskScore: Math.round(analysisResult.riskScore),
            riskFactors: analysisResult.riskFactors.filter(f => f && f.length > 0),
            isPhantomInventoryCandidate: isCandidate,
            verificationPriority,
            category: analysisResult.category,
            baselineVelocity: analysisResult.baselineVelocity,
            recentVelocity: analysisResult.recentVelocity,
            velocityDrop: analysisResult.velocityDrop,
            systemStock: currentStock,
            moverType: moverType,
            unitCost: parseFloat(item.UNITCOST || 0)
        };
    }

    /**
     * Analyze phantom inventory for fast-moving items
     */
    analyzeFastMoverPhantom(item, baselineVelocity, recentVelocity) {
        let riskScore = 0;
        let riskFactors = [];
        
        const currentStock = parseInt(item.STOCKONHAND || 0);
        const unitCost = parseFloat(item.UNITCOST || 0);
        const partNumber = item.PARTNUMBER || '';
        
        // Calculate velocity drop
        const velocityDrop = baselineVelocity > 0 ? 
            (baselineVelocity - recentVelocity) / baselineVelocity : 0;
        
        // Major velocity drop detection
        if (velocityDrop >= this.VELOCITY_DROP_THRESHOLD) {
            const dropPercentage = (velocityDrop * 100).toFixed(1);
            riskScore += 70;
            riskFactors.push(`Fast mover velocity dropped ${dropPercentage}% (was ${baselineVelocity.toFixed(1)}/week, now ${recentVelocity.toFixed(1)}/week)`);
        }
        
        // Complete sales stop for fast movers
        if (recentVelocity === 0 && baselineVelocity >= 2) {
            riskScore += 60;
            riskFactors.push(`Fast mover (${baselineVelocity.toFixed(1)}/week) completely stopped selling`);
        }
        
        // Moderate velocity drop for very fast movers
        if (velocityDrop >= 0.5 && velocityDrop < this.VELOCITY_DROP_THRESHOLD && baselineVelocity >= 3) {
            const dropPercentage = (velocityDrop * 100).toFixed(1);
            riskScore += 40;
            riskFactors.push(`Very fast mover velocity dropped ${dropPercentage}% (was ${baselineVelocity.toFixed(1)}/week, now ${recentVelocity.toFixed(1)}/week)`);
        }
        
        // Add theft risk for valuable fast movers
        if (unitCost > this.HIGH_VALUE_THRESHOLD && this.isTheftProne(item)) {
            riskScore += 25;
            riskFactors.push(`High-value fast mover at theft risk: $${unitCost.toFixed(2)}`);
        }
        
        return {
            riskScore,
            riskFactors,
            category: 'fast-mover-phantom',
            baselineVelocity,
            recentVelocity,
            velocityDrop
        };
    }

    /**
     * Analyze phantom inventory for slow-moving items
     */
    analyzeSlowMoverPhantom(item, baselineVelocity) {
        let riskScore = 0;
        let riskFactors = [];
        
        const currentStock = parseInt(item.STOCKONHAND || 0);
        const unitCost = parseFloat(item.UNITCOST || 0);
        const monthsSinceLastSale = this.getMonthsSinceLastSale(item);
        
        // Long-term stagnation for slow movers
        if (monthsSinceLastSale >= this.SLOW_MOVER_STAGNATION_MONTHS) {
            riskScore += 50;
            riskFactors.push(`Slow mover: No sales for ${monthsSinceLastSale} months`);
        } else if (monthsSinceLastSale >= this.MODERATE_STAGNATION_MONTHS) {
            riskScore += 30;
            riskFactors.push(`Slow mover: No sales for ${monthsSinceLastSale} months`);
        }
        
        // High-value slow movers get extra attention
        if (unitCost > this.VERY_HIGH_VALUE_THRESHOLD && monthsSinceLastSale >= 6) {
            riskScore += 25;
            riskFactors.push(`High-value slow mover: $${unitCost.toFixed(2)}, ${monthsSinceLastSale} months stagnant`);
        }
        
        // Medium-value slow movers with very long stagnation
        if (unitCost > this.HIGH_VALUE_THRESHOLD && monthsSinceLastSale >= 18) {
            riskScore += 20;
            riskFactors.push(`Medium-value slow mover: $${unitCost.toFixed(2)}, ${monthsSinceLastSale} months stagnant`);
        }
        
        return {
            riskScore,
            riskFactors,
            category: 'slow-mover-phantom',
            baselineVelocity,
            recentVelocity: 0,
            velocityDrop: 0,
            monthsSinceLastSale
        };
    }

    /**
     * Add common risk factors that apply to all items
     */
    addCommonRiskFactors(item, analysisResult) {
        // Order quantity anomaly
        const orderAnomaly = this.checkOrderQuantityAnomaly(item);
        if (orderAnomaly.isAnomaly) {
            analysisResult.riskScore += 35;
            analysisResult.riskFactors.push(orderAnomaly.reason);
        }
        
        // High-theft location risk
        const locationRisk = this.checkLocationRisk(item);
        if (locationRisk.isHighRisk) {
            analysisResult.riskScore += 15;
            analysisResult.riskFactors.push(locationRisk.reason);
        }
        
        // Popular brand theft risk
        const brandRisk = this.checkBrandTheftRisk(item);
        if (brandRisk.isHighRisk) {
            analysisResult.riskScore += 20;
            analysisResult.riskFactors.push(brandRisk.reason);
        }
    }

    /**
     * Calculate baseline velocity (weeks 8-20 for stability)
     */
    calculateBaselineVelocity(item) {
        let total = 0;
        let validWeeks = 0;

        for (let week = 8; week <= 20; week++) {
            const weekField = `WEEK_${week}`;
            const sales = parseInt(item[weekField] || 0);
            if (!isNaN(sales)) {
                total += sales;
                validWeeks++;
            }
        }

        return validWeeks > 0 ? total / validWeeks : 0;
    }

    /**
     * Calculate recent velocity (last 4 weeks)
     */
    calculateRecentVelocity(item) {
        let total = 0;
        let validWeeks = 0;

        for (let week = 1; week <= 4; week++) {
            const weekField = `WEEK_${week}`;
            const sales = parseInt(item[weekField] || 0);
            if (!isNaN(sales)) {
                total += sales;
                validWeeks++;
            }
        }

        return validWeeks > 0 ? total / validWeeks : 0;
    }

    /**
     * Get months since last sale
     */
    getMonthsSinceLastSale(item) {
        for (let week = 1; week <= 52; week++) {
            const weekField = `WEEK_${week}`;
            const sales = parseInt(item[weekField] || 0);
            if (sales > 0) {
                return Math.floor((week - 1) / 4.33); // Convert weeks to months
            }
        }
        return 12; // No sales in last 52 weeks = 12+ months
    }

    /**
     * Check for order quantity anomalies
     */
    checkOrderQuantityAnomaly(item) {
        const currentStock = parseInt(item.STOCKONHAND || 0);
        const minOrderQty = parseInt(item.MINORDERQTY || 1);
        const description = (item.DESCRIPTION1 || '').toLowerCase();
        
        // Plumbing parts
        if (this.isPlumbingPart(description) && minOrderQty >= 25 && currentStock <= 5) {
            return {
                isAnomaly: true,
                reason: `Plumbing part: Orders in ${minOrderQty}s, only ${currentStock} showing`
            };
        }
        
        // Electrical parts
        if (this.isElectricalPart(description) && minOrderQty >= 50 && currentStock <= 3) {
            return {
                isAnomaly: true,
                reason: `Electrical part: Orders in ${minOrderQty}s, only ${currentStock} showing`
            };
        }
        
        // Fasteners
        if (this.isFastener(description) && minOrderQty >= 100 && currentStock <= 10) {
            return {
                isAnomaly: true,
                reason: `Fastener: Orders in ${minOrderQty}s, only ${currentStock} showing`
            };
        }
        
        // General high-quantity order anomalies
        if (minOrderQty >= 50 && currentStock <= Math.max(3, minOrderQty * 0.1)) {
            return {
                isAnomaly: true,
                reason: `Order quantity anomaly: Orders in ${minOrderQty}s, only ${currentStock} showing`
            };
        }
        
        return { isAnomaly: false, reason: '' };
    }

    /**
     * Check for high-theft location risk
     */
    checkLocationRisk(item) {
        const location = (item.LOCATIONID || '').toUpperCase();
        const highTheftLocations = ['COUNTER', 'DISPLAY', 'FRONT', 'ACCESSIBLE', 'CHECKOUT', 'ENDCAP'];
        
        for (const riskLocation of highTheftLocations) {
            if (location.includes(riskLocation)) {
                return {
                    isHighRisk: true,
                    reason: `High-theft location: ${location}`
                };
            }
        }
        
        return { isHighRisk: false, reason: '' };
    }

    /**
     * Check for brand theft risk
     */
    checkBrandTheftRisk(item) {
        const description = (item.DESCRIPTION1 || '').toLowerCase();
        const unitCost = parseFloat(item.UNITCOST || 0);
        
        const popularBrands = ['dewalt', 'milwaukee', 'makita', 'ryobi', 'craftsman', 'bosch', 'stanley'];
        
        for (const brand of popularBrands) {
            if (description.includes(brand) && unitCost > this.HIGH_VALUE_THRESHOLD) {
                return {
                    isHighRisk: true,
                    reason: `Popular brand theft risk: ${brand.toUpperCase()}, $${unitCost.toFixed(2)}`
                };
            }
        }
        
        return { isHighRisk: false, reason: '' };
    }

    /**
     * Check if item is theft-prone
     */
    isTheftProne(item) {
        const description = (item.DESCRIPTION1 || '').toLowerCase();
        const unitCost = parseFloat(item.UNITCOST || 0);
        
        // Small, valuable, portable items
        const portableItems = ['bit', 'blade', 'drill', 'driver', 'socket', 'wrench', 'pliers', 'knife'];
        const isPortable = portableItems.some(term => description.includes(term));
        
        return isPortable && unitCost > this.HIGH_VALUE_THRESHOLD;
    }

    /**
     * Category detection methods
     */
    isPlumbingPart(description) {
        const plumbingTerms = ['pipe', 'fitting', 'valve', 'coupling', 'elbow', 'tee', 'union', 'pvc', 'copper'];
        return plumbingTerms.some(term => description.includes(term));
    }

    isElectricalPart(description) {
        const electricalTerms = ['wire', 'cable', 'outlet', 'switch', 'breaker', 'conduit', 'romex', 'thhn'];
        return electricalTerms.some(term => description.includes(term));
    }

    isFastener(description) {
        const fastenerTerms = ['screw', 'bolt', 'nut', 'washer', 'nail', 'rivet', 'anchor', 'hex'];
        return fastenerTerms.some(term => description.includes(term));
    }

    /**
     * Calculate verification priority
     */
    calculateVerificationPriority(item, riskScore) {
        let priority = riskScore;
        
        const unitCost = parseFloat(item.UNITCOST || 0);
        const currentStock = parseInt(item.STOCKONHAND || 0);
        const minOrderQty = parseInt(item.MINORDERQTY || 1);
        
        // High-value items get higher priority
        if (unitCost > this.VERY_HIGH_VALUE_THRESHOLD) priority += 20;
        else if (unitCost > this.HIGH_VALUE_THRESHOLD) priority += 10;
        
        // Order multiple discrepancies get higher priority
        if (minOrderQty >= 50 && currentStock <= 3) priority += 25;
        
        // Theft-prone items get higher priority
        if (this.isTheftProne(item)) priority += 15;
        
        return Math.min(100, priority);
    }

    /**
     * Record verification result and learn from it
     */
    async recordVerificationResult(partNumber, predicted, actualStock, verificationNotes = '') {
        const result = {
            partNumber,
            predicted: {
                riskScore: predicted.riskScore,
                isPhantom: predicted.isPhantomInventoryCandidate,
                riskFactors: predicted.riskFactors,
                systemStock: predicted.systemStock || 0
            },
            actual: {
                physicalStock: actualStock,
                isPhantom: actualStock !== predicted.systemStock,
                discrepancy: Math.abs(actualStock - (predicted.systemStock || 0))
            },
            timestamp: new Date().toISOString(),
            storeId: this.storeId,
            verificationNotes,
            correct: predicted.isPhantomInventoryCandidate === (actualStock !== predicted.systemStock)
        };

        this.verificationResults.set(partNumber, result);
        
        // Learn from this result
        await this.learnFromVerification(result);
        
        // Save updated data
        await this.saveMLData();
        
        return result;
    }

    /**
     * Learn from verification result
     */
    async learnFromVerification(result) {
        const { predicted, actual, correct } = result;
        
        // Update category patterns
        const category = this.extractCategory(result.partNumber);
        if (category) {
            const pattern = this.categoryPatterns.get(category) || {
                totalVerifications: 0,
                correctPredictions: 0,
                avgDiscrepancy: 0
            };
            
            pattern.totalVerifications++;
            if (correct) pattern.correctPredictions++;
            pattern.avgDiscrepancy = (pattern.avgDiscrepancy + actual.discrepancy) / 2;
            
            this.categoryPatterns.set(category, pattern);
        }
    }

    /**
     * Extract category from part number
     */
    extractCategory(partNumber) {
        if (!partNumber) return 'unknown';
        
        const firstChars = partNumber.substring(0, 3).toUpperCase();
        const categoryMap = {
            'PLU': 'plumbing',
            'ELE': 'electrical',
            'FAS': 'fastener',
            'TOO': 'tool',
            'HAR': 'hardware'
        };
        
        return categoryMap[firstChars] || 'general';
    }

    /**
     * Save ML data to file
     */
    async saveMLData() {
        try {
            const data = {
                verificationResults: Array.from(this.verificationResults.entries()),
                categoryPatterns: Array.from(this.categoryPatterns.entries()),
                lastUpdated: new Date().toISOString()
            };
            
            await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`Error saving ML data: ${error.message}`);
        }
    }

    /**
     * Calculate overall accuracy
     */
    calculateOverallAccuracy() {
        if (this.verificationResults.size === 0) return 0;
        
        const correct = Array.from(this.verificationResults.values())
            .filter(result => result.correct).length;
        
        return (correct / this.verificationResults.size) * 100;
    }

    /**
     * Get category accuracy
     */
    getCategoryAccuracy(category) {
        const pattern = this.categoryPatterns.get(category);
        if (!pattern || pattern.totalVerifications === 0) return 0;
        
        return (pattern.correctPredictions / pattern.totalVerifications) * 100;
    }

    /**
     * Get verification statistics
     */
    getVerificationStats() {
        const stats = {
            totalVerifications: this.verificationResults.size,
            overallAccuracy: this.calculateOverallAccuracy(),
            categoryStats: {},
            recentVerifications: 0
        };

        // Category breakdown
        this.categoryPatterns.forEach((pattern, category) => {
            stats.categoryStats[category] = {
                verifications: pattern.totalVerifications,
                accuracy: (pattern.correctPredictions / pattern.totalVerifications) * 100,
                avgDiscrepancy: pattern.avgDiscrepancy
            };
        });

        // Recent verifications (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        stats.recentVerifications = Array.from(this.verificationResults.values())
            .filter(result => new Date(result.timestamp) > thirtyDaysAgo).length;

        return stats;
    }

    /**
     * Calculate overall accuracy from all verification results
     */
    calculateOverallAccuracy() {
        if (this.verificationResults.size === 0) return 0;
        
        let correctPredictions = 0;
        let totalPredictions = this.verificationResults.size;
        
        this.verificationResults.forEach(result => {
            if (result.correct) {
                correctPredictions++;
            }
        });
        
        return totalPredictions > 0 ? correctPredictions / totalPredictions : 0;
    }
}

module.exports = PhantomInventoryML; 