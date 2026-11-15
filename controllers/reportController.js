const {
    readOrdersReports,
    saveOrdersReports,
    readProductReports,
    saveProductReports,
    getOrderFromOrderService,
    getAllOrderItemsFromOrderService,
    getProductFromProductService,
    getAllProductsFromProductService
} = require('../utils/reportDb');

const reportController = {
    // ==========================================
    // 1. BÁO CÁO THEO ĐƠN HÀNG (ORDERS REPORTS)
    // ==========================================

    // GET /reports/orders: Lấy danh sách tất cả các báo cáo theo đơn hàng
    getAllOrderReports: (req, res) => {
        try {
            const ordersReports = readOrdersReports();
            const productReports = readProductReports();

            // Gắn chi tiết báo cáo từng sản phẩm của đơn hàng nếu có
            const data = ordersReports.map(report => ({
                ...report,
                product_reports: productReports.filter(pr => pr.order_report_id === report.id)
            }));

            return res.status(200).json({
                success: true,
                message: 'Lấy danh sách báo cáo đơn hàng thành công',
                total: data.length,
                data: data
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy báo cáo đơn hàng: ' + error.message
            });
        }
    },

    // GET /reports/orders/:id: Lấy chi tiết báo cáo cho một đơn hàng
    getOrderReportById: (req, res) => {
        try {
            const reportId = parseInt(req.params.id, 10);
            if (isNaN(reportId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID báo cáo không hợp lệ'
                });
            }

            const ordersReports = readOrdersReports();
            const report = ordersReports.find(r => r.id === reportId);

            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy báo cáo đơn hàng có ID = ${reportId}`
                });
            }

            const productReports = readProductReports();
            const items = productReports.filter(pr => pr.order_report_id === report.id);

            return res.status(200).json({
                success: true,
                message: 'Lấy chi tiết báo cáo đơn hàng thành công',
                data: {
                    ...report,
                    product_reports: items
                }
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy chi tiết báo cáo đơn hàng: ' + error.message
            });
        }
    },

    // POST /reports/orders: Tạo báo cáo đơn hàng mới dựa trên dữ liệu từ Order Service
    createOrderReport: async (req, res) => {
        try {
            const { order_id, total_cost, cost_rate } = req.body;
            const parsedOrderId = parseInt(order_id, 10);

            if (isNaN(parsedOrderId)) {
                return res.status(400).json({
                    success: false,
                    message: 'order_id là bắt buộc và phải là số nguyên'
                });
            }

            const authHeader = req.headers['authorization'];

            // Gọi Order Service (Port 5002) để lấy dữ liệu thực tế của đơn hàng (SOA)
            let order;
            try {
                order = await getOrderFromOrderService(parsedOrderId, authHeader);
            } catch (svcErr) {
                return res.status(503).json({
                    success: false,
                    message: `Không thể kết nối Order Service để lấy dữ liệu đơn hàng ID ${parsedOrderId}: ${svcErr.message}`
                });
            }

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy đơn hàng ID = ${parsedOrderId} từ Order Service`
                });
            }

            const ordersReports = readOrdersReports();
            const productReports = readProductReports();

            // Tính toán doanh thu, chi phí, lợi nhuận theo nghiệp vụ
            const totalRevenue = parseFloat(Number(order.total_amount).toFixed(2));
            
            // Chi phí: nếu người dùng truyền total_cost thì dùng, nếu truyền cost_rate thì tính theo rate, mặc định 70% doanh thu
            let calculatedCost;
            if (total_cost !== undefined && !isNaN(parseFloat(total_cost))) {
                calculatedCost = parseFloat(parseFloat(total_cost).toFixed(2));
            } else if (cost_rate !== undefined && !isNaN(parseFloat(cost_rate))) {
                calculatedCost = parseFloat((totalRevenue * parseFloat(cost_rate)).toFixed(2));
            } else {
                calculatedCost = parseFloat((totalRevenue * 0.7).toFixed(2)); // Mặc định 70% giá bán là giá vốn
            }

            const totalProfit = parseFloat((totalRevenue - calculatedCost).toFixed(2));
            const nextReportId = ordersReports.length > 0 ? Math.max(...ordersReports.map(r => r.id || 0)) + 1 : 1;

            const newOrderReport = {
                id: nextReportId,
                order_id: parsedOrderId,
                total_revenue: totalRevenue,
                total_cost: calculatedCost,
                total_profit: totalProfit,
                created_at: new Date().toISOString()
            };

            ordersReports.push(newOrderReport);
            saveOrdersReports(ordersReports);

            // Tự động tạo báo cáo sản phẩm (product_reports) tương ứng cho các mặt hàng trong đơn hàng này
            const createdProductReports = [];
            if (Array.isArray(order.items) && order.items.length > 0) {
                let nextProductReportId = productReports.length > 0 ? Math.max(...productReports.map(p => p.id || 0)) + 1 : 1;
                const costRatio = totalRevenue > 0 ? (calculatedCost / totalRevenue) : 0.7;

                for (const item of order.items) {
                    const itemRevenue = parseFloat(Number(item.total_price).toFixed(2));
                    const itemCost = parseFloat((itemRevenue * costRatio).toFixed(2));
                    const itemProfit = parseFloat((itemRevenue - itemCost).toFixed(2));

                    const pr = {
                        id: nextProductReportId++,
                        order_report_id: newOrderReport.id,
                        product_id: item.product_id,
                        total_sold: item.quantity,
                        revenue: itemRevenue,
                        cost: itemCost,
                        profit: itemProfit,
                        created_at: new Date().toISOString()
                    };

                    createdProductReports.push(pr);
                    productReports.push(pr);
                }

                saveProductReports(productReports);
            }

            return res.status(201).json({
                success: true,
                message: 'Tạo báo cáo đơn hàng thành công',
                data: {
                    ...newOrderReport,
                    product_reports: createdProductReports
                }
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi tạo báo cáo đơn hàng: ' + error.message
            });
        }
    },

    // DELETE /reports/orders/:id: Xóa báo cáo đơn hàng
    deleteOrderReport: (req, res) => {
        try {
            const reportId = parseInt(req.params.id, 10);
            if (isNaN(reportId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID báo cáo không hợp lệ'
                });
            }

            const ordersReports = readOrdersReports();
            const reportIndex = ordersReports.findIndex(r => r.id === reportId);

            if (reportIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy báo cáo đơn hàng có ID = ${reportId} để xóa`
                });
            }

            const deletedReport = ordersReports.splice(reportIndex, 1)[0];
            saveOrdersReports(ordersReports);

            // Xóa các báo cáo chi tiết sản phẩm liên quan trong product_reports
            const productReports = readProductReports();
            const remainingProductReports = productReports.filter(pr => pr.order_report_id !== reportId);
            saveProductReports(remainingProductReports);

            return res.status(200).json({
                success: true,
                message: `Xóa báo cáo đơn hàng ID = ${reportId} thành công`,
                data: deletedReport
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi xóa báo cáo đơn hàng: ' + error.message
            });
        }
    },

    // ==========================================
    // 2. BÁO CÁO THEO SẢN PHẨM (PRODUCT REPORTS)
    // ==========================================

    // GET /reports/products: Lấy danh sách tất cả các báo cáo theo sản phẩm
    getAllProductReports: (req, res) => {
        try {
            const productReports = readProductReports();

            return res.status(200).json({
                success: true,
                message: 'Lấy danh sách báo cáo sản phẩm thành công',
                total: productReports.length,
                data: productReports
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy báo cáo sản phẩm: ' + error.message
            });
        }
    },

    // GET /reports/products/:id: Lấy chi tiết báo cáo cho một sản phẩm
    getProductReportById: (req, res) => {
        try {
            const reportId = parseInt(req.params.id, 10);
            if (isNaN(reportId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID báo cáo không hợp lệ'
                });
            }

            const productReports = readProductReports();
            const report = productReports.find(pr => pr.id === reportId);

            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy báo cáo sản phẩm có ID = ${reportId}`
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Lấy chi tiết báo cáo sản phẩm thành công',
                data: report
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy chi tiết báo cáo sản phẩm: ' + error.message
            });
        }
    },

    // POST /reports/products: Tạo báo cáo sản phẩm mới dựa trên dữ liệu từ Product Service và Order Service
    createProductReport: async (req, res) => {
        try {
            const { product_id, order_report_id, cost, cost_rate } = req.body;
            const parsedProductId = parseInt(product_id, 10);

            if (isNaN(parsedProductId)) {
                return res.status(400).json({
                    success: false,
                    message: 'product_id là bắt buộc và phải là số nguyên'
                });
            }

            const authHeader = req.headers['authorization'];

            // 1. Gọi Product Service (Port 5001) để kiểm tra sản phẩm
            let product;
            try {
                product = await getProductFromProductService(parsedProductId, authHeader);
            } catch (svcErr) {
                return res.status(503).json({
                    success: false,
                    message: `Không thể kết nối Product Service để lấy thông tin sản phẩm ID ${parsedProductId}: ${svcErr.message}`
                });
            }

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: `Sản phẩm có ID = ${parsedProductId} không tồn tại trong hệ thống`
                });
            }

            // 2. Gọi Order Service (Port 5002) để tổng hợp số lượng đã bán từ tất cả order_items
            let orderItems = [];
            try {
                orderItems = await getAllOrderItemsFromOrderService(authHeader);
            } catch (svcErr) {
                console.warn('[SOA Warning] Không lấy được order_items, mặc định tính toán trên dữ liệu hiện có:', svcErr.message);
            }

            const matchingItems = orderItems.filter(item => item.product_id === parsedProductId);
            const totalSold = matchingItems.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0);
            const revenue = matchingItems.reduce((sum, item) => sum + (parseFloat(item.total_price) || 0), 0);

            // Tính chi phí và lợi nhuận
            let calculatedCost;
            if (cost !== undefined && !isNaN(parseFloat(cost))) {
                calculatedCost = parseFloat(parseFloat(cost).toFixed(2));
            } else if (cost_rate !== undefined && !isNaN(parseFloat(cost_rate))) {
                calculatedCost = parseFloat((revenue * parseFloat(cost_rate)).toFixed(2));
            } else {
                calculatedCost = parseFloat((revenue * 0.7).toFixed(2)); // Mặc định 70% giá vốn
            }

            const profit = parseFloat((revenue - calculatedCost).toFixed(2));

            const productReports = readProductReports();
            const nextId = productReports.length > 0 ? Math.max(...productReports.map(pr => pr.id || 0)) + 1 : 1;

            const newProductReport = {
                id: nextId,
                order_report_id: order_report_id ? parseInt(order_report_id, 10) : null,
                product_id: parsedProductId,
                product_name: product.name, // Lưu tên sản phẩm để báo cáo trực quan
                stock_quantity: product.quantity, // Số lượng tồn kho hiện tại
                total_sold: totalSold,
                revenue: parseFloat(revenue.toFixed(2)),
                cost: calculatedCost,
                profit: profit,
                created_at: new Date().toISOString()
            };

            productReports.push(newProductReport);
            saveProductReports(productReports);

            return res.status(201).json({
                success: true,
                message: 'Tạo báo cáo sản phẩm thành công',
                data: newProductReport
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi tạo báo cáo sản phẩm: ' + error.message
            });
        }
    },

    // DELETE /reports/products/:id: Xóa báo cáo sản phẩm
    deleteProductReport: (req, res) => {
        try {
            const reportId = parseInt(req.params.id, 10);
            if (isNaN(reportId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID báo cáo không hợp lệ'
                });
            }

            const productReports = readProductReports();
            const reportIndex = productReports.findIndex(pr => pr.id === reportId);

            if (reportIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy báo cáo sản phẩm có ID = ${reportId} để xóa`
                });
            }

            const deletedReport = productReports.splice(reportIndex, 1)[0];
            saveProductReports(productReports);

            return res.status(200).json({
                success: true,
                message: `Xóa báo cáo sản phẩm ID = ${reportId} thành công`,
                data: deletedReport
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi xóa báo cáo sản phẩm: ' + error.message
            });
        }
    },

    // ==========================================
    // 3. BÁO CÁO TỔNG QUAN HỆ THỐNG (SUMMARY)
    // ==========================================
    getSummaryReport: async (req, res) => {
        try {
            const authHeader = req.headers['authorization'];
            const ordersReports = readOrdersReports();
            const productReports = readProductReports();

            // Tổng hợp từ orders_reports
            const totalRevenue = ordersReports.reduce((sum, r) => sum + (parseFloat(r.total_revenue) || 0), 0);
            const totalCost = ordersReports.reduce((sum, r) => sum + (parseFloat(r.total_cost) || 0), 0);
            const totalProfit = ordersReports.reduce((sum, r) => sum + (parseFloat(r.total_profit) || 0), 0);

            // Tổng hợp số lượng hàng đã bán
            const totalSold = productReports.reduce((sum, pr) => sum + (parseInt(pr.total_sold, 10) || 0), 0);

            // Gọi Product Service để lấy tổng số lượng hàng tồn kho
            let totalStock = 0;
            try {
                const products = await getAllProductsFromProductService(authHeader);
                totalStock = products.reduce((sum, p) => sum + (parseInt(p.quantity, 10) || 0), 0);
            } catch (err) {
                console.warn('[SOA Warning] Không lấy được thông tin tồn kho:', err.message);
            }

            return res.status(200).json({
                success: true,
                message: 'Báo cáo thống kê tổng quan hệ thống',
                data: {
                    total_stock: totalStock, // Số lượng hàng tồn
                    total_sold: totalSold,   // Số lượng hàng bán được
                    total_revenue: parseFloat(totalRevenue.toFixed(2)), // Doanh thu
                    total_cost: parseFloat(totalCost.toFixed(2)),       // Chi phí
                    total_profit: parseFloat(totalProfit.toFixed(2)),   // Lợi nhuận
                    orders_count: ordersReports.length,
                    product_reports_count: productReports.length
                }
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi tạo báo cáo tổng quan: ' + error.message
            });
        }
    }
};

module.exports = reportController;
