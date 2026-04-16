/* 
 *  © 3S System Software Support, Winterthur, Switzerland
 * 
 *  Author:        Thomas Jakober <tj at 3sweb.net>
 *  Created:       01.05.2017, 09:11:23
 *  Version2:      12.01.2022 Modernize using ES6 modules as classes
 *  Program Title: Websocket server part of thingsserver2
 *  File Name:     websocketsrv.js
 *  
 */

import { htmlsrv } from './thingsserver2.js';
import process from 'process';
import * as fs from 'fs';
import WebSocket, { WebSocketServer } from 'ws';
import * as https from 'https';
import si from 'systeminformation';
import { log } from './log.js';
import { ut } from './ut.js';
import * as readline from 'node:readline';

export class Websocketsrv {
    constructor(config, server) {
        this.config = config;
        this.http_server = server;
        this.wss = {};
        this.cfg = {};
        this.missingPongs = 4;
        this.pongTimeout = 10;   // Seconds
        this.chunkSize = 1024;
        this.remoteAddress = '';
        this.startTime = new Date();
        this.m = 'websocketsrv';
        this.init();
    };

    init() {
        this.wss = new WebSocketServer({server: this.http_server, backlog: 4096});
        this.wss.on('connection', (conn, request) => this.connection(conn, request));
        //this.checkConnections();
        if (process.platform === "win32") {
            
            let rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            rl.on("SIGINT", () => {
                console.log('SIGINT received');
                this.shutdown();
            });
        }
        process.on('SIGINT', () => {
            console.log('SIGINT signal received.');
            this.shutdown();
        });
    };

    shutdown() {
        console.log('in shutdown');
        for (let conn of this.wss.clients.keys()) {
            conn.close(1000, 'Websocket Server Shutdown');
        }
        log.it(1, this.m, `User stopped`, 'Red');
        process.exit(1);
    }
    
    connection(conn, request) {
        this.remoteAddress = request.socket.remoteAddress;
        log.it(1, this.m, `Got connection from ${this.remoteAddress}`, 'Green');
        let self = this;
        conn.on('pong', function() {
            self.heartbeat.call(self, this);
        });
        conn.on('message', (msg) => {;
            this.message(conn, msg);
        });
        conn.on('close', (code, reason) => {
            //this.analyseClose(conn, code, reason);
            if (conn.nodeInfo) {
                if (conn.nodeInfo.chktmr) {
                    clearTimeout(conn.nodeInfo.chktmr);
                }
                log.it(1, this.m, `Connection to ${conn.nodeInfo.description} [${conn.nodeInfo.nodeId}] closed. Reason: ${reason} Code: ${code}`, 'Red');
            } else {
                log.it(1, this.m, `unknown connection closed`, 'Red');
            }
            conn.terminate();
        });
        conn.on('error', (err) => {
            if (conn.nodeInfo) {
                if (conn.nodeInfo.chktmr) {
                    clearTimeout(conn.nodeInfo.chktmr);
                }
                log.it(1, this.m, `Connection error from ${conn.nodeInfo.description} [${conn.nodeInfo.nodeId}] Error: ${err}`, 'Red');
            } else {
                log.it(1, this.m, `Connection Error: ${err}`, 'Red');
            }
            conn.terminate();
        });
    };
    
    message(conn, str) {
        // process commands of 
        if (conn.missingPongs < this.missingPongs) {
            log.it(1, this.m, `Message received from ${conn.nodeInfo.description} [${conn.nodeInfo.name}], reset ${this.missingPongs - conn.missingPongs} missing pongs`, 'White');
            conn.missingPongs = this.missingPongs;
        }
        conn.isAlive = true;
        log.it(2, this.m, `Received: ${str}`, 'Yellow');
        if (str === false) return;
        const oData = JSON.parse(str);
        //oData.nodeId = oData.nodeId.toString();     // ensure that nodeId is a string
        if (typeof(this[oData.cmd]) === 'function') {
            this[oData.cmd](conn, oData);
        } else {
            log.it(1, this.m, `Unknown command received: ${oData.cmd} `, 'Red');
        }
    };
    
