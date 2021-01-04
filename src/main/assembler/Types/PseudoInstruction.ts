import { prettifyPseudoInstruction, PrettyPrintable } from '@renderer/EditorConfiguration/editor.documentFormattingProvider';
import { expressionRegex, pseudoInstructionRegex, strictNumber } from '@utils/Regex';
import Parser, { parseExpression, parseToInt } from '../Parser';

type AllowedOps = 'ORG' | 'EQU' | 'SET' | 'END' | 'IF' | 'ENDIF' | 'MACRO' | 'ENDM';

export default class PseudoInstruction implements PrettyPrintable {
  public readonly name?: string;
  public readonly op: AllowedOps;
  public readonly opnd?: number | string;
  private readonly line: string;

  public constructor(line: string, address = 0) {
    const { name, op, opnd } = pseudoInstructionRegex.exec(line).groups;
    this.op = op.toUpperCase() as AllowedOps;
    this.name = name;
    this.opnd = this.parseOpnd(opnd.trim(), address);
    this.line = line;
  }

  private parseOpnd(opnd: string, address: number): number | string {
    switch (this.op) {
    case 'ORG': {
      const operand = Parser.replaceDollar(opnd, address);
      if (strictNumber.exec(operand)) {
        return parseToInt(operand);
      } else if (expressionRegex.exec(operand)) {
        return parseExpression(operand);
      }
      throw new Error(`Invalid argument type for pseudoinstruction ORG: ${opnd}`);
    }
    case 'MACRO':
      return parseToInt(opnd);
    case 'EQU':
    case 'SET':
      if ((/\w+/).test(opnd)) {
        return opnd;
      }
      throw new Error(`Invalid argument type for pseudoinstruction SET or EQU: ${opnd}`);
    case 'ENDM':
      if (opnd) {
        throw new Error('ENDM pseudo instruction does not receive any operands');
      }
      return null;
    case 'END':
      if (opnd) {
        throw new Error('END pseudo instruction does not receive any operands');
      }
      return null;
    default:
      throw new Error(`Invalid pseudoinstruction op: ${this.op}`);
    }
  }

  public prettyPrint(): string {
    return prettifyPseudoInstruction(this.line);
  }
}
