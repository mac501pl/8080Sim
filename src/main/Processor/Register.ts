import HexNum from '../assembler/Types/HexNum';

export default class Register {
  public content: HexNum;

  public constructor(private readonly name: string) {
    this.content = new HexNum();
    this.name = name;
  }

  public toString(): string {
    return `Register ${ this.name }, value: ${ this.content.toHex() }`;
  }
}
