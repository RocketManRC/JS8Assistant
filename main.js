/*
MIT License

Copyright (c) 2021 Rick MacDonald (VA1UAV)
https://www.rocketmanrc.com

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

const { app, BrowserWindow, Menu, dialog, ipcMain} = require('electron');
const url = require('url');
const path = require('path');
const JSONStorage = require('node-localstorage').JSONStorage;
const fs = require('fs');
const log = require('electron-log');
const preferences = require('./preferences');
const nodeCleanup = require('node-cleanup');
const callsign = require('callsign/src/node');

console.log = log.log;
let logPath = log.transports.file.getFile().path;
log.transports.file.level = false;
fs.truncateSync(logPath); // clear what was in the log file previously
log.transports.file.level = true;
console.log(logPath);

let win; // the main application window
let winQsoHistory; // the window for QSO History
let winHeight;
let winWidth;
let connected = false; // this is to track the state of the JS8Call API connection

var config = require('./config');
const { Console } = require('console');
let qsodatadir = config.qsodatadir;

let mycallsign = "";
let preferencesChanged = false;
var preferencesTimer;

let js8host = preferences.value('settings.remote_ip');
console.log('remote_ip: ' + js8host);

let storageLocation = app.getPath('userData');
let nodeStorage = new JSONStorage(storageLocation);
console.log(storageLocation);

// The following is to handle the addition of font_size to preferences (in v0.30.0)
// otherwise the window isn't sized properly after the update.
if(!preferences.value('settings.font_size'))
{
    preferences.value('settings.font_size', '14');
    nodeStorage.removeItem('mainWindowState'); // the window height is less when specifying the font size
}

// Subscribing to preference changes.
preferences.on('save', (preferences) => {
    // unfortunately this is called every time a text box is updated which is not much use for me
    // therefore we are going to set a flag and check every 100 ms if the window is closed.
    preferencesChanged = true;

    preferencesTimer = setInterval(preferencesCheck, 100);
});

function preferencesCheck()
{
    if(preferencesChanged)
    {
        try
        {
            let closed = preferences.prefsWindow.closed;
        }
        catch
        {
            console.log("preferences window closed");
            preferencesChanged = false;
            clearInterval(preferencesTimer);

            // you can update the variables from the preferences now
            let cs = preferences.value('settings.call_sign');
            console.log("callsign from preferences: ");
            mycallsign = cs.toUpperCase();
            console.log(mycallsign);

            js8host = preferences.value('settings.remote_ip');
            console.log("js8host from preferences: ");
            console.log(js8host);

            let distanceUnit = preferences.value('settings.distance_unit');
            win.webContents.send('distanceunit', distanceUnit); 
            console.log("distanceunit from preferences: ");
            console.log(distanceUnit);
        }        
    }
}

process.on('unhandledRejection', (error, p) => {
    //console.log('=== UNHANDLED REJECTION ===');
    //console.dir(error.stack);
});

if(process.platform !== 'darwin')
{
    winHeight = 698; // make room for the menu bar for windows and linux
    winWidth = 864;
    //menuTemplate.unshift({}); // Needed for Windows???
}
else
{
    winHeight = 660;
    winWidth = 847;
}

// make the data directory if it doesnt exist (default is '~/.js8assistant/qsodata')
if(qsodatadir == "")
{
    const homedir = require('os').homedir();
    console.log('homedir: ' + homedir);
    console.log(process.env.LOCALAPPDATA);
    if(process.env.LOCALAPPDATA != undefined) // Windows?
        qsodatadir = homedir + '\\.js8assistant\\qsodata'; // this is the default data directory for Windows
    else
        qsodatadir = homedir + '/.js8assistant/qsodata';    // and for Linux and MacOS
    console.log('qsodatadir: ' + qsodatadir);

    if(!fs.existsSync(qsodatadir))
    {
        fs.mkdirSync(qsodatadir, { recursive: true }); // make the directory recursively if it doesn't exist
    }
}
else
{
    console.log('qsodatadir: ' + qsodatadir);
}

let mainWindowState = {}; 
let qsoWindowState = {}; 

try 
{ 
  mainWindowState = nodeStorage.getItem('mainWindowState'); 
} 
catch (err) 
{ 
  console.log("problem with mainWindowState: " + err);

  mainWindowState = {};
}

try 
{ 
  qsoWindowState = nodeStorage.getItem('qsoWindowState'); 
} 
catch (err) 
{ 
  console.log("problem with qsoWindowState: " + err);

  qsoWindowState = {};
}

if(!mainWindowState)
{
    console.log('Create a default mainWindowState');

    mainWindowState = {};
    mainWindowState.bounds = { width: winWidth, height: winHeight };
}

if(!qsoWindowState)
{
    console.log('Create a default qsoWindowState');

    qsoWindowState = {};
    qsoWindowState.bounds = { width: 747, height: winHeight + 100 };
}

console.log('mainWindowState.bounds: ' + mainWindowState.bounds);
console.log('qsoWindowState.bounds: ' + qsoWindowState.bounds);
    
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
{   
    app.quit();
}
  
function createWindow() 
{
    console.log("Storage location: " + storageLocation);

    win = new BrowserWindow({
        //width: 847,
        //height: winHeight,
        width: mainWindowState.bounds.width,
        height: mainWindowState.bounds.height,
        x: mainWindowState.bounds.x,
        y: mainWindowState.bounds.y,
        webPreferences: {
        defaultFontSize: preferences.value('settings.font_size'),
        contextIsolation: false, 
        nodeIntegration: true
        }
    });

    win.setTitle('JS8Assistant');

  // and load the index.html of the app.
  win.loadURL(url.format ({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }));
  
  // Open the DevTools for testing if needed
  //win.webContents.openDevTools();

  const storemainWindowState = function() 
  { 
    let ws = {}; 
    ws.bounds = win.getBounds(); 

    //console.log(ws);
   
    nodeStorage.setItem('mainWindowState', ws); 
  };
  
  win.on('page-title-updated', function(e) {
    e.preventDefault();
  });

  win.on('move', () => {
    storemainWindowState();
  });
  
  win.on('resize', () => {
    storemainWindowState();
  });
  
  win.webContents.on('did-finish-load', () => {
      let title = win.getTitle();
      let version = app.getVersion();
  
      win.setTitle(title + " v" + version);
      
      const firstRun = require('electron-first-run');

      const isFirstRun = firstRun()   
      
      const configPath = path.join(app.getPath('userData'), 'FirstRun', 'electron-app-first-run');
      //console.log(configPath);

       
      if(isFirstRun)
      {  
          const dialogResponse = dialog.showMessageBoxSync(null, dialogOptions);      
      
          if(dialogResponse == 1)
          {
            setTimeout(quitApp, 100);
            
            firstRun.clear();
          }
      } 

      let cs = preferences.value('settings.call_sign');
      console.log("callsign from preferences: ");
      console.log(cs);

      if(cs == null)
      {
        preferences.show();
      }
      else
      {
        mycallsign = cs.toUpperCase();
        console.log(mycallsign);
      }

      if(connected)
        win.webContents.send('apistatus', "connected"); // indicate in UI we are connected

      win.webContents.send('qsodatadir', qsodatadir); 
    });
}

let qsoHistoryWindowCallsign = ""; // we only want one window to open so keep track of it with this callsign variable

function createQsoHistoryWindow(callsign) 
{
  if(qsoHistoryWindowCallsign == callsign)
  {
    // show it if it exists already and return
    winQsoHistory.show();

    return;
  }
  else if(qsoHistoryWindowCallsign != "")
  {
      winQsoHistory.destroy();
  }

  qsoHistoryWindowCallsign = callsign;

  // We have to get the windowstate here too because this window will be opened and closed
  try 
  { 
    let qws = nodeStorage.getItem('qsoWindowState'); 

    if(qws)
        qsoWindowState = qws;
  } 
  catch (err) 
  { 
    console.log("problem with qsoWindowState: " + err);
  
    qsoWindowState = {};
  }
  
    // Create the browser window.
  winQsoHistory = new BrowserWindow({
    //width: 747,
    //height: winHeight + 100,
    width: qsoWindowState.bounds.width,
    height: qsoWindowState.bounds.height,
    x: qsoWindowState.bounds.x,
    y: qsoWindowState.bounds.y,
    webPreferences: {
      contextIsolation: false, 
      nodeIntegration: true
    }
  });
  
  //winQsoHistory.webContents.openDevTools();

  const storeqsoWindowState = function() 
  { 
    let ws = {}; 
    ws.bounds = winQsoHistory.getBounds(); 

    //console.log(ws);
   
    nodeStorage.setItem('qsoWindowState', ws); 
  };

  winQsoHistory.on('move', () => {
    storeqsoWindowState();
  });
  
  winQsoHistory.on('resize', () => {
    storeqsoWindowState();
  });

  // and load the index.html of the app.
  winQsoHistory.loadURL(url.format ({
    pathname: path.join(__dirname, 'indexQsoHistory.html'),
    protocol: 'file:',
    slashes: true
  }));
  
  // Open the DevTools for testing if needed
  // winQsoHistory.webContents.openDevTools();
  
  winQsoHistory.webContents.on('did-finish-load', () => {
      winQsoHistory.setTitle("QSO History");
      console.log("Sending qsodata path to history window", qsodatadir);
      winQsoHistory.webContents.send('qsodatadir', qsodatadir);
      console.log("Sending callsign to history window", callsign);
      winQsoHistory.webContents.send('callsign', callsign);
  });

  winQsoHistory.webContents.on('destroyed', () => {
    console.log('winQsoHistory destroyed');
    qsoHistoryWindowCallsign = "";
  });
}

function createWindowWithMenu()
{
    let enableFindqsos = false;
    if(fs.readdirSync(qsodatadir).length === 0)
        enableFindqsos = true;

    createWindow();
    //createQsoHistoryWindow('AB0CDE'); // for testing

    // setting up the menu
    const menu = Menu.buildFromTemplate([
    {
        label: 'Menu',
        submenu: [
        {
            label:'Open History for Call Sign',
            accelerator: 'CmdOrCtrl+O',
            // this is the main bit hijack the click event 
            click() {
                // construct the select file dialog 
                dialog.showOpenDialog({
                //defaultPath: './qsodata',
                defaultPath: qsodatadir,
                properties: ['openDirectory']
                })
                .then(function(fileObj) {
                    // the fileObj has two props 
                    if (!fileObj.canceled) {
                        createQsoHistoryWindow(path.basename(fileObj.filePaths[0]));
                    }
                })
                .catch(function(err) {
                    console.error(err)  
                })
            } 
        },
        {
            label:'Preferences...',
            accelerator: 'CmdOrCtrl+P',
            click() 
            {
                preferences.show();
            } 
        },
        {
            label:'Find QSOs in JS8Call log data',
            enabled: enableFindqsos,
            id: 'fq',
            click() 
            {
                const ProgressBar = require('electron-progressbar');

                var progressBar = new ProgressBar({
                    text: 'Finding QSO data...',
                    detail: 'Wait...'
                });
                
                progressBar
                .on('completed', function() {
                    console.info(`completed...`);
                    progressBar.detail = 'Task completed. Exiting...';
                })
                .on('aborted', function() {
                    console.info(`aborted...`);
                });
                                
                var cp = require('child_process');
                let p = path.resolve(__dirname, 'findqsos.js');

                //console.log(p);

                let sp = cp.fork(p, [mycallsign]);

                sp.on('exit', (code) => {
                    console.log(`child process exited with code ${code}`);
                    progressBar.setCompleted();
                  });
                  
                myItem = menu.getMenuItemById('fq');
                myItem.enabled = false; // assume it was going to make some data! 
            } 
        },
        {
            label:'Delete invalid QSOs',
            enabled: true,
            id: 'dq',
            click() 
            {
                const ProgressBar = require('electron-progressbar');

                var progressBar = new ProgressBar({
                    text: 'Deleting invalid QSOs...',
                    detail: 'Wait...'
                });
                
                progressBar
                .on('completed', function() {
                    console.info(`completed...`);
                    progressBar.detail = 'Task completed. Exiting...';
                })
                .on('aborted', function() {
                    console.info(`aborted...`);
                });
                                
                var cp = require('child_process');
                let p = path.resolve(__dirname, 'deleteqsos.js');

                //console.log(p);

                let sp = cp.fork(p, [logPath]);

                sp.on('exit', (code) => {
                    console.log(`child process exited with code ${code}`);
                    progressBar.setCompleted();
                  });
            } 
        },
        {
            label:'Exit',
            accelerator: 'Cmd+Q',
            click() 
            {
                app.quit()
            } 
        }
        ]
    }
    ])

    Menu.setApplicationMenu(menu)
}

app.whenReady().then(createWindowWithMenu);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindowWithMenu()
  }
});

// listener for buttonqth
ipcMain.on("displayqth",(e, data)=>{
  //sendToJS8Call(data);
  //console.log("displayqth")
});

// listener for buttonmap
ipcMain.on("displaymap",(e, data)=>{
  //sendToJS8Call(data);
  //console.log("displaymap")
});

// listener for buttonhistory
ipcMain.on("buttonhistory",(e, data)=>{
    console.log("Open history window for callsign: " + data);
    createQsoHistoryWindow(data);
});


/*
    *** This is the JS8Call interface using lib-js8call ***
*/

