/* 
 *  © 3S System Software Support, Winterthur, Switzerland
 * 
 *  Author:        Thomas Jakober <tj at 3sweb.net>
 *  Created:       07.06.2017, 22:00:09
 *  Program Title: 
 *  File Name:     panel.js
 *  
 *  Panel module for the Websocket Things Server
 */
/* global ws, ut, panelEdit, settings, upLoad, listView, Promise, scheduler */

/*
 * Display the top menu tabs
 */
var cookie;
var menu = {
    tbColor: 'lightblue',
    bgColor: 'white',
    tabs: [
        {
            title: 'Control Panel',
            module: 'panel',
            active: true,
            dest: 'panel'
        },
        {
            title: 'Panels',
            module: 'listView',
            active: true,
            dest: 'ctrlList',
            refresh: true
        },
        {
            title: 'Nodes',
            module: 'listView',
            active: true,
            dest: 'nodeList',
            refresh: true
        },
        {
            title: 'Upload',
            module: 'upLoad',
            active: true,
            dest: 'upLoad',
            refresh: true
        },
        {
            title: 'Server',
            module: 'listView',
            active: true,
            dest: 'serverInfo',
            refresh: true
        },
        {
            title: 'Settings',
            module: 'settings',
            active: true,
            dest: 'settings',
            refresh: false,
            renew: true
        },
        {
            title: 'Panel Editor',
            module: 'panelEdit',
            active: false,
            dest: 'panelEdit',
            refresh: false,
            renew: true
        }
    ],
    curTab: 0,
    displayMenu: function() {
        var m = $('<ul id="menu"/>').appendTo('#content');
        $('<div id="modules"/>').appendTo('#content');
        this.tabs.forEach(function(el) {
            $('<li/>')
                    .html(el.title)
                    .attr('disabled', !el.active)
                    .toggleClass('tab-disabled', !el.active)
                    .click(function(){
                        menu.changeTab.call(this);
                    })
                    .appendTo(m);
            $('<div id="m_'+el.dest+'"/>').appendTo('#modules');
            window[el.module].init(el);
        });

        var oEng = $('<li id="engine"/>')
                .appendTo(m);
        $('<div id="connection"/>')
                .addClass('indicator')
                .attr('title', 'Connection, click to reconnect')
                .appendTo(oEng);
        $('<div id="activity"/>')
                .addClass('indicator')
                .attr('title', 'Activity')
                .click(function() {
                    if ($('#panelEdit').checked()) {
                        panelEdit.allowEdit(false);
                    }
                })
                .appendTo(oEng);
        
        $('<div class="hl"/>').appendTo(m);
        $('<div id="log"/>')
                .css('display', cookie.get('syslog') ? 'block' : 'none')
                .appendTo('#content');
    },
    changeTab: function() {
        if ($(this).hasClass('tab-disabled')) return;
        $('li', $(this).parent()).removeClass('sel');
        $(this).addClass('sel');
        $('#modules > div').hide();
        $('#m_'+menu.tabs[$(this).index()].dest).show();
        if (menu.tabs[$(this).index()].refresh) {
            $('button[name=bRefresh]', '#m_'+menu.tabs[$(this).index()].dest).click();
        }
        if (menu.tabs[$(this).index()].renew) {
            executeFunctionByName(menu.tabs[$(this).index()].module+'.renew', window);
        }
    }
};

/*
 * Main object to display the control panel
 * The thing panels are displayed on a raster grid of 100 x 100 pixels
 * Each panel is defined in size and position on this raster
 * The panels are defined in json files describing its structure
 * On the website in the settings menu one can select the panels which he wants to see
 * (json file name without .json separated by comma wihout any space)
 * The Browser can be named to be seen on the console log on the server
 * This name and the set of panels is stored in the cookie 
 */
