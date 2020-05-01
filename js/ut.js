/* 
 *  © 3S System Software Support, Winterthur, Switzerland
 * 
 *  Author:        Thomas Jakober <tj at 3sweb.net>
 *  Created:       07.06.2017, 22:00:09
 *  Program Title: 
 *  File Name:     panel.js
 *  
 *  Utility module
 */


/* global panel, ws, settings */

var ut = {
    // Utilities
    
    // logging function on the bottom log panel
    log: function(msg) {
        if (settings.syslog) {
            $('#log').append('<div>'+ut.dateToIso(new Date())+' '+msg+'</div>');
            if ($('#log > div').length > 50) {
                $('#log > div')[0].remove();
            }
            $('#log div:last-child')[0].scrollIntoView(false);
        }
    },
    
    // switch the logging function on or off
    setLog: function(value) {
        var menuHeight = 23;
        var logHeight = 100;
        settings.syslog = value;
        if (value) {
            $('#modules')
                    .css('height','calc(95vh - '+(menuHeight+logHeight)+'px)');
            $('#log').show();
        } else {
            $('#modules')
                    .css('height', 'calc(95vh - '+(menuHeight)+'px)');
            $('#log').hide();
        }
    },
    
    // convert a date variable to a ISO date string (YYYY-MM-DD HH:MM:SS)
    dateToIso: function (d) {
        return d.getFullYear()+'-'+ut.lPad0((d.getMonth()+1),2)+'-'+
                ut.lPad0(d.getDate(),2)+' '+ut.lPad0(d.getHours(),2)+':'+
                ut.lPad0(d.getMinutes(),2)+':'+ut.lPad0(d.getSeconds(),2);
    },
    
    // left pad a string with zeroes up the a specified length
    lPad0: function (n, l) {
        var str = String(n);
        return '0'.repeat(l-str.length)+str;
    }
};

/* 
 * Cookies are used to indetify the control panel
 */
cookie = {
    set: function(cname, cvalue, exdays) {
        if (typeof(cvalue) === 'boolean') {
            cvalue = (cvalue ? 'true' : 'false');
        }
        var d = new Date();
        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
        var expires = "expires="+d.toUTCString();
        document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
    },
    get: function(cname) {
        var name = cname + "=";
        var ca = document.cookie.split(';');
        for(var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) === ' ') {
                c = c.substring(1);
            }
            if (c.indexOf(name) === 0) {
                var value = c.substring(name.length, c.length);
                if (value === 'true' || value === 'false') {
                    value = (value === 'true');
                }
                return value;
            }
        }
        return "";
    }
};


/*
 * Listview module
 * Display name value pairs in a box form a message
 */