const js8 = require('@trippnology/lib-js8call')({
    tcp: { enabled: true, host: js8host, port: 2442 },
    udp: { enabled: false, port: 2242,  },
});

function timeoutCheck()
{
    if(!connected)
    {
        js8.tcp
            .connect() 
            //.then(() => {
            //    console.log('TCP connected');
            //})
            .catch((err) => {
                console.log("TCP can't connect yet, waiting for JS8Call...");
                //console.error(err);
            });    
    }
}

setInterval(timeoutCheck, 5000);

function requestStationInfo()
{
    js8.station.getCallsign().then((callsign) => {
        console.log('Callsign: ' + callsign);
    });
    
    js8.station.getGrid().then((grid) => {
        console.log('Grid: ' + grid);        
    });
    
    js8.mode.getSpeed().then((mode) => {
        console.log('Mode: ' + mode);
    });
}

js8.on('tcp.connected', (connection) => {
    // At this point, we have setup the connection
    console.log(
        'Server listening %s:%s Mode: %s',
        connection.address,
        connection.port,
        connection.mode
    );

    setTimeout(requestStationInfo, 100);
    
    connected = true;
    // The following only works if the window has been opened but doesn't seem to
    // cause any problems if it isn't.
    win.webContents.send('apistatus', "connected"); // indicate in UI we are connected
});

