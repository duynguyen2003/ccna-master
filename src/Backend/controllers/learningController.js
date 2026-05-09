const { getPrisma } = require('../config/database');
const { uploadBufferToCloudinary } = require('../config/cloudinary');
const prisma = getPrisma();

module.exports.getCourses = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const whereClause = { deletedAt: null };
    if (!req.user || req.user.role !== 'ADMIN') {
      whereClause.status = { in: ['PUBLISHED', 'OPEN'] };
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { orderIndex: 'asc' },
        include: {
          modules: {
            where: { deletedAt: null },
            orderBy: { orderIndex: 'asc' },
            include: {
              lessons: {
                where: { deletedAt: null },
                orderBy: { orderIndex: 'asc' },
                select: { id: true, title: true, videoDuration: true, sectionNumber: true, orderIndex: true }
              },
              exams: {
                where: { status: 'OPEN', deletedAt: null },
                include: {
                  _count: { select: { questions: true } }
                }
              }
            }
          }
        }
      }),
      prisma.course.count({ where: whereClause })
    ]);

    // Lấy tiến độ của user nếu đã đăng nhập
    let userProgress = [];
    if (req.user && req.user.id) {
      userProgress = await prisma.userProgress.findMany({
        where: { userId: req.user.id }
      });
    }

    // Tính toán tổng thời lượng và tiến độ cho từng khóa học
    const coursesWithStats = courses.map(course => {
      let totalSeconds = 0;
      let totalLessons = 0;
      let sumProgress = 0;

      course.modules.forEach(module => {
        module.lessons.forEach(lesson => {
          totalLessons++;
          
          // Tính thời lượng
          if (lesson.videoDuration) {
            const parts = lesson.videoDuration.split(':').map(Number);
            if (parts.length === 2) {
              totalSeconds += (parts[0] || 0) * 60 + (parts[1] || 0);
            } else if (parts.length === 3) {
              totalSeconds += (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
            }
          }

          // Cộng dồn phần trăm tiến độ
          const progress = userProgress.find(p => p.lessonId === lesson.id);
          if (progress) {
            sumProgress += (progress.progressPercent || 0);
          }
        });
      });
      
      // Tính % tiến độ trung bình (Luôn làm tròn lên để không bị 0% nếu đã học)
      let progressPercent = 0;
      if (totalLessons > 0) {
         progressPercent = Math.ceil(sumProgress / totalLessons);
         // Nếu chưa học gì thì trả về 0, còn nếu đã nhích lên thì ít nhất là 1%
         if (sumProgress > 0 && progressPercent === 0) progressPercent = 1;
      }

      return {
        ...course,
        totalHours: totalSeconds > 0 ? Math.round((totalSeconds / 3600) * 10) / 10 : 0,
        progress: progressPercent,
        isStarted: sumProgress > 0
      };
    });

    res.json({
      data: coursesWithStats,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
};

module.exports.createCourse = async (req, res, next) => {
  try {
    const { id, code, title, description, level, status, orderIndex } = req.body;
    let thumbnailUrl = '';
    
    if (req.file) {
      const uploadResult = await uploadBufferToCloudinary(req.file, {
        folder: 'ccna/courses/thumbnails',
        resourceType: 'image'
      });
      thumbnailUrl = uploadResult.secure_url;
    }

    if (!code || !title) {
      return res.status(400).json({ message: 'Vui lòng nhập mã khóa học (code) và tên khóa học' });
    }

    const courseId = id || code.toLowerCase().replace(/\s/g, '');

    // Kiểm tra xem ID đã tồn tại chưa để tránh lỗi Unique constraint
    const existingCourse = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (existingCourse) {
      return res.status(400).json({ 
        message: `Mã khóa học "${code}" (ID: ${courseId}) đã tồn tại trong hệ thống. Vui lòng sử dụng mã khác hoặc chỉnh sửa khóa học hiện có.` 
      });
    }

    const course = await prisma.course.create({
      data: {
        id: courseId,
        code: code,
        title,
        description: description || null,
        level: level || 'BEGINNER',
        thumbnailUrl: thumbnailUrl || null,
        status: status || 'DRAFT',
        orderIndex: parseInt(orderIndex) || 0
      }
    });

    res.status(201).json({ message: 'Tạo khóa học thành công', course });
  } catch (error) {
    next(error);
  }
};

module.exports.updateCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code, title, description, level, status, orderIndex } = req.body;

    if (title !== undefined && !String(title).trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập tên khóa học' });
    }
    if (code !== undefined && !String(code).trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập mã khóa học' });
    }

    const dataToUpdate = {};
    if (code !== undefined) dataToUpdate.code = String(code).trim();
    if (title !== undefined) dataToUpdate.title = String(title).trim();
    if (description !== undefined) dataToUpdate.description = description ? String(description) : null;
    if (level !== undefined) dataToUpdate.level = level;
    if (status !== undefined) dataToUpdate.status = status;
    if (orderIndex !== undefined) {
      const parsedOrder = parseInt(orderIndex, 10);
      if (!Number.isNaN(parsedOrder)) dataToUpdate.orderIndex = parsedOrder;
    }

    if (req.file) {
      const uploadResult = await uploadBufferToCloudinary(req.file, {
        folder: 'ccna/courses/thumbnails',
        resourceType: 'image'
      });
      dataToUpdate.thumbnailUrl = uploadResult.secure_url;
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return res.status(400).json({ message: 'Không có dữ liệu cần cập nhật' });
    }

    const course = await prisma.course.update({
      where: { id },
      data: dataToUpdate
    });

    res.json({ message: 'Cập nhật khóa học thành công', course });
  } catch (error) {
    next(error);
  }
};

