import { render, screen } from '@testing-library/react';
import CliLabConfigEditor from './CliLabConfigEditor';
import {
  PROFILE_OPTIONS,
  SUPPORTED_CHECK_TYPES,
  parseJsonText,
  validateCliLabConfig,
  validateGradingSpec,
} from './adminLabConfig';
import {
  networkLabTemplates,
  networkTemplate,
  networkGradingTemplate,
  switchThreePcTemplate,
  switchThreePcGradingTemplate,
} from '../../../data/networkLabTemplates';
import { interfacesForDevice } from './GradingSpecBuilder';

describe('admin CLI lab config contract', () => {
  test('uses the shared profile catalog and all supported check types', () => {
    expect(PROFILE_OPTIONS.map((profile) => profile.value)).toEqual([
      'ccna-basic-v1',
      'ccna-network-v2',
    ]);
    expect(SUPPORTED_CHECK_TYPES).toHaveLength(16);
    expect(SUPPORTED_CHECK_TYPES.map((check) => check.value)).toEqual(
      expect.arrayContaining([
        'reachable',
        'route_exists',
        'ospf_neighbor_full',
        'stp_root',
        'acl_exists',
        'nat_static_exists',
      ])
    );
  });

  test('keeps a valid single-device form compatible with the basic profile', () => {
    const result = validateCliLabConfig({
      initialState: { deviceType: 'ROUTER', hostname: 'R1', interfaces: ['GigabitEthernet0/0'] },
      gradingSpec: {
        passingScore: 70,
        checks: [
          {
            id: 'host',
            type: 'hostname_equals',
            expected: 'R1',
            points: 10,
            message: 'Keep',
            successMessage: 'Done',
            hint: 'Use hostname',
          },
        ],
      },
      commandProfile: 'ccna-basic-v1',
    });
    expect(result.valid).toBe(true);
    expect(
      interfacesForDevice(
        { deviceType: 'ROUTER', hostname: 'R1', interfaces: ['GigabitEthernet0/0'] },
        undefined
      ).map((option) => option.value)
    ).toEqual(['GigabitEthernet0/0']);
  });

  test('reports schema paths and keeps malformed JSON text available to the caller', () => {
    const parsed = parseJsonText('{\n  "devices": [\n}', 'Initial State');
    expect(parsed.ok).toBe(false);
    expect(parsed.error.path).toBe('Initial State');
    expect(parsed.error.display).toContain('Initial State');
  });

  test('rejects device deletion references instead of remapping checks', () => {
    const errors = validateGradingSpec(
      {
        passingScore: 70,
        checks: [
          { id: 'host', type: 'hostname_equals', deviceId: 'MISSING', expected: 'R1', points: 10 },
        ],
      },
      {
        devices: [{ id: 'R1', deviceType: 'ROUTER', interfaces: ['GigabitEthernet0/0'] }],
        links: [],
      }
    );
    expect(errors.some((error) => error.path.includes('deviceId'))).toBe(true);
  });

  test.each(networkLabTemplates)(
    '$title has compatible initial, grading and profile data',
    (template) => {
      const result = validateCliLabConfig({
        initialState: template.initialState,
        gradingSpec: template.gradingSpec,
        commandProfile: template.commandProfile,
      });
      expect(result.valid).toBe(true);
    }
  );

  test('keeps the legacy template exports stable', () => {
    expect(networkTemplate.devices.length).toBeGreaterThanOrEqual(4);
    expect(networkGradingTemplate.checks).toHaveLength(2);
    expect(
      switchThreePcTemplate.devices.filter((device) => device.deviceType === 'PC')
    ).toHaveLength(3);
    expect(switchThreePcGradingTemplate.checks.some((check) => check.type === 'vlan_exists')).toBe(
      true
    );
  });

  test.each([
    {
      label: 'null topology device',
      initialState: { devices: [null], links: [] },
      field: 'Initial State JSON',
    },
    {
      label: 'non-array topology devices',
      initialState: { devices: {}, links: [] },
      field: 'Initial State JSON',
    },
    {
      label: 'null grading check',
      initialState: { deviceType: 'ROUTER', hostname: 'R1', interfaces: ['GigabitEthernet0/0'] },
      gradingSpec: { passingScore: 70, checks: [null] },
      field: 'Grading Spec JSON',
    },
  ])('opens advanced JSON immediately for $label without crashing', ({ initialState, gradingSpec, field }) => {
    render(
      <CliLabConfigEditor
        initialStateText={JSON.stringify(initialState)}
        gradingSpecText={JSON.stringify(
          gradingSpec || {
            passingScore: 70,
            checks: [{ id: 'host', type: 'hostname_equals', expected: 'R1', points: 10 }],
          }
        )}
        commandProfile={
          Array.isArray(initialState.devices) ? 'ccna-network-v2' : 'ccna-basic-v1'
        }
      />
    );

    expect(screen.getByRole('textbox', { name: field })).toBeTruthy();
  });

  test('keeps the form open while a user completes related fields', () => {
    render(
      <CliLabConfigEditor
        initialStateText={JSON.stringify({
          deviceType: 'ROUTER',
          hostname: 'R1',
          interfaces: [
            {
              name: 'GigabitEthernet0/0',
              ipAddress: '192.168.1.1',
              subnetMask: null,
            },
          ],
        })}
        gradingSpecText={JSON.stringify({
          passingScore: 70,
          checks: [{ id: 'host', type: 'hostname_equals', expected: '', points: 10 }],
        })}
        commandProfile="ccna-basic-v1"
      />
    );

    expect(screen.queryByRole('textbox', { name: 'Initial State JSON' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Grading Spec JSON' })).toBeNull();
  });
});
