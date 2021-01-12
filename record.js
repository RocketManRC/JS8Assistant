/*
    record.js - records packets from JS8Call for later playback.
    
    This uses lib-js8Call.
    
    It saves the data in a filename that has the UTC date and time in it.
    An example is: js8data20210112165111.json
    
    The packets are saved when the connection to JS8Call is closed
    and the date and time of the filename are set then.
*/


let connected = false;
let packets = [];

const fs = require('fs')

const storeData = (data, path) => {
  try {
    fs.writeFileSync(path, JSON.stringify(data))
  } catch (err) {
    console.error(err)
  }
}

const loadData = (path) => {
  try {
    return fs.readFileSync(path, 'utf8')
  } catch (err) {
    console.error(err)
    return false
  }
}

const js8 = require('@trippnology/lib-js8call')({
    tcp: { enabled: true, port: 2442 },
    udp: { disabled: false, port: 2242,  },
});

function timeoutCheck()
{
    if(!connected)
    {
        js8.tcp.connect(); 
    }
}

setInterval(timeoutCheck, 5000);

js8.on('tcp.connected', (connection) => {
    console.log(
        'Server listening %s:%s Mode: %s',
        connection.address,
        connection.port,
        connection.mode
    );
    
    connected = true;
});

function getUTCDateTimeString() 
{
    const date = new Date();
    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    const day =`${date.getUTCDate()}`.padStart(2, '0');
    const hours =`${date.getUTCHours()}`.padStart(2, '0');
    const minutes =`${date.getUTCMinutes()}`.padStart(2, '0');
    const seconds =`${date.getUTCSeconds()}`.padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`
}


js8.on('tcp.disconnected', (s) => {
    // Lost the tcp connection
    console.log(s);
    
    let utcDateTime = getUTCDateTimeString();
    
    storeData(packets, "js8data" + utcDateTime + ".json");
    
    connected = false;
    
    process.exit(1);
});

js8.on('tcp-error', (e) => {
    // tcp error
    console.log();
});

js8.on('packet', (packet) => {
    // Do your custom stuff
    //console.log(packet);
    packets.push(packet);
    console.log(packets.length);
});

