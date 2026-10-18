/**
 * Pure Mathematical Geometry Engine cho Learning Path Map.
 *
 * Tính toán tọa độ zigzag thuần túy dựa trên data và container dimensions,
 * KHÔNG query DOM bounding rect, KHÔNG gây layout thrashing.
 */

const DESKTOP_BREAKPOINT = 1024;

/**
 * Tính toán tọa độ các node và kích thước canvas
 */
export const calculateZigzagPositions = ({
  containerWidth = 1024,
  courses = [],
  customConfig = {},
  layoutMode = 'auto',
}) => {
  const safeWidth = Number.isFinite(containerWidth) && containerWidth > 0 ? containerWidth : 1024;
  const count = Array.isArray(courses) ? courses.length : 0;
  const isDesktop =
    layoutMode === 'horizontal' || (layoutMode !== 'vertical' && safeWidth >= DESKTOP_BREAKPOINT);

  // Trường hợp 0 node
  if (count === 0) {
    return {
      nodes: [],
      canvasWidth: safeWidth,
      canvasHeight: isDesktop ? 400 : 300,
      isDesktop,
    };
  }

  // Cấu hình Desktop (Ngang)
  if (isDesktop) {
    const nodeSize = customConfig.nodeSize || 72;
    const paddingX = customConfig.paddingX || 96;
    const paddingY = customConfig.paddingY || 85;
    const verticalAmplitude = customConfig.verticalAmplitude || 50;

    // Chiều cao canvas cố định đủ cho 2 cực biên trên/dưới + nhãn
    const canvasHeight = Math.max(360, paddingY * 2 + nodeSize + verticalAmplitude * 2);
    const centerY = canvasHeight / 2;

    // Khoảng cách ngang giữa các node ngắn gọn, tinh gọn (dây ngắn lại, không kéo dãn hết màn hình)
    const horizontalSpacing = customConfig.horizontalSpacing || 220;

    const canvasWidth = Math.round(
      paddingX * 2 + nodeSize + (count > 1 ? (count - 1) * horizontalSpacing : 0)
    );

    const nodes = courses.map((course, i) => {
      // Nếu chỉ có 1 node thì đặt chính giữa
      const x = count === 1 ? canvasWidth / 2 : paddingX + nodeSize / 2 + i * horizontalSpacing;

      // i chẵn: node ở dưới (+amplitude), i lẻ: node ở trên (-amplitude)
      const yOffset = count === 1 ? 0 : i % 2 === 0 ? verticalAmplitude : -verticalAmplitude;
      const y = centerY + yOffset;

      // Nhãn: node nằm trên (y < centerY) → đặt nhãn dưới; node nằm dưới (y > centerY) → đặt nhãn trên
      // để không bị cắt mép canvas
      const labelPlacement = yOffset <= 0 ? 'bottom' : 'top';

      return {
        ...course,
        index: i,
        x: Math.round(x),
        y: Math.round(y),
        nodeSize,
        labelPlacement,
      };
    });

    return {
      nodes,
      canvasWidth: Math.round(canvasWidth),
      canvasHeight: Math.round(canvasHeight),
      isDesktop: true,
    };
  }

  // Cấu hình Mobile & Tablet (< 1024px, Dọc)
  const isNarrowMobile = safeWidth < 380;
  const nodeSize = isNarrowMobile ? 56 : 64;
  const paddingY = 56;
  const verticalSpacing = isNarrowMobile ? 190 : 175;

  // Biên độ zigzag ngang được clamp an toàn
  const maxAmp = isNarrowMobile ? 32 : 54;
  const horizontalAmplitude = Math.max(20, Math.min(maxAmp, Math.floor(safeWidth * 0.12)));
  const centerX = safeWidth / 2;

  const canvasWidth = safeWidth;
  const canvasHeight = Math.max(
    320,
    paddingY * 2 + nodeSize + (count > 1 ? (count - 1) * verticalSpacing : 0)
  );

  const nodes = courses.map((course, i) => {
    // Nếu chỉ có 1 node thì đặt chính giữa
    if (count === 1) {
      return {
        ...course,
        index: 0,
        x: Math.round(centerX),
        y: Math.round(canvasHeight / 2),
        nodeSize,
        labelPlacement: 'bottom',
      };
    }

    // i chẵn: lệch trái (-amp), i lẻ: lệch phải (+amp)
    const xOffset = i % 2 === 0 ? -horizontalAmplitude : horizontalAmplitude;
    const x = centerX + xOffset;
    const y = paddingY + nodeSize / 2 + i * verticalSpacing;

    // Ở màn hình rất hẹp (<380px), đặt label phía dưới node để không bị bóp nghẽn 2 bên
    // Ở màn hình lớn hơn, node lệch trái thì label bên phải và ngược lại
    let labelPlacement = 'bottom';
    if (!isNarrowMobile) {
      labelPlacement = xOffset < 0 ? 'right' : 'left';
    }

    return {
      ...course,
      index: i,
      x: Math.round(x),
      y: Math.round(y),
      nodeSize,
      labelPlacement,
    };
  });

  return {
    nodes,
    canvasWidth: Math.round(canvasWidth),
    canvasHeight: Math.round(canvasHeight),
    isDesktop: false,
  };
};

/**
 * Tạo các đoạn đường cong Cubic Bezier nối giữa các node kề nhau
 */
export const generatePathSegments = (positionedNodes = [], isDesktop = true) => {
  if (!Array.isArray(positionedNodes) || positionedNodes.length < 2) {
    return [];
  }

  const segments = [];

  for (let i = 0; i < positionedNodes.length - 1; i++) {
    const fromNode = positionedNodes[i];
    const toNode = positionedNodes[i + 1];

    const x1 = fromNode.x;
    const y1 = fromNode.y;
    const x2 = toNode.x;
    const y2 = toNode.y;

    let cp1x, cp1y, cp2x, cp2y;

    if (isDesktop) {
      // Đường ngang: các control point trải đều theo trục X
      const dx = (x2 - x1) * 0.5;
      cp1x = x1 + dx;
      cp1y = y1;
      cp2x = x2 - dx;
      cp2y = y2;
    } else {
      // Đường dọc: các control point trải đều theo trục Y
      const dy = (y2 - y1) * 0.5;
      cp1x = x1;
      cp1y = y1 + dy;
      cp2x = x2;
      cp2y = y2 - dy;
    }

    const pathData = `M ${x1} ${y1} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${x2} ${y2}`;

    // Trạng thái đoạn đường:
    // - completed: node đích đã hoàn thành -> đường đã đi qua (xanh đậm/sáng)
    // - current: node đích là current -> đường đang đi tới chặng hiện tại
    // - locked: đường trong tương lai chưa mở
    let status = 'locked';
    if (toNode.status === 'completed') {
      status = 'completed';
    } else if (toNode.status === 'current' || fromNode.status === 'completed') {
      status = 'active';
    }

    segments.push({
      id: `seg-${fromNode.id}-${toNode.id}`,
      fromId: fromNode.id,
      toId: toNode.id,
      fromIndex: i,
      toIndex: i + 1,
      pathData,
      status,
    });
  }

  return segments;
};
