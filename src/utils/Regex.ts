export const commentRegex = /\s*;(?=(?:(?:[^']*'){2})*[^']*$)\s*(?<comment>.*)/i;

export const hexNumberRegex = /[0-9]+[0-9A-F]*H/gi;
export const decNumberRegex = /[0-9]+/gi;
export const binNumberRegex = /[0-1]+B/gi;
export const octNumberRegex = /[0-7]+O/gi;
export const literalRegex = /'[^\n']'/gi;
export const variableRegex = /%(?<number>\d+)/i;
export const textRegex = /'[^\n']*'/i;
export const registerOrMemoryRegex = /\b[ABCDEHLM]\b/i;

export const beginMacroRegex = /%macro\s+(?<name>\w+)\s+(?<paramsNumber>\w+)/i;
export const endMacroRegex = /%endmacro/i;
export const labelRegex = /^\s*((?<label>[\w]+):)/i;
export const number = [hexNumberRegex, binNumberRegex, octNumberRegex, decNumberRegex].map(regex => `(\\b${regex.source}\\b)`).join('|');

export const expressionRegex = new RegExp(`^(((NOT|-)\\s*)?(${number}))(\\s*(\\+|-|\\*|\\/|MOD|AND|OR|XOR|SHR|SHL)\\s*((NOT|-\\s*)?(${number})))*`, 'i');

export const instructionRegex = /^(\s*\w*\s*:)?\s*(?<mnemonic>\b[A-Z]+\b(?<!\bD[BWS]\b)(?!\s*:))\s*(?<operands>.*?)(;(?=(?:(?:[^']*'){2})*[^']*$)\s*(.*))?$/im;
export const declarationRegex = /^(\s*\w*\s*:)?\s*(?<type>\bD[BWS]\b)\s+(?<arg>.*?)(;(?=(?:(?:[^']*'){2})*[^']*$)\s*(.*))?$/im;
export const commaSeparatorRegex = /,(?=(?:(?:[^']*'){2})*[^']*$)/;
