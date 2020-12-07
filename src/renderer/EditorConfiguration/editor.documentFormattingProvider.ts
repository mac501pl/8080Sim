import { instructionRegex, declarationRegex, beginMacroRegex, endMacroRegex, labelRegex, commentRegex, commaSeparatorRegex } from '@utils/Regex';
import instructionList from '@/main/instruction_list';

const validMnemonics = instructionList.map(instruction => instruction.mnemonic.toLowerCase());

export interface PrettyPrintable {
  prettyPrint: () => string;
}

export const prettifyInstruction = (line: string): string => {
  const { mnemonic, operands } = instructionRegex.exec(line).groups;
  const prettyOperands = operands?.split(commaSeparatorRegex)
    .map(operand => operand.trim())
    .map(operand => {
      if (['a', 'b', 'c', 'd', 'e', 'h', 'l', 'm'].includes(operand)) {
        return operand.toUpperCase();
      }
      return operand;
    });

  const trimmedMnemonic = mnemonic.trim();
  const prettyMnemonic = validMnemonics.includes(trimmedMnemonic.toLowerCase()) ? trimmedMnemonic.toUpperCase() : trimmedMnemonic;
  let prettyInstruction = `\t${prettyMnemonic}`;
  if (prettyOperands) {
    prettyInstruction = prettyInstruction.concat(` ${prettyOperands.filter(operand => operand).map(operand => operand.trim()).join(', ')}`);
  }
  return prettyInstruction;
};

export const prettifyDeclaration = (line: string): string => {
  const { type, arg } = declarationRegex.exec(line).groups;
  const splittedArg = arg.split(commaSeparatorRegex);

  return `\t${type.trim().toUpperCase()} ${splittedArg
    .map(_arg => _arg.trim())
    .join(', ')
    .trim()}`;
};

export const prettifyLabel = (line: string): string => {
  const { label } = labelRegex.exec(line).groups;
  return `${label.trim()}:`;
};

const prettifyMacro = (line: string): string => {
  const { name, paramsNumber } = beginMacroRegex.exec(line).groups;
  return `%macro ${name.trim()} ${paramsNumber.trim()}`;
};

const prettifyEndmacro = (): string => '%endmacro';

const prettifyComment = (line: string): string => {
  const { comment } = commentRegex.exec(line).groups;
  return ` ; ${comment}`;
};

const prettify = (code: string): string => code.split('\n')
  .map(line => line.trim())
  .filter(line => line)
  .map(line => {
    const prettyLine: Array<string> = [];
    if (labelRegex.exec(line)) {
      prettyLine.push(prettifyLabel(line));
    }

    if (instructionRegex.exec(line)) {
      prettyLine.push(prettifyInstruction(line));
    }

    if (declarationRegex.exec(line)) {
      prettyLine.push(prettifyDeclaration(line));
    }

    if (beginMacroRegex.exec(line)) {
      prettyLine.push(prettifyMacro(line));
    }

    if (endMacroRegex.exec(line)) {
      prettyLine.push(prettifyEndmacro());
    }

    if (commentRegex.exec(line)) {
      prettyLine.push(prettifyComment(line));
    }

    return prettyLine.join('');
  })
  .join('\n')
  .replace(/^\s*[\r\n]/gm, '');

export default prettify;
