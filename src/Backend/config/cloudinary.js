const { v2: cloudinary } = require('cloudinary');
const { v4: uuidv4 } = require('uuid');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const ensureCloudinaryConfig = () => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary chua duoc cau hinh day du. Vui long set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.');
  }
};

const uploadBufferToCloudinary = (file, options = {}) => {
  ensureCloudinaryConfig();

  if (!file || !file.buffer) {
    throw new Error('Khong co du lieu file de tai len Cloudinary.');
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'ccna',
        resource_type: options.resourceType || 'auto',
        public_id: options.publicId || uuidv4(),
        overwrite: false
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      }
    );

    uploadStream.end(file.buffer);
  });
};

module.exports = {
  uploadBufferToCloudinary
};
