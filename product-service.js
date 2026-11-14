const express = require('express');
const cors = require('cors');
require('dotenv').config();

const productController = require('./controllers/productController');
const { verifyAuthWithAuthService } = require('./middlewares/authMiddleware');

const app = express();
// Khởi tạo một cổng mới cho service (Ví dụ: 5001), độc lập với Auth Service (5000)
const PORT = process.env.PRODUCT_PORT || 5001;

// Cấu hình middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trang thông tin dịch vụ
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        service: 'Product Management Service (SOA - Bài thực hành 3)',
        port: PORT,
        status: 'online',
        endpoints: {
            'GET /products': 'Lấy danh sách tất cả sản phẩm (Yêu cầu xác thực JWT qua Bài 2)',
            'GET /products/:id': 'Lấy thông tin chi tiết một sản phẩm (Yêu cầu xác thực JWT qua Bài 2)',
            'POST /products': 'Thêm một sản phẩm mới (Yêu cầu xác thực JWT qua Bài 2)',
            'PUT /products/:id': 'Cập nhật thông tin sản phẩm (Yêu cầu xác thực JWT qua Bài 2)',
            'DELETE /products/:id': 'Xóa một sản phẩm (Yêu cầu xác thực JWT qua Bài 2)'
        }
    });
});

// ==========================================
// THIẾT KẾ RESTFUL API CHO DỊCH VỤ SẢN PHẨM
// Tất cả các endpoint đều được bảo vệ bởi middleware xác thực qua Auth Service (Bài 2)
// ==========================================

// 1. GET /products: Lấy danh sách tất cả các sản phẩm
app.get('/products', verifyAuthWithAuthService, productController.getAllProducts);

// 2. GET /products/:id: Lấy thông tin chi tiết một sản phẩm
app.get('/products/:id', verifyAuthWithAuthService, productController.getProductById);

// 3. POST /products: Thêm một sản phẩm mới
app.post('/products', verifyAuthWithAuthService, productController.createProduct);

// 4. PUT /products/:id: Cập nhật thông tin sản phẩm
app.put('/products/:id', verifyAuthWithAuthService, productController.updateProduct);

// 5. DELETE /products/:id: Xóa một sản phẩm
app.delete('/products/:id', verifyAuthWithAuthService, productController.deleteProduct);

// Xử lý route không tồn tại (404)
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint không tồn tại trên Product Service'
    });
});

// Khởi chạy Product Service
app.listen(PORT, () => {
    console.log(`Product Service dang chay tai http://localhost:${PORT}`);
    console.log(`Co so du lieu rieng: products.json`);
    console.log(`Xac thuc qua Auth Service: ${process.env.AUTH_SERVICE_URL || 'http://localhost:5000'}`);
});
