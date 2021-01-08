/*
MIT License

Copyright (c) 2020 Rick MacDonald

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// This is the server side (node.js) part of this Electron application.

const { app, BrowserWindow, dialog, ipcMain} = require('electron')
const url = require('url')
const path = require('path')

let win;
let winHeight;
let connected = false; // this is to track the state of the JS8Call API connection


if(process.platform !== 'darwin')
    winHeight = 640; // make room for the menu bar for windows and linux
else
    winHeight = 600;


const dialogOptions = {
    type: 'question',
    buttons: ['OK', 'Cancel'],
    defaultId: 1,
    title: 'License Agreement',
    message: 'This application is open source software licensed under the MIT license',
    detail: 'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR ' +
        'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, ' +
        'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE ' +
        'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER ' +
        'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, ' +
        'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE ' +
        'SOFTWARE.',
  };
  
function quitApp()
{   app.quit();
}
  
function createWindow() 
{
  // Create the browser window.
  win = new BrowserWindow({
    width: 800,
    height: winHeight,
    webPreferences: {
      nodeIntegration: true
    }
  });

  // and load the index.html of the app.
  win.loadURL(url.format ({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }));
  
  // Open the DevTools for testing if needed
  win.webContents.openDevTools();
  
  win.webContents.on('did-finish-load', () => {
      var title = win.getTitle();
      var version = app.getVersion();
  
      win.setTitle(title + " v" + version);
      
      const firstRun = require('electron-first-run');

      const isFirstRun = firstRun()   
      
      const configPath = path.join(app.getPath('userData'), 'FirstRun', 'electron-app-first-run');
      console.log(configPath);

       
      if(isFirstRun)
      {  
          const dialogResponse = dialog.showMessageBoxSync(null, dialogOptions);      
      
          if(dialogResponse == 1)
          {
            setTimeout(quitApp, 100);
            
            firstRun.clear();
          }
      }
      
      // If we have connected to JS8Call already show it in UI
      win.webContents.send('apistatus', "connected"); 
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
});

// listener for buttonall
ipcMain.on("sendall",(e, data)=>{
  sendToJS8Call(data);
});

// listener for buttonnew
ipcMain.on("sendnew",(e, data)=>{
  sendToJS8Call(data);
});

// listener for buttonrevised
ipcMain.on("sendrevised",(e, data)=>{
  sendToJS8Call(data);
});

function timeoutCheck()
{
    //console.log(connected);
    
    if(!connected)
    {
        //js8.tcp.connect(); // doesn't exist yet :-)
    }
}

setInterval(timeoutCheck, 5000);

/*
    *** This is the JS8Call interface using lib-js8call ***
*/

const js8 = require('@trippnology/lib-js8call')({
    tcp: { enabled: true, port: 2442 },
    udp: { enabled: false, port: 2242,  },
    //get_metadata_at_launch: false,
    //exit_when_js8call_closed: false,
});

js8.on('tcp.connected', (connection) => {
    // At this point, we have setup the connection
    console.log(
        'Server listening %s:%s Mode: %s',
        connection.address,
        connection.port,
        connection.mode
    );
    
    connected = true;
    win.webContents.send('apistatus', "connected"); // indicate in UI we are connected
});

js8.on('tcp.disconnected', (s) => {
    // Lost the tcp connection
    console.log(s);
    
    connected = false;
    win.webContents.send('apistatus', "disconnected"); // indicate in UI we are disconnected
});

js8.on('tcp-error', (e) => {
    // tcp error
    console.log();
});

// Only listen to events you are interested in.
js8.on('ping', (packet) => {
	console.log('[Ping] %s v%s', packet.params.NAME, packet.params.VERSION);
});

function successCallback(result) {
  console.log(result);
}

function failureCallback(error) {
  console.error(error);
}

js8.on('rig.freq', (packet) => {
    //js8.rx.getText().then(successCallback, failureCallback);
    //js8.rx.getCallActivityExtended().then(successCallback, failureCallback);	
    //js8.rx.getCallActivityDetailed().then(successCallback, failureCallback);	
    
	console.log(
		'[Rig] Frequency has been changed to %s (%s). Offset: %s',
		packet.params.DIAL,
		packet.params.BAND,
		packet.params.OFFSET
	);
});

js8.on('rig.ptt', (packet) => {
	console.log('[Rig] PTT is %s', packet.value);
	js8.tx.getText().then(successCallback, failureCallback);
});

js8.on('rx.to_me', (packet) => {
	console.log('[Message to me] %s', packet.value);
});

js8.on('station.callsign', (packet) => {
	console.log('Station Callsign: %s', packet.value);
});

js8.on('rx.to_me', (packet) => {
	/*
	 * At this point, you know this is a message to you
	 * such as "M7GMT: VA1UAV SNR -02 ~" and you can act as you wish.
	 */
	console.log("message to me");
	//console.log(packet);
});

js8.on('packet', (packet) => {
    // Do your custom stuff
    //console.log(packet);
});

js8.on('rx.activity', (packet) => {
    // Do your custom stuff
    console.log(packet);
    win.webContents.send('activity', packet);
});


