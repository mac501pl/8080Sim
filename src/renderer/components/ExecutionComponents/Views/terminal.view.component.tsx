import * as React from 'react';
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import HexNum from '@main/assembler/Types/HexNum';

interface TerminalViewPropTypes {
  acceptsInput: boolean;
  inputType: InputType;
}

interface TerminalViewState {
  lastInput: string;
}

// eslint-disable-next-line no-shadow
export enum InputType {
  // eslint-disable-next-line no-unused-vars
  RST2, RST5
}

export default class TerminalView extends React.PureComponent<TerminalViewPropTypes, TerminalViewState> {
  public terminal: Terminal;

  public state: {
    lastInput: '';
  }

  public constructor(props: TerminalViewPropTypes) {
    super(props);

    this.state = {
      lastInput: ''
    };
  }

  private breakLine(): void {
    this.terminal.write('\n\r');
    document.dispatchEvent(new CustomEvent<string>('line-break', { detail: this.state.lastInput }));
    this.setState({ lastInput: '' });
  }

  private backspace(): void {
    this.terminal.write('\b \b');
    this.setState({ lastInput: this.state.lastInput.slice(0, -1) });
  }

  private writeKey(key: string): void {
    this.terminal.write(key);
    this.setState({ lastInput: this.state.lastInput + key });
  }

  public writeKeys(keys: string): void {
    this.terminal.write(keys);
  }

  public componentDidMount(): void {
    this.terminal = new Terminal({
      cols: 100,
      rows: 18,
      cursorStyle: 'underline',
      cursorBlink: true,
      fontFamily: 'Consolas',
      theme: {
        background: '#343a40'
      }
    });
    this.terminal.open(document.getElementById('terminal'));

    this.terminal.onData(e => {
      const lastInputLength = this.state.lastInput.length;
      switch (e) {
      case '\n':
      case '\r':
        this.breakLine();
        break;
      case '\u007F':
        if (lastInputLength > 0) {
          this.backspace();
        }
        break;
      default:
        switch (this.props.inputType) {
        case InputType.RST2:
          if (lastInputLength < 1) {
            this.writeKey(e);
          }
          break;
        case InputType.RST5:
          if ((/[0-9A-FOBH]/i).exec(e)) {
            this.writeKey(e);
          }
          break;
        default:
          return;
        }
      }
    });
  }

  public writeToTerminal(str: Array<HexNum>): void {
    str.forEach(char => {
      if (char.intValue === 13) {
        this.terminal.write('\r');
      } else if (char.intValue === 10) {
        this.terminal.write('\n');
      } else {
        this.terminal.write(char.toAscii());
      }
    });
  }

  public writeError(str: string): void {
    this.terminal.writeln(`\x1b[1;31m${str.split('\n').join('\n\r')}\x1b[37m`);
  }

  public render(): JSX.Element {
    return (
      <div className="border rounded border-white p-1" id="terminal" />
    );
  }
}
