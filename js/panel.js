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
/* global ws, ut, panelEdit */

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
                    .click(function(){
                        menu.changeTab.call(this);
                    })
                    .appendTo(m);
            $('<div id="m_'+el.dest+'"/>').appendTo('#modules');
            window[el.module].init(el);
        });
        $('<div class="hl"/>').appendTo(m);
        $('<div id="log"/>')
                .css('display', cookie.get('syslog') ? 'block' : 'none')
                .appendTo('#content');
    },
    changeTab: function() {
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
    gridSize: 50,
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
        panel.things = [];
        $('#m_panel').empty();
        panel.nTop = 0;
        for (i = 0; i < window.localStorage.length; i++) {
            var p = window.localStorage.key(i);
            if (p.substr(0, 3) === 'th_') {
                var thing = JSON.parse(window.localStorage.getItem(p));
                thing.filename = p.substr(3);
                panel.things.push(thing);
            }
        }
        for (i in panel.things) {
            panel.displayThing(panel.things[i]);
        }
        if (cb) {
            cb();
        }
    },
    displayThing: function(oThing, nThing) {
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
            var panelWidth = $(window).width() - 10;
        } else {
            var panelWidth = oThing.size.cols * panel.gridSize;
        }
        var left = (lOnecol ? 0 : oThing.pos.left * panel.gridSize);
        var top = (lOnecol ? panel.nTop : oThing.pos.top) * panel.gridSize;
        panel.nTop += oThing.size.rows;
        var th = $('<div/>')
                .addClass('thing')
                .attr('name', oThing.name)
                .attr('filename', oThing.filename)
                .css({
                    width: (panelWidth - 10)+'px', 
                    height: (this.gridSize * oThing.size.rows - 10)+'px',
                    top: (top)+'px',
                    left: (left)+'px'
                })
                .attr('title', oThing.name)
                .prop('coord', {
                    top: oThing.pos.top,
                    left: oThing.pos.left,
                    rows: oThing.size.rows,
                    cols: oThing.size.cols
                })
                .appendTo('#m_panel');
        $('<h3/>')
                .text(oThing.name)
                .appendTo(th);
        // now draw the groups within the panel
        for (var i=0; i<oThing.groups.length; i++) {
            panel.displayGroup(th, oThing.groups[i]);
        }
        // finished all the display. Now connect to the websocket server
        ws.serverConnect();  // defined in the ws.js module
    },
    displayGroup: function(th, oGroup) {
        var gr = $('<div/>')
                .addClass('group')
                .attr('title', oGroup.name)
                .appendTo(th);
        $('<h4/>')
                .text(oGroup.name)
                .addClass('groupTitle')
                .appendTo(gr);
        // fill each group with data
        for (var i=0; i<oGroup.data.length; i++) {
            panel.displayData(gr, oGroup.data[i]);
        }
    },
    displayData: function(gr, oData) {
        var dt = $('<div/>')
                .addClass('data')
                .appendTo(gr);
        if (!(oData.type === 'hscale' || oData.type === 'tmeter') && oData.label.length > 0) {
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
                .attr('name', oData.name)
                .attr('from', oData.from)
                .attr('format', oData.format)
                .attr('type', oData.type)
                .attr('size', oData.size)
                .appendTo(dt);

        // now take care of the special display models
        switch (oData.type) {
            case 'tmeter':
                var el = $('<div/>')
                        .addClass('thermometer')
                        .css({
                            'background-image': 'url('+oData.glass+')',
                            'background-repeat': 'no-repeat',
                            'background-size': 'contain',
                            'height': oData.height,
                            'width': oData.width,
                            'position': 'relative'
                        })
                        .appendTo(oVal);
                oVal.parent().parent().addClass('tmeter');
                $('<div/>')
                        .addClass('tlabel')
                        .text(oData.label)
                        .appendTo(oVal);
                var hsel = $('<canvas/>')
                        .addClass('thermoCanvas')
                        .attr('width', oData.width)
                        .attr('height', oData.height)
                        .css({
                            'position': 'absolute',
                            'left': '0',
                            'top': '0'
                        })
                        .prop('tmeter', {
                            high: oData.high,
                            low: oData.low,
                            center: oData.center,
                            top: oData.top,
                            bottom: oData.bottom,
                            height: oData.height,
                            width: oData.width,
                            mwidth: oData.mwidth,
                            mcolor: oData.mcolor
                        })
                        .appendTo(el);
                var oTmeter = hsel.prop('tmeter');
                oTmeter.oImg = $('<img src='+oData.glass+'>').get(0);
                    // get the original sizes of the meter background image
                    oTmeter.oImg.onload = function() {
                        oTmeter.meterHeight = oTmeter.oImg.height;
                        oTmeter.meterWidth = oTmeter.oImg.width;
                    };
                break;
                    
            case 'vmeter':
                var size = oData.size;
                if (oData.cover) {
                    if (oData.sq === 1) {
                        dt.addClass('coverMain');
                    } else {
                        dt.addClass('cover');
                    }
                }
                var el = $('<div>')
                        .addClass('meter')
                        .width(size)
                        .height(size)
                        .css({
                                'position': 'relative'
                        })
                        .appendTo(oVal);
                if (!oData.cover || (oData.cover && oData.sq === 1)) {
                    el.css({
                        'background-image': 'url('+ oData.bg +')',
                        'size': ''+size+'px, '+size+'px',
                        'background-repeat': 'no-repeat',
                        'background-size': 'contain'
                    });
                }
                if (oData.steps > 0) {
                    // need to draw a scale
                    var hsel = $('<canvas>')
                            .addClass('scaleCanvas')
                            .css({
                                'position': 'absolute',
                                'left': '0',
                                'top': '0'
                            })
                            .appendTo(el);
                    // Draw scale
                    panel.meterScale(hsel, oData);
                }
                // the image contains already a scale, create it's canvas
                var hsel = $('<canvas>')
                        .addClass('meterCanvas')
                        .css({
                            'position': 'absolute',
                            'left': '0',
                            'top': '0'
                        })
                        .attr('width', size)
                        .attr('height', size)
                        .prop('vmeter', {
                            size: size,
                            angle: oData.angle,
                            centerangle: oData.centerangle,
                            center: oData.center,
                            center_left: oData.center_left,
                            hand: oData.hand,
                            low: oData.low,
                            high: oData.high,
                            hand_img: oData.hand_img,
                            hand_center: oData.hand_center,
                            munit: oData.munit,
                            munit_font: oData.munit_font,
                            field: oData.field,
                            function: oData.function
                        })
                        .appendTo(el);
                var oVmeter = hsel.prop('vmeter');
                if (oData.bg) {
                    oVmeter.oImg = $('<img src='+oData.bg+'>').get(0);
                    // get the original sizes of the meter background image
                    oVmeter.oImg.onload = function() {
                        oVmeter.meterHeight = oVmeter.oImg.height;
                        oVmeter.meterWidth = oVmeter.oImg.width;
                    };
                }
                if (oData.hand_img) {
                    oVmeter.oImghand = $('<img src='+oData.hand_img+'>').get(0);
                    oVmeter.oImghand.onload = function() {
                        oVmeter.handHeight = oVmeter.oImghand.height;
                        oVmeter.handWidth = oVmeter.oImghand.width;
                    };
                }
                break;
                
            case 'hscale':
                var he = 25;
                var wi = Math.floor(dt.width())-1;
                var hsel = $('<canvas>')
                        .addClass('hscaleCanvas')
                        .prop('width', wi+'px')
                        .prop('height', he+'px')
                        .appendTo(oVal);
                panel.drawScale(hsel);
                break;

            default:
                //oVal.append(panel.format(oData.format, oData.name, oData.value));
                panel.format(oVal, false, oData.format, oData.name, oData.value);
        }
        // add a value unit if required
        if (oData.unit) {
            $('<div/>')
                    .addClass('unit')
                    .text(oData.unit)
                    .appendTo(dt);
        }
        // if the data needs to be processed by a formula
        if (oData.formula) {
            $('div.value', dt).attr('formula', oData.formula);
        }
        // a data message can have multiple fields with data
        if (oData.field) {
            $('div.value', dt).attr('field', oData.field);
        }
        panel.blink();      // start the blink time interval for blinking bulbs
    },

    // upon reception display the change of each data element
    changeData: function(oMsg) {
        var val;
        $('.value[from='+oMsg.nodeId+']').each(function() {
            var jEl = $(this);
            jEl.removeClass('disabled');
            jEl.children().removeClass('disabled');
            var name = jEl.attr('name');
            if (name === oMsg.name ) {
                var type = $(this).attr('type');
                // handle spechial element types
                switch (type) {
                    // Meter type: a grahic meter displays a fixed background image
                    // and a needle as hand which moves according the data value
                    // Multiple instruments on same scale are defined as 'groups'
                    // each 'group' has it's own canvas
                    case 'tmeter':
                        jEl.attr('title', oMsg.value);
                        var oEl = $("canvas.thermoCanvas", this);
                        var cEl = oEl.get(0);
                        var tmeter = cEl.tmeter;
                        var prop = tmeter.height / tmeter.meterHeight;
                        var vCenter = tmeter.center * prop;
                        var hCenter = tmeter.width / 2;
                        var range = tmeter.high - tmeter.low;
                        var top = tmeter.top * prop;
                        var bottom = tmeter.bottom * prop;
                        var mercury = vCenter - (oMsg.value-tmeter.low) * (vCenter-top) / range;
                        var ctx = cEl.getContext("2d");
                        ctx.clearRect(0, 0, jEl.width(), jEl.height());
                        ctx.beginPath();
                        ctx.lineWidth = tmeter.mwidth * prop;
                        ctx.strokeStyle = tmeter.mcolor;
                        ctx.moveTo(hCenter, bottom);
                        ctx.lineTo(hCenter, mercury);
                        ctx.stroke();
                        break;
                        
                    case 'vmeter':
                        jEl.attr('title', oMsg.value);
                        var oEl = $("canvas.meterCanvas", this);
                        var cEl = oEl.get(0);
                        var vmeter = cEl.vmeter;
                        var size = jEl.attr('size');
                        var angle = vmeter.angle;
                        var vCenter =  vmeter.center * size / vmeter.meterHeight;
                        var ctx = cEl.getContext("2d");
                        if (vmeter.hand_img) {
                            // hand is specified as an image which is placed on the background
                            var low = vmeter.low;
                            var high = vmeter.high;
                            var max = high - low;
                            var value = vmeter.field ? oMsg[vmeter.field] : oMsg.value;  // if value derives from a extra datafield instead ov value
                            if (vmeter.function) {
                                value = executeFunctionByName(vmeter.function, window, value);  // data needs to be processed by a specioal function
                                if (value === false) {
                                    return;
                                }
                            }
                            //if (name === 'Air Humidity') { value = 15; } else if(name === 'Air Pressure') { value = 950; } else { value = 0; }
                            if (low) {
                                // zero suppression
                                 value = value - low;
                            }
                            var alpha = (value *  angle / max - (angle / 2));
                            if (vmeter.centerangle) {
                                // in case the center of the display angle is not at the top of the instrument
                                alpha = alpha + vmeter.centerangle;
                            }
                            var handHeight = vmeter.handHeight * size  / vmeter.meterHeight;
                            var handTop = vCenter - (vmeter.hand_center  * size / vmeter.meterHeight);
                            var handWidth = size * vmeter.handWidth / vmeter.meterWidth;
                            if(vmeter.center_left) {
                                // the vertical center of the hand is not in the middle of the instument
                                var hCenter = size * vmeter.center_left / vmeter.meterWidth;
                            } else {
                                // the vertical center of the hand is in the middle of the instrument
                                var hCenter = size/2;
                            }
                            var handLeft = hCenter - (handWidth / 2);
                            ctx.clearRect(0, 0, size, size);
                            if (vmeter.munit) {
                                ctx.font = vmeter.munit_font;
                                var txt = vmeter.munit;
                                var offset = ctx.measureText(txt).width / 2;
                                ctx.fillText(txt, hCenter - offset, size * 0.75);
                            }
                            ctx.save();
                            ctx.translate(hCenter, vCenter);
                            ctx.rotate(degToRad(alpha));
                            ctx.translate(-hCenter, -vCenter);
                            ctx.drawImage(vmeter.oImghand, handLeft, handTop, handWidth, handHeight);
                            ctx.restore();
                            
                        } else {
                            // draw the hand as a line from center to 'hand' length
                            var hand =  Number(vmeter.hand) / 100;
                            ctx.beginPath();
                            ctx.clearRect(0, 0, size, size);
                            ctx.strokeStyle = "#FF0000";
                            ctx.lineWidth = 2;
                            var g = size * 0.72;        // hand center from the top
                            ctx.moveTo(size * 0.5, g);  // move to the center
                            var c = size * hand;        // hand length
                            var alpha = degToRad(((oMsg.value * angle / 100) - angle/2) * -1);
                            var b = Math.cos(alpha) * c;    // y pos of hand end rel to center 
                            var a = Math.sin(alpha) * c;    // x pos of hand end rel to center
                            var x = (size * 0.5) - a;       // x pos from the left
                            var y = g - b;                  // y pos from top
                            ctx.lineTo(x, y);               // draw the hand
                        }
                        ctx.stroke();
                        break;
                        
                    // Horizontal scale with a bar showing the data value
                    case 'hscale':
                        var hsel = $("canvas", this);
                        var cEl = hsel.get(0);
                        var ctx = cEl.getContext("2d");
                        ctx.beginPath();
                        var he = $(cEl).height();
                        var wi = $(cEl).width();
                        var rh = he / 2;
                        ctx.clearRect(0, he-rh, wi, he);
                        panel.drawScale(hsel);
                        ctx.fillStyle="#30FF30";
                        ctx.fillRect(0, he-rh, wi / 100 * oMsg.value, he);
                        ctx.stroke();
                        break;
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
                            /*
                            var o = (panel.format(
                                jEl.attr('format'), 
                                (jEl.attr('field') ? jEl.attr('field') : oMsg.name), 
                                val)
                            );
                            jEl.children(":first").replaceWith(o);
                            */
                            var o = (panel.format(
                                jEl.children(":first"),
                                true,
                                jEl.attr('format'), 
                                (jEl.attr('field') ? jEl.attr('field') : oMsg.name), 
                                val)
                            );
                           
                        }
                }
            }
        });
    },
    // Each data field is processed according th display format
    format: function(obj, replace, cFormat, name, value) {
        // cFormat is the required Format
        var oVal;
        var cl = cFormat.substr(0,1);
        var lInput = (cl === cl.toUpperCase());
        var fType = cFormat.substr(0, 1).toLowerCase();
        switch (fType) {
            case 'n':
                /* number format. format is: Ni,d
                 * where N is 'N' for input or 'n' for read only
                 * N generates a <input> tag for entering or displaying Numbers
                 * n is only a text field wich shows the current value
                 * i are the integer part places
                 * d are the decimal places
                 */
                var aWidth = cFormat.substr(1).split('_');
                var fWidth = Number(aWidth[0]);      // integer part width
                if (aWidth[1]) {
                    fWidth += Number(aWidth[1]) + 1;  // decimal places + comma 
                }
                if (lInput) {
                    oVal = $('<input />')
                            .attr('name', name)
                            .css({width:'5em',"text-align":'right'})
                            .change(panel.sendvalue)
                            .val(value);
                } else {
                    oVal = $('<span/>')
                            .text(value);
                }
                break;
                
            case 'i':
                /* Indicator is an indicator bulb which can be formatted with colour:
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
                //var el = $('.indicator[name="'+name+'"]');
                break;
                
            case 's':
                /* Switch is a switch element which can be clicked to change the state
                 * when clicked it sends always a 'TOGGLE' instruction to the thing
                 */
                oVal = $('<div/>')
                        .attr('name', name)
                        .addClass('switch')
                        .addClass(value);
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
                var d = new Date();
                d.setTime(value * 1000);
                var s = cFormat.substr(1);
                s = s.replace('DD', panel.lz(d.getDate(),2));
                s = s.replace('MM', panel.lz(d.getMonth(), 2));
                s = s.replace('YYYY ', d.getFullYear()+' ');
                s = s.replace('YY ', d.getFullYear().toString().substr(2,2)+' ');
                s = s.replace('HH', panel.lz(d.getHours(), 2));
                s = s.replace('II', panel.lz(d.getMinutes(), 2));
                s = s.replace('SS', panel.lz(d.getSeconds(), 2));
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
                        .css({'width': '140px', 'text-align': 'right'})
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

    lz: function(n, len) {
        var n = String(n);
        return '0'.repeat(len - n.length) + n;
    },

    // create the blink time interval for indicators
    // it will change the class from "blOff" to "blOn" of the element so that 
    // the effect can be defined in css
    blink: function() {
        var odd = false;
        var tmr = window.setInterval(function() {
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
    },
    
    // Function to draw a scale onto an old style round meter.
    // a graphic image of the meter to be displayed without a scale on it is
    // the base. The image can be of arbitary size, the program recalculates
    // all values propotionally according the "size" paarameter
    // 
    // Parameters in oData (which is the configuration json file) are:
    // size:    the size of of which the meter is displayed (not the size of
    //          the gaphic image)
    // center:  is the center of the hand on the original graphic image
    //          measured from the top of the image in pixels
    // angle:   is the scale angle (for the hand to be moved)
    // steps:   how many steps with numbers to be generated
    // low:     the starting value (0 for not zero suppressing scales)
    // high:    the end value of the schale
    // munit:   the unit to be displayed below the scale. "" for nothing
    
    meterScale: function(hsel, oData) {
        var cEl = hsel.get(0);
        var ctx = cEl.getContext("2d");
        ctx.beginPath();
        var ha = degToRad(oData.angle / 2);
        var x = oData.size / 2;
        var y = oData.size * oData.center / 100;
        var r = oData.size * (oData.hand / 100) - 5;
        ctx.arc(x, y, r, 1.5 * Math.PI - ha, 1.5 * Math.PI + ha);
        var a = 90 - (oData.angle / 2);
        var r1 = r + oData.size * 0.06;     // scale main lines
        var rt = r + oData.size * 0.08;     // text position
        for (var i=0; i < oData.steps+1; i++) {
            var x1 = r * Math.sin(degToRad(a));
            var y1 = r * Math.cos(degToRad(a));
            ctx.moveTo(x-x1, y-y1);
            var x2 = r1 * Math.sin(degToRad(a));
            var y2 = r1 * Math.cos(degToRad(a));
            ctx.lineTo(x-x2, y-y2);
            a -= oData.angle / 5;
        }
        ctx.save();
        ctx.translate(x, y);
        ctx.font = '12px Arial';
        ctx.fillText(oData.munit, 0, rt / 2 * -1);
        ctx.font = '9px Arial';
        ctx.rotate(degToRad((oData.angle / 2 * -1)));
        var s = oData.low;
        var step = (oData.high + (oData.low * -1)) / oData.steps;
        for (var i=0; i < oData.steps+1; i++) {
            var txt = s;
            var offset = ctx.measureText(txt).width / 2 * -1;
            ctx.fillText(txt, offset, rt * -1);
            ctx.rotate(degToRad(oData.angle / oData.steps));
            s += step;
        }
        ctx.restore();
        ctx.stroke();
    },
    
    // function to draw the scale for the horinzontal bar element
    drawScale: function(hsel) {
        var i, x, sch, mh;
        var cEl = hsel.get(0);
        var he = $(cEl).height();
        var wi = $(cEl).width();
        var ctx = cEl.getContext("2d");
        ctx.beginPath();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;
        ctx.clearRect(0, 0, wi, he);
        sch = he; // scale height
        for (i=0; i<11; i++) {
            if (i !== 5) mh = sch * 0.6;
            if (i === 0 || i === 10) mh = sch;
            if (i === 5) mh = sch * 0.8;
            x = wi/10*i;
            ctx.moveTo(x, he);
            ctx.lineTo(x, he - mh);
        }
        ctx.moveTo(0, he);
        ctx.lineTo(wi, he); 
        ctx.stroke();
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
            return false;
        }
        var tm = new Date();
        var h = tm.getHours() + 1;
        if (h === 24) {
            h=0;
        }
        return value['h'+h];
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
                    para: el.attr('name'),
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
    init: function() {
        $('<h2>Settings</h2>').appendTo('#m_settings');
        this.dispPanels();
    },
    dispPanels: function() {
        
        var pn = $('<div/>')
                .attr('id', 'panels')
                .appendTo('#m_settings');
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
        $('<input name="panelEdit" type="checkbox"/>')
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
                    ws.serverConnect();
                })
                .appendTo(oRs);
        $('<button/>')
                .attr('name', 'reload')
                .text('Reload Page')
                .click(function() {
                    location.reload();
                })
                .appendTo(oRs);
        $('<br/><div><b>Panels</b></div>').appendTo(pn);
        $('<button/>')
                .text('Update parameters')
                .click(settings.update)
                .appendTo(pn);
        var oUl = $('<ul/>')
                .attr('id', 'panelList')
                .appendTo(pn);
        $('<br/>').appendTo(pn);
        settings.readPanels(oUl);
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
            }
        );
    },
    changePanel: function() {
        var name = $(this).attr('value');
        var o = name.substr(0, name.length-5);
        if(this.checked) {
            settings.loadPanel(o, name, function() {
                $('.thing[filename="'+o+'"]').addClass('newPanel');
            });
        } else {
            window.localStorage.removeItem('th_'+o);
            panel.displayPanel();
        }
    },
    loadPanel: function(o, name, cb) {
        $.post('panel', {
            cmd: 'loadThing',
            fn: o
        }, function(s) {
            s.filename = o; 
            window.localStorage.setItem('th_'+o, JSON.stringify(s));
            panel.displayPanel(cb);
        });
    },
    update: function() {
        $('#panelList span.busy').removeClass('busy');
        for (var i = 0; i < window.localStorage.length; i++) {
            var p = window.localStorage.key(i);
            $('#panelList span[name="'+p.substr(3)+'"]')
                    .css({'color':'red'})
                    .addClass('busy');
            $.post('panel', {
                cmd: 'loadThing',
                fn: p.substr(3)
            }, function(oOrig) {
                var oLocal = JSON.parse(window.localStorage.getItem('th_'+oOrig.filename));
                for (var iGroup in oLocal.groups) {
                    oLocal.groups[iGroup].data = [];
                    for (var iData in oOrig.groups[iGroup].data) {
                        oLocal.groups[iGroup].data.push(oOrig.groups[iGroup].data[iData]);
                    }
                }
                window.localStorage.setItem('th_'+oOrig.filename, JSON.stringify(oLocal));
                $('#panelList span[name="'+oOrig.filename+'"]')
                        .css({'color': ''})
                        .removeClass('busy');
                if ($('#panelList span.busy').length === 0) {
                    panel.displayPanel();
                } 
                
            });
        }
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
        }
    }
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
});
