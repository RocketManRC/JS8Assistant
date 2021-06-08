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

var config = require('./config');
let distanceUnit = config.distanceUnit; // km or miles for PSKReporter and RNG column in table
let qsodatadir = "";


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
  
ipcRenderer.on('qsodatadir', (event, message) => 
{
    console.log(message);

    qsodatadir = message;
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
        
        // In the logic following, checking for alphanumeric is not perfect however 
        // there is no real indication in JS8Call that there is a call sign in a packet...
        if(cs != "" && alphanumeric(cs)) 
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
        else
            console.log("no rows selected");

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
        else
            console.log("no rows selected");
            
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
        else
            console.log("no rows selected");
            
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
            console.log("sending buttonhistory event to main process");
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

function formatRngCell(cell, formatterParams, onRendered)
{
    if(distanceUnit == "km")
        return cell.getValue();
    else if(cell.getValue())
        return Math.round(cell.getValue() * 0.62);
    else
        return cell.getValue();
}

 
//create Tabulator on DOM element with id "data-table"
let table = new Tabulator("#data-table", {
 	height:367, // set height of table (in CSS or here), this enables the Virtual DOM and improves render speed dramatically (can be any valid css height value)
    selectable:true,
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
	 	{title:"Call Sign", field:"callsign", width:125},
	 	{title:"Offset", field:"offset", width:80, sorter:"number"},
	 	{title:"Time Delta (ms)", field:"timedrift", width:150, sorter:"number"},
	 	{title:"UTC", field:"utc", width:125, formatter:formatUtcCell, headerSortStartingDir:"desc"},
	 	{title:"RNG", field:"rng", width:75, formatter:formatRngCell, sorter:"number"},
	 	{title:"BRG", field:"brg", width:75, sorter:"number"},
	 	{title:"SNR", field:"snr", width:75, sorter:"number"},
	 	{title:"Status", field:"status", width:110, headerMenu:statusHeaderMenu},
	 	{title:"Info", field:"info", visible:false},
	 	{title:"Grid", field:"grid", visible:false}
 	],
 	initialSort:[
        {column:"utc", dir:"desc"} //sort by this first
    ]
});
