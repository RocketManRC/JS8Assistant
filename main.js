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

const { app, BrowserWindow, dialog, ipcMain} = require('electron');
const url = require('url');
const path = require('path');
//const callsign = require('callsign/src/node');
//console.log(callsign.getAmateurRadioDetailedByCallsign('va1uav'));

let win;
let winHeight;
let connected = false; // this is to track the state of the JS8Call API connection


if(process.platform !== 'darwin')
    winHeight = 790; // make room for the menu bar for windows and linux
else
    winHeight = 750;


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
  // Create the browser window.
  win = new BrowserWindow({
    width: 925,
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
  //win.webContents.openDevTools();
  
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

      if(connected)
          win.webContents.send('apistatus', "connected"); // indicate in UI we are connected
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
ipcMain.on("displayqth",(e, data)=>{
  //sendToJS8Call(data);
  console.log("displayqth")
});

// listener for buttonnew
ipcMain.on("displaymap",(e, data)=>{
  //sendToJS8Call(data);
  console.log("displaymap")
});

// listener for buttonrevised
ipcMain.on("displayhistory",(e, data)=>{
  //sendToJS8Call(data);
  console.log("displayhistory")
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
        console.log(js8.station.grid);
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

js8.on('rig.freq', (packet) => {
	console.log(
		'[Rig] Frequency has been changed to %s (%s). Offset: %s',
		packet.params.DIAL,
		packet.params.BAND,
		packet.params.OFFSET
	);
});

function pttSuccessCallback(result) {
  console.log(result);
}

function pttFailureCallback(error) {
  console.error(error);
}

js8.on('rig.ptt', (packet) => {
	console.log('[Rig] PTT is %s', packet.value);
	js8.tx.getText().then(pttSuccessCallback, pttFailureCallback);
});

js8.on('rx.to_me', (packet) => {
	console.log('[Message to me] %s', packet.value);
});

js8.on('station.callsign', (packet) => {
	console.log('Station Callsign: %s', packet.value);
});

js8.on('packet', (packet) => {
    // Do your custom stuff
    //console.log(packet);
});

// Function to check letters and numbers for callsign validation
function alphanumeric(inputtxt)
{
    var letterNumber = /^[0-9a-zA-Z/]+$/;
    
    if(inputtxt.match(letterNumber))
    {
        return true;
    }
    else
    {
        return false;
    }
}

let callsigns = []; // keep an array of callsigns that were looked up so we don't do it again
  
js8.on('rx.activity', (packet) => {
    // Do your custom stuff
    //console.log(packet);
    win.webContents.send('activity', packet); // should send 'value' below instead
    
	//var o = JSON.parse(message);
	var o = packet;
	var type = o.type;
	var offset = o.params.OFFSET;
	var snr = o.params.SNR;
	var speed = o.params.SPEED;
	var timedrift = o.params.TDRIFT.toPrecision(3) * 1000;
	//var utc = timeFromTimestamp(o.params.UTC);
	var utc = o.params.UTC;
	var value = o.value;
	
	//console.log(message);
	
	var n = value.indexOf(":");
	
	if(n > 0)
	{
		cs = value.substring(0, n);	

        // In the logic following, checking for alphanumeric is not perfect however 
        // there is no real indication in JS8Call that there is a call sign in a packet...
        if(cs != "" && alphanumeric(cs) && callsigns.indexOf(cs) < 0) 
        {
            // sending range and bearing to renderer
            //updateRngBrg(js8.station.grid, cs, "");  
            updateRngBrgFromHamqthGrid(js8.station.grid, cs);
            callsigns.push(cs);
            console.log("updated rngbrg for " + cs);
        }		
	}
});

js8.on('rx.directed', (packet) => {
    // Do your custom stuff
    //console.log(packet);
    //win.webContents.send('activity', packet);
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


async function updateRngBrg(stationgrid, callsign, grid)
{
    let Maidenhead = require('maidenhead'); // this is installed by lib-js8call
    
    let cs1 = new Maidenhead();
    cs1.locator = stationgrid;
    
    
    if(grid == "")
    {
        // asynchronous part
        let latLng = await hamqthLatLngFromCallsign('FN84dp', callsign);
        
        if(latLng.length != 0)    
        {
            console.log(latLng);
            
            let cs2 = new Maidenhead(latLng[0], latLng[1], 2);

            let rng = Math.round(cs1.distanceTo(cs2, 'm')/1000);
            let brg = cs1.bearingTo(cs2);
        
            let rngBrg = [rng, brg];
        
            console.log(rngBrg);
                               
            win.webContents.send('rngbrg', rngBrg);
        }
        else
            console.log('no lat/lng from hamqth.com or maybe no internet');            
    }
    else // synchronous part
    {
        console.log("grid found");
        
        cs2 = new Maidenhead();
        cs2.locator = grid;
        
        let rng = Math.round(cs1.distanceTo(cs2, 'm')/1000);
        let brg = cs1.bearingTo(cs2);
        
        let rngBrg = [rng, brg];
        
        console.log(rngBrg);
        
        win.webContents.send('rngbrg', rngBrg);
    }
}

//updateRngBrg('FN84', 'm7gmt', "");

//updateRngBrg('FN84', 'm7gmt', "JO02");

async function hamqthGridFromCallsign(callsign)
{
    const fetch = require("node-fetch");
    const url = "https://www.hamqth.com/" + callsign;
    
    let grid;

    try 
    {
        const response = await fetch(url);
        const html = await response.text();
        if(html.indexOf('https://aprs.fi/#!addr=') > 0)
        {
            let parts = html.split('https://aprs.fi/#!addr=');
            console.log(parts);
            if(parts.length != 0)
                grid = parts[1].split('"', 1);     
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

//console.log(hamqthGridFromCallsign('va1uav'));

async function updateRngBrgFromHamqthGrid(stationgrid, callsign)
{
    let Maidenhead = require('maidenhead'); // this is installed by lib-js8call
    
    let cs1 = new Maidenhead();
    cs1.locator = stationgrid;
    
    //let grid = await hamqthGridFromCallsign(callsign);
    let grid = await qrzcqGridFromCallsign(callsign);
    
    console.log(grid);
    
    if(grid.length != 0)    
    {
        console.log(grid[0]);
        
        let cs2 = new Maidenhead();
        cs2.locator = grid[0];

        let rng = Math.round(cs1.distanceTo(cs2, 'm')/1000);
        let brg = cs1.bearingTo(cs2);
    
        let rngBrg = [rng, brg];
    
        console.log(rngBrg);
                           
        win.webContents.send('rngbrg', rngBrg);
    }
    else
        console.log('no grid from hamqth.com or maybe no internet');            
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
                console.log(grid);   
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