var panel = {
    thingsServer: 'localhost:8081/panel',
    name: cookie.get('device'),
    type: 'Control',
    uuId: '',
    gridSize: 30,
    oImg: null,
    size: {
        rows: 0,
        rowHeight: 0,
        cols: 0,
        colWidth:  0
    },
    css: '',
    nTop: 0,
    things: [],
    // Set up the raster grid
    init: function() {
        this.size.rows = Math.floor(window.innerHeight / this.gridSize);
        this.size.rowHeight = this.gridSize;
        this.size.cols = Math.floor(window.innerWidth / this.gridSize);
        this.size.colWidth = this.gridSize;
    },
    displayPanel: function(cb) {
        var i;
        //ws.quit();
        panel.things = [];
        $('#m_panel').empty();
        //scheduler.clear();
        panel.nTop = 0;
        // must use for(i;... because window.localStorage is not an iterable object
        for (i = 0; i < window.localStorage.length; i++) {
            var p = window.localStorage.key(i);
            if (p.substr(0, 3) === 'th_') {
                var thing = JSON.parse(window.localStorage.getItem(p));
                thing.filename = p.substr(3);
                panel.things.push(thing);
            }
        }
        var aPromises = [];
        for (i in panel.things) {
            panel.things[i].index = i;
            aPromises[i] = new Promise((resolve, reject) => {
                panel.displayThing(panel.things[i]).then(resolve).catch(reject);
            });
        }
        Promise.all(aPromises).then((values) => {
            // adjust font size when group titles are too large
            $('.groupText').each(function(){
                var gt = $(this).parent();
                var gtt = $(this);
                var fs = parseInt(gtt.css('font-size'));
                var tw = gtt.width();
                var mw = gt.width()-34;

                while (tw >= mw && fs > 0) {
                    fs -= 1;
                    gtt.css('font-size', fs + 'px');
                    tw = gtt.width();
                }
            });
            
            panel.blink();      // start the blink time interval for blinking bulbs
            // finished all the display. Now connect to the websocket server
            var p1 = new Promise((resolve, reject) => {
                if (ws.connected) {
                    ws.register();
                    resolve();
                } else {
                    ws.serverConnect(resolve);
                }
            });
            return p1.then(() => {
                /*
                for (var oSchedule of scheduler.schedules) {
                    if (oSchedule.active) {
                        ws.socket.send(oSchedule.msg);
                    }
                }
                scheduler.start();*/
                panelEdit.enable();
                if (cb) {
                    cb();
                } else {
                    return;
                }
            });
        });
    },
    
    displayThing: function(oThing) {
        /*
         * Each thing panel is displayed as a panel with a title
         * containing multiple groups of data display elements.
         * Every element can display label and data from any of
         * the things connected to the server. There is a special
         * group of panels which contain graphic display units. 
         * These will use groups to display separately animated elements
         * within this graphic such as hands or pointers 
         * 
         * For mobile displays which can display only one column of panel
         * this will be detected and handled accordingly.
         */
        if (oThing.css && oThing.css.length > 0) {
            var fileref=document.createElement("link");
            fileref.setAttribute("rel", "stylesheet");
            fileref.setAttribute("type", "text/css");
            fileref.setAttribute("href", oThing.css);
            document.getElementsByTagName("head")[0].appendChild(fileref);
        }
        // detect narrow displays which can only display one column
        oThing.size.panels = oThing.size.cols * panel.gridSize;
        var lOnecol = ($(window).width() / oThing.size.panels < 2);
        if (lOnecol) {
            //screen.lockOrientation('portrait');
            var panelWidth = $(window).width() - 10;
        } else {
            var panelWidth = oThing.size.cols * panel.gridSize;
            $('#connection').click(function() {
                ws.reconnect();
            });
        }
        var left = (lOnecol ? 0 : oThing.pos.left * panel.gridSize + 8);
        var top = (lOnecol ? panel.nTop : oThing.pos.top) * panel.gridSize + 8;
        panel.nTop += oThing.size.rows;
        var th = $('<div/>')
                .addClass('thing')
                .attr('name', oThing.name)
                .attr('filename', oThing.filename)
                .attr('panelindex', oThing.index)
                .css({
                    width: (panelWidth - 10)+'px', 
                    height: (this.gridSize * oThing.size.rows - 10)+'px',
                    top: (top)+'px',
                    left: (left)+'px'
                })
                .attr('title', oThing.name)
                .appendTo('#m_panel');
        $('<h3/>')
                .text(oThing.name)
                .appendTo(th);
  
        // now draw the groups within the panel
        var aPromises = [];
        for (var oGroup of oThing.groups) {
            aPromises.push(panel.displayGroup(th, oGroup));
        }
        return Promise.all(aPromises).then((values) => {
           return oThing;
        });
    },
    displayGroup: function(th, oGroup) {
        var gr = $('<div/>')
                .addClass('group')
                .attr('title', oGroup.name)
                .appendTo(th);
        var gt = $('<div/>')
                .addClass('groupTitle')
                .appendTo(gr);
        var gtt = $('<h4/>')
                .addClass('groupText')
                .text(oGroup.name)
                .appendTo(gt);
        
        // fill each group with data
        var aPromises = [];
        for (var oData of oGroup.data) {
            aPromises.push(panel.displayData(gr, oData));
        }
        return Promise.all(aPromises).then((values) => {
            return oGroup;
        });
    },
    displayData: function(gr, oData) {
        var pr = new Promise((resolve, reject) => {
            var dt = $('<div/>')
                    .addClass('data')
                    .appendTo(gr);
            if (oData.label) {
                $('<div/>')
                        .addClass('label')
                        .text(oData.label)
                        .appendTo(dt);
            }
            // The data is diplayed as a Label and a value pair
            var oVal = $('<div/>')
                    .addClass('value')
                    .addClass(oData.format)
                    .addClass('disabled')
                    .attr('name', (oData.query ? oData.name+':'+oData.query : oData.name))
                    .attr('from', oData.from)
                    .attr('format', oData.format)
                    .attr('type', oData.type)
                    .attr('size', oData.size)
                    .appendTo(dt);
            if (!oData.label) {
                oVal.css('width', '100%');
            }
            // now take care of the special display models
            if (oData.js) {
                // dynamically add the module
                var module = oData.js.slice(0, -3);
                var func = module+'.displayData';
                if (typeof(window[module]) === 'object') {
                    oVal.attr('module', module);
                    // Pass resolve directly as cb (for modules like vmeter that call cb).
                    // Also handle the return value in case the module returns a Promise
                    // (e.g. dials, sunpos) but does not call cb.
                    // Calling resolve() more than once is safe — subsequent calls are ignored.
                    var result = executeFunctionByName(func, window.top, gr, oData, oVal, resolve);
                    if (result && typeof result.then === 'function') {
                        // async module that returns a Promise (e.g. dials, sunpos, vmeter)
                        result.then(
                            () => resolve(),
                            (error) => { console.log(error); resolve(); }
                        );
                    } else {
                        // sync module (e.g. clock) or module that already called cb — safe to resolve
                        resolve();
                    }
                } else {
                    console.log('Module '+oData.js+' not found');
                    resolve();
                }
            } else {
                switch (oData.type) {

                    default:
                        //oVal.append(panel.format(oData.format, oData.name, oData.value));
                        panel.format(oVal, false, oData.format, oData.name, oData.value, oData.type);
                }
                // add a value unit if required
                if (oData.unit) {
                    $('<div/>')
                            .addClass('unit')
                            .text(oData.unit)
                            .appendTo(dt);
                }
                // add a container for the blinker
                $('<div/>')
                        .addClass('blinker')
                        .appendTo(dt);
                // if the data needs to be processed by a formula
                if (oData.formula) {
                    $('div.value', dt).attr('formula', oData.formula);
                }
                // a data message can have multiple fields with data
                if (oData.field) {
                    $('div.value', dt).attr('field', oData.field);
                }
                resolve();
            }
        });
        return pr.then(() => {
            return oData;
        });
    },

    // upon reception display the change of each data element
    changeData: function(oMsg) {
        var val;
        $('.value[from="'+oMsg.nodeId+'"]').each(function() {
            var jEl = $(this);
            jEl.removeClass('disabled');
            jEl.children().removeClass('disabled');
            var name = jEl.attr('name');
            if (name === (oMsg.query ? oMsg.name+':'+oMsg.query : oMsg.name)) {
                var module = $(this).attr('module');
                if (module) {
                    executeFunctionByName(module+'.changeData', window.top, this, oMsg);
                } else {
                    var type = $(this).attr('type');
                    // handle spechial element types
                    switch (type) {
                        // Standard display a label with a value. It can be an
                        // input field to be changed by the user or a read only value
                        default:
                            if (jEl.attr('formula')) {
                                val = eval(jEl.attr('formula'));        // the value needs to be calculated by a formula
                            } else if (jEl.attr('field')) {
                                val = oMsg[jEl.attr('field')];
                            } else {
                                val = oMsg.value;
                            }

                            if (jEl.attr('format')) {
                                var nm = (jEl.attr('field') ? jEl.attr('field') : oMsg.name);
                                var o = panel.format(jEl.children(":first"), true,jEl.attr('format'), nm, val, jEl.attr('type'));
                            }
                    }
                    var jBl = $('.blinker', jEl.parent());
                    jBl.addClass('blinker_on');
                    window.setTimeout(function() {
                        jBl.removeClass('blinker_on');
                    }, 500);
                }
            }
        });
    },
    // Each data field is processed according th display format
    format: function(obj, replace, cFormat, name, value, type) {
        // cFormat is the required Format
        var oVal;
        var cl = cFormat.substr(0,1);
        var lInput = (cl === cl.toUpperCase());
        var fType = cFormat.charAt(0).toLowerCase();
        switch (fType) {
            case 'n':
                /* number format. format is: Ni,d
                 * where N is 'N' for input or 'n' for read only
                 * N generates a <input> tag for entering or displaying Numbers
                 * n is only a text field wich shows the current value
                 * i are the integer part places
                 * d are the decimal places
                 */
                value = Number(value);
                var aWidth = cFormat.substr(1).split('_');
                var fWidth = Number(aWidth[0]);      // integer part width
                if (aWidth[1]) {
                    fWidth += Number(aWidth[1]) + 1;  // decimal places + comma 
                }
                if (type === 'number') {
                    fWidth += 3     // the spinner width on number inputs
                }
                var int = Math.floor(value);
                var dec = (value.toString() - int).toString();
                if (dec === '0') {
                    dec = '0.0';
                }
                if (aWidth[1]) {
                    value = int.toString() + '.' + dec.substr(2, aWidth[1]);
                } else {
                    value = int.toString();
                }
                var color;
                if (value < 0) {
                    color = 'red';
                } else {
                    color = 'black';
                }
                if (lInput) {
                    oVal = $('<input />')
                            .attr('name', name)
                            .attr('type', type)
                            .css({width:fWidth+'ch','text-align':'right', 'color': color})
                            .change(panel.sendvalue)
                            .val(value);
                } else {
                    oVal = $('<span/>')
                            .css({width: fWidth+'ch', 'text-align':'right',display:'inline-block', 'color': color})
                            .text(value);
                }
                break;
                
            case 'i':
            case 'p':
                /* Pusbutton works like indicator but can send a pulse message when clicked.
                 * Indicator is an indicator bulb which can be formatted with colour:
                 * the colour farmats are defined in the panel.css file
                 * currently the can be ired, igreen, iblue
                 * the thing can send the value On, Off, Blink
                 * When the thing is offline they are shown grayed out
                 */ 
                oVal = $('<div/>')
                        .attr('name', name)
                        .addClass('indicator')
                        .addClass('cFormat')
                        .addClass(value);
                if (fType === 'p') {
                    oVal.addClass('pushbutton')
                        .attr('from', obj.prevObject[0].attributes['from'].value)
                        .css('cursor', 'pointer')
                        .click(panel.pulse);
                }
                break;
                
            case 's':
                /* Switch is a switch element which can be clicked to change the state
                 * when clicked it sends always a 'TOGGLE' instruction to the thing
                 */
                oVal = $('<div/>')
                        .attr('name', name)
                        .addClass('switch')
                        .addClass(value.toUpperCase());
                break;
                
            case 't':
                /* 
                 * Time format. Generates a input type time element. 
                 */
               oVal = $('<input/>')
                        .attr('type', 'time')
                        .attr('name', name)
                        .css({'text-align': 'right'})
                        .change(panel.sendvalue)
                        .val(value);
                break;
            
            case 'd':
                /* Date / Time format. Only for output. 
                 * Converts a system time format message
                 */
                if (value > 0) {
                    var d = new Date();
                    d.setTime(value * 1000);
                    var s = cFormat.substr(1);
                    s = s.replace('DD', panel.lz(d.getDate(),2));
                    s = s.replace('MM', panel.lz(d.getMonth()+1, 2));
                    s = s.replace('YYYY ', d.getFullYear()+' ');
                    s = s.replace('YY ', d.getFullYear().toString().substr(2,2)+' ');
                    s = s.replace('HH', panel.lz(d.getHours(), 2));
                    s = s.replace('II', panel.lz(d.getMinutes(), 2));
                    s = s.replace('SS', panel.lz(d.getSeconds(), 2));
                } else {
                    s = '';
                }
                var oVal = $('<div/>')
                        .addClass('datetime')
                        .text(s);
                break;
                
            case 'r':
                /* Range input. Generates a slider input element. 
                 * The format string: Rn,m
                 * where n = minimum value
                 *       m = maximum value
                 */
                var aSz = cFormat.substr(1).split(',');
                oVal = $('<input/>')
                        .attr('name', 'name')
                        .attr('type', 'range')
                        .attr('min', aSz[0])
                        .attr('max', aSz[1])
                        .change(panel.sendvalue)
                        .val(value);
                break;
        }
        if (replace) {
            obj.replaceWith(oVal);      // called from changeData
        } else { 
            obj.append(oVal);           // called from displayData
            if (fType === 's') { 
                // specioal case: for a Switch element, the click event needs 
                // to be attached to the parent of the moving element
                obj.click(panel.toggle);
            }
        }
    },
    
    refresh: function() {
        // function called when visibility has changed to visible
        for (var th of panel.things) {
            for (var gr of th.groups) {
                for (var dt of gr.data) {
                    if (dt.js !== undefined) {
                        var module = dt.js.slice(0, -3);
                        var func = module+'.refresh';
                        if (typeof(window[module].refresh) === 'function') {
                           executeFunctionByName(func, window.top, th.name, gr, dt);
                        }
                    }
                }
            }
        }
    },

    lz: function(n, len) {
        var n = String(n);
        return '0'.repeat(len - n.length) + n;
    },

    // create the blink time interval for indicators
    // it will change the class from "blOff" to "blOn" of the element so that 
    // the effect can be defined in css
    blink: function() {
        var odd = false;
        if (!this.tmrBlink) {
            this.tmrBlink = window.setInterval(function() {
                var bl = $('.Blink');
                // remove or add the 'blOff' class on the element
                // on each interval. The action is defined in the panel.css file
                if (odd) {
                    bl.removeClass('blOff');
                    odd = false;
                } else {
                    if (! bl.hasClass('disabled')) {
                        $('.Blink').addClass('blOff');
                    }
                    odd = true;
                }
            }, 500, odd);
        }
    },
    
    // function to fetch the value 23 hours of the past.
    // Old barometers have a pointer for remembering the past value so that one
    // can recognize the change. This pointer had to be adjusted over the 
    // pressure pointer manually. 
    // The barometer device records the value every hour in a table.
    // This table has 24 entries in the form e.g. "p15": "1023.t6" for the 
    // value at 3:00pm (or 15:00h)
    // so we set this pointer to the value before 23 hours to indicate the change
    hourbefore: function(value) {
        if (value === undefined) {
            return undefined;
        }
        var tm = new Date();
        var h = tm.getHours() + 1;
        if (h === 24) {
            h=1;
        }
        return value['h'+h];
    },
    
    div1000: function(value) {
        return value / 1000;
    },
    div100: function(value) {
        return value / 100;
    },

    // handler to send a value from a changed data element to the thing
    sendvalue: function(event) {
        var el = $(event.target);
        var elp = $(event.target).parent();
        var timerId;
        clearTimeout(timerId);
        timerId = setTimeout(panel.sendit, 2000, el, elp);
    },

    sendit: function(el, elp) {
        var msg = {
            cmd: 'set',
            type: 'control',
            from: panel.uuId,
            to: elp.attr('from'),
            services: [
                {
                    name: elp.attr('name'),
                    para: elp.attr('field'),
                    value: el.val()
                }
            ]
        };
        ws.send(msg);
    },
    
    // Toggle a switch and change the position of the switch symbol
    toggle: function(event) {
        var oEl = $(this);
        var msg = {
            cmd: 'set',
            type: 'control',
            from: panel.uuId,
            to: oEl.attr('from'),
            services: [
                {
                    name: oEl.attr('name'),
                    value: 'TOGGLE'
                }
            ]
        };
        if (oEl.attr('field')) {
            msg.services[0].para = oEl.attr('field');
        }

        ws.send(msg);
    },
    
    pulse: function() {
        var oEl = $(this);
        var msg = {
            cmd: 'set',
            type: 'control',
            from: panel.uuId,
            to: oEl.attr('from'),
            services: [
                {
                    name: oEl.attr('name'),
                    value: 'PULSE'
                }
            ]
        };
        ws.send(msg);
    },
   
    // gray out the data field and disable its input element when the thing goes offline
    unreg: function(oMsg) {
        $('.value').each(function() {
            var jThis = $(this);
            if (oMsg===false || ($(this).attr('from') === oMsg.nodeId &&  $(this).attr('name') === oMsg.name)) {
                jThis.addClass('disabled');
                if ($('div', this).hasClass('switch')) {
                    $('div', this).removeClass('OFF');
                    $('div', this).removeClass('ON');
                }
                jThis.children().addClass('disabled');
            }
        });
    },
    disconnect: function() {
        panel.unreg(false);
    }
};

