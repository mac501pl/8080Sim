import { findInstruction } from '@utils/Utils';
import HexNum from './Types/HexNum';
import { IInstruction } from '@/main/instruction_list';
import { ParsedLine } from './Parser';
import Instruction from './Types/Instruction';
import Declaration from './Types/Declaration';
import { CustomError } from 'ts-custom-error';

export class AssembleError extends CustomError {
  public message: string;
  public constructor(public instruction?: Instruction) {
    super();
    this.instruction = instruction;
  }
}

export interface LinesWithOpcodes {
  line: ParsedLine;
  bytes: Array<HexNum>;
}

const assemble = (parserOutput: Array<ParsedLine>): Array<LinesWithOpcodes> => parserOutput.map(line => {
  if (line.content) {
    if (line.content instanceof Instruction) {
      try {
        const desiredInstruction: IInstruction = findInstruction(line.content);
        return {
          line: line,
          bytes: [new HexNum(desiredInstruction.opCode)]
            .concat(desiredInstruction.operands.map((operand, i) => {
              if (['n'].includes(operand)) {
                return new HexNum((line.content as Instruction).operands[i].intValue);
              } else if (['nn', 'a'].includes(operand)) {
                return HexNum.to16Bit((line.content as Instruction).operands[i].intValue);
              }
              return undefined;
            }).flat().filter(value => value))
        };
      } catch (e) {
        throw new AssembleError(line.content);
      }
    } else if (line.content instanceof Declaration) {
      return { line: line, bytes: line.content.list };
    }
  }
  return { line: line, bytes: [] };
}).flat().filter(value => value);

export default assemble;
