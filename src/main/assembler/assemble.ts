import { findInstruction } from '@utils/Utils';
import HexNum from './Types/HexNum';
import { IInstruction } from '@/main/instruction_list';
import { ParsedLine } from './Parser';
import Instruction from './Types/Instruction';
import Declaration from './Types/Declaration';

export interface LinesWithOpcodes {
  line: ParsedLine;
  bytes: Array<HexNum>;
}

const assemble = (parserOutput: Array<ParsedLine>): Array<LinesWithOpcodes> => parserOutput.map(line => {
  if (line.content) {
    const content = line.content;
    try {
      if (content instanceof Instruction) {
        const desiredInstruction: IInstruction = findInstruction(content);
        return {
          line: line,
          bytes: [new HexNum(desiredInstruction.opCode)]
            .concat(desiredInstruction.operands.map((operand, i) => {
              const operandIntValue = content.operands[i].intValue;
              if (['n'].includes(operand)) {
                return new HexNum(operandIntValue);
              } else if (['nn', 'a'].includes(operand)) {
                return HexNum.to16Bit(operandIntValue);
              }
              return null;
            }).flat().filter(value => value))
        };
      } else if (line.content instanceof Declaration) {
        return { line: line, bytes: line.content.list };
      }
    } catch (e) {
      throw new Error(`${(e as Error).message}\r\n\t${line.content.prettyPrint()}`);
    }
  }
  return { line: line, bytes: [] };
}).flat().filter(value => value);

export default assemble;
