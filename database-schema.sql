-- ============================================================================
-- Tink Multi-Store Intelligent Feedback Learning Database Schema
-- ============================================================================

-- Stores table - basic store information
CREATE TABLE stores (
    store_id VARCHAR(10) PRIMARY KEY,
    store_name VARCHAR(100) NOT NULL,
    location VARCHAR(100),
    region VARCHAR(50),
    manager_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- SKU master data - product information
CREATE TABLE skus (
    sku VARCHAR(50) PRIMARY KEY,
    description TEXT,
    category VARCHAR(100),
    supplier VARCHAR(100),
    unit_cost DECIMAL(10,2),
    min_order_qty INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Manager feedback/overrides - core learning data
CREATE TABLE manager_overrides (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    store_id VARCHAR(10) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    original_tink_recommendation INTEGER NOT NULL,
    manager_preference INTEGER NOT NULL,
    feedback_type ENUM('not-needed', 'too-much', 'not-enough') NOT NULL,
    current_multiplier DECIMAL(5,3) NOT NULL,
    confidence DECIMAL(3,2) DEFAULT 1.00,
    comments TEXT,
    manager_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (store_id) REFERENCES stores(store_id),
    FOREIGN KEY (sku) REFERENCES skus(sku),
    UNIQUE KEY unique_store_sku (store_id, sku),
    INDEX idx_store_sku (store_id, sku),
    INDEX idx_feedback_type (feedback_type),
    INDEX idx_created_at (created_at)
);

-- Feedback history - track all feedback submissions
CREATE TABLE feedback_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    store_id VARCHAR(10) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    tink_recommendation INTEGER NOT NULL,
    manager_recommendation INTEGER,
    feedback_type ENUM('not-needed', 'too-much', 'not-enough') NOT NULL,
    comments TEXT,
    manager_name VARCHAR(100),
    order_context JSON, -- Store additional context about the order
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (store_id) REFERENCES stores(store_id),
    FOREIGN KEY (sku) REFERENCES skus(sku),
    INDEX idx_store_sku_date (store_id, sku, submitted_at),
    INDEX idx_feedback_type (feedback_type),
    INDEX idx_submitted_at (submitted_at)
);

-- Sales trend data - track sales for growth analysis
CREATE TABLE sales_trends (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    store_id VARCHAR(10) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    week_ending_date DATE NOT NULL,
    units_sold INTEGER DEFAULT 0,
    avg_weekly_sales DECIMAL(8,2) DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0,
    stock_on_hand INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (store_id) REFERENCES stores(store_id),
    FOREIGN KEY (sku) REFERENCES skus(sku),
    UNIQUE KEY unique_store_sku_week (store_id, sku, week_ending_date),
    INDEX idx_store_sku_date (store_id, sku, week_ending_date),
    INDEX idx_week_ending (week_ending_date)
);

-- Override adjustments - track when overrides are modified
CREATE TABLE override_adjustments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    store_id VARCHAR(10) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    adjustment_reason TEXT NOT NULL,
    growth_rate DECIMAL(5,2),
    confidence DECIMAL(3,2),
    accepted_by ENUM('manager', 'system-suggestion', 'auto-adjustment') NOT NULL,
    manager_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (store_id) REFERENCES stores(store_id),
    FOREIGN KEY (sku) REFERENCES skus(sku),
    INDEX idx_store_sku (store_id, sku),
    INDEX idx_accepted_by (accepted_by),
    INDEX idx_created_at (created_at)
);

-- Learning metrics - track system performance
CREATE TABLE learning_metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    store_id VARCHAR(10) NOT NULL,
    metric_date DATE NOT NULL,
    total_overrides INTEGER DEFAULT 0,
    successful_adjustments INTEGER DEFAULT 0,
    override_accuracy DECIMAL(5,2) DEFAULT 0,
    avg_sales_growth_detected DECIMAL(5,2) DEFAULT 0,
    total_suggestions_made INTEGER DEFAULT 0,
    suggestions_accepted INTEGER DEFAULT 0,
    suggestions_rejected INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (store_id) REFERENCES stores(store_id),
    UNIQUE KEY unique_store_date (store_id, metric_date),
    INDEX idx_metric_date (metric_date)
);

