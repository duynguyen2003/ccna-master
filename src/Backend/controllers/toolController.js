const { getPrisma } = require('../config/database');
const prisma = getPrisma();

module.exports.getTools = async (req, res, next) => {
  try {
    const tools = await prisma.tool.findMany({ orderBy: { orderIndex: 'asc' } });
    res.json({ data: tools });
  } catch (error) { next(error); }
};

module.exports.createTool = async (req, res, next) => {
  try {
    const { title, description, iconName, linkUrl, orderIndex } = req.body;
    if (!title) return res.status(400).json({ message: 'Vui lòng nhập tên công cụ' });

    const tool = await prisma.tool.create({
      data: {
        title,
        description: description || null,
        iconName: iconName || null,
        linkUrl: linkUrl || null,
        orderIndex: parseInt(orderIndex) || 0
      }
    });
    res.status(201).json({ message: 'Tạo công cụ thành công', tool });
  } catch (error) { next(error); }
};

module.exports.updateTool = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, iconName, linkUrl, isActive, orderIndex } = req.body;
    const tool = await prisma.tool.update({
      where: { id: parseInt(id) },
      data: { title, description, iconName, linkUrl, isActive, orderIndex: parseInt(orderIndex) || undefined }
    });
    res.json({ message: 'Cập nhật công cụ thành công', tool });
  } catch (error) { next(error); }
};

module.exports.toggleToolActive = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tool = await prisma.tool.findUnique({ where: { id: parseInt(id) } });
    const updated = await prisma.tool.update({
      where: { id: parseInt(id) },
      data: { isActive: !tool.isActive }
    });
    res.json({ message: `Công cụ đã ${updated.isActive ? 'bật' : 'tắt'}`, tool: updated });
  } catch (error) { next(error); }
};

module.exports.deleteTool = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.tool.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Xóa công cụ thành công' });
  } catch (error) { next(error); }
};
