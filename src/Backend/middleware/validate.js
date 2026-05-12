/**
 * Middleware xác thực dữ liệu bằng Zod
 * @param {import('zod').ZodSchema} schema 
 */
const validate = (schema) => (req, res, next) => {
  try {
    // Xác thực req.body (hoặc req.query/req.params tùy nhu cầu)
    // Ở đây mặc định xác thực body cho các route POST/PUT
    schema.parse(req.body);
    next();
  } catch (error) {
    const message = error.errors?.map(err => err.message).join(', ') || 'Dữ liệu không hợp lệ';
    return res.status(400).json({
      message,
      errors: error.errors
    });
  }
};

module.exports = validate;
