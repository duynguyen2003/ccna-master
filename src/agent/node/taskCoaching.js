const { createHash } = require('node:crypto');
const { parseCommand } = require('@ccna/shared/simulation/cliParser');
const { fail } = require('./quota');

// Only these server-owned recipes may disclose a configuration command. Never
// parse commands out of titles, free-text hints, chat, or client input.
function recipe(check) {
  switch (check.type) {
    case 'eigrp_as_configured':
      return {
        concept:
          'Các router trao đổi EIGRP cần cùng AS. Bắt đầu bằng routing process trên thiết bị này.',
        verification: `Trên ${check.deviceId}, routing process EIGRP phải dùng AS ${check.asNumber}.`,
        commands: [['GLOBAL_CONFIG', 'router eigrp <AS>', `router eigrp ${check.asNumber}`]],
      };
    case 'eigrp_static_neighbor':
      return {
        concept:
          'Unicast neighbor cần địa chỉ peer trên đoạn nối trực tiếp và cấu hình ở cả hai đầu.',
        verification: `Kiểm tra unicast neighbor hai chiều trên cổng ${check.interface} của ${check.deviceId}.`,
        commands: [
          [
            'ROUTER_CONFIG',
            'neighbor <IP-peer> <cổng>',
            `neighbor ${check.neighborIp} ${check.interface}`,
          ],
        ],
      };
    case 'eigrp_passive_observed':
      return {
        concept:
          'Passive dừng hello trên cổng. Quan sát neighbor mất rồi phục hồi khi gỡ passive, giữ cổng hoạt động.',
        verification:
          'Neighbor phải mất do passive, rồi xuất hiện lại sau khi gỡ passive; cổng vẫn hoạt động.',
        commands: [
          ['ROUTER_CONFIG', 'passive-interface <cổng>', `passive-interface ${check.interface}`],
          [
            'ROUTER_CONFIG',
            'no passive-interface <cổng>',
            `no passive-interface ${check.interface}`,
          ],
        ],
      };
    case 'eigrp_metric_exercise':
      return {
        concept:
          'Classic metric dùng bandwidth nhỏ nhất và tổng delay. Tính phần delay còn thiếu trước khi thay đổi cổng.',
        verification: `FD tới ${check.destination} phải bằng ${check.expectedMetric}; giải thích cách tính delay.`,
        commands: [
          [
            'INTERFACE_CONFIG',
            'delay <đơn-vị-10µs>',
            `delay ${check.expectedDelayMicroseconds / 10}`,
          ],
        ],
      };
    case 'startup_config_saved':
      return {
        concept: 'Lưu cấu hình sau lần sửa cuối để các thay đổi còn tồn tại khi khởi động lại.',
        verification: 'Cấu hình khởi động phải khớp cấu hình đang chạy sau lần sửa cuối.',
        commands: [
          [
            'PRIVILEGED_EXEC',
            'copy <cấu-hình-nguồn> <cấu-hình-đích>',
            'copy running-config startup-config',
          ],
        ],
      };
    case 'eigrp_neighbor_up':
      return {
        concept: 'Hello phải đi được hai chiều, cùng AS và đúng cổng tham gia EIGRP.',
        verification: `${check.deviceId} phải thấy ${check.neighborId} trong danh sách EIGRP neighbors.`,
        commands: [['PRIVILEGED_EXEC', 'show ip eigrp neighbors', 'show ip eigrp neighbors']],
      };
    case 'route_exists':
      const learnedEigrp = check.source === 'learned' && check.protocol === 'D';
      return {
        concept: learnedEigrp
          ? 'Đối chiếu mạng đích trong topology EIGRP; route đã học và route được chọn có thể khác nhau.'
          : 'Đối chiếu prefix, AD và protocol của route được chọn tới mạng đích.',
        verification: `Route tới ${check.destination || check.network} phải ${check.source === 'learned' ? 'được học' : 'được chọn'} qua ${check.protocol || 'giao thức yêu cầu'}.`,
        commands: [
          [
            'PRIVILEGED_EXEC',
            learnedEigrp ? 'show ip eigrp topology' : 'show ip route',
            learnedEigrp ? 'show ip eigrp topology' : 'show ip route',
          ],
        ],
      };
    case 'reachable':
      return {
        concept:
          'Kết nối cần đường đi và đường về. Hoàn thành các mục tiêu định tuyến phụ thuộc trước.',
        verification: `Ping tới ${check.destination} phải thành công qua đường định tuyến yêu cầu.`,
        commands: [['USER_EXEC', 'ping <IP-đích>', `ping ${check.destination}`]],
      };
    default:
      return null;
  }
}

function taskFocusFor(attempt, request, level) {
  if (request.intent !== 'NEXT_STEP' || !request.taskId) return null;
  const check = attempt.definition?.gradingSpec?.checks?.find((c) => c.id === request.taskId);
  if (!check || (check.deviceId && request.selectedDeviceId !== check.deviceId))
    throw fail('AI_INVALID_REQUEST');
  if (!check.deviceId) return null;
  const guide = recipe(check);
  const device = attempt.deviceState.devices[check.deviceId];
  const commands = [];
  if (guide && device && level > 1) {
    for (const [mode, syntax, command] of guide.commands) {
      // Fail closed for legacy/custom checks with missing/invalid parameters.
      const parsed = parseCommand(
        'ccna-network-v2',
        {
          deviceType: device.deviceType,
          simulatorVersion: device.simulatorVersion || attempt.simulatorVersion,
          mode,
          context: { routingProtocol: 'eigrp' },
        },
        command
      );
      if (parsed.kind !== 'command') continue;
      const value = level === 2 ? syntax : command;
      commands.push({
        commandId: `cmd_${createHash('sha256')
          .update(JSON.stringify([check.id, level, value]))
          .digest('hex')
          .slice(0, 24)}`,
        deviceId: check.deviceId,
        mode,
        command: value,
        ...(level === 2 ? { template: true } : {}),
        ...(mode === 'ROUTER_CONFIG' ? { routingProtocol: 'eigrp' } : {}),
        ...(mode === 'INTERFACE_CONFIG' ? { interface: check.interface } : {}),
      });
    }
  }
  return {
    taskId: check.id,
    title: check.title || check.id,
    deviceId: check.deviceId || null,
    type: check.type,
    hintLevel: level,
    guidance:
      guide?.concept ||
      'Bám vào mục tiêu hiện tại; thu thập trạng thái liên quan trước khi thay đổi cấu hình.',
    verification:
      guide?.verification || `Đối chiếu trạng thái với mục tiêu: ${check.title || check.id}.`,
    commands,
  };
}

module.exports = { taskFocusFor };
