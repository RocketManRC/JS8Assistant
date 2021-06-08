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

// This is the client side (browser) part of this Electron application.

let $ = jQuery = require('jquery');
const {ipcRenderer} = require('electron');
const shell = require('electron').shell;
const showdown = require('./node_modules/showdown/dist/showdown.min.js');
const fs = require('fs');
let qsodatadir = "";

ipcRenderer.on('qsodatadir', (event, message) => 
{
    console.log(message);

    qsodatadir = message;
});

ipcRenderer.on('callsign', (event, message) => 
{
    console.log(message);
    $("#callsign").html('<span style="color:blue"><h4>' + message + '</h4></span>');

    // from the directory with the callsign add rows to the table from the
    // datafiles within. The timestamp is in the name of the file (end of qso).
    filenames = fs.readdirSync(qsodatadir + '/' + message); 

    filenames.forEach(file => { 
        //console.log(file); 
        let parts = file.split('.');
        let utc = Number(parts[0].substring(2));

        console.log('utc: ' + utc);

        table.addRow({utcdate:utc, utcendtime:utc, filename:file}, true); // add row to top
    }); 
});

let ts = Date.now();
let tabledata = [ // note: table format is out of date here...
    //{id:1, utcdate:ts, utcstarttime: ts, utcendtime:ts + 1000, elapsedtime:150, filename:'qd1610822723539.md'},
    //{id:2, utcdate:ts - 2000, utcstarttime: ts - 2000, utcendtime:ts - 1000, elapsedtime:150, filename:'qd' + (ts - 2000) + '.md'},
];
 
let filenameHeaderMenuLabel = "Save";
 
let filenameHeaderMenu = [
    {
        label:function(component){
            return filenameHeaderMenuLabel; 
        },
        action:function(e, column){ // this is so cool, you can modify the menu item by using a function
            if(filenameHeaderMenuLabel == "Save")
            {
                table.download("json", "data.json")
                filenameHeaderMenuLabel = "Load";
            }
            else
            {
                filenameHeaderMenuLabel = "Save";
            }
        }
    },
];

function timeFromTimestamp(ts)
{
    let unix_timestamp = ts;
    let date = new Date(unix_timestamp);
    // Hours part from the timestamp
    let hours = date.getUTCHours();
    if(hours < 10)
        hours = "0" + hours;
    // Minutes part from the timestamp
    let minutes = "0" + date.getUTCMinutes();
    // Seconds part from the timestamp
    let seconds = "0" + date.getUTCSeconds();
    let millis = "00" + date.getUTCMilliseconds();

    // Will display time in 10:30:23.123 format
    let formattedTime = hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
    
    return formattedTime;
}

function dateFromTimestamp(ts)
{
    let unix_timestamp = ts;
    let date = new Date(unix_timestamp);
    let year = date.getUTCFullYear();
    let day = "0" + date.getUTCDate();
    let month = "0" + (date.getUTCMonth() + 1);
    //console.log(date + ' ' + year + ' ' + day + ' ' + month);

    // Will display date as 2021/01/22
    let formattedDate = year + '/' + month.substr(-2) + '/' + day.substr(-2);
    
    return formattedDate;
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

function formatUtcDateCell(cell, formatterParams, onRendered)
{
    return dateFromTimestamp(cell.getValue());
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
        row.getElement().style.backgroundColor = "#85C1E9";

        // retrieve our rows filename and display it
        let filename = row.getData().filename;
        let callsign = $("#callsign").text();
        let filepath = qsodatadir + '/' + callsign + "/" + filename;

        console.log(filepath);

        // Here we want to load the .md file run showdown.js on it to convert to html, then paste it into
        // id qso-data using $("#qso-data").html(qsoText)
        const qsoText = fs.readFileSync(filepath).toString();
                
        let converter = new showdown.Converter();
        let html = converter.makeHtml(qsoText);        //let qsoText = "This is the filename " + filename + " and it can be seen that I am trying to make a loooooong line here";

        $("#qso-data").html(html);  

        //$("#callsign").html("aa0bbb");  // how to set the callsign
        
        let selectedRows = table.getSelectedRows();
        let rowCount = selectedRows.length;
                
        if(rowCount > 1) // only allow one row selected (for now)
        {
            for(i = 0; i < rowCount; i++)
            {
                if(selectedRows[i].getData().filename != filename)
                    table.deselectRow(selectedRows[i]);
            }
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
            //row.getElement().style.backgroundColor = "#FFA07A";
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
        else if(row.getData().status == "***") // this is for the directed callsign in JS8Call
        {
            row.getElement().style.backgroundColor = "#FFA07A";
        }
        else
        {
            row.getElement().style.backgroundColor = "#FFFFFF";
        }
        
        // check if still selected rows and if not disable buttons
        let selectedRows = table.getSelectedRows();
        let rowCount = selectedRows.length;
        
        if(rowCount == 0)
        {
            $('#buttonqth').attr('disabled', 'disabled');
            $('#buttonmap').attr('disabled', 'disabled');
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
        if(row.getData().status == "HB")
        {            //row.getElement().style.backgroundColor = "#FFA07A";
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
        else if(row.getData().status == "***") // this is for the directed callsign in JS8Call
        {
            row.getElement().style.backgroundColor = "#FFA07A";
        }
        else
        {
            row.getElement().style.backgroundColor = "#FFFFFF";
        }
    },
 	columns:[ //Define Table Columns
        {title:"UTC Date", field:"utcdate", width:200, formatter:formatUtcDateCell, headerSortStartingDir:"desc"},
        //{title:"UTC Start Time", field:"utcstarttime", width:150, formatter:formatUtcCell, headerSortStartingDir:"desc"},
        {title:"UTC Start Time", field:"utcendtime", width:200, formatter:formatUtcCell, headerSortStartingDir:"desc"},
        //{title:"Elapsed Time (min)", field:"elapsedtime", width:175, sorter:"number"},
	 	{title:"Filename", field:"filename", headerMenu:filenameHeaderMenu}
 	],
 	initialSort:[
        {column:"utcdate", dir:"desc"} //sort by this first
    ]
});
