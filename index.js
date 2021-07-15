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

// This is the client side (browser) part of this Electron application.

let $ = jQuery = require('jquery');
const {ipcRenderer} = require('electron');
const shell = require('electron').shell;
const fs = require("fs"); 

let qsodatadir = "";

// Fetch the preferences object
const preferences = ipcRenderer.sendSync('getPreferences');
let distanceUnit = preferences.settings.distance_unit;
console.log(distanceUnit);

let fontSize = preferences.settings.font_size;

// Function to check letters numbers and slash for callsign validation
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
  
ipcRenderer.on('qsodatadir', (event, message) => 
{
    //console.log(message);

    qsodatadir = message;
});

ipcRenderer.on('distanceunit', (event, message) => 
{
    //console.log(message);

    distanceUnit = message;
});

ipcRenderer.on('apistatus', (event, message) => 
{
    let $indicator = $('#indicator-api');
    if(message == "connected")
    {
        $indicator.removeClass('btn-secondary btn-danger').addClass('btn-success');
    }
    else
    {
        $indicator.removeClass('btn-secondary btn-success').addClass('btn-danger');
    }
});

ipcRenderer.on('rig.ptt.on', () => 
{
    // Using opposite colours here: red to show PTT is active
    $('#indicator-ptt').removeClass('btn-secondary btn-success').addClass('btn-danger');
});

ipcRenderer.on('rig.ptt.off', () => 
{
    $('#indicator-ptt').removeClass('btn-secondary btn-danger').addClass('btn-success');
});

ipcRenderer.on('savedqso', (event, message) => 
{
    let cs = message;
    let rows = table.searchRows("callsign", "=", cs);

    // Note we have to modify the callsign first by adding a '*' to it then modify it again
    // in order to get the call sign to turn bold (because the data has to change to get the
    // cell formatter to do anything)
    rows[0].update({callsign:cs + '*'});
    rows[0].update({callsign:cs});

    // If the row for that call sign happens to be selected then enable the qsohistory button
    let selectedRows = table.getSelectedRows();
    let rowCount = selectedRows.length;

    if(rowCount == 1)
    {
        let rowData = selectedRows[0].getData();
        let callsign = rowData.callsign;
        if(callsign == cs)
            $('#buttonhistory').removeAttr('disabled');
    }
});


let scrolling = 0;

// This processes the activity data from JS8Call, sent here from the server process (main.js)
ipcRenderer.on('activity', (event, message) => 
{
	let o = message;
	let type = o.type;
	let offset = o.params.OFFSET;
	let snr = o.params.SNR;
	let speed = o.params.SPEED;
	let timedrift = o.params.TDRIFT.toPrecision(3) * 1000;
	let utc = o.params.UTC;
	let value = o.value;
	
	//console.log(message);
	
	let n = value.indexOf(":");
	
	if(n > 0)
	{
	    let cs = value.substring(0, n);	
	    
	    let rows = table.searchRows("callsign", "=", cs);
        
        // In the logic following, checking for alphanumeric and slash is not perfect however 
        // there is no real indication in JS8Call that there is a call sign in a packet...
        if(cs != "" && alphanumericslash(cs)) 
        {
            let stats;
            
            if(value.indexOf("HEARTBEAT") >= 0)
                status = "HB";
            else if(value.indexOf("CQ") >= 0)
                status = "CQ";
            else
                status = "QSO";
            
            if(rows[0]) // note that there should only be one entry for this call sign or something is wrong (but not checking)!
            {		
                rows[0].update({offset: offset, snr:snr, timedrift:timedrift, utc:utc, status:status});
            }
            else
            {
                table.addRow({callsign:cs, offset: offset, snr:snr, timedrift:timedrift, utc:utc, status:status}, true); // add row to top
            }

            if(scrolling == 0) // if not scrolled then sort table appropriately
                table.setSort(table.getSorters()[0].field, table.getSorters()[0].dir); // sort the table by whatever column and direction is selected
            
                
            if(statusHeaderMenuLabel == "Show HB")
                table.setFilter("status", "!=", "HB");
        }
    }
});

ipcRenderer.on('rngbrgcsgrid', (event, message) => 
{
    //console.log(message);
    
    let cs = message.cs;
    
    let rows = table.searchRows("callsign", "=", cs);
    
    if(rows[0]) // there should only be one entry for this call sign or something is wrong!
        rows[0].update({rng: message.rng, brg:message.brg, grid:message.grid});
});