js8.on('tcp.disconnected', (s) => {
    // Lost the tcp connection
    console.log(s);
    
    connected = false;
    win.webContents.send('apistatus', "disconnected"); // indicate in UI we are disconnected
});

js8.on('tcp.error', (e) => { 
    // tcp error
    //console.log('TCP error!');
    //console.log(e);
});

process.on('error', (e) => {
    // tcp error
    console.log("Something went wrong!");
    console.log(e);
});


// START OF CODE FOR QSO RECORDING

// The folowing code handles recording a QSO.
// If there is a packet directed to me and there is not
// a qso recoding in progress one is started. At that point
// if there was a message sent by me to that callsign then 
// add it to the start of the buffer. The buffer will be saved to a file
// and then closed when a LOG.QSO packet if receieved, a directed message
// from another callsign appears or the program is closed (which ever happens first).
// That is probably not a perfect approach but probably good enough to get started...

let QsoRecordBuffer = []; // Record the QSO in a text array
let QsoRecordCallsign = ""; // This is who we are talking to
let HeartbeatReplyBuffer = []; // Keep track of HB replies here instead of starting a new QSO

function markdownText(txt)
{
    let parts = txt.split(':');
    let res = "";

    if(parts.length == 2) // just check to make sure the input is proper format, i.e. 'CALLSIGN: Rest of message...'
    {
        if(parts[0] == js8.station.callsign)
        {
            let me = parts[0];
            let msg = parts[1];
            //console.log('In markdownText() sent by me part');
            res = '<span style="color:green">' + '**' + me + ':**' + msg + '</span>\n\n'; // simple markdown + html annotation
        }
        else // it could be a reply or a directed message "to me" but without my callsign (??)
        {
            let cs = parts[0];
            let msg = parts[1];
            //console.log('In markdownText() reply part, set QsoRecordCallsign to: ' + cs);
            res = '<span style="color:blue">' + '**' + cs + ':**' + msg + '</span>\n\n'; // simple markdown + html annotation
        }
    }

    return res;
}

