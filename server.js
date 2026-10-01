const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || 'mat_khau_du_phong';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Giả lập cơ sở dữ liệu bảng User theo Phụ lục
const users = [
    { IdUser: 1, UserName: 'admin', Password: '123', Token: '' }
];

// API Bài 1: Hello World không bảo mật[cite: 2]
app.get('/', (req, res) => {
    res.status(200).json({ success: true, message: 'Hello World' });
});

// 1. Dịch vụ đăng nhập: Kiểm tra tài khoản và sinh JWT[cite: 1]
app.post('/login', (req, res) => {
    const { userName, password } = req.body;
    
    const user = users.find(u => u.UserName === userName && u.Password === password);
    
    if (user) {
        const token = jwt.sign(
            { id: user.IdUser, userName: user.UserName }, 
            SECRET_KEY, 
            { expiresIn: '1h' }
        );
        res.json({ success: true, message: 'Đăng nhập thành công', token: token });
    } else {
        res.status(401).json({ success: false, message: 'Sai tài khoản hoặc mật khẩu' });
    }
});

// 2. Tạo Middleware xác thực token[cite: 1]
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 
    
    if (!token) return res.status(403).json({ success: false, message: 'Không tìm thấy token' });
    
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
        req.user = decoded;
        next(); 
    });
};

// 3. Xây dựng API xác thực token in dòng "Hello World"[cite: 1]
app.get('/auth', verifyToken, (req, res) => {
    res.status(200).json({ 
        success: true, 
        message: 'Hello World (Đã xác thực JWT)',
        user: req.user
    });
});

// ĐÂY LÀ ĐOẠN QUAN TRỌNG ĐỂ GIỮ SERVER CHẠY LIÊN TỤC
app.listen(PORT, () => {
    console.log(`Server dang chay tai http://localhost:${PORT}`);
});