    register(conn, oData) {
        /* Received register from a thing
         * First check whether there is still a old connection from this thing
         */
        for (let c of this.wss.clients.keys()) {
            if (c.nodeInfo &&  c.nodeInfo.nodeId === oData.nodeId && c !== conn) {
                log.it(2, this.m, `Old node connection terminated: ${c.nodeInfo.name} (${c.nodeInfo.description}) [${c.nodeInfo.nodeId}]`, 'Red');
                c.terminate();
            }
        }
        // Now create nodeinfo object and attach it to the connection object
        conn.nodeInfo = {
            type: 'node',
            name: oData.thing,
            nodeId: oData.nodeId,
            description: oData.description,
            services: oData.services
        };

        // activate connection checker time interval
        conn.missingPongs = this.missingPongs;
        conn.nodeInfo.chktmr = setInterval(() => this.checkConnection(conn), this.pongTimeout * 1000);

        // create response message to get actual data from this thing
        let d = new Date();
        let response = {
            cmd: 'regOk',
            date: ut.stringDate(d),
            epoch: d.getTime(),
            ip: this.remoteAddress
        };
        // send it
        log.it(1, this.m, `Node successfully registered: node ${oData.description} [${oData.nodeId}]`, 'Green');
        this.sendmsg(conn, response);
        
        // Inform all active control's about this node and its servoces
        // scan over connected nodes
        for (let sc of oData.services) {
            for (let c of this.wss.clients.keys()) {
                // only controls needed
                if (c.nodeInfo && c.nodeInfo.type === 'control') {
                    // Scan over services
                    for (let sn of c.nodeInfo.services) {
                        // only current Service for current node needed
                        if (sn.name === sc.name && sn.from === oData.nodeId) {
                            let dataset = {
                                cmd: 'dataset',
                                nodeId: oData.nodeId
                            };
                            for (let n in sc) {
                                dataset[n] = sc[n];
                            }
                            log.it(2, this.m, `Data ${sc.name} from node ${oData.nodeId} sent to ${c.nodeInfo.uuId}`, 'White');
                            this.sendmsg(c, dataset);
                        }
                    }
                }
            }
        }
    };
    
    regControl(conn, oData) {
        // Received register from a Control Panel
        // First check whether there is still a old connection from this Panel
        for (let c of this.wss.clients.keys()) {
            if (c.nodeInfo && c.nodeInfo.uuId === oData.uuId && c !== conn) {
                // found an old connetion, close it
                log.it(2, this.m, `Old control connection terminated: ${c.name} [${c.nodeInfo.uuId}]`, 'Red');
                c.terminate();
           }
        };
        // Now create nodeinfo object and attach it to the connection object
        conn.nodeInfo = {
            type: 'control',
            name: oData.name,
            uuId: oData.uuId,
            description: oData.description,
            services: oData.services
        };

        // activate connection checker time interval
        conn.missingPongs = this.missingPongs;
        conn.nodeInfo.chktmr = setInterval(() => this.checkConnection(conn), this.pongTimeout * 1000);

        // Create response record
        var d = new Date();
        var response = {
            cmd: 'regOk',
            date: ut.stringDate(d),
            epoch: d.getTime()
        };
        // Send it to the panel
        log.it(1, this.m, `Control successfully registered: control ${oData.name} [${oData.uuId}]`, 'Green');
        this.sendmsg(conn, response);
        // request from each node the data immediately
        // create a table of all needes services
        let aSv = {};
        for (let sn of conn.nodeInfo.services) {
            if (aSv[sn.from]) {
                if (aSv[sn.from]) {
                    if (!aSv[sn.from].includes(sn.name)) {
                        aSv[sn.from].push(sn.name);
                    }
                }
            } else {
                aSv[sn.from] = [sn.name];
            }
        }
        for (let node in aSv) {
            for (let cn of this.wss.clients) {
                // find node with corresponding nodeId
                if (cn.nodeInfo && cn.nodeInfo.nodeId && cn.nodeInfo.nodeId === node) {
                    const rq = {
                        cmd: 'rqData',
                        nodeId: node,
                        date: ut.stringDate(d),
                        epoch: d.getTime(),
                        services: []
                    };
                    // select services which are subscribed
                    for (let sc of aSv[node]) {
                        // only once (they could be subscribed on multiple panels)
                        rq.services.push({name: sc, from: node});
                    }
                    this.sendmsg(cn, rq);
                }
            }
        }
    };

