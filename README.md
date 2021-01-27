# JS8Assistant
A NodeJS/Electron cross-platform application to assist with using JS8Call.

This application is primarily a demonstration of the library lib-js8call although it does do some useful things.

# Installation
Make sure you have a recent LTS version of Node.js. I was using Node.js v14.15.3 and NPM 6.14.10.

Clone this repository or download the zip file.

In the application folder install the dependencies:

$ npm install

To run the application:

$ npm start

This application should run under MacOS, Windows 10 and at least Debian flavours of Linux without any changes.

There may be an issue that has to be resolved manually after using NPM to install on Linux. See here:

https://github.com/electron/electron/issues/17972#issuecomment-487369441

# Notes
This application uses the TCP API of JS8Call version 2.2.0. It is important that the TCP 
port number set in JS8Call matches the port number in this application which is currently
coded to be 2442. The three checkboxes to enable the TCP API should also be checked.

JS8Call can be found here:

http://files.js8call.com/latest.html

At the moment keeping track of QSO History requires using the JS8Call log function at the end of each QSO.