-- Cross-store learning insights - identify patterns across stores
CREATE TABLE cross_store_insights (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) NOT NULL,
    insight_type ENUM('consistent-override', 'regional-pattern', 'seasonal-trend', 'growth-opportunity') NOT NULL,
    insight_data JSON NOT NULL, -- Store flexible insight details
    confidence DECIMAL(3,2) NOT NULL,
    stores_involved TEXT NOT NULL, -- Comma-separated store IDs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (sku) REFERENCES skus(sku),
    INDEX idx_sku_type (sku, insight_type),
    INDEX idx_confidence (confidence),
    INDEX idx_created_at (created_at)
);

-- ============================================================================
-- Sample Data Inserts
-- ============================================================================

-- Insert sample stores
INSERT INTO stores (store_id, store_name, location, region, manager_name) VALUES
('16719', 'Fairview Hardware', 'Fairview, CO', 'Mountain West', 'John Smith'),
('17521', 'Eagle Hardware', 'Eagle, CO', 'Mountain West', 'Sarah Johnson'),
('18179', 'Broadway Hardware', 'Denver, CO', 'Mountain West', 'Mike Wilson'),
('18181', 'State Street Hardware', 'Denver, CO', 'Mountain West', 'Lisa Brown');

-- Insert sample SKUs
INSERT INTO skus (sku, description, category, supplier, unit_cost, min_order_qty) VALUES
('8207433', 'HICKORY BBQ PELLETS 20LB', 'seasonal', 'ACE', 12.50, 6),
('10009', 'REMOVER RUST EXTEND 8 OZ', 'maintenance', 'ACE', 4.25, 1),
('1015610', 'MOUNTING PUTTY HS 2OZ', 'hardware', 'ACE', 2.15, 1);

-- ============================================================================
-- Useful Views for Analytics
-- ============================================================================

-- View: Override effectiveness by store
CREATE VIEW override_effectiveness AS
SELECT 
    s.store_id,
    s.store_name,
    COUNT(mo.id) as total_overrides,
    AVG(mo.confidence) as avg_confidence,
    COUNT(oa.id) as total_adjustments,
    AVG(oa.growth_rate) as avg_growth_rate
FROM stores s
LEFT JOIN manager_overrides mo ON s.store_id = mo.store_id AND mo.is_active = TRUE
LEFT JOIN override_adjustments oa ON s.store_id = oa.store_id
GROUP BY s.store_id, s.store_name;

-- View: SKU override patterns across stores
CREATE VIEW sku_override_patterns AS
SELECT 
    sk.sku,
    sk.description,
    sk.category,
    COUNT(DISTINCT mo.store_id) as stores_with_overrides,
    AVG(mo.current_multiplier) as avg_multiplier,
    COUNT(mo.id) as total_overrides,
    GROUP_CONCAT(DISTINCT mo.feedback_type) as feedback_types
FROM skus sk
LEFT JOIN manager_overrides mo ON sk.sku = mo.sku AND mo.is_active = TRUE
GROUP BY sk.sku, sk.description, sk.category
HAVING stores_with_overrides > 0
ORDER BY stores_with_overrides DESC, total_overrides DESC;

-- View: Recent sales trends with growth rates
CREATE VIEW recent_sales_trends AS
SELECT 
    st.store_id,
    st.sku,
    sk.description,
    COUNT(*) as weeks_of_data,
    AVG(st.units_sold) as avg_weekly_sales,
    SUM(st.units_sold) as total_sales,
    (
        SELECT AVG(units_sold) 
        FROM sales_trends st2 
        WHERE st2.store_id = st.store_id 
        AND st2.sku = st.sku 
        AND st2.week_ending_date >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK)
    ) as recent_4week_avg,
    (
        SELECT AVG(units_sold) 
        FROM sales_trends st3 
        WHERE st3.store_id = st.store_id 
        AND st3.sku = st.sku 
        AND st3.week_ending_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 8 WEEK) AND DATE_SUB(CURDATE(), INTERVAL 4 WEEK)
    ) as previous_4week_avg
