/**
 * Stock-Out Prediction Algorithm for Tink 2.0
 * Analyzes sales velocity patterns to detect potential stock-outs due to theft, misshipments, or other factors.
 * JavaScript version - no Python dependencies required!
 */

const fs = require('fs').promises;
const path = require('path');
const ExcelJS = require('exceljs');

/**
 * Data class for stock-out predictions
 */
class StockOutPrediction {
    constructor({
        partNumber,
        description,
        currentStock,
        baselineVelocity,
        recentVelocity,
        dropPercentage,
        confidence,
        priorityScore,
        suggestedQty,
        unitCost,
        minOrderQty,
        supplier,
        seasonalFactor = 1.0,
        trendFactor = 1.0,
        lastSaleDate = null,
        riskFactors = []
    }) {
        this.partNumber = partNumber;
        this.description = description;
        this.currentStock = currentStock;
        this.baselineVelocity = baselineVelocity;
        this.recentVelocity = recentVelocity;
        this.dropPercentage = dropPercentage;
        this.confidence = confidence;
        this.priorityScore = priorityScore;
        this.suggestedQty = suggestedQty;
        this.unitCost = unitCost;
        this.minOrderQty = minOrderQty;
        this.supplier = supplier;
        this.seasonalFactor = seasonalFactor;
        this.trendFactor = trendFactor;
        this.lastSaleDate = lastSaleDate;
        this.riskFactors = riskFactors;
    }

    toDict() {
        return {
            partNumber: this.partNumber,
            description: this.description,
            currentStock: this.currentStock,
            baselineVelocity: this.baselineVelocity,
            recentVelocity: this.recentVelocity,
            dropPercentage: this.dropPercentage,
            confidence: this.confidence,
            priorityScore: this.priorityScore,
            suggestedQty: this.suggestedQty,
            unitCost: this.unitCost,
            minOrderQty: this.minOrderQty,
            supplier: this.supplier,
            seasonalFactor: this.seasonalFactor,
            trendFactor: this.trendFactor,
            lastSaleDate: this.lastSaleDate,
            riskFactors: this.riskFactors
        };
    }
}

/**
 * Analyzes inventory data to predict potential stock-outs
 */
class StockOutAnalyzer {
    constructor(configPath = 'config.json') {
        this.config = {};
        this.onOrderData = {};
        this.predictions = [];
        this.configPath = configPath;
    }

    /**
     * Load configuration from JSON file
     */
    async loadConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(configData);
            this.onOrderData = this.config.onOrderData || {};
            
            console.log(`Loaded config from ${this.configPath}`);
            console.log(`Input file: ${this.config.input_file || 'Not specified'}`);
            console.log(`On order data items: ${Object.keys(this.onOrderData).length}`);
            