// Handle all directed messages sent to anyone. If we have sent to a group
// then we want to save all the traffic
js8.on('rx.directed', (packet) => 
{
    console.log('rx.directed: ' + packet.value);

    let s = packet.value.substring(packet.value.indexOf(":") + 2);	// note who is being sent to
    let recipient = s.substring(0, s.indexOf(' '));
    console.log('s: ' + s);
    console.log('recipient: ' + recipient);

    if(recipient[0] == '@' && recipient == QsoRecordCallsign) // Is it to a group we are recording?
    {
        // We are saving directed messages to this group
        console.log('Saving for group: ' + recipient);
        QsoRecordBuffer.push(markdownText(packet.value));
    }
});

js8.on('rx.directed.to_me', (packet) => 
{
    console.log(packet.value);
    console.log();

    // Lets see if this is a HB reply of the form 'AB3CDE: VA1UAV HEARTBEAT SNR +17'
    let qrc = packet.value.substring(0, packet.value.indexOf(":"));	// note who is sending to us
    let s = packet.value.substring(packet.value.indexOf(":") + 2);  // this is the rest of the directed message
    let s2 = s.substring(s.indexOf(' ') + 1); // go past our call sign (because it is directed)

    if(s2.indexOf('HEARTBEAT SNR') == 0)   // Is this a HB reply?
    {
        console.log('HB reply');
        HeartbeatReplyBuffer.push(packet.value);
    }
    else
    {
        // If we are not in a QSO then start one
        if(QsoRecordCallsign == "")
        {
            QsoRecordCallsign = qrc;	
            console.log('In rx.directed.to_me and no QSO in progress. Start one with: ' + QsoRecordCallsign);    
        }

        // Ignore directed messages from others if we are in a QSO
        if(qrc == QsoRecordCallsign)
        {
            // First see if we had a HB reply from the call sign and put that in the buffer first
            console.log('qrc: ' + qrc);
            for(i = 0; i < HeartbeatReplyBuffer.length; i++)
            {
                console.log('reply buffer entry: ' + HeartbeatReplyBuffer[i]);
                if(HeartbeatReplyBuffer[i].indexOf(qrc) >= 0)
                {
                    // We found one, push in the QsoRecordBuffer and delete from HeartbeatReplyBuffer
                    QsoRecordBuffer.push(markdownText(HeartbeatReplyBuffer[i]));

                    HeartbeatReplyBuffer.splice(i, 1); // delete it
                }
            }


            QsoRecordBuffer.push(markdownText(packet.value));
        }
    }
});

