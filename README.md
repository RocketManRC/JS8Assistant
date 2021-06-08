# JS8Assistant
A Node.js and Electron cross-platform application to assist with using JS8Call.

The primary purpose of this application is to provide information about the current
activity in JS8Call and in particular information about previous QSOs including the
text of the messages that were exchanged which is referred to as QSO History. 
It will also try to supply public information about call signs and allow lookups with your
default web browser on QRZ.com and PSKReporter. There is also the option to show the 
grid square on levinecentral.com.


![Photo](images/js8assistant1.jpeg)


![Photo](images/js8assistant2.jpeg)


# History
When I first started using JS8Call for QSOs I tried to keep good notes about the conversations 
but of course I got lazy after a while and wasn't very consistent about it. That meant that
I was always having to search my notes about a call sign to see if I had any and if not
try to find info on the web.

I had previously done a project to help with net control using the JS8Call API and decided to
try and build on what I had done with that.

I have been using JS8Assistant for a number of months now and finally in June 2021 found
the time and energy to clean it up enough to release it as open source. I hope it is
as helpful for others as it is for me!


# Installation
This is a Node.js application and uses the Electron framework. It uses web technologies and
is cross platform. It should run under MacOS, Windows 10 and at least Debian flavours of Linux 
(including the Raspberry Pi) without any changes.

I am only supplying this in source forma at the moment but all that means is that you 
have to edit one file and then run the application from the command line after installing it.

Make sure you have a recent long term supported (LTS) version of NodeJS installed. 
I have been using Node.js v14.15.3 and NPM 6.14.10. 

Node.js can be downloaded from here:

https://nodejs.org/en/download/

Clone the repository or download the zip file.

In the application's folder use the command line to install the dependencies:

$ npm install

Edit the file config.js and put in your call sign.

To run the application:

$ npm start

This application should run under MacOS, Windows 10 and at least Debian flavours of Linux 
without any changes.

There most likely will be an issue that has to be resolved manually after using NPM to 
install on Linux. See here:

https://github.com/electron/electron/issues/17972#issuecomment-487369441

# Notes
This application uses the TCP API of JS8Call version 2.2.0. It is important that the TCP 
port number set in JS8Call matches the port number in this application which is currently
coded to be 2442. The three checkboxes to enable the TCP API should also be checked.

JS8Call can be found here:

http://files.js8call.com/latest.html

IMPORTANT:

At the moment keeping track of QSO History requires using the JS8Call log function at the 
end of each QSO. But you do that already anyway, don't you? If you have been then there
is a utility that will attempt to build QSO history files for you from JS8Call's
ALL.TXT and js8call.log files. This will only work well if you have not allowed in 
JS8Call's preferences directed messages without sending call signs.

To run this utility use the command line:

$ node findqsos.js

You should only really run this once to get started but if you need to run it again
you should back up your qso data folder (it's location is printed out on the terminal
when you run JS8Assistant).


