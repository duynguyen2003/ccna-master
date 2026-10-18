/**
 * Middleware xác thực dữ liệu bằng Zod
 * @param {import('zod').ZodSchema} schema
 */
const validate =
  (schema, source = 'body') =>
  (req, res, next) => {
    try {
      // Xác thực req.body (hoặc req.query/req.params tùy nhu cầu)
      // Ở đây mặc định xác thực body cho các route POST/PUT
      schema.parse(req[source]);
      next();
    } catch (error) {
      const issues = error.issues || error.errors;
      const message = issues?.map((err) => err.message).join(', ') || 'Dữ liệu không hợp lệ';
      return res.status(400).json({
        message,
        errors: issues,
      });
    }
  };

module.exports = validate;
