/* 
 *  © 3S System Software Support, Winterthur, Switzerland
 * 
 *  Author:        Thomas Jakober <tj at 3sweb.net>
 *  Created:       01.05.2017, 09:11:23
 *  Version2:      12.01.2022 Modernize using ES6 modules as classes and call all nodejs extension devices from here
 *  Program Title: Thingsserver2 Acts as broker for intenet of things devices and displays a panel on browser
 *  File Name:     thingsserver2.js
 *  
 */

/*
 * Part 1: HTML server for Panel display
 */

/* global Promise */

import process from 'process';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { Websocketsrv } from './websocketsrv.js';
import { log } from './log.js';
import { networkInterfaces } from 'os';
import { swconf } from './swconf.js';

class Htmlsrv {
    constructor(config_file_path) {
        this.config_file_path = config_file_path;
        this.config = {};
        this.server = {};
        this.m = 'htmlsrv';
        this.init();
    };
    
    init() {
        fs.readFile(this.config_file_path, 'utf8', (err, data) => {
            if (err) {
                log.it(1, m, `Could not find configuration file ${this.config_file_path}`, 'Red');
                process.exit(1);
            }
            this.config = JSON.parse(data);
            this.config.logLevel = this.config.logLevel || 1;
            log.logLevel(this.config.logLevel);
            log.it(1, this.m, `Loglevel is: ${this.config.logLevel}`, 'Red', 'Yellow');
            this.html_server();
        });      
    };
    
    html_server() {
        this.server = http.createServer();
        this.server.on('request', (request, response) => {
            let ra = request.socket.remoteAddress;
            log.it(1, this.m, `from ${ra} got ${request.method} request for ${request.url} received`, 'Magenta');
            switch (request.method) {
                case 'GET':
                    this.get(request, response);
                    break;
                case 'POST':
                    this.post(request, response);
                    break;
                default:
                    log.it(1, this.m, `unhandled request method: ${request.method}`, 'Red');
            }
                
        }).listen(this.config.port);

        // Start websocket server
        this.websocketsrv = new Websocketsrv(this.config, this.server);

        log.it(1, this.m, 'Thingsserver ready', 'Yellow');
        // show network-interfaces
        const nets = networkInterfaces();
        for (const name of Object.keys(nets)) {
            if (name.substring(0, 8) !== 'Loopback') {
                //console.log(name+':');
                for (const net of nets[name]) {
                    // skip over non-ipv4 and internal (i.e. 127.0.0.1) addresses
                    if (net.family === 'IPv4' && !net.internal) {
                        console.log(name+': '+net.address);
                    }
                }
            }
        }
        
        //start device modules
        this.swConf = new swconf();
    };
    
    get(request, response) {
        let pathname = request.url;
        if (pathname === '/') {
            pathname = '/index.html';
        }
        fs.readFile(pathname.substring(1), (err, data) => {
            if(err) {
                // file not found
                log.it(1, this.m, `File read error: ${err}`, 'Red');
                // HTTP Status: 404 : NOT FOUND
                 // Content Type: text/plain
                 response.writeHead(404, {'Content-Type': 'text/html'});
            } else {
                // file found
                let ctype;
                switch (path.extname(pathname)) {
                    case '.html':
                    case '.htm':
                        ctype = 'text/html';
                        break;
                    case '.js':
                        ctype = 'application/javascript';
                        break;
                    case '.ico':
                        ctype = 'image/x-icon';
                        break;
                    case '.css':
                        ctype = 'text/css';
                        break;
                    case '.json':
                        ctype = 'application/json';
                        break;
                    case '.ttf':
                        ctype = 'application/font-sfnt';
                        break;
                    case '.png':
                        ctype = 'image/png';
                        break;
                    default:
                        ctype = 'text/plain';
                }
                response.writeHead(200, {
                    "Content-Type": ctype,
                    "Content-Length": data.length.toString(),
                    "Date": new Date().toUTCString(),
                    "Access-Control-Allow-Origin": "*"
                });

                // Write the content of the file to response body
                log.it(2, this.m, `Send file ${pathname} Size: ${data.length} Type: ${ctype}`, 'Magenta');
                response.write(data);
            }
            // Send the response body 
            response.end();
        });
    };
    
    post(request, response) {
        let body = '';
        request.on('data', (data) => {
            body += data;
        });
        request.on('end', () => {
            this.analyze(request, response, body);
        });
    };
    
