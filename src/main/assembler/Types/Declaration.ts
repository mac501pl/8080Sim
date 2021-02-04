import { prettifyDeclaration, PrettyPrintable } from '@/renderer/EditorConfiguration/editor.documentFormattingProvider';
import { commaSeparatorRegex, declarationRegex, strictNumber, textRegex } from '@utils/Regex';
import Parser, { Label, parseExpression, parseToInt } from '@main/assembler/Parser';
import HexNum from './HexNum';

type DeclarationTypes = 'DB' | 'DW' | 'DS';

export default class Declaration implements PrettyPrintable {
  public readonly type: DeclarationTypes;
  public readonly list: Array<HexNum>;
  public readonly line: string;
  public readonly address: number;
  public readonly variable?: string;

  public constructor(line: string, labels = [] as Array<Label>, address = 0) {
    const { variable, type, arg } = declarationRegex.exec(line).groups;
    this.address = address;
    this.type = type as DeclarationTypes;
    this.list = this.parseArguments(arg, labels);
    this.line = line;
    this.variable = variable?.trim();
  }

  private splitAndTrimArguments(arg: string): Array<string> {
    return arg.split(commaSeparatorRegex).map(value => value.trim());
  }

  private prepareArgument(arg: string): Array<string> {
    return this.splitAndTrimArguments(arg).map(_arg => Parser.replaceDollar(_arg, this.address));
  }

  private parseArguments(arg: string, labels: Array<Label>): Array<HexNum> {
    switch (this.type.toUpperCase()) {
    case 'DB':
      return this.prepareArgument(arg).map(value => this.parse8Bit(value)).flat();
    case 'DW':
      return this.prepareArgument(arg).map(value => this.parse16Bit(value, labels)).flat(2);
    case 'DS':
      return this.defineStorage(Parser.replaceDollar(arg.trim(), this.address));
    default:
      throw new Error(`Invalid declaration type: ${this.type}`);
    }
  }

  private defineStorage(arg: string): Array<HexNum> {
    if (strictNumber.exec(arg)) {
      const value = parseToInt(arg);
      return new Array<HexNum>(value).fill(new HexNum());
    } else if (parseExpression(arg) !== null) {
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
    } else if (parseExpression(value) !== null) {
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
    } else if (parseExpression(value) !== null) {
      return HexNum.to16Bit(parseExpression(value));
    } else if (this.isIncludedInLabelList(value, labels)) {
      const label = labels.find(_label => _label.name.toLowerCase() === value.toLowerCase());
      return HexNum.to16Bit(label.address);
    }
    return HexNum.to16Bit();
  }

  public prettyPrint(): string {
    return prettifyDeclaration(this.line);
  }
}
