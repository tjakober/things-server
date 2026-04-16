/* 
 *  © 3S System Software Support, Winterthur, Switzerland
 * 
 *  Author:        Thomas Jakober <tj at 3sweb.net>
 *  Created:       08.10.2021, 15:14:12
 *  Program Title: 
 *  File Name:     statsserver.js
 *  
 * Statistic server for things
 * Serves statisic queries from the database
 * acts as a device per value collection to display on things control panel
 */
/* global Promise, process */
import { log } from "./log.js";
import { ut } from "./ut.js";
import { WebSocket } from "ws";
import * as fs from "fs";
import * as mysql from "mysql";

const m = 'statsserver';

export class StatsServer {
    constructor (config_file_path) {
        this.config_file_path = config_file_path;
        this.tmr = false;
        this.m = 'statsserver';
        this.oThing =  {
            thing: 'statsserver',
            nodeId: 'STATSSERVER',
            group: 'Process',
            description: 'Statistical information query server',
            type: 'node',
            devices: []
        };
        this.aQueries = [
            {
                name: 'qDailyTemp',
                type: 'Array',
                active: false
            },
            {
                name: 'qMaxMin24',
                type: 'Array',
                active: false
            }, 
            {
                name: 'qMin24',
                type: 'Number',
                active: false
            }, 
            {
                name: 'qMax24',
                type: 'Number',
                active: false
            }
        ];
        this.aQuery = {};
        this.ws = {};
        this.aRecorders = [];     // Reorders table
        this.aTables = {};        // recorder to table conversion object
        this.aNames = {};         // Active node name table
        this.config = {};         // database configuration
        this.dbConn = {},         // database connection object
        this.init();
    };

    init() {
        process.env.TZ = 'Europe/Zurich';
        fs.readFile(this.config_file_path, 'utf8', (err, data) => {
            if (err) {
                log.it(2, this.m, 'Could not find configuration file '+this.config_file_path, 'Red');
                process.exit(1);
    
            }
            this.config = JSON.parse(data);
            this.connectDb();
        });
    };

    connectDb() {
        this.dbConn = mysql.createPool({
            connectionLimit : 1000,
            connectTimeout  : 60 * 60 * 1000,
            acquireTimeout  : 60 * 60 * 1000,
            timeout         : 60 * 60 * 1000,
            host: this.config.url,
            port: this.config.port,
            user: this.config.username,
            password: this.config.password,
            database: 'things'
        });
        console.log(this.config.username+'@'+this.config.url);
        this.dbConn.query('SELECT 1 + 1 AS solution', (error, results, fields) => {
          if (error) {
              log.it(1, this.m, 'Problems to connect to database server: ' + error, 'Red');
              process.exit(1);
          }
          log.it(1, this.m, 'The solution is: '+results[0].solution, 'Green');
          this.connect();
        });
    };

    connect() {
        this.ws = new WebSocket(this.config.thingsserver);
        this.ws.on('close', (err) => {
            log.it(1, this.m, process.memoryUsage().heapUsed+' lost websocket connection: '+err+'. Trying to reconnect', 'Red');
            this.reconnect(10000);
        });
        this.ws.on('error', (err) => {
            log.it(1, this.m, process.memoryUsage().heapUsed+' websocket error '+err+'. Trying to reconnect', 'Red');
            //process.exit(1);
            this.reconnect(30000);
        });
        this.ws.on('message', (msg) => this.receive(msg));
        this.ws.on('open', () => this.register());
    };
    
    reconnect(delay) {
        if (this.retry) return;
        this.ws = {};
        this.aRecorders = [];     // Reorders table
        this.aTables = {};        // recorder to table conversion object
        this.aNames = {};         // Active node name table
        this.retry = true;
        setTimeout(() => {
            this.retry = false;
            this.connect();
        }, delay);
    };
    
    register() {
        let q =
            "SELECT \
                things.recorder.*, information_schema.TABLES.TABLE_NAME \
            FROM things.recorder \
            LEFT JOIN information_schema.TABLES \
            ON things.recorder.table = information_schema.TABLES.TABLE_NAME \
            ORDER BY things.recorder.`from`;";
        this.dbConn.query(q, (err, aRecorders, aFields) => {
            if (err) {
                log.it(1, this.m, `Query error on recorders: ${err}`, 'Red');
                process.exit();
            }
            this.aRecorders = aRecorders;
            for (const oRec of this.aRecorders) {
                this.aTables[oRec.name] = oRec.table;       // setup name to table conversion object
                this.aNames[oRec.name] = false;             // Assume node name is not active
                const dev = {
                    name: oRec.name,
                    description: oRec.description,
                    table: oRec.table,
                    services: []
                };
               for (q of this.aQueries) {
                     let sv = {
                        name: q.name+':'+dev.name,
                        datatype: q.type,
                        value: '',
                        type: 'Output'
                    };
                    dev.services.push(sv);
                }
                this.oThing.devices.push(dev);
            }
            let i = 0;
            for (q of this.aQueries) {
                this.aQuery[q.name] = this.aQueries[i++];
            }
            const oMsg = {
                cmd: 'register',
                thing: this.oThing.thing,
                description: this.oThing.description,
                group: this.oThing.group,
                nodeId: this.oThing.nodeId,
                type: this.oThing.type,
                services: []
            };
            for (let dev of this.oThing.devices) {
                for (let sv of dev.services) {
                    oMsg.services.push(sv);
                }
            }
            let msg = JSON.stringify(oMsg);
            this.ws.send(msg);
            log.it(2, this.m, 'Sent register: '+msg, 'Green');
        });
    };
    
