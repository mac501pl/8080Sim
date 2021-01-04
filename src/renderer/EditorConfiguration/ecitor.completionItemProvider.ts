import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import instructionList, { IInstruction } from '@/main/instruction_list';
import { uniqueByMnemonic } from '@utils/Utils';
import keywords from './keywords';

type CompletionItemProvider = monaco.languages.CompletionItemProvider;
type ITextModel = monaco.editor.ITextModel;
type Position = monaco.Position;
type ProviderResult<T> = monaco.languages.ProviderResult<T>;
type CompletionList = monaco.languages.CompletionList;
type CompletionItem = monaco.languages.CompletionItem;
type IRange = monaco.IRange;

const uniqueInstructionsByMnemonics = uniqueByMnemonic(instructionList);

const generateDocumentationForInstruction = (instruction: IInstruction): string => {
  const { mnemonic, flags, size } = instruction;
  const documentation = [
    `Mnemonic: ${mnemonic}`,
    `Modified flags: [${flags.join(', ')}]`,
    `Size: ${size}`
  ];
  return documentation.join('\n');
};

const createPseudoInstructionSuggestions = (range: IRange):Array<CompletionItem> => keywords.pseudoInstructionKeywords.map(pseudoInstruction => ({
  range: range,
  label: pseudoInstruction,
  insertText: pseudoInstruction,
  kind: monaco.languages.CompletionItemKind.Keyword
}));

const createMnemonicSuggestions = (range: IRange):Array<CompletionItem> => uniqueInstructionsByMnemonics.map(instruction => ({
  range: range,
  label: instruction.mnemonic,
  insertText: instruction.mnemonic,
  documentation: generateDocumentationForInstruction(instruction),
  kind: monaco.languages.CompletionItemKind.Function
}));

const createExpressionSuggestions = (range: IRange):Array<CompletionItem> => keywords.expressionKeywords.map(expression => ({
  range: range,
  label: expression,
  insertText: expression,
  kind: monaco.languages.CompletionItemKind.Keyword
}));

const createDeclarationSuggestions = (range: IRange):Array<CompletionItem> => keywords.declarationKeywords.map(declarationType => ({
  range: range,
  label: declarationType,
  insertText: declarationType,
  kind: monaco.languages.CompletionItemKind.Keyword
}));

export const completionItemProvider: CompletionItemProvider = {
  provideCompletionItems: (model: ITextModel, position: Position): ProviderResult<CompletionList> => {
    const word = model.getWordUntilPosition(position);
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn
    };
    return ({
      suggestions: [...createMnemonicSuggestions(range), ...createExpressionSuggestions(range), ...createDeclarationSuggestions(range), ...createPseudoInstructionSuggestions(range)]
    });
  }
};
