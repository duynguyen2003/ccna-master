import { terminalOutput } from './terminalFormatting';
test('caret follows both the prompt and the parser offset without changing other output', () => {
  expect(
    terminalOutput({ prompt: 'R1>', output: "^\n% Invalid input detected at '^' marker." })
  ).toBe("   ^\n% Invalid input detected at '^' marker.");
  expect(terminalOutput({ prompt: 'R1(config)#', output: '    ^\r\n% Invalid input' })).toBe(
    '               ^\r\n% Invalid input'
  );
  expect(terminalOutput({ prompt: 'R1#', output: 'Route ^ remains a literal' })).toBe(
    'Route ^ remains a literal'
  );
});
