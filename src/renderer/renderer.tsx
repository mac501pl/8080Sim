import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from './components/App';

import '@public/styles/style.scss';
import 'bootstrap/dist/css/bootstrap.min.css';

ReactDOM.render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>
  ,
  document.getElementById('root')
);
