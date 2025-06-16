import pandas as pd
from datetime import datetime
import math
import logging
from sklearn.cluster import KMeans
from statsmodels.tsa.seasonal import STL
import numpy as np
from typing import List, Tuple, Optional
import warnings
warnings.filterwarnings('ignore', category=RuntimeWarning)

def setup_logging():
    """Set up logging configuration."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[logging.StreamHandler()]
    )

def feature_engineering(sales_matrix: np.ndarray) -> np.ndarray:
    """Generate features for clustering: variance, peak/mean ratio, autocorrelation, coefficient of variation, zero-sales weeks, trend slope."""
    sales_var = np.var(sales_matrix, axis=1)
    sales_mean = np.mean(sales_matrix, axis=1)
    sales_peak = np.max(sales_matrix, axis=1)
    peak_to_mean = np.divide(sales_peak, sales_mean, out=np.zeros_like(sales_peak), where=sales_mean!=0)
    def autocorr(x):
        if len(x) < 2 or np.std(x) == 0:
            return 0
        result = np.corrcoef(x[:-1], x[1:])[0,1]
        if np.isnan(result):
            return 0
        return result
    sales_autocorr = np.array([autocorr(x) for x in sales_matrix])
    # Coefficient of variation (std/mean)
    sales_std = np.std(sales_matrix, axis=1)
    coeff_var = np.divide(sales_std, sales_mean, out=np.zeros_like(sales_std), where=sales_mean!=0)
    # Number of zero-sales weeks
    zero_weeks = np.sum(sales_matrix == 0, axis=1)
    # Trend slope (using linear regression)
    def trend_slope(x):
        if len(x) < 2:
            return 0
        t = np.arange(len(x))
        A = np.vstack([t, np.ones(len(t))]).T
        m, _ = np.linalg.lstsq(A, x, rcond=None)[0]
        return m
    slopes = np.array([trend_slope(x) for x in sales_matrix])
    features = np.vstack([
        sales_var,
        peak_to_mean,
        sales_autocorr,
        coeff_var,
        zero_weeks,
        slopes
    ]).T
    return features

def cluster_skus(features: np.ndarray, n_clusters: int = 3) -> Tuple[np.ndarray, np.ndarray]:
    """Cluster SKUs and return labels and cluster centers."""
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    cluster_labels = kmeans.fit_predict(features)
    return cluster_labels, kmeans.cluster_centers_

def print_cluster_summary(cluster_centers: np.ndarray):
    """Print cluster centers and statistics for review."""
    logging.info("Cluster Centers (variance, peak/mean, autocorr):")
    for idx, center in enumerate(cluster_centers):
        logging.info(f"Cluster {idx}: Var={center[0]:.2f}, Peak/Mean={center[1]:.2f}, Autocorr={center[2]:.2f}")

def assign_cluster_labels(cluster_centers: np.ndarray) -> dict:
    """
    Assign human-readable labels to clusters based on their center statistics.
    Returns a mapping from cluster index to label ('steady', 'seasonal', 'erratic').
    """
    # Extract statistics
    variances = cluster_centers[:, 0]
    peak_means = cluster_centers[:, 1]
    autocorrs = cluster_centers[:, 2]
    # Assign labels
    steady_idx = np.argmin(variances)
    seasonal_idx = np.argmax(autocorrs)
    erratic_idx = np.argmax(peak_means)
    # Ensure unique assignment
    used = set([steady_idx, seasonal_idx, erratic_idx])
    all_idxs = set(range(len(cluster_centers)))
    # If any overlap, assign remaining label to the unused cluster
    if len(used) < 3:
        unused = list(all_idxs - used)
        # Assign 'erratic' to unused if overlap
        for idx in unused:
            if idx != steady_idx and idx != seasonal_idx:
                erratic_idx = idx
    label_map = {}
    for i in range(len(cluster_centers)):
        if i == steady_idx:
            label_map[i] = 'steady'
        elif i == seasonal_idx:
            label_map[i] = 'seasonal'
        elif i == erratic_idx:
            label_map[i] = 'erratic'
        else:
            label_map[i] = f'cluster_{i}'
    return label_map

def forecast_demand(row, week_columns, days_threshold, forecast_accuracy_log=None, data_quality_log=None):
    """Forecast demand for a single SKU based on its seasonality label, with enhanced logic and logging."""
    sales_series = row[week_columns[:104]].values.astype(float)
    label = row['seasonality_label']
    part_number = row.get('PARTNUMBER', None)
    # Data quality checks
    if data_quality_log is not None:
        if np.any(sales_series < 0):
            data_quality_log.append((part_number, 'Negative sales detected'))
        if np.max(sales_series) > 10 * np.median(sales_series[sales_series > 0]) if np.any(sales_series > 0) else False:
            data_quality_log.append((part_number, 'Outlier spike detected'))
        if np.sum(sales_series == 0) > 80:
            data_quality_log.append((part_number, 'Mostly zero sales'))
    forecast = 0
    if label == 'steady':
        avg = pd.Series(sales_series[-26:]).mean()  # last 26 weeks
        forecast = avg * (days_threshold / 7)
    elif label == 'seasonal':
        if len(np.unique(sales_series)) < 2:
            # Not enough variation for STL, fallback to same period last year
            if len(sales_series) >= 56:
                fallback_avg = pd.Series(sales_series[-56:-52]).mean()
                forecast = fallback_avg * (days_threshold / 7)
            else:
                forecast = pd.Series(sales_series[-12:]).mean() * (days_threshold / 7)
        else:
            try:
                stl = STL(sales_series, period=52, robust=True)
                res = stl.fit()
                seasonality = res.seasonal[-1]
                trend = res.trend[-1]
                forecast = (trend + seasonality) * (days_threshold / 7)
            except Exception as e:
                logging.warning(f"STL failed for SKU {row['PARTNUMBER']}: {e}")
                if len(sales_series) >= 56:
                    fallback_avg = pd.Series(sales_series[-56:-52]).mean()
                    forecast = fallback_avg * (days_threshold / 7)
                else:
                    forecast = pd.Series(sales_series[-12:]).mean() * (days_threshold / 7)
    else:  # erratic or fallback
        # Use median of last 20 weeks
        forecast = pd.Series(sales_series[-20:]).median() * (days_threshold / 7)
    # Forecast accuracy tracking (if actuals available)
    if forecast_accuracy_log is not None and 'WEEK_CURRENT' in row:
        actual = row['WEEK_CURRENT']
        forecast_accuracy_log.append((part_number, forecast, actual))
    return forecast

def get_sales_velocity(sales_series, weeks=8):
    """Calculate average sales per week over the last N weeks."""
    recent_sales = sales_series[-weeks:]
    avg_per_week = np.mean(recent_sales)
    return avg_per_week

def generate_suggested_order(
    input_file: str,
    output_file: str,
    supplier_number: int = 10,
    days_threshold: int = 14,
    current_month: Optional[int] = None,
    chunk_size: int = 10000
) -> None:
    """
    Generate a suggested order Excel file based on inventory and sales data.
    """
    if current_month is None:
        try:
            current_month = int(input("Enter the current month (1-12): "))
        except ValueError:
            logging.warning("Invalid input. Using default of May (5).")
            current_month = 5
    order_items = []
    week_columns = [f'WEEK_{i}' for i in range(104)] + ['WEEK_CURRENT']
    forecast_accuracy_log = []
    data_quality_log = []
    stock_event_log = []
    try:
        chunk_iter = pd.read_csv(input_file, sep='\t', encoding='utf-8', low_memory=False, chunksize=chunk_size)
    except FileNotFoundError:
        logging.error(f"Input file '{input_file}' not found.")
        return
    for chunk_idx, df_chunk in enumerate(chunk_iter):
        logging.info(f"Processing chunk {chunk_idx + 1}...")
        df_chunk = df_chunk.copy()
        df_chunk['PARTNUMBER'] = df_chunk['PARTNUMBER'].astype(str)
        if 'DESCRIPTION1' not in df_chunk.columns:
            logging.error(f"'DESCRIPTION1' column not found in chunk {chunk_idx + 1}. Available columns: {list(df_chunk.columns)}")
            return
        df_chunk = df_chunk[df_chunk['DELETED'] != 1]
        df_chunk = df_chunk[df_chunk['SUPPLIER_NUMBER1'] == supplier_number]
        df_chunk['MINORDERQTY'] = pd.to_numeric(df_chunk['MINORDERQTY'], errors='coerce').fillna(0)
        df_chunk = df_chunk[df_chunk['MINORDERQTY'] != 0]
        numeric_columns = ['STOCKONHAND', 'MINSTOCK', 'UNITCOST']
        for col in numeric_columns:
            df_chunk[col] = pd.to_numeric(df_chunk[col], errors='coerce').fillna(0)
        for col in week_columns:
            if col in df_chunk.columns:
                df_chunk[col] = pd.to_numeric(df_chunk[col], errors='coerce').fillna(0)
            else:
                df_chunk[col] = 0
        sales_matrix = df_chunk[week_columns[:104]].values
        features = feature_engineering(sales_matrix)
        cluster_labels, cluster_centers = cluster_skus(features, n_clusters=3)
        label_map = assign_cluster_labels(cluster_centers)
        new_cols = pd.DataFrame({
            'seasonality_cluster': cluster_labels,
            'seasonality_label': pd.Series(cluster_labels, index=df_chunk.index).map(label_map)
        }, index=df_chunk.index)
        df_chunk = pd.concat([df_chunk, new_cols], axis=1)
        print_cluster_summary(cluster_centers)
        forecasted_demand = []
        for idx, row in df_chunk.iterrows():
            forecast = forecast_demand(row, week_columns, days_threshold, forecast_accuracy_log, data_quality_log)
            forecasted_demand.append(forecast)
        total_sales_104_weeks = df_chunk[week_columns[:104]].sum(axis=1)
        def calc_required_stock(row):
            base = row['forecasted_demand']
            min_stock = row['MINSTOCK']
            min_order_qty = row['MINORDERQTY']
            if min_stock >= 2:
                return max(base, min_stock, min_order_qty)
            else:
                return max(base, min_order_qty)
        new_cols2 = pd.DataFrame({
            'forecasted_demand': forecasted_demand,
            'total_sales_104_weeks': total_sales_104_weeks
        }, index=df_chunk.index)
        df_chunk = pd.concat([df_chunk, new_cols2], axis=1)
        df_chunk['required_stock'] = df_chunk.apply(calc_required_stock, axis=1)
        # --- DYNAMIC ORDER LOGIC START ---
        Z = 1.65  # 95% service level
        lead_time_weeks = days_threshold / 7
        for idx, row in df_chunk.iterrows():
            sales_series = row[week_columns[:104]].values.astype(float)
            stock_on_hand = row['STOCKONHAND']
            min_order_qty = row['MINORDERQTY']
            velocity = get_sales_velocity(sales_series, weeks=8)
            forecasted_need = velocity * (days_threshold / 7)
            part_number = row['PARTNUMBER']
            total_sales_104_weeks = row['total_sales_104_weeks']
            # Statistical safety stock
            demand_std = np.std(sales_series[-26:])
            safety_stock = Z * demand_std * np.sqrt(lead_time_weeks)
            # Overstock prevention: do not order if >2x forecasted need on hand
            if stock_on_hand > 2 * forecasted_need:
                order_qty = 0
                stock_event_log.append((part_number, 'Overstock', stock_on_hand, forecasted_need))
            elif velocity < 0.2:
                if stock_on_hand < min_order_qty and min_order_qty > 0:
                    order_qty = min_order_qty
                    stock_event_log.append((part_number, 'Stockout risk (slow mover)', stock_on_hand, min_order_qty))
                else:
                    order_qty = 0
            else:
                shortage = forecasted_need + safety_stock - stock_on_hand
                if shortage > 0 and min_order_qty > 0:
                    order_qty = int(math.ceil(shortage / min_order_qty) * min_order_qty)
                    if stock_on_hand < safety_stock:
                        stock_event_log.append((part_number, 'Stockout risk', stock_on_hand, safety_stock))
                else:
                    order_qty = 0
            if order_qty > 0:
                order_items.append({
                    'Date': datetime.now().strftime('%d-%b-%Y %I:%M:%S %p'),
                    'Type': 'Purchase Order',
                    'Filename': f'Suggested Order -- Brandon Peterson -- {datetime.now().strftime("%d-%b-%Y %H:%M")}',
                    'Salesperson Id': '',
                    'Account number': supplier_number,
                    'Name': 'ACE',
                    'Part number': part_number,
                    'Order number': part_number,
                    'Description 1': row['DESCRIPTION1'],
                    'Quantity': order_qty,
                    'Price': row['UNITCOST'],
                    'Extension': order_qty * row['UNITCOST'],
                    'Hidden': False,
                    'total_sales_104_weeks': total_sales_104_weeks
                })
        # --- DYNAMIC ORDER LOGIC END ---
        # --- MINSTOCK POST-CHECK LOGIC START ---
        post_order_on_hand = {}
        for item in order_items:
            pn = item['Part number']
            post_order_on_hand[pn] = post_order_on_hand.get(pn, 0) + item['Quantity']
        for idx, row in df_chunk.iterrows():
            part_number = row['PARTNUMBER']
            min_stock = row['MINSTOCK']
            min_order_qty = row['MINORDERQTY']
            stock_on_hand = row['STOCKONHAND']
            if min_stock >= 2:
                ordered = post_order_on_hand.get(part_number, 0)
                post_order = stock_on_hand + ordered
                if post_order < min_stock and min_order_qty > 0:
                    needed = min_stock - post_order
                    add_qty = int(math.ceil(needed / min_order_qty) * min_order_qty)
                    if add_qty > 0:
                        found = False
                        for item in order_items:
                            if item['Part number'] == part_number:
                                item['Quantity'] += add_qty
                                item['Extension'] = item['Quantity'] * item['Price']
                                found = True
                                break
                        if not found:
                            order_items.append({
                                'Date': datetime.now().strftime('%d-%b-%Y %I:%M:%S %p'),
                                'Type': 'Purchase Order',
                                'Filename': f'Suggested Order -- Brandon Peterson -- {datetime.now().strftime("%d-%b-%Y %H:%M")}',
                                'Salesperson Id': '',
                                'Account number': supplier_number,
                                'Name': 'ACE',
                                'Part number': part_number,
                                'Order number': part_number,
                                'Description 1': row['DESCRIPTION1'],
                                'Quantity': add_qty,
                                'Price': row['UNITCOST'],
                                'Extension': add_qty * row['UNITCOST'],
                                'Hidden': False,
                                'total_sales_104_weeks': row['total_sales_104_weeks']
                            })
        # --- MINSTOCK POST-CHECK LOGIC END ---
    order_df = pd.DataFrame(order_items)
    # TODO: Add reporting/visualization and log outputs
    if not order_df.empty:
        with_sales_df = order_df[order_df['total_sales_104_weeks'] > 0].copy()
        no_sales_df = order_df[order_df['total_sales_104_weeks'] == 0].copy()
        with_sales_df = with_sales_df.drop(columns=['total_sales_104_weeks'])
        no_sales_df = no_sales_df.drop(columns=['total_sales_104_weeks'])
        # Sort by 'Part number' ascending
        with_sales_df = with_sales_df.sort_values(by='Part number', ascending=True)
        no_sales_df = no_sales_df.sort_values(by='Part number', ascending=True)
        # Limit output columns
        output_columns = ['Part number', 'Description 1', 'Quantity', 'Price', 'Extension']
        with_sales_df = with_sales_df[output_columns]
        no_sales_df = no_sales_df[output_columns]
        try:
            with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
                startrow = 0
                if not with_sales_df.empty:
                    with_sales_df.to_excel(writer, index=False, startrow=startrow)
                    startrow += len(with_sales_df) + 2
                if not no_sales_df.empty:
                    label_df = pd.DataFrame({with_sales_df.columns[0]: ['No Sales Below']})
                    label_df.to_excel(writer, index=False, header=False, startrow=startrow)
                    startrow += 1
                    no_sales_df.to_excel(writer, index=False, startrow=startrow)
                # --- Summary Sheet ---
                import matplotlib.pyplot as plt
                import io
                summary_data = {}
                # Demand pattern histogram
                fig, ax = plt.subplots()
                with_sales_df['Quantity'].hist(ax=ax, bins=20)
                ax.set_title('Order Quantity Distribution')
                ax.set_xlabel('Order Quantity')
                ax.set_ylabel('Frequency')
                imgdata = io.BytesIO()
                plt.savefig(imgdata, format='png')
                plt.close(fig)
                imgdata.seek(0)
                # Forecast accuracy metrics
                if forecast_accuracy_log:
                    fa_df = pd.DataFrame(forecast_accuracy_log, columns=['PartNumber', 'Forecast', 'Actual'])
                    fa_df['Error'] = fa_df['Forecast'] - fa_df['Actual']
                    fa_df['AbsError'] = fa_df['Error'].abs()
                    mape = (fa_df['AbsError'] / (fa_df['Actual'].replace(0, np.nan))).mean() * 100
                    rmse = np.sqrt((fa_df['Error'] ** 2).mean())
                else:
                    mape = None
                    rmse = None
                # Write summary sheet
                from openpyxl import Workbook
                from openpyxl.drawing.image import Image as XLImage
                from openpyxl.utils.dataframe import dataframe_to_rows
                wb = writer.book
                ws = wb.create_sheet('Summary')
                ws.append(['Order Recommendation Summary'])
                ws.append([])
                ws.append(['Forecast Accuracy'])
                ws.append(['MAPE (%)', mape if mape is not None else 'N/A'])
                ws.append(['RMSE', rmse if rmse is not None else 'N/A'])
                ws.append([])
                ws.append(['Data Quality Issues'])
                if data_quality_log:
                    for issue in data_quality_log:
                        ws.append([str(issue)])
                else:
                    ws.append(['None'])
                ws.append([])
                ws.append(['Stock Events'])
                if stock_event_log:
                    for event in stock_event_log:
                        ws.append([str(event)])
                else:
                    ws.append(['None'])
                # Insert demand pattern chart
                img = XLImage(imgdata)
                img.anchor = 'A20'
                ws.add_image(img)
            logging.info(f"Suggested order saved to {output_file}")
        except Exception as e:
            logging.error(f"Failed to save Excel file: {e}")
    else:
        logging.info("No items require ordering.")
    # Output logs for review
    if forecast_accuracy_log:
        logging.info(f"Forecast accuracy log (sample): {forecast_accuracy_log[:5]}")
    if data_quality_log:
        logging.info(f"Data quality issues (sample): {data_quality_log[:5]}")
    if stock_event_log:
        logging.info(f"Stock event log (sample): {stock_event_log[:5]}")
    return

def main():
    """Main entry point for the script."""
    setup_logging()
    input_file = "Inventory.txt"
    from datetime import datetime
    output_file = f"Suggested Order -- {datetime.now().strftime('%Y-%m-%d')}.xlsx"
    try:
        days_threshold = int(input("Enter the number of days to run the order for (e.g., 14): "))
    except ValueError:
        logging.warning("Invalid input. Using default of 14 days.")
        days_threshold = 14
    generate_suggested_order(
        input_file,
        output_file,
        days_threshold=days_threshold
    )

if __name__ == "__main__":
    main()