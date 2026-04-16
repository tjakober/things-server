/* 
 *  © 3S System Software Support, Winterthur, Switzerland
 * 
 *  Author:        Thomas Jakober <tj at 3sweb.net>
 *  Created:       07.06.2017, 22:00:09
 *  Program Title: 
 *  File Name:     ws.js
 *  
 *  Websocket module
 */

/* global panel, ut, listView, upLoad */

var ws = {
    // Initialize the Websocket connection
    host: "ws://"+location.host,
    socket: null,
    hidden: false,
    connected: false,
    serverConnect: function(cb) {
        try
        {
            ws.socket = new WebSocket(ws.host);
            ut.log('WebSocket - status ' + ws.socket.readyState);

            ws.socket.onopen = function(event) 
            { 
                if(ws.socket.readyState === 1)
                {
                    ut.log("We are now connected to websocket server. readyState = " + ws.socket.readyState);
                    ws.connected = true;
                    ws.indicate('#connection','igreen');
                    ws.register();
                    if (cb) cb();
                }
            };

            /*
             * Process message received from websocket server
             * The messages are in JSON format and contain all a 'cmd' field to identify the action
             */
            ws.socket.onmessage = function(msg)
            {
                ws.blink('#activity', 'ired');
                var oMsg = JSON.parse(msg.data);            // Messaages are in JSON format
                var sLog = " [ + ] Received: " + oMsg.cmd;
                switch (oMsg.cmd) {
                    case 'dataset':
                        sLog += ' form Node ' + oMsg.nodeId + ' (' + oMsg.name + ')';
                        // dataset received. Porcess the corresponding data fields
                        panel.changeData(oMsg);
                        break;

                    case 'unreg':
                        // The server indicates thet a certain thing went offline.
                        // Display the corresponding fiels grayed out
                        panel.unreg(oMsg);
                        sLog += ' form Node ' + oMsg.nodeId + ' (' + oMsg.name + ')';
                        break;

                    case 'controllist':
                        // received the list of connected control panels
                        listView.showList(oMsg.list, 'ctrl');
                        break;

                    case 'nodelist':
                        // received the list of connected thing nodes
                        if (ws.socket.cb) {
                            ws.socket.cb(oMsg.list);
                            ws.socket.cb = null;
                        } else {
                            listView.showList(oMsg.list, 'node');
                        }
                        break;

                    case 'nodeInfo':
                        // received the information about a thing node
                        listView.showInfo(oMsg);
                        break;
                        
                    case 'serverInfo':
                        listView.showServer(oMsg.server);
                        break;
                        
                    case 'editFile':
                        upLoad.editFile(oMsg);
                        break;
                        
                    case 'saveOk':
                        upLoad.saveOk(oMsg);
                        break;
                        
                    case 'log':
                        // received a log line from a thing node
                        if ($('#nodeLog')) {
                            $('<div/>')
                                    .addClass('logEntry')
                                    .text(oMsg.log)
                                    .appendTo('#nodeLog');
                        }
                        break;
                        
                    case 'fileOk':
                        // received file trandfer completed
                        upLoad.fileList();
                        $('button[name=bUpload]').css('background-color', oMsg.ok==='YES' ? 'green' : 'red');
                        window.setTimeout(function() {
                            $('button[name=bUpload]').css('background-color', '');
                        }, 3000);
                        break;
                        
                    case 'fileList':
                        // received list of files
                        upLoad.listFiles(oMsg.list);
                        break;
                    case 'deleteOk':
                        // file deleted confirmation
                        upLoad.fileDeleted(oMsg.ok);
                        break;
                }
                ut.log(sLog);
             };

            //handle connection closed
            ws.socket.onclose = function(event) 
            {
                ws.indicate('#connection', 'ired');
                if (ws.socket) {
                    ut.log("Disconnected - status: " + event.code + ' readyState: ' + ws.socket.readyState);
                    if (! ws.hidden) {
                        // try reconnect 
                        ws.quit();
                        window.setTimeout(function() {
                            // wait 10 seconds
                            ws.reconnect();
                        }, 10000);
                    }
                }
            };

            ws.socket.onerror = function(event)
            {
                ut.log("Some error ");
                console.log(event);
                ws.quit();
                window.setTimeout(() => {
                    ws.reconnect();
                }, 10000);
            };
        }

        catch(ex)
        { 
            ut.log('Receive error: '  + ex);
            ws.quit();
            window.setTimeout(() => {
                ws.reconnect();
            }, 10000);
        }

    },
    
    // send a message in JSON format
    send: function (cmd, cb) {
        if (cb) {
            ws.socket.cb = cb;      // Set callback
        }
        var msg = JSON.stringify(cmd);
        try {
            ws.socket.send(msg);
            var tx = '';
            switch (cmd.cmd) {
                case 'set':
                    tx += ' to '+cmd.to+' '+cmd.services[0].name+' value: '+cmd.services[0].value;
                    if(cmd.services[0].para) {
                        tx += ' parameter: '+cmd.services[0].para;
                    }
                    break;
                
            }
            ut.log('Sent : ' + cmd.cmd + tx);
        } catch (ex) {
            ut.log('Send error: '+ex);
            ws.quit();
            window.setTimeout(ws.reconnect, 10000);
        }
    },

    // close the socket
    quit: function () {
        if (ws.socket !== null) {
            ut.log("Goodbye!");
            ws.socket.close();
            ws.socket = null;
            ws.connected = false;
        }
        this.indicate('#connection', 'ired');
    },

    // reconnect a broken connection (does not work)
    reconnect: function() {
        if (ws.connected) {
            ws.quit();
            window.setTimeout(checkit, 10000);
        }
        var checkit = function() {
            if (ws.connected) {
                window.setTimeout(checkit, 10000);
            } else {
                ut.log('Reconnect');
                ws.serverConnect();
            }
        }();
    },

    // register this control panel to the server
    // and tell him all the thing data (services) to be informed when changed
    register: function() {
        ut.log('register');
        var oReg = {
            cmd: 'regControl',
            uuId: panel.uuId,
            name: panel.name,
            description: navigator.userAgent,
            type: panel.type,
            services: []
        };
        for (var t in panel.things) {       // scan over panels
            var oT = panel.things[t];
            for (var g in oT.groups) {      // scan over groups
                var oG = oT.groups[g];
                for (var d in oG.data) {    // scan over data fields
                    var oD = oG.data[d];
                    oReg.services.push( {   // create a service entry in the services array
                        name: oD.name,      // Service name
                        from: oD.from       // from requires thing node (nodeId)
                    });
                }
            }
        }
        ws.send(oReg);
    },
    
    indicate: function(id, color) {
        $(id).attr('class', 'indicator '+color);
    },
    
    blink: function(id, color) {
        this.indicate(id, color);
        window.setTimeout(() => {
            this.indicate(id, 'Off');
        }, 200);
    }
};

/*
 * The scheduler schedules a message to be sent every amount of minutes

var scheduler = {
    schedules: [],
    create: function(interval, msg) {
        this.schedules.push({interval: interval, cnt: 0, active: true, msg: msg});
        return this.schedules.length - 1;       // return index of schedule
    },
    deactivate: function(index) {
        this.schdules[index].active = false;    // stops a schedule
    },
    activate: function(index, restart) {
        var oSchedule = this.schedules[index];
        oSchedule.active = true;                 // starts the schedule again
        if (restart && restart === true) {
            oSchedule.cnt = 0;                  //  starts over with full interval
        }
    },
    clear: function() {
        this.schedules = [];                    // delete all schedules
    },
    start: function() {
        // then schedule the schedules
        setInterval(() => {
            for (var oSchedule of this.schedules) {
                if (oSchedule.active) {
                    if (oSchedule.cnt === 0) {
                        if (ws !== null) {
                           ws.socket.send(oSchedule.msg);
                        }
                        oSchedule.cnt = oSchedule.interval;
                    } else {
                        oSchedule.cnt -= 1;
                    }
                }
            }
        }, 60*1000);   // every Minute
    }
};
*/