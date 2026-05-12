const { z } = require('zod');

const registerSchema = z.object({
  fullName: z.string()
    .min(2, 'Họ tên phải có ít nhất 2 ký tự')
    .max(100, 'Họ tên quá dài'),
  email: z.string()
    .email('Email không đúng định dạng')
    .toLowerCase(),
  password: z.string()
    .min(6, 'Mật khẩu phải có ít nhất 6 ký tự')
    .max(50, 'Mật khẩu quá dài')
});

const loginSchema = z.object({
  email: z.string()
    .email('Email không đúng định dạng')
    .toLowerCase(),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu')
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Email không đúng định dạng')
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token là bắt buộc'),
  password: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự')
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema
};