var listView = {
    // initialize: display the box
    init: function(el) {
        var dest = el.dest;
        var mDest = '#m_'+dest;
        var disp = $('<div/>')
                .attr('id', dest)
                .appendTo(mDest);
        var bt = $('<button/>')
                .attr('type', 'button')
                .attr('name', 'bRefresh')
                .text('Refresh')
                .click(function(){
                    listView.displayList(dest);
                })
                .appendTo(disp);
    },
    
    // request the list from the thing
    displayList: function(dest) {
        var dpl = {
            cmd: dest,
            services: true
        };
        ws.send(dpl);
    },

    showList: function(oList, dest) {
        // show the data
        $('#' + dest).remove();     // remove old data
        var cl = $('<ul/>')         // create the list base
                .attr('id', dest)
                .appendTo('#' + dest + 'List');
        // display the lines
        oList.forEach(function(ls) {
            var id;
            if (dest === 'node') {
                id = 'nodeId';
            } else {
                id = 'uuId';
            }
            // create a name value pair
            var li = $('<li/>')
                    .attr('id', ls[id])
                    .html('<span>'+ls[id] + ' ' + ls.name+'</span>')
                    .appendTo(cl);
            var sl = $('<ul/>')
                    .appendTo(li);
            ls.services.forEach(function(s) {
                var service = $('<li/>')
                        .appendTo(sl);
                if (dest === 'node') {
                    $('<div class="node"><span class="sLabel">name:</span><span class="sValue">'+s.name+'</span>\n\
                       </div>')
                        .appendTo(service);
                } else {
                    $('<div class="ctrl"><span class="sLabel">from:</span><span class="sValue">'+s.from+'</span>\n\
                            <span class="sLabel">name:</span><span class="sValue">'+s.name+'</span>\n\
                       </div>')
                        .appendTo(service);
                }

            });
        });
        $('#pl').html(cl);
        $('#node > li > span').click(function() {
            listView.closeInfo();
            $('<div>')
                    .attr('id', 'nodeDisp')
                    .appendTo('#nodeList');
            $('<div/>')
                    .attr('id', 'nodeInfo')
                    .appendTo('#nodeDisp');
            $('<div/>')
                    .addClass('close')
                    .text('X')
                    .click(listView.closeInfo)
                    .appendTo('#nodeInfo');
            var ncmd = $('<div/>')
                    .addClass('nodeCmd')
                    .attr('node', $(this).parent().attr('id'))
                    .appendTo('#nodeDisp');
            $('<span/>')
                    .addClass('button')
                    .text('Start Node Log')
                    .click(listView.startLog)
                    .appendTo(ncmd);
            $('<span/>')
                    .addClass('button')
                    .text('Stop Node Log')
                    .click(listView.stopLog)
                    .appendTo(ncmd);
            
            ws.send({
                cmd: 'info',
                from: $(this).parent().attr('id'),
                to: panel.uuId
            });
        });
    },

    closeInfo: function() {
        listView.stopLog();
        $('#nodeInfo .close').remove();
        $('#nodeDisp').remove();
    },

    // show nodeinfo box
    showInfo: function(oMsg) {
        var x;
        var aMsg = [];
        for (x in oMsg) {
            if (x !== 'to') {
                if (! (x === 'cmd' || x === 'from')) {
                    var v = {};
                    v.label = x;
                    v.value = oMsg[x];
                    aMsg.push(v);
                }
            }
        }
        aMsg.sort(listView.cmp);

        aMsg.forEach(function(el, i) {
            var ln = $('<div/>')
                    .addClass('infoLine')
                    .appendTo('#nodeInfo');
            $('<div/>')
                    .addClass('label')
                    .text(el.label)
                    .appendTo(ln);
            $('<div/>')
                    .addClass('value')
                    .text(el.value)
                    .appendTo(ln);
        });
        
    },
    
    // show server info box
    showServer: function(oList) {
        $('#serverData').remove();
        var data = $('<div/>')
                .attr('id', 'serverData')
                .appendTo('#serverInfo');
        for (var label in oList) {
            var ln = $('<div/>')
                    .addClass('infoLine')
                    .appendTo(data);
            $('<div/>')
                    .addClass('label')
                    .text(label)
                    .appendTo(ln);
            if (label === 'dbgLevel') {
                $('<input/>')
                        .attr('name', 'level')
                        .val(oList[label])
                        .attr('type', 'range')
                        .attr('min', 0)
                        .attr('max', 3)
                        .change(function() {
                            var c = {
                                cmd: 'debLevel',
                                dbglevel: this.value
                            };
                            ws.send(c);
                        })
                        .appendTo(ln);
                        
            } else {
                $('<div/>')
                        .addClass('value')
                        .text(oList[label])
                        .appendTo(ln);
            }
        };
    },
    
    // start receiving node log lines
    startLog: function() {
        $('<div/>')
                .attr('id', 'nodeLog')
                .appendTo('#nodeDisp');
        ws.send({
            cmd: 'sendLog',
            from: $(this).parent().attr('node'),
            to: panel.uuId
        });
    },
    
    // stop receiving node log lines
    stopLog: function() {
        ws.send({
            cmd: 'stopLog',
            from: $(this).parent().attr('node'),
            to: panel.uuId
        });
        $('#nodeLog').remove();
    },

    // compare function to sort nodeinfo lines
    cmp: function(a, b) {
        var c = 0;
        if (a.label > b.label) {
            c = 1;
        } else if (a.label < b.label) {
          c = -1;  
        }
        return c;
    }
};

