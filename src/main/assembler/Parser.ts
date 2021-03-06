import { findInstructionSize, intersects } from '@utils/Utils';
import { labelRegex, instructionRegex, declarationRegex, commentRegex, hexNumberRegex, binNumberRegex, decNumberRegex, octNumberRegex, literalRegex, pseudoInstructionRegex } from '@utils/Regex';
import Instruction from './Types/Instruction';
import Declaration from './Types/Declaration';
import { all, create } from 'mathjs';
import { PrettyPrintable } from '@/renderer/EditorConfiguration/editor.documentFormattingProvider';
import PseudoInstruction from './Types/PseudoInstruction';
import { ParseError } from '@renderer/EditorConfiguration/editor.model.markers';
import instructionList from '../instruction_list';

const strictHexRegex = new RegExp(`^${hexNumberRegex.source}$`, 'i');
const strictBinRegex = new RegExp(`^${binNumberRegex.source}$`, 'i');
const strictDecRegex = new RegExp(`^${decNumberRegex.source}$`, 'i');
const strictOctRegex = new RegExp(`^${octNumberRegex.source}$`, 'i');
const DOLLAR_OPERATOR = /\B\$\B(?=([^']*'[^']*')*[^']*$)/ig;

export class Macro {
  public readonly name: string;
  public readonly opnd: Array<string>;
  public readonly lines: Array<LineWithBreakpoint>;
  public readonly removeIndexes: { beginning: number; length: number };

  public constructor(name: string, opnd: Array<string>, lines: Array<LineWithBreakpoint>, removeIndexes: { beginning: number; length: number }) {
    this.name = name;
    this.opnd = opnd;
    this.lines = lines;
    this.removeIndexes = removeIndexes;
  }
}

export class Label implements PrettyPrintable {
  public readonly name: string;
  public readonly address: number;

  public constructor(name: string, value = 0) {
    this.name = name;
    this.address = value;
  }

  public prettyPrint(): string {
    return `${this.name.trim()}:\n`;
  }
}

export type LineContentType = Instruction | Declaration | PseudoInstruction;
interface LineWithAddress { content: LineWithBreakpoint; address: number }

export interface ParsedLine {
  lineNumber: number;
  label?: Label;
  content: LineContentType;
}

export interface LineWithBreakpoint {
  content: string;
  breakpoint: boolean;
}

export default class Parser {
  public parse(text: string, breakpoints: Array<number>): Array<ParsedLine> {
    const splittedText = text.split('\n');
    const linesWithoutComments = splittedText.map(line => line.replace(commentRegex, ''));
    const trimmedLines = linesWithoutComments.map(line => line.trim());
    const linesWithBreakpoints = this.applyBreakpointsToLines(trimmedLines, breakpoints);
    const nonEmptyLines = linesWithBreakpoints.filter(line => line.content);
    const linesWithoutEqu = Parser.replaceDirectives(nonEmptyLines);
    const linesWithoutMacros = this.removeMacros(linesWithoutEqu);
    const linesWithAddresses = this.assignAddressesToLines(linesWithoutMacros);

    const labels = this.getLabels(linesWithAddresses);
    const linesWithoutVariables = Parser.replaceVariables(linesWithAddresses, labels);

    return linesWithoutVariables.map((line, i) => {
      let label: Label, content: LineContentType;
      const lineContent = line.content.content;
      const address = line.address;

      if (labelRegex.test(lineContent)) {
        label = labels.find(_label => _label.name === labelRegex.exec(lineContent).groups.label);
      }

      if (pseudoInstructionRegex.test(lineContent)) {
        content = new PseudoInstruction(lineContent, address);
      } else if (instructionRegex.test(lineContent)) {
        content = new Instruction(lineContent, address, line.content.breakpoint, labels);
      } else if (declarationRegex.test(lineContent)) {
        content = new Declaration(lineContent, labels, address);
      }
      return { lineNumber: i, label: label, content: content };
    }).filter(parsedLine => parsedLine.content || parsedLine.label);
  }

  public static replaceDirectives(lines: Array<LineWithBreakpoint>, removeEquLines = true): Array<LineWithBreakpoint> {
    interface EqData {replacerString: string, stringToBeReplaced: string, replacerRegex: RegExp}
    const currentReplacers: Array<EqData> = [];
    const spliceIndeces: Array<number> = [];
    const replacedLines = lines.map((line, i) => {
      for (const replacer of currentReplacers) {
        if (replacer.replacerRegex.test(line.content)) {
          const toReplace = new RegExp(`(\\b${replacer.stringToBeReplaced}\\b)(?=(?:(?:[^']*'){2})*[^']*$)`, 'g');
          // eslint-disable-next-line
          line.content = (line.content as any).replaceAll(toReplace, replacer.replacerString) as string;
        }
      }
      if (pseudoInstructionRegex.test(line.content)) {
        let pseudoInstruction;
        try {
          pseudoInstruction = new PseudoInstruction(line.content);
        } catch (error) {
          return line;
        }
        if (['EQU', 'SET'].includes(pseudoInstruction.op)) {
          const { name: stringToBeReplaced, opnd: replacerString } = pseudoInstructionRegex.exec(line.content).groups;
          const replacerRegex = new RegExp(`(?<toReplace>\\b${stringToBeReplaced}\\b)(?=(?:(?:[^']*'){2})*[^']*$)(?!(\\s*(:|\\b[eE][qQ][uU]|[sS][eE][tT]\\b)))`);
          if (pseudoInstruction.op === 'SET' && currentReplacers.find(replacer => replacer.stringToBeReplaced === stringToBeReplaced)) {
            const index = currentReplacers.findIndex(replacer => replacer.stringToBeReplaced === stringToBeReplaced);
            currentReplacers[index] = { replacerString: replacerString, stringToBeReplaced: stringToBeReplaced, replacerRegex: replacerRegex };
          } else {
            currentReplacers.push({ replacerString: replacerString, stringToBeReplaced: stringToBeReplaced, replacerRegex: replacerRegex });
          }
          spliceIndeces.push(i);
        }
      }
      return line;
    });
    if (removeEquLines) {
      spliceIndeces.reverse().forEach(index => {
        replacedLines.splice(index, 1);
      });
    }
    return replacedLines;
  }

  private removeMacros(lines: Array<LineWithBreakpoint>): Array<LineWithBreakpoint> {
    const macros: Array<Macro> = lines
      .map((line, i) => {
        const { content } = line;
        if (pseudoInstructionRegex.test(content)) {
          const { op, name, opnd } = new PseudoInstruction(content);
          if (op === 'MACRO') {
            const macroLength = lines.slice(i).findIndex(str => {
              if (pseudoInstructionRegex.test(str.content)) {
                const { op: _op } = new PseudoInstruction(str.content);
                if (_op === 'ENDM') {
                  return true;
                }
              }
              return false;
            });
            const removeIndexes = { beginning: i, length: macroLength + 1 };
            const macroLines = lines.slice(i + 1, i + macroLength);
            return new Macro(name, opnd as Array<string>, macroLines, removeIndexes);
          }
        }
        return null;
      })
      .filter(n => n);

    if (macros.length === 0) {
      return lines;
    }

    macros.map(macro => macro.removeIndexes).reverse().forEach(indexPair => {
      lines.splice(indexPair.beginning, indexPair.length);
    });
    const macroRegex = new RegExp(`^\\s*(?<name>${macros.map(macro => `\\b${macro.name}\\b`).join('|')})\\s*(?<args>.*?)(;(?=(?:(?:[^']*'){2})*[^']*$)\\s*(.*))?$`);

    return lines
      .map(line => {
        const { content } = line;
        if (macroRegex.exec(content)) {
          const { name, args } = macroRegex.exec(content).groups;
          const macro = macros.find(_macro => _macro.name === name);
          const operands = args.split(',').map(arg => arg.trim());
          return macro.lines.map(macroLine => {
            let replacedContent = macroLine.content;
            macro.opnd.forEach((operand, i) => {
              // eslint-disable-next-line
              replacedContent = (replacedContent as any).replaceAll(new RegExp(`\\b${operand}\\b`, 'g'), operands[i]);
            });
            return {
              content: replacedContent,
              breakpoint: macroLine.breakpoint
            };
          });
        }
        return line;
      })
      .flat();
  }

  public static replaceDollar(line: string, address: number): string {
    // eslint-disable-next-line
    return (line as any).replaceAll(DOLLAR_OPERATOR, address);
  }

  private assignAddressesToLines(lines: Array<LineWithBreakpoint>): Array<LineWithAddress> {
    let address = 0;
    return lines.map(line => {
      const content = line.content;
      const lineWithAddress: LineWithAddress = { content: line, address: address };
      if (pseudoInstructionRegex.test(content)) {
        const pseudoInstruction = new PseudoInstruction(content, address);
        if (pseudoInstruction.op === 'ORG') {
          address = Number(pseudoInstruction.opnd);
        }
      } else if (instructionRegex.test(content)) {
        address += findInstructionSize(instructionRegex.exec(content).groups.mnemonic);
      } else if (declarationRegex.test(content)) {
        address += new Declaration(content).list.length;
      }
      return lineWithAddress;
    });
  }

  private getLabels(lines: Array<LineWithAddress>): Array<Label> {
    return lines
      .map(line => {
        const lineContent = line.content.content;
        if (labelRegex.test(lineContent)) {
          return new Label(labelRegex.exec(lineContent).groups.label, line.address);
        }
        return null;
      }).filter(n => n);
  }

  public static replaceVariables(lines: Array<LineWithAddress>, labels: Array<Label>): Array<LineWithAddress> {
    lines.forEach(({ content: { content }, address }) => {
      if (declarationRegex.test(content)) {
        let declaration;
        try {
          declaration = new Declaration(content, labels, address);
        } catch (e) {
          declaration = {};
        }
        const { variable, list } = declaration;
        if (variable) {
          const regex = new RegExp(`\\b(?<name>${variable})\\b(\\[(?<index>\\d+)\\])?(?=([^']*'[^']*')*[^']*$)(?!(\\s*(:|\\bD[BWS]\\b)))`, 'gi');
          lines.forEach((line, i) => {
            if (instructionRegex.test(line.content.content)) {
              line.content.content = line.content.content.replace(regex, match => {
                const index = (/\[\d+\]/).test(match) ? Number((/\[(?<index>\d+)\]/).exec(match).groups.index) : 0;
                let shouldUse2Bits;
                try {
                  shouldUse2Bits = intersects(instructionList.find(({ mnemonic }) => mnemonic === instructionRegex.exec(line.content.content).groups.mnemonic.trim().toUpperCase())?.operands, ['nn', 'a']);
                } catch (_e) {
                  shouldUse2Bits = false;
                }
                if (index + Number(shouldUse2Bits) > list.length - 1) {
                  throw new ParseError(i, 'Variable index out of bounds');
                }
                return shouldUse2Bits ? (list[index + 1].intValue << 8 | list[index].intValue).toString() : list[index].intValue.toString();
              });
            }
          });
        }
      }
    });
    return lines;
  }

  private applyBreakpointsToLines(splittedText: Array<string>, breakpoints: Array<number>): Array<LineWithBreakpoint> {
    return splittedText.map((line, i) => ({ content: line, breakpoint: breakpoints.includes(i + 1) }));
  }
}

export const parseToInt = (numberToParse: string): number => {
  if (strictHexRegex.test(numberToParse)) {
    return parseInt(numberToParse.replace(/H/i, ''), 16);
  } else if (strictDecRegex.test(numberToParse)) {
    return parseInt(numberToParse.replace(/D/i, ''), 10);
  } else if (strictBinRegex.test(numberToParse)) {
    return parseInt(numberToParse.replace(/B/i, ''), 2);
  } else if (strictOctRegex.test(numberToParse)) {
    return parseInt(numberToParse.replace(/[OQ]/ig, ''), 8);
  }
  throw new Error(`Cannot parse to int: ${numberToParse}`);
};

export const parseExpression = (expression: string): number => {
  const math = create(all, {});
  const divide = (a: number, b: number): number => Math.floor(a / b);
  math.import({ divide: divide }, { override: true });

  try {
    const result = Number(math.evaluate(expression
      .replace(literalRegex, match => match.charCodeAt(1).toString()) // order of replacements matters! (1bh - could be treated as binary because of 1b satisfies binary regex)
      .replace(hexNumberRegex, match => parseInt(match.replace(/H/ig, ''), 16).toString())
      .replace(binNumberRegex, match => parseInt(match.replace(/B/ig, ''), 2).toString())
      .replace(octNumberRegex, match => parseInt(match.replace(/[OQ]/ig, ''), 8).toString())
      .replace(decNumberRegex, match => parseInt(match.replace(/D/ig, ''), 10).toString())
      .replace(/MOD/gi, '%')
      .replace(/NOT/gi, '~')
      .replace(/AND/gi, '&')
      .replace(/XOR/gi, '^|')
      .replace(/OR/gi, '|')
      .replace(/SHR/gi, '>>')
      .replace(/SHL/gi, '<<')
      .toLowerCase()
    ));
    if (isNaN(result)) {
      return null;
    }
    return result;
  } catch (e) {
    return null;
  }
};