module.exports.deleteCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.course.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DRAFT' }
    });
    res.json({ message: 'Xóa khóa học thành công' });
  } catch (error) {
    next(error);
  }
};

module.exports.getLabs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const whereClause = {};
    if (!req.user || req.user.role !== 'ADMIN') {
      whereClause.status = 'PUBLISHED';
    }

    const [labs, total] = await Promise.all([
      prisma.lab.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { course: true }
      }),
      prisma.lab.count({ where: whereClause })
    ]);

    res.json({
      data: labs,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
};

module.exports.createLab = async (req, res, next) => {
  try {
    const { title, category, difficulty, duration, status, guideContent, courseId, moduleId, objective, tools, steps } = req.body;
    
    let fileUrl = null;
    let imageUrl = null;
    let topologyImgUrl = null;

    if (req.files) {
      if (req.files.filePka) {
        const fs = require('fs');
        const pathMod = require('path');
        const { v4: uuidv4pkt } = require('uuid');
        const pktFile = req.files.filePka[0];
        const pktExt = pathMod.extname(pktFile.originalname || '').toLowerCase();
        const pktName = `${uuidv4pkt()}${pktExt}`;
        const pktDir = pathMod.join(__dirname, '../../uploads/labs');
        if (!fs.existsSync(pktDir)) fs.mkdirSync(pktDir, { recursive: true });
        fs.writeFileSync(pathMod.join(pktDir, pktName), pktFile.buffer);
        fileUrl = `/uploads/labs/${pktName}`;
      }
      if (req.files.thumbnailImg) {
        const uploadResult = await uploadBufferToCloudinary(req.files.thumbnailImg[0], {
          folder: 'ccna/labs/thumbnails',
          resourceType: 'image'
        });
        imageUrl = uploadResult.secure_url;
      }
      if (req.files.topologyImg) {
        const uploadResult = await uploadBufferToCloudinary(req.files.topologyImg[0], {
          folder: 'ccna/labs/topologies',
          resourceType: 'image'
        });
        topologyImgUrl = uploadResult.secure_url;
      }
    }

    if (!title) {
      return res.status(400).json({ message: 'Vui lòng nhập tên bài Lab' });
    }

    const lab = await prisma.lab.create({
      data: {
        title,
        category: category || null,
        difficulty: difficulty || 'EASY',
        duration: duration || null,
        guideContent: guideContent || null,
        objective: objective || null,
        status: status || 'DRAFT',
        tools: tools ? (typeof tools === 'string' ? JSON.parse(tools) : tools) : null,
        steps: steps ? (typeof steps === 'string' ? JSON.parse(steps) : steps) : null,
        fileUrl,
        imageUrl,
        topologyImgUrl,
        courseId: courseId || null,
        moduleId: moduleId || null
      }
    });

    res.status(201).json({ message: 'Tạo bài Lab thành công', lab });
  } catch (error) {
    next(error);
  }
};

module.exports.updateLab = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, category, difficulty, duration, status, guideContent, courseId, moduleId, objective, tools, steps } = req.body;
    
    const dataToUpdate = { 
      title, 
      category,
      difficulty,
      duration,
      status,
      guideContent,
      objective,
      courseId: courseId || null,
      moduleId: moduleId || null,
      tools: tools ? (typeof tools === 'string' ? JSON.parse(tools) : tools) : undefined,
      steps: steps ? (typeof steps === 'string' ? JSON.parse(steps) : steps) : undefined,
    };

    if (req.files) {
      if (req.files.filePka) {
        const fs = require('fs');
        const pathMod = require('path');
        const { v4: uuidv4pkt } = require('uuid');
        const pktFile = req.files.filePka[0];
        const pktExt = pathMod.extname(pktFile.originalname || '').toLowerCase();
        const pktName = `${uuidv4pkt()}${pktExt}`;
        const pktDir = pathMod.join(__dirname, '../../uploads/labs');
        if (!fs.existsSync(pktDir)) fs.mkdirSync(pktDir, { recursive: true });
        fs.writeFileSync(pathMod.join(pktDir, pktName), pktFile.buffer);
        dataToUpdate.fileUrl = `/uploads/labs/${pktName}`;
      }
      if (req.files.thumbnailImg) {
        const uploadResult = await uploadBufferToCloudinary(req.files.thumbnailImg[0], {
          folder: 'ccna/labs/thumbnails',
          resourceType: 'image'
        });
        dataToUpdate.imageUrl = uploadResult.secure_url;
      }
      if (req.files.topologyImg) {
        const uploadResult = await uploadBufferToCloudinary(req.files.topologyImg[0], {
          folder: 'ccna/labs/topologies',
          resourceType: 'image'
        });
        dataToUpdate.topologyImgUrl = uploadResult.secure_url;
      }
    }

    const lab = await prisma.lab.update({
      where: { id: parseInt(id) },
      data: dataToUpdate
    });

    res.json({ message: 'Cập nhật bài Lab thành công', lab });
  } catch (error) {
    next(error);
  }
};