ipcRenderer.on('csinfo', (event, message) => 
{
    let cs = message.callsign;
    
    let rows = table.searchRows("callsign", "=", cs);
    
    if(rows[0]) // there should only be one entry for this call sign or something is wrong!
        rows[0].update({info: message.info});
});

$("form button").click(function(ev){
    ev.preventDefault()// cancel form submission
    
    if($(this).attr("value")=="buttonqth")
    {
        let selectedRows = table.getSelectedRows();
        let rowCount = selectedRows.length;
        
        if(rowCount >= 1)
        {
            for(i = 0; i < rowCount; i++)
            {
                let rowData = selectedRows[i].getData();
                let callsign = rowData.callsign;
                shell.openExternal('https://www.qrz.com/db/?callsign='+callsign);
            }
        }
        //else
        //    console.log("no rows selected");

        //$("#additional-info").html("<h5>This is a test</h5>");
        //ipcRenderer.send("displayqth", sent);
    }
    else if($(this).attr("value")=="buttonpsk")
    {
        let selectedRows = table.getSelectedRows();
        let rowCount = selectedRows.length;
        
        if(rowCount >= 1)
        {
            for(i = 0; i < rowCount; i++)
            {
                let rowData = selectedRows[i].getData();
                let callsign = rowData.callsign;
                shell.openExternal('https://www.pskreporter.info/pskmap.html?preset&callsign='+callsign+'&mode=JS8&timerange=3600&distunit=' + distanceUnit + '&hideunrec=1&blankifnone=1');
                //shell.openExternal('http://www.levinecentral.com/ham/grid_square.php/'+callsign+'?Call='+callsign);
            }
        }
        //else
        //    console.log("no rows selected");
            
        //ipcRenderer.send("displaymap", sent);
    }
    else if($(this).attr("value")=="buttonmap")
    {
        let selectedRows = table.getSelectedRows();
        let rowCount = selectedRows.length;
        
        if(rowCount >= 1)
        {
            for(i = 0; i < rowCount; i++)
            {
                let rowData = selectedRows[i].getData();
                let callsign = rowData.callsign;
                //shell.openExternal('https://www.pskreporter.info/pskmap.html?preset&callsign='+callsign+'&mode=JS8&timerange=3600&distunit=' + distanceUnit + '&hideunrec=1&blankifnone=1');
                shell.openExternal('http://www.levinecentral.com/ham/grid_square.php/'+callsign+'?Call='+callsign);
            }
        }
        //else
        //    console.log("no rows selected");
            
        //ipcRenderer.send("displaymap", sent);
    }
    else if($(this).attr("value")=="buttonhistory")
    {
        let selectedRows = table.getSelectedRows();
        let rowCount = selectedRows.length;
        if(rowCount == 1)
        {
            let rowData = selectedRows[0].getData();
            let callsign = rowData.callsign;
            //console.log("sending buttonhistory event to main process");
            ipcRenderer.send("buttonhistory", callsign);
        }
    }
});

let tabledata = [
 	//{id:1, callsign:"AA9BCD", offset: "1510", snr:"-09", timedrift:"150", utc:""}
 ];
 
let statusHeaderMenuLabel = "Hide HB";
 
let statusHeaderMenu = [
    {
        label:function(component){
            return statusHeaderMenuLabel; 
        },
        action:function(e, column){ // this is so cool, you can modify the menu item by using a function
            if(statusHeaderMenuLabel == "Hide HB")
            {
                table.setFilter("status", "!=", "HB");
                statusHeaderMenuLabel = "Show HB";
            }
            else
            {
                table.removeFilter("status", "!=", "HB");
                statusHeaderMenuLabel = "Hide HB";
            }
        }
    },
];

function timeFromTimestamp(ts)
{
    let unix_timestamp = ts
    let date = new Date(unix_timestamp);
    // Hours part from the timestamp
    let hours = date.getUTCHours();
    // Minutes part from the timestamp
    let minutes = "0" + date.getUTCMinutes();
    // Seconds part from the timestamp
    let seconds = "0" + date.getUTCSeconds();
    let millis = "00" + date.getUTCMilliseconds();

    // Will display time in 10:30:23.123 format
    let formattedTime = hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2) + '.' + millis.substr(-3);
    
    return formattedTime;
}

/* Here is the example custom formatter from the Tabulator docs

{title:"Name", field:"name", formatter:function(cell, formatterParams, onRendered){
    //cell - the cell component
    //formatterParams - parameters set for the column
    //onRendered - function to call when the formatter has been rendered

    return "Mr" + cell.getValue(); //return the contents of the cell;
},
}

*/

