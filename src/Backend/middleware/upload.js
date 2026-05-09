const multer = require('multer');
const path = require('path');
const { ValidationError } = require('../errors/validation-error');

const storage = multer.memoryStorage();

const imageFields = new Set(['thumbnail', 'thumbnailImg', 'topologyImg', 'image']);
const packetTracerFields = new Set(['filePka']);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (imageFields.has(file.fieldname)) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new ValidationError('File tai len phai la hinh anh'), false);
    }
    return cb(null, true);
  }

  if (packetTracerFields.has(file.fieldname)) {
    if (ext !== '.pkt' && ext !== '.pka') {
      return cb(new ValidationError('File Packet Tracer phai co duoi .pkt hoac .pka'), false);
    }
    return cb(null, true);
  }

  // Keep other fields (example: generic resources)
  return cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter
});

module.exports = upload;
