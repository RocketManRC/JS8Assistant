'use strict';

const electron = require('electron');
const app = electron.app;
const path = require('path');
const os = require('os');
const ElectronPreferences = require('electron-preferences');
const main = require('./main');
const log = require('electron-log');

let datadir = path.resolve(app.getPath('userData', 'preferences.json'));

console.log(path.resolve(app.getPath('userData'), 'preferences.json'));

var config = require('./config');
let qsodatadir = config.qsodatadir;

if(qsodatadir == "")
{
    const homedir = require('os').homedir();
    if(process.env.LOCALAPPDATA != undefined) // Windows?
        qsodatadir = homedir + '\\.js8assistant\\qsodata'; // this is the default data directory for Windows
    else
        qsodatadir = homedir + '/.js8assistant/qsodata';    // and for Linux and MacOS
}

let logPath = log.transports.file.getFile().path;

const preferences = new ElectronPreferences({
    'dataStore': path.resolve(app.getPath('userData'), 'preferences.json'),
    'defaults': {
            'settings': {
                'distance_unit': 'km',
                'remote_ip': '127.0.0.1',
                'font_size': '14'
            },
    },
    'browserWindowOverrides': {
        'title': 'JS8Assistant Settings',
    },
    'sections': [
        {
            'id': 'settings',
            'label': 'Settings',
            'icon': 'settings-gear-63',
            'form': {
                'groups': [
                    {
                        'label': 'Settings',
                        'fields': [
                            {
                                'label': 'Call Sign',
                                'key': 'call_sign',
                                'type': 'text',
                            },
                            {
                                'label': 'Distance Unit',
                                'key': 'distance_unit',
                                'type': 'dropdown',
                                'options': [
                                    {'label': 'Kilometers', 'value': 'km'},
                                    {'label': 'Miles', 'value': 'miles'},
                                ],
                            },
                            {
                                'label': 'Remote IP Address',
                                'key': 'remote_ip',
                                'type': 'text',
                            },
                            {
                                'label': 'Font Size (default is 14)',
                                'key': 'font_size',
                                'type': 'text',
                            },
                        ]
                    }
                ]
            }
        },
        {
            'id': 'info',
            'label': 'Info',
            'icon': 'notes',
            'form': {
                'groups': [
                    {
                        'label': 'Info',
                        'fields': [
                            {
                                'heading': 'QSO Data Folder',
                                'content': qsodatadir,
                                'type': 'message',
                            },
                            {
                                'heading': 'JS8Assistant Preferences Folder',
                                'content': datadir,
                                'type': 'message',
                            },
                            {
                                'heading': 'Log Folder',
                                'content': logPath,
                                'type': 'message',
                            },
                        ]
                    }
                ]
            }
        },
    ]
});

module.exports = preferences;
