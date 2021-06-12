// findqsos - a utility to build qso data folders from the JS8Call log data.
//
// This creates the filenames with the start time whereas the real time
// code creates it with the end time. I don't see any easy way to fix this!
// Actually could get the end timestamp the same as wasqso() works since it is checking the log...

/**********************************************************

This utility requires your call sign to be set in config.js

**********************************************************/

var fs = require('fs');
const homedir = require('os').homedir();
const csv = require("csvtojson");
const config = require('./config');

async function findqsos(myCallsign) 
{
    console.log("callsign: ");
    console.log(myCallsign);

    let qsodatadir = config.qsodatadir;

    //const myCallsign = config.callsign;
    
    // If callsign is not defined then give error and exit.
    //if(myCallsign == "")
    //{
    //    console.log();
    //    console.log('Please enter your call sign in config.js and try again.');
    //    console.log();
        
    //    process.exit();
    //}
    
    console.log();
    console.log('homedir: ' + homedir);
    console.log();
    
    if(qsodatadir == "") // if no directory in config.js then use the default one
        qsodatadir = homedir + '/.js8assistant/qsodata/'; // this is the default data directory
    
    console.log('The QSO data directory (qsodatadir) is: ');
    console.log(qsodatadir);
    console.log();
    
    
    // If the qsodatadir already exists then inform the user and exit.
    //if(fs.existsSync(qsodatadir))
    //{
    //    console.log('The directory for qso data already exists, please move or delete it and try again!');
    //    console.log();
    
    //    process.exit();
    //}
    
    var js8CallAppData = process.env.LOCALAPPDATA;
    
    if(!js8CallAppData) 
    {
        js8CallAppData = process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support/JS8Call' : process.env.HOME + "/.local/share/JS8Call";
    }
    else
    {
        js8CallAppData += '/JS8Call';
    }

    console.log("JS8Call log data folder: ");
    console.log(js8CallAppData);
    
    const csvFilePath = js8CallAppData + '/js8call.log'; // The full path to JS8Call's js8call.log file
    const alltxtFilePath = js8CallAppData + '/ALL.TXT'; // The full path to JS8Call's ALL.TXT file
        
    console.log('The JS8Call data files to be used are: ');
    console.log(csvFilePath);
    console.log(alltxtFilePath);
    console.log();

    if(!fs.existsSync(csvFilePath) || !fs.existsSync(alltxtFilePath))
    {
        console.log("No JS8Call data files to use!");
        return;
    }
    
    //return; // ********* testing... ************

    const qsos = await csv({
        noheader: true,
        headers: ['startDate','startTime','endDate','endTime','callsign','grid','freq','mode','rstIn','rstOut','power','comment','name']
    }).fromFile(csvFilePath);

    qsos.forEach(function(qso) 
    {
        var startDate = qso.startDate;
        var startTime = qso.startTime;

        startString = startDate + "T" + startTime + "Z";

        var st = Date.parse(startString);

        start = JSON.stringify(st);

        var endDate = qso.endDate;
        var endTime = qso.endTime;

        endString = endDate + "T" + endTime + "Z";

        en = Date.parse(endString);

        end = JSON.stringify(en);

        //var diff = en.getTime() - st.getTime(); // in ms
        var diff = en - st; // in ms
        var minutes = (diff/60000).toFixed(1);

        console.log(start + " " + end + " " + qso.callsign + " " + minutes);
    });

    function toTimestamp(strDate)
    {
        var datum = Date.parse(strDate);
        return datum;
    }
       
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

    function wasqso(date, callsign)
    {
        var result = false;

        qsos.forEach(function(qso) 
        {
            var d = qso.startDate;
            var c = qso.callsign;

            if( d == date && c == callsign )
                result = true;
        });
            
        return(result);
    }

    var lines = fs.readFileSync(alltxtFilePath).toString().split("\n");
    var lastCallsign = "";
    var qsoNumber = 0;
    var loggedQso = false;
    var writeStream;

    for(i in lines) 
    {
        if(lines[i].includes("Transmitting")  && lines[i].includes(myCallsign + ':'))
        {
            var callsign = lastCallsign;

            var cs = lines[i].substring(59, 65);

            if(cs != 'CQCQCQ' && cs != 'HB SPO' && cs != "" && cs != "CQ CQ " && cs != "@ALLCA" && cs != "HB AUT" && cs != " HB SP")
            {
                if(cs.includes(' '))
                    callsign = cs.substring(0, 5);
                else
                    callsign = cs;
            }

            if(callsign != lastCallsign) // Is this valid? Why not two times in a row with the same callsign?
            {
                lastCallsign = callsign;

                let startDate = lines[i].substring(0, 10);
                let startTime = lines[i].substring(11, 19);
                let ts = toTimestamp(startDate + 'T' + startTime + 'Z');

                console.log('calculated timestamp');
                console.log(startDate);
                console.log(startTime);
                console.log(ts);

                if(wasqso(startDate, callsign))
                {
                    qsoNumber++;
                    loggedQso = true;
                    console.log('');
                    console.log("start of LOGGED qso " + qsoNumber + " at line " + i);

                    // Save the file in format qsodatadir/callsign/qd1610822723539.md (for example)
                    let dir = qsodatadir + callsign;
                    if(!fs.existsSync(dir)){
                        fs.mkdirSync(dir, { recursive: true });
                    }

                    writeStream = fs.createWriteStream(dir + '/qd' + ts + '.md');
                }
                else
                {
                    loggedQso = false;
                    //console.log("\nstart of possible qso at line " + i);
                }

                if(loggedQso)
                {
                    console.log(lines[i]);
                    console.log("callsign: " + callsign + "\n");
                    console.log("date: " + startDate);
                    console.log("time: " + startTime);
                }
            }

            let wroteSomethingTransmit = false;

            while(lines[i].includes("Transmitting") && !lines[i].includes("HB AUTO RELAY SPOT") && !lines[i].includes("HB SPOT") && !lines[i].includes("CQCQCQ") && !lines[i].includes("CQ CQ"))
            {
                var t = lines[i].substring(51);
                if(loggedQso)
                {
                    console.log(i + " " + t);
                    //writeStream.write("\n" + i + " " + t);
                    let parts = t.split(':');
                    let cs = parts[0];
                    let msg = parts[1];                    
                    let res;
                    
                    if(alphanumeric(cs))
                        res = '<span style="color:blue">' + '\n**' + cs + ':**' + msg; // simple markdown + html annotation
                    else
                        res = t;

                    writeStream.write(res);
                    wroteSomethingTransmit = true;
                }
                i++;
            }

            if(loggedQso && wroteSomethingTransmit)
            {
                //console.log('end of transmission block');
                console.log('');
                writeStream.write('\n</span>\n\n');
            }

            let offset = "";
            let isnew = 0;
            let wroteSomethingReceive = false

            while(lines[i] && !lines[i].includes("Transmitting"))
            {
                if(lines[i].includes(myCallsign))
                {
                    offset = lines[i].substring(16, 20); 
                    var isnum = /^\d+$/.test(offset);
                    if( !isnum )
                    {
                        offset = lines[i].substring(28, 32); // format was changed at some point
                        isnew = 1;
                    }

                    let t;

                    if( isnew )
                        t = lines[i].substring(62);
                    else
                        t = lines[i].substring(50);

                    if(loggedQso)
                    {
                        //console.log(i + " " + t);
                        //writeStream.write("\n" + i + " " + t);
                        let parts = t.split(':');
                        let me = parts[0];
                        let msg = parts[1];
                        let res = '<span style="color:green">' + '\n**' + me + ':**' + msg; // simple markdown + html annotation
                                    
                        console.log(res);
                        writeStream.write(res);
                        wroteSomethingReceive = true;
                    }
                }
                else if( offset != "")
                {
                    if( isnew )
                        ioffsetNew = parseInt(lines[i].substring(28, 32), 10);
                    else
                        ioffsetNew = parseInt(lines[i].substring(16, 32), 10);

                    ioffset = parseInt(offset, 10);

                    if(ioffsetNew >= ioffset - 10 && ioffsetNew <= ioffset + 10)
                    {
                        if( isnew )
                            var t = lines[i].substring(61);
                        else
                        var t = lines[i].substring(50);

                        if(loggedQso)
                        {
                            console.log(i + " " + t);
                            writeStream.write(t);
                            wroteSomethingReceive = true;
                        }
                    }
                }

                i++;
            }

            if(loggedQso && wroteSomethingReceive)
            {
                console.log('');
                writeStream.write('\n</span>\n\n');
            }
        }
    }
}

module.exports = { findqsos };