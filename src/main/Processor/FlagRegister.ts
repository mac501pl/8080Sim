import Register from './Register';

interface RegisterDetails {
  name: string;
  shortName: string;
  value: boolean;
}

export interface FlagStructure {
  sign?: boolean;
  zero?: boolean;
  parity?: boolean;
  carry?: boolean;
  auxiliaryCarry?: boolean;
}


export default class FlagRegister extends Register {
  public setFlags(flags: FlagStructure): void {
    const structure: Array<boolean | undefined> = [flags.sign, flags.zero, false, flags.auxiliaryCarry, false, flags.parity, true, flags.carry];
    for (let mask = 0b10000000, index = 0; mask > 0; mask >>= 1, index++) {
      const flag = structure[index];
      if (flag !== undefined) {
        this.content.intValue = flag ? this.content.intValue | mask : this.content.intValue & ~mask;
      }
    }
  }

  public getContents(): { sign: RegisterDetails; zero: RegisterDetails; auxiliaryCarry: RegisterDetails; parity: RegisterDetails; carry: RegisterDetails; } {
    return {
      sign: {
        name: 'Sign',
        shortName: 'S',
        value: this.getSign()
      },
      zero: {
        name: 'Zero',
        shortName: 'Z',
        value: this.getZero()
      },
      auxiliaryCarry: {
        name: 'Auxiliary carry',
        shortName: 'AC',
        value: this.getAC()
      },
      parity: {
        name: 'Parity',
        shortName: 'P',
        value: this.getParity()
      },
      carry: {
        name: 'Carry',
        shortName: 'C',
        value: this.getCarry()
      }
    };
  }

  public getSign(): boolean {
    return (this.content.intValue & 0b10000000) !== 0;
  }

  public getZero(): boolean {
    return (this.content.intValue & 0b01000000) !== 0;
  }

  public getAC(): boolean {
    return (this.content.intValue & 0b00010000) !== 0;
  }

  public getParity(): boolean {
    return (this.content.intValue & 0b00000100) !== 0;
  }

  public getCarry(): boolean {
    return (this.content.intValue & 0b00000001) !== 0;
  }
}
