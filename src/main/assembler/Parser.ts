import { findInstructionSize } from '@utils/Utils';
import { labelRegex, instructionRegex, declarationRegex, beginMacroRegex, endMacroRegex, commentRegex, variableRegex, hexNumberRegex, binNumberRegex, decNumberRegex, octNumberRegex } from '@utils/Regex';
import Instruction from './Types/Instruction';
import Declaration from './Types/Declaration';
import { all, create } from 'mathjs';
import { PrettyPrintable } from '@/renderer/EditorConfiguration/editor.documentFormattingProvider';

const strictHexRegex = new RegExp(`^${hexNumberRegex.source}$`, 'i');
const strictBinRegex = new RegExp(`^${binNumberRegex.source}$`, 'i');
const strictDecRegex = new RegExp(`^${decNumberRegex.source}$`, 'i');
const strictOctRegex = new RegExp(`^${octNumberRegex.source}$`, 'i');

export class Macro {
  public readonly name: string;
  public readonly paramsNumber: number;
  public readonly lines: Array<LineWithBreakpoint>;
  public readonly removeIndexes: { beginning: number; length: number };

  public constructor(name: string, paramsNumber: number, lines: Array<LineWithBreakpoint>, removeIndexes: { beginning: number; length: number }) {
    this.name = name;
    this.paramsNumber = paramsNumber;
    this.lines = lines;
    this.removeIndexes = removeIndexes;
  }
}

export class Label implements PrettyPrintable {
  public readonly name: string;
  public readonly value: number;

  public constructor(name: string, value = 0) {
    this.name = name;
    this.value = value;
  }

  public prettyPrint(): string {
    return `${this.name.trim()}:\n`;
  }
}

export interface ParsedLine {
  lineNumber: number;
  label?: Label;
  content: Instruction | Declaration;
}

export interface LineWithBreakpoint {
  content: string;
  breakpoint: boolean;
}

export default class Parser {
  public parse(text: string, breakpoints: Array<number>): Array<ParsedLine> {
    const splittedText = text.split('\n');
    const linesWithBreakpoints = this.applyBreakpointsToLines(splittedText, breakpoints);
    const linesWithoutComments = linesWithBreakpoints.map(line => this.removeComment(line));
    const trimmedLines = linesWithoutComments.filter(line => line.content.trim() !== '');
    const linesWithoutMacros = this.removeMacros(trimmedLines);

    const labels = Parser.getLabels(linesWithoutMacros.map(line => line.content));
    let address = 0;
    return linesWithoutMacros.map((line, i) => {
      let label: Label, content: Declaration | Instruction;

      if (labelRegex.exec(line.content)) {
        label = labels.find(_label => _label.name === labelRegex.exec(line.content).groups.label);
      }

      if (instructionRegex.exec(line.content)) {
        content = new Instruction(line.content, address, line.breakpoint, labels);
        address += findInstructionSize(content.mnemonic);
      }

      if (declarationRegex.exec(line.content)) {
        content = new Declaration(line.content, labels);
        address += content.list.length;
      }
      return { lineNumber: i, label: label, content: content };
    }).filter(parsedLine => parsedLine.content || parsedLine.label);
  }

  private removeComment(line: LineWithBreakpoint): LineWithBreakpoint {
    return { content: line.content.replace(commentRegex, ''), breakpoint: line.breakpoint };
  }

  private removeMacros(lines: Array<LineWithBreakpoint>): Array<LineWithBreakpoint> {
    const macros: Array<Macro> = lines
      .map((line, i) => {
        const { content } = line;
        if (beginMacroRegex.exec(content)) {
          const { name, paramsNumber } = beginMacroRegex.exec(content).groups;
          const macroLength = lines.slice(i).findIndex(str => endMacroRegex.exec(str.content));
          const removeIndexes = { beginning: i, length: macroLength + 1 };
          const macroLines = lines.slice(i + 1, i + macroLength);
          return new Macro(name, parseInt(paramsNumber, 10), macroLines, removeIndexes);
        }
        return null;
      })
      .filter(n => n);

    if (macros.length === 0) {
      return lines;
    }

    macros
      .map(macro => macro.removeIndexes)
      .reverse()
      .forEach(indexPair => {
        lines.splice(indexPair.beginning, indexPair.length);
      });
    const macroRegex = new RegExp(`^\\s*(?<name>${macros.map(macro => macro.name).join('|')})\\s+(?<args>(\\w)+(\\s*,\\s*\\w+)*)`);

    return lines
      .map(line => {
        const { content } = line;
        if (macroRegex.exec(content)) {
          const { name, args } = macroRegex.exec(content).groups;
          const macro = macros.find(_macro => _macro.name === name);
          const operands = args.split(',').map(arg => arg.trim());
          return macro.lines.map(macroLine => ({
            breakpoint: macroLine.breakpoint,
            content: variableRegex.exec(macroLine.content) ? macroLine.content.replace(variableRegex, operands[Number(variableRegex.exec(macroLine.content).groups.number) - 1]) : macroLine.content
          }));
        }
        return line;
      })
      .flat();
  }

  public static getLabels(lines: Array<string>): Array<Label> {
    let labelOffset = 0;
    return lines
      .map(line => {
        let label = null;
        if (labelRegex.exec(line)) {
          label = new Label(labelRegex.exec(line).groups.label, labelOffset);
        }
        if (instructionRegex.exec(line)) {
          labelOffset += findInstructionSize(instructionRegex.exec(line).groups.mnemonic);
        }
        if (declarationRegex.exec(line)) {
          labelOffset += new Declaration(line).list.length;
        }
        return label;
      }).filter(n => n);
  }

  private applyBreakpointsToLines(splittedText: Array<string>, breakpoints: Array<number>): Array<LineWithBreakpoint> {
    return splittedText.map((line, i) => ({ content: line, breakpoint: breakpoints.includes(i) }));
  }
}

export const parseToInt = (numberToParse: string): number => {
  if (strictHexRegex.exec(numberToParse)) {
    return parseInt(numberToParse.replace(/H/i, ''), 16);
  } else if (strictDecRegex.exec(numberToParse)) {
    return parseInt(numberToParse, 10);
  } else if (strictBinRegex.exec(numberToParse)) {
    return parseInt(numberToParse.replace(/B/i, ''), 2);
  } else if (strictOctRegex.exec(numberToParse)) {
    return parseInt(numberToParse.replace(/O/ig, ''), 8);
  }
  throw new Error(`Cannot parse to int: ${numberToParse}`);
};

export const parseExpression = (expression: string): number => {
  const math = create(all, {});
  const divide = (a: number, b: number): number => Math.floor(a / b);
  math.import({ divide: divide }, { override: true });

  return Number(math.evaluate(expression
    .replace(binNumberRegex, match => parseInt(match.replace(/B/ig, ''), 2).toString())
    .replace(hexNumberRegex, match => parseInt(match.replace(/H/ig, ''), 16).toString())
    .replace(octNumberRegex, match => parseInt(match.replace(/O/ig, ''), 8).toString())
    .replace(/MOD/gi, '%')
    .replace(/NOT/gi, '~')
    .replace(/AND/gi, '&')
    .replace(/OR/gi, '|')
    .replace(/XOR/gi, '^|')
    .replace(/SHR/gi, '>>')
    .replace(/SHL/gi, '<<')
    .toLowerCase()
  ));
};