            return this.config;
        } catch (error) {
            console.error(`Error loading config: ${error.message}`);
            return {};
        }
    }

    /**
     * Read CSV/TSV file and parse it into array of objects
     */
    async readInventoryFile(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            const lines = data.split('\n').filter(line => line.trim());
            
            if (lines.length === 0) {
                throw new Error('File is empty');
            }

            // Parse header
            const header = lines[0].split('\t').map(col => col.trim());
            const items = [];

            // Parse data rows
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split('\t');
                const item = {};
                
                header.forEach((col, index) => {
                    item[col] = values[index] ? values[index].trim() : '';
                });
                
                items.push(item);
            }

            console.log(`Loaded ${items.length} items from inventory file`);
            return items;
        } catch (error) {
            console.error(`Error reading inventory file: ${error.message}`);
            throw error;
        }
    }

    /**
     * ADAPTIVE PHANTOM INVENTORY DETECTION ALGORITHM
     * Uses real inventory characteristics to predict phantom inventory scenarios
     * FOCUS: Items with POSITIVE stock on hand that may not physically exist
     */
    analyzePhantomInventoryRisk(item) {
        try {
            const currentStock = parseInt(item.STOCKONHAND || 0);
            const unitCost = parseFloat(item.UNITCOST || 0);
            const minOrderQty = parseInt(item.MINORDERQTY || 1);
            const partNumber = String(item.PARTNUMBER || '');
            const description = String(item.DESCRIPTION1 || '').toLowerCase();
            
            // EXCLUDE ZERO STOCK ITEMS - These are regular stock-outs, not phantom inventory
            if (currentStock <= 0) {
                return {
                    riskScore: 0,
                    riskFactors: ["Zero stock - not phantom inventory"],
                    isPhantomInventoryCandidate: false
                };
            }
            
            let riskScore = 0;
            let riskFactors = [];
            
            // THEFT RISK ANALYSIS (items more likely to be stolen from shelves)
            const theftRisk = this.calculateTheftRisk(item, unitCost, description);
            riskScore += theftRisk.score;
            if (theftRisk.factors.length > 0) {
                riskFactors.push(...theftRisk.factors);
            }
            
            // ORDER MULTIPLE ANOMALY ANALYSIS (large orders but only few left)
            const orderAnomalyRisk = this.calculateOrderMultipleAnomaly(currentStock, minOrderQty, unitCost);
            riskScore += orderAnomalyRisk.score;
            if (orderAnomalyRisk.factors.length > 0) {
                riskFactors.push(...orderAnomalyRisk.factors);
            }
            
            // FAST MOVER STAGNATION ANALYSIS (should be selling but may not be)
            const stagnationRisk = this.calculateFastMoverStagnation(item, currentStock, unitCost);
            riskScore += stagnationRisk.score;
            if (stagnationRisk.factors.length > 0) {
                riskFactors.push(...stagnationRisk.factors);
            }
            
            // POSITIVE STOCK ANOMALY ANALYSIS (suspicious stock levels for positive stock)
            const stockAnomalyRisk = this.calculatePositiveStockAnomaly(currentStock, unitCost, minOrderQty);
            riskScore += stockAnomalyRisk.score;
            if (stockAnomalyRisk.factors.length > 0) {
                riskFactors.push(...stockAnomalyRisk.factors);
            }
            
            return {
                riskScore: riskScore,
                riskFactors: riskFactors,
                isPhantomInventoryCandidate: riskScore >= 70 // 70+ points indicates high phantom inventory risk
            };
            
        } catch (error) {
            console.error(`Error analyzing phantom inventory risk: ${error.message}`);
            return {
                riskScore: 0,
                riskFactors: [],
                isPhantomInventoryCandidate: false
            };
        }
    }

    /**
     * Calculate confidence score for 26-week focused analysis
     * STRINGENT: Emphasize significant drops and critical stock situations
     */

    /**
     * Calculate priority score for ordering decisions
     */
    calculatePriorityScore(confidence, unitCost, baselineVelocity) {
        try {
            // Higher priority for high confidence, high cost, and fast-moving items
            const priority = (confidence * 0.4 + 
                            Math.min(100, unitCost * 2) * 0.3 + 
                            Math.min(100, baselineVelocity * 20) * 0.3);
            
            return Math.max(0, Math.min(100, priority));
        } catch (error) {
            console.error(`Error calculating priority score: ${error.message}`);
            return 50.0;
        }
    }

    /**
     * Calculate theft risk based on item characteristics
     * High-value, portable items are more likely to be stolen
     */
    calculateTheftRisk(item, unitCost, description) {
        let score = 0;
        let factors = [];
        
        try {
            // HIGH VALUE ITEMS (prime theft targets)
            if (unitCost > 100) {
                score += 25;
                factors.push(`High value item ($${unitCost.toFixed(2)})`);
            } else if (unitCost > 50) {
                score += 15;
                factors.push(`Medium-high value item ($${unitCost.toFixed(2)})`);
            } else if (unitCost > 25) {
                score += 10;
                factors.push(`Medium value item ($${unitCost.toFixed(2)})`);
            }
            
            // PORTABLE/SMALL ITEMS (easy to steal)
            const portableKeywords = [
                'tool', 'bit', 'blade', 'drill', 'wrench', 'socket', 'key', 'meter',
                'battery', 'charger', 'wire', 'cable', 'connector', 'adapter',
                'knife', 'cutter', 'plier', 'driver', 'hex', 'torx',
                'bearing', 'seal', 'gasket', 'o-ring', 'fitting'
            ];
            
            const matchedPortable = portableKeywords.filter(keyword => 
                description.includes(keyword)
            );
            
            if (matchedPortable.length > 0) {
                score += 15;
                factors.push(`Portable item (${matchedPortable.join(', ')})`);
            }
            
            // BRAND NAME ITEMS (popular theft targets)
            const popularBrands = [
                'dewalt', 'milwaukee', 'makita', 'ryobi', 'bosch', 'stanley',
                'craftsman', 'snap-on', 'mac', 'matco', 'cornwell',
                'fluke', 'klein', 'greenlee', 'ideal'
            ];
            
            const matchedBrands = popularBrands.filter(brand => 
                description.includes(brand)
            );
            
            if (matchedBrands.length > 0) {
                score += 20;
                factors.push(`Popular brand (${matchedBrands.join(', ')})`);
            }
            
            // CONSUMABLE/WEAR ITEMS (frequently used, easy to pocket)
            const consumableKeywords = [
                'bulb', 'fuse', 'filter', 'pad', 'disc', 'sandpaper',
                'blade', 'bit', 'tip', 'insert', 'cartridge'
            ];
            
            const matchedConsumable = consumableKeywords.filter(keyword => 
                description.includes(keyword)
            );
            
            if (matchedConsumable.length > 0) {
                score += 10;
                factors.push(`Consumable item (${matchedConsumable.join(', ')})`);
            }
            
            return { score, factors };
            
        } catch (error) {
            console.error(`Error calculating theft risk: ${error.message}`);
            return { score: 0, factors: [] };
        }
    }

    /**
     * Calculate order multiple anomaly risk
     * Items with large min order qty but only 1-3 in stock are suspicious
     */
    calculateOrderMultipleAnomaly(currentStock, minOrderQty, unitCost) {
        let score = 0;
        let factors = [];
        
        try {
            // Only analyze if we have valid order quantities
            if (minOrderQty <= 1 || currentStock < 0) {
                return { score: 0, factors: [] };
            }
            
            // Calculate the ratio of current stock to minimum order quantity
            const stockToOrderRatio = currentStock / minOrderQty;
            
            // SEVERE ANOMALY: Large order qty but only 1-3 left
            if (minOrderQty >= 50 && currentStock <= 3) {
                score += 40;
                factors.push(`Large order multiple anomaly (Min order: ${minOrderQty}, Stock: ${currentStock})`);
            } else if (minOrderQty >= 25 && currentStock <= 2) {
                score += 35;
                factors.push(`Medium order multiple anomaly (Min order: ${minOrderQty}, Stock: ${currentStock})`);
            } else if (minOrderQty >= 10 && currentStock <= 1) {
                score += 30;
                factors.push(`Small order multiple anomaly (Min order: ${minOrderQty}, Stock: ${currentStock})`);
            }
            
            // MODERATE ANOMALY: Stock is much less than order multiple
            else if (stockToOrderRatio < 0.1 && minOrderQty >= 20) {
                score += 25;
                factors.push(`Low stock vs order ratio (${(stockToOrderRatio * 100).toFixed(1)}% of min order)`);
            } else if (stockToOrderRatio < 0.2 && minOrderQty >= 10) {
                score += 15;
                factors.push(`Below-normal stock vs order ratio (${(stockToOrderRatio * 100).toFixed(1)}% of min order)`);
            }
            
            // HIGH VALUE + ORDER ANOMALY MULTIPLIER
            if (score > 0 && unitCost > 50) {
                const valueMultiplier = unitCost > 100 ? 1.5 : 1.2;
                const bonusScore = Math.floor(score * (valueMultiplier - 1));
                score += bonusScore;
                factors.push(`High value amplifies risk (+${bonusScore} points)`);
            }
            
            return { score, factors };
            
        } catch (error) {
            console.error(`Error calculating order multiple anomaly: ${error.message}`);
            return { score: 0, factors: [] };
        }
    }

    /**
     * Calculate fast mover stagnation risk
     * Items that should be moving quickly but appear stagnant
     */
    calculateFastMoverStagnation(item, currentStock, unitCost) {
        let score = 0;
        let factors = [];
        
        try {
            const description = String(item.DESCRIPTION1 || '').toLowerCase();
            const partNumber = String(item.PARTNUMBER || '');
            
            // IDENTIFY FAST MOVER CHARACTERISTICS
            let shouldBeFastMover = false;
            let fastMoverReasons = [];
            
            // CONSUMABLE/WEAR ITEMS (should move frequently)
            const consumableKeywords = [
                'filter', 'oil', 'fluid', 'grease', 'bulb', 'fuse', 'battery',
                'blade', 'bit', 'pad', 'disc', 'paper', 'belt', 'brush',
                'seal', 'gasket', 'o-ring', 'washer', 'bolt', 'screw', 'nut'
            ];
            
            const matchedConsumable = consumableKeywords.filter(keyword => 
                description.includes(keyword)
            );
            
            if (matchedConsumable.length > 0) {
                shouldBeFastMover = true;
                fastMoverReasons.push(`Consumable item (${matchedConsumable.join(', ')})`);
            }
            
            // COMMON TOOLS (should move regularly)
            const commonToolKeywords = [
                'wrench', 'socket', 'ratchet', 'driver', 'plier', 'hammer',
                'tape', 'wire', 'cable', 'connector', 'adapter', 'fitting'
            ];
            
            const matchedTools = commonToolKeywords.filter(keyword => 
                description.includes(keyword)
            );
            
            if (matchedTools.length > 0) {
                shouldBeFastMover = true;
                fastMoverReasons.push(`Common tool (${matchedTools.join(', ')})`);
            }
            
            // POPULAR BRANDS (should move faster)
            const popularBrands = ['dewalt', 'milwaukee', 'makita', 'bosch', 'stanley'];
            const matchedBrands = popularBrands.filter(brand => 
                description.includes(brand)
            );
            
            if (matchedBrands.length > 0) {
                shouldBeFastMover = true;
                fastMoverReasons.push(`Popular brand (${matchedBrands.join(', ')})`);
            }
            
            // MODERATE COST ITEMS (sweet spot for regular sales)
            if (unitCost >= 15 && unitCost <= 75) {
                shouldBeFastMover = true;
                fastMoverReasons.push(`Moderate cost range ($${unitCost.toFixed(2)})`);
            }
            
            // IF SHOULD BE FAST MOVER, CHECK FOR STAGNATION INDICATORS
            if (shouldBeFastMover) {
                // POSITIVE STOCK patterns that suggest phantom inventory
                if (currentStock >= 1 && currentStock <= 3) {
                    score += 35;
                    factors.push(`CRITICAL: Fast mover with suspicious low stock (${currentStock} units)`);
                    factors.push(`Should be fast mover: ${fastMoverReasons.join(', ')}`);
                } else if (currentStock >= 4 && currentStock <= 8) {
                    score += 20;
                    factors.push(`MODERATE: Fast mover with concerning stock level (${currentStock} units)`);
                    factors.push(`Should be fast mover: ${fastMoverReasons.join(', ')}`);
                } else if (currentStock >= 9 && currentStock <= 15) {
                    score += 10;
                    factors.push(`MINOR: Fast mover with potentially stagnant stock (${currentStock} units)`);
                    factors.push(`Should be fast mover: ${fastMoverReasons.join(', ')}`);
                }
                
                // HIGH VALUE FAST MOVERS (more concerning if stagnant)
                if (unitCost > 50 && score > 0) {
                    const bonusScore = Math.floor(score * 0.4);
                    score += bonusScore;
                    factors.push(`High-value fast mover amplifies phantom concern (+${bonusScore} points)`);
                }
            }
            
            return { score, factors };
            
        } catch (error) {
            console.error(`Error calculating fast mover stagnation: ${error.message}`);
            return { score: 0, factors: [] };
        }
    }

    /**
     * Calculate positive stock anomaly risk
     * PHANTOM INVENTORY FOCUS: Suspicious patterns for items with positive stock
     */
    calculatePositiveStockAnomaly(currentStock, unitCost, minOrderQty) {
        let score = 0;
        let factors = [];
        
        try {
            // CRITICAL PHANTOM INVENTORY RANGE (1-3 units showing in system)
            if (currentStock >= 1 && currentStock <= 3) {
                if (unitCost > 100) {
                    score += 30;
                    factors.push(`CRITICAL: High-value item with only ${currentStock} unit(s) showing ($${unitCost.toFixed(2)})`);
                } else if (unitCost > 50) {
                    score += 25;
                    factors.push(`CRITICAL: Medium-high value item with only ${currentStock} unit(s) showing ($${unitCost.toFixed(2)})`);
                } else if (unitCost > 25) {
                    score += 20;
                    factors.push(`CRITICAL: Medium value item with only ${currentStock} unit(s) showing ($${unitCost.toFixed(2)})`);
                } else if (unitCost > 10) {
                    score += 15;
                    factors.push(`CRITICAL: Low-medium value item with only ${currentStock} unit(s) showing ($${unitCost.toFixed(2)})`);
                }
            }
            
            // MODERATE PHANTOM INVENTORY RANGE (4-8 units showing in system)
            else if (currentStock >= 4 && currentStock <= 8) {
                if (unitCost > 75) {
                    score += 20;
                    factors.push(`MODERATE: High-value item with low stock showing (${currentStock} units, $${unitCost.toFixed(2)})`);
                } else if (unitCost > 30) {
                    score += 15;
                    factors.push(`MODERATE: Medium-value item with low stock showing (${currentStock} units, $${unitCost.toFixed(2)})`);
                } else if (unitCost > 15) {
                    score += 10;
                    factors.push(`MODERATE: Lower-value item with concerning stock level (${currentStock} units, $${unitCost.toFixed(2)})`);
                }
            }
            
            // VALUE-BASED PHANTOM INVENTORY RISK MULTIPLIERS
            // Higher value items are more concerning when stock levels are suspicious
            if (score > 0) {
                if (unitCost > 200) {
                    const bonusScore = Math.floor(score * 0.5);
                    score += bonusScore;
                    factors.push(`AMPLIFIED: Very high value increases phantom risk (+${bonusScore} points)`);
                } else if (unitCost > 100) {
                    const bonusScore = Math.floor(score * 0.3);
                    score += bonusScore;
                    factors.push(`AMPLIFIED: High value increases phantom risk (+${bonusScore} points)`);
                }
            }
            
            // ORDER QUANTITY vs STOCK DISCREPANCY
            // If min order qty suggests bulk ordering but only small amounts remain
            if (minOrderQty >= 50 && currentStock <= 5) {
                const discrepancyScore = 20;
                score += discrepancyScore;
                factors.push(`ORDER DISCREPANCY: Min order ${minOrderQty} but only ${currentStock} remaining (+${discrepancyScore} points)`);
            } else if (minOrderQty >= 25 && currentStock <= 3) {
                const discrepancyScore = 15;
                score += discrepancyScore;
                factors.push(`ORDER DISCREPANCY: Min order ${minOrderQty} but only ${currentStock} remaining (+${discrepancyScore} points)`);
            } else if (minOrderQty >= 10 && currentStock <= 2) {
                const discrepancyScore = 10;
                score += discrepancyScore;
                factors.push(`ORDER DISCREPANCY: Min order ${minOrderQty} but only ${currentStock} remaining (+${discrepancyScore} points)`);
            }
            
            return { score, factors };
            
        } catch (error) {
            console.error(`Error calculating positive stock anomaly: ${error.message}`);
            return { score: 0, factors: [] };
        }
    }

    /**
     * Calculate priority score based on risk factors
     */
    calculatePhantomInventoryPriority(riskScore, unitCost, currentStock, riskFactors) {
        try {
            // Implement your logic to calculate priority score based on risk factors
            // This is a placeholder and should be replaced with the actual implementation
            return Math.min(100, riskScore);
        } catch (error) {
            console.error(`Error calculating priority score: ${error.message}`);
            return 50.0;
        }
    }

    /**
     * Calculate suggested quantity based on business logic
     */
    calculateSuggestedQuantity(currentStock, minOrderQty, unitCost) {
        try {
            // Implement your logic to calculate suggested quantity based on business logic
            // This is a placeholder and should be replaced with the actual implementation
            return Math.max(minOrderQty, Math.floor(currentStock * 1.5));
        } catch (error) {
            console.error(`Error calculating suggested quantity: ${error.message}`);
            return minOrderQty;
        }
    }

    /**
     * Generate stock-out predictions from inventory data
     */
    async generateStockoutPredictions(inputFile) {
        try {
            console.log(`Loading inventory data from ${inputFile}`);
            
            // Read the inventory file
            const items = await this.readInventoryFile(inputFile);
            
            console.log(`Processing ${items.length} items from all suppliers`);
            
            if (items.length === 0) {
                console.warn('No items found in inventory file');
                return [];
            }
            
            const predictions = [];
            const supplierStats = {};
            
            // Process data in chunks to avoid memory issues
            const chunkSize = 10000;
            const chunks = [];
            for (let i = 0; i < items.length; i += chunkSize) {
                chunks.push(items.slice(i, i + chunkSize));
            }
            
            for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
                const chunk = chunks[chunkIdx];
                console.log(`Processing chunk ${chunkIdx + 1} for stock-out analysis...`);
                
                for (const item of chunk) {
                    try {
                        // Extract item details using correct field names
                        const partNumber = String(item.PARTNUMBER || '');
                        const description = String(item.DESCRIPTION1 || '');
                        const currentStock = parseInt(item.STOCKONHAND || 0);
                        const unitCost = parseFloat(item.UNITCOST || 0);
                        const minOrderQty = parseInt(item.MINORDERQTY || 1);
                        
                        // Extract supplier information from the correct field names
                        const supplierNumber = parseInt(
                            item.SUPPLIER_NUMBER1 || 
                            item.SUPPLIER_NUMBER2 || 
                            0
                        );
                        
                        // Skip items with no part number, invalid supplier, or negative stock
                        if (!partNumber || supplierNumber === 0 || currentStock < 0) {
                            continue;
                        }
                        
                        // Track supplier statistics
                        if (!supplierStats[supplierNumber]) {
                            supplierStats[supplierNumber] = {
                                totalItems: 0,
                                processedItems: 0,
                                predictions: 0
                            };
                        }
                        supplierStats[supplierNumber].totalItems++;
                        supplierStats[supplierNumber].processedItems++;
                        
                        // Debug logging for first few items per supplier (phantom inventory analysis)
                        if (supplierStats[supplierNumber].processedItems <= 2) {
                            console.log(`PHANTOM ANALYSIS Item ${partNumber}: cost=$${unitCost.toFixed(2)}, stock=${currentStock}, minOrder=${minOrderQty}`);
                        }
                        
                        // ADAPTIVE PHANTOM INVENTORY DETECTION
                        // Analyze real inventory characteristics for phantom inventory risk
                        const phantomAnalysis = this.analyzePhantomInventoryRisk(item);
                        
                        if (phantomAnalysis.isPhantomInventoryCandidate) {
                            // Calculate confidence based on risk score and factors
                            const confidence = Math.min(95, Math.max(50, phantomAnalysis.riskScore));
                            
                            // Log successful predictions for monitoring
                            if (supplierStats[supplierNumber].predictions < 5) {
                                console.log(`PHANTOM INVENTORY DETECTED: ${partNumber} - Risk Score: ${phantomAnalysis.riskScore}, Confidence: ${confidence.toFixed(1)}%`);
                                console.log(`Risk Factors: ${phantomAnalysis.riskFactors.join(' | ')}`);
                            }
                            
                            // Calculate priority score based on risk factors
                            const priorityScore = this.calculatePhantomInventoryPriority(
                                phantomAnalysis.riskScore, unitCost, currentStock, phantomAnalysis.riskFactors
                            );
                            
                            // Calculate suggested quantity based on business logic
                            const suggestedQty = this.calculateSuggestedQuantity(currentStock, minOrderQty, unitCost);
                            
                            // Create prediction
                            const prediction = new StockOutPrediction({
                                partNumber,
                                description,
                                currentStock,
                                baselineVelocity: 0, // Not applicable for phantom inventory detection
                                recentVelocity: 0, // Not applicable for phantom inventory detection
                                dropPercentage: 0, // Not applicable for phantom inventory detection
                                confidence,
                                priorityScore,
                                suggestedQty,
                                unitCost,
                                minOrderQty,
                                supplier: supplierNumber,
                                seasonalFactor: 1.0,
                                trendFactor: 1.0,
                                riskFactors: phantomAnalysis.riskFactors // Add risk factors to prediction
                            });
                            
                            predictions.push(prediction);
                            supplierStats[supplierNumber].predictions++;
                        } else {
                            // Debug logging for items that don't meet phantom inventory criteria
                            if (supplierStats[supplierNumber].processedItems <= 10) {
                                console.log(`DEBUG Item ${partNumber}: Risk Score=${phantomAnalysis.riskScore} (threshold=70), cost=$${unitCost.toFixed(2)}, stock=${currentStock}`);
                            }
                        }
                    } catch (error) {
                        console.error(`Error processing item ${item.PartNumber || 'Unknown'}: ${error.message}`);
                        continue;
                    }
                }
            }
            
            // Sort by supplier first, then by priority score (descending)
            predictions.sort((a, b) => {
                if (a.supplier !== b.supplier) {
                    return a.supplier - b.supplier; // Sort by supplier number ascending
                }
                return b.priorityScore - a.priorityScore; // Then by priority score descending
            });
            
            // Log supplier statistics
            console.log(`Generated ${predictions.length} stock-out predictions across ${Object.keys(supplierStats).length} suppliers`);
            Object.entries(supplierStats).forEach(([supplier, stats]) => {
                console.log(`Supplier ${supplier}: ${stats.processedItems} items processed, ${stats.predictions} predictions`);
            });
            
            return { predictions, supplierStats };
        } catch (error) {
            console.error(`Error generating stock-out predictions: ${error.message}`);
            return { predictions: [], supplierStats: {} };
        }
    }

    /**
     * Save predictions to Excel file
     */
    async saveToExcel(outputFile) {
        try {
            if (this.predictions.length === 0) {
                console.warn('No predictions to save');
                return '';
            }
            
            // Create workbook
            const workbook = new ExcelJS.Workbook();
            
            // Define columns for all worksheets
            const columns = [
                { header: 'Part Number', key: 'partNumber', width: 15 },
                { header: 'Description', key: 'description', width: 40 },
                { header: 'Current Stock', key: 'currentStock', width: 15 },
                { header: 'Baseline Velocity', key: 'baselineVelocity', width: 18 },
                { header: 'Recent Velocity', key: 'recentVelocity', width: 15 },
                { header: 'Drop Percentage', key: 'dropPercentage', width: 15 },
                { header: 'Confidence', key: 'confidence', width: 12 },
                { header: 'Priority Score', key: 'priorityScore', width: 15 },
                { header: 'Suggested Qty', key: 'suggestedQty', width: 15 },
                { header: 'Unit Cost', key: 'unitCost', width: 12 },
                { header: 'Min Order Qty', key: 'minOrderQty', width: 15 },
                { header: 'Supplier', key: 'supplier', width: 12 },
                { header: 'Seasonal Factor', key: 'seasonalFactor', width: 15 },
                { header: 'Trend Factor', key: 'trendFactor', width: 15 },
                { header: 'Risk Factors', key: 'riskFactors', width: 40 }
            ];
            
            // Create main summary worksheet
            const summarySheet = workbook.addWorksheet('Summary');
            summarySheet.columns = columns;
            
            // Add all predictions to summary sheet
            this.predictions.forEach(prediction => {
                summarySheet.addRow(prediction.toDict());
            });
            
            // Format summary header row
            summarySheet.getRow(1).font = { bold: true };
            summarySheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE6E6FA' }
            };
            
            // Group predictions by supplier
            const supplierGroups = {};
            this.predictions.forEach(prediction => {
                const supplier = prediction.supplier;
                if (!supplierGroups[supplier]) {
                    supplierGroups[supplier] = [];
                }
                supplierGroups[supplier].push(prediction);
            });
            
            // Create separate worksheet for each supplier
            Object.entries(supplierGroups).forEach(([supplier, predictions]) => {
                const sheetName = `Supplier ${supplier}`;
                const supplierSheet = workbook.addWorksheet(sheetName);
                supplierSheet.columns = columns;
                
                // Add supplier-specific predictions
                predictions.forEach(prediction => {
                    supplierSheet.addRow(prediction.toDict());
                });
                
                // Format supplier header row
                supplierSheet.getRow(1).font = { bold: true };
                supplierSheet.getRow(1).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFB6C1' }
                };
                
                console.log(`Created sheet for Supplier ${supplier} with ${predictions.length} predictions`);
            });
            
            // Generate filename with timestamp
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `Stock Out Predictions -- ${timestamp}.xlsx`;
            
            // Save the workbook
            await workbook.xlsx.writeFile(filename);
            
            console.log(`Stock-out predictions saved to ${filename}`);
            console.log(`Created ${Object.keys(supplierGroups).length + 1} worksheets (1 summary + ${Object.keys(supplierGroups).length} suppliers)`);
            return filename;
        } catch (error) {
            console.error(`Error saving to Excel: ${error.message}`);
            return '';
        }
    }

    /**
     * Run the complete stock-out analysis
     */
    async runAnalysis() {
        try {
            await this.loadConfig();
            
            const inputFile = this.config.input_file;
            if (!inputFile) {
                throw new Error('No input file specified in config');
            }
            
            // Generate predictions
            const result = await this.generateStockoutPredictions(inputFile);
            this.predictions = result.predictions;
            const supplierStats = result.supplierStats;
            
            // Calculate summary statistics
            const summary = {
                totalPredictions: this.predictions.length,
                supplierCount: Object.keys(supplierStats).length,
                highConfidence: this.predictions.filter(p => p.confidence >= 70).length,
                mediumConfidence: this.predictions.filter(p => p.confidence >= 50 && p.confidence < 70).length,
                lowConfidence: this.predictions.filter(p => p.confidence >= 30 && p.confidence < 50).length,
                averageConfidence: this.predictions.length > 0 ? 
                    this.predictions.reduce((sum, p) => sum + p.confidence, 0) / this.predictions.length : 0,
                totalSuggestedValue: this.predictions.reduce((sum, p) => sum + (p.unitCost * p.suggestedQty), 0),
                supplierBreakdown: supplierStats
            };
            
            // Prepare results for JSON output
            const results = {
                success: true,
                timestamp: new Date().toISOString(),
                totalItemsAnalyzed: this.predictions.length,
                predictions: this.predictions.map(p => p.toDict()),
                summary
            };
            
            console.log(`Found ${this.predictions.length} items with potential stock-out risk`);
            return results;
        } catch (error) {
            console.error(`Error in analysis: ${error.message}`);
            const errorResult = {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
                predictions: [],
                summary: {}
            };
            return errorResult;
        }
    }
}

// Export for use in other modules
module.exports = {
    StockOutAnalyzer,
    StockOutPrediction
};

// Main execution function if run directly
async function main() {
    try {
        const analyzer = new StockOutAnalyzer();
        const results = await analyzer.runAnalysis();
        
        // Output JSON results to stdout for main.js to parse
        console.log(JSON.stringify(results, null, 2));
        
        if (results.success) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    } catch (error) {
        console.error(`Fatal error in main: ${error.message}`);
        const errorResult = {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
            predictions: [],
            summary: {}
        };
        console.log(JSON.stringify(errorResult, null, 2));
        process.exit(1);
    }
}

// Run main if this file is executed directly
if (require.main === module) {
    main();
}