// This is a bit tricky because we have to request to get the text that
// was sent and we do this on receipt of the rig.ptt packet.
let lastTxText = "";
let qrc = "";

function hasNumber(myString) 
{
    // An amateur radio callsign must include a number
    return /\d/.test(myString);
}

function isCallsign(cs)
{
    return hasNumber(cs) && alphanumericslash(cs) && (callsign.getAmateurRadioInfoByCallsign(cs) != undefined);
}
  
function pttSuccessCallback(result) 
{
    console.log('pttSucessCallback result: ' + result);

    if(result != "")
    {
        // We keep saving the text in lastTxText including any type ahead
        lastTxText = result;
    }
    else
    {
        // Here we can put the sent text in the buffer but lets check if we
        // need to start a new QSO because sending HB or to @ALLCALL

        let s = lastTxText.substring(lastTxText.indexOf(":") + 2);
        qrc = s.substring(0, s.indexOf(' '));	// see who we are sending to

        // check if it seems to be a valid callsign or group else clear it
        if(!isCallsign(qrc))
        {
            // Check and see if sending to a group other than @HB or @ALLCALL
            if(qrc[0] == '@' && qrc != '@HB' && qrc != '@ALLCALL')
            {
                console.log('Sending to a group: ' + qrc);
            }
            else
            {
                console.log(qrc + " doesn't appear to be a valid call sign!");
                qrc = "";
            }
        }

        // check for HB or directed to ALLCALL (includes CQ)
        let isHB = (lastTxText.indexOf('@HB') > 0);

        if(isHB || lastTxText.indexOf('@ALLCALL') > 0)
        {
            // Either a @HB or @ALLCALL so if a QSO in progress save it and clear it

            if(QsoRecordCallsign != "") // is there a QSO in progress
            {
                lastTxText = ""; // we are not saving this text
                saveQSO();    
                QsoRecordCallsign = ""; // Show we are not sending to anyone now
            }

            if(isHB)
            {
                // If this is a HB send then clear the reply buffer because we will get new ones
                HeartbeatReplyBuffer = [];
            }
        }
        else if(qrc != "" && qrc != QsoRecordCallsign) // Have we changed who we are sending to and is it valid?
        {
            if(QsoRecordCallsign != "") // qso in progress?
            {
                console.log("We've changed who we are sending to: " + qrc);
                console.log('Save buffer and start new QSO');

                let ltt = lastTxText; // save it and delete because it is for a new QSO
                lastTxText = "";
                saveQSO();
                lastTxText = ltt; // restore to save it in the next QSO
            }

            QsoRecordCallsign = qrc; // change or begin who we are sending to
        }

        if(QsoRecordCallsign != "")
        {
            // Continue the conversation...

            console.log('put lastTxText in buffer: ' + lastTxText);

            QsoRecordBuffer.push(markdownText(lastTxText));

            lastTxText = ""; // we've saved it so delete it
        }
    }
}

