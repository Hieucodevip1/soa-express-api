const express = require('express');
const cors = require('cors');
require('dotenv').config();

const orderController = require('./controllers/orderController');
const orderItemController = require('./controllers/orderItemController');
const { verifyAuthWithAuthService } = require('./middlewares/authMiddleware');

const app = express();
// Khởi tạo cổng mới cho Order Service (Ví dụ: 5002), hoạt động độc lập theo kiến trúc SOA
const PORT = process.env.ORDER_PORT || 5002;

// Cấu hình Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint thông tin dịch vụ
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        service: 'Order Management Service (SOA - Bài thực hành 4)',
        port: PORT,
        status: 'online',
        endpoints: {
            'Orders': {
                'GET /orders': 'Lấy danh sách tất cả các đơn hàng (Yêu cầu xác thực JWT Bài 2)',
                'GET /orders/:id': 'Lấy thông tin chi tiết một đơn hàng kèm mặt hàng (Yêu cầu xác thực JWT Bài 2)',
                'POST /orders': 'Tạo đơn hàng mới - Kiểm tra tồn kho từ Product Service (Yêu cầu xác thực JWT Bài 2)',
                'PUT /orders/:id': 'Cập nhật trạng thái đơn hàng (pending, completed, cancelled) (Yêu cầu xác thực JWT Bài 2)',
                'DELETE /orders/:id': 'Xóa một đơn hàng (Yêu cầu xác thực JWT Bài 2)'
            },
            'Order Items': {
                'GET /order_items': 'Lấy danh sách tất cả mặt hàng trong đơn hàng (Yêu cầu xác thực JWT Bài 2)',
                'GET /order_items/:id': 'Lấy thông tin chi tiết một mặt hàng (Yêu cầu xác thực JWT Bài 2)',
                'POST /order_items': 'Tạo mặt hàng mới - Kiểm tra tồn kho từ Product Service (Yêu cầu xác thực JWT Bài 2)',
                'PUT /order_items/:id': 'Cập nhật mặt hàng (số lượng) (Yêu cầu xác thực JWT Bài 2)',
                'DELETE /order_items/:id': 'Xóa một mặt hàng trong đơn hàng (Yêu cầu xác thực JWT Bài 2)'
            }
        }
    });
});

// ==========================================
// 1. RESTFUL API CHO ĐƠN HÀNG (ORDERS)
// ==========================================
app.get('/orders', verifyAuthWithAuthService, orderController.getAllOrders);
app.get('/orders/:id', verifyAuthWithAuthService, orderController.getOrderById);
app.post('/orders', verifyAuthWithAuthService, orderController.createOrder);
app.put('/orders/:id', verifyAuthWithAuthService, orderController.updateOrderStatus);
app.delete('/orders/:id', verifyAuthWithAuthService, orderController.deleteOrder);

// ==========================================
// 2. RESTFUL API CHO CHI TIẾT ĐƠN HÀNG (ORDER ITEMS)
// ==========================================
app.get('/order_items', verifyAuthWithAuthService, orderItemController.getAllOrderItems);
app.get('/order_items/:id', verifyAuthWithAuthService, orderItemController.getOrderItemById);
app.post('/order_items', verifyAuthWithAuthService, orderItemController.createOrderItem);
app.put('/order_items/:id', verifyAuthWithAuthService, orderItemController.updateOrderItem);
app.delete('/order_items/:id', verifyAuthWithAuthService, orderItemController.deleteOrderItem);

// Xử lý 404 cho các route không tồn tại
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint không tồn tại trên Order Service'
    });
});

// Khởi chạy server Order Service
app.listen(PORT, () => {
    console.log(`Order Service dang chay tai http://localhost:${PORT}`);
    console.log(`Co so du lieu rieng: orders.json & order_items.json`);
    console.log(`Xac thuc qua Auth Service: ${process.env.AUTH_SERVICE_URL || 'http://localhost:5000'}`);
    console.log(`Kiem tra ton kho qua Product Service: ${process.env.PRODUCT_SERVICE_URL || 'http://localhost:5001'}`);
});
