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
export const strictNumber = new RegExp([hexNumberRegex, binNumberRegex, octNumberRegex, decNumberRegex].map(regex => `(^${regex.source}$)`).join('|'));

export const expressionRegex = new RegExp(`^((((NOT|-)\\s*){0,2})(${number}|${literalRegex.source}))(\\s*(\\+|-|\\*|\\/|MOD|AND|OR|XOR|SHR|SHL)\\s*(((NOT|-)\\s*){0,2})(${number}|${literalRegex.source}))*`, 'i');

export const instructionRegex = /^(\s*\w*\s*:)?\s*(?<mnemonic>\b[A-Z]+\b(?<!\bD[BWS]\b)(?!(\s*:)|(\s*equ)))\s*(?<operands>.*?)(;(?=(?:(?:[^']*'){2})*[^']*$)\s*(.*))?$/im;
export const declarationRegex = /^(\s*\w*\s*:)?\s*(?<type>\bD[BWS]\b)\s+(?<arg>.*?)(;(?=(?:(?:[^']*'){2})*[^']*$)\s*(.*))?$/im;
export const commaSeparatorRegex = /,(?=(?:(?:[^']*'){2})*[^']*$)/;

export const equRegex = /^\s*(?<stringToBeReplaced>\w*?)\s+(equ)\s+(?<replacerString>.*?)(;(?=(?:(?:[^']*'){2})*[^']*$)\s*(.*))?$/im;
