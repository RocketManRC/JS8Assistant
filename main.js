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
const findqsos = require('./findqsos');

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
let js8host = "";
let qsodatadir = config.qsodatadir;
let mycallsign = "";
let preferencesChanged = false;
var preferencesTimer;

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
    winHeight = 740; // make room for the menu bar for windows and linux
    winWidth = 864;
    //menuTemplate.unshift({}); // Needed for Windows???
}
else
{
    winHeight = 700;
    winWidth = 847;
}

let storageLocation = app.getPath('userData');
let nodeStorage = new JSONStorage(storageLocation);
console.log(storageLocation);

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
  // win.webContents.openDevTools();

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
          console.log("You need to put your callsign in config.sys!");
          preferences.show();
      }
      else
      {
        mycallsign = cs.toUpperCase();
        console.log(mycallsign);
      }

      js8host = preferences.value('settings.remote_ip');
      console.log(js8host);
      
      if(connected)
        win.webContents.send('apistatus', "connected"); // indicate in UI we are connected

      win.webContents.send('qsodatadir', qsodatadir); 
    });
}

let qsoHistoryWindowCallsign = ""; // we only want one window to open so keep track of it with this callsign variable

function createQsoHistoryWindow(callsign) 
{
  if(qsoHistoryWindowCallsign != "")
    return;

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
      nodeIntegration: true
    }
  });

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
            label:'Find QSOs',
            enabled: enableFindqsos,
            id: 'fq',
            click() 
            {
                console.log("findqsos for callsign: ");
                console.log(mycallsign);
                findqsos.findqsos(mycallsign);
       
                myItem = menu.getMenuItemById('fq');
                myItem.enabled = false; // assume it was going to make some data! 
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
            res = '<span style="color:green">' + '\n**' + me + ':**' + msg + '\n</span>\n\n'; // simple markdown + html annotation
        }
        else // it could be a reply or a directed message "to me" but without my callsign (??)
        {
            let cs = parts[0];
            let msg = parts[1];
            QsoRecordCallsign = cs;
            res = '<span style="color:blue">' + '\n**' + cs + ':**' + msg + '\n</span>\n\n'; // simple markdown + html annotation
        }
    }

    return res;
}

js8.on('rx.directed.to_me', (packet) => {
    console.log(packet.value);
    console.log();

    QsoRecordBuffer.push(markdownText(packet.value));

    QsoRecordCallsign = packet.value.substring(0, packet.value.indexOf(":"));	    
});

let lastTxText = "";

function pttSuccessCallback(result) {
    if(result != "")
        lastTxText = result;
    else
    {
        //console.log(lastTxText); // this was the final text in the tx buffer so we capture any type ahead
        //console.log();

        if(QsoRecordBuffer.length != 0)
        {
            QsoRecordBuffer.push(markdownText(lastTxText));
            lastTxText = ""; // we've saved it so delete it
        }
    }
}

function pttFailureCallback(error) {
  console.error(error);
}

js8.on('rig.ptt', (packet) => {
	//console.log('[Rig] PTT is %s', packet.value);
	js8.tx.getText().then(pttSuccessCallback, pttFailureCallback);
});

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
        if(lastTxText != "")
        {
            QsoRecordBuffer.push(markdownText(lastTxText));
            lastTxText = ""; // we've saved it so delete it
        }

        console.log(packet.value);
        console.log();
        console.log(packet.params);
        console.log();
        console.log("We are talking to: ");
        console.log(QsoRecordCallsign);
        console.log("Here is our record buffer to save: ");
        console.log(QsoRecordBuffer);

        // Save the file in format using timestamp as part of filename, qsodatadir/VA1UAV/qd1610822723539.md (for example)
        dir = qsodatadir + '/' + QsoRecordCallsign;
        if(!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true }); // make the directory recursively
        }

        var qsofile = fs.createWriteStream(dir + '/qd' + Date.now() + '.md');

        for(i = 0; i < QsoRecordBuffer.length; i++)
            qsofile.write(QsoRecordBuffer[i]); 

        qsofile.end();

        // also create a file with extension .info to hold the start and stop time
         
        QsoRecordBuffer = [];
        QsoRecordCallsign = "";
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
function alphanumeric(inputtxt)
{
    let letterNumber = /^[0-9a-zA-Z/]+$/;
    
    if(inputtxt.match(letterNumber))
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

        // In the logic following, checking for alphanumeric is not perfect however 
        // there is no real indication in JS8Call that there is a call sign in a packet...
        if(cs != "" && alphanumeric(cs) && callsigns.indexOf(cs) < 0) 
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