function pttFailureCallback(error) {
  console.error(error);
}

// Request the TX text - this is essential for recording sent messages!
js8.on('rig.ptt', (packet) => {
	//console.log('[Rig] PTT is %s', packet.value);
	js8.tx.getText().then(pttSuccessCallback, pttFailureCallback);
});

function saveQSO()
{
    if(lastTxText != "")
    {
        QsoRecordBuffer.push(markdownText(lastTxText));
        lastTxText = ""; // we've saved it so delete it
    }

    //console.log(packet.value);
    //console.log();
    //console.log(packet.params);
    //console.log();
    console.log("We are talking to: ");
    console.log(QsoRecordCallsign);
    console.log("Here is our record buffer to save: ");
    console.log(QsoRecordBuffer);

    // Save the file in format using timestamp as part of filename, qsodatadir/VA1UAV/qd1610822723539.md (for example)
    // Don't save if only one line in file as it is probably something like an orphaned reply.
    // *** Changes this to be 200 bytes or more to match the deleteqsos.js logic.
    let byteCount = 0;
    QsoRecordBuffer.forEach(element => byteCount += Buffer.from(element).length);

    //if(QsoRecordBuffer.length > 1)
    if(byteCount >= 200)
    {
        dir = qsodatadir + '/' + QsoRecordCallsign;
        if(!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true }); // make the directory recursively
        }

        var qsofile = fs.createWriteStream(dir + '/qd' + Date.now() + '.md');

        for(i = 0; i < QsoRecordBuffer.length; i++)
            qsofile.write(QsoRecordBuffer[i]); 

        qsofile.end();

        win.webContents.send('savedqso', QsoRecordCallsign); // tell the renderer we have saved a qso so it can bold the callsign in the table
    }  
    else
        console.log("Not saving QSO because only " + byteCount + "bytes!") 
        
    QsoRecordBuffer = [];
    QsoRecordCallsign = "";
}

js8.on('packet', (packet) => {
    // I don't think we need this but just in case the 100ms timer call isn't enough...
    if(js8.station.grid == 'unknown')
    {
        // For some reason this doesn't succeed in the TCP connect event - timing?
        // I put in a 100ms timer but it might not be long enough so request here too if it isn't set.
        // If there is no grid recorded then the lookups are going to fail!
        js8.station.getGrid().then((grid) => {
            console.log('Grid requested in packet handler: ' + grid);
        });    
    }

    // Check for the LOG.QSO message which happens when a log entry has been saved
    if(packet.type == "LOG.QSO")
    {
        saveQSO();
    }
});

nodeCleanup(function (exitCode, signal) 
{
    if(QsoRecordCallsign != "")
    {
        console.log('Save the QSO in progress before exiting');

        saveQSO();
    }
});

// END OF CODE FOR QSO RECORDING


js8.on('rig.ptt.on', (packet) => {
    win.webContents.send('rig.ptt.on');
});

js8.on('rig.ptt.off', (packet) => {
    win.webContents.send('rig.ptt.off');
});

