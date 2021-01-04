import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { number } from '@utils/Regex';
import keywords from './keywords';

export interface MonarchLanguageConfiguration extends monaco.languages.IMonarchLanguage {
  mnemonics: Array<string>;
  declarationKeywords: Array<string>;
  registerKeywords: Array<string>;
  macroKeywords: Array<string>;
  expressionKeywords: Array<string>;
}

export const languageDefinition = {
  ignoreCase: true,
  defaultToken: 'other',
  mnemonics: keywords.mnemonicKeywords,
  pseudoInstructions: keywords.pseudoInstructionKeywords,
  declarationKeywords: keywords.declarationKeywords,
  registerKeywords: keywords.registerKeywords,
  macroKeywords: keywords.macroKeywords,
  expressionKeywords: keywords.expressionKeywords,
  tokenizer: {
    root: [
      [/;.*/, 'comment'],
      [/\w+:/, 'label'],
      [new RegExp(number), 'number'],
      [/'.*?'/, 'quotes'],
      [/[a-z_$%][\w$]*/,
        { cases:
          {
            '@mnemonics': 'mnemonic',
            '@pseudoInstructions': 'mnemonic',
            '@declarationKeywords': 'declaration',
            '@registerKeywords': 'register',
            '@macroKeywords': 'macro',
            '@expressionKeywords': 'expression'
          }
        }
      ]
    ]
  }
};
