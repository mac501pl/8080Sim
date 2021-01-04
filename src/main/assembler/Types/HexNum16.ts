export default class HexNum16 {
  private _intValue: number;

  public constructor(value?: number) {
    if (value > 0xffff) {
      throw new Error('Value should not be greater than 0xffff');
    }
    this._intValue = value ? value & 0xffff : 0;
  }

  public get intValue(): number {
    return this._intValue & 0xffff;
  }

  public set intValue(value: number) {
    this._intValue = value & 0xffff;
  }

  public toHex(): string {
    return this._intValue.toString(16).toUpperCase().padStart(4, '0');
  }

  public toBin(): string {
    return this._intValue.toString(2).padStart(16, '0');
  }
}