js8.on('station.callsign', (packet) => {
	console.log('Station Callsign: %s', packet.value);
});

// Function to check letters and numbers for callsign validation
function alphanumericslash(inputtxt)
{
    let letterNumberSlash = /^[0-9a-zA-Z/]+$/;
    
    if(inputtxt.match(letterNumberSlash))
    {
        return true;
    }
    else
    {
        return false;
    }
}

/*
    This is where we process activity packets from JS8Call. Some is done here and some
    in the client.
*/

let callsigns = []; // keep an array of callsigns that were looked up so we don't do it again

function processPacket(packet)
{
    // first send to the client where we will process
    win.webContents.send('activity', packet); // we are going to process again in index.js
    
    // we also extract the callsign here to go and search for range, bearing and info (TBD)
	let o = packet;
	let type = o.type;
	let offset = o.params.OFFSET;
	let snr = o.params.SNR;
	let speed = o.params.SPEED;
	let timedrift = o.params.TDRIFT.toPrecision(3) * 1000;
	let utc = o.params.UTC;
	let value = o.value;
	
	let n = value.indexOf(":");
	
	if(n > 0 && js8.station.grid != 'unknown')
	{
		let cs = value.substring(0, n);	

        // In the logic following, checking for alphanumeric and slash is not perfect however 
        // there is no real indication in JS8Call that there is a call sign in a packet...
        if(cs != "" && alphanumericslash(cs) && callsigns.indexOf(cs) < 0) 
        {
            // sending range and bearing to renderer
            //console.log('Station: ' + js8.station.grid);
            updateRngBrgGridInfoFromHamqthGrid(js8.station.grid, cs);
            updateRngBrgGridFromQrzcqGrid(js8.station.grid, cs);
            callsigns.push(cs);
            //console.log("updated rngbrggrid for " + cs);
        }		
	}
    else if(js8.station.grid == 'unknown')
    {
        // Wow, this should happen but in case it does I want to know about it!
        console.log("ERROR in processPacket(), grid not known!");
    }
}
  
js8.on('rx.activity', (packet) => {
    processPacket(packet);
});

js8.on('rx.directed', (packet) => {
    //processPacket(packet);
});

// JS8Call requires a grid square of the station in setup so we should always have that.
// If an activity packet coming in is CQ then there will be a grid square as well so we use that.
// Otherwise we look up the lat and lon from Hamqth.com if we can. I think that using the
// gridsquare will be more accurate so we update with that if we get a CQ after the first
// lookup. Complicated!

async function hamqthLatLngFromCallsign(stationgrid, callsign)
{
    const fetch = require("node-fetch");
    const url = "https://www.hamqth.com/dxcc_json.php?callsign=" + callsign;
    
    let result = [];
    let lat;
    let lng;

    try 
    {
        const response = await fetch(url);
        const json = await response.json();
        lat = json.lat;
        lng = json.lng;
        result = [lat, lng];
    } 
    catch(error) 
    {
        console.log(error);
    }
    
    return result;
}


async function hamqthGridInfoFromCallsign(callsign)
{
    const fetch = require("node-fetch");
    const url = "https://www.hamqth.com/" + callsign;
    
    let grid;
    let info;

    try 
    {
        const response = await fetch(url);
        const html = await response.text();

        if(html.indexOf('https://aprs.fi/#!addr=') > 0)
        {
            let parts = html.split('https://aprs.fi/#!addr=');
            //console.log(parts);
            if(parts.length != 0)
                grid = parts[1].split('"', 1);     
            else
                grid = [];   
        }
        else
            grid = [];

        let name = " ";
        let qth = " ";
        let country = " ";
        let state = " ";

        if(html.indexOf('>Name:</td><td>') > 0)
        {
            let parts = html.split('>Name:</td><td>');
            //console.log(parts);
            if(parts.length != 0)
                name = parts[1].split('</td>', 1);     
         }

        if(html.indexOf('>Name:</td><td>') > 0)
        {
            let parts = html.split('>QTH:</td><td>');
            //console.log(parts);
            if(parts.length != 0)
                qth = parts[1].split('</td>', 1);     
        }
 
        if(html.indexOf('>Name:</td><td>') > 0)
        {
            let parts = html.split('>Country:</td><td>');
            //console.log(parts);
            if(parts.length != 0)
                country = parts[1].split('</td>', 1);     
        }
 
        if(html.indexOf('>State:</td><td>') > 0)
        {
            let parts = html.split('>State:</td><td>');
            //console.log(parts);
            if(parts.length != 0)
                state = parts[1].split('</td>', 1);     
        }
        
        if(name != " ")
            info = "&nbsp&nbsp&nbsp<b>Name:</b> " + name + "&nbsp&nbsp&nbsp<b>QTH:</b> " + qth + "&nbsp&nbsp&nbsp<b>Country:</b> " + 
                country + "&nbsp&nbsp&nbsp<b>State:</b> " + state;
        else
            info = " ";
    } 
    catch(error) 
    {
        console.log(error);
    }

    result = {"grid":grid,"info":info};

    //console.log(result);
    
    return result;
}

