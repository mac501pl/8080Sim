import { Label, ParsedLine } from '@/main/assembler/Parser';
import Declaration from '@/main/assembler/Types/Declaration';
import Instruction from '@/main/assembler/Types/Instruction';
import instructionList, { IInstruction } from '@/main/instruction_list';
import { beginMacroRegex, declarationRegex, endMacroRegex, instructionRegex, labelRegex, variableRegex } from '@/utils/Regex';
import { isNumber } from '@/utils/Utils';
import { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { CustomError } from 'ts-custom-error';

class ParseError extends CustomError {
  public constructor(public lineNumber: number, public message: string) {
    super(message);
    this.lineNumber = lineNumber;
    this.message = message;
  }
}

interface LightMacro {name: string; numberOfParams: number}

interface LineParsedForCheck extends ParsedLine {
  macro?: LightMacro;
  rawLine: string;
}

type Check = (parsedText: Array<LineParsedForCheck>) => Array<I8080MarkerData>;

interface I8080MarkerData {
  lineNumber: number;
  startColumn: number;
  endColumn: number;
  message: string;
}

const parseForSyntaxCheck = (text: string): Array<LineParsedForCheck> => {
  const splittedText = text.split('\n');
  const labels = splittedText.map(line => {
    if (labelRegex.exec(line)) {
      return new Label(labelRegex.exec(line).groups.label);
    }
    return null;
  }).filter(n => n);

  return splittedText.map((line, i) => {
    let label: Label, content: Declaration | Instruction, macro: LightMacro;

    try {
      if (labelRegex.exec(line)) {
        label = labels.find(_label => _label.name === labelRegex.exec(line).groups.label);
      }

      if (instructionRegex.exec(line)) {
        content = new Instruction(line, 0, false, labels);
      }

      if (declarationRegex.exec(line)) {
        content = new Declaration(line, labels);
      }

      if (beginMacroRegex.exec(line)) {
        const { name, paramsNumber } = beginMacroRegex.exec(line).groups;
        macro = { name: name, numberOfParams: Number(paramsNumber) };
      }
    } catch (e) {
      throw new ParseError(i, (e as Error).message);
    }
    return { lineNumber: i, label: label, content: content, rawLine: line, macro: macro };
  });
};

const getColumnIndeces = (matchString: string, rawLine: string): [number, number] => {
  const startColumnIndex = rawLine.indexOf(matchString) + 1;
  return [startColumnIndex, startColumnIndex + matchString.length];
};

const noMissingHlt = (parsedText: Array<LineParsedForCheck>): Array<I8080MarkerData> => {
  const linesWithInstructions = parsedText.filter(line => line.content instanceof Instruction);
  const containsHlt = linesWithInstructions.find(line => (line.content as Instruction).mnemonic.toLocaleUpperCase() === 'HLT') !== undefined;
  const markerData: Array<I8080MarkerData> = [];
  if (!containsHlt) {
    markerData.push({
      lineNumber: 0,
      startColumn: 0,
      endColumn: 1,
      message: 'Your program does not contain the HLT instruction. This will result in a crash!'
    });
  }
  return markerData;
};

const noLabelRedefinition = (parsedText: Array<LineParsedForCheck>): Array<I8080MarkerData> => {
  const linesWithLabels = parsedText.filter(line => line.label);
  const labels: Array<string> = [];
  const markerData: Array<I8080MarkerData> = [];
  for (const line of linesWithLabels) {
    if (labels.includes(line.label.name)) {
      const match = labelRegex.exec(line.rawLine);
      const alreadyDeclaredLabelLineNumber = linesWithLabels.find(_line => _line.label.name === line.label.name).lineNumber + 1;
      const [startColumn, endColumn] = getColumnIndeces(match.groups.label, line.rawLine);
      markerData.push({
        lineNumber: line.lineNumber,
        startColumn: startColumn,
        endColumn: endColumn,
        message: `Label "${line.label.name}" is already declared at line ${alreadyDeclaredLabelLineNumber}`
      });
    }
    labels.push(line.label.name);
  }
  return markerData;
};

const noMacroRedefinition = (parsedText: Array<LineParsedForCheck>): Array<I8080MarkerData> => {
  const linesWithMacros = parsedText.filter(line => line.macro);
  const macros: Array<string> = [];
  const markerData: Array<I8080MarkerData> = [];
  for (const line of linesWithMacros) {
    if (macros.includes(line.macro.name)) {
      const match = beginMacroRegex.exec(line.rawLine);
      const alreadyDeclaredMacroLineNumber = linesWithMacros.find(_line => _line.macro.name === line.macro.name).lineNumber + 1;
      const [startColumn, endColumn] = getColumnIndeces(match.groups.name, line.rawLine);
      markerData.push({
        lineNumber: line.lineNumber,
        startColumn: startColumn,
        endColumn: endColumn,
        message: `Macro "${line.macro.name}" is already declared at line ${alreadyDeclaredMacroLineNumber}`
      });
    }
    macros.push(line.macro.name);
  }
  return markerData;
};

const noInstructionOperandsNumberMismatch = (parsedText: Array<LineParsedForCheck>): Array<I8080MarkerData> => {
  const findExpectedOperandLength = (mnemonic: string): number => instructionList.find(instruction => instruction.mnemonic === mnemonic.toUpperCase()).operands.length;
  const macros = parsedText.filter(line => line.macro).map(line => line.macro.name);
  const linesWithInstructions = parsedText.filter(line => line.content instanceof Instruction).filter(line => !macros.includes((line.content as Instruction).mnemonic));
  const markerData: Array<I8080MarkerData> = [];
  for (const line of linesWithInstructions) {
    const instructionFromLine = line.content as Instruction;
    const expectedOperandsNumber = findExpectedOperandLength(instructionFromLine.mnemonic);
    const actualOperandsLength = instructionFromLine.operands.length;
    if (expectedOperandsNumber !== actualOperandsLength) {
      const match = instructionRegex.exec(line.rawLine);
      const [startColumn, endColumn] = getColumnIndeces(match.groups.operands, line.rawLine);
      markerData.push({
        lineNumber: line.lineNumber,
        startColumn: startColumn,
        endColumn: endColumn,
        message: `Instruction "${instructionFromLine.mnemonic}" expects ${expectedOperandsNumber} operand(s). ${actualOperandsLength} was/were provided`
      });
    }
  }
  return markerData;
};

const noMacroOperandsNumberMismatch = (parsedText: Array<LineParsedForCheck>): Array<I8080MarkerData> => {
  const macros = parsedText.filter(line => line.macro).map(line => line.macro);
  const macroNames = macros.map(macro => macro.name);
  const linesWithMacros = parsedText.filter(line => line.content instanceof Instruction).filter(line => macroNames.includes((line.content as Instruction).mnemonic));
  const markerData: Array<I8080MarkerData> = [];
  for (const line of linesWithMacros) {
    const instructionFromLine = line.content as Instruction;
    const expectedOperandsNumber = macros.find(macro => macro.name === instructionFromLine.mnemonic).numberOfParams;
    const actualOperandsLength = instructionFromLine.operands.length;
    if (expectedOperandsNumber !== actualOperandsLength) {
      const match = instructionRegex.exec(line.rawLine);
      const [startColumn, endColumn] = getColumnIndeces(match.groups.operands, line.rawLine);
      markerData.push({
        lineNumber: line.lineNumber,
        startColumn: startColumn,
        endColumn: endColumn,
        message: `Macro "${instructionFromLine.mnemonic}" expects ${expectedOperandsNumber} operand(s). ${actualOperandsLength} was/were provided`
      });
    }
  }
  return markerData;
};

const noClosedMacro = (parsedText: Array<LineParsedForCheck>): Array<I8080MarkerData> => {
  const linesWithMacros = parsedText.filter(line => line.macro);
  const markerData: Array<I8080MarkerData> = [];
  linesWithMacros.forEach(lineWithMacro => {
    const nextMacro = parsedText.slice(lineWithMacro.lineNumber + 1).find(line => beginMacroRegex.exec(line.rawLine));
    const subMacroArray = nextMacro === undefined ? parsedText.slice(lineWithMacro.lineNumber) : parsedText.slice(lineWithMacro.lineNumber, nextMacro.lineNumber);
    const isClosed = subMacroArray.find(line => endMacroRegex.exec(line.rawLine)) !== undefined;
    if (!isClosed) {
      const match = beginMacroRegex.exec(lineWithMacro.rawLine);
      const [startColumn, endColumn] = getColumnIndeces(match.groups.name, lineWithMacro.rawLine);
      markerData.push({
        lineNumber: lineWithMacro.lineNumber,
        startColumn: startColumn,
        endColumn: endColumn,
        message: 'This macro is unclosed. Close it with \'%endmacro\' keyword'
      });
    }
  });
  return markerData;
};

const noOperandTypemismatch = (parsedText: Array<LineParsedForCheck>): Array<I8080MarkerData> => {
  const findExpectedOperandLength = (mnemonic: string): number => instructionList.find(instruction => instruction.mnemonic === mnemonic.toUpperCase()).operands.length;
  const intersects = (arr1: Array<string>, arr2: Array<string>): boolean => arr1.some(element => arr2.includes(element));
  const macros = parsedText.filter(line => line.macro).map(line => line.macro.name);
  const linesWithInstructions = parsedText.filter(line => line.content instanceof Instruction).filter(line => !macros.includes((line.content as Instruction).mnemonic));
  const markerData: Array<I8080MarkerData> = [];
  for (const line of linesWithInstructions) {
    const match = instructionRegex.exec(line.rawLine);
    const [startColumn, endColumn] = getColumnIndeces(match.groups.operands, line.rawLine);
    const instructionFromLine = line.content as Instruction;
    const instructions: Array<IInstruction> = instructionList.filter(instruction => instruction.mnemonic === instructionFromLine.mnemonic.toUpperCase());
    const instructionsOperands = instructions.map(instruction => instruction.operands);
    const operandsLength = findExpectedOperandLength(instructionFromLine.mnemonic);

    const operandsByIndex: Array<Array<string>> = [];
    for (let i = 0; i < operandsLength; i++) {
      operandsByIndex.push([...new Set(instructionsOperands.map(instructionsOperand => instructionsOperand[i]))]);
    }
    operandsByIndex.forEach((operands, i) => {
      if (instructionFromLine.operands[i].intValue !== undefined) {
        if (!intersects(['nn', 'n', 'a'], operands) && !operands.every(operand => isNumber(operand))) {
          markerData.push({
            lineNumber: line.lineNumber,
            startColumn: startColumn,
            endColumn: endColumn,
            message: `${instructionFromLine.mnemonic} does not expect an address or a numerical value for the operand at position ${i + 1}`
          });
        }
        if (instructionFromLine.operands[i].intValue > 0xff && !intersects(['nn', 'a'], operands)) {
          markerData.push({
            lineNumber: line.lineNumber,
            startColumn: startColumn,
            endColumn: endColumn,
            message: `${instructionFromLine.mnemonic} does not expect an address or a 16 bit numerical value for the operand at position ${i + 1}`
          });
        }
      } else if (!operands.includes(instructionFromLine.operands[i].value.toUpperCase()) && !variableRegex.exec(instructionFromLine.operands[i].value)) {
        markerData.push({
          lineNumber: line.lineNumber,
          startColumn: startColumn,
          endColumn: endColumn,
          message: `${instructionFromLine.mnemonic} expects the following operands at position ${i + 1}: ${operands.toString()}\nBut the following was provided: ${instructionFromLine.operands[i].value}`
        });
      }
    });
  }
  return markerData;
};

const noUnknownMnemonicsOrMacros = (parsedText: Array<LineParsedForCheck>): Array<I8080MarkerData> => {
  const mnemonics = [...new Set(instructionList.map(instruction => instruction.mnemonic))];
  const macros = parsedText.filter(line => line.macro).map(line => line.macro.name);
  const linesWithInstructions = parsedText.filter(line => line.content instanceof Instruction);
  const markerData: Array<I8080MarkerData> = [];

  for (const line of linesWithInstructions) {
    const mnemonic = (line.content as Instruction).mnemonic.trim();
    if (!mnemonics.includes(mnemonic.toUpperCase()) && !macros.includes(mnemonic)) {
      const match = instructionRegex.exec(line.rawLine);
      const [startColumn, endColumn] = getColumnIndeces(match.groups.mnemonic, line.rawLine);
      markerData.push({
        lineNumber: line.lineNumber,
        startColumn: startColumn,
        endColumn: endColumn,
        message: `${mnemonic} isn't an instruction or macro`
      });
    }
  }
  return markerData;
};

const noInvalidMacroNames = (parsedText: Array<LineParsedForCheck>): Array<I8080MarkerData> => {
  const linesWithMacros = parsedText.filter(line => line.macro);
  const mnemonics = [...new Set(instructionList.map(instruction => instruction.mnemonic))];
  const markerData: Array<I8080MarkerData> = [];
  for (const lineWithMacro of linesWithMacros) {
    if (mnemonics.includes(lineWithMacro.macro.name.toUpperCase())) {
      const match = beginMacroRegex.exec(lineWithMacro.rawLine);
      const [startColumn, endColumn] = getColumnIndeces(match.groups.name, lineWithMacro.rawLine);
      markerData.push({
        lineNumber: lineWithMacro.lineNumber,
        startColumn: startColumn,
        endColumn: endColumn,
        message: 'Macro cannot share a name with an instruction'
      });
    }
  }
  return markerData;
};

const mapToMonacoMarkerData = (markerData: I8080MarkerData): editor.IMarkerData => ({
  startLineNumber: markerData.lineNumber + 1,
  endLineNumber: markerData.lineNumber + 1,
  startColumn: markerData.startColumn,
  endColumn: markerData.endColumn,
  message: markerData.message,
  severity: monaco.MarkerSeverity.Error
});

export const createModelMarkers = (value: string): Array<editor.IMarkerData> => {
  let parsedText;
  try {
    parsedText = parseForSyntaxCheck(value);
  } catch (e) {
    const error = e as ParseError;
    return [mapToMonacoMarkerData({
      lineNumber: error.lineNumber,
      startColumn: 0,
      endColumn: value.split('\n')[error.lineNumber].length,
      message: `Parse error: ${error.message}`
    })];
  }
  const checks: Array<Check> = [noUnknownMnemonicsOrMacros, noLabelRedefinition, noMacroRedefinition, noInstructionOperandsNumberMismatch, noMacroOperandsNumberMismatch, noOperandTypemismatch, noClosedMacro, noMissingHlt, noInvalidMacroNames];
  const markerDataToShow: Array<I8080MarkerData> = [];
  for (const check of checks) {
    try {
      const markerData = check(parsedText);
      if (markerData.length > 0) {
        markerDataToShow.push(...markerData);
      }
    // eslint-disable-next-line no-empty
    } catch (e) {}
  }
  return markerDataToShow.map(markerData => mapToMonacoMarkerData(markerData));
};
