/* 
 *  © 3S System Software Support, Winterthur, Switzerland
 * 
 *  Author:        Thomas Jakober <tj at 3sweb.net>
 *  Created:       03.01.2022
 *  Program Title: Log formatter
 *  File Name:     log.js
 *  
 * Log messages on console with date and time
 * Option to add a module name
 * allows colourized messages
 */

import { ut } from "./ut.js";

const log = {
    level: 2,
    console: true,
    database: false,
    file: false,
    logfile: '',
    color: {
        Reset: "\x1b[0m",
        Bright: "\x1b[1m",
        Dim: "\x1b[2m",
        Underscore: "\x1b[4m",
        Blink: "\x1b[5m",
        Reverse: "\x1b[7m",
        Hidden: "\x1b[8m",
    
        Black: "\x1b[30m",
        Red: "\x1b[31m",
        Green: "\x1b[32m",
        Yellow: "\x1b[33m",
        Blue: "\x1b[34m",
        Magenta: "\x1b[35m",
        Cyan: "\x1b[36m",
        White: "\x1b[37m",
    
        BgBlack: "\x1b[40m",
        BgRed: "\x1b[41m",
        BgGreen: "\x1b[42m",
        BgYellow: "\x1b[43m",
        BgBlue: "\x1b[44m",
        BgMagenta: "\x1b[45m",
        BgCyan: "\x1b[46m",
        BgWhite: "\x1b[47m"
    },

    it: function(level, module, msg, colr, bg) {
        let colour = '';
        if (bg) {
            colour += this.color['bg'+bg];
        }
        colour += this.color[colr];
        let d = new Date();
        if (level <= this.level) {
            if (!colr) {
                colr = '';
            }
            let m = '';
            if (module) {
                m = ` [${ut.padr(module, 15)}] `;
            }
            let sd = ut.stringDate(d);
            if(this.console) {
                console.log(`${sd}.${ut.lz(d.getMilliseconds(), 3)}${m}${colour}${msg}${this.color.Reset}`);
            }
        }
    },

    logLevel:function (level) {
        this.level = level;
    },
    
    getLevel:function() {
        return this.level;
    },

    logOutput: function(output, value) {
        if (typeof(this[output])==='boolean') {
            this[output] = value;
        }
    }
};


export { log };