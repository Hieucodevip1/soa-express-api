const fs = require('fs');
const path = require('path');

// Đường dẫn đến file CSDL riêng của Product Service (tuân theo nguyên tắc SOA)
const DB_FILE = path.join(__dirname, '../products.json');

// Helper: Đọc dữ liệu từ file products.json
const readProductsFromFile = () => {
    try {
        if (!fs.existsSync(DB_FILE)) {
            fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
            return [];
        }
        const fileData = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(fileData || '[]');
    } catch (error) {
        console.error('Lỗi khi đọc file products.json:', error.message);
        return [];
    }
};

// Helper: Ghi dữ liệu vào file products.json
const saveProductsToFile = (products) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(products, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('Lỗi khi ghi file products.json:', error.message);
        return false;
    }
};

/**
 * Controller Quản lý Sản phẩm (Product Management Controller)
 */
const productController = {
    // 1. GET /products: Lấy danh sách tất cả các sản phẩm
    getAllProducts: (req, res) => {
        try {
            const products = readProductsFromFile();
            return res.status(200).json({
                success: true,
                message: 'Lấy danh sách sản phẩm thành công',
                total: products.length,
                data: products
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy danh sách sản phẩm: ' + error.message
            });
        }
    },

    // 2. GET /products/:id: Lấy thông tin chi tiết một sản phẩm
    getProductById: (req, res) => {
        try {
            const productId = parseInt(req.params.id, 10);
            if (isNaN(productId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID sản phẩm không hợp lệ (phải là số nguyên)'
                });
            }

            const products = readProductsFromFile();
            const product = products.find(p => p.id === productId);

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy sản phẩm có ID = ${productId}`
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Lấy thông tin sản phẩm thành công',
                data: product
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy chi tiết sản phẩm: ' + error.message
            });
        }
    },

    // 3. POST /products: Thêm một sản phẩm mới
    createProduct: (req, res) => {
        try {
            const { name, description, price, quantity } = req.body;

            // Validate dữ liệu đầu vào
            if (!name || typeof name !== 'string' || name.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Tên sản phẩm (name) là bắt buộc và không được để trống'
                });
            }

            const parsedPrice = parseFloat(price);
            if (price === undefined || price === null || isNaN(parsedPrice) || parsedPrice < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Giá sản phẩm (price) là bắt buộc và phải là số không âm (>= 0)'
                });
            }

            const parsedQuantity = parseInt(quantity, 10);
            if (quantity === undefined || quantity === null || isNaN(parsedQuantity) || parsedQuantity < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Số lượng sản phẩm (quantity) là bắt buộc và phải là số nguyên không âm (>= 0)'
                });
            }

            const products = readProductsFromFile();

            // Tính ID duy nhất tự tăng
            const maxId = products.length > 0 ? Math.max(...products.map(p => p.id || 0)) : 0;
            const newId = maxId + 1;
            const currentTime = new Date().toISOString();

            const newProduct = {
                id: newId,
                name: name.trim(),
                description: description !== undefined && description !== null ? String(description).trim() : '',
                price: parseFloat(parsedPrice.toFixed(2)),
                quantity: parsedQuantity,
                created_at: currentTime,
                updated_at: currentTime
            };

            products.push(newProduct);
            const saved = saveProductsToFile(products);

            if (!saved) {
                return res.status(500).json({
                    success: false,
                    message: 'Không thể lưu dữ liệu sản phẩm vào cơ sở dữ liệu'
                });
            }

            return res.status(201).json({
                success: true,
                message: 'Thêm sản phẩm mới thành công',
                data: newProduct
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi tạo sản phẩm: ' + error.message
            });
        }
    },

    // 4. PUT /products/:id: Cập nhật thông tin sản phẩm
    updateProduct: (req, res) => {
        try {
            const productId = parseInt(req.params.id, 10);
            if (isNaN(productId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID sản phẩm không hợp lệ (phải là số nguyên)'
                });
            }

            const products = readProductsFromFile();
            const productIndex = products.findIndex(p => p.id === productId);

            if (productIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy sản phẩm có ID = ${productId} để cập nhật`
                });
            }

            const { name, description, price, quantity } = req.body;
            const existingProduct = products[productIndex];

            // Validate các trường nếu được cung cấp để cập nhật
            if (name !== undefined) {
                if (typeof name !== 'string' || name.trim() === '') {
                    return res.status(400).json({
                        success: false,
                        message: 'Tên sản phẩm không được để trống'
                    });
                }
                existingProduct.name = name.trim();
            }

            if (description !== undefined) {
                existingProduct.description = description !== null ? String(description).trim() : '';
            }

            if (price !== undefined) {
                const parsedPrice = parseFloat(price);
                if (isNaN(parsedPrice) || parsedPrice < 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Giá sản phẩm phải là số không âm (>= 0)'
                    });
                }
                existingProduct.price = parseFloat(parsedPrice.toFixed(2));
            }

            if (quantity !== undefined) {
                const parsedQuantity = parseInt(quantity, 10);
                if (isNaN(parsedQuantity) || parsedQuantity < 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Số lượng sản phẩm phải là số nguyên không âm (>= 0)'
                    });
                }
                existingProduct.quantity = parsedQuantity;
            }

            // Cập nhật timestamp lần sửa cuối
            existingProduct.updated_at = new Date().toISOString();

            products[productIndex] = existingProduct;
            const saved = saveProductsToFile(products);

            if (!saved) {
                return res.status(500).json({
                    success: false,
                    message: 'Không thể lưu thay đổi vào cơ sở dữ liệu'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Cập nhật thông tin sản phẩm thành công',
                data: existingProduct
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi cập nhật sản phẩm: ' + error.message
            });
        }
    },

    // 5. DELETE /products/:id: Xóa một sản phẩm
    deleteProduct: (req, res) => {
        try {
            const productId = parseInt(req.params.id, 10);
            if (isNaN(productId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID sản phẩm không hợp lệ (phải là số nguyên)'
                });
            }

            const products = readProductsFromFile();
            const productIndex = products.findIndex(p => p.id === productId);

            if (productIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy sản phẩm có ID = ${productId} để xóa`
                });
            }

            const deletedProduct = products.splice(productIndex, 1)[0];
            const saved = saveProductsToFile(products);

            if (!saved) {
                return res.status(500).json({
                    success: false,
                    message: 'Không thể xóa sản phẩm khỏi cơ sở dữ liệu'
                });
            }

            return res.status(200).json({
                success: true,
                message: `Xóa sản phẩm có ID = ${productId} thành công`,
                data: deletedProduct
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi xóa sản phẩm: ' + error.message
            });
        }
    }
};

module.exports = productController;
