/*
    play.js -
    
    A utility to playback packets to JS8Assistant that were recorded from 
    JS8Call using the record.js utility. Useful for testing.
    
    This does not do any processing, it just sends the recorded packets one
    after another with a delay given by delayMs defined below.
    
    Usage: 
    
    $ node play.js filename 
*/

const fs = require('fs')

const delayMs = 200; // time between sent packets

var args = process.argv.slice(2);
//console.log('args: ', args);

if(args.length != 1)
{
    console.log("Usage: node play.js filename");
    process.exit();
}

filename = args[0];

packets = [];

const loadData = (path) => {
  try {
    return fs.readFileSync(path, 'utf8')
  } catch (err) {
    console.error(err)
    return false
  }
}

console.log("testing...");

packets = JSON.parse(loadData(filename));

console.log(packets.length);

const net = require('net');

const server = new net.createServer();

server.listen(2442, '127.0.0.1');

function sleep(millis) 
{
	return new Promise(resolve => setTimeout(resolve, millis));  
}

async function sendPackets(socket)
{
    for(i = 0; i < packets.length; i++)
    {
        socket.write(JSON.stringify(packets[i]) + '\n');
        console.log(packets[i]);
        console.log("packet: " + i);
        await sleep(delayMs);   
    }  
    
    console.log("Packets sent...");      
}

server.on('connection', function(socket) 
{
    console.log('A new connection has been established.');
    
    // set a timer to start send the packets in 2 seconds (give JS8Assistant time to open its window)
    setTimeout(sendPackets, 2000, socket);
    
    socket.on('end', function() 
    {
        console.log('Closing connection with the client');
    });

    socket.on('error', function(err) 
    {
        console.log(`Error: ${err}`);
    });
});

