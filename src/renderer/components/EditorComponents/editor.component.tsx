import * as React from 'react';
import { languageDefinition, MonarchLanguageConfiguration } from '@renderer/EditorConfiguration/Intel8080LanguageDefinition';
import { completionItemProvider } from '@/renderer/EditorConfiguration/ecitor.completionItemProvider';
import prettify from '@/renderer/EditorConfiguration/editor.documentFormattingProvider';
import { ipcRenderer } from 'electron';
import { editor } from 'monaco-editor';
import * as monacoEditor from 'monaco-editor';
import { instructionRegex } from '@utils/Regex';
import MonacoEditor from 'react-monaco-editor';
import theme from '@renderer/EditorConfiguration/editor.theme';
import { createModelMarkers } from '@renderer/EditorConfiguration/editor.model.markers';
import IEditorMouseEvent = editor.IEditorMouseEvent;
import MouseTargetType = editor.MouseTargetType;

interface EditorPropTypes {
  code: string;
  breakpoints: Array<number>;
}

interface EditorStateTypes {
  windowWidth: number;
}

export default class Editor extends React.PureComponent<EditorPropTypes, EditorStateTypes> {
  private readonly languageId: string;
  private readonly themeId: string;
  private readonly handleResize: () => void;
  private breakpoints: Array<number>;
  private monacoEditor: monacoEditor.editor.IStandaloneCodeEditor;
  private monaco: typeof monacoEditor;
  private monarchTokensProvider: monacoEditor.IDisposable;
  private completionItemProvider: monacoEditor.IDisposable;
  private documentFormattingEditProvider: monacoEditor.IDisposable;
  private timeoutId: ReturnType<typeof setTimeout>;

  public constructor(props: EditorPropTypes) {
    super(props);
    this.languageId = '8080asm';
    this.themeId = '8080-dark';
    this.breakpoints = props.breakpoints;
    this.handleResize = (): void => {
      this.setState({ windowWidth: window.innerWidth });
    };

    this.state = {
      windowWidth: window.innerWidth
    };
  }

  public getEditorValueAndBreakpoints(): {code: string, breakpoints: Array<number>} {
    return { code: this.monacoEditor.getValue(), breakpoints: this.breakpoints };
  }

  public componentWillUnmount(): void {
    ipcRenderer.removeAllListeners('save');
    ipcRenderer.removeAllListeners('open');
    ipcRenderer.removeAllListeners('autoformat');
    window.removeEventListener('resize', this.handleResize);
    this.monarchTokensProvider.dispose();
    this.completionItemProvider.dispose();
    this.documentFormattingEditProvider.dispose();
  }

  public componentDidMount(): void {
    window.addEventListener('resize', this.handleResize);
  }

  // eslint-disable-next-line no-shadow
  public editorDidMount(editor: monacoEditor.editor.IStandaloneCodeEditor, monaco: typeof monacoEditor): void {
    this.monacoEditor = editor;
    this.monaco = monaco;

    editor.focus();

    this.props.breakpoints.forEach(breakpoint => {
      this.addBreakPoint(breakpoint);
    });

    ipcRenderer.on('save', event => {
      event.sender.send('code', editor.getValue());
    });

    ipcRenderer.on('open', (_event, args) => {
      editor.setValue(args as string);
    });

    ipcRenderer.on('autoformat', () => {
      void editor.getAction('editor.action.formatDocument').run();
    });

    editor.onMouseDown((e: IEditorMouseEvent) => {
      if (e.target.type === MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const lineNumber = e.target.position.lineNumber;
        if (!this.hasBreakPoint(lineNumber)) {
          const line = editor.getValue().split('\n')[lineNumber - 1];
          if (instructionRegex.exec(line)) {
            this.addBreakPoint(lineNumber);
          }
        } else {
          this.removeBreakPoint(lineNumber);
        }
      }
    });

    editor.onDidChangeModelDecorations(() => {
      this.breakpoints = editor.getModel().getAllDecorations().filter(decoration => decoration.options.glyphMarginClassName === 'breakpoint').map(decoration => decoration.range.startLineNumber);
    });
  }

  public editorWillMount(monaco: typeof monacoEditor): void {
    monaco.languages.register({ id: this.languageId });
    this.monarchTokensProvider = monaco.languages.setMonarchTokensProvider(this.languageId, languageDefinition as MonarchLanguageConfiguration);
    this.completionItemProvider = monaco.languages.registerCompletionItemProvider(this.languageId, completionItemProvider);
    monaco.editor.defineTheme(this.themeId, theme as editor.IStandaloneThemeData);
    this.documentFormattingEditProvider = monaco.languages.registerDocumentFormattingEditProvider(this.languageId, {
      provideDocumentFormattingEdits: model => [{
        text: prettify(model.getValue()),
        range: model.getFullModelRange()
      }]
    });
  }

  private removeBreakPoint(lineNumber?: number): void {
    const decorations = lineNumber ? this.monacoEditor.getLineDecorations(lineNumber) : this.monacoEditor.getModel().getAllDecorations();
    const ids = decorations.map(decoration => decoration.id);
    this.monacoEditor.deltaDecorations(ids, []);
  }

  private hasBreakPoint(lineNumber: number): boolean {
    return Boolean(this.monacoEditor.getLineDecorations(lineNumber).some(decoration => decoration.options.glyphMarginClassName));
  }

  private addBreakPoint(lineNumber: number): void {
    const newDecoration = {
      options: {
        glyphMarginClassName: 'breakpoint'
      },
      range: {
        startLineNumber: lineNumber,
        startColumn: 1,
        endLineNumber: lineNumber,
        endColumn: 1
      }
    };
    this.monacoEditor.deltaDecorations([], [newDecoration]);
  }

  public onChange(newValue: string, _e: monacoEditor.editor.IModelContentChangedEvent): void {
    ipcRenderer.send('changed', newValue);
    clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => this.monaco.editor.setModelMarkers(this.monacoEditor.getModel(), 'checkSyntax', createModelMarkers(newValue)), 1000);

    const pos = this.monacoEditor.getPosition();
    if (pos) {
      const line = pos.lineNumber;
      if (this.hasBreakPoint(line)) {
        this.removeBreakPoint(line);
        this.addBreakPoint(line);
      }
    }
  }

  public render(): JSX.Element {
    return <MonacoEditor
      width={this.state.windowWidth - 60}
      language={this.languageId}
      theme={this.themeId}
      defaultValue={this.props.code}
      options={{ mouseWheelZoom: true,
        minimap: {
          enabled: false
        },
        fontFamily: 'Consolas',
        cursorSmoothCaretAnimation: true,
        cursorBlinking: 'smooth',
        automaticLayout: true,
        formatOnPaste: true,
        glyphMargin: true }}
      onChange={this.onChange.bind(this)}
      editorDidMount={this.editorDidMount.bind(this)}
      editorWillMount={this.editorWillMount.bind(this)}
    />;
  }
}