/*
 * Drag and drop tool to move and size the panels on the screen
 * Go to settings and check the box 'Edit panels'
 * Go back to 'Control Panel'
 * The panels have handles to size it and they can be dragged 
 * to the desired position within the 100 x 100 raster
 * When finished, go back to Settings and uncheck the eDit Panel box
 * You are prompted wether you want to save the result.
 * The file is saved as an unformatted JSON string. You may want to reformat it 
 * by a online tool (e.g. https://jsoneditoronline.org/ or by your favorite
 * editor. 
 */
var panelEdit = {
    edit: true,

    allowEdit: function(allow) {
        var grid = {grid: [panel.gridSize, panel.gridSize], containment: "parent"};
        panelEdit.edit = allow;
        if (allow) {
            //$('#m_panel').sortable(grid);
            $('.thing')
                    .draggable(grid)
                    .resizable(grid);
            $('.thing h3').each(function() {
                var tx = $(this).text();
                $(this).text('');
                $('<input/>')
                        .val(tx)
                        .appendTo(this);
            });
            $('.thing h4').each(function() {
                var tx = $(this).text();
                $(this).text('');
                $('<input/>')
                        .val(tx)
                        .appendTo(this);
            
            });
        } else {
            $('.thing')
                    .draggable("disable")
                    .resizable("disable");
            $('.thing h3').each(function() {
                var tx = $('input', this).val();
                $('input', this).remove();
                $(this)
                        .text(tx)
                        .parent().attr('title', tx);
            });
            $('.thing h4').each(function() {
                var tx = $('input', this).val();
                $('input', this).remove();
                $(this)
                        .text(tx)     
                        .parent().attr('title', tx);
            });
            panelEdit.saveThings();
            $('.newPanel').removeClass('newPanel');
        }
    },

    saveThings: function() {
        if (window.confirm('Save new positions and text?')) {
            for(var i=0; i<panel.things.length; i++) {
                var p = panel.things[i];
                var oThing = $('#m_panel .thing[filename="'+p.filename+'"]');
                p.size.cols = Math.floor((oThing.width() + 10) / panel.gridSize);
                p.size.rows = Math.floor(oThing.height() / panel.gridSize) + 1;
                p.pos.top = Math.floor(oThing.css('top').slice(0, -2) / panel.gridSize);
                p.pos.left = Math.floor(oThing.css('left').slice(0, -2) / panel.gridSize);
                p.name = $('h3', oThing).text();
                $('h4', oThing).each(function(i) {
                    p.groups[i].name = $(this).text();
                });
                window.localStorage.setItem('th_'+p.filename, JSON.stringify(p));
            }
        }
    }
};