module.exports.deleteLab = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.lab.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Xóa bài Lab thành công' });
  } catch (error) {
    next(error);
  }
};

// =============================================
// MODULE (CHƯƠNG) MANAGEMENT
// =============================================

module.exports.getModulesByCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const modules = await prisma.module.findMany({
      where: { courseId, deletedAt: null },
      orderBy: { orderIndex: 'asc' },
      include: {
        lessons: {
          where: { deletedAt: null },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });
    res.json({ data: modules });
  } catch (error) {
    next(error);
  }
};

module.exports.createModule = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Vui lòng nhập tên chương' });
    }

    // Auto-generate short id (max 10 chars) and orderIndex
    const existingCount = await prisma.module.count({ where: { courseId } });
    const moduleId = `m${Date.now().toString().slice(-7)}`;

    const mod = await prisma.module.create({
      data: {
        id: moduleId,
        courseId,
        title,
        description: description || null,
        orderIndex: existingCount + 1
      }
    });

    res.status(201).json({ message: 'Tạo chương thành công', module: mod });
  } catch (error) {
    next(error);
  }
};

module.exports.deleteModule = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.module.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    res.json({ message: 'Xóa chương thành công' });
  } catch (error) {
    next(error);
  }
};

module.exports.updateModule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, orderIndex } = req.body;

    if (title !== undefined && !String(title).trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập tên chương' });
    }

    const dataToUpdate = {};
    if (title !== undefined) dataToUpdate.title = String(title).trim();
    if (description !== undefined) dataToUpdate.description = description ? String(description) : null;
    if (orderIndex !== undefined) {
      const parsedOrder = parseInt(orderIndex, 10);
      if (!Number.isNaN(parsedOrder)) dataToUpdate.orderIndex = parsedOrder;
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return res.status(400).json({ message: 'Không có dữ liệu cần cập nhật' });
    }

    const mod = await prisma.module.update({
      where: { id },
      data: dataToUpdate
    });

    res.json({ message: 'Cập nhật chương thành công', module: mod });
  } catch (error) {
    next(error);
  }
};

// =============================================
// LESSON (BÀI HỌC) MANAGEMENT
// =============================================

module.exports.getLessonsByModule = async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    const lessons = await prisma.lesson.findMany({
      where: { moduleId, deletedAt: null },
      orderBy: { orderIndex: 'asc' }
    });
    res.json({ data: lessons });
  } catch (error) {
    next(error);
  }
};

module.exports.createLesson = async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    const { title, sectionNumber, contentHtml, videoUrl, videoDuration } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Vui lòng nhập tên bài học' });
    }

    const existingCount = await prisma.lesson.count({ where: { moduleId } });

    const lesson = await prisma.lesson.create({
      data: {
        moduleId,
        title,
        sectionNumber: sectionNumber || null,
        contentHtml: contentHtml || null,
        videoUrl: videoUrl || null,
        videoDuration: videoDuration || null,
        orderIndex: existingCount + 1
      }
    });

    res.status(201).json({ message: 'Tạo bài học thành công', lesson });
  } catch (error) {
    next(error);
  }
};

module.exports.deleteLesson = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.lesson.update({
      where: { id: parseInt(id) },
      data: { deletedAt: new Date() }
    });
    res.json({ message: 'Xóa bài học thành công' });
  } catch (error) {
    next(error);
  }
};

