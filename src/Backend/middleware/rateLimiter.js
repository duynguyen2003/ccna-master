const rateLimit = require('express-rate-limit');

/**
 * Limiter cho các route Đăng nhập và Đăng ký
 * Ngăn chặn brute-force và tạo tài khoản hàng loạt
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // Tối đa 10 yêu cầu mỗi IP
  message: {
    message: 'Quá nhiều lần thử. Vui lòng thử lại sau 15 phút.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limiter cho tính năng Quên mật khẩu
 * Ngăn chặn spam email
 */
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 3, // Tối đa 3 yêu cầu mỗi IP
  message: {
    message: 'Bạn đã yêu cầu đặt lại mật khẩu quá nhiều lần. Vui lòng thử lại sau 1 giờ.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limiter cho việc nộp bài thi
 * Ngăn chặn gửi dữ liệu rác liên tục
 */
const examSubmitLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 phút
  max: 5, // Tối đa 5 lần nộp mỗi IP (đề phòng lỗi mạng nộp lại)
  message: {
    message: 'Thao tác quá nhanh. Vui lòng đợi một lát trước khi nộp bài tiếp theo.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  forgotPasswordLimiter,
  examSubmitLimiter
};
