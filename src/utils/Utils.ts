import instructionList, { IInstruction } from '@/main/instruction_list';
import Instruction from '@/main/assembler/Types/Instruction';
import HexNum from '@main/assembler/Types/HexNum';

export const isNumber = (str: string): boolean => !isNaN(Number(str));

export const findInstruction = (parsedInstruction: Instruction): IInstruction => instructionList.find(instructionListItem => instructionListItem.mnemonic === parsedInstruction.mnemonic.toUpperCase() && parsedInstruction.operands.map((operand, i) => {
  const currentOperand = instructionListItem.operands[i];
  if (operand.intValue !== undefined) {
    if (isNumber(currentOperand)) {
      return currentOperand === operand.intValue.toString(16);
    }
    return ['n', 'nn', 'a'].includes(currentOperand);
  }
  return currentOperand === operand.value.toUpperCase();
}).every(element => element));

export const findInstructionByOpCode = (opCode: HexNum): IInstruction => instructionList.find(instructionListItem => instructionListItem.opCode === opCode.intValue);

export const findInstructionSize = (mnemonic: string): number => instructionList.find(instruction => instruction.mnemonic === mnemonic.toUpperCase()).size;

export const findInstructionSizeByOpcode = (opcode: HexNum): number => instructionList.find(instruction => instruction.opCode === opcode.intValue)?.size;

export const uniqueByMnemonic = (arr: Array<IInstruction>): Array<IInstruction> => arr.filter((v, i, a) => a.findIndex(t => (t.mnemonic === v.mnemonic)) === i);

export const intersects = (arr1: Array<string>, arr2: Array<string>): boolean => arr1.some(element => arr2.includes(element));
