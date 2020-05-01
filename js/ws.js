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

/* global panel, ut, listView */

var ws = {
    // Initialize the Websocket connection
    host: "ws://"+location.host,
    socket: null,
    hidden: false,
    serverConnect: function() {
        try
        {
            ws.socket = new WebSocket(ws.host);
            ut.log('WebSocket - status ' + ws.socket.readyState);

            ws.socket.onopen = function(msg) 
            { 
                if(this.readyState === 1)
                {
                    ut.log("We are now connected to websocket server. readyState = " + this.readyState);
                    ws.register();
                }
            };

            /*
             * Process message received from websocket server
             * The messages are in JSON format and contain all a 'cmd' field to identify the action
             */
            ws.socket.onmessage = function(msg)
            {
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
                        // to be done: display the status
                        break;
                }
                ut.log(sLog);
             };

            //handle connection closed
            ws.socket.onclose = function(event) 
            {
                if (ws.socket && ws.socket.readyState !== 1) {
                    ut.log("Disconnected - status " + event.code);
                    if (! ws.hidden) {
                        // try reconnect 
                        /*
                        window.setInterval(function() {
                            // wait a second
                            ws.reconnect();
                        }, 1000); */
                    }
                }
            };

            ws.socket.onerror = function()
            {
                ut.log("Some error");
            };
        }

        catch(ex)
        { 
            ut.log('Some exception : '  + ex); 
        }

    },
    
    // send a message in JSON format
    send: function (cmd, cb) {
        var msg = JSON.stringify(cmd);
        ws.socket.cb = cb;      // Set callback
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
            ut.log(ex);
        }
    },

    // close the socket
    quit: function () {
        if (ws.socket !== null) {
            ut.log("Goodbye!");
            ws.socket.close();
            ws.socket = null;
        }
    },

    // reconnect a broken connection (does not work)
    reconnect: function() {
        ws.quit();
        ut.log('Reconnect');
        ws.serverConnect();
    },

    // register this control panel to the server
    // and tell him all the thing data (services) to be informed when changed
    register: function() {
        ut.log('register');
        var oReg = {
            cmd: 'regControl',
            uuId: panel.uuId,
            name: panel.name,
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
    }
};
