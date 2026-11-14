const fs = require('fs');
const path = require('path');

const ORDERS_FILE = path.join(__dirname, '../orders.json');
const ORDER_ITEMS_FILE = path.join(__dirname, '../order_items.json');

// Đọc danh sách đơn hàng
const readOrders = () => {
    try {
        if (!fs.existsSync(ORDERS_FILE)) {
            fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2), 'utf-8');
            return [];
        }
        const data = fs.readFileSync(ORDERS_FILE, 'utf-8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error('Lỗi khi đọc file orders.json:', error.message);
        return [];
    }
};

// Ghi danh sách đơn hàng
const saveOrders = (orders) => {
    try {
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('Lỗi khi ghi file orders.json:', error.message);
        return false;
    }
};

// Đọc danh sách chi tiết đơn hàng
const readOrderItems = () => {
    try {
        if (!fs.existsSync(ORDER_ITEMS_FILE)) {
            fs.writeFileSync(ORDER_ITEMS_FILE, JSON.stringify([], null, 2), 'utf-8');
            return [];
        }
        const data = fs.readFileSync(ORDER_ITEMS_FILE, 'utf-8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error('Lỗi khi đọc file order_items.json:', error.message);
        return [];
    }
};

// Ghi danh sách chi tiết đơn hàng
const saveOrderItems = (orderItems) => {
    try {
        fs.writeFileSync(ORDER_ITEMS_FILE, JSON.stringify(orderItems, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('Lỗi khi ghi file order_items.json:', error.message);
        return false;
    }
};

// Tính toán lại tổng tiền (total_amount) của một đơn hàng dựa trên các mặt hàng hiện có
const recalculateOrderTotal = (orderId) => {
    const orders = readOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return null;

    const orderItems = readOrderItems();
    const items = orderItems.filter(item => item.order_id === orderId);
    const newTotal = items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);

    orders[orderIndex].total_amount = parseFloat(newTotal.toFixed(2));
    orders[orderIndex].updated_at = new Date().toISOString();
    saveOrders(orders);
    return orders[orderIndex];
};

// Gọi sang Product Service để kiểm tra thông tin và số lượng tồn kho sản phẩm (Giao tiếp liên dịch vụ SOA)
const getProductFromProductService = async (productId, authHeader) => {
    const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:5001';
    try {
        const response = await fetch(`${PRODUCT_SERVICE_URL}/products/${productId}`, {
            method: 'GET',
            headers: {
                'Authorization': authHeader
            }
        });

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `Lỗi từ Product Service (status: ${response.status})`);
        }

        const resData = await response.json();
        return resData.data;
    } catch (error) {
        console.error(`[SOA Error] Gọi Product Service thất bại với Product ID ${productId}:`, error.message);
        throw error;
    }
};

// Cập nhật số lượng tồn kho trong Product Service khi đặt hàng hoặc hủy hàng
const updateProductStock = async (productId, newQuantity, authHeader) => {
    const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:5001';
    try {
        const response = await fetch(`${PRODUCT_SERVICE_URL}/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({ quantity: newQuantity })
        });
        return response.ok;
    } catch (error) {
        console.error(`[SOA Error] Không thể cập nhật kho cho Product ID ${productId}:`, error.message);
        return false;
    }
};

module.exports = {
    readOrders,
    saveOrders,
    readOrderItems,
    saveOrderItems,
    recalculateOrderTotal,
    getProductFromProductService,
    updateProductStock
};
