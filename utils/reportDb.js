const fs = require('fs');
const path = require('path');

const ORDERS_REPORTS_FILE = path.join(__dirname, '../orders_reports.json');
const PRODUCT_REPORTS_FILE = path.join(__dirname, '../product_reports.json');

// Đọc danh sách báo cáo đơn hàng
const readOrdersReports = () => {
    try {
        if (!fs.existsSync(ORDERS_REPORTS_FILE)) {
            fs.writeFileSync(ORDERS_REPORTS_FILE, JSON.stringify([], null, 2), 'utf-8');
            return [];
        }
        const data = fs.readFileSync(ORDERS_REPORTS_FILE, 'utf-8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error('Lỗi khi đọc file orders_reports.json:', error.message);
        return [];
    }
};

// Ghi danh sách báo cáo đơn hàng
const saveOrdersReports = (reports) => {
    try {
        fs.writeFileSync(ORDERS_REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('Lỗi khi ghi file orders_reports.json:', error.message);
        return false;
    }
};

// Đọc danh sách báo cáo sản phẩm
const readProductReports = () => {
    try {
        if (!fs.existsSync(PRODUCT_REPORTS_FILE)) {
            fs.writeFileSync(PRODUCT_REPORTS_FILE, JSON.stringify([], null, 2), 'utf-8');
            return [];
        }
        const data = fs.readFileSync(PRODUCT_REPORTS_FILE, 'utf-8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error('Lỗi khi đọc file product_reports.json:', error.message);
        return [];
    }
};

// Ghi danh sách báo cáo sản phẩm
const saveProductReports = (reports) => {
    try {
        fs.writeFileSync(PRODUCT_REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('Lỗi khi ghi file product_reports.json:', error.message);
        return false;
    }
};

// ==========================================
// GIAO TIẾP LIÊN DỊCH VỤ (INTER-SERVICE COMMUNICATION)
// ==========================================

// 1. Gọi sang Order Service để lấy chi tiết một đơn hàng
const getOrderFromOrderService = async (orderId, authHeader) => {
    const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:5002';
    try {
        const response = await fetch(`${ORDER_SERVICE_URL}/orders/${orderId}`, {
            method: 'GET',
            headers: {
                'Authorization': authHeader
            }
        });
        if (response.status === 404) return null;
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || `Lỗi từ Order Service (Status: ${response.status})`);
        }
        const resData = await response.json();
        return resData.data;
    } catch (error) {
        console.error(`[SOA Error] Gọi Order Service thất bại với Order ID ${orderId}:`, error.message);
        throw error;
    }
};

// 2. Gọi sang Order Service để lấy tất cả mặt hàng trong đơn hàng (order_items)
const getAllOrderItemsFromOrderService = async (authHeader) => {
    const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:5002';
    try {
        const response = await fetch(`${ORDER_SERVICE_URL}/order_items`, {
            method: 'GET',
            headers: {
                'Authorization': authHeader
            }
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || `Lỗi từ Order Service (Status: ${response.status})`);
        }
        const resData = await response.json();
        return resData.data || [];
    } catch (error) {
        console.error('[SOA Error] Lấy danh sách order_items từ Order Service thất bại:', error.message);
        throw error;
    }
};

// 3. Gọi sang Product Service để lấy thông tin chi tiết một sản phẩm
const getProductFromProductService = async (productId, authHeader) => {
    const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:5001';
    try {
        const response = await fetch(`${PRODUCT_SERVICE_URL}/products/${productId}`, {
            method: 'GET',
            headers: {
                'Authorization': authHeader
            }
        });
        if (response.status === 404) return null;
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || `Lỗi từ Product Service (Status: ${response.status})`);
        }
        const resData = await response.json();
        return resData.data;
    } catch (error) {
        console.error(`[SOA Error] Gọi Product Service thất bại với Product ID ${productId}:`, error.message);
        throw error;
    }
};

// 4. Gọi sang Product Service để lấy tất cả sản phẩm (phục vụ thống kê tồn kho)
const getAllProductsFromProductService = async (authHeader) => {
    const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:5001';
    try {
        const response = await fetch(`${PRODUCT_SERVICE_URL}/products`, {
            method: 'GET',
            headers: {
                'Authorization': authHeader
            }
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || `Lỗi từ Product Service (Status: ${response.status})`);
        }
        const resData = await response.json();
        return resData.data || [];
    } catch (error) {
        console.error('[SOA Error] Lấy danh sách products từ Product Service thất bại:', error.message);
        throw error;
    }
};

module.exports = {
    readOrdersReports,
    saveOrdersReports,
    readProductReports,
    saveProductReports,
    getOrderFromOrderService,
    getAllOrderItemsFromOrderService,
    getProductFromProductService,
    getAllProductsFromProductService
};
