import * as React from 'react';
import { createRef, ReactPropTypes } from 'react';
import Parser from '@main/assembler/Parser';
import assemble, { AssembleError, LinesWithOpcodes } from '@main/assembler/assemble';
import Editor from './EditorComponents/editor.component';
import CPU from '@/renderer/components/ExecutionComponents/cpu.component';
import { remote } from 'electron';
import ExecuteButtons from '@renderer/components/EditorComponents/execute.buttons.component';
import * as fs from 'fs';

// eslint-disable-next-line no-shadow
export enum ExecutionMode {
  // eslint-disable-next-line no-unused-vars
  RUN, DEBUG, STEPS
}

export interface AppStateType {
  isExecuting: boolean;
  executionMode: ExecutionMode;
  code: string;
  breakpoints: Array<number>;
  assemblerOutput: Array<LinesWithOpcodes>;
  assembleError: AssembleError;
}

export default class App extends React.PureComponent {
  public state: AppStateType = {
    isExecuting: false,
    executionMode: -1,
    code: '',
    breakpoints: [],
    assemblerOutput: [],
    assembleError: null
  };

  private readonly editorRef: React.RefObject<Editor>;

  public constructor(props: ReactPropTypes) {
    super(props);
    this.state = {
      isExecuting: false,
      executionMode: -1,
      code: '',
      breakpoints: [],
      assemblerOutput: [],
      assembleError: null
    };

    this.editorRef = createRef<Editor>();
  }

  private assemble(): Array<LinesWithOpcodes> {
    const { code, breakpoints } = this.editorRef.current.getEditorValueAndBreakpoints();
    this.setState({ code: code, breakpoints: breakpoints });
    const parser = new Parser();
    return assemble(parser.parse(code, breakpoints));
  }

  private runProgram(mode: ExecutionMode): void {
    try {
      this.setState({ assemblerOutput: this.assemble(), isExecuting: true, executionMode: mode, assembleError: null });
    } catch (e) {
      this.setState({ assemblerOutput: [], isExecuting: true, executionMode: ExecutionMode.RUN, assembleError: e as AssembleError });
    }
  }

  private build(): void {
    const assemblerOutput = this.assemble();
    const result = remote.dialog.showSaveDialogSync({
      title: 'Export memory', buttonLabel: 'Export',
      filters: [
        { name: 'Text file', extensions: ['txt'] }
      ]
    });
    if (result) {
      fs.writeFile(result, assemblerOutput.map(arg => arg.bytes.map(byte => byte.toHex())).flat().join(' '), err => {
        if (err) {
          throw err;
        }
      });
    }
  }

  public render(): JSX.Element {
    return !this.state.isExecuting ?
      <div className="bg-dark text-white vw-100 vh-100 d-flex">
        <Editor code={this.state.code} breakpoints={this.state.breakpoints} ref={this.editorRef}/>
        <ExecuteButtons steps={() : void => {
          void this.runProgram(ExecutionMode.STEPS);
        }} run={() : void => {
          void this.runProgram(ExecutionMode.RUN);
        }} debug={() : void => {
          void this.runProgram(ExecutionMode.DEBUG);
        }} build={() : void => {
          this.build();
        }} />
      </div> :
      <CPU mode={this.state.executionMode} error={this.state.assembleError} assemblerOutput={this.state.assemblerOutput} changeExecutingState={(state: { isExecuting: boolean; }): void => {
        this.setState(state);
      }}/>;
  }
}
