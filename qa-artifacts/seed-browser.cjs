const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcrypt');
const target = new URL(process.env.DATABASE_URL);
if (target.hostname !== '127.0.0.1' || target.port !== '55433' || target.pathname !== '/qa_browser') throw new Error('Refuse non-QA database');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.toString() }) });
(async () => {
  if (await db.user.count()) throw new Error('QA fixture requires empty database');
  const passwordHash = await bcrypt.hash('QaBrowser2026!', 10);
  await db.user.createMany({ data: [
    { fullName: 'QA Quản Trị', email: 'qa.admin.20260919@example.test', passwordHash, role: 'ADMIN' },
    { fullName: 'QA Học Viên', email: 'qa.student.20260919@example.test', passwordHash, role: 'STUDENT' },
  ] });
  await db.course.createMany({ data: [
    { id: 'itn', code: 'ITN', title: 'QA Introduction to Networks', description: 'Khóa kiểm thử độc lập', status: 'PUBLISHED', orderIndex: 1 },
    { id: 'srwe', code: 'SRWE', title: 'QA Switching and Routing', status: 'PUBLISHED', orderIndex: 2 },
  ] });
  await db.module.createMany({ data: [
    { id: 'qa-m1', courseId: 'itn', title: 'QA Chương 1: Nền tảng mạng', orderIndex: 1 },
    { id: 'qa-m2', courseId: 'srwe', title: 'QA Chương 2: Định tuyến', orderIndex: 1 },
  ] });
  await db.lesson.createMany({ data: [
    { moduleId: 'qa-m1', title: 'QA Bài đọc cơ bản', sectionNumber: '1.1.1', orderIndex: 1, contentHtml: '## Kiến thức nền tảng\n\nMạng kết nối các thiết bị.\n\n> [!NOTE]\n> Ghi chú cần nhớ.\n\n```cli\nshow ip route\n```' },
    { moduleId: 'qa-m1', title: 'QA Video theo dõi tiến độ', sectionNumber: '1.1.2', orderIndex: 2, videoUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', videoDuration: '0:19', contentHtml: '> [!TIP]\n> Dừng video để ghi chú cá nhân.' },
    { moduleId: 'qa-m2', title: 'QA Bài khóa', orderIndex: 1, contentHtml: 'Bài khóa cần hoàn thành khóa trước.' },
  ] });
  await db.courseTopic.create({ data: { courseId: 'itn', title: 'Đọc cấu hình Cisco' } });
  await db.lab.create({ data: { title: 'QA CLI hostname', courseId: 'itn', commandProfile: 'ccna-network-v2', labType: 'CLI_SIMULATION', status: 'PUBLISHED', category: 'Routing', objective: 'Đổi hostname Router thành QA-R1', duration: '5 phút', initialState: { devices: [{ id: 'R1', deviceType: 'ROUTER', hostname: 'Router', interfaces: ['GigabitEthernet0/0'] }], links: [] }, gradingSpec: { passingScore: 100, checks: [{ id: 'hostname', type: 'hostname_equals', deviceId: 'R1', expected: 'QA-R1', points: 100 }] } } });
  await db.lab.create({ data: { title: 'QA Packet Tracer', status: 'PUBLISHED', labType: 'PACKET_TRACER', category: 'Switch', objective: 'Kiểm thử hướng dẫn', guideContent: '<p>Kết nối các thiết bị.</p>', steps: [{ title: 'Kiểm tra dây', content: 'Xem kết nối mạng.' }] } });
  await db.exam.create({ data: { title: 'QA Thi cơ bản', examCode: 'QA01', totalQuestions: 2, durationMinutes: 5, passingScore: 50, status: 'OPEN', difficulty: 'EASY', questions: { create: [
    { question: 'Giao thức dùng để truy cập web an toàn?', options: ['HTTPS', 'Telnet', 'FTP', 'TFTP'], correctAnswer: [0], explanation: 'HTTPS mã hóa kết nối web.', orderIndex: 1 },
    { question: 'Lệnh vào chế độ đặc quyền Cisco?', options: ['enable', 'exit', 'ping', 'logout'], correctAnswer: [0], explanation: 'enable vào chế độ đặc quyền.', orderIndex: 2 },
  ] } } });
  await db.resource.create({ data: { title: 'QA Tài liệu Cisco', type: 'PDF', size: '1 KB', fileUrl: 'https://www.cisco.com/', courseId: 'itn' } });
  await db.tool.create({ data: { title: 'QA Subnet Calculator', linkUrl: '/tools/subnet', iconName: 'calculate' } });
  console.log('QA fixture created: 2 users, 2 courses, 3 lessons, 2 labs, 1 exam, resource and tool');
})().finally(() => db.$disconnect()).catch((error) => { console.error(error.message); process.exitCode = 1; });