    receive(msg) {
        log.it(2, this.m, 'Received message: '+msg, 'Yellow');
        const oMsg = JSON.parse(msg);
        switch (oMsg.cmd) {
            case 'regOk':
                log.it(1, this.m, 'STATSSERVER node successfully registered', 'Green');
                // setup minute interval for checking changes in queries
                this.tmr = setInterval(() => this.minute(false), 60000);
                break;
            case 'rqData':
                for (let sv of oMsg.services) {
                    let aCmd = sv.name.split(':');
                    let query = aCmd[0];
                    let name = aCmd[1];
                    let table = this.aTables[name];
                    (this.aQuery[query]).active = true; // activate this query
                    this.aNames[name] = true;           // activate this node
                    if (typeof(this[query]) === 'function') {
                        // query is the required query function to call
                        // send data always, even if data did not change
                        //this[query](true, name, table, query);
                        this.minute(true);
                    } else {
                        log.it(1, this.m, 'Illegal query: '+query, 'Red');
                    }
                }
                break;
                
            otherwise:
                log.it(1, this.m, 'query illegal command: ['+oMsg.cmd+']', 'Red');
        }
        
    };
    
    minute(always) {
        // Check for changes in services then send data messages
        let ss = {};
        for (let dev of this.oThing.devices) {
            for (let sv of dev.services) {
                let aCmd = sv.name.split(':');
                let query = aCmd[0];
                let name = aCmd[1];
                let table = this.aTables[name];
                if ((this.aQuery[query].active) && this.aNames[name]) {
                    this[query](always, name, table, query);
                }
             }
        }
    };
    
    where24(q, date) {
        let dEnd = (date === 'NOW' ? new Date() : new Date(date));
        let dStart = new Date(dEnd - 1000*60*60*24);
        let r = '`time` BETWEEN "'+ut.stringDate(dStart)+'" AND "'+ut.stringDate(dEnd)+'"';
        let x = q.replace('???', r);
        //console.log(x);
        return x;
    };
    
    qDailyTemp(always, name, table, query) {
        let q = this.where24('SELECT * FROM '+table+' WHERE ??? ;', 'NOW');
        this.dbConn.query(q, (err, aRecs) => {
            if (err) { 
                log.it(1, this.m, `${query} DB Query Error ${err}`, 'Red');
                return;
            }
            this.sendResult(always, name, table, query, aRecs);
        });
    };
 
    qMaxMin24(always, name, table, query) {
        let q = this.where24('SELECT MIN(value) as min, MAX(value) as max from '+table+' WHERE ??? ;', 'NOW');
        this.dbConn.query(q, (err, aRecs) => {
            if (err) {
                log.it(1, this.m, `${query} DB Query Error ${err}`, 'Red');
                return;
            }
            this.sendResult(always, name, table, query, aRecs);
        });
    };
    
    qMin24(always, name, table, query) {
        let q = this.where24('SELECT MIN(value) as min from '+table+' WHERE ???', 'NOW');
        this.dbConn.query(q, (err, aRecs) => {
            if (err) {
                log.it(1, this.m, `${query} DB Query Error ${err}`, 'Red');
                return;
            }
            this.sendResult(always, name, table, query, aRecs[0].min);
        });
    };

    qMax24(always, name, table, query) {
        var q = this.where24('SELECT MAX(value) as max from '+table+' WHERE ???', 'NOW');
        this.dbConn.query(q, (err, aRecs) => {
            if (err) { 
                log.it(1, this.m, `${query} DB Query Error ${err}`, 'Red');
                return;
            }
            this.sendResult(always, name, table, query, aRecs[0].max);
        });
    };

    sendResult(always, name, table, query, nVal) {
        let sv = {};
        let svname = query+':'+name;
        for (let dev of this.oThing.devices) {
            for (let csv of dev.services) {
                if(csv.name === svname) {
                    sv = csv;
                    break;
                }
            }
        }
        if (nVal !== sv.value || always) {
            sv.value = String(nVal);
            const oMsg = {
                cmd: 'data',
                type: 'node',
                thing: this.oThing.name,
                time: ut.stringDate(new Date()),
                nodeId: this.oThing.nodeId,
                services: []
            };
            oMsg.services.push(sv);       
            var msg = JSON.stringify(oMsg);
            this.ws.send(msg);
            log.it(2, this.m, 'message sent: '+msg, 'Green');
        }
    };
};

//const statsserver = new StatsServer('database.json')
