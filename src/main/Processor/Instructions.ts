import FlagRegister, { FlagStructure } from './FlagRegister';
import HexNum from '../assembler/Types/HexNum';
import Register from './Register';

const parity = (value: HexNum): boolean => value.toBin().split('').filter(x => x === '1').length % 2 === 0;
const sign = (value: HexNum): boolean => value.intValue >> 7 === 1;
const zero = (value: HexNum): boolean => value.intValue === 0;

export const inr = (value: HexNum): { result: HexNum; flags: FlagStructure } => {
  const result = new HexNum(value.intValue + 1);
  const flags: FlagStructure = {
    zero: zero(result),
    sign: sign(result),
    parity: parity(result),
    auxiliaryCarry: (result.intValue & 0xF) === 0
  };
  return { result: result, flags: flags };
};

export const dcr = (value: HexNum): { result: HexNum; flags: FlagStructure } => {
  const result = new HexNum(value.intValue - 1);
  const flags: FlagStructure = {
    zero: zero(result),
    sign: sign(result),
    parity: parity(result),
    auxiliaryCarry: !((result.intValue & 0xF) === 0xF)
  };
  return { result: result, flags: flags };
};

export const rlc = (value: HexNum): { result: HexNum; flags: FlagStructure } => {
  const result = new HexNum(value.intValue << 1 | value.intValue >> 7);
  const flags: FlagStructure = {
    carry: value.intValue >> 7 === 1
  };
  return { result: result, flags: flags };
};

export const rrc = (value: HexNum): { result: HexNum; flags: FlagStructure } => {
  const result = new HexNum(value.intValue >> 1 | (value.intValue & 1) << 7);
  const flags: FlagStructure = {
    carry: (value.intValue & 1) === 1
  };
  return { result: result, flags: flags };
};

export const ral = (value: HexNum, carry: boolean): { result: HexNum; flags: FlagStructure } => {
  const result = new HexNum(value.intValue << 1 | Number(carry));
  const flags: FlagStructure = {
    carry: (value.intValue >> 7) === 1
  };
  return { result: result, flags: flags };
};

export const rar = (value: HexNum, carry: boolean): { result: HexNum; flags: FlagStructure } => {
  const result = new HexNum(value.intValue >> 1 | Number(carry) << 7);
  const flags: FlagStructure = {
    carry: (value.intValue & 1) === 1
  };
  return { result: result, flags: flags };
};

export const add = (num1: HexNum, num2: HexNum): { result: HexNum; flags: FlagStructure } => {
  const added = num1.intValue + num2.intValue;
  const result = new HexNum(added);

  const flags: FlagStructure = {
    zero: zero(result),
    sign: sign(result),
    parity: parity(result),
    carry: added > 0xff,
    auxiliaryCarry: (((num1.intValue & 0xf) + (num2.intValue & 0xf)) & 0x10) === 0x10
  };
  return { result: result, flags: flags };
};

export const adc = (num1: HexNum, num2: HexNum, carry: boolean): { result: HexNum; flags: FlagStructure } => {
  const added = num1.intValue + num2.intValue + Number(carry);
  const result = new HexNum(added);

  const flags: FlagStructure = {
    zero: zero(result),
    sign: sign(result),
    parity: parity(result),
    carry: added > 0xff,
    auxiliaryCarry: (((num1.intValue & 0xf) + (num2.intValue & 0xf) + Number(carry)) & 0x10) === 0x10
  };
  return { result: result, flags: flags };
};

export const sub = (num1: HexNum, num2: HexNum): { result: HexNum; flags: FlagStructure } => {
  const subbed = num1.intValue + (~num2.intValue + 1);
  const result = new HexNum(subbed);

  const flags: FlagStructure = {
    zero: zero(result),
    sign: sign(result),
    parity: parity(result),
    carry: subbed < 0,
    auxiliaryCarry: (((num1.intValue & 0xf) + ((~num2.intValue + 1) & 0xf)) & 0x10) === 0x10
  };
  return { result: result, flags: flags };
};

export const sbb = (num1: HexNum, num2: HexNum, carry: boolean): { result: HexNum; flags: FlagStructure } => {
  const subbed = num1.intValue + (~num2.intValue + 1 + Number(carry));
  const result = new HexNum(subbed);

  const flags: FlagStructure = {
    zero: zero(result),
    sign: sign(result),
    parity: parity(result),
    carry: subbed < 0,
    auxiliaryCarry: (((num1.intValue & 0xf) + ((~num2.intValue + 1 + Number(carry)) & 0xf)) & 0x10) === 0x10
  };
  return { result: result, flags: flags };
};

export const ana = (num1: HexNum, num2: HexNum): { result: HexNum; flags: FlagStructure } => {
  const result = new HexNum(num1.intValue & num2.intValue);

  const flags: FlagStructure = {
    zero: zero(result),
    sign: sign(result),
    parity: parity(result),
    carry: false
  };
  return { result: result, flags: flags };
};

export const xra = (num1: HexNum, num2: HexNum): { result: HexNum; flags: FlagStructure } => {
  const result = new HexNum(num1.intValue ^ num2.intValue);

  const flags: FlagStructure = {
    zero: zero(result),
    sign: sign(result),
    parity: parity(result),
    carry: false,
    auxiliaryCarry: false
  };
  return { result: result, flags: flags };
};

export const ora = (num1: HexNum, num2: HexNum): { result: HexNum; flags: FlagStructure } => {
  const result = new HexNum(num1.intValue | num2.intValue);

  const flags: FlagStructure = {
    zero: zero(result),
    sign: sign(result),
    parity: parity(result),
    carry: false
  };
  return { result: result, flags: flags };
};

export const cmp = (num1: HexNum, num2: HexNum): FlagStructure => {
  const result = new HexNum(num1.intValue + (~num2.intValue + 1));

  return {
    zero: zero(result),
    sign: sign(result),
    parity: parity(result),
    carry: result.intValue < 0,
    auxiliaryCarry: (((num1.intValue & 0xf) + ((~num2.intValue + 1) & 0xf)) & 0x10) === 0x10
  };
};

export const dad = (num1: number, num2: number): { result: number; flags: FlagStructure } => {
  const result = num1 + num2;
  const flags: FlagStructure = {
    carry: (((num1 + num2) >> 16) & 1) === 1
  };

  return { result: result, flags: flags };
};

export const daa = (regA: Register, flagRegister: FlagRegister): { result: HexNum; flags: FlagStructure } => {
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
  const flags: FlagStructure = {
    auxiliaryCarry: newAc,
    carry: newCy,
    zero: zero(accumulatorValue),
    sign: sign(accumulatorValue),
    parity: parity(accumulatorValue)
  };
  return { result: new HexNum(newAccumulatorValue), flags: flags };
};
