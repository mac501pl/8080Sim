import { prettifyInstruction, PrettyPrintable } from '@/renderer/EditorConfiguration/editor.documentFormattingProvider';
import { commaSeparatorRegex, expressionRegex, instructionRegex, literalRegex, strictNumber, registerOrMemoryRegex } from '@utils/Regex';
import Parser, { Label, parseExpression, parseToInt } from '../Parser';

export class Operand {
  public readonly value: string;
  public readonly intValue?: number;

  public constructor(value: string, intValue?: number) {
    this.value = value;
    this.intValue = intValue;
  }
}

const STRICT_LITERAL = new RegExp(`^${literalRegex.source}$`, 'i');
const STRICT_REGISTER = new RegExp(`^${registerOrMemoryRegex.source}$`, 'i');
const STRICT_EXPRESSION = new RegExp(`^${expressionRegex.source}$`, 'i');

export default class Instruction implements PrettyPrintable {
  public readonly mnemonic: string;
  public readonly operands: Array<Operand>;
  public readonly address: number;
  public readonly line: string;
  public readonly breakpoint: boolean;

  public constructor(line: string, address: number, breakpoint: boolean, labels: Array<Label>) {
    this.line = line;
    this.address = address;
    this.breakpoint = breakpoint;

    const { mnemonic, operands } = instructionRegex.exec(line).groups;
    this.mnemonic = mnemonic.trim();
    this.operands = operands.trim() ? this.parseOperands(operands, labels) : [];
  }

  private splitAndTrimOperands(operands: string): Array<string> {
    return operands.split(commaSeparatorRegex).map(operand => operand.trim());
  }

  private parseOperands(operands: string, labels: Array<Label>): Array<Operand> {
    return this.splitAndTrimOperands(Parser.replaceDollar(operands, this.address)).map(operand => {
      const potentialLabel = labels.find(label => label.name === operand);
      if (strictNumber.exec(operand)) {
        return new Operand(operand, parseToInt(operand));
      } else if (STRICT_LITERAL.exec(operand)) {
        return new Operand(operand, parseInt(String(operand.charCodeAt(1)), 10));
      } else if (potentialLabel) {
        return new Operand(operand, potentialLabel.address);
      } else if (STRICT_REGISTER.exec(operand)) {
        return new Operand(operand);
      } else if (STRICT_EXPRESSION.exec(operand)) {
        const result = parseExpression(operand);
        if (!isNaN(result)) {
          return new Operand(operand, result);
        }
      }
      return new Operand(operand);
    });
  }

  public prettyPrint(): string {
    return prettifyInstruction(this.line);
  }
}