function formatUtcCell(cell, formatterParams, onRendered)
{
    return timeFromTimestamp(cell.getValue());
}

function formatCallsignCell(cell, formatterParams, onRendered)
{
    let res = "";
    let cs = cell.getValue();

    if(fs.existsSync(qsodatadir + "/" + cs))
        res = "<span style='font-weight:bold;'>" + cs + "</span>";
    else
        res = cs;

    return res;
}

function formatRngCell(cell, formatterParams, onRendered)
{
    if(distanceUnit == "km")
        return cell.getValue();
    else if(cell.getValue())
        return Math.round(cell.getValue() * 0.62);
    else
        return cell.getValue();
}

//define custom formatter to change font size in column header
var formatTitle = function(cell, formatterParams, onRendered){

    //set font size
    //cell.getElement().style.fontSize = fontSize.toString() + "px";
    cell.getElement().style.fontSize = fontSize + "px";

    return cell.getValue();
}

const ttCS = "Call sign of contact";
const ttOFS = "Offset of contact's signal in Hz";
const ttTD = "Time delta of signal from UTC second in milliseconds";
const ttUTC = "UTC timestamp in seconds";
const ttRNG = "RaNGe to contact in Miles or Km according to settings";
const ttBRG = "Bearing to contact in degrees";
const ttSNR = "Signal to noise ratio of contact's signal";
const ttSTA = "HeartBeat (HB), CQ or QSO";

