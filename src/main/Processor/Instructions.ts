import FlagRegister, { FlagStructure } from './FlagRegister';
import HexNum from '../assembler/Types/HexNum';
import Register from './Register';

const parity = (value: number): boolean => value.toString(2).split('').filter(x => x === '1').length % 2 === 0;
const sign = (value: number): boolean => value >> 7 === 1;
const zero = (value: number): boolean => value === 0;
const auxiliaryCarry = (num1: number, num2: number): boolean => (((num1 & 0xf) + (num2 & 0xf)) & 0x10) === 0x10;

const toU2 = (value: number): number => (~value + 1);

interface ResultAndFlags { result: HexNum; flags: FlagStructure }

export const inr = (value: HexNum): ResultAndFlags => {
  const { result, flags: { auxiliaryCarry: AC, parity: P, sign: S, zero: Z } } = add(value, new HexNum(1));

  const flags: FlagStructure = {
    zero: Z,
    sign: S,
    parity: P,
    auxiliaryCarry: AC
  };
  return { result: result, flags: flags };
};

export const dcr = (value: HexNum): ResultAndFlags => {
  const { result, flags: { auxiliaryCarry: AC, parity: P, sign: S, zero: Z } } = sub(value, new HexNum(1));

  const flags: FlagStructure = {
    zero: Z,
    sign: S,
    parity: P,
    auxiliaryCarry: AC
  };
  return { result: result, flags: flags };
};

export const rlc = (value: HexNum): ResultAndFlags => {
  const result = new HexNum((value.intValue << 1 | value.intValue >> 7) & 0xff);
  const flags: FlagStructure = {
    carry: value.intValue >> 7 === 1
  };
  return { result: result, flags: flags };
};

export const rrc = (value: HexNum): ResultAndFlags => {
  const result = new HexNum((value.intValue >> 1 | (value.intValue & 1) << 7) & 0xff);
  const flags: FlagStructure = {
    carry: (value.intValue & 1) === 1
  };
  return { result: result, flags: flags };
};

export const ral = (value: HexNum, carry: boolean): ResultAndFlags => {
  const result = new HexNum((value.intValue << 1 | Number(carry)) & 0xff);
  const flags: FlagStructure = {
    carry: (value.intValue >> 7) === 1
  };
  return { result: result, flags: flags };
};

export const rar = (value: HexNum, carry: boolean): ResultAndFlags => {
  const result = new HexNum((value.intValue >> 1 | Number(carry) << 7) & 0xff);
  const flags: FlagStructure = {
    carry: (value.intValue & 1) === 1
  };
  return { result: result, flags: flags };
};

export const add = (num1: HexNum, num2: HexNum): ResultAndFlags => adc(num1, num2, false);

export const adc = (num1: HexNum, num2: HexNum, carry: boolean): ResultAndFlags => {
  const added = num1.intValue + num2.intValue + Number(carry);
  const addedAndTrimmed = added & 0xff;
  const result = new HexNum(addedAndTrimmed);

  const flags: FlagStructure = {
    zero: zero(addedAndTrimmed),
    sign: sign(addedAndTrimmed),
    parity: parity(addedAndTrimmed),
    carry: added > 0xff,
    auxiliaryCarry: auxiliaryCarry(num1.intValue, num2.intValue + Number(carry))
  };
  return { result: result, flags: flags };
};

export const sub = (num1: HexNum, num2: HexNum): ResultAndFlags => sbb(num1, num2, false);

export const sbb = (num1: HexNum, num2: HexNum, carry: boolean): ResultAndFlags => {
  const num2U2 = toU2(num2.intValue + Number(carry));
  const subbed = num1.intValue + num2U2;
  const subbedAndTrimmed = subbed & 0xff;
  const result = new HexNum(subbedAndTrimmed);

  const flags: FlagStructure = {
    zero: zero(subbedAndTrimmed),
    sign: sign(subbedAndTrimmed),
    parity: parity(subbedAndTrimmed),
    carry: !((num1.intValue + (num2U2 & 0xff)) > 0xff),
    auxiliaryCarry: auxiliaryCarry(num1.intValue, num2U2)
  };
  return { result: result, flags: flags };
};

export const ana = (num1: HexNum, num2: HexNum): ResultAndFlags => {
  const anded = num1.intValue & num2.intValue;
  const result = new HexNum(anded);

  const flags: FlagStructure = {
    zero: zero(anded),
    sign: sign(anded),
    parity: parity(anded),
    carry: false
  };
  return { result: result, flags: flags };
};

export const xra = (num1: HexNum, num2: HexNum): ResultAndFlags => {
  const xored = num1.intValue ^ num2.intValue;
  const result = new HexNum(xored);

  const flags: FlagStructure = {
    zero: zero(xored),
    sign: sign(xored),
    parity: parity(xored),
    carry: false,
    auxiliaryCarry: false
  };
  return { result: result, flags: flags };
};

export const ora = (num1: HexNum, num2: HexNum): ResultAndFlags => {
  const ored = num1.intValue | num2.intValue;
  const result = new HexNum(ored);

  const flags: FlagStructure = {
    zero: zero(ored),
    sign: sign(ored),
    parity: parity(ored),
    carry: false
  };
  return { result: result, flags: flags };
};

export const cmp = (num1: HexNum, num2: HexNum): FlagStructure => {
  const { flags } = sbb(num1, num2, false);
  return flags;
};

export const dad = (num1: number, num2: number): { result: number; flags: FlagStructure } => {
  const result = num1 + num2;
  const flags: FlagStructure = {
    carry: (((num1 + num2) >> 16) & 1) === 1
  };

  return { result: result, flags: flags };
};

export const daa = (regA: Register, flagRegister: FlagRegister): ResultAndFlags => {
  const accumulatorValue = regA.content;
  const binaryRepresentation = accumulatorValue.toBin();

  const leastSignificantBits = parseInt(binaryRepresentation.substring(4, 8), 2);
  let newAc = false;
  let newCy = false;

  if (leastSignificantBits > 9 || flagRegister.getAC()) {
    accumulatorValue.intValue += 6;
    newAc = leastSignificantBits + 6 > 0xf;
  }

  const newBinaryRepresentation = accumulatorValue.toBin();
  let mostSignificantBits = parseInt(newBinaryRepresentation.substring(0, 4), 2);
  if (mostSignificantBits > 9 || flagRegister.getCarry()) {
    mostSignificantBits += 6;
    newCy = mostSignificantBits > 0xf;
  }

  const newAccumulatorValue = (accumulatorValue.intValue & 0xf) + (mostSignificantBits << 4);
  const result = new HexNum(newAccumulatorValue & 0xff);
  const flags: FlagStructure = {
    auxiliaryCarry: newAc,
    carry: newCy,
    zero: zero(result.intValue),
    sign: sign(result.intValue),
    parity: parity(result.intValue)
  };
  return { result: result, flags: flags };
};
