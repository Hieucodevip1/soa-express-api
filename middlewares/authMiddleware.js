const jwt = require('jsonwebtoken');
require('dotenv').config();

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5000';
const SECRET_KEY = process.env.JWT_SECRET || 'mat_khau_du_phong';

/**
 * Middleware xác thực thông qua Auth Service đã xây dựng ở Bài thực hành số 2 (Kiến trúc SOA)
 */
const verifyAuthWithAuthService = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Truy cập bị từ chối: Không tìm thấy token xác thực trong header Authorization (Bearer <token>)'
        });
    }

    try {
        // Giao tiếp liên dịch vụ (Service-to-Service): Gọi sang Auth Service (Bài 2) tại /auth để kiểm tra token
        const authResponse = await fetch(`${AUTH_SERVICE_URL}/auth`, {
            method: 'GET',
            headers: {
                'Authorization': authHeader
            }
        });

        const authData = await authResponse.json().catch(() => null);

        if (authResponse.ok && authData && authData.success) {
            // Xác thực thành công từ Auth Service (Bài 2)
            req.user = authData.user;
            return next();
        } else {
            // Token không hợp lệ hoặc hết hạn do Auth Service báo lại
            return res.status(authResponse.status || 401).json({
                success: false,
                message: (authData && authData.message) || 'Token không hợp lệ hoặc đã hết hạn từ Auth Service'
            });
        }
    } catch (networkError) {
        console.warn(`[SOA Warning] Không kết nối được tới Auth Service (${AUTH_SERVICE_URL}): ${networkError.message}`);
        
        // Cơ chế dự phòng (Fallback): Xác thực token với shared SECRET_KEY nếu Auth Service tạm thời chưa bật
        try {
            const decoded = jwt.verify(token, SECRET_KEY);
            req.user = decoded;
            console.log('[SOA Info] Xác thực thành công qua khóa bí mật dự phòng (Fallback mode)');
            return next();
        } catch (jwtErr) {
            return res.status(401).json({
                success: false,
                message: 'Token không hợp lệ hoặc đã hết hạn (Fallback verify thất bại)'
            });
        }
    }
};

module.exports = {
    verifyAuthWithAuthService
};