var upLoad = {
    nodes: [],
    oFr: null,
    oFile: null,
    init: function() {
        $('<h2>File Upload</h2>').appendTo('#m_upLoad');
        $('<button/>')
                .attr('type', 'button')
                .attr('name', 'bRefresh')
                .text('Refresh')
                .click(function(){
                    upLoad.dispNodes();
                })
                .appendTo('#m_upLoad');
        var upl = $('<div/>')
                .attr('id', 'upl')
                .attr('disabled', true)
                .appendTo('#m_upLoad');
        var sl = $('<select/>')
                .attr('name', 'nodes')
                .attr('type', 'select-one')
                .change(function() {
                    upLoad.check();
                })
                .appendTo('#upl');
        $('<option/>')
                .val('')
                .text('Select Node')
                .appendTo(sl);
        $('<div/>')
                .addClass('file')
                .click(function(){
                    $('<input type="file"/>').change(function(event) {
                      upLoad.fileInput(event);
                    }).click();
                })
                .appendTo('#upl');
        $('<input/>')
                .attr('name', 'fileName')
                .attr('type', 'text')
                .appendTo('#upl');
        $('<br/>').appendTo('#upl');
        $('<button/>')
                .attr('name', 'bUpload')
                .attr('type', 'button')
                .attr('disabled', true)
                .text('Upload')
                .click(function() {
                    upLoad.upLd();
                })
                .appendTo('#upl');
        $('<button/>')
                .attr('name', 'bBoot')
                .attr('type', 'button')
                .attr('disabled', true)
                .text('Node Restart')
                .click(function() {
                    upLoad.boot();
                })
                .appendTo('#upl');
        $('<button/>')
                .attr('name', 'bFlashreload')
                .attr('type', 'button')
                .attr('disabled', true)
                .text('Flash reload')
                .click(function() {
                    upLoad.flashReload();
                })
                .appendTo('#upl');
    },
    dispNodes: function() {
        ws.send({
            cmd: 'nodeList',
            services: false
        }, function(oList) {
            $('#upl select option[value!=""]').remove();
            oList.forEach(function(ls) {
                $('<option/>')
                        .val(String(ls.nodeId))
                        .text(ls.nodeId + ' ' + ls.name)
                        .appendTo('#upl select');

            });
        });
    },

    fileInput: function(event) {
        upLoad.oFr = new FileReader();
        upLoad.oFile = event.target.files[0];
        upLoad.oFr.onload = function() {
            $('input[name=fileName]').val(upLoad.oFile.name + ' ' + upLoad.oFile.size);

            upLoad.check();
        };
        upLoad.oFr.readAsDataURL(upLoad.oFile);
    },

    upLd: function() {
        var b64 = btoa(unescape(encodeURIComponent(upLoad.oFr.result)));
        var oFl = {
            cmd: 'file',
            to: $('select[name=nodes]').val(),
            from: panel.uuId,
            fileName: upLoad.oFile.name,
            content: b64,
            checksum: sha1(upLoad.oFr.result),
            lastModifiedDate: upLoad.oFile.lastModifiedDate
        };
        ws.send(oFl);
    },
    boot: function() {
        var oBt = {
            cmd: 'boot',
            to: $('select[name=nodes]').val(),
            from: panel.uuId
        };
        ws.send(oBt);
    },
    flashReload: function() {
            var oBt = {
            cmd: 'flashreload',
            to: $('select[name=nodes]').val(),
            from: panel.uuId
        };
        ws.send(oBt);
    },
    check: function() {
        if ($('select[name=nodes]').val() !== '' && upLoad.oFile && upLoad.oFile.size > 0) {
            $('button[name=bUpload]').attr('disabled', false);
        } else {
            $('button[name=bUpload]').attr('disabled', true);
        }
        if ($('select[name=nodes]').val() !== '') {
            $('button[name=bBoot]').attr('disabled', false);
            $('button[name=bFlashreload]').attr('disabled', false);
        } else {
            $('button[name=bBoot]').attr('disabled', true);
            $('button[name=bFlashreload]').attr('disabled', true);
        }
    }
};

