const express = require('express');
const cors = require('cors');
require('dotenv').config();

const reportController = require('./controllers/reportController');
const { verifyAuthWithAuthService } = require('./middlewares/authMiddleware');

const app = express();
// Khởi tạo cổng mới cho Reporting Service (Ví dụ: 5003 - localhost:***3/)
const PORT = process.env.REPORT_PORT || 5003;

// Cấu hình Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint thông tin dịch vụ
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        service: 'Reporting Service (SOA - Bài thực hành 5)',
        port: PORT,
        status: 'online',
        endpoints: {
            'Summary': {
                'GET /reports/summary': 'Thống kê tổng quan: hàng tồn, hàng bán được, doanh thu, chi phí, lợi nhuận (Yêu cầu JWT Bài 2)'
            },
            'Product Reports': {
                'GET /reports/products': 'Lấy danh sách tất cả các báo cáo theo sản phẩm (Yêu cầu JWT Bài 2)',
                'GET /reports/products/:id': 'Lấy chi tiết báo cáo cho một sản phẩm (Yêu cầu JWT Bài 2)',
                'POST /reports/products': 'Tạo báo cáo sản phẩm mới dựa trên dữ liệu từ Product & Order Service (Yêu cầu JWT Bài 2)',
                'DELETE /reports/products/:id': 'Xóa báo cáo sản phẩm (Yêu cầu JWT Bài 2)'
            },
            'Order Reports': {
                'GET /reports/orders': 'Lấy danh sách tất cả các báo cáo theo đơn hàng (Yêu cầu JWT Bài 2)',
                'GET /reports/orders/:id': 'Lấy chi tiết báo cáo cho một đơn hàng (Yêu cầu JWT Bài 2)',
                'POST /reports/orders': 'Tạo báo cáo đơn hàng mới dựa trên dữ liệu từ Order Service (Yêu cầu JWT Bài 2)',
                'DELETE /reports/orders/:id': 'Xóa báo cáo đơn hàng (Yêu cầu JWT Bài 2)'
            }
        }
    });
});

// ==========================================
// 1. RESTFUL API CHO BÁO CÁO SẢN PHẨM (PRODUCT REPORTS)
// ==========================================
app.get('/reports/products', verifyAuthWithAuthService, reportController.getAllProductReports);
app.get('/reports/products/:id', verifyAuthWithAuthService, reportController.getProductReportById);
app.post('/reports/products', verifyAuthWithAuthService, reportController.createProductReport);
app.delete('/reports/products/:id', verifyAuthWithAuthService, reportController.deleteProductReport);

// ==========================================
// 2. RESTFUL API CHO BÁO CÁO ĐƠN HÀNG (ORDER REPORTS)
// ==========================================
app.get('/reports/orders', verifyAuthWithAuthService, reportController.getAllOrderReports);
app.get('/reports/orders/:id', verifyAuthWithAuthService, reportController.getOrderReportById);
app.post('/reports/orders', verifyAuthWithAuthService, reportController.createOrderReport);
app.delete('/reports/orders/:id', verifyAuthWithAuthService, reportController.deleteOrderReport);

// ==========================================
// 3. RESTFUL API CHO THỐNG KÊ TỔNG QUAN (SUMMARY)
// ==========================================
app.get('/reports/summary', verifyAuthWithAuthService, reportController.getSummaryReport);

// Xử lý 404 cho các route không tồn tại
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint không tồn tại trên Reporting Service'
    });
});

// Khởi chạy server Reporting Service
app.listen(PORT, () => {
    console.log(`Reporting Service dang chay tai http://localhost:${PORT}`);
    console.log(`Co so du lieu rieng: orders_reports.json & product_reports.json`);
    console.log(`Xac thuc qua Auth Service: ${process.env.AUTH_SERVICE_URL || 'http://localhost:5000'}`);
    console.log(`Lien ket du lieu qua Product Service (${process.env.PRODUCT_SERVICE_URL || 'http://localhost:5001'}) va Order Service (${process.env.ORDER_SERVICE_URL || 'http://localhost:5002'})`);
});
