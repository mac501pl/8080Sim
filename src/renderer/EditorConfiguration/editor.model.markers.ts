import Parser, { Label, LineContentType, ParsedLine } from '@/main/assembler/Parser';
import Declaration from '@/main/assembler/Types/Declaration';
import Instruction from '@/main/assembler/Types/Instruction';
import PseudoInstruction from '@/main/assembler/Types/PseudoInstruction';
import instructionList, { IInstruction } from '@/main/instruction_list';
import { declarationRegex, instructionRegex, labelRegex, pseudoInstructionRegex } from '@/utils/Regex';
import { isNumber, intersects } from '@/utils/Utils';
import { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { CustomError } from 'ts-custom-error';
import keywords from './keywords';

class ParseError extends CustomError {
  public constructor(public lineNumber: number, public message: string) {
    super(message);
    this.lineNumber = lineNumber;
    this.message = message;
  }
}

interface LightMacro {name: string; opnd: Array<string>}

interface LineParsedForCheck extends ParsedLine {
  macro?: LightMacro;
  rawLine: string;
}

type Check = (parsedText: Array<LineParsedForCheck>) => Array<I8080MarkerData>;
type CheckBeforeParse = (text: Array<string>) => Array<I8080MarkerData>;

interface I8080MarkerData {
  lineNumber: number;
  startColumn: number;
  endColumn: number;
  message: string;
}

const parseForSyntaxCheck = (text: string): Array<LineParsedForCheck> => {
  const splittedText = text.split('\n');
  const linesWithoutEqu = Parser.replaceDirectives(splittedText.map(line => ({ content: line, breakpoint: false })), false).map(lineWithBreakpoint => lineWithBreakpoint.content);

  const labels = linesWithoutEqu.map(line => {
    if (labelRegex.exec(line)) {
      return new Label(labelRegex.exec(line).groups.label);
    }
    return null;
  }).filter(n => n);

  return linesWithoutEqu.map((line, i) => {
    let label: Label, content: LineContentType, macro: LightMacro;

    try {
      if (labelRegex.exec(line)) {
        label = labels.find(_label => _label.name === labelRegex.exec(line).groups.label);
      }

      if (pseudoInstructionRegex.test(line)) {
        content = new PseudoInstruction(line);
      } else if (instructionRegex.test(line)) {
        content = new Instruction(line, 0, false, labels);
      } else if (declarationRegex.test(line)) {
        content = new Declaration(line, labels);
      }

      if (content instanceof PseudoInstruction && content.op === 'MACRO') {
        macro = { name: content.name, opnd: content.opnd as Array<string> };
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
      const match = pseudoInstructionRegex.exec(line.rawLine);
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
    const expectedOperandsNumber = macros.find(macro => macro.name === instructionFromLine.mnemonic).opnd.length;
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

const noMisusedEqu = (text: Array<string>): Array<I8080MarkerData> => {
  const linesWithEqus = text.map((line, i) => ({ content: line, lineNumber: i })).filter(line => pseudoInstructionRegex.test(line.content)).map(line => ({ rawLine: line.content, pseudoInstruction: new PseudoInstruction(line.content), lineNumber: line.lineNumber })).filter(line => line.pseudoInstruction.op.toUpperCase() === 'EQU');
  const markerData: Array<I8080MarkerData> = [];
  const equs: Array<string> = [];
  for (const line of linesWithEqus) {
    const name = line.pseudoInstruction.name;
    if (equs.includes(name)) {
      const match = pseudoInstructionRegex.exec(line.rawLine);
      const [startColumn, endColumn] = getColumnIndeces(match.groups.name, line.rawLine);
      markerData.push({
        lineNumber: line.lineNumber,
        startColumn: startColumn,
        endColumn: endColumn,
        message: 'This equ name was already declared\nEqus can\'t be redeclared. Use SET pseudoinstruction instead'
      });
    }
    equs.push(name);
  }
  return markerData;
};

const noUnclosedMacro = (parsedText: Array<LineParsedForCheck>): Array<I8080MarkerData> => {
  const linesWithMacros = parsedText.filter(line => line.macro);
  const markerData: Array<I8080MarkerData> = [];
  linesWithMacros.forEach(lineWithMacro => {
    const nextMacro = linesWithMacros.filter(line => line.lineNumber > lineWithMacro.lineNumber)[0];
    const subMacroArray = nextMacro === undefined ? parsedText.slice(lineWithMacro.lineNumber) : parsedText.slice(lineWithMacro.lineNumber, nextMacro.lineNumber);
    const isClosed = subMacroArray.find(line => line.content instanceof PseudoInstruction && line.content.op === 'ENDM') !== undefined;
    if (!isClosed) {
      const match = pseudoInstructionRegex.exec(lineWithMacro.rawLine);
      const [startColumn, endColumn] = getColumnIndeces(match.groups.name, lineWithMacro.rawLine);
      markerData.push({
        lineNumber: lineWithMacro.lineNumber,
        startColumn: startColumn,
        endColumn: endColumn,
        message: 'This macro is unclosed. Close it with \'ENDM\' keyword'
      });
    }
  });
  return markerData;
};

const noOperandTypemismatch = (parsedText: Array<LineParsedForCheck>): Array<I8080MarkerData> => {
  const findExpectedOperandLength = (mnemonic: string): number => instructionList.find(instruction => instruction.mnemonic === mnemonic.toUpperCase()).operands.length;
  const macros = parsedText.filter(line => line.macro);
  const linesWithInstructions = parsedText.filter(line => line.content instanceof Instruction).filter(line => !macros.map(_line => _line.macro.name).includes((line.content as Instruction).mnemonic));
  const markerData: Array<I8080MarkerData> = [];
  for (const line of linesWithInstructions) {
    const match = instructionRegex.exec(line.rawLine);
    const [startColumn, endColumn] = getColumnIndeces(match.groups.operands, line.rawLine);
    const instructionFromLine = line.content as Instruction;
    const instructions: Array<IInstruction> = instructionList.filter(instruction => instruction.mnemonic === instructionFromLine.mnemonic.toUpperCase());
    const instructionsOperands = instructions.map(instruction => instruction.operands);
    const operandsLength = findExpectedOperandLength(instructionFromLine.mnemonic);
    const macroOperands = macros.length > 0 ? macros.filter(macro => macro.lineNumber < line.lineNumber).reverse()[0].macro.opnd : [];

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
        if (instructionFromLine.operands[i].intValue > 0xff && intersects(['n'], operands)) {
          markerData.push({
            lineNumber: line.lineNumber,
            startColumn: startColumn,
            endColumn: endColumn,
            message: `${instructionFromLine.mnemonic} does not expect an address or a 16 bit numerical value for the operand at position ${i + 1}`
          });
        }
        if (instructionFromLine.operands[i].intValue > 0xffff && intersects(['nn', 'a'], operands)) {
          markerData.push({
            lineNumber: line.lineNumber,
            startColumn: startColumn,
            endColumn: endColumn,
            message: `Operand at position ${i + 1} has a value greater than 0xFFFF which is not accepted here`
          });
        }
      } else if (!operands.includes(instructionFromLine.operands[i].value.toUpperCase()) && !macroOperands.includes(instructionFromLine.operands[i].value)) {
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
  const mnemonics = keywords.mnemonicKeywords;
  const macros = parsedText.filter(line => line.macro).map(line => line.macro.name);
  const pseudoInstructions = keywords.pseudoInstructionKeywords;
  const acceptedKeywords = [...mnemonics, ...macros, ...pseudoInstructions].map(keyword => keyword.toUpperCase());
  const linesWithInstructions = parsedText.filter(line => line.content instanceof Instruction);
  const markerData: Array<I8080MarkerData> = [];

  for (const line of linesWithInstructions) {
    const mnemonic = (line.content as Instruction).mnemonic.trim();
    if (!acceptedKeywords.includes(mnemonic.toUpperCase())) {
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
  const mnemonics = keywords.mnemonicKeywords;
  const markerData: Array<I8080MarkerData> = [];
  for (const lineWithMacro of linesWithMacros) {
    if (mnemonics.includes(lineWithMacro.macro.name.toUpperCase())) {
      const match = pseudoInstructionRegex.exec(lineWithMacro.rawLine);
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
      endColumn: value.split('\n')[error.lineNumber].length + 1,
      message: `Parse error: ${error.message}`
    })];
  }
  const markerDataToShow: Array<I8080MarkerData> = [];
  const checksBeforeParse: Array<CheckBeforeParse> = [noMisusedEqu];
  for (const check of checksBeforeParse) {
    try {
      const markerData = check(value.split('\n'));
      if (markerData.length > 0) {
        markerDataToShow.push(...markerData);
      }
    } catch (e) {
    // eslint-disable-next-line no-console
      console.error(e);
    }
  }
  const checks: Array<Check> = [noUnknownMnemonicsOrMacros, noLabelRedefinition, noMacroRedefinition, noInstructionOperandsNumberMismatch, noMacroOperandsNumberMismatch, noOperandTypemismatch, noUnclosedMacro, noMissingHlt, noInvalidMacroNames];
  for (const check of checks) {
    try {
      const markerData = check(parsedText);
      if (markerData.length > 0) {
        markerDataToShow.push(...markerData);
      }
    } catch (e) {
    // eslint-disable-next-line no-console
      console.error(e);
    }
  }
  return markerDataToShow.map(markerData => mapToMonacoMarkerData(markerData));
};