//console.log(hamqthGridFromCallsign('va1uav'));

async function updateRngBrgGridInfoFromHamqthGrid(stationgrid, callsign)
{
    let Maidenhead = require('maidenhead'); // this is installed by lib-js8call
    
    let cs1 = new Maidenhead();
    cs1.locator = stationgrid;
    
    let gridInfo = await hamqthGridInfoFromCallsign(callsign);

    let grid = gridInfo.grid;
    let info = gridInfo.info;
    
    //console.log(gridInfo);
    //console.log(info);
    
    if(grid && grid.length != 0)    
    {
        //console.log(grid[0]);
        
        let cs2 = new Maidenhead();

        try
        {
            cs2.locator = grid[0];

            let rng = Math.round(cs1.distanceTo(cs2, 'm')/1000);
            let brg = cs1.bearingTo(cs2);
        
            let rngBrgCsGrid = {"rng":rng, "brg":brg, "cs":callsign, "grid":grid};
        
            //console.log(rngBrgCsGrid);
                            
            win.webContents.send('rngbrgcsgrid', rngBrgCsGrid);
        }
        catch
        {
            // silence
        }
    }
//    else
//        console.log('no grid for ' + callsign + ' from hamqth.com or maybe no internet');     
        
    if(info != "")
    {
        let csinfo = {"callsign":callsign, "info":info};
        //console.log("csinfo: " + csinfo);

        win.webContents.send('csinfo', csinfo);
    }
}

async function updateRngBrgGridFromQrzcqGrid(stationgrid, callsign)
{
    let Maidenhead = require('maidenhead'); // this is installed by lib-js8call
    
    let cs1 = new Maidenhead();
    cs1.locator = stationgrid;
    
    let grid = await qrzcqGridFromCallsign(callsign);
    
    //console.log(grid);
    
    if(grid && grid.length != 0)    
    {
        //console.log(grid[0]);
        
        let cs2 = new Maidenhead();

        try
        {
        cs2.locator = grid[0];

        let rng = Math.round(cs1.distanceTo(cs2, 'm')/1000);
        let brg = cs1.bearingTo(cs2);
    
        let rngBrgCsGrid = {"rng":rng, "brg":brg, "cs":callsign, "grid":grid};
    
        //console.log(rngBrgCs);
                           
        win.webContents.send('rngbrgcsgrid', rngBrgCsGrid);
        }
        catch
        {
            // silence...
        }
    }
//    else
//        console.log('no grid for ' + callsign + ' from qrzcq.com or maybe no internet');    
}

//updateRngBrgFromHamqthGrid('fn84dp', 'm7gmt');
//updateRngBrgFromHamqthGrid('fn84dp', 'kk4wrg');

async function qrzcqGridFromCallsign(callsign)
{
    const fetch = require("node-fetch");
    const url = "https://www.qrzcq.com/call/" + callsign;
    
    let grid;

    try 
    {
        const response = await fetch(url);
        const html = await response.text();
        if(html.indexOf('Locator:</b></td><td align="left">') > 0)
        {
            let parts = html.split('Locator:</b></td><td align="left">');
            if(parts.length != 0)
            {
                grid = parts[1].split('<', 1);  
                //console.log(grid);   
            }
            else
                grid = [];   
        }
        else
            grid = [];
    } 
    catch(error) 
    {
        console.log(error);
    }
    
    return grid;
}
