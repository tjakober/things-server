/* 
 * Clock panel
 * Parameters required in panel definition file
 * - name:          unique panel name
 * - from:          nodeId from where the data is delivered
 * - size:          pixels ¦ 'auto' (horizontal width)
 * - js:            javascript file of the meter handler
 * 
 * Parameter meanings for the meter configuration;
 * All values are pixel positions within the original corresponding image file
 * - ptr_pivot:     vertical pivot point of the hour / minute pointer
 * - ptr_left:      horizontal pivot point of the hour / minute pointer from top
 * - ptr_hour_cntr: pivot point of the hour-pointer
 * - ptr_min_cntr:  pivot point of the hour-pointer
 * - ptr_sec_pivot: vertical pivot point of the second pointer
 * - ptr_sec_left:  horizontal pivot point of the second pointer from top
 * - ptr_sec_cntr:  pivot point of the second-pointer
 */

var clock = {
    tim: null,
    sec: 0,
    min: 0,
    hour: 0,
    cSec: null,
    cMin: null,
    cHour: null,
    
    stechuhr: {
        hours: 12,
        ptr_pivot: 300,
        ptr_left: 279,
        ptr_hour_cntr: 150,
        ptr_min_cntr: 200,
        ptr_sec_pivot: 187,
        ptr_sec_left: 279,
        ptr_sec_cntr: 44,
        bg: '/images/stechuhr.png',
        img_ptr_hour: '/images/stechuhr_stundenzeiger.png',
        img_ptr_min: '/images/stechuhr_minutenzeiger.png',
        img_ptr_sec: '/images/stechuhr_sekundenzeiger.png'
    },
    soyuzclock: {
        hours: 12,
        ptr_pivot: 273,
        ptr_left: 273,
        ptr_hour_cntr: 139,
        ptr_min_cntr: 184,
        ptr_sec_pivot: 273,
        ptr_sec_cntr: 199,
        ptr_sec_left: 273,
        ptr_24_hour_pivot: 387,
        ptr_24_hour_left: 273,
        ptr_24_hour_cntr: 44,
        ptr_24_min_pivot: 387,
        ptr_24_min_left: 273,
        ptr_24_min_cntr: 44,
        bg: '/images/soyuz_clock.png',
        img_ptr_hour: '/images/soyuz_ptr_hour.png',
        img_ptr_min: '/images/soyuz_ptr_min.png',
        img_ptr_sec: '/images/soyuz_ptr_sec.png',
        img_ptr24_hour: '/images/soyuz_ptr_24_hour.png',
        img_ptr24_min: '/images/soyuz_ptr_24_min.png'
    },
    bloomsbury_clock: {
        hours: 12,
        ptr_pivot: 189,
        ptr_left: 190,
        ptr_hour_cntr: 98,
        ptr_min_cntr: 137,
        ptr_sec_pivot: 189,
        ptr_sec_cntr: 137,
        ptr_sec_left: 190,
        bg: '/images/bloomsbury_clock.png',
        img_ptr_hour: '/images/bloomsbury_clock_hour.png',
        img_ptr_min:  '/images/bloomsbury_clock_minute.png',
        img_ptr_sec:  '/images/bloomsbury_clock_sec_red.png'
    },
    
    makeCanvas: function(typ, cClass, oVal) {
        var jCanvas = $('<canvas/>')
                .addClass(cClass)
                .attr('width', typ.size)
                .attr('height', typ.size)
                .css({
                    'position': 'absolute',
                    'left': '0',
                    'top:': '0'
                })
                .appendTo(oVal);
        jCanvas.get(0).getContext('2d').scale(typ.prop, typ.prop);
        return jCanvas;
    },   
    
    displayData: function(grp, oData, oVal) {
        if (this.tim) {
            clearInterval(this.tim);
            this.tim = null;
        }
        var typ = this[oData.type];
        typ.bgImg = new Image();
        var promise = new Promise((resolve, reject) => {
            typ.bgImg.onload = function(event) {
                // compute the original sizes of the meter background image and scale factor
                typ.orig_height = typ.bgImg.height;
                typ.orig_width = typ.bgImg.width;
                var h = grp[0].offsetParent.offsetHeight - grp[0].offsetTop - 60;
                if (oData.size === 'auto') {
                    if (grp.width() <= h) {
                        typ.size = grp.width();  // width is given, height will be adjusted automatically
                    } else {
                        typ.size = h; // height is given, width will be adjusted automatically
                    }
                } else {
                     typ.size = oData.size;
                }
                typ.prop = typ.size / typ.orig_width;   // scale factor
                $(typ.bgImg)
                        .css({
                            'width': typ.size,
                            'height': typ.size
                        })
                        .appendTo(oVal);
                oVal.css({
                    'margin-left': ((grp.width() - typ.size) / 2) +'px',
                    'position': 'relative'
                });

                clock.cHour = clock.makeCanvas(typ, 'hourCanvas', oVal);
                if (typ.ptr_24_hour_pivot) {
                    clock.cHour24 = clock.makeCanvas(typ, 'hour24Canvas', oVal);
                }
                clock.cMin = clock.makeCanvas(typ, 'minCanvas', oVal);
                if (typ.ptr_24_min_pivot) {
                    clock.cMin24 = clock.makeCanvas(typ, 'min24Canvas', oVal);
                }
                if (typ.img_ptr_sec) {
                    clock.cSec = clock.makeCanvas(typ, 'secCanvas', oVal);
                }
                resolve();
            };
        });
        promise.then(() => {
            clock.displayCont(grp, oData, oVal);
        });
        typ.bgImg.src = typ.bg;
    },
    
    displayCont: function(grp, oData, oVal) {
        var typ = this[oData.type];
        this.setClock(typ);
        $('.groupText', grp).css('font-size', '');
        this.setDate(grp);
        
        typ.ptr_hour_imgObj = new Image();
        typ.ptr_hour_imgObj.onload = function() {
            clock.setHour(typ);
        };
        typ.ptr_hour_imgObj.src = typ.img_ptr_hour;
        
        typ.ptr_min_imgObj = new Image();
        typ.ptr_min_imgObj.onload = function() {
            clock.setMin(typ);
        };
        typ.ptr_min_imgObj.src = typ.img_ptr_min;
        
        if (typ.img_ptr_sec) {
            typ.ptr_sec_imgObj = new Image();
            typ.ptr_sec_imgObj.onload = function() {
                clock.setSec(typ);
            };
            typ.ptr_sec_imgObj.src = typ.img_ptr_sec;
        }
        
        if (typ.img_ptr24_min) {
            typ.ptr24_min_imgObj = new Image();
            typ.ptr24_min_imgObj.onload = function() {
                clock.setMin24(typ);
            };
            typ.ptr24_min_imgObj.src = typ.img_ptr24_min;
        }

        if (typ.img_ptr24_hour) {
            typ.ptr24_hour_imgObj = new Image();
            typ.ptr24_hour_imgObj.onload = function() {
                clock.setHour24(typ);
            };
            typ.ptr24_hour_imgObj.src = typ.img_ptr24_hour;
        }
        
        if (!this.tim) {
            this.tim = setInterval(function() {
                clock.sec++;
                if (clock.sec >= 60) {
                    clock.sec = 0;
                    clock.min++;
                    if (clock.min >= 60) {
                        clock.min = 0;
                        clock.hour24++;
                        if (clock.hour24 >= 24) {
                            clock.hour24 = 0;
                            clock.setDate(grp);
                        }
                        clock.hour++;
                        if (clock.hour >= typ.hours) {
                            clock.hour = 0;
                        }
                        clock.setHour(typ);
                        clock.setHour24(typ);
                    }
                    clock.setMin(typ);
                    clock.setHour(typ);
                    clock.setMin24(typ);
                    clock.setHour24(typ);
                }
                clock.setSec(typ);
            }, 1000);
        }
    },
    
    setClock: function(typ) {
        var d = new Date();
        this.hour24 = d.getHours();
        this.hour = d.getHours() % typ.hours;
        this.min = d.getMinutes();
        this.sec = d.getSeconds();
    },
    
    set: function(jCanvas, alpha, width, height, left, cntr, pivot, imgObj) {
        var ctx = jCanvas.get(0).getContext("2d");
        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.translate(left, pivot);
        ctx.rotate(alpha * Math.PI / 180);
        ctx.translate(-left, -pivot);
        var pointerLeft = left - (imgObj.width / 2);
        var pointerTop = pivot - cntr;
        ctx.drawImage(imgObj, pointerLeft, pointerTop, imgObj.width, imgObj.height);
        ctx.restore();
    },

    setSec: function(typ) {
        if (typ.img_ptr_sec) {
            this.set(this.cSec, 6 * this.sec, typ.orig_width, typ.orig_height, typ.ptr_sec_left, typ.ptr_sec_cntr, typ.ptr_sec_pivot, typ.ptr_sec_imgObj);
        }
    },
    
    setMin: function(typ) {
        this.setClock(typ);
        this.set(this.cMin, 6 * this.min, typ.orig_width, typ.orig_height, typ.ptr_left, typ.ptr_min_cntr, typ.ptr_pivot, typ.ptr_min_imgObj);
    },
    
    setMin24: function(typ) {
        if (typ.ptr_24_min_pivot) {
            this.set(this.cMin24, 6 * this.min, typ.orig_width, typ.orig_height, typ.ptr_24_min_left, typ.ptr_24_min_cntr, typ.ptr_24_min_pivot, typ.ptr24_min_imgObj);
        }
    },
    
    setHour: function(typ) {
        this.set(this.cHour, (30 * this.hour) + (6 * this.min / 12), typ.orig_width, typ.orig_height, typ.ptr_left, typ.ptr_hour_cntr, typ.ptr_pivot, typ.ptr_hour_imgObj);
    },
    
    setHour24: function(typ) {
        if (typ.ptr_24_min_pivot) {
            this.set(this.cHour24, 15 * this.hour24 + (3 * this.min / 12), typ.orig_width, typ.orig_height, typ.ptr_24_hour_left, typ.ptr_24_hour_cntr, typ.ptr_24_hour_pivot, typ.ptr24_hour_imgObj);
        }
    },
    
    setDate: function(grp) {
        var d = new Date();
        var dt = this.dow[d.getDay()]+', '+d.getDate()+'. '+this.month[d.getMonth()]+' '+d.getFullYear();
        var gt = $('.groupTitle', grp);
        var gtt = $('.groupText', grp).text(dt);
        
        // adjust font size when group title is too large
        var fs = parseInt(gtt.css('font-size'));
        var tw = gtt.width();    
        var mw = gt.width()-34;
        
        while (tw > mw) {
            fs -= 1;
            gtt.css('font-size', fs + 'px');
            var tw = gtt.width();
        }
        $('.value', grp).attr('title', dt);
    },
    
    refresh: function(thing, group, el) {
        var th = $('.thing[name='+thing+']');
        this.setDate(group);
    },
    
    month: [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'Mai',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Okt',
        'Nov',
        'Dez'
    ],
    
    dow: [
        'Sonntag',
        'Montag',
        'Dienstag',
        'Mittwoch',
        'Donnerstag',
        'Freitag',
        'Samstag'
    ]
};