export const commentRegex = /\s*;(?=(?:(?:[^']*'){2})*[^']*$)\s*(?<comment>.*)/i;

export const hexNumberRegex = /[0-9]+[0-9A-F]*H/gi;
export const decNumberRegex = /[0-9]+D?/gi;
export const binNumberRegex = /[0-1]+B/gi;
export const octNumberRegex = /[0-7]+[OQ]/gi;
export const literalRegex = /'[^\n']'/gi;
export const textRegex = /^'[^\n']*'$/i;
export const registerOrMemoryRegex = /\b[ABCDEHLM]\b/i;

export const labelRegex = /^\s*((?<label>[\w]+):)/i;
export const number = [hexNumberRegex, binNumberRegex, octNumberRegex, decNumberRegex].map(regex => `(\\b${regex.source}\\b)`).join('|');
export const strictNumber = new RegExp([hexNumberRegex, binNumberRegex, octNumberRegex, decNumberRegex].map(regex => `(^${regex.source}$)`).join('|'), 'i');

export const instructionRegex = /^(\s*\w*\s*:)?\s*(?<mnemonic>\b[A-Z_]+\b(?<!\bD[BWS]\b)(?!(\s*:)))\s*(?<operands>.*?)(;(?=(?:(?:[^']*'){2})*[^']*$)\s*(.*))?$/im;
export const declarationRegex = /^(\s*\w*\s*:)?\s*(?<type>\bD[BWS]\b)\s+(?<arg>.*?)(;(?=(?:(?:[^']*'){2})*[^']*$)\s*(.*))?$/im;
export const commaSeparatorRegex = /,(?=(?:(?:[^']*'){2})*[^']*$)/;

export const pseudoInstructionRegex = /^\s*(((?<name>\w+):?)\s+)?(?<op>MACRO|ENDM|ORG|EQU|SET|END|IF|ENDIF)\s*(?<opnd>.*?)(;(?=(?:(?:[^']*'){2})*[^']*$)\s*(.*))?$/im;
// todo all comments are stripped so why worry about them
// todo simplify regtexes, sometimes they are onky used once, could make them strict in the fist place ex: rgisterOeMemoryRegex