module.exports.updateLesson = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, sectionNumber, contentHtml, videoUrl, videoDuration } = req.body;

    if (title !== undefined && !String(title).trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập tên bài học' });
    }

    const dataToUpdate = {};
    if (title !== undefined) dataToUpdate.title = String(title).trim();
    if (sectionNumber !== undefined) dataToUpdate.sectionNumber = sectionNumber ? String(sectionNumber) : null;
    if (contentHtml !== undefined) dataToUpdate.contentHtml = contentHtml ? String(contentHtml) : null;
    if (videoUrl !== undefined) dataToUpdate.videoUrl = videoUrl ? String(videoUrl) : null;
    if (videoDuration !== undefined) dataToUpdate.videoDuration = videoDuration ? String(videoDuration) : null;

    if (Object.keys(dataToUpdate).length === 0) {
      return res.status(400).json({ message: 'Không có dữ liệu cần cập nhật' });
    }

    const lesson = await prisma.lesson.update({
      where: { id: parseInt(id, 10) },
      data: dataToUpdate
    });

    res.json({ message: 'Cập nhật bài học thành công', lesson });
  } catch (error) {
    next(error);
  }
};

// =============================================
// COURSE TOPIC (CHỦ ĐỀ) MANAGEMENT
// =============================================

module.exports.getTopicsByCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const topics = await prisma.courseTopic.findMany({
      where: { courseId },
      orderBy: { orderIndex: 'asc' }
    });
    res.json({ data: topics });
  } catch (error) { next(error); }
};

module.exports.createTopic = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { title } = req.body;
    if (!title) return res.status(400).json({ message: 'Vui lòng nhập tên chủ đề' });

    const count = await prisma.courseTopic.count({ where: { courseId } });
    const topic = await prisma.courseTopic.create({
      data: { courseId, title, orderIndex: count + 1 }
    });
    res.status(201).json({ message: 'Tạo chủ đề thành công', topic });
  } catch (error) { next(error); }
};

module.exports.deleteTopic = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.courseTopic.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Xóa chủ đề thành công' });
  } catch (error) { next(error); }
};

// =============================================
// RESOURCE (TÀI LIỆU) MANAGEMENT
// =============================================

module.exports.getResources = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const courseId = req.query.courseId || undefined;

    const where = courseId ? { courseId } : {};
    const [resources, total] = await Promise.all([
      prisma.resource.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { course: { select: { title: true, code: true } } } }),
      prisma.resource.count({ where })
    ]);
    res.json({ data: resources, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

module.exports.createResource = async (req, res, next) => {
  try {
    const { title, type, size, courseId } = req.body;
    if (!title || !req.file) return res.status(400).json({ message: 'Vui lòng nhập tên và chọn file' });

    // Lưu file lên disk server — tránh phụ thuộc Cloudinary cho tài liệu
    const fs = require('fs');
    const pathMod = require('path');
    const { v4: uuidv4local } = require('uuid');

    const ext = pathMod.extname(req.file.originalname || '').toLowerCase();
    const fileName = `${uuidv4local()}${ext}`;
    const uploadDir = pathMod.join(__dirname, '../../uploads/resources');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(pathMod.join(uploadDir, fileName), req.file.buffer);

    const resource = await prisma.resource.create({
      data: {
        title,
        type: type || ext.replace('.', '').toUpperCase() || 'FILE',
        size: size || `${(req.file.size / 1024).toFixed(0)} KB`,
        fileUrl: `/uploads/resources/${fileName}`,  // Lưu đường dẫn nội bộ
        courseId: courseId || null
      }
    });
    res.status(201).json({ message: 'Tải tài liệu thành công', resource });
  } catch (error) { next(error); }
};

module.exports.deleteResource = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.resource.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Xóa tài liệu thành công' });
  } catch (error) { next(error); }
};

module.exports.downloadResource = async (req, res, next) => {
  try {
    const resource = await prisma.resource.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!resource || !resource.fileUrl) {
      return res.status(404).json({ message: 'Không tìm thấy tài liệu' });
    }

    const pathMod = require('path');

    // Nếu là file local (mới), dùng res.download()
    if (resource.fileUrl.startsWith('/uploads/')) {
      const ext = pathMod.extname(resource.fileUrl);
      const downloadName = `${resource.title}${ext}`;
      const filePath = pathMod.join(__dirname, '../../', resource.fileUrl);
      return res.download(filePath, downloadName);
    }

    // Fallback cho file cũ trên Cloudinary: mở trong tab mới
    return res.redirect(resource.fileUrl);
  } catch (error) { next(error); }
};