var settings = {
    device: cookie.get('device'),
    panels: cookie.get('panels'),
    syslog: cookie.get('syslog'),
    scTop: 0,
    init: function() {
        this.dispPanels();
        this.listConfig();
    },
    dispPanels: function() {
        
        var pn = $('<div/>')
                .attr('id', 'panels')
                .appendTo('#m_settings');
        $('<h2>Settings</h2>').appendTo(pn);
        $('<div/>')
                .addClass('label')
                .text('Device Name:')
                .appendTo(pn);
        $('<input name="device" type="text"/>')
                .val(this.device)
                .change(function() {
                    settings.setDevice(this.value);
                })
                .appendTo(pn);
        $('<br/>').appendTo(pn);

        $('<div/>')
                .addClass('label')
                .text('System Log:')
                .appendTo(pn);
        $('<input name="syslog", type="checkbox"/>')
                .attr('checked', this.syslog)
                .change(function() {
                    settings.setLog(this.checked);
                })
                .appendTo(pn);
        $('<br/>').appendTo(pn);
        
        $('<div/>')
                .addClass('label')
                .text('Edit panels')
                .appendTo(pn);
        $('<input id="allowEdit" name="panelEdit" type="checkbox"/>')
                .attr('checked', this.panelEdit)
                .change(function() {
                    panelEdit.allowEdit(this.checked);
                })
                .appendTo(pn);
        $('<br/>').appendTo(pn);
        var oRs = $('<div/>')
                .attr('id', 'restart')
                .appendTo(pn);
        $('<button/>')
                .attr('name', 'reconnect')
                .text('Reconnect Websocket')
                .click(function() {
                    ws.reconnect();
                })
                .appendTo(oRs);
        $('<button/>')
                .attr('name', 'reload')
                .text('Reload Page')
                .click(function() {
                    location.reload();
                })
                .appendTo(oRs);
        
        // Maintenance:
        var maint = $('<div/>')
                .attr('id', 'maintenance')
                .appendTo(pn);
        // Panels
        var pch = $('<div/>')
                .attr('id', 'panelChoice')
                .appendTo(maint);
        $('<b>Panels</b><br/>').appendTo(pch);
        $('<button/>')
                .text('Update parameters')
                .click(settings.update)
                .appendTo(pch);
        var oUl = $('<ul/>')
                .attr('id', 'panelList')
                .appendTo(pch);
        settings.readPanels(oUl);
        
        // Configurations
        var pcfg = $('<div/>')
                .attr('id', 'configs')
                .appendTo(maint);
        $('<b>Configurations</b><br/>').appendTo(pcfg);
        var confUl = $('<ul id="configurations"/>').appendTo(pcfg);
        settings.confName(confUl);
        settings.listConfig();
    },
    confName: function(confUl) {
        var jLi = $('<li/>').appendTo(confUl);
        $('<input name="fname" type="text" value="" />')
                .change(settings.checkNames)
                .appendTo(jLi);
        settings.upButton(jLi);
    },
    checkNames: function() {
        
    },
    renew: function() {
        var oUl = $('#panelList').empty();
        settings.readPanels(oUl);
    },
    readPanels: function(oUl) {
        $.post('panel', {
                cmd: 'panelList'
            }, function(s) {
                var aPanels = s.split(',');
                aPanels.sort();
                var oLi;
                for (var i in aPanels) {
                    var o = aPanels[i];
                    var n = o.substr(0, o.length-5);
                    oLi = $('<li/>').appendTo(oUl);
                    var cx = $('<input/>')
                            .attr('type', 'checkbox')
                            .attr('name', o)
                            .val(o)
                            .change(settings.changePanel)
                            .appendTo(oLi);
                    cx.get(0).checked = (window.localStorage['th_'+n]) ? true : false;
                    $('<span/>')
                            .attr('name', n)
                            .text(n)
                            .appendTo(oLi);
                }
                if ($('#panelList input:checked').length === 0) {
                    // remove old items not anymore available
                    var k;
                    for (i=0; i<window.localStorage.length; i++) {
                        k = window.localStorage.key(i);
                        if (k.slice(0, 3) === 'th_') {
                            window.localStorage.removeItem(k);
                        }
                    }
                }
                if (settings.scTop > 0) {
                    $('#panelList').scrollTop(settings.scTop);
                    settings.scTop = 0;
                }
            }
        );
    },
    changePanel: function() {
        var name = $(this).attr('value');
        var o = name.substr(0, name.length-5);
        if(this.checked) {
            settings.loadPanel(o, name, function() {
                $('.thing[filename="'+o+'"]').addClass('newPanel');
                $('#m_panel').hide();
            });
        } else {
            settings.scTop = $('#panelList').scrollTop();
            window.localStorage.removeItem('th_'+o);
            $('#menu li')[0].click();
            panel.displayPanel();
            $('#menu li')[5].click();
        }
    },
    loadPanel: function(o, name, cb) {
        $.post('panel', {
            cmd: 'loadThing',
            fn: o
        }, function(s) {
            window.localStorage.setItem('th_'+o, JSON.stringify(s));
            $('#m_panel').show(0, function() {
                panel.displayPanel(cb);
            });
            
        });
    },
    update: function() {
        /*
         * Update panel parameters
         */
        $('#panelList span.busy').removeClass('busy');  // remove all red marked
        // scan all parameter records
        for (var i = 0; i < window.localStorage.length; i++) {
            var p = window.localStorage.key(i);
            if (p === 'sth_curconfig') {
                // delete old "curconfig" record of previous version
                window.localStorage.removeItem(p);
                ut.log('removed old config record curconfig');
            }
            $('#panelList span[name="'+p.substr(3)+'"]')  // mark current record red
                    .css({'color':'red'})
                    .addClass('busy');
            // get corresponding record from server
            $.post('panel', {
                cmd: 'loadThing',
                fn: p.substr(3)
            }, function(oOrig) {
                // find corresponding record in local storage
                var updNames = true;
                var oLocal = JSON.parse(window.localStorage.getItem('th_'+oOrig.filename));
                if (updNames) {
                    oLocal.name = oOrig.name;
                }
                for (var iGroup in oLocal.groups) {
                    oLocal.groups[iGroup].data = [];
                    if (updNames) {
                        oLocal.groups[iGroup].name = oOrig.groups[iGroup].name;
                    }
                    for (var iData in oOrig.groups[iGroup].data) {
                        oLocal.groups[iGroup].data.push(oOrig.groups[iGroup].data[iData]);
                    }
                }
                window.localStorage.setItem('th_'+oOrig.filename, JSON.stringify(oLocal));
                $('#panelList span[name="'+oOrig.filename+'"]')
                        .css({'color': ''})
                        .removeClass('busy');
                if ($('#panelList span.busy').length === 0) {
                    $('#menu li:first-child').click();
                    panel.displayPanel();
                } 
            });
        }
    },
    updateConfig: function() {
        /*
         * Update configurations
         */
        $(this).css('background-position', '-22px 5px');
        var row = $(this).parent();
        var ix = row.index();
        if (row.is(':first-child')) {
            var name = $('input', row).val();
        }  else {
            var name = $('span', row).text();
        }
        var config = '[';
        for (i = 0; i < window.localStorage.length; i++) {
            var key = window.localStorage.key(i);
            if (key.substr(0,3) === 'th_') {
                config = config + window.localStorage.getItem(key)+',';
            }
        }
        config = config.slice(0, -1) + ']';
        $.post('panel', {
            cmd: 'storeConfig',
            fn: name,
            data: config
        }, function(resp) {
            ut.log('Configuration save '+name+' '+resp);
            if (resp === 'success') {
                settings.listConfig(function(){
                    $('#configurations input').val('');
                    var row = $('#configurations li')[ix];
                    $($('div', row)[0]).css('background-position', '-44px 5px');
                    window.setTimeout(function() { 
                        $($('div', row)[0]).css('background-position', '0 5px');
                    }, 1000);
                });
            } else {
                window.confirm(resp);
            }
        });
    },
    loadConfig: function() {
        $(this).css('background-position', '-22px 5px');
        var row = $(this).parent();
        var ix = row.index();
        var name = $('span', $(this).parent()).text();
        $.post('panel', {
            cmd: 'loadConfig',
            fn: name
        }, function(aData) {
            // first create a list of keys to be removed
            var aKeys = [];
            for (var i=0; i<window.localStorage.length; i++) {
                var key = window.localStorage.key(i);
                if (key.substr(0,3) === 'th_') {
                    aKeys.push(key);
                }
            }
            // now remove the keys found
            for (key of aKeys) {
                window.localStorage.removeItem(key);
            }
            // reset all checked panels
            $('#panellist input').prop('checked', false);
            for (var data of aData) {
                // store the new panel in local storage
                var key = 'th_' + data.filename;
                window.localStorage.setItem(key, JSON.stringify(data));
                // and check the corresponding panel in the panellist
                var name = data.filename + '.json';
                $('input[name="'+name+'"]', '#panellist').prop('checked', true);
            }
            $('#menu li:first-child').click();
            window.localStorage.setItem('sth_curconfig', ix);
            var row = $('#configurations li')[ix];
            $('.curconfig', '#configurations').removeClass('curconfig');
            $(row).addClass('curconfig');
            $($('div', row)[1]).css('background-position', '-44px 5px');
            window.setTimeout(function() { 
                $($('div', row)[1]).css('background-position', '0 5px');
            }, 1000);
            panel.displayPanel();
        });
    },
    listConfig: function(cb) {
        $.post('panel', {
            cmd: 'listConfig'
        }, function(resp) {
            $('#configurations li').not('li:first').remove();
            var aConfigs = resp.split(',');
            for (var config of aConfigs) {
                var jLi = $('<li/>').append('<span/>');
                $('span', jLi).text(config.slice(0, -5));
                settings.upButton(jLi);
                settings.downButton(jLi);
                settings.delButton(jLi);
                $('#configurations').append(jLi);
            }
            var ix = Number(localStorage.getItem('sth_curconfig'));
            if (ix >= 0) {
                $('.curconfig', '#configurations').removeClass('curconfig');
                var row = $('#configurations li')[ix];
                $(row).addClass('curconfig');
            }
            if (cb) {
                cb();
            }
        });
    },
    delConfig: function() {
        var row = $(this).parent();
        var name = $('span', row).text();
        $.post('panel', {
            cmd: 'delConfig',
            fn: name
        }, function(resp) {
            if (resp === 'success') {
                row.remove();
                ut.log('configuration '+name+' deleted');
            } else {
                ut.log(resp);
            }
        });
    },
    upButton: function(jLi) {
        $('<div/>')
                .addClass('upArrow')
                .attr('title', 'Upload')
                .click(settings.updateConfig)
                .appendTo(jLi);
    },
    downButton: function(jLi) {
        $('<div/>')
                .addClass('downArrow')
                .attr('title', 'Download')
                .click(settings.loadConfig)
                .appendTo(jLi);
    },
    delButton: function(jLi) {
        $('<img/>')
                .attr('src', 'images/delete.png')
                .attr('title', 'Delete')
                .click(settings.delConfig)
                .appendTo(jLi);
    },
    setDevice: function(value) {
        cookie.set('device', value, 3650);
        panel.name = value;
    },
    setLog: function(value) {
        cookie.set('syslog', value, 3650);
        panel.syslog = value;
        ut.setLog(value);
    }
};

