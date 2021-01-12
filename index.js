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
  
function timeFromTimestamp(ts)
{
    let unix_timestamp = ts
    var date = new Date(unix_timestamp);
    // Hours part from the timestamp
    var hours = date.getUTCHours();
    // Minutes part from the timestamp
    var minutes = "0" + date.getUTCMinutes();
    // Seconds part from the timestamp
    var seconds = "0" + date.getUTCSeconds();
    var millis = "00" + date.getUTCMilliseconds();

    // Will display time in 10:30:23.123 format
    var formattedTime = hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2) + '.' + millis.substr(-3);
    
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

ipcRenderer.on('apistatus', (event, message) => 
{
    if(message == "connected")
    {
        $('#indicator').css('background-color', '#B2FF66');
        $("div#indicator").text("API Connected");
    }
    else
    {
        $('#indicator').css('background-color', 'red');
        $("div#indicator").text("API Disconnected");
    }
});


var scrolling = 0;

// This processes the activity data from JS8Call, sent here from the server process (main.js)
ipcRenderer.on('activity', (event, message) => 
{
	//var o = JSON.parse(message);
	var o = message;
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
	    
	    var rows = table.searchRows("callsign", "=", cs);
        
	    if(rows[0]) // there should only be one entry for this call sign or something is wrong!
	    {
	        //if(rows[0].getData().status != 'new')
	        //{
                rows[0].update({offset: offset, snr:snr, timedrift:timedrift, utc:utc, status:"revised"});
                
                if(scrolling == 0)
                {
                    console.log("sorting on update row while not scrolled");
                    table.setSort(table.getSorters()[0].field, table.getSorters()[0].dir); // sort the table by whatever column and direction is selected
                }
	        //}
	    }
	    else
	    {     
            if(cs != "" && alphanumeric(cs)) // this is not perfect because there is no real indication in JS8Call there is a call sign...
            {
                if(scrolling != 0)
                {
                    console.log("not sorting on new row while scrolled");
                    table.addRow({callsign:cs, offset: offset, snr:snr, timedrift:timedrift, utc:utc, status:"new"}, true); // add to top ** test
                 }
                 else
                 {
                    table.addRow({callsign:cs, offset: offset, snr:snr, timedrift:timedrift, utc:utc, status:"new"}, true); // add row to top
                    table.setSort(table.getSorters()[0].field, table.getSorters()[0].dir); // sort the table by whatever column and direction is selected
                 }
            }
	    }
    }
});

ipcRenderer.on('rngbrg', (event, message) => 
{
    console.log(message);
    
    var rows = table.searchRows("callsign", "=", cs);
    
    if(rows[0]) // there should only be one entry for this call sign or something is wrong!
        rows[0].update({rng: message[0], brg:message[1]});
});

function updateStatus(row, status, arr)
{
    row.update({"status":status}); 
    var rowData = row.getData();
    arr.push(rowData.callsign);
    
    return arr;
}

$("form button").click(function(ev){
    ev.preventDefault()// cancel form submission
    
    if($(this).attr("value")=="buttonqth")
    {
        $("#additional-info").html("<h5>This is a test</h5>");
        //ipcRenderer.send("displayqth", sent);
    }
    else if($(this).attr("value")=="buttonmap")
    {
        ipcRenderer.send("displaymap", sent);
    }
    else if($(this).attr("value")=="buttonhistory")
    {
        ipcRenderer.send("displayhistory", sent);
    }
});

var tabledata = [
 	//{id:1, callsign:"AA9BCD", offset: "1510", snr:"-09", timedrift:"150", utc:""}
 ];
 
//create Tabulator on DOM element with id "data-table"
var table = new Tabulator("#data-table", {
 	height:367, // set height of table (in CSS or here), this enables the Virtual DOM and improves render speed dramatically (can be any valid css height value)
    //selectable:true, *** row selection is disabled for now
    rowSelected:function(row){
        row.getElement().style.backgroundColor = "#85C1E9";
    },
    scrollVertical:function(top){
        console.log(top);
        scrolling = top; // will be zero when at top and therefore sorting will be allowed

        // as soon as we scroll back to top we may as well sort again
        if(scrolling == 0)
            table.setSort(table.getSorters()[0].field, table.getSorters()[0].dir); // sort the table by whatever column and direction is selected        
    },
    rowDeselected:function(row){
        if(row.getData().status == "new")
        {
            row.getElement().style.backgroundColor = "#B2FF66";
        }
        else if(row.getData().status == "revised")
        {
            row.getElement().style.backgroundColor = "#FFFF66";
        }
        else
        {
            row.getElement().style.backgroundColor = "#FFFFFF";
        }
    },
    rowContextMenu:[
        {
            label:"Delete Row",
            action:function(e, row){
                row.delete();
            }
        },
        {
            label:"Status Clear",
            action:function(e, row){
                row.update({"status":""});
            }
        },
        {
            label:"Status New",
            action:function(e, row){
                row.update({"status":"new"});
            }
        },
        {
            label:"Status Revised",
            action:function(e, row){
                row.update({"status":"revised"});
            }
        },
        {
            label:"Status Sent",
            action:function(e, row){
                row.update({"status":"sent"});
            }
        }
    ],
 	data:tabledata, //assign data to table
 	layout:"fitColumns", //fit columns to width of table (optional)
    rowFormatter:function(row){
        if(row.getData().status == "new")
        {
            row.getElement().style.backgroundColor = "#B2FF66";
        }
        else if(row.getData().status == "revised")
        {
            row.getElement().style.backgroundColor = "#FFFF66";
        }
        else
        {
            row.getElement().style.backgroundColor = "#FFFFFF";
        }
    },
 	columns:[ //Define Table Columns
	 	{title:"Call Sign", field:"callsign"},
	 	{title:"Offset", field:"offset", width:75},
	 	{title:"SNR", field:"snr", width:75},
	 	{title:"Time Delta (ms)", field:"timedrift"},
	 	{title:"UTC", field:"utc", formatter:formatUtcCell, headerSortStartingDir:"desc"},
	 	{title:"RNG", field:"rng", width:75},
	 	{title:"BRG", field:"brg", width:75},
	 	{title:"Status", field:"status"}
 	],
 	initialSort:[
        {column:"utc", dir:"desc"} //sort by this first
    ]
});
