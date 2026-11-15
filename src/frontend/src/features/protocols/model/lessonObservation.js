import { lessonVietnamese } from '../data/lessonVietnamese';
import { lessonCamera, lessonFlight } from './lessonScene';
import scene from '../data/lessons/scene.json';
import { lessonNodeLabel } from './lessonPresentation';

const addressField = (value, direction) => {
  const text = String(value || '');
  const mac = /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(text);
  const ip =
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(text) ||
    (!mac && text.includes(':') && /^[0-9a-f:]+$/i.test(text));
  return mac || ip
    ? `${mac ? 'MAC' : 'IP'} ${direction}`
    : direction[0].toUpperCase() + direction.slice(1);
};

export function createLessonObservation(lesson, key) {
  const events = [];
  const stepStarts = [];
  let visible = [...lesson.start.nodes];
  let frame = lesson.start.frame;
  let offset = 0;
  const starts = [];
  let compatibilityIndex = 0;
  let nodeLabels = Object.fromEntries(
    lesson.nodes.map((id) => [
      id,
      lessonNodeLabel(lesson, id, lesson.labels?.[id] || scene.labels[id]),
    ])
  );
  lesson.steps.forEach((step, stepIndex) => {
    stepStarts.push(events.length);
    const [title, description] = (lesson.teaching?.steps || lessonVietnamese[lesson.id])?.[
      stepIndex
    ] || [step.title, step.detail || step.desc || ''];
    for (const source of step.events) {
      if (source.type === 'show') visible = [...new Set([...visible, ...source.nodes])];
      if (source.type === 'focus') visible = [...source.nodes];
      if (source.frame) frame = source.frame;
      if (source.type === 'label')
        nodeLabels = {
          ...nodeLabels,
          [source.at]: lessonNodeLabel(lesson, source.at, source.label),
        };
      const packets = source.type === 'stream' ? source.packets : [source];
      const sourceStart = offset;
      const spacing = source.type === 'stream' ? (source.spacing ?? 480) / 1000 : 0;
      let sourceEnd = sourceStart;
      let packetIndex = 0;
      for (const raw of packets) {
        const isPacket = raw.type === 'packet';
        const duration = isPacket ? lessonFlight(raw, undefined, lesson).duration : 1.2;
        starts.push(sourceStart + packetIndex++ * spacing);
        sourceEnd = Math.max(sourceEnd, starts[starts.length - 1] + duration);
        const actors = [
          ...new Set([raw.from, raw.to, raw.at, ...(raw.nodes || [])].filter(Boolean)),
        ];
        if (!actors.length) actors.push('client');
        const fields = [
          ['URL', raw.type === 'type-url' ? raw.text : undefined],
          [addressField(raw.row?.src, 'nguồn'), raw.row?.src],
          [addressField(raw.row?.dst, 'đích'), raw.row?.dst],
          ['Giao thức', raw.row?.proto],
          ['Thời điểm minh họa', raw.row?.time],
          ['Kích thước minh họa', raw.row?.len],
          ['Cổng nguồn', raw.row?.wire?.tcp?.sport ?? raw.row?.wire?.udp?.sport],
          ['Cổng đích', raw.row?.wire?.tcp?.dport ?? raw.row?.wire?.udp?.dport],
          ['TCP flags', raw.row?.wire?.tcp?.flags],
          ['TTL', raw.row?.wire?.ttl],
          ['Thiết bị', raw.type === 'label' ? nodeLabels[raw.at]?.[0] : undefined],
          ['Địa chỉ', raw.type === 'label' ? raw.label[1] : undefined],
        ].filter(([, value]) => value !== undefined && value !== null);
        events.push({
          // New address-label events do not shift IDs saved by the original 14 lessons.
          id:
            raw.type === 'label'
              ? `${lesson.id}-${stepIndex}-label-${events.length}`
              : `${lesson.id}-${stepIndex}-${compatibilityIndex++}`,
          index: events.length,
          stepIndex,
          stepTitle: title,
          type: isPacket ? 'LESSON_PACKET' : raw.type,
          kind: isPacket ? 'frame' : 'signal',
          label: isPacket ? raw.label : title,
          description,
          raw,
          detail: raw.lost ? 'Gói tin bị mất trong kịch bản.' : raw.row?.info || '',
          phase: raw.to === 'client' ? 'reply' : 'request',
          phaseLabel: isPacket ? `${raw.from} → ${raw.to}` : 'Xử lý tại thiết bị',
          actors,
          from: raw.from ? { deviceId: raw.from } : undefined,
          to: raw.to ? { deviceId: raw.to } : undefined,
          failure: Boolean(raw.lost),
          visible: [...visible],
          nodeLabels,
          noteText: lesson.teaching?.notes?.[raw.text] || raw.text,
          duration,
          camera: lessonCamera(frame, visible),
          groups: fields.length
            ? [{ title: isPacket ? 'Gói tin minh họa' : 'Thông tin sự kiện', fields }]
            : [],
        });
      }
      offset = sourceEnd;
    }
  });
  return {
    key,
    events,
    stepStarts,
    starts,
    lifelines: lesson.lifelines,
    actorMeta: Object.fromEntries(
      lesson.nodes.map((id) => [
        id,
        {
          name: lessonNodeLabel(lesson, id, lesson.labels?.[id] || scene.labels[id])[0],
          address: (lesson.labels?.[id] || scene.labels[id])?.[1] || '',
        },
      ])
    ),
    success: true,
    firstFailure: events.findIndex((event) => event.failure),
    reason: '',
  };
}