    checkConnection(conn) {
        log.it(3, this.m, `check connection of ${conn.nodeInfo.description} [${conn.nodeInfo.name}]`, 'White');
        if (conn.isAlive === false) {
            conn.missingPongs--;
            if (conn.missingPongs > 0) {
                log.it(1, this.m, `Pong missed from ${conn.nodeInfo.description}  [${conn.nodeInfo.name}], still left ${conn.missingPongs}`, 'White');
            }
            if (conn.missingPongs === 0) {
                log.it(1, this.m, `${conn.nodeInfo.description} PONG timed out`, 'Red');
                //this.analyseClose(conn, -1, 'Pong Timeout');
                conn.close(1001, 'Missing 4 consecutive pong frames');
                return;
            }
        } else {
            conn.missingPongs = this.missingPongs;
        }
        conn.isAlive = false;
        conn.ping(this.noop);       // send another ping anyway
        log.it(3, this.m, `PING sent to: ${conn.nodeInfo.description} [${conn.nodeInfo.name}]`, 'Cyan');
    }
    
    heartbeat(conn) {
        let cl = this.identifyClient(conn);
        log.it(3, this.m, `pong received from ${cl}`, 'Green');
        if (conn.missingPongs < this.missingPongs) {
            log.it(1, this.m, `Pong now received, reset missing ${this.missingPongs - conn.missingPongs} pongs: ${cl}`, 'White');
            conn.missingPongs = this.missingPongs;
        }
        if (cl === 'Unknown connection') {
            log.it(1, this.m, `terminate unknown connection`, 'Red');
            this.terminate();
        } else {
            conn.isAlive = true;
        }
    };

    time(conn, oData) {
        // command to send actual date and time
        // a thing could request this to sync his timekeeping
        this.sendmsg(conn, {
            cmd: 'time',
            date: ut.stringDate(new Date()),
            epoch: new Date().getTime()
        });
        
    };
    
    set(conn, oData) {
        /*
          * When a control panel changes a value or change the state of a switch it sends a "set" command
          * This is forwardes to the target thing
          */
         if (oData.type === 'control') {
             // find target node's connection
             for (let c of this.wss.clients.keys()) {
                if (c.nodeInfo && String(c.nodeInfo.nodeId) === String(oData.to)) {
                    log.it(3, this.m, `send set to ${c.nodeInfo.nodeId} to ${c.nodeInfo.nodeId} oData.to: ${oData.to}`, 'Green');
                    if (String(c.nodeInfo.nodeId) === String(oData.to)) {
                        var msg = {
                            cmd: 'set',
                            from: oData.from,
                            services: oData.services
                        };
                        this.sendmsg(c, msg);
                    }
                }
             };
         } else {
             log.it(1, this.m, `illegal "set" command for type [${oData.type}]`, 'Red');
         }
    };
     
    data(conn, oData) {
        // received data from thing or from control
        if (oData.type === 'node') {
            // send received data to all Control Panels which require these
            // scan over connected nodes
            for (let sc of oData.services) {
                // scan over onnections
                for (let c of this.wss.clients.keys()) {
                    // only Control Panels needed
                    if (c.nodeInfo && c.nodeInfo.type === 'control') {
                        // scan over Services
                        for (let sn of c.nodeInfo.services) {
                            // only current Service for current node needed
                            if (sn.name === sc.name && String(sn.from) === String(oData.nodeId)) {
                                var dataset = {
                                    cmd: 'dataset',
                                    nodeId: oData.nodeId
                                };
                                for (var n in sc) {
                                    dataset[n] = sc[n];
                                }
                                log.it(2, this.m, `Data ${sc.name} from node ${oData.nodeId} sent to ${c.nodeInfo.uuId}`, 'Cyan');
                                this.sendmsg(c, dataset);
                            }
                        };
                    }
                };
            };
        } else if (oData.type === 'control') {
            // to be done
        } else {
            log.it(1, this.m, `Unknown data type type for "data" cmd received: [${oData.type}]`, 'Red');
        }
    };
     
