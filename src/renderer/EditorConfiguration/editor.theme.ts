const white = '#ffffff';
const orange = '#CB772F';
const blue = '#6897BB';
const yellow = '#FFC66D';
const lightBlue = '#BED6FF';
const green = '#619647';
const purple = '#9876AA';
const lightGreen = '#A5C25C';
const red = '#FF5555';
const dark = '#2B2B2B';

const theme = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'other', foreground: white },
    { token: 'mnemonic', foreground: orange, fontStyle: 'bold' },
    { token: 'number', foreground: blue },
    { token: 'register', foreground: yellow },
    { token: 'declaration', foreground: lightBlue },
    { token: 'comment ', foreground: green, fontStyle: 'italic' },
    { token: 'label', foreground: purple },
    { token: 'quotes', foreground: lightGreen },
    { token: 'expression', foreground: red }
  ],
  colors: {
    'editor.background': dark
  }
};

export default theme;
