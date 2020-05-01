/* 
 *  © 3S System Software Support, Winterthur, Switzerland
 * 
 *  Author:        Thomas Jakober <tj at 3sweb.net>
 *  Created:       01.05.2017, 09:11:23
 *  Program Title: 
 *  File Name:     thingsserver.js
 *  
 */

/* global Promise, process */

const si = require('systeminformation');
require('tty');
var stdin = process.openStdin();
//process.stdin.setRawMode(true);
//stdin.resume();
stdin.setEncoding('utf8');

stdin.on('data', function (key) {
    if (key === '\u0003') {
        log(1, "Shutdown Server");
        wss.close(function () {
            process.exit(1);
        });
    }
    ;
    process.stdout.write(key);
});

var dbg = 2;
const startTime = new Date();

const WebSocket = require("ws");
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const query = require('querystring');
const uuidV1 = require('uuid/v1');

var cfg;
try {
    cfg = fs.readFileSync("config.json", 'utf8');
} catch (err) {
    console.log('Could not find configuration file "config.json"');
    process.exit(1);
}
const config = JSON.parse(cfg);

/*
 * Setup the Webserver which is used to serve the panels
 */
const server = http.createServer(function (request, response) {
    var pathname = url.parse(request.url).pathname;
    var ra = request.connection.remoteAddress;
    log(1, "from " + ra + " got " + request.method + " request for " + pathname + " received.");
    switch (request.method) {
        case 'GET':
            if (pathname === '/') {
                pathname = '/index.html';
            }
            fs.readFile(pathname.substr(1), function (err, data) {
                if (err) {
                    log(1, err);

                    // HTTP Status: 404 : NOT FOUND
                    // Content Type: text/plain
                    response.writeHead(404, {'Content-Type': 'text/html'});
                } else {
                    //File found	  
                    var ctype;
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
                    log(2, 'Send file ' + pathname + ' Size: ' + data.length + ' Type: ' + ctype);
                    response.write(data);
                }

                // Send the response body 
                response.end();
            });
            break;

        case 'POST':
            var body = '';
            request.on('data', function (data) {
                body += data;
            });
            request.on('end', function () {
                console.log(body);
                var oPost = query.parse(body);
                console.log(oPost);
                switch (pathname.substr(1)) {
                    case 'panel':
                        switch (oPost.cmd) {
                            case 'loadThings':
                                var s = "[\n";
                                var aThings = oPost.fn.split(',');
                                var promises = aThings.map(function (thing) {
                                    return new Promise(function (resolve, reject) {
                                        var fn = 'panels/' + thing.trim() + '.json';
                                        console.log('Read thing ' + thing);
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
                                Promise.all(promises)
                                        .then(function () {
                                            s = s.substr(0, s.length - 2) + "\n]\n";
                                            console.log('all things collected');
                                            response.writeHead(200, {'Content-Type': 'application/json'});
                                            response.write(s.toString());
                                            response.end();
                                        });
                                break;  // case loadThings
                            case 'loadThing':
                                var fn = 'panels/' + oPost.fn.trim() + '.json';
                                log(1, 'file '+fn+' requested', color.FgCyan);
                                fs.readFile(fn, function(err, data) {
                                      if (err) {
                                          log(1, 'File read Error: '+ err, color.FgRed);
                                    } else {
                                        response.writeHead(200, {'Content-Type': 'application/json'});
                                        response.write(data.toString());
                                        response.end();
                                        log(2, 'Sent file '+fn, color.FgCyan);
                                    }
                                });
                                break; // case loadThing
                            case 'panelList':
                                const path = 'panels/';
                                const dir = fs.opendirSync(path);
                                var panels = '';
                                while (true) {
                                    var dirent = dir.readSync();
                                    if (dirent === null) {
                                        break;
                                    }
                                    panels += dirent.name +',';
                                }
                                dir.closeSync();
                                response.writeHead(200, {'Content-Type': 'text/plain'});
                                response.end(panels.substr(0, panels.length-1));
                                break;
                        }
                        break; // case panel
                        
                    otherwise:
                        // unknown post command
                        log(1, 'unknown post command: '+pathname, color.FgRed);
                }
            });
            break;
            //case 'PUT':
    }

}).listen(config.port);

/*
 *  Websocket Server
 */
const wss = new WebSocket.Server({server, backlog: 4096});
const missingPongs = 3;

const chunkSize = 1024;
var c, sc, sn, ns;

function heartbeat() {
    var cl = identifyClient(this);
    log(3, "pong received from " + cl, color.FgGreen);
    if (cl === 'Unknown connection') {
        this.terminate();
    } else {
        this.isAlive = true;
    }
}

wss.on("connection", function (conn) {
    log(1, "New connection");
    conn.isAlive = true;
    conn.on('pong', heartbeat);

    conn.on("message", function (str) {
        conn.isAlive = true;
        log(1, "Received " + str, color.FgYellow);
        var oData = JSON.parse(str);
        switch (oData.cmd) {
            case 'register':
                /* Received register from a thing
                 * First check whether there is still a old connection from this thing
                 */
                for (c of wss.clients) {
                    if (typeof(c.nodeInfo) !== 'undefined') {
                        if (c.nodeInfo.type === 'node') {
                            if (c.nodeInfo.nodeId === oData.nodeId) {
                                // found an old connetion, close it
                                log(2, 'old node connection terminated: ' + c.nodeInfo.name + ' [' + c.nodeInfo.nodeId + ']', color.FgRed);
                                c.terminate();
                            }
                        }
                    }
                }
                // Now create nodeinfo object and attach it to the connection object
                conn.nodeInfo = {
                    type: 'node',
                    name: oData.thing,
                    nodeId: oData.nodeId,
                    services: oData.services
                };
                // create response message to get actual data from this thing
                var d = new Date();
                var response = {
                    cmd: 'regOk',
                    date: dateToIso(d),
                    epoch: d.getTime()
                };
                // send it
                log(1, 'Node successfully registered: node ' + oData.thing + ' [' + oData.nodeId + ']', color.FgGreen);
                sendmsg(conn, response);
                // Inform all active control's about this node
                // scan over connected nodes
                for (sc of oData.services) {
                    // scan over onnections
                    for (c of wss.clients) {
                        // only Control Panels needed
                        if (typeof (c.nodeInfo) === 'object' && c.nodeInfo.type === 'control') {
                            // scan over Services
                            for (sn of c.nodeInfo.services) {
                                // only current Service for current node needed
                                if (sn.name === sc.name && String(sn.from) === String(oData.nodeId)) {
                                    var dataset = {
                                        cmd: 'dataset',
                                        nodeId: oData.nodeId
                                    };
                                    for (var n in sc) {
                                        dataset[n] = sc[n];
                                    }
                                    log(1, 'Data ' + sc.name + ' from node ' + oData.nodeId + ' sent to ' + c.nodeInfo.uuId);
                                    sendmsg(c, dataset);
                                }
                            };
                        }
                    };
                };

                break;

            case 'regControl':
                // Received register from a Control Panel
                // First check whether there is still a old connection from this Panel
                for (c of wss.clients) {
                    if (typeof (c.nodeInfo) === 'object') {
                        if (c.nodeInfo.type === 'control') {
                            if (c.nodeInfo.uuId === oData.uuId) {
                                if (c !== conn) {
                                    // found an old connetion, close it
                                    log(2, 'old control connection terminated: ' + c.name + ' [' + c.nodeInfo.uuId + ']', color.FgRed);
                                    c.terminate();
                                }
                            }
                        }
                    }
                };
                // Now create nodeinfo object and attach it to the connection object
                conn.nodeInfo = {
                    type: 'control',
                    name: oData.name,
                    uuId: oData.uuId,
                    services: oData.services
                };
                // Create response record
                var d = new Date();
                var response = {
                    cmd: 'regOk',
                    date: dateToIso(d),
                    epoch: d.getTime()
                };
                // Send it to the panel
                log(1, 'Control successfully registered: control ' + oData.name + ' [' + oData.uuId + ']', color.FgGreen);
                sendmsg(conn, response);
                // request from each node the data immediately
                // scan clienta
                for (c of wss.clients) {
                    if (typeof (c.nodeInfo) !== 'undefined') {
                        if (c.nodeInfo.type === 'node') {
                            var rq = {
                                cmd: 'rqData',
                                nodeId: c.nodeInfo.nodeId
                            };
                            sendmsg(c, rq);
                        }
                    }
                };
                break;

            case 'time':
                // command to send actual date and time
                // a thing could request this to sync his timekeeping
                sendmsg(conn, {
                    cmd: 'time',
                    date: dateToIso(new Date()),
                    epoch: new Date().getTime()
                });
                break;

            case 'set':
                /*
                 * When a control panel changes a value or change the state of a switch it sends a "set" command
                 * This is forwardes to the target thing
                 */
                if (oData.type === 'control') {
                    // find target node
                    for (c of wss.clients) {
                        if (typeof (c.nodeInfo) === 'object') {
                            if (c.nodeInfo.type === 'node') {
                                log(3, 'c.nodeInfo.type: ' + c.nodeInfo.type + ', c.nodeInfo.nodeId: ' + c.nodeInfo.nodeId + ', oData.to: ' + oData.to);
                                if (String(c.nodeInfo.nodeId) === String(oData.to)) {
                                    var msg = {
                                        cmd: 'set',
                                        from: oData.from,
                                        services: oData.services
                                    };
                                    sendmsg(c, msg);
                                }
                            }
                        }
                    };
                } else {
                    log(1, 'illegal "set" command for type [' + oData.type) + ']';
                }

            case 'data':
                // received data from thing or from control
                if (oData.type === 'node') {
                    // send received data to all Control Panels which require these
                    // scan over connected nodes
                    for (sc of oData.services) {
                        // scan over onnections
                        for (c of wss.clients) {
                            // only Control Panels needed
                            if (typeof (c.nodeInfo) === 'object' && c.nodeInfo.type === 'control') {
                                // scan over Services
                                for (sn of c.nodeInfo.services) {
                                    // only current Service for current node needed
                                    if (sn.name === sc.name && String(sn.from) === String(oData.nodeId)) {
                                        var dataset = {
                                            cmd: 'dataset',
                                            nodeId: oData.nodeId
                                        };
                                        for (var n in sc) {
                                            dataset[n] = sc[n];
                                        }
                                        log(1, 'Data ' + sc.name + ' from node ' + oData.nodeId + ' sent to ' + c.nodeInfo.uuId);
                                        sendmsg(c, dataset);
                                    }
                                };
                            }
                        };
                    };
                } else if (oData.type === 'control') {
                    // to be done
                } else {
                    log(1, 'unknown data type type received: [' + oData.type + ']');
                    log(1, JSON.stringify(oData));
                }
                break;

            case 'control':
                /*
                 * This is a control message (not to be confused with a control panel)
                 * Intended to be used for contol functions of the server
                 */
                if (oData.type === 'node') {
                    // received from a thing
                    for (c of oData.services) {
                        switch (c.type) {
                            case 'mail':
                                /*
                                 * Mail service: forward mail to a mail server
                                 * can be used for things to send alarm messages
                                 * (required because could not authenticate a thing to
                                 * mailservers which require authentication)
                                 */
                                if (config.mailuser) {
                                    const nodemailer = require('nodemailer');
                                    log(1, '*** Send Mail to ' + c.to);
                                    let transport = nodemailer.createTransport({
                                        host: "3sweb.net",
                                        port: 465,
                                        secure: true, // false 587, true for 465, false for other ports
                                        tls: {rejectUnauthorized: false},
                                        auth: {
                                            user: config.mailuser,
                                            pass: config.mailpass
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
                                            console.log('Mail error:', err);
                                        } else {
                                            console.log(info);
                                        }
                                    });
                                }
                                break;
                        }

                    };
                }
                break;

            case 'ctrlList':
                // return list of control panel connections
                log('1, Control Connections');
                var controls = [];
                for (var c of wss.clients) {
                    if (typeof (c.nodeInfo) === 'object' && c.nodeInfo.type === 'control') {
                        log(1, c.nodeInfo.uuId);
                        var control = {
                            uuId: c.nodeInfo.uuId,
                            name: c.nodeInfo.name,
                            services: c.nodeInfo.services
                        };
                        controls.push(control);
                    }
                };
                var cl = {
                    cmd: 'controllist',
                    list: controls
                };
                sendmsg(conn, cl);
                break;
                
            case 'debLevel':
                // set server debug Level (0-3)  to be output on the server console
                var level = Number(oData.dbglevel);
                if (level >= 0 && level <= 3) {
                    dbg = level;
                }
                break;

            case 'serverInfo':
                // collect some Server Data to be shown at the conrtol panel
                si.cpuTemperature(function(o) {
                    console.log(o);
                    var clts = 0;
                    var controls = 0;
                    var nodes = 0;
                    var unknown = 0;
                    for (c of wss.clients) {
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
                    var cl = {
                        cmd: 'serverInfo',
                        server: {
                            dbgLevel: dbg,
                            clients: clts,
                            controls: controls,
                            nodes: nodes,
                            unknown: unknown,
                            cpuTemp: o.main,
                            cpuMax: o.max,
                            nodeVersion: process.version,
                            runTime: msToDHMS(new Date() - startTime)
                        }
                    };
                    sendmsg(conn, cl);
                });
                break;
                
            case 'nodeList':
                // return list of thing connections
                log(1, 'Node Connections');
                var nodes = [];
                for (c of wss.clients) {
                    if (typeof (c.nodeInfo) === 'object' && c.nodeInfo.type === 'node') {
                        log(1, c.nodeInfo.nodeId);
                        var node = {
                            nodeId: c.nodeInfo.nodeId,
                            name: c.nodeInfo.name,
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
                sendmsg(conn, cl);
                break;

            /*
             * These three commands use the same message structure
             * stopLog and sendLog is used to view the console log of a thing
             * info collects some information of a thing
             */
            case 'stopLog':
            case 'sendLog':
            case 'info':
                // get info from a node
                var oGetinfo = {
                    cmd: oData.cmd,
                    to: oData.to,
                    from: oData.from
                };
                // find node connection from which the info is requested
                for (c of wss.clients) {
                    if (typeof (c.nodeInfo) === 'object') {
                        if (c.nodeInfo.type === 'node') {
                            if (String(c.nodeInfo.nodeId) === String(oData.from)) {
                                log(1, 'sent info request to node ' + oData.from);
                                sendmsg(c, oGetinfo);
                            }
                        }
                    }
                };
                break;

            /*
             * These two commands send the information back to the control panel:
             * log sends a log line
             * nodeInfo sends the collected info from the thing
             */
            case 'log':
            case 'nodeInfo':
                // send info back the panel 
                // find panel connection which requested the info 
                for (c of wss.clients   ) {
                    if (typeof (c.nodeInfo) === 'object') {
                        if (c.nodeInfo.type === 'control' && c.nodeInfo.uuId === oData.to) {
                            log(1, 'sent info to panel ' + c.nodeInfo.name + ' [' + c.nodeInfo.uuId + ']');
                            sendmsg(c, oData);
                        }
                    }
                };
                break;
                
            case 'file':
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
                for (c of wss.clients) {
                    if (typeof (c.nodeInfo) === 'object') {
                        if (c.nodeInfo.type === 'node') {
                            if (String(c.nodeInfo.nodeId) === String(oData.to)) {
                                log(1, 'send file to node ' + oData.to);
                                sendFile(c, oData);
                            }
                        }
                    }
                };
                break;

            case 'fileOk':
                // send OK from the thing back the panel when the file transfer is complete 
                var oMsg = {
                    cmd: 'fileOk',
                    to: oData.to,
                    from: oData.from,
                    ok: oData.ok
                };
                // find panel connection which got the file
                for (c of wss.clients) {
                    if (typeof (c.nodeInfo) === 'object') {
                        if (c.nodeInfo.type === 'control' && c.nodeInfo.uuId === oData.to) {
                            log(1, 'sent fileOk to panel ' + c.nodeInfo.name + ' [' + c.nodeInfo.uuId + ']');
                            sendmsg(c, oMsg);
                            c.oFile = null;
                        }
                    }
                };
                break;

            case 'chunkOk':
                // received when the thing has completed a chunk
                if (oData.ok === 'YES') {
                    if (oData.chunkNo === oData.nChunks - 1) {
                        for (c of wss.clients) {
                            if (typeof (c.nodeInfo) === 'object') {
                                if (c.nodeInfo.type === 'control' && c.nodeInfo.uuId === conn.oFile.to) {
                                    log(1, 'sent chunkOk to panel ' + c.nodeInfo.name + ' [' + c.nodeInfo.uuId + ']');
                                    var oMsg = {
                                        cmd: 'fielOk',
                                        from: conn.oFile.to,
                                        ok: 'YES'
                                    };
                                    sendmsg(c, oMsg);
                                    c.oFile = null;
                                }
                            }
                        };

                    } else {
                        sendChunk(conn, oData.chunkNo + 1, oData.nChunks);
                    }
                } else {
                    // in case of an error
                    var oMsg = {
                        cmd: 'fielOk',
                        from: conn.oFile.to,
                        ok: 'NO'
                    };
                    for (c of wss.clients) {
                        if (typeof (c.nodeInfo) === 'object') {
                            if (c.nodeInfo.type === 'control' && c.nodeInfo.uuId === conn.oFile.to) {
                                log(1, 'sent fileOk to panel ' + c.nodeInfo.name + ' [' + c.nodeInfo.uuId + ']');
                                sendmsg(c, oMsg);
                                c.oFile = null;
                            }
                        }
                    };
                }
                break;

            /*
             * request the thing to boot or to reload the LUA flash store (LFS) 
             */
            case 'boot':
            case 'flashreload':
                // send node restart command to a node
                // find node connection to which the file is to be sent
                for (c of wss.clients) {
                    if (typeof (c.nodeInfo) === 'object') {
                        if (c.nodeInfo.type === 'node') {
                            if (String(c.nodeInfo.nodeId) === String(oData.to)) {
                                log(1, 'send '+oData.cmd+' to node ' + oData.to);
                                sendmsg(c, oData);
                            }
                        }
                    }
                };
                break;


            default:
                log(1, 'unknown command received: [' + oData.cmd + ']');
        }
    });

    conn.on("close", function (code, reason) {
        analyseClose(conn, code, reason);
        conn.isAlive = false;
        conn.terminate();
    });
    conn.on("error", function (err) {
        log(1, "Connection Error: " + err);
    });
});

/*
 * Analyse the close of a connection, from which thing or control panel and
 * forward the neccessary information to the correct device
 */
function analyseClose(conn, code, reason) {
    if (typeof (conn.nodeInfo) === 'undefined') {
        log(2, "Close received from unknown Connection: [" + code + "] " + reason, color.FgRed);
    } else {
        if (conn.nodeInfo.type === 'control') {
            log(1, "Connection to " + conn.nodeInfo.name + " [" + conn.nodeInfo.uuId + "] closed: [" + code + "] " + reason, color.FgRed);
        } else {
           log(1, "Connection to " + conn.nodeInfo.name + " [" + conn.nodeInfo.nodeId + "] closed: [" + code + "] " + reason, color.FgRed);
            // Node closes: unegister their sevices registered on all control panels
            // scan over connections
            for (sc of wss.clients) {
                // only control panels needed
                if (typeof (sc.nodeInfo) === 'object' && sc.nodeInfo.type === 'control') {
                    log(2, 'for control ' + sc.nodeInfo.name, color.FgMagenta);
                    // scan over Services
                    for (ns of sc.nodeInfo.services) {
                        // check whether current service is registered
                        
                        for (sn of conn.nodeInfo.services) {
                            log(3, 'conn: ' + conn.nodeInfo.nodeId + ':' + ns.name + ', from: '+ ns.from + ':' + sn.name + ' ' +String(String(sn.name) === String(ns.name)) + ' ' + String(String(conn.nodeInfo.nodeId) === String(sn.from)), color.FgMagenta);
                            if (String(sn.name) === String(ns.name) && String(conn.nodeInfo.nodeId) === String(ns.from)) {
                                // uregister control from this service
                                var ur = {
                                    cmd: 'unreg',
                                    nodeId: ns.from,
                                    name: sn.name
                                };
                                sendmsg(sc, ur);
                                log(2, 'Service ' + sn.name + ' from node ' + ns.from + ' unregistered from ' + sc.nodeInfo.uuId) + ' (' + sc.nodeInfo.name + ')';
                            }
                        };
                    };
                }
            };
        }
    }
}

/*
 * This is the central message sender
 */
function sendmsg(conn, msg) {
    var cMsg = JSON.stringify(msg);
    log(1, 'Send to ' + identifyClient(conn) + ': ' + cMsg, color.FgCyan);
    conn.send(cMsg, function (error) {
        if (error) {
            log(1, 'ws send error ' + error);
        }
    });
}

/*
 * function to compute the neccessary number of chunks to be sent
 */
function sendFile(conn, oData) {
    // send file in chunks of [chunkSize] bytes to the node
    // first duplicate the data onto the connection
    var oFile = {};
    for (var name in oData) {
        oFile[name] = oData[name];
    }
    conn.oFile = oFile;
    log(1, 'Size file: ' + conn.oFile.content.length);
    var cLen = oFile.content.length;
    var nChunks = Math.floor(cLen / chunkSize) + 1;
    sendChunk(conn, 0, nChunks);
}

/*
 * Funtion to send the chunks to the thing
 */
function sendChunk(conn, n, nChunks) {
    var beg = n * chunkSize;
    var oChunk = {
        cmd: 'file',
        from: conn.oFile.from,
        fileName: conn.oFile.fileName,
        chunkNo: n,
        nChunks: nChunks,
        content: conn.oFile.content.substring(beg, Math.min(beg + chunkSize, conn.oFile.content.length))
    };
    if (n === nChunks - 1) {
        oChunk.checksum = conn.oFile.checksum;
    }
    sendmsg(conn, oChunk);
}

var ws;

function noop() {}

/*
 * Some error handling
 */
wss.on("error", function (err) {
    log(1, "Websocket Server Error: " + err, color.FgRead);
});

wss.on('close', function close(code, reason) {
    log(1, 'websocket closed '+code+' '+reason, color.FgRead);
    clearInterval(interval);
});

/*
 * Time interval to send ping frames to each thing 
 */
const interval = setInterval(function ping() {
    for (ws of wss.clients) {
        if (typeof (ws.nodeInfo) === 'object') {
            if (ws.isAlive === false) {
                ws.missingPongs--;
                if (ws.missingPongs > 0) {
                    log(2, 'Pong missed, still left '+ws.missingPongs, color.FgCyan);
                }
                if (ws.missingPongs === 0) {
                    log(1, identifyClient(ws) + "PING timed out from " + identifyClient(ws), color.FgRed);
                    analyseClose(ws, -1, 'Ping Timeout');
                    ws.terminate();
                }
            } else {
                ws.isAlive = true;
                ws.missingPongs = missingPongs;
                ws.ping(noop);
                log(3, 'PING sent to: ' + identifyClient(ws));
            }
        } else {
            // unknown connection
            ws.terminate();
        }
    };
}, 3000);

/*
 * find out wether a message belongs to a control panel or a thing
 * Used in console logging
 */
function identifyClient(ws) {
    var s = 'Unknown connection';
    if (typeof (ws.nodeInfo) === 'object') {
        if (ws.nodeInfo.type === 'control') {
            s = 'Panel ' + ws.nodeInfo.name + ' [' + ws.nodeInfo.uuId + ']';
        } else {
            s = 'Node ' + ws.nodeInfo.name + ' [' + ws.nodeInfo.nodeId + ']';
        }
    }
    return s;
}

// color definitions for the console log 

var color = {
    Reset: "\x1b[0m",
    Bright: "\x1b[1m",
    Dim: "\x1b[2m",
    Underscore: "\x1b[4m",
    Blink: "\x1b[5m",
    Reverse: "\x1b[7m",
    Hidden: "\x1b[8m",

    FgBlack: "\x1b[30m",
    FgRed: "\x1b[31m",
    FgGreen: "\x1b[32m",
    FgYellow: "\x1b[33m",
    FgBlue: "\x1b[34m",
    FgMagenta: "\x1b[35m",
    FgCyan: "\x1b[36m",
    FgWhite: "\x1b[37m",

    BgBlack: "\x1b[40m",
    BgRed: "\x1b[41m",
    BgGreen: "\x1b[42m",
    BgYellow: "\x1b[43m",
    BgBlue: "\x1b[44m",
    BgMagenta: "\x1b[45m",
    BgCyan: "\x1b[46m",
    BgWhite: "\x1b[47m"
};

/*
 * Console logging function which adds time and date to each log line as well as 
 * the color how the line is displayed  
 */
function log(level, msg, colr) {
    if (level <= dbg) {
        if (!colr) {
            colr = '';
        }
        console.log(dateToIso(new Date()), colr + msg + color.Reset);
    }
}

function dateToIso(d) {
    // convert a date object to a ISO (YYYY-MM-DD HH:MM:SS) string
    return d.getFullYear() + '-' + lPad0((d.getMonth() + 1), 2) + '-' + lPad0(d.getDate(), 2) + ' ' + lPad0(d.getHours(), 2) + ':' + lPad0(d.getMinutes(), 2) + ':' + lPad0(d.getSeconds(), 2);
}
function lPad0(n, l) {
    // left pad a string to a required length with zeroes
    var str = String(n);
    return '0'.repeat(l - str.length) + str;
}

function msToDHMS( ms ) {
    // miliseconds to day-hour-min-sec
    // 1- Convert to seconds:
    var seconds = parseInt(ms / 1000);
    // 2- Extract hours:
    var days = parseInt(seconds / 86400);    // 86'400 seconds in 1 day
    seconds = seconds % 86400;              // seconds remaining after extracting days
    var hours = parseInt( seconds / 3600 ); // 3,600 seconds in 1 hour
    seconds = seconds % 3600;               // seconds remaining after extracting hours
    // 3- Extract minutes:
    var minutes = parseInt( seconds / 60 ); // 60 seconds in 1 minute
    // 4- Keep only seconds not extracted to minutes:
    seconds = seconds % 60;
    return( days+'d '+hours+"h "+minutes+"m "+seconds+'s');
}

// Inithial log entry
log(1, 'Thingsserver ready', color.Bright + color.FgYellow);
