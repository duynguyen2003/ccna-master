export const deviceNames = {
  client: 'Máy khách',
  router: 'Router',
  internet: 'Internet',
  dns: 'DNS resolver',
  web: 'Máy chủ web',
  root: 'DNS root',
  tld: 'DNS .com',
  auth: 'DNS thẩm quyền',
  mx: 'Máy chủ thư',
  relay: 'Proxy',
  app: 'Máy chủ ứng dụng',
  lan: 'Máy chủ nội bộ',
  isp: 'Router ISP',
  transit: 'Router trung chuyển',
  hosting: 'Router hosting',
  remote: 'Router phía bên kia',
  peer: 'Máy phía bên kia',
  switch: 'Switch',
  bng: 'Máy chủ truy cập',
  cam: 'Camera IP',
  stb: 'Thiết bị TV',
};

export function lessonNodeLabel(lesson, id, source) {
  const label = source || lesson.labels?.[id] || [];
  const name =
    lesson.teaching?.labels?.[label[0]] ||
    (lesson.labels?.[id] && label[0] !== 'Client' ? label[0] : deviceNames[id]) ||
    label[0] ||
    id;
  const address =
    {
      'No IP address': 'Chưa có địa chỉ IP',
      'No IPv6 address': 'Chưa có địa chỉ IPv6',
    }[label[1]] ||
    label[1] ||
    '';
  return [name, address];
}

export function lessonEventContext(event) {
  if (!event) return { action: '', actors: '', explanation: '' };
  const name = (id) => event.nodeLabels?.[id]?.[0] || deviceNames[id] || id;
  const actors =
    event.from && event.to
      ? `${name(event.from.deviceId)} → ${name(event.to.deviceId)}`
      : event.actors.map(name).join(' · ');
  let action = event.label;
  if (event.raw.type === 'type-url') action = 'Chuẩn bị truy cập trang web';
  else if (event.raw.type === 'show') action = 'Thiết bị tham gia giai đoạn';
  else if (event.raw.type === 'camera' || event.raw.type === 'focus')
    action = 'Theo dõi đường truyền';
  else if (event.raw.type === 'label') action = 'Cập nhật địa chỉ thiết bị';
  let explanation = event.description;
  if (event.raw.type === 'label')
    explanation = `${name(event.raw.at)} cập nhật thông tin thành ${event.raw.label[1]}. ${event.description}`;
  const protocol = event.raw.row?.proto;
  if (protocol === 'HTTP' && event.label.startsWith('GET'))
    explanation =
      'Máy khách gửi yêu cầu GET để lấy nội dung trang. Header Host cho biết tên miền mà máy chủ cần phục vụ.';
  else if (protocol === 'HTTP' && event.label === '200 OK')
    explanation =
      'Máy chủ trả lời yêu cầu bằng phản hồi 200 OK. Nội dung phản hồi đi về máy khách để trình duyệt tiếp tục xử lý.';
  else if (protocol === 'DNS' && event.label.includes('QUERY'))
    explanation = `${name(event.from.deviceId)} gửi truy vấn DNS để tìm bản ghi cho tên miền cần dùng.`;
  else if (protocol === 'DNS' && event.label.includes('REPLY'))
    explanation = `${name(event.from.deviceId)} gửi kết quả tra cứu về ${name(event.to.deviceId)}.`;
  else if (protocol === 'TCP' && event.raw.row?.wire?.tcp?.flags === 'S')
    explanation =
      'Bên gửi bắt đầu kết nối TCP bằng cờ SYN. Hai đầu cần thống nhất kết nối trước khi truyền dữ liệu ứng dụng.';
  else if (protocol === 'TCP' && event.raw.row?.wire?.tcp?.flags === 'SA')
    explanation = 'Bên nhận gửi SYN-ACK để xác nhận SYN và phản hồi yêu cầu thiết lập kết nối TCP.';
  if (event.failure)
    explanation = `Gói tin này bị mất trước khi tới thiết bị nhận. ${event.description}`;
  return { action, actors, explanation };
}

export function hasLessonDetails(event) {
  return Boolean(
    event &&
    ((event.groups || []).some((group) => group.fields.length) ||
      event.detail ||
      (Array.isArray(event.raw?.payload) && event.raw.payload.length > 0))
  );
}