FROM sales_trends st
JOIN skus sk ON st.sku = sk.sku
WHERE st.week_ending_date >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK)
GROUP BY st.store_id, st.sku, sk.description
HAVING weeks_of_data >= 4;

-- ============================================================================
-- Stored Procedures for Common Operations
-- ============================================================================

DELIMITER //

-- Procedure: Calculate growth rate for a SKU at a store
CREATE PROCEDURE CalculateGrowthRate(
    IN p_store_id VARCHAR(10),
    IN p_sku VARCHAR(50),
    OUT p_growth_rate DECIMAL(5,2)
)
BEGIN
    DECLARE recent_avg DECIMAL(8,2);
    DECLARE previous_avg DECIMAL(8,2);
    
    -- Get recent 4 weeks average
    SELECT AVG(units_sold) INTO recent_avg
    FROM sales_trends 
    WHERE store_id = p_store_id 
    AND sku = p_sku 
    AND week_ending_date >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK);
    
    -- Get previous 4 weeks average
    SELECT AVG(units_sold) INTO previous_avg
    FROM sales_trends 
    WHERE store_id = p_store_id 
    AND sku = p_sku 
    AND week_ending_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 8 WEEK) AND DATE_SUB(CURDATE(), INTERVAL 4 WEEK);
    
    -- Calculate growth rate
    IF previous_avg > 0 THEN
        SET p_growth_rate = ((recent_avg - previous_avg) / previous_avg) * 100;
    ELSE
        SET p_growth_rate = 0;
    END IF;
END //

-- Procedure: Get override adjustment suggestions for a store
CREATE PROCEDURE GetOverrideAdjustmentSuggestions(
    IN p_store_id VARCHAR(10),
    IN p_min_confidence DECIMAL(3,2) DEFAULT 0.75,
    IN p_min_growth_rate DECIMAL(5,2) DEFAULT 25.0
)
BEGIN
    SELECT 
        mo.sku,
        sk.description,
        mo.manager_preference as current_override,
        ROUND(mo.manager_preference * LEAST(1 + (rst.growth_rate / 100), 1.5)) as suggested_quantity,
        rst.growth_rate,
        mo.confidence,
        DATEDIFF(CURDATE(), mo.created_at) / 7 as override_age_weeks,
        rst.recent_4week_avg,
        rst.previous_4week_avg
    FROM manager_overrides mo
    JOIN skus sk ON mo.sku = sk.sku
    JOIN (
        SELECT 
            store_id,
            sku,
            recent_4week_avg,
            previous_4week_avg,
            CASE 
                WHEN previous_4week_avg > 0 
                THEN ((recent_4week_avg - previous_4week_avg) / previous_4week_avg) * 100
                ELSE 0 
            END as growth_rate
        FROM recent_sales_trends
    ) rst ON mo.store_id = rst.store_id AND mo.sku = rst.sku
    WHERE mo.store_id = p_store_id
    AND mo.is_active = TRUE
    AND rst.growth_rate >= p_min_growth_rate
    AND mo.confidence >= p_min_confidence
    AND DATEDIFF(CURDATE(), mo.created_at) >= 56 -- At least 8 weeks old
    ORDER BY (rst.growth_rate * mo.confidence) DESC
    LIMIT 10;
END //

DELIMITER ;

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Additional composite indexes for common queries
CREATE INDEX idx_feedback_history_store_date ON feedback_history(store_id, submitted_at);
CREATE INDEX idx_sales_trends_sku_date ON sales_trends(sku, week_ending_date);
CREATE INDEX idx_manager_overrides_active ON manager_overrides(is_active, store_id);
CREATE INDEX idx_override_adjustments_date ON override_adjustments(created_at, store_id);