function generateUUID () { // Public Domain/MIT
    var d = new Date().getTime();
    if (typeof performance !== 'undefined' && typeof performance.now === 'function'){
        d += performance.now(); //use high-precision timer if available
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function degToRad(degrees) {
  return degrees * Math.PI / 180;
};

function sha1(str) {
    //  discuss at: http://phpjs.org/functions/sha1/
    // original by: Webtoolkit.info (http://www.webtoolkit.info/)
    // improved by: Michael White (http://getsprink.com)
    // improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    //    input by: Brett Zamir (http://brett-zamir.me)
    //  depends on: utf8_encode
    //   example 1: sha1('Kevin van Zonneveld');
    //   returns 1: '54916d2e62f65b3afa6e192e6a601cdbe5cb5897'

    var rotate_left = function (n, s) {
        var t4 = (n << s) | (n >>> (32 - s));
        return t4;
    };

    /*var lsb_hex = function (val) { // Not in use; needed?
     var str="";
     var i;
     var vh;
     var vl;

     for ( i=0; i<=6; i+=2 ) {
     vh = (val>>>(i*4+4))&0x0f;
     vl = (val>>>(i*4))&0x0f;
     str += vh.toString(16) + vl.toString(16);
     }
     return str;
     };*/

    var cvt_hex = function (val) {
        var str = '';
        var i;
        var v;

        for (i = 7; i >= 0; i--) {
            v = (val >>> (i * 4)) & 0x0f;
            str += v.toString(16);
        }
        return str;
    };

    var blockstart;
    var i, j;
    var W = new Array(80);
    var H0 = 0x67452301;
    var H1 = 0xEFCDAB89;
    var H2 = 0x98BADCFE;
    var H3 = 0x10325476;
    var H4 = 0xC3D2E1F0;
    var A, B, C, D, E;
    var temp;

    //str = this.utf8_encode(str);
    var str_len = str.length;

    var word_array = [];
    for (i = 0; i < str_len - 3; i += 4) {
        j = str.charCodeAt(i) << 24 | str.charCodeAt(i + 1) << 16 | str.charCodeAt(i + 2) << 8 | str.charCodeAt(i + 3);
        word_array.push(j);
    }

    switch (str_len % 4) {
        case 0:
            i = 0x080000000;
            break;
        case 1:
            i = str.charCodeAt(str_len - 1) << 24 | 0x0800000;
            break;
        case 2:
            i = str.charCodeAt(str_len - 2) << 24 | str.charCodeAt(str_len - 1) << 16 | 0x08000;
            break;
        case 3:
            i = str.charCodeAt(str_len - 3) << 24 | str.charCodeAt(str_len - 2) << 16 | str.charCodeAt(str_len - 1) <<
                    8 | 0x80;
            break;
    }

    word_array.push(i);

    while ((word_array.length % 16) != 14) {
        word_array.push(0);
    }

    word_array.push(str_len >>> 29);
    word_array.push((str_len << 3) & 0x0ffffffff);

    for (blockstart = 0; blockstart < word_array.length; blockstart += 16) {
        for (i = 0; i < 16; i++) {
            W[i] = word_array[blockstart + i];
        }
        for (i = 16; i <= 79; i++) {
            W[i] = rotate_left(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
        }

        A = H0;
        B = H1;
        C = H2;
        D = H3;
        E = H4;

        for (i = 0; i <= 19; i++) {
            temp = (rotate_left(A, 5) + ((B & C) | (~B & D)) + E + W[i] + 0x5A827999) & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B, 30);
            B = A;
            A = temp;
        }

        for (i = 20; i <= 39; i++) {
            temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0x6ED9EBA1) & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B, 30);
            B = A;
            A = temp;
        }

        for (i = 40; i <= 59; i++) {
            temp = (rotate_left(A, 5) + ((B & C) | (B & D) | (C & D)) + E + W[i] + 0x8F1BBCDC) & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B, 30);
            B = A;
            A = temp;
        }

        for (i = 60; i <= 79; i++) {
            temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0xCA62C1D6) & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B, 30);
            B = A;
            A = temp;
        }

        H0 = (H0 + A) & 0x0ffffffff;
        H1 = (H1 + B) & 0x0ffffffff;
        H2 = (H2 + C) & 0x0ffffffff;
        H3 = (H3 + D) & 0x0ffffffff;
        H4 = (H4 + E) & 0x0ffffffff;
    }

    temp = cvt_hex(H0) + cvt_hex(H1) + cvt_hex(H2) + cvt_hex(H3) + cvt_hex(H4);
    return temp.toLowerCase();
}
