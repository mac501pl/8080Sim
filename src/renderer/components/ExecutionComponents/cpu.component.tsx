import * as React from 'react';
import HexNum from '@main/assembler/Types/HexNum';
import Register from '@main/Processor/Register';
import FlagRegister from '@main/Processor/FlagRegister';
import { IInstruction } from '@/main/instruction_list';
import { findInstructionByOpCode } from '@utils/Utils';
import { adc, add, ana, cmp, dad, dcr, inr, ora, ral, rar, rlc, rrc, sbb, sub, xra, daa } from '@main/Processor/Instructions';
import TerminalView, { InputType } from '@renderer/components/ExecutionComponents/Views/terminal.view.component';
import CPUView from '@renderer/components/ExecutionComponents/Views/cpu.view.component';
import MemoryView from '@renderer/components/ExecutionComponents/Views/memory.view.component';
import InstructionsView from '@renderer/components/ExecutionComponents/Views/instructions.view.component';
import { ExecutionMode } from '@renderer/components/App';
import Instruction from '@/main/assembler/Types/Instruction';
import ControlButtons from '@renderer/components/ExecutionComponents/control.buttons.component';
import { LinesWithOpcodes } from '@main/assembler/assemble';
import HexNum16 from '@/main/assembler/Types/HexNum16';
import { parseToInt } from '@/main/assembler/Parser';

interface CPUMetaInfo {
  acceptInput: boolean;
  executionEnded: boolean;
  executionMode: ExecutionMode;
  breakpoints: Array<number>;
  inputType: InputType;
}

interface IntermediateState {
  registers: { A: Register, B: Register, C: Register, D: Register, E: Register, H: Register, L: Register };
  flags: FlagRegister;
  PC: HexNum16;
  previousPC: HexNum16;
  SP: HexNum16;
  code: Array<HexNum>;
}

export interface CPUState extends CPUMetaInfo, IntermediateState {
  isHalted: boolean;
}

export interface CPUProps {
  assemblerOutput: Array<LinesWithOpcodes>;
  mode: ExecutionMode;
  changeExecutingState: (state: { isExecuting: boolean; }) => void;
  error?: Error;
}

export default class CPU extends React.Component<CPUProps, CPUState> {
  public state: CPUState;
  private intermediateState: IntermediateState;

  private readonly terminalRef: React.RefObject<TerminalView>;

  public constructor(props: CPUProps) {
    super(props);
    this.terminalRef = React.createRef();

    this.intermediateState = this.initializeIntermediateState();
    const initialMetaState = this.initializeMetaState();

    this.state = { ...this.intermediateState, ...initialMetaState, isHalted: false };
  }

  private restart(): void {
    this.terminalRef.current.terminal.write('\n\n\n\n\r--------------------------------------RESET--------------------------------------\n\r');
    this.intermediateState = this.initializeIntermediateState();
    const initialMetaState = this.initializeMetaState();
    this.setState({ ...this.intermediateState, ...initialMetaState, isHalted: false });
  }

  private initializeMetaState(): CPUMetaInfo {
    return {
      acceptInput: false,
      breakpoints: this.mapInstructionsToBreakpoints(),
      executionEnded: false,
      executionMode: this.props.mode,
      inputType: undefined
    };
  }

  private initializeIntermediateState(): IntermediateState {
    const assemblerOutput = this.props.assemblerOutput.map(entry => entry.bytes).flat();
    const fillArrayLength = 0x10000 - assemblerOutput.length;
    const fillArray: Array<HexNum> = new Array<HexNum>(fillArrayLength);
    for (let i = 0; i < fillArrayLength; i++) {
      fillArray[i] = new HexNum();
    }
    const firstInstructionLocation = assemblerOutput.findIndex(byte => byte.intValue !== 0);
    return {
      PC: new HexNum16(firstInstructionLocation),
      previousPC: new HexNum16(firstInstructionLocation),
      registers: {
        A: new Register('A'),
        B: new Register('B'),
        C: new Register('C'),
        D: new Register('D'),
        E: new Register('E'),
        H: new Register('H'),
        L: new Register('L')
      },
      code: [...assemblerOutput, ...fillArray],
      flags: new FlagRegister('Flag register'),
      SP: new HexNum16()
    };
  }

  public componentDidMount(): void {
    if (this.props.error) {
      const { message } = this.props.error;
      this.terminalRef.current.writeError(`Assemble error, please check your source code\n\r${message}`);
      this.setState({ isHalted: true, executionEnded: true });
    }

    if (this.state.executionMode === ExecutionMode.RUN) {
      void this.resumeExecution();
    }
  }

  private async resumeExecution(): Promise<void> {
    await this.setState({ isHalted: false });
    while (!this.state.isHalted && !this.state.executionEnded) {
      await this.executeNextInstruction();
    }
  }

  private fetchByte(): HexNum {
    return this.state.code[this.intermediateState.previousPC.intValue + 1];
  }

  private fetch2Bytes(): [HexNum, HexNum] {
    return [
      this.state.code[this.intermediateState.previousPC.intValue + 1],
      this.state.code[this.intermediateState.previousPC.intValue + 2]
    ];
  }

  private readCurrentInstruction(address: number): HexNum {
    return this.state.code[address];
  }

  private getRegisterPair(first: Register, second: Register): number {
    return (first.content.intValue << 8) | second.content.intValue;
  }

  private getNumberFromHexNumPair(pair: [HexNum, HexNum]): number {
    return (pair[1].intValue << 8) | pair[0].intValue;
  }

  private mapInstructionsToBreakpoints(): Array<number> {
    return this.props.assemblerOutput.map(entry => entry.line).filter(entry => entry.content instanceof Instruction).map(entry => entry.content as Instruction).filter(instruction => instruction.breakpoint).map(instruction => instruction.address);
  }

  private isBreakpoint(PC: number): boolean {
    return this.state.breakpoints.includes(PC);
  }

