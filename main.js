/*
MIT License

Copyright (c) 2021 Rick MacDonald

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

const { app, BrowserWindow, dialog, ipcMain} = require('electron');
const url = require('url');
const path = require('path');
const JSONStorage = require('node-localstorage').JSONStorage;

let win; // the main application window
let winQsoHistory; // the window for QSO History
let winHeight;
let connected = false; // this is to track the state of the JS8Call API connection


if(process.platform !== 'darwin')
    winHeight = 740; // make room for the menu bar for windows and linux
else
    winHeight = 700;

let storageLocation = app.getPath('userData');
let nodeStorage = new JSONStorage(storageLocation);

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
    mainWindowState.bounds = { width: 847, height: winHeight };
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

      if(connected)
          win.webContents.send('apistatus', "connected"); // indicate in UI we are connected
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
    qsoWindowState = nodeStorage.getItem('qsoWindowState'); 
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
      console.log("Sending callsign to history window", callsign);
      winQsoHistory.webContents.send('callsign', callsign);
  });

  winQsoHistory.webContents.on('destroyed', () => {
    console.log('winQsoHistory destroyed');
    qsoHistoryWindowCallsign = "";
  });
}

function createWindows()
{
    createWindow();
    //createQsoHistoryWindow(); // for testing, move to QSO History button event handler
}

//app.whenReady().then(createWindow);
app.whenReady().then(createWindows); // for feature testing

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
    tcp: { enabled: true, port: 2442 },
    udp: { enabled: false, port: 2242,  },
});

function timeoutCheck()
{
    //console.log(connected);
    
    if(!connected)
    {
        js8.tcp.connect(); 
    }
}

setInterval(timeoutCheck, 5000);

js8.on('tcp.connected', (connection) => {
    // At this point, we have setup the connection
    console.log(
        'Server listening %s:%s Mode: %s',
        connection.address,
        connection.port,
        connection.mode
    );
    
    connected = true;
    // The following only works if the window has been opened but doesn't seem to
    // cause any problems if it isn't.
    win.webContents.send('apistatus', "connected"); // indicate in UI we are connected
    
    js8.station.getGrid().then((grid) => {
        console.log('station grid');
        console.log(grid);        
        //console.log(js8.station.grid);
        console.log();
   });
    
    js8.mode.getSpeed().then((mode) => {
        console.log('mode');
        console.log(mode);
    });
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

        // Save the file in format ./qsodata/VA1UAV/qd1610822723539.md (for example)
        const fs = require('fs');
        let dir = './qsodata';
        if(!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        dir = './qsodata/' + QsoRecordCallsign;
        if(!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }

//        fs.writeFile(dir + '/qd' + Date.now() + '.md', QsoRecordBuffer, function(err) {
//            // If an error occurred, show it and return
//            if(err) return console.error(err);
//          });      

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
	
	if(n > 0)
	{
		let cs = value.substring(0, n);	

        // In the logic following, checking for alphanumeric is not perfect however 
        // there is no real indication in JS8Call that there is a call sign in a packet...
        if(cs != "" && alphanumeric(cs) && callsigns.indexOf(cs) < 0) 
        {
            // sending range and bearing to renderer
            updateRngBrgGridInfoFromHamqthGrid(js8.station.grid, cs);
            updateRngBrgGridFromQrzcqGrid(js8.station.grid, cs);
            callsigns.push(cs);
            //console.log("updated rngbrggrid for " + cs);
        }		
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

//qrzcqGridFromCallsign('va1uav');
