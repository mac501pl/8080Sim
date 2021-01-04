export default class HexNum {
  private _intValue: number;

  public constructor(value?: number) {
    if (value > 0xff) {
      throw new Error('Value should not be greater than 0xff');
    }
    this._intValue = value ? value & 0xff : 0;
  }

  public static to16Bit(value = 0): [HexNum, HexNum] {
    if (value > 0xffff) {
      throw new Error('Value should not be greater than 0xffff');
    }
    return [new HexNum(value & 0xff), new HexNum(value >>> 0x8)];
  }

  public get intValue(): number {
    return this._intValue;
  }

  public set intValue(value: number) {
    this._intValue = value & 0xff;
  }

  public toHex(): string {
    return this._intValue.toString(16).toUpperCase().padStart(2, '0');
  }

  public toBin(): string {
    return this._intValue.toString(2).padStart(8, '0');
  }

  public toAscii(): string {
    if (this.intValue >= 32 && this.intValue <= 126) {
      return String.fromCharCode(this._intValue);
    } return '.';
  }
}
