import { instructionRegex, declarationRegex, labelRegex, commentRegex, commaSeparatorRegex, pseudoInstructionRegex } from '@utils/Regex';
import instructionList from '@main/instruction_list';

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
  const { variable, type, arg } = declarationRegex.exec(line).groups;
  const splittedArg = arg.split(commaSeparatorRegex);

  return `${variable ? variable.trim() : ''}\t${type.trim().toUpperCase()} ${splittedArg
    .map(_arg => _arg.trim())
    .join(', ')
    .trim()}`;
};

export const prettifyLabel = (line: string): string => {
  const { label } = labelRegex.exec(line).groups;
  return `${label.trim()}:`;
};

export const prettifyPseudoInstruction = (line: string): string => {
  const { name, op, opnd } = pseudoInstructionRegex.exec(line).groups;
  return `\t${name ? `${name} ` : ''}${op.toUpperCase()}${opnd ? ` ${opnd}` : ''}`;
};

const prettifyComment = (line: string): string => {
  const { comment } = commentRegex.exec(line).groups;
  return ` ; ${comment}`;
};

const prettify = (code: string): string => code.split('\n')
  .map(line => line.trim())
  .map(line => {
    const prettyLine: Array<string> = [];
    if (labelRegex.test(line)) {
      prettyLine.push(prettifyLabel(line));
    }

    if (pseudoInstructionRegex.test(line)) {
      prettyLine.push(prettifyPseudoInstruction(line));
    } else if (instructionRegex.test(line)) {
      prettyLine.push(prettifyInstruction(line));
    }

    if (declarationRegex.test(line)) {
      prettyLine.push(prettifyDeclaration(line));
    }

    if (commentRegex.test(line)) {
      prettyLine.push(prettifyComment(line));
    }

    return prettyLine.join('');
  })
  .join('\n');

export default prettify;
