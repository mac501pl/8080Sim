import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null;

class fsHandler {
  public static modified: boolean;
  public static previousFilePath: string;
  public static previouslySavedFile: string;
  public static mainWindowTitle = '8080 Simulator';
  public static readonly modifiedIndicator = '*'

  public static getSaveFilePath(): string {
    return dialog.showSaveDialogSync(mainWindow, {
      title: 'Save', buttonLabel: 'Save',
      filters: [
        { name: 'ASM file', extensions: ['asm'] },
        { name: 'Text file', extensions: ['txt'] },
        { name: 'All files', extensions: ['*'] }
      ]
    });
  }

  public static handleSave(): void {
    mainWindow.webContents.send('save');
    ipcMain.once('code', (_event, args) => {
      if (!fsHandler.previousFilePath) {
        const result = fsHandler.getSaveFilePath();
        if (result) {
          fsHandler.previousFilePath = result;
        } else {
          return;
        }
      }
      fs.writeFile(fsHandler.previousFilePath, args as string, err => {
        if (err) {
          throw err;
        }
        fsHandler.modified = false;
        fsHandler.mainWindowTitle = path.basename(fsHandler.previousFilePath);
        mainWindow.setTitle(fsHandler.mainWindowTitle);
        fsHandler.previouslySavedFile = args as string;
      });
    });
  }

  public static handleSaveAs(): void {
    fsHandler.previousFilePath = undefined;
    fsHandler.handleSave();
  }

  public static handleOpen(): void {
    if (!fsHandler.displayModifiedWarning()) {
      return;
    }
    try {
      const result = dialog.showOpenDialogSync(mainWindow, {
        title: 'Open', buttonLabel: 'Open',
        filters: [
          { name: 'ASM file', extensions: ['asm'] },
          { name: 'Text file', extensions: ['txt'] },
          { name: 'All files', extensions: ['*'] }
        ],
        properties: [
          'openFile'
        ]
      });
      if (!result) {
        return;
      }
      const filePath = result[0];
      fs.readFile(filePath, 'utf-8', (err, data) => {
        if (err) {
          throw err;
        }
        fsHandler.previousFilePath = filePath;
        mainWindow.webContents.send('open', data);
        fsHandler.handleSave();
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('Open failed');
    }
  }

  public static displayModifiedWarning(): boolean {
    if (fsHandler.modified) {
      const result = dialog.showMessageBoxSync(
        mainWindow,
        {
          type: 'warning',
          title: 'Warning',
          message: 'You have unsaved changes. Are you sure you want to continue?',
          buttons: ['Yes', 'No'],
          defaultId: 0,
          cancelId: 1
        });
      return result === 0;
    }
    return true;
  }
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      worldSafeExecuteJavaScript: true,
      enableRemoteModule: true,
      devTools: true
    },
    title: '8080 simulator',
    backgroundColor: '#343a40',
    darkTheme: true,
    minWidth: 1250,
    minHeight: 770,
    show: false
  });

  void mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, './index.html'),
      protocol: 'file:',
      slashes: true
    })
  );

  mainWindow.on('close', e => {
    if (!fsHandler.displayModifiedWarning()) {
      e.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: (): void => fsHandler.handleOpen()
        },
        { label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: (): void => fsHandler.handleSave()
        },
        { label: 'Save as...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: (): void => fsHandler.handleSaveAs()
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Code',
      submenu: [
        { label: 'Autoformat',
          accelerator: 'Alt+Shift+F',
          click: (): void => mainWindow.webContents.send('autoformat')
        }
      ]
    },
    {
      label: 'Dev',
      submenu: [
        { role: 'toggleDevTools' }
      ]
    }
  ]);

  Menu.setApplicationMenu(menu);

  mainWindow.on('page-title-updated', e => {
    e.preventDefault();
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  ipcMain.on('changed', (_event, args) => {
    fsHandler.modified = fsHandler.previouslySavedFile !== args as string;
    mainWindow.setTitle(`${fsHandler.modified ? fsHandler.modifiedIndicator : ''}${fsHandler.mainWindowTitle}`);
  });
}

app.on('ready', createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});
