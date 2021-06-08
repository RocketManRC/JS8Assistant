// Configuration options for JS8Assistant

var config = {};

config.callsign = "";  // Put your call sign here in UPPER CASE.

// The distance unit for the tabulator RNG column and PSKReporter.
config.distanceUnit = "km"; // "km" or "miles"
 
// Change the following item to connect to JS8Call on a remote host. 
// If you do that then you should specify the TCP address in JS8Call
// reporting preferences to be 0.0.0.0 instead of 127.0.0.1
config.remoteIpAddress = "127.0.0.1"; 

// The default data directory for QSO data is '~/.js8assistant/qsodata'.
// Put the full path here if you don't want the default data directory
// but make sure that the directory you want to use already exists.
config.qsodatadir = ""; 

module.exports = config;
