import {
  deviceDefinitionSchema,
  gradingSpecSchema,
  parseCliLabConfig,
  topologySchema,
} from '../../../shared/cliLabSchema';
import { CLI_PROFILE_CATALOG, CLI_CHECK_CATALOG } from '../../../shared/cliLabCatalog';

/* The shared catalog, Zod schemas and parser are the source of truth. These
 * helpers only add editor-friendly locations for the form and JSON editor. */
export const PROFILE_OPTIONS = CLI_PROFILE_CATALOG.map((profile) => ({
  value: profile.id,
  label: profile.label,
  description: profile.description,
  shape: profile.topology ? 'topology' : 'device',
}));

export const SUPPORTED_CHECK_TYPES = CLI_CHECK_CATALOG.map((check) => ({
  value: check.type,
  label: check.label,
  description: check.description,
  fields: check.fields,
}));

export const CHECK_TYPE_MAP = Object.fromEntries(
  SUPPORTED_CHECK_TYPES.map((definition) => [definition.value, definition])
);

const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const SAFE_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/;
const INTERFACE_PATTERN = /^(?:(?:GigabitEthernet|FastEthernet)\d+\/\d+|Loopback\d+)$/;
export const getDevices = (state) => {
  if (Array.isArray(state?.devices)) return state.devices;
  if (state && Array.isArray(state.interfaces)) return [{ ...state, id: state.id || 'DEVICE1' }];
  return [];
};

export const isTopology = (state) => Array.isArray(state?.devices);
export const interfaceName = (port) => (typeof port === 'string' ? port : port?.name) || '';

export const toInterfaceObject = (port, deviceType = 'ROUTER') => {
  const defaults = {
    name: typeof port === 'string' ? port : port?.name || 'GigabitEthernet0/0',
    shutdown: deviceType === 'ROUTER',
    ipAddress: null,
    subnetMask: null,
    description: '',
    switchportMode: deviceType === 'SWITCH' ? 'access' : null,
    accessVlan: deviceType === 'SWITCH' ? 1 : null,
  };
  if (typeof port === 'string') return defaults;
  return {
    ...defaults,
    ...port,
    name: port?.name || defaults.name,
    shutdown: port?.shutdown === undefined ? defaults.shutdown : Boolean(port.shutdown),
    ipAddress: port?.ipAddress ?? null,
    subnetMask: port?.subnetMask ?? null,
    description: port?.description ?? '',
    switchportMode: port?.switchportMode ?? defaults.switchportMode,
    accessVlan: port?.accessVlan ?? defaults.accessVlan,
  };
};

export const stringifyJson = (value) => JSON.stringify(value, null, 2);

const jsonLocation = (text, offset) => {
  const position = Math.max(0, Math.min(Number(offset) || 0, String(text || '').length));
  const lines = String(text || '')
    .slice(0, position)
    .split(/\r?\n/);
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
};

export const parseJsonText = (text, fieldName = 'JSON') => {
  try {
    return { ok: true, value: JSON.parse(text), error: null };
  } catch (error) {
    const message = error?.message || `Không thể đọc ${fieldName}`;
    const match = message.match(/position\s+(\d+)/i);
    const location = match ? jsonLocation(text, match[1]) : null;
    return {
      ok: false,
      value: null,
      error: {
        path: fieldName,
        message,
        line: location?.line || null,
        column: location?.column || null,
        display: `${fieldName}: ${message}${location ? ` (dòng ${location.line}, cột ${location.column})` : ''}`,
      },
    };
  }
};

const issuePath = (root, path = []) => {
  let result = root;
  path.forEach((part) => {
    result += typeof part === 'number' ? `[${part}]` : `.${part}`;
  });
  return result;
};

const schemaErrors = (result, root) =>
  result.success
    ? []
    : (result.error?.issues || []).map((issue) => {
        const path = issuePath(root, issue.path);
        return { path, message: issue.message, display: `${path}: ${issue.message}` };
      });

const validIpv4 = (value) =>
  IPV4_PATTERN.test(String(value || '')) &&
  String(value)
    .split('.')
    .every((part) => Number(part) <= 255);
const validMask = (value) => {
  if (!validIpv4(value)) return false;
  const bits = String(value)
    .split('.')
    .map(Number)
    .map((part) => part.toString(2).padStart(8, '0'))
    .join('');
  return !bits.includes('01');
};
export const validateInitialState = (state) => {
  try {
    const result = Array.isArray(state?.devices)
      ? topologySchema.safeParse(state)
      : deviceDefinitionSchema.safeParse(state);
    return schemaErrors(result, 'initialState');
  } catch (error) {
    const message = error?.message || 'Initial State is invalid.';
    return [{ path: 'initialState', message, display: `initialState: ${message}` }];
  }
};