    analyze(request, response, body) {
        let oParams = new URLSearchParams(body);
        switch (request.url.substring(1)) {
            case 'panel':
                this.servePanels(request, response, oParams);
                break;
            default:
                log.it(1, this.m, `Unknown post command: ${request.url}`, 'Red');
        }
    };
    
    servePanels(request, response, oParams) {
        switch (oParams.get('cmd')) {
            case 'loadThings':
                var s = "[\n";
                var aThings = oParams.get('fn').split(',');
                var promises = aThings.map(function (thing) {
                    return new Promise(function (resolve, reject) {
                        var fn = 'panels/' + thing.trim() + '.json';
                        log.it(3, this.m, `Read thing ${thing}`, 'Cyan');
                        fs.readFile(fn, function (err, data) {
                            if (err) {
                                console.log(err);
                                reject();
                            } else {
                                s = s + data + "\n,";
                                //console.log(s);
                                resolve();
                            }
                        });
                    });
                });
                return Promise.all(promises)
                        .then(function () {
                            s = s.substr(0, s.length - 2) + "\n]\n";
                            console.log('all things collected');
                            response.writeHead(200, {'Content-Type': 'application/json'});
                            response.write(s.toString());
                            response.end();
                        });
                break;  // case loadThings
            case 'loadThing':
                var fn = 'panels/' + oParams.get('fn').trim() + '.json';
                this.loadFile(fn, response);
                break; // case loadThing
            case 'panelList':
                this.listDir('panels/', response);
                break;
            case 'listConfig':
                this.listDir('panels/config/', response);
                break;
            case 'storeConfig':
                var fn = 'panels/config/' + oParams.get('fn').trim() + '.json';
                this.storeFile(fn, oParams.get('data'), response);
                break;
            case 'loadConfig':
                var fn = 'panels/config/' + oParams.get('fn').trim() + '.json';
                this.loadFile(fn, response);
                break;
            case 'delConfig':
                var fn = 'panels/config/' + oParams.get('fn').trim() + '.json';
                this.delFile(fn, response);
                break;
            case 'savePanel':
                var fn = 'panels/' + oParams.get('fn').trim() + '.json';
                this.storeFile(fn, oParams.get('data'), response);
                break;
            case 'deletePanel':
                var fn = 'panels/' + oParams.get('fn').trim() + '.json';
                this.delFile(fn, response);
                break;
            default:
                log.it(1, this.m, `Unknown panel command: ${oParams.get('cmd')}`, 'Red');
        }
        
    };
    
    loadFile(fn, response) {
        log.it(1, this.m, `file ${fn} requested`, 'Cyan');
        fs.readFile(fn, (err, data) => {
              if (err) {
                  log.it(1, this.m, `File read Error: ${err}`, 'Red');
            } else {
                response.writeHead(200, {'Content-Type': 'application/json'});
                response.write(data.toString());
                response.end();
                log.it(2, this.m, 'Sent file '+fn, 'Cyan');
            }
        });
    };
    
    storeFile(fn, data, response) {
        fs.writeFile(fn, data, (err) => {
            response.writeHead(200, {'Content-Type': 'text/plain'});
            if (err) {
                response.write('failed: ' + err);
                log.it(1, this.m, `File write Error: ${err}`, 'Red');
            } else {
                response.write('success');
                log.it(2, this.m, `Stored file ${fn}`, 'Cyan');
            }
            response.end();
        });
    };
    
    delFile(path, response) {
        fs.unlink(path, (err) => {
            response.writeHead(200, {'Content-Type': 'text/plain'});
            if (err) {
                logit(1, this.m, `File delete error: ${err}`, 'Red');
                response.write('error: '+err);
            } else {
                log.it(2, this.m, `File ${path} deleted`, 'Cyan');
                response.write('success');
            }
            response.end();
        });
    };
    
    listDir(path, response) {
        const dir = fs.opendirSync(path);
        var panels = '';
        while (true) {
            var dirent = dir.readSync();
            if (dirent === null) {
                break;
            }
            if (dirent.name.slice(-5) === '.json') {
                panels += dirent.name +',';
            }
        }
        dir.closeSync();
        response.writeHead(200, {'Content-Type': 'text/plain'});
        response.end(panels.substr(0, panels.length-1));
    }
};

export const htmlsrv = new Htmlsrv('config.json');