//create Tabulator on DOM element with id "data-table"
let table = new Tabulator("#data-table", {
 	height:367, // set height of table (in CSS or here), this enables the Virtual DOM and improves render speed dramatically (can be any valid css height value)
    selectable:true,
    tooltipsHeader:true,
    rowSelected:function(row){
        row.getElement().style.backgroundColor = "#85C1E9"; // show the row is selected (blue colour)
                      
        // prevent more than one row from being selected
        let selectedRows = table.getSelectedRows();
        let rowCount = selectedRows.length;
        let cs = row.getData().callsign;

        if(rowCount > 1) // only allow one row selected (for now)
        {
            for(i = 0; i < rowCount; i++)
            {
                if(selectedRows[i].getData().callsign != cs)
                    table.deselectRow(selectedRows[i]);
            }
        }      

        // enable the lookup buttons
        $('#buttonqth').removeAttr('disabled');
        $('#buttonpsk').removeAttr('disabled');
        $('#buttonmap').removeAttr('disabled');

        // and disable the history button (will enable later if folder exists)
        $('#buttonhistory').attr('disabled', 'disabled');

        // retrieve our rows grid and info and display it
        let info = row.getData().info;
        let grid = row.getData().grid;
        let infoText = "(none)";

        if(grid)
            infoText = "<b>Grid:</b> " + grid;

        if(info)
            infoText += "   " + info;

        $("#additional-info").html(infoText);   
        
        // enable the qsohistory button only if we have a data folder for this callsign
        if(fs.existsSync(qsodatadir + "/" + cs))
        {
            //console.log("directory exists for ", cs);
            $('#buttonhistory').removeAttr('disabled');
        }
    },
    scrollVertical:function(top){
        //console.log(top);
        scrolling = top; // will be zero when at top and therefore sorting will be allowed

        // as soon as we scroll back to top we may as well sort again
        if(scrolling == 0)
            table.setSort(table.getSorters()[0].field, table.getSorters()[0].dir); // sort the table by whatever column and direction is selected        
    },
    rowDeselected:function(row){
        if(row.getData().status == "HB")
        {
            row.getElement().style.backgroundColor = "#FFFFFF";
        }
        else if(row.getData().status == "QSO")
        {
            row.getElement().style.backgroundColor = "#FFFF66";
        }
        else if(row.getData().status == "CQ")
        {
            row.getElement().style.backgroundColor = "#66FFB2";
        }
        //else if(row.getData().status == "***") // this is for the directed callsign in JS8Call
        //{
        //    row.getElement().style.backgroundColor = "#FFA07A";
        //}
        //else
        //{
        //    row.getElement().style.backgroundColor = "#FFFFFF";
        //}
        
        // check if still selected rows and if not disable buttons
        let selectedRows = table.getSelectedRows();
        let rowCount = selectedRows.length;
        
        if(rowCount == 0)
        {
            $('#buttonqth').attr('disabled', 'disabled');
            $('#buttonpsk').attr('disabled', 'disabled');
            $('#buttonmap').attr('disabled', 'disabled');
            $('#buttonhistory').attr('disabled', 'disabled');
            $("#additional-info").html("(Select a Call Sign to display additional info if any)");
        }
    },
    rowContextMenu:[
        {
            label:"Delete Call Sign",
            action:function(e, row){
                row.delete();
            }
        },
        {
            label:"Show QRZ.com profile",
            action:function(e, row){
                let callsign = row.getData().callsign;
                shell.openExternal('https://www.qrz.com/db/?callsign='+callsign);
            }
        },
        {
            label:"Show on PSKreporter",
            action:function(e, row){
                let callsign = row.getData().callsign;
                shell.openExternal('https://www.pskreporter.info/pskmap.html?preset&callsign='+callsign+'&mode=JS8&timerange=3600&distunit=' + distanceUnit + '&hideunrec=1&blankifnone=1');
            }
        }
    ],
 	data:tabledata, //assign data to table
 	layout:"fitColumns", //fit columns to width of table (optional)
    rowFormatter:function(row){
        // First check if our row is selected
        let selectedRows = table.getSelectedRows();
        let rowCount = selectedRows.length;
        let rowSelected = false;
        
        row.getElement().style.fontSize = fontSize + "px";

        if(rowCount >= 1)
        {
            for(i = 0; i < rowCount; i++)
            {
                if(row.getData().callsign == selectedRows[i].getData().callsign)
                    rowSelected = true;
            }
        }

        if(!rowSelected)
        {
            // only colour the row with status colour if not selected
            if(row.getData().status == "HB")
            {            
                row.getElement().style.backgroundColor = "#FFFFFF";
            }
            else if(row.getData().status == "QSO")
            {
                row.getElement().style.backgroundColor = "#FFFF66";
            }
            else if(row.getData().status == "CQ")
            {
                row.getElement().style.backgroundColor = "#66FFB2";
            }
            //else if(row.getData().status == "***") // this is for the directed callsign in JS8Call
            //{
            //    row.getElement().style.backgroundColor = "#FFA07A";
            //}
            //else
            //{
            //    row.getElement().style.backgroundColor = "#FFFFFF";
            //}
        }
    },
 	columns:[ //Define Table Columns
        // These column widths were hand crafted for the default font size of 14 to accommodating other sizes is a bit of a kludge...
        {title:"Call Sign", field:"callsign", titleFormatter:formatTitle, width:Math.floor(fontSize*125/14), formatter:formatCallsignCell, headerTooltip:ttCS},
        {title:"Offset", field:"offset", titleFormatter:formatTitle, width:Math.floor(fontSize*80/14+Math.abs(14-fontSize)*5), sorter:"number", headerTooltip:ttOFS},
	 	{title:"Time Delta (ms)", field:"timedrift", titleFormatter:formatTitle, width:Math.floor(fontSize*150/14+Math.abs(14-fontSize)*5), sorter:"number", headerTooltip:ttTD},
	 	{title:"UTC", field:"utc", titleFormatter:formatTitle, width:Math.floor(fontSize*125/14+Math.abs(14-fontSize)*2), formatter:formatUtcCell, headerSortStartingDir:"desc", headerTooltip:ttUTC},
	 	{title:"RNG", field:"rng", titleFormatter:formatTitle, width:Math.floor(fontSize*75/14+Math.abs(14-fontSize)*3), formatter:formatRngCell, sorter:"number", headerTooltip:ttRNG},
	 	{title:"BRG", field:"brg", titleFormatter:formatTitle, width:Math.floor(fontSize*75/14+Math.abs(14-fontSize)*2), sorter:"number", headerTooltip:ttBRG},
	 	{title:"SNR", field:"snr", titleFormatter:formatTitle, width:Math.floor(fontSize*75/14+Math.abs(14-fontSize)*2), sorter:"number", headerTooltip:ttSNR},
	 	{title:"Status", field:"status", titleFormatter:formatTitle, width:Math.floor(fontSize*110/14+Math.abs(14-fontSize)*5), headerMenu:statusHeaderMenu, headerTooltip:ttSTA},
	 	{title:"Info", field:"info", visible:false},
	 	{title:"Grid", field:"grid", visible:false}
 	],
 	initialSort:[
        {column:"utc", dir:"desc"} //sort by this first
    ]
});
