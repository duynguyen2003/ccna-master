// Parser offsets are relative to the command. The displayed caret also follows the prompt.
export const terminalOutput = (event) =>
  String(event.output || '').replace(
    /^( *)\^(?=\r?$)/gm,
    (_, spaces) => `${' '.repeat(String(event.prompt || '').length)}${spaces}^`
  );