    control(conn, oData) {
        /*
         * This is a control message (not to be confused with a control panel)
         * Intended to be used for contol functions from nodes to be carried out by server
         */
        if (oData.type === 'node') {
            // received from a thing
            for (let c of oData.services) {
                switch (c.type) {       // control type
                    case 'mail':
                        /*
                         * Mail service: forward mail to a mail server
                         * can be used for things to send alarm messages
                         * (required because could not authenticate a thing to
                         * mailservers which require authentication)
                         */
                        if (this.config.mailuser) {
                            const nodemailer = require('nodemailer');
                            log.it(1, this.m, `*** Send Mail to ${c.to}`, 'Yellow');
                            let transport = nodemailer.createTransport({
                                host: "3sweb.net",
                                port: 465,
                                secure: true, // false 587, true for 465, false for other ports
                                tls: {rejectUnauthorized: false},
                                auth: {
                                    user: this.config.mailuser,
                                    pass: this.config.mailpass
                                }
                            });
                            let message = {
                                from: c.from, // sender address
                                to: c.to, // list of receivers
                                subject: c.subject, // Subject line
                                text: c.value // plain text body
                            };

                            transport.sendMail(message, function (err, info) {
                                if (err) {
                                    log.it(1, this.m, `Mail error: ${err}`, 'Red');
                                } else {
                                    log.it(2, this.m, `Info: ${info}`, 'Yellow');
                                }
                            });
                        }
                        break;
                    default:
                        log.it(1, this.m, `Unsupported control command: ${c.type}`, 'Red');
                }

            };
        }
    };
     
    ctrlList(conn, oData) {
        // return list of control panel connections
        log.it(2, this.m, `Send Control Connections list to Panel ${conn.nodeInfo.name}`, 'Yellow');
        let controls = [];
        for (let c of this.wss.clients) {
            if (c.nodeInfo && c.nodeInfo.type === 'control') {
                log.it(3, this.m, `Control ${c.nodeInfo.name} uuid: ${c.nodeInfo.uuId}`, 'Yellow');
                var control = {
                    uuId: c.nodeInfo.uuId,
                    name: c.nodeInfo.name,
                    description: c.nodeInfo.description,
                    services: c.nodeInfo.services
                };
                controls.push(control);
            }
        };
        let cl = {
            cmd: 'controllist',
            list: controls
        };
        this.sendmsg(conn, cl);
    };
     
    debLevel(conn, oData) {
        // set server debug Level (0-3)  to be output on the server console
         let level = Number(oData.dbglevel);
         if (level >= 0 && level <= 3) {
             log.logLevel(level);
             this.config.logLevel = oData.dbglevel;
             fs.writeFile(htmlsrv.config_file_path, JSON.stringify(this.config), () => {
                 log.it(1, this.m, `Log Level changed to ${oData.dbglevel}`, 'Red');
             });
         }
    };

    serverInfo(conn, oData) {
        // collect some Server Data to be shown at the conrtol panel
        si.cpuTemperature((o) => {
            let clts = 0;
            let controls = 0;
            let nodes = 0;
            let unknown = 0;
            for (let c of this.wss.clients) {
                clts++;
                if (typeof (c.nodeInfo) === 'object') {
                    if (c.nodeInfo.type === 'control') {
                        controls++;
                    } else if (c.nodeInfo.type === 'node') {
                        nodes++;
                    } else {
                        unknown++;
                    }
                }
            }
            const cl = {
                cmd: 'serverInfo',
                server: {
                    dbgLevel: log.getLevel(),
                    clients: clts,
                    controls: controls,
                    nodes: nodes,
                    unknown: unknown,
                    cpuTemp: o.main,
                    cpuMax: o.max,
                    nodeVersion: process.version,
                    process_Id: process.pid,
                    runTime: ut.msToDHMS(new Date() - this.startTime)
                }
            };
            this.sendmsg(conn, cl);
        });
    };

