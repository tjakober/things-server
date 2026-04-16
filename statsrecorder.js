/* 
 *  © 3S System Software Support, Winterthur, Switzerland
 * 
 *  Author:        Thomas Jakober <tj at 3sweb.net>
 *  Created:       17.03.2021, 15:14:12
 *  Program Title: 
 *  File Name:     statsrecorder.js
 *  
 * Statistic processor for things
 * Collects values from nodes
 * recorder table contains the nodes of whose the data is collected
 * the table named in the "table" field of the recorder table contains the data
 * the "from" field specified the nodeId of the thing
 * the "name" field specifies the data name on the device 
 */
/* global Promise, process */

import { log } from "./log.js";
import { WebSocket } from "ws";
import * as fs from "fs";
import * as mysql from "mysql";
import * as uuid from "uuid";

export class StatsRecorder {
    constructor (config_file_path) {
        this.config_file_path = config_file_path;
        this.tmr = false;
        this.config = {};
        this.dbconn = {};
        this.ws = {};
        this.aRecorders = null;
        this.nCreate = 0;
        this.m = 'statsrecorder';
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
            connectionLimit: 5,
            host: this.config.url,
            port: this.config.port,
            user: this.config.username,
            password: this.config.password,
            database: 'things'
        });
        this.dbConn.query('SELECT 1 + 1 AS solution', (error, results, fields) => {
            if (error) {
                log.it(1, this.m, 'Problems to connect to database server: '+error, 'Red');
                setTimeout(() => this.connectDb(), 60000);
            }
            log.it(2, this.m, `Successful connection to database Server`, 'Green');
            this.connect();
        });
    };

    connect() {
        this.ws = new WebSocket(this.config.thingsserver);
        this.ws.on('close', (err) => {
            log.it(1, this.m, 'lost websocket connection: '+err+'. Trying reconnect', 'Red');
            this.reconnectWs();
        });
        this.ws.on('message', (msg) => this.receive(msg));
        this.ws.on('open', () => this.register());
        this.ws.on('error', (err) => {
            log.it(1, this.m, 'websocket error '+err+'. Trying to reconnect', 'Red');
            this.reconnectWs();
        });
        //this.ws.on('ping', function() {this.pong()});

    };
    
    reconnectWs() {
        if (this.ws.readyState === WebSocket.OPEN) {
            log.it(2, this.m, 'Websocket already connected, ignore reconnect', 'Magenta');
            return;  // ignore when already reconnected
        }
        setTimeout(() => this.connect(), 10000);
    };
    
    register() {
        log.it(2, this.m, 'Websocket connected', 'Green');
       
        // read the uuid or create a new one and store it for later use 
        const fname = "recUuid.txt";
        try {
            this.uuid = fs.readFileSync(fname, 'utf8');
        } catch (err) {
            this.uuid = uuid.v1();
            fs.writeFileSync(fname, this.uuid);
        }
        var q =
            "SELECT \
                things.recorder.*, information_schema.TABLES.TABLE_NAME \
            FROM things.recorder \
            LEFT JOIN information_schema.TABLES \
            ON things.recorder.table = information_schema.TABLES.TABLE_NAME \
            ORDER BY things.recorder.`from`;";
        this.dbConn.query(q, (err, aRecorders, aFields) => {
            if (err) {
                log.it(1, this.m, 'Query error on things.recorder: '+err, 'Red');
                process.exit();
            }
            const aPromises = [];
            const aServices = [];
            aRecorders.forEach((oRecorder) => {
                if (oRecorder.TABLE_NAME === null) {
                    aPromises.push(new Promise((resolve, reject) => {
                        this.createTable(oRecorder.table, resolve, reject);
                    }));   
                }
                aServices.push({
                    name: oRecorder.name,
                    from: oRecorder.from
                });
            });
            return Promise.all(aPromises).then(() => {
                this.aRecorders = aRecorders;
                this.registerRecorder(aServices);
            });
        });
    };

    createTable(table, resolve, reject) {
        var q = 
            'CREATE TABLE '+table+' (\
                `time` DATETIME NOT NULL PRIMARY KEY,\
                `value` FLOAT NULL DEFAULT NULL)\
            ENGINE=INNODB';
        this.dbConn.query(q, (err, ac) => {
                if (err) reject(err);
                resolve();
        });
    };
    
    registerRecorder(aServices) {
        const register = {
            cmd: 'regControl',
            uuId: this.uuid,
            name: 'STATSRECORDER',
            description: 'Data Recorder for Statistical Data',
            type: 'Control',
            services: []
        };
        register.services = aServices;
        let msg = JSON.stringify(register);
        log.it(2, this.m, 'Register: '+msg, 'Green');
        if (this.ws.readyState !== WebSocket.OPEN) {
            this.reconnectWs();
            return;
        }
        this.ws.send(msg);
    };
    
    receive(msg) {
        log.it(3, this.m, 'Received: '+msg, 'Green');
        var oMsg = JSON.parse(msg);
        switch (oMsg.cmd) {
            case 'regOk':
                log.it(1, this.m, `STATSRECORDER control successfully registered`, 'Green');
                break;
            case 'dataset':
                log.it(3, this.m, 'Request data received: '+msg, 'Green');
                for (var oRec of this.aRecorders) {
                    if ((oRec.name === oMsg.name) && (oRec.from === oMsg.nodeId)) {
                        log.it(2, this.m, 'Dataset received from: '+oRec.table+' '+oMsg.nodeId+' '+oMsg.value, 'Green');
                        this.updateRec(oRec.table, oMsg.value);
                    }
                }
                break;
        }
    };

    updateRec(table, value) {
        this.dbConn.query('SELECT * FROM `things`.`'+table+'` ORDER BY `time` DESC LIMIT 1', (err, data) => {
            if ((data && data.length > 0) && (Number(value) !== Number(data[0].value))) {
                var q = 'INSERT INTO `things`.`'+table+'` (`time`, `value`) VALUES (NOW(), '+value+')';
                log.it(2, this.m,  q, 'Cyan');
                this.dbConn.query(q);
            }
        });
    }
};

//const statsrecorder = new StatsRecorder('database.json');