  private async executeNextInstruction(): Promise<void> {
    const currentInstruction = findInstructionByOpCode(this.readCurrentInstruction(this.state.PC.intValue));
    this.intermediateState.previousPC.intValue = this.intermediateState.PC.intValue;
    this.intermediateState.PC.intValue += currentInstruction.size;
    try {
      this.runInstruction(currentInstruction);
    } catch (e) {
      this.terminalRef.current.writeError(`Runtime error: ${(e as Error).message}\n\rCheck your source code (this is probably related to stack overflow or PC pointing to a wrong value)`);
      this.setState({ isHalted: true, executionEnded: true });
    }
    await this.setState({ ...this.intermediateState });
    if (this.state.executionMode === ExecutionMode.STEPS ||
          (this.state.executionMode === ExecutionMode.DEBUG && this.isBreakpoint(this.state.PC.intValue))) {
      await this.setState({ isHalted: true });
    }
  }

  private runInstruction(instruction: IInstruction): void {
    const call = (): void => {
      const currentAddress = HexNum.to16Bit(this.intermediateState.PC.intValue);
      this.intermediateState.code[this.intermediateState.SP.intValue - 1 & 0xffff] = currentAddress[1];
      this.intermediateState.code[this.intermediateState.SP.intValue - 2 & 0xffff] = currentAddress[0];
      this.intermediateState.SP.intValue -= 2;
      jmp();
    };

    const ret = (): void => {
      this.intermediateState.PC.intValue = this.getNumberFromHexNumPair([this.intermediateState.code[this.intermediateState.SP.intValue & 0xffff], this.intermediateState.code[this.intermediateState.SP.intValue + 1 & 0xffff]]);
      this.intermediateState.SP.intValue += 2;
    };

    const jmp = (): void => {
      this.intermediateState.PC.intValue = this.getNumberFromHexNumPair(this.fetch2Bytes());
    };
    switch (instruction.opCode) {
    // NOP
    case 0x00: {
      break;
    }
    // LXI B, nn
    case 0x01: {
      [this.intermediateState.registers.C.content, this.intermediateState.registers.B.content] = this.fetch2Bytes();
      break;
    }
    // STAX B
    case 0x02: {
      this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.B, this.intermediateState.registers.C)] = this.intermediateState.registers.A.content;
      break;
    }
    // INX B
    case 0x03: {
      [this.intermediateState.registers.C.content, this.intermediateState.registers.B.content] = HexNum.to16Bit(
        this.getRegisterPair(this.intermediateState.registers.B, this.intermediateState.registers.C) + 1
      );
      break;
    }
    // INR B
    case 0x04: {
      const result = inr(this.intermediateState.registers.B.content);
      this.intermediateState.registers.B.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // DCR B
    case 0x05: {
      const result = dcr(this.intermediateState.registers.B.content);
      this.intermediateState.registers.B.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // MVI B
    case 0x06: {
      this.intermediateState.registers.B.content = this.fetchByte();
      break;
    }
    // RLC
    case 0x07: {
      const result = rlc(this.intermediateState.registers.A.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // -
    case 0x08: {
      break;
    }
    // DAD B
    case 0x09: {
      const result = dad(this.getRegisterPair(this.intermediateState.registers.B, this.intermediateState.registers.C), this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L));
      [this.intermediateState.registers.L.content, this.intermediateState.registers.H.content] = HexNum.to16Bit(result.result);
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // LDAX B
    case 0x0a: {
      this.intermediateState.registers.A.content = this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.B, this.intermediateState.registers.C)];
      break;
    }
    // DCX B
    case 0x0b: {
      [this.intermediateState.registers.C.content, this.intermediateState.registers.B.content] = HexNum.to16Bit(
        this.getRegisterPair(this.intermediateState.registers.B, this.intermediateState.registers.C) - 1
      );
      break;
    }
    // INR C
    case 0x0c: {
      const result = inr(this.intermediateState.registers.C.content);
      this.intermediateState.registers.C.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // DCR C
    case 0x0d: {
      const result = dcr(this.intermediateState.registers.C.content);
      this.intermediateState.registers.C.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // MVI C
    case 0x0e: {
      this.intermediateState.registers.C.content = this.fetchByte();
      break;
    }
    // RRC
    case 0x0f: {
      const result = rrc(this.intermediateState.registers.A.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // -
    case 0x10: {
      break;
    }
    // LXI D, nn
    case 0x11: {
      [this.intermediateState.registers.E.content, this.intermediateState.registers.D.content] = this.fetch2Bytes();
      break;
    }
    // STAX D
    case 0x12: {
      this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.D, this.intermediateState.registers.E)] = this.intermediateState.registers.A.content;
      break;
    }
    // INX D
    case 0x13: {
      [this.intermediateState.registers.E.content, this.intermediateState.registers.D.content] = HexNum.to16Bit(
        this.getRegisterPair(this.intermediateState.registers.D, this.intermediateState.registers.E) + 1
      );
      break;
    }
    // INR D
    case 0x14: {
      const result = inr(this.intermediateState.registers.D.content);
      this.intermediateState.registers.D.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // DCR D
    case 0x15: {
      const result = dcr(this.intermediateState.registers.D.content);
      this.intermediateState.registers.D.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // MVI D
    case 0x16: {
      this.intermediateState.registers.D.content = this.fetchByte();
      break;
    }
    // RAL
    case 0x17: {
      const result = ral(
        this.intermediateState.registers.A.content,
        this.intermediateState.flags.getCarry()
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // -
    case 0x18: {
      break;
    }
    // DAD D
    case 0x19: {
      const result = dad(this.getRegisterPair(this.intermediateState.registers.D, this.intermediateState.registers.E), this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L));
      [this.intermediateState.registers.L.content, this.intermediateState.registers.H.content] = HexNum.to16Bit(result.result);
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // LDAX D
    case 0x1a: {
      this.intermediateState.registers.A.content = this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.D, this.intermediateState.registers.E)];
      break;
    }
    // DCX D
    case 0x1b: {
      [this.intermediateState.registers.E.content, this.intermediateState.registers.D.content] = HexNum.to16Bit(
        this.getRegisterPair(this.intermediateState.registers.D, this.intermediateState.registers.E) - 1
      );
      break;
    }
    // INR E
    case 0x1c: {
      const result = inr(this.intermediateState.registers.E.content);
      this.intermediateState.registers.E.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // DCR E
    case 0x1d: {
      const result = dcr(this.intermediateState.registers.E.content);
      this.intermediateState.registers.E.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // MVI D
    case 0x1e: {
      this.intermediateState.registers.E.content = this.fetchByte();
      break;
    }
    // RAR
    case 0x1f: {
      const result = rar(
        this.intermediateState.registers.A.content,
        this.intermediateState.flags.getCarry()
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // -
    case 0x20: {
      break;
    }
    // LXI H
    case 0x21: {
      [this.intermediateState.registers.L.content, this.intermediateState.registers.H.content] = this.fetch2Bytes();
      break;
    }
    // SHLD
    case 0x22: {
      const address = this.getNumberFromHexNumPair(this.fetch2Bytes());
      this.intermediateState.code[address] = this.intermediateState.registers.L.content;
      this.intermediateState.code[address + 1] = this.intermediateState.registers.H.content;
      break;
    }
    // INX H
    case 0x23: {
      [this.intermediateState.registers.L.content, this.intermediateState.registers.H.content] = HexNum.to16Bit(
        this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L) + 1
      );
      break;
    }
    // INR H
    case 0x24: {
      const result = inr(this.intermediateState.registers.H.content);
      this.intermediateState.registers.H.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // DCR H
    case 0x25: {
      const result = dcr(this.intermediateState.registers.H.content);
      this.intermediateState.registers.H.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // MVI H
    case 0x26: {
      this.intermediateState.registers.H.content = this.fetchByte();
      break;
    }
    // DAA
    case 0x27: {
      const result = daa(this.intermediateState.registers.A, this.intermediateState.flags);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // -
    case 0x28: {
      break;
    }
    // DAD H
    case 0x29: {
      const result = dad(this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L), this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L));
      [this.intermediateState.registers.L.content, this.intermediateState.registers.H.content] = HexNum.to16Bit(result.result);
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // LHLD
    case 0x2a: {
      const address = this.getNumberFromHexNumPair(this.fetch2Bytes());
      this.intermediateState.registers.L.content = this.intermediateState.code[address];
      this.intermediateState.registers.H.content = this.intermediateState.code[address + 1];
      break;
    }
    // DCX H
    case 0x2b: {
      [this.intermediateState.registers.L.content, this.intermediateState.registers.H.content] = HexNum.to16Bit(
        this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L) - 1
      );
      break;
    }
    // INR L
    case 0x2c: {
      const result = inr(this.intermediateState.registers.L.content);
      this.intermediateState.registers.L.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // DCR L
    case 0x2d: {
      const result = dcr(this.intermediateState.registers.L.content);
      this.intermediateState.registers.L.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // MVI L
    case 0x2e: {
      this.intermediateState.registers.L.content = this.fetchByte();
      break;
    }
    // CMA
    case 0x2f: {
      this.intermediateState.registers.A.content = new HexNum(~this.intermediateState.registers.A.content.intValue);
      break;
    }
    // -
    case 0x30: {
      break;
    }
    // LXI SP
    case 0x31: {
      this.intermediateState.SP.intValue = this.getNumberFromHexNumPair(this.fetch2Bytes());
      break;
    }
    // STA
    case 0x32: {
      this.intermediateState.code[this.getNumberFromHexNumPair(this.fetch2Bytes())] = this.intermediateState.registers.A.content;
      break;
    }
    // INX SP
    case 0x33: {
      this.intermediateState.SP.intValue++;
      break;
    }
    // INR M
    case 0x34: {
      const address = this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L);
      const result = inr(this.intermediateState.code[address]);
      this.intermediateState.code[address] = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // DCR M
    case 0x35: {
      const address = this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L);
      const result = dcr(this.intermediateState.code[address]);
      this.intermediateState.code[address] = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // MVI M
    case 0x36: {
      const address = this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L);
      this.intermediateState.code[address] = this.fetchByte();
      break;
    }
    // STC
    case 0x37: {
      this.intermediateState.flags.setFlags({ carry: true });
      break;
    }
    // -
    case 0x38: {
      break;
    }
    // DAD SP
    case 0x39: {
      const result = dad(this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L), this.intermediateState.SP.intValue);
      [this.intermediateState.registers.L.content, this.intermediateState.registers.H.content] = HexNum.to16Bit(result.result);
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // LDA
    case 0x3a: {
      this.intermediateState.registers.A.content = this.intermediateState.code[this.getNumberFromHexNumPair(this.fetch2Bytes())];
      break;
    }
    // DCX SP
    case 0x3b: {
      this.intermediateState.SP.intValue--;
      break;
    }
    // INR A
    case 0x3c: {
      const result = inr(this.intermediateState.registers.A.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // DCR A
    case 0x3d: {
      const result = dcr(this.intermediateState.registers.A.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // MVI A
    case 0x3e: {
      this.intermediateState.registers.A.content = this.fetchByte();
      break;
    }
    // CMC
    case 0x3f: {
      this.intermediateState.flags.setFlags({ carry: !this.intermediateState.flags.getCarry() });
      break;
    }
    // MOV B,B
    case 0x40: {
      // eslint-disable-next-line no-self-assign
      this.intermediateState.registers.B.content = this.intermediateState.registers.B.content;
      break;
    }
    // MOV B,C
    case 0x41: {
      this.intermediateState.registers.B.content = this.intermediateState.registers.C.content;
      break;
    }
    // MOV B,D
    case 0x42: {
      this.intermediateState.registers.B.content = this.intermediateState.registers.D.content;
      break;
    }
    // MOV B,E
    case 0x43: {
      this.intermediateState.registers.B.content = this.intermediateState.registers.E.content;
      break;
    }
    // MOV B,H
    case 0x44: {
      this.intermediateState.registers.B.content = this.intermediateState.registers.H.content;
      break;
    }
    // MOV B,L
    case 0x45: {
      this.intermediateState.registers.B.content = this.intermediateState.registers.L.content;
      break;
    }
    // MOV B,M
    case 0x46: {
      this.intermediateState.registers.B.content = this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)];
      break;
    }
    // MOV B,A
    case 0x47: {
      this.intermediateState.registers.B.content = this.intermediateState.registers.A.content;
      break;
    }
    // MOV C,B
    case 0x48: {
      this.intermediateState.registers.C.content = this.intermediateState.registers.B.content;
      break;
    }
    // MOV C,C
    case 0x49: {
      // eslint-disable-next-line no-self-assign
      this.intermediateState.registers.C.content = this.intermediateState.registers.C.content;
      break;
    }
    // MOV C,D
    case 0x4a: {
      this.intermediateState.registers.C.content = this.intermediateState.registers.D.content;
      break;
    }
    // MOV C,E
    case 0x4b: {
      this.intermediateState.registers.C.content = this.intermediateState.registers.E.content;
      break;
    }
    // MOV C,H
    case 0x4c: {
      this.intermediateState.registers.C.content = this.intermediateState.registers.H.content;
      break;
    }
    // MOV C,L
    case 0x4d: {
      this.intermediateState.registers.C.content = this.intermediateState.registers.L.content;
      break;
    }
    // MOV C,M
    case 0x4e: {
      this.intermediateState.registers.C.content = this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)];
      break;
    }
    // MOV C,A
    case 0x4f: {
      this.intermediateState.registers.C.content = this.intermediateState.registers.A.content;
      break;
    }
    // MOV D, B
    case 0x50: {
      this.intermediateState.registers.D.content = this.intermediateState.registers.B.content;
      break;
    }
    // MOV D, C
    case 0x51: {
      this.intermediateState.registers.D.content = this.intermediateState.registers.C.content;
      break;
    }
    // MOV D, D
    case 0x52: {
      // eslint-disable-next-line no-self-assign
      this.intermediateState.registers.D.content = this.intermediateState.registers.D.content;
      break;
    }
    // MOV D, E
    case 0x53: {
      this.intermediateState.registers.D.content = this.intermediateState.registers.E.content;
      break;
    }
    // MOV D, H
    case 0x54: {
      this.intermediateState.registers.D.content = this.intermediateState.registers.H.content;
      break;
    }
    // MOV D, L
    case 0x55: {
      this.intermediateState.registers.D.content = this.intermediateState.registers.L.content;
      break;
    }
    // MOV D, M
    case 0x56: {
      this.intermediateState.registers.D.content = this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)];
      break;
    }
    // MOV D, A
    case 0x57: {
      this.intermediateState.registers.D.content = this.intermediateState.registers.A.content;
      break;
    }
    // MOV E,B
    case 0x58: {
      this.intermediateState.registers.E.content = this.intermediateState.registers.B.content;
      break;
    }
    // MOV E,C
    case 0x59: {
      this.intermediateState.registers.E.content = this.intermediateState.registers.C.content;
      break;
    }
    // MOV E,D
    case 0x5a: {
      this.intermediateState.registers.E.content = this.intermediateState.registers.D.content;
      break;
    }
    // MOV E,E
    case 0x5b: {
      // eslint-disable-next-line no-self-assign
      this.intermediateState.registers.E.content = this.intermediateState.registers.E.content;
      break;
    }
    // MOV E,H
    case 0x5c: {
      this.intermediateState.registers.E.content = this.intermediateState.registers.H.content;
      break;
    }
    // MOV E,L
    case 0x5d: {
      this.intermediateState.registers.E.content = this.intermediateState.registers.L.content;
      break;
    }
    // MOV E,M
    case 0x5e: {
      this.intermediateState.registers.E.content = this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)];
      break;
    }
    // MOV E,A
    case 0x5f: {
      this.intermediateState.registers.E.content = this.intermediateState.registers.A.content;
      break;
    }
    // MOV H,B
    case 0x60: {
      this.intermediateState.registers.H.content = this.intermediateState.registers.B.content;
      break;
    }
    // MOV H,C
    case 0x61: {
      this.intermediateState.registers.H.content = this.intermediateState.registers.C.content;
      break;
    }
    // MOV H,D
    case 0x62: {
      this.intermediateState.registers.H.content = this.intermediateState.registers.D.content;
      break;
    }
    // MOV H,E
    case 0x63: {
      this.intermediateState.registers.H.content = this.intermediateState.registers.E.content;
      break;
    }
    // MOV H,H
    case 0x64: {
      // eslint-disable-next-line no-self-assign
      this.intermediateState.registers.H.content = this.intermediateState.registers.H.content;
      break;
    }
    // MOV H,L
    case 0x65: {
      this.intermediateState.registers.H.content = this.intermediateState.registers.L.content;
      break;
    }
    // MOV H,M
    case 0x66: {
      this.intermediateState.registers.H.content = this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)];
      break;
    }
    // MOV H,A
    case 0x67: {
      this.intermediateState.registers.H.content = this.intermediateState.registers.A.content;
      break;
    }
    // MOV L,B
    case 0x68: {
      this.intermediateState.registers.L.content = this.intermediateState.registers.B.content;
      break;
    }
    // MOV L,C
    case 0x69: {
      this.intermediateState.registers.L.content = this.intermediateState.registers.C.content;
      break;
    }
    // MOV L,D
    case 0x6a: {
      this.intermediateState.registers.L.content = this.intermediateState.registers.D.content;
      break;
    }
    // MOV L,E
    case 0x6b: {
      this.intermediateState.registers.L.content = this.intermediateState.registers.E.content;
      break;
    }
    // MOV L,H
    case 0x6c: {
      this.intermediateState.registers.L.content = this.intermediateState.registers.H.content;
      break;
    }
    // MOV L,L
    case 0x6d: {
      // eslint-disable-next-line no-self-assign
      this.intermediateState.registers.L.content = this.intermediateState.registers.L.content;
      break;
    }
    // MOV L,M
    case 0x6e: {
      this.intermediateState.registers.L.content = this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)];
      break;
    }
    // MOV L,A
    case 0x6f: {
      this.intermediateState.registers.L.content = this.intermediateState.registers.A.content;
      break;
    }
    // MOV M,B
    case 0x70: {
      this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)] = this.intermediateState.registers.B.content;
      break;
    }
    // MOV M,C
    case 0x71: {
      this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)] = this.intermediateState.registers.C.content;
      break;
    }
    // MOV M,D
    case 0x72: {
      this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)] = this.intermediateState.registers.D.content;
      break;
    }
    // MOV M,E
    case 0x73: {
      this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)] = this.intermediateState.registers.E.content;
      break;
    }
    // MOV M,H
    case 0x74: {
      this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)] = this.intermediateState.registers.H.content;
      break;
    }
    // MOV M,L
    case 0x75: {
      this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)] = this.intermediateState.registers.L.content;
      break;
    }
    // HLT
    case 0x76: {
      this.setState({ isHalted: true, executionEnded: true });
      break;
    }
    // MOV M,A
    case 0x77: {
      this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)] = this.intermediateState.registers.A.content;
      break;
    }
    // MOV A,B
    case 0x78: {
      this.intermediateState.registers.A.content = this.intermediateState.registers.B.content;
      break;
    }
    // MOV A,C
    case 0x79: {
      this.intermediateState.registers.A.content = this.intermediateState.registers.C.content;
      break;
    }
    // MOV A,D
    case 0x7a: {
      this.intermediateState.registers.A.content = this.intermediateState.registers.D.content;
      break;
    }
    // MOV A,E
    case 0x7b: {
      this.intermediateState.registers.A.content = this.intermediateState.registers.E.content;
      break;
    }
    // MOV A,H
    case 0x7c: {
      this.intermediateState.registers.A.content = this.intermediateState.registers.H.content;
      break;
    }
    // MOV A,L
    case 0x7d: {
      this.intermediateState.registers.A.content = this.intermediateState.registers.L.content;
      break;
    }
    // MOV A,M
    case 0x7e: {
      this.intermediateState.registers.A.content = this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)];
      break;
    }
    // MOV A,A
    case 0x7f: {
      // eslint-disable-next-line no-self-assign
      this.intermediateState.registers.A.content = this.intermediateState.registers.A.content;
      break;
    }
    // ADD B
    case 0x80: {
      const result = add(this.intermediateState.registers.A.content, this.intermediateState.registers.B.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ADD C
    case 0x81: {
      const result = add(this.intermediateState.registers.A.content, this.intermediateState.registers.C.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ADD D
    case 0x82: {
      const result = add(this.intermediateState.registers.A.content, this.intermediateState.registers.D.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ADD E
    case 0x83: {
      const result = add(this.intermediateState.registers.A.content, this.intermediateState.registers.E.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ADD H
    case 0x84: {
      const result = add(this.intermediateState.registers.A.content, this.intermediateState.registers.H.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ADD L
    case 0x85: {
      const result = add(this.intermediateState.registers.A.content, this.intermediateState.registers.L.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ADD M
    case 0x86: {
      const result = add(
        this.intermediateState.registers.A.content,
        this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)]
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ADD A
    case 0x87: {
      const result = add(this.intermediateState.registers.A.content, this.intermediateState.registers.A.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ADC B
    case 0x88: {
      const result = adc(
        this.intermediateState.registers.A.content,
        this.intermediateState.registers.B.content,
        this.intermediateState.flags.getCarry()
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ADC C
    case 0x89: {
      const result = adc(
        this.intermediateState.registers.A.content,
        this.intermediateState.registers.C.content,
        this.intermediateState.flags.getCarry()
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ADC D
    case 0x8a: {
      const result = adc(
        this.intermediateState.registers.A.content,
        this.intermediateState.registers.D.content,
        this.intermediateState.flags.getCarry()
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ADC E
    case 0x8b: {
      const result = adc(
        this.intermediateState.registers.A.content,
        this.intermediateState.registers.E.content,
        this.intermediateState.flags.getCarry()
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ADC H
    case 0x8c: {
      const result = adc(
        this.intermediateState.registers.A.content,
        this.intermediateState.registers.H.content,
        this.intermediateState.flags.getCarry()
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ADC L
    case 0x8d: {
      const result = adc(
        this.intermediateState.registers.A.content,
        this.intermediateState.registers.L.content,
        this.intermediateState.flags.getCarry()
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ADC M
    case 0x8e: {
      const result = adc(
        this.intermediateState.registers.A.content,
        this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)],
        this.intermediateState.flags.getCarry()
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ADC A
    case 0x8f: {
      const result = adc(
        this.intermediateState.registers.A.content,
        this.intermediateState.registers.A.content,
        this.intermediateState.flags.getCarry()
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // SUB B
    case 0x90: {
      const result = sub(this.intermediateState.registers.A.content, this.intermediateState.registers.B.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // SUB C
    case 0x91: {
      const result = sub(this.intermediateState.registers.A.content, this.intermediateState.registers.C.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // SUB D
    case 0x92: {
      const result = sub(this.intermediateState.registers.A.content, this.intermediateState.registers.D.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // SUB E
    case 0x93: {
      const result = sub(this.intermediateState.registers.A.content, this.intermediateState.registers.E.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // SUB H
    case 0x94: {
      const result = sub(this.intermediateState.registers.A.content, this.intermediateState.registers.H.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // SUB L
    case 0x95: {
      const result = sub(this.intermediateState.registers.A.content, this.intermediateState.registers.L.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // SUB M
    case 0x96: {
      const result = sub(
        this.intermediateState.registers.A.content,
        this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)]
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // SUB A
    case 0x97: {
      const result = sub(this.intermediateState.registers.A.content, this.intermediateState.registers.A.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // SBB B
    case 0x98: {
      const result = sbb(
        this.intermediateState.registers.A.content,
        this.intermediateState.registers.B.content,
        this.intermediateState.flags.getCarry()
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // SBB C
    case 0x99: {
      const result = sbb(
        this.intermediateState.registers.A.content,
        this.intermediateState.registers.C.content,
        this.intermediateState.flags.getCarry()
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // SBB D
    case 0x9a: {
      const result = sbb(
        this.intermediateState.registers.A.content,
        this.intermediateState.registers.D.content,
        this.intermediateState.flags.getCarry()
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // SBB E
    case 0x9b: {
      const result = sbb(
        this.intermediateState.registers.A.content,
        this.intermediateState.registers.E.content,
        this.intermediateState.flags.getCarry()
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // SBB H
    case 0x9c: {
      const result = sbb(
        this.intermediateState.registers.A.content,
        this.intermediateState.registers.H.content,
        this.intermediateState.flags.getCarry()
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // SBB L
    case 0x9d: {
      const result = sbb(
        this.intermediateState.registers.A.content,
        this.intermediateState.registers.L.content,
        this.intermediateState.flags.getCarry()
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // SBB M
    case 0x9e: {
      const result = sbb(
        this.intermediateState.registers.A.content,
        this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)],
        this.intermediateState.flags.getCarry()
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // SBB A
    case 0x9f: {
      const result = sbb(
        this.intermediateState.registers.A.content,
        this.intermediateState.registers.A.content,
        this.intermediateState.flags.getCarry()
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ANA B
    case 0xa0: {
      const result = ana(this.intermediateState.registers.A.content, this.intermediateState.registers.B.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ANA C
    case 0xa1: {
      const result = ana(this.intermediateState.registers.A.content, this.intermediateState.registers.C.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ANA D
    case 0xa2: {
      const result = ana(this.intermediateState.registers.A.content, this.intermediateState.registers.D.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ANA E
    case 0xa3: {
      const result = ana(this.intermediateState.registers.A.content, this.intermediateState.registers.E.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ANA H
    case 0xa4: {
      const result = ana(this.intermediateState.registers.A.content, this.intermediateState.registers.H.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ANA L
    case 0xa5: {
      const result = ana(this.intermediateState.registers.A.content, this.intermediateState.registers.L.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ANA M
    case 0xa6: {
      const result = ana(
        this.intermediateState.registers.A.content,
        this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)]
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ANA A
    case 0xa7: {
      const result = ana(this.intermediateState.registers.A.content, this.intermediateState.registers.A.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // XRA B
    case 0xa8: {
      const result = xra(this.intermediateState.registers.A.content, this.intermediateState.registers.B.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // XRA C
    case 0xa9: {
      const result = xra(this.intermediateState.registers.A.content, this.intermediateState.registers.C.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // XRA D
    case 0xaa: {
      const result = xra(this.intermediateState.registers.A.content, this.intermediateState.registers.D.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // XRA E
    case 0xab: {
      const result = xra(this.intermediateState.registers.A.content, this.intermediateState.registers.E.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // XRA H
    case 0xac: {
      const result = xra(this.intermediateState.registers.A.content, this.intermediateState.registers.H.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // XRA L
    case 0xad: {
      const result = xra(this.intermediateState.registers.A.content, this.intermediateState.registers.L.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // XRA M
    case 0xae: {
      const result = xra(
        this.intermediateState.registers.A.content,
        this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)]
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // XRA A
    case 0xaf: {
      const result = xra(this.intermediateState.registers.A.content, this.intermediateState.registers.A.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ORA B
    case 0xb0: {
      const result = ora(this.intermediateState.registers.A.content, this.intermediateState.registers.B.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ORA C
    case 0xb1: {
      const result = ora(this.intermediateState.registers.A.content, this.intermediateState.registers.C.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ORA D
    case 0xb2: {
      const result = ora(this.intermediateState.registers.A.content, this.intermediateState.registers.D.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ORA E
    case 0xb3: {
      const result = ora(this.intermediateState.registers.A.content, this.intermediateState.registers.E.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ORA H
    case 0xb4: {
      const result = ora(this.intermediateState.registers.A.content, this.intermediateState.registers.H.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ORA L
    case 0xb5: {
      const result = ora(this.intermediateState.registers.A.content, this.intermediateState.registers.L.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ORA M
    case 0xb6: {
      const result = ora(
        this.intermediateState.registers.A.content,
        this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)]
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // ORA A
    case 0xb7: {
      const result = ora(this.intermediateState.registers.A.content, this.intermediateState.registers.A.content);
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // CMP B
    case 0xb8: {
      const flags = cmp(this.intermediateState.registers.A.content, this.intermediateState.registers.B.content);
      this.intermediateState.flags.setFlags(flags);
      break;
    }
    // CMP C
    case 0xb9: {
      const flags = cmp(this.intermediateState.registers.A.content, this.intermediateState.registers.C.content);
      this.intermediateState.flags.setFlags(flags);
      break;
    }
    // CMP D
    case 0xba: {
      const flags = cmp(this.intermediateState.registers.A.content, this.intermediateState.registers.D.content);
      this.intermediateState.flags.setFlags(flags);
      break;
    }
    // CMP E
    case 0xbb: {
      const flags = cmp(this.intermediateState.registers.A.content, this.intermediateState.registers.E.content);
      this.intermediateState.flags.setFlags(flags);
      break;
    }
    // CMP H
    case 0xbc: {
      const flags = cmp(this.intermediateState.registers.A.content, this.intermediateState.registers.H.content);
      this.intermediateState.flags.setFlags(flags);
      break;
    }
    // CMP L
    case 0xbd: {
      const flags = cmp(this.intermediateState.registers.A.content, this.intermediateState.registers.L.content);
      this.intermediateState.flags.setFlags(flags);
      break;
    }
    // CMP M
    case 0xbe: {
      const flags = cmp(
        this.intermediateState.registers.A.content,
        this.intermediateState.code[this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L)]
      );
      this.intermediateState.flags.setFlags(flags);
      break;
    }
    // CMP A
    case 0xbf: {
      const flags = cmp(this.intermediateState.registers.A.content, this.intermediateState.registers.A.content);
      this.intermediateState.flags.setFlags(flags);
      break;
    }
    // RNZ
    case 0xc0: {
      if (!this.intermediateState.flags.getZero()) {
        ret();
      }
      break;
    }
    // POP B
    case 0xc1: {
      this.intermediateState.registers.C.content = this.intermediateState.code[this.intermediateState.SP.intValue & 0xffff];
      this.intermediateState.registers.B.content = this.intermediateState.code[this.intermediateState.SP.intValue + 1 & 0xffff];
      this.intermediateState.SP.intValue += 2;
      break;
    }
    // JNZ a
    case 0xc2: {
      if (!this.intermediateState.flags.getZero()) {
        jmp();
      }
      break;
    }
    // JMP a
    case 0xc3: {
      jmp();
      break;
    }
    // CNZ a
    case 0xc4: {
      if (!this.intermediateState.flags.getZero()) {
        call();
      }
      break;
    }
    // PUSH B
    case 0xc5: {
      this.intermediateState.code[this.intermediateState.SP.intValue - 2 & 0xffff] = this.intermediateState.registers.C.content;
      this.intermediateState.code[this.intermediateState.SP.intValue - 1 & 0xffff] = this.intermediateState.registers.B.content;
      this.intermediateState.SP.intValue -= 2;
      break;
    }
    // ADI A
    case 0xc6: {
      const result = add(this.intermediateState.registers.A.content, this.fetchByte());
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // RST 0
    case 0xc7: {
      // CAN BE USER DEFINED
      break;
    }
    // RZ
    case 0xc8: {
      if (this.intermediateState.flags.getZero()) {
        ret();
      }
      break;
    }
    // RET
    case 0xc9: {
      ret();
      break;
    }
    // JZ adr
    case 0xca: {
      if (this.intermediateState.flags.getZero()) {
        jmp();
      }
      break;
    }
    // USER DEFINED
    case 0xcb: {
      break;
    }
    // CZ adr
    case 0xcc: {
      if (this.intermediateState.flags.getZero()) {
        call();
      }
      break;
    }
    // CALL adr
    case 0xcd: {
      call();
      break;
    }
    // aci n
    case 0xce: {
      const result = adc(this.intermediateState.registers.A.content, this.fetchByte(), this.intermediateState.flags.getCarry());
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // RST 1
    case 0xcf: {
      this.terminalRef.current.writeToTerminal([this.intermediateState.registers.A.content]);
      break;
    }
    // RNC
    case 0xd0: {
      if (!this.intermediateState.flags.getCarry()) {
        ret();
      }
      break;
    }
    // POP D
    case 0xd1: {
      this.intermediateState.registers.E.content = this.intermediateState.code[this.intermediateState.SP.intValue & 0xffff];
      this.intermediateState.registers.D.content = this.intermediateState.code[this.intermediateState.SP.intValue + 1 & 0xffff];
      this.intermediateState.SP.intValue += 2;
      break;
    }
    // JNC a
    case 0xd2: {
      if (!this.intermediateState.flags.getCarry()) {
        jmp();
      }
      break;
    }
    // OUT n
    case 0xd3: {
      // CAN BE USER DEFINED
      break;
    }
    // CNC a
    case 0xd4: {
      if (!this.intermediateState.flags.getCarry()) {
        call();
      }
      break;
    }
    // PUSH d
    case 0xd5: {
      this.intermediateState.code[this.intermediateState.SP.intValue - 2 & 0xffff] = this.intermediateState.registers.E.content;
      this.intermediateState.code[this.intermediateState.SP.intValue - 1 & 0xffff] = this.intermediateState.registers.D.content;
      this.intermediateState.SP.intValue -= 2;
      break;
    }
    // SUI n
    case 0xd6: {
      const result = sub(this.intermediateState.registers.A.content, this.fetchByte());
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // RST 2
    case 0xd7: {
      document.addEventListener('line-break', (evt: Event) => {
        const char = (evt as CustomEvent<string>).detail;
        this.intermediateState.registers.A.content = new HexNum(char.charCodeAt(0));
        this.setState({ acceptInput: false, isHalted: false, inputType: undefined });
        if (this.state.executionMode === ExecutionMode.RUN) {
          void this.resumeExecution();
        }
      }, { once: true });
      this.setState({ acceptInput: true, isHalted: true, inputType: InputType.RST2 });
      this.terminalRef.current.terminal.focus();
      break;
    }
    // RC
    case 0xd8: {
      if (this.intermediateState.flags.getCarry()) {
        ret();
      }
      break;
    }
    // USER DEFINED
    case 0xd9: {
      break;
    }
    // JC a
    case 0xda: {
      if (this.intermediateState.flags.getCarry()) {
        jmp();
      }
      break;
    }
    // IN n
    case 0xdb: {
      // CAN BE USER DEFINED
      break;
    }
    // CC a
    case 0xdc: {
      if (this.intermediateState.flags.getCarry()) {
        call();
      }
      break;
    }
    // USER DEFINED
    case 0xdd: {
      break;
    }
    // SBI n
    case 0xde: {
      const result = sbb(
        this.intermediateState.registers.A.content,
        this.fetchByte(),
        this.intermediateState.flags.getCarry()
      );
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // RST 3
    case 0xdf: {
      const beginning = this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L);
      const end = this.intermediateState.code.slice(beginning).findIndex(entry => entry.intValue === '@'.charCodeAt(0));
      const str = this.intermediateState.code.slice(beginning, beginning + end);
      this.terminalRef.current.writeToTerminal(str);
      break;
    }
    // RPO
    case 0xe0: {
      if (!this.intermediateState.flags.getParity()) {
        ret();
      }
      break;
    }
    // POP H
    case 0xe1: {
      this.intermediateState.registers.L.content = this.intermediateState.code[this.intermediateState.SP.intValue & 0xffff];
      this.intermediateState.registers.H.content = this.intermediateState.code[this.intermediateState.SP.intValue + 1 & 0xffff];
      this.intermediateState.SP.intValue += 2;
      break;
    }
    // JPO a
    case 0xe2: {
      if (!this.intermediateState.flags.getParity()) {
        jmp();
      }
      break;
    }
    // XTHL
    case 0xe3: {
      const HL = [this.intermediateState.registers.L.content, this.intermediateState.registers.H.content];
      this.intermediateState.registers.L.content = this.intermediateState.code[this.intermediateState.SP.intValue & 0xffff];
      this.intermediateState.registers.H.content = this.intermediateState.code[this.intermediateState.SP.intValue + 1 & 0xffff];
      this.intermediateState.code[this.intermediateState.SP.intValue & 0xffff] = HL[0];
      this.intermediateState.code[this.intermediateState.SP.intValue + 1 & 0xffff] = HL[1];
      break;
    }
    // CPO a
    case 0xe4: {
      if (!this.intermediateState.flags.getParity()) {
        call();
      }
      break;
    }
    // PUSH H
    case 0xe5: {
      this.intermediateState.code[this.intermediateState.SP.intValue - 2 & 0xffff] = this.intermediateState.registers.L.content;
      this.intermediateState.code[this.intermediateState.SP.intValue - 1 & 0xffff] = this.intermediateState.registers.H.content;
      this.intermediateState.SP.intValue -= 2;
      break;
    }
    // ANI n
    case 0xe6: {
      const result = ana(this.intermediateState.registers.A.content, this.fetchByte());
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // RST 4
    case 0xe7: {
      this.terminalRef.current.writeKeys(this.intermediateState.registers.A.content.toHex());
      break;
    }
    // RPE
    case 0xe8: {
      if (this.intermediateState.flags.getParity()) {
        ret();
      }
      break;
    }
    // PCHL
    case 0xe9: {
      this.intermediateState.PC.intValue = this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L);
      break;
    }
    // JPE a
    case 0xea: {
      if (this.intermediateState.flags.getParity()) {
        jmp();
      }
      break;
    }
    // XCHG
    case 0xeb: {
      const HL = [this.intermediateState.registers.H.content, this.intermediateState.registers.L.content];
      [this.intermediateState.registers.H.content, this.intermediateState.registers.L.content] = [this.intermediateState.registers.D.content, this.intermediateState.registers.E.content];
      [this.intermediateState.registers.D.content, this.intermediateState.registers.E.content] = HL;
      break;
    }
    // CPE a
    case 0xec: {
      if (this.intermediateState.flags.getParity()) {
        call();
      }
      break;
    }
    // USER DEFINED
    case 0xed: {
      break;
    }
    // XRI n
    case 0xee: {
      const result = xra(this.intermediateState.registers.A.content, this.fetchByte());
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // RST 5
    case 0xef: {
      document.addEventListener('line-break', (evt: Event) => {
        try {
          const detail = (evt as CustomEvent<string>).detail;
          const value = parseToInt(detail);
          [this.intermediateState.registers.E.content, this.intermediateState.registers.D.content] = HexNum.to16Bit(value);
        } catch (e) {
          this.terminalRef.current.writeError(`Runtime error: ${(e as Error).message}\n\rThe number you have input was of invalid format\n\rIt will be discarded`);
        }
        this.setState({ acceptInput: false, isHalted: false, inputType: undefined });
        if (this.state.executionMode === ExecutionMode.RUN) {
          void this.resumeExecution();
        }
      }, { once: true });
      this.setState({ acceptInput: true, isHalted: true, inputType: InputType.RST5 });
      this.terminalRef.current.terminal.focus();
      break;
    }
    // RP
    case 0xf0: {
      if (!this.intermediateState.flags.getSign()) {
        ret();
      }
      break;
    }
    // POP PSW
    case 0xf1: {
      this.intermediateState.flags.content = this.intermediateState.code[this.intermediateState.SP.intValue & 0xffff];
      this.intermediateState.registers.A.content = this.intermediateState.code[this.intermediateState.SP.intValue + 1 & 0xffff];
      this.intermediateState.SP.intValue += 2;
      break;
    }
    // JP a
    case 0xf2: {
      if (!this.intermediateState.flags.getSign()) {
        jmp();
      }
      break;
    }
    // DI
    case 0xf3: {
      // CAN BE USER DEFINED
      break;
    }
    // CP a
    case 0xf4: {
      if (!this.intermediateState.flags.getSign()) {
        call();
      }
      break;
    }
    // PUSH PSW
    case 0xf5: {
      this.intermediateState.code[this.intermediateState.SP.intValue - 2 & 0xffff] = this.intermediateState.flags.content;
      this.intermediateState.code[this.intermediateState.SP.intValue - 1 & 0xffff] = this.intermediateState.registers.A.content;
      this.intermediateState.SP.intValue -= 2;
      break;
    }
    // ORI n
    case 0xf6: {
      const result = ora(this.intermediateState.registers.A.content, this.fetchByte());
      this.intermediateState.registers.A.content = result.result;
      this.intermediateState.flags.setFlags(result.flags);
      break;
    }
    // RST 6
    case 0xf7: {
      // CAN BE USER DEFINED
      break;
    }
    // RM
    case 0xf8: {
      if (this.intermediateState.flags.getSign()) {
        ret();
      }
      break;
    }
    // SPHL
    case 0xf9: {
      this.intermediateState.PC.intValue = this.getRegisterPair(this.intermediateState.registers.H, this.intermediateState.registers.L);
      break;
    }
    // JM a
    case 0xfa: {
      if (this.intermediateState.flags.getSign()) {
        jmp();
      }
      break;
    }
    // EI
    case 0xfb: {
      // CAN BE USER DEFINED
      break;
    }
    // CM a
    case 0xfc: {
      if (this.intermediateState.flags.getSign()) {
        call();
      }
      break;
    }
    // USER DEFINED
    case 0xfd: {
      break;
    }
    // CPI n
    case 0xfe: {
      const flags = cmp(this.intermediateState.registers.A.content, this.fetchByte());
      this.intermediateState.flags.setFlags(flags);
      break;
    }
    // RST 7
    case 0xff: {
      // CAN BE USER DEFINED
      break;
    }
    default: {
      throw new Error('nieznany opcode');
    }
    }
  }

  private async updateAssemblerCode(newCode: Array<HexNum>): Promise<void> {
    await this.setState({ code: newCode });
  }

  public render(): JSX.Element {
    return (
      <div className="bg-dark text-white mw-100 mh-100 d-flex flex-column">
        <MemoryView code={this.state.code} currentPC={this.state.PC.intValue} updateAssemblerCode={this.updateAssemblerCode.bind(this)} />
        <div className="d-flex flex-row flex-fill">
          <CPUView { ...this.state } />
          <TerminalView ref={this.terminalRef} acceptsInput={this.state.acceptInput} inputType={this.state.inputType} />
          <ControlButtons
            executionEnded={this.state.executionEnded}
            mode={this.props.mode}
            resumeExecution={(): void => {
              void this.resumeExecution();
            }}
            setParentState={(p): void => {
              this.props.changeExecutingState(p);
            }}
            restart={(): void => {
              this.restart();
            }}
            setExecutionMode={async(mode: ExecutionMode): Promise<void> => {
              await this.setState({ executionMode: mode });
            }}
            awaitInput={this.state.acceptInput}
          />
        </div>
        <InstructionsView instructions={this.props.assemblerOutput} currentPC={this.state.PC.intValue} debug={this.props.mode === ExecutionMode.DEBUG}/>
      </div>
    );
  }
}
