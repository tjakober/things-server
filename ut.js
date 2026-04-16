/* 
 *  © 3S System Software Support, Winterthur, Switzerland
 * 
 *  Author:        Thomas Jakober <tj at 3sweb.net>
 *  Created:       09.01.2022
 *  Program Title: Utilities
 *  File Name:     ut.js
 *  
 * UTILITY FUNCTIONS
 * 
 * 
 */

import { log } from './log.js';
import * as fs from "fs";

class Ut {
    constructor() {
        this.m = 'utility';
    };

    stringDate(d) {
        return d.getFullYear()+'-'+this.lz(d.getMonth()+1)+'-'+this.lz(d.getDate())+' '+this.lz(d.getHours())+':'+this.lz(d.getMinutes())+':'+this.lz(d.getSeconds());
    };

    lz(n, length) {
        let len = length || 2;
        var s = n.toString();
        if (s.length < len) s = '0'.repeat(len - s.length) + s;
        return s;
    };

    // string pad right up to extent n with optional character ch or the default blank
    padr(t, n, c) {
        let ch = c || ' '; 
        return t + ch.repeat(n-t.length);
    };
    
    // string right justify text tx and pad left to extent n with optional character ch or the default blank
    padl(tx, n, c) {
        let ch = c || ' ';
        let str = String(n);
        return ch.repeat(n - str.length) + str;
    };
    
    msToDHMS( ms ) {
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
    };

    // load a json config file and give it back to the callback function
    loadConfigFile(config_file_path, cb) {
        fs.readFile(config_file_path, 'utf8', (err, data) => {
            if (err) {
                log.it(2, this.m, 'Could not find configuration file '+config_file_path, 'Red');
                process.exit(1);
    
            }
            cb.call(this, JSON.parse(data));
        });
    };

};

export const ut = new Ut();
