import { prettifyDeclaration, PrettyPrintable } from '@/renderer/EditorConfiguration/editor.documentFormattingProvider';
import { commaSeparatorRegex, declarationRegex, expressionRegex, strictNumber, textRegex } from '@utils/Regex';
import { Label, parseExpression, parseToInt } from '../Parser';
import HexNum from './HexNum';

type DeclarationTypes = 'DB' | 'DW' | 'DS';

export default class Declaration implements PrettyPrintable {
  public readonly type: DeclarationTypes;
  public readonly list: Array<HexNum>;
  public readonly line: string;

  public constructor(line: string, labels = [] as Array<Label>) {
    const { type, arg } = declarationRegex.exec(line).groups;

    this.type = type as DeclarationTypes;
    this.list = this.parseArguments(arg, labels);
    this.line = line;
  }

  private splitAndTrimArguments(arg: string): Array<string> {
    return arg.split(commaSeparatorRegex).map(value => value.trim());
  }

  private parseArguments(arg: string, labels: Array<Label>): Array<HexNum> {
    switch (this.type.toUpperCase()) {
    case 'DB':
      return this.splitAndTrimArguments(arg).map(value => this.parse8Bit(value)).flat();
    case 'DW':
      return this.splitAndTrimArguments(arg).map(value => this.parse16Bit(value, labels)).flat(2);
    case 'DS':
      return this.defineStorage(arg.trim());
    default:
      throw new Error(`Invalid declaration type: ${this.type}`);
    }
  }

  private defineStorage(arg: string): Array<HexNum> {
    if (strictNumber.exec(arg)) {
      const value = parseToInt(arg);
      return new Array<HexNum>(value).fill(new HexNum());
    } else if (expressionRegex.exec(arg)) {
      const value = parseExpression(arg);
      return new Array<HexNum>(value).fill(new HexNum());
    }
    throw new Error(`Invalid DS argument: ${arg}\nDS expects an arithmetical or logical expression`);
  }

  private mapStringTo8BitHexNum(str: string): Array<HexNum> {
    return str.replace(/^'(.*)'$/, '$1').split('').map(letter => new HexNum(letter.charCodeAt(0)));
  }

  private parse8Bit(value: string): Array<HexNum> | HexNum {
    if (strictNumber.exec(value)) {
      return new HexNum(parseToInt(value));
    } else if (textRegex.exec(value)) {
      return this.mapStringTo8BitHexNum(value);
    } else if (expressionRegex.exec(value)) {
      return new HexNum(parseExpression(value));
    }
    throw new Error(`Invalid 8 bit declaration argument: ${value}`);
  }

  private mapStringTo16BitHexNum(str: string): Array<[HexNum, HexNum]> {
    return str.replace(/^'(.*)'$/, '$1').split('').map(letter => HexNum.to16Bit(letter.charCodeAt(0)));
  }

  private isIncludedInLabelList(value: string, labels: Array<Label>): boolean {
    return labels.map(label => label.name.toLowerCase()).includes(value.toLowerCase());
  }

  private parse16Bit(value: string, labels: Array<Label>): Array<[HexNum, HexNum]> | [HexNum, HexNum] {
    if (strictNumber.exec(value)) {
      return HexNum.to16Bit(parseToInt(value));
    } else if (textRegex.exec(value)) {
      return this.mapStringTo16BitHexNum(value);
    } else if (expressionRegex.exec(value)) {
      return HexNum.to16Bit(parseExpression(value));
    } else if (this.isIncludedInLabelList(value, labels)) {
      const label = labels.find(_label => _label.name.toLowerCase() === value.toLowerCase());
      return HexNum.to16Bit(label.value);
    }
    return HexNum.to16Bit();
  }

  public prettyPrint(): string {
    return prettifyDeclaration(this.line);
  }
}