const sharedValidationError = (error, spec) => {
  const message = error?.message || 'CLI lab configuration is invalid.';
  const checkMatch = message.match(
    /Check\s+([^\s(]+)|Unknown\s+(?:interface|neighbor)\s+in\s+([^\s:]+)/i
  );
  const checkId = checkMatch?.[1] || checkMatch?.[2];
  const checkIndex = checkMatch
    ? (spec?.checks || []).findIndex((check) => check?.id === checkId)
    : -1;
  let path = 'gradingSpec';
  if (/profile/i.test(message)) {
    path = 'commandProfile';
  } else if (checkIndex >= 0) {
    path = `gradingSpec.checks[${checkIndex}]`;
    if (/neighbor/i.test(message)) path += '.neighborId';
    else if (/interface/i.test(message)) path += '.interface';
    else if (/deviceId|device|switch|router/i.test(message)) path += '.deviceId';
    else if (/topology/i.test(message)) path += '.type';
  }
  return { path, message, display: `${path}: ${message}` };
};

export const validateGradingSpec = (spec, state, commandProfile) => {
  const errors = schemaErrors(gradingSpecSchema.safeParse(spec), 'gradingSpec');
  if (errors.length || !state || validateInitialState(state).length) return errors;

  const expectedProfile = isTopology(state) ? 'ccna-network-v2' : 'ccna-basic-v1';
  try {
    parseCliLabConfig({
      labType: 'CLI_SIMULATION',
      initialState: state,
      gradingSpec: spec,
      commandProfile: commandProfile ?? expectedProfile,
      courseId: 'admin-draft',
    });
  } catch (error) {
    errors.push(sharedValidationError(error, spec));
  }
  return errors;
};
export const validateCliLabConfig = ({
  initialState,
  gradingSpec,
  commandProfile,
  initialStateText,
  gradingSpecText,
} = {}) => {
  const initial =
    initialState === undefined
      ? parseJsonText(initialStateText || '', 'Initial State')
      : { ok: true, value: initialState, error: null };
  const grading =
    gradingSpec === undefined
      ? parseJsonText(gradingSpecText || '', 'Grading Spec')
      : { ok: true, value: gradingSpec, error: null };
  const errors = [];
  if (!initial.ok) errors.push(initial.error);
  if (!grading.ok) errors.push(grading.error);
  if (!initial.ok || !grading.ok)
    return { valid: false, errors, initialState: initial, gradingSpec: grading };
  errors.push(...validateInitialState(initial.value));
  errors.push(...validateGradingSpec(grading.value, initial.value, commandProfile));
  return { valid: errors.length === 0, errors, initialState: initial, gradingSpec: grading };
};

export const updateOptionalField = (object, field, value) => {
  const next = { ...object };
  if (value === '' || value === null || value === undefined) delete next[field];
  else next[field] = value;
  return next;
};

export const createDefaultCheck = (type = 'hostname_equals', index = 0) => {
  const definition = CHECK_TYPE_MAP[type] || CHECK_TYPE_MAP.hostname_equals;
  const check = {
    id: `check-${index + 1}`,
    type: definition.value,
    title: definition.label,
    points: 10,
    hint: '',
  };
  if (definition.fields.includes('expected')) check.expected = '';
  if (definition.fields.includes('expectedIp')) check.expectedIp = '';
  if (definition.fields.includes('expectedMask')) check.expectedMask = '';
  if (definition.fields.includes('destination')) check.destination = '';
  if (definition.fields.includes('vlanId')) check.vlanId = 1;
  if (definition.fields.includes('name')) check.name = 'ACL1';
  return check;
};

export const nextCheckId = (checks = []) => {
  const ids = new Set(checks.map((check) => check?.id).filter(Boolean));
  let index = checks.length + 1;
  while (ids.has(`check-${index}`)) index += 1;
  return `check-${index}`;
};

export const checkField = (check, field, value) =>
  updateOptionalField(
    check,
    field,
    ['points', 'vlanId'].includes(field) ? (value === '' ? '' : Number(value)) : value
  );

export { INTERFACE_PATTERN, SAFE_ID_PATTERN, validIpv4, validMask };