    nodeList(conn, oData) {
        // return list of thing connections
        log.it(1, this.m, `Node Connections:`, 'Yellow');
        const nodes = [];
        for (let c of this.wss.clients) {
            if (typeof (c.nodeInfo) === 'object' && c.nodeInfo.type === 'node') {
                log.it(1, this.m, `Node: ${c.nodeInfo.nodeId}`, 'Yellow');
                var node = {
                    nodeId: c.nodeInfo.nodeId,
                    name: c.nodeInfo.name,
                    description: c.nodeInfo.description,
                    services: c.nodeInfo.services
                };
                if (oData.services) {
                    node.ervices = c.nodeInfo.services;
                }
                nodes.push(node);
            }
        };
        var cl = {
            cmd: 'nodelist',
            list: nodes
        };
        this.sendmsg(conn, cl);
    };
     
    https(conn, oData) {
        /*
         * Https request
         * since NodeMCU https-requeste do not work the server does this instead.
         * Make a http-Request of a given URL and send the response to the device
         */
        log.it(1, this.m, `https request processing`);
        const opt = new URL(oData.url);
        var conn1 = conn;
        var oMsg = {
            cmd: 'https',
            status: '',
            headers: '',
            body: ''
        };
        var data = '';
        https.get(opt, (response) => {
            oMsg.status = response.statusCode;
            var conn2 = conn1;
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                oMsg.body = JSON.parse(data);
                sendmsg(conn2, oMsg);
            });
        });
    };


    /*
     * Message group 'forward'
     */
    stopLog(conn, oData) {
        this.forward(conn, oData);
    };
     
    sendLog(conn, oData) {
        this.forward(conn, oData);
    };
     
    info(conn, oData) {
        this.forward(conn, oData);
    };
     
    getFile(conn, oData) {
        this.forward(conn, oData);
    };
     
    setFile(conn, oData) {
        this.forward(conn, oData);
    };
     
    listFiles(conn, oData) {
        this.forward(conn, oData);
    };
     
    delFile(conn, oData) {
        this.forward(conn, oData);
    };
     
    rqData(conn, oData) {
        this.forward(conn, oData);
    };
    
    
    forward(conn, oData) {
        /*
         * forward a message from Control to the node
         * sends the message without any change
         * 
         */
        for (let c of this.wss.clients.keys()) {
            if (c.nodeInfo && c.nodeInfo.nodeId && c.nodeInfo.nodeId === oData.from) {
                log.it(1, this.m, `send ${oData.cmd} to node ${oData.from}`, 'Yellow');
                this.sendmsg(c, oData);
            }
        };
     };
     
     /*
      * Message Group 'feedback'
      */
    
    log(conn, oData) {
        this.feedBack(conn, oData);
    };
     
    nodeInfo(conn, oData) {
        this.feedBack(conn, oData);
    };
     
    editFile(conn, oData) {
        this.feedBack(conn, oData);
    };
     
    fileList(conn, oData) {
        this.feedBack(conn, oData);
    };
     
    deleteOk(conn, oData) {
        this.feedBack(conn, oData);
    };
     
    saveOk(conn, oData) {
        this.feedBack(conn, oData);
    };
    
    feedBack(conn, oData) {
        /*
         * Sends a Message from a node back to the control as is
         */
        for (let c of this.wss.clients.keys()) {
            if (c.nodeInfo && c.nodeInfo.uuId === oData.to) {
                log.it(1, this.m, `send ${oData.cmd} request to node ${oData.to}`, 'Green');
                this.sendmsg(c, oData);
            }
        };
    };
    
    /*
     * File transfer funcions
     * processes file transfer to the nodes in chunks of data
     */
    setFile(conn, oData) {
        /*
         * This is used to send files to  a thing over the air
         * It will receive the file from the control panel as one base64 
         * encoded file message to be able to send binary files
         * 
         * This message will be forwarded to the thing in chunks of 1k bytes
         * because there is not enough RAM on these beside the application
         * which runs on them
         */
        // find node connection to which the file is to be sent
        for (let c of this.wss.clients) {
            if (typeof (c.nodeInfo) === 'object') {
                if (c.nodeInfo.type === 'node') {
                    if (String(c.nodeInfo.nodeId) === String(oData.to)) {
                        log.it(1, this.m, `send file to node ${oData.to}`, 'Yellow');
                        this.sendmsg(c, oData);
                    }
                }
            }
        };
    };
     
    fileOk(conn, oData) {
        // send OK from the thing back the panel when the file transfer is complete 
        var oMsg = {
            cmd: 'fileOk',
            to: oData.to,
            from: oData.from,
            ok: oData.ok
        };
        // find panel connection which got the file
        for (let c of this.wss.clients) {
            if (c.nodeInfo && c.nodeInfo.type === 'control' && c.nodeInfo.uuId === oData.to) {
                log.it(1, this.m, `sent fileOk to panel ${c.nodeInfo.name} [${c.nodeInfo.uuId}]`, 'Yellow');
                this.sendmsg(c, oMsg);
                c.oFile = null;
            }
        };
    };
     
    chunkOk(conn, oData) {
        // received when the thing has completed a chunk
        if (oData.ok === 'YES') {
            if (oData.chunkNo === oData.nChunks - 1) {
                for (let c of this.wss.clients) {
                    if (c.nodeInfo && c.nodeInfo.type === 'control' && c.nodeInfo.uuId === conn.oFile.to) {
                        log.it(2, this.m, `sent chunkOk to panel ${c.nodeInfo.name} [${c.nodeInfo.uuId}]`, 'Yellow');
                        let oMsg = {
                            cmd: 'fielOk',
                            from: conn.oFile.to,
                            ok: 'YES'
                        };
                        this.sendmsg(c, oMsg);
                        c.oFile = null;
                    }
                };
            } else {
                this.sendChunk(conn, oData.chunkNo + 1, oData.nChunks);
            }
        } else {
            // in case of an error
            let oMsg = {
                cmd: 'fielOk',
                from: conn.oFile.to,
                ok: 'NO'
            };
            for (let c of this.wss.clients) {
                if (c.nodeInfo && c.nodeInfo.type === 'control' && c.nodeInfo.uuId === conn.oFile.to) {
                    log.it(.1, `sent fileOk to panel ${c.nodeInfo.name} [${c.nodeInfo.uuId}]`, 'Yellow');
                    this.sendmsg(c, oMsg);
                    c.oFile = null;
                }
            };
        }
    };
     
    boot(conn, oData) {
        this.restart(conn, oData);
    };
     
    flashreload(conn, oData) {
        this.restart(conn, oData);
    };

    restart(conn, oData) {
        // send node restart command to a node
        // find node connection to which the file is to be sent
        for (let c of this.wss.clients) {
            if (c.nodeInfo && c.nodeInfo.type === 'node') {
                if (String(c.nodeInfo.nodeId) === String(oData.to)) {
                    log.it(1, this.m, `send ${oData.cmd} to node ${oData.to}`, 'Yellow');
                    this.sendmsg(c, oData);
                }
            }
        };
    };
     
    test(conn, oData) {
        // for websocket testing: loopback message
        conn.test = true;
        send(conn, JSON.stringify(oData));    
    };
    
    sendmsg(conn, msg) {
        let cMsg = JSON.stringify(msg);
        log.it(2, this.m, `Send to ${this.identifyClient(conn)}: ${cMsg}`, 'Cyan');
        conn.send(cMsg, (error) => {
            if (error) {
                log.it(1, this.m, `Websocket send error ${error}`, 'Red');
            }
        });
    };

    identifyClient(conn) {
        var s = '';
        if(conn.nodeInfo) {
            if (conn.nodeInfo.type === 'control') {
                s = `Panel ${conn.nodeInfo.name} [${conn.nodeInfo.uuId}]`;
            } else if (conn.nodeInfo.type === 'node') {
                s =  `Node ${conn.nodeInfo.description} [${conn.nodeInfo.nodeId}]`;;
            } else {
                s = `Unhandled things connection`;   // should never happen
            }
            return s;
        } else {
            s = `Unknown connection`;
        }
        return s;
    };
    noop() {};
};