function executeFunctionByName(functionName, context /*, args */) {
  var args = Array.prototype.slice.call(arguments, 2);
  var namespaces = functionName.split(".");
  var func = namespaces.pop();
  for(var i = 0; i < namespaces.length; i++) {
    context = context[namespaces[i]];
  }
  return context[func].apply(context, args);
}

$(document).ready(function() {
    var hidden, visibilityChange; 
    if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support 
      hidden = "hidden";
      visibilityChange = "visibilitychange";
    } else if (typeof document.msHidden !== "undefined") {
      hidden = "msHidden";
      visibilityChange = "msvisibilitychange";
    } else if (typeof document.webkitHidden !== "undefined") {
      hidden = "webkitHidden";
      visibilityChange = "webkitvisibilitychange";
    }

    document.addEventListener(visibilityChange, handleVisibilityChange, false);
    function handleVisibilityChange() {
        if (document[hidden]) {
            ws.hidden = true;
            ws.quit();
        } else {
            ws.hidden = false;
            ws.reconnect();
            panel.refresh();
        }
    }
    window.addEventListener('orientationchange', function() {
        panel.displayPanel();
    });
    
    var cp = cookie.get('cp3s');
    if (cp === '') {
        panel.uuId = generateUUID();
        cookie.set('cp3s', panel.uuId, 365);
    } else {
        panel.uuId = cp;
    }
    menu.displayMenu();
    $('#menu li:first-child').click();
    panel.displayPanel();
    ut.setLog(false);
    ut.setLog(cookie.get('syslog'));
});
