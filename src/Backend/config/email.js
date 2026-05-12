const nodemailer = require('nodemailer');

// Configure transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send Reset Password Email
 * @param {string} toEmail 
 * @param {string} userName 
 * @param {string} resetUrl 
 */
const sendResetPasswordEmail = async (toEmail, userName, resetUrl) => {
  const mailOptions = {
    from: `"CCNA Master" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: '🔒 Khôi phục mật khẩu - CCNA Master',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #2563eb; text-align: center;">CCNA Master</h2>
        <p>Xin chào <strong>${userName}</strong>,</p>
        <p>Bạn nhận được email này vì chúng tôi đã nhận được yêu cầu khôi phục mật khẩu cho tài khoản của bạn.</p>
        <p>Vui lòng nhấn vào nút bên dưới để thực hiện thay đổi mật khẩu. Đường dẫn này sẽ hết hạn sau 1 giờ.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Đặt lại mật khẩu
          </a>
        </div>
        <p>Nếu bạn không yêu cầu khôi phục mật khẩu, vui lòng bỏ qua email này.</p>
        <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
        <p style="font-size: 12px; color: #666666; text-align: center;">
          Đây là email tự động, vui lòng không phản hồi. <br>
          © 2026 CCNA Master Team.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email khôi phục mật khẩu đã được gửi tới: ${toEmail}`);
  } catch (error) {
    console.error('❌ Lỗi khi gửi email:', error);
    throw new Error('Không thể gửi email khôi phục mật khẩu.');
  }
};

module.exports = {
  sendResetPasswordEmail
};
