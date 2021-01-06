import instructionList from '@main/instruction_list';

const keywords = {
  mnemonicKeywords: [...new Set(instructionList.map(instruction => instruction.mnemonic))],
  declarationKeywords: ['DB', 'DS', 'DW'],
  registerKeywords: ['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M', 'SP', 'PSW'],
  expressionKeywords: ['NOT', 'AND', 'OR', 'XOR', 'SHR', 'SHL', 'MOD'],
  pseudoInstructionKeywords: ['ORG', 'EQU', 'SET', 'END', 'IF', 'ENDIF', 'MACRO', 'ENDM']
};

export default keywords;
