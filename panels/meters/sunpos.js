/* 
 * sunrise-sunset display
 * Parameters required in panel definition file
 * - name:          unique panel name
 * - from:          nodeId from where the data is delivered
 * - size:          pixels ¦ 'auto' (horizontal width)
 * - js:            javascript file of the meter handler
 * 
 * Parameter meanings for the meter configuration;
 * All values are pixel positions within the original corresponding image file
 * - sun:   image for sun symbol
 * - bg:    background image
 * - lat:   latidude for position of the switch
 * - lon:   longitude
 */


/* global Promise */

var sunpos = {
    hour: 0,
    min:  0,
    standard: {
        name: 'standard',
        angle: 360,
        orig_width: 725,
        pointer_pivot: 362,
        scale_center: 100,
        scale_base: 80,
        scale_big: 135,
        div_line_width: 3,
        scale_small: 125,
        scale_no_baseline: true,
        scale_start: 0,
        suppress_zero: true,
        scale_font: '48px Georgia',
        sun_pos: 140,
        sun: '/images/sunpos_sun.png',
        bg: '/images/sunpos.png'
    },
    
   scale: function(hsel, oVal, typ) {
        /*
         * Create a 24 Hour Clock scale
         * because the parameters for this scale need not to be flexible
         * we simulate these so they are fixed
         */
        var oData = oVal.prop('oData');
        var prop = oVal.prop('proportion');
        oData.low = 0;
        oData.high = 24;
        oData.scale_steps = 24;
        oData.scale_div = 1;
        oData.scale_subdiv = 1;
        var cEl = hsel.get(0);
        var ctx = cEl.getContext("2d");
        ctx.scale(prop, prop);
        ctx.beginPath();
        var ha = degToRad(typ.angle / 2);     // half angle
        if (typ.top_down) {
            var factor = 0.5;
        } else {
            var factor = 1.5;
        }
        var x = typ.pointer_pivot || (typ.orig_width / 2);
        var y = typ.pointer_pivot;
        if (! typ.scale_no_baseline) {
            var r = (typ.top_down ? typ.scale_center - y : y - typ.scale_center);
            ctx.arc(x, y, r, factor * Math.PI - ha, factor * Math.PI + ha);
            ctx.stroke();
        }
        if (typ.mid_line) {
            ctx.beginPath();
            r = (typ.top_down ? typ.scale_small - y : y - typ.scale_small);
            ctx.arc(x, y, r, factor * Math.PI - ha, factor * Math.PI + ha);
            ctx.stroke();
        }
        var pivot = typ.pointer_pivot;
        var n = oData.low;
        var inc = (oData.high - oData.low) / oData.scale_steps;
        var step = 0;
        var stepDeg = typ.angle / oData.scale_steps;    // degrees per scale step
        var divDeg = stepDeg / (oData.scale_div + 1);   // degrees per scale div
        var divs = stepDeg / divDeg;                    // number of divs per step
        var subDivs = oData.scale_subdiv;               // number of subdivs per div
        var subDeg = divDeg / (subDivs + 1);            // degrees per subdiv
        if (typ.top_down) {
            subDeg = subDeg * -1;
            divDeg = divDeg * -1;
        }
        var txt, offset, nSub, nDiv;
        var r =  typ.scale_center;  // lower arc
        var r1 = typ.scale_small;   // upper arc
        var r2 = typ.scale_big;     // big scale
        var r3 = typ.scale_base;    // text
        if (typ.top_down) {
            var deg = (typ.angle / 2);
        } else {
            var deg = -(typ.angle / 2);
        }
        if (typ.scale_start) {
            deg = deg - typ.scale_start;
        }
        this.rotate(ctx, x, pivot, deg);
        ctx.font = typ.scale_font;
        // start with step 0 and draw 
        while (step < oData.scale_steps) {
            if (!(typ.suppress_zero && step === 0)) {
                ctx.beginPath();
                ctx.moveTo(x, r);
                ctx.lineWidth = (typ.div_line_width || 1);
                ctx.lineTo(x, r2);
                ctx.stroke();
                txt = n.toString();
                offset = ctx.measureText(txt).width / 2;
                ctx.fillText(txt, x - offset, r3);
            }
            n += inc;
            if (oData.scale_div) {
                for (nDiv = 0; nDiv < divs; nDiv++) { 
                    if (oData.scale_subdiv) { 
                        for (nSub = 0; nSub < subDivs; nSub++) {
                            this.rotate(ctx, x, pivot, subDeg);
                            ctx.beginPath();
                            ctx.moveTo(x, r);
                            ctx.lineWidth = (typ.small_line_width || 1);
                            ctx.lineTo(x, r1);
                            ctx.stroke();
                        }
                        this.rotate(ctx, x, pivot, subDeg);;
                    } else {
                        this.rotate(ctx, x, pivot, divDeg);
                    }
                    if (nDiv < divs - 1) {
                        ctx.beginPath();
                        ctx.moveTo(x, r);
                        ctx.lineWidth = (typ.big_line_width || 1);
                        ctx.lineTo(x, r2);
                        ctx.stroke();
                    }
                }
            }
            step++;
        }
        ctx.beginPath();
        ctx.moveTo(x, r);
        ctx.lineWidth = (typ.div_line_width || 1);
        ctx.lineTo(x, r2);
        txt = n.toString();
        offset = ctx.measureText(txt).width / 2;
        ctx.fillText(txt, x - offset, r3);
        ctx.stroke();
        
    },
    
    rotate: function(ctx, x, pivot, deg) {
        ctx.translate(x, pivot);            // move Cursor to the pivot point
        ctx.rotate(degToRad(deg));          // rotate the canvas
        ctx.translate(-x, -pivot);          // move cursor back to the previous position
    },
    
    makeCanvas: function(typ, cClass, oVal) {
        var size = oVal.prop('size');
        var jCanvas = $('<canvas/>')
                .addClass(cClass)
                .attr('width', size)
                .attr('height', size)
                .attr('type', typ.name)
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
        var typ = this[oData.type];
        var promises = [];
        var aImages = ['bg', 'sun'];
        aImages.forEach((image,i) => {
            promises.push(new Promise((resolve, reject) => {
                var cImg = image+'Img';
                typ[cImg] = new Image();
                var oImg = typ[cImg];
                oImg.name = image;
                oImg.onload = (event) => {
                    if (event.target.name === 'bg') {
                        // compute the original sizes of the meter background image and scale factor
                        typ.orig_height = oImg.height;
                        typ.orig_width = oImg.width;
                        var h = grp[0].offsetParent.offsetHeight - grp[0].offsetTop - 60;
                        var size, prop;
                        if (oData.size === 'auto') {
                            if (grp.width() <= h) {
                                size = grp.width();  // width is given, height will be adjusted automatically
                                prop = size / oImg.width;
                            } else {
                                size = h; // height is given, width will be adjusted automatically
                                prop = size / oImg.height;
                            }
                        } else {
                             size = oData.size;
                             prop = size / min(oImg.height, oImg.width);
                        }
                        oVal.prop('size', size);
                        oVal.prop('proportion', prop); 
                        $(oImg)
                                .css({
                                    'width': size,
                                    'height': size
                                })
                                .appendTo(oVal);
                        oVal.css({
                            'margin-left': ((grp.width() - size) / 2) +'px',
                            'position': 'relative'
                        });
                    }
                    resolve();
                };
                oImg.src = typ[image];
            }));
        });
        return Promise.all(promises).then((size) => {
            this.displayCont(grp, oData, oVal, typ, size);
        });
    },
    
    displayCont: function(grp, oData, oVal, typ) {
        oVal.addClass('sunpos');
        this.hsel = this.makeCanvas(typ, 'sun', oVal);
        this.hscale = this.makeCanvas(typ, 'scale', oVal);
        this.hnight = this.makeCanvas(typ, 'night', oVal);
        this.hcivil = this.makeCanvas(typ, 'civil', oVal);
        this.hnaut = this.makeCanvas(typ, 'naut', oVal);
        this.hastr = this.makeCanvas(typ, 'astr', oVal);
        oVal.prop('oData', oData);
        this.scale(this.hscale, oVal, typ);
        var d = new Date();
        this.getSunriseSunset(oVal, this.displayDusk);
        this.dispSun(oVal, d);
        if (!this.tim) {
            this.tim = setInterval(() => {
                var d = new Date();
                var sunPos =  $('.sunpos');
                for (var i=0; i<sunPos.length; i++) {
                    var item = $($(sunPos).get(i));
                    this.dispSun(item, d);
                    if ((d.getUTCHours() === 0)&& (d.getUTCMinutes() === 1)) {
                        console.log(d.toTimeString());
                        this.getSunriseSunset(item, this.displayDusk);
                    }
                };
            }, 60000);
        }
    },
    
    dispSun: function(oVal, d) {
        var UTCOffset = oVal.prop('oData').UTCOffset;
        //var UTCOffset = d.getTimezoneOffset() / 60 * -1;
        var typ = sunpos[oVal.attr('type')];
        var left = (typ.orig_width / 2);
        var top = (typ.orig_height / 2);
        var hour = d.getUTCHours() + UTCOffset;
        var alpha = (15 * hour + (d.getMinutes() / 4))- 180;
        var prop = oVal.prop('proportion');
        var canvas = $('.sun', oVal).get(0);
        var ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, typ.orig_width, typ.orig_height);
        //ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(prop, prop);
        ctx.translate(left, top);
        ctx.rotate(alpha * Math.PI / 180);
        ctx.translate(-left, -top);
        var pointerLeft = left - (typ.sunImg.width / 2);
        var pointerTop = typ.sun_pos;
        ctx.drawImage(typ.sunImg, pointerLeft, pointerTop, typ.sunImg.width, typ.sunImg.height);
        ctx.restore();
    },
    
    getSunriseSunset: function(oVal, cb) {
        var oData = oVal.prop('oData');
        var typ = sunpos[oVal.attr('type')];
        var url = "https://api.sunrise-sunset.org/json?lat=%lat%&lng=%lon%&formatted=0";
        url = url.replace('%lat%', oData.lat);
        url = url.replace('%lon%', oData.lon);
        let xmlHttp = new XMLHttpRequest();
        xmlHttp.open( "GET", url, true ); // false for synchronous request
        xmlHttp.send( null );
        xmlHttp.onload = (e) => {
            cb(oVal, typ, JSON.parse(xmlHttp.responseText).results);
        };
        let url2 = 'https://www.timeapi.io/api/TimeZone/coordinate?latitude=%lat%&longitude=%lon%';
        url2 = url2.replace('%lat%', oData.lat);
        url2 = url2.replace('%lon%', oData.lon);
        let xmlHttp2 = new XMLHttpRequest();
        xmlHttp2.open( "GET", url2, true ); // false for synchronous request
        xmlHttp2.setRequestHeader("Content-Type", "application/json");
        xmlHttp2.send( null );
        xmlHttp2.onload = (e) => {
            let timeInfo = JSON.parse(xmlHttp2.responseText).results;
            oData.UTCOffset = timeInfo.currentUtcOffset.seconds / 3600;
        };
       
        
    },
    
    displayDusk: function(oVal, typ, oSS) {
        var prop = oVal.prop('proportion');
        console.log(oSS);
        sunpos.drawArc(typ, prop, $('.night', oVal), 'rgba(192,192,192,0.3)', oSS.sunset, oSS.sunrise);
        sunpos.drawArc(typ, prop, $('.civil', oVal), 'rgba(120,120,120,0.3)', oSS.civil_twilight_end, oSS.civil_twilight_begin);
        sunpos.drawArc(typ, prop, $('.naut',  oVal), 'rgba( 64, 64, 64,0.3)', oSS.nautical_twilight_end, oSS.nautical_twilight_begin);
        sunpos.drawArc(typ, prop, $('.astr',  oVal), 'rgba( 20, 20, 20,0.3)', oSS.astronomical_twilight_end, oSS.astronomical_twilight_begin);
    },
    
    drawArc: function(typ, prop, jCanvas, color, start, end) {
        var rad = Math.PI / 180;
        var hCenter = typ.orig_width / 2;
        var pivot = typ.pointer_pivot;
        var duskArc = ((new Date(end) - new Date(start)) / 3600000) * 15;    // 15 degrees per hour
        var ctx = jCanvas.get(0).getContext("2d");
        ctx.clearRect(0, 0, typ.orig_width, typ.orig_height);
        ctx.save();
        ctx.scale(prop, prop);
        var rotTime = new Date().setHours(18,0,0) - new Date(start);
        var rotAngle = rotTime  / 3600000 * 15;
        ctx.translate(hCenter, pivot);
        ctx.rotate(-rotAngle * rad);
        ctx.translate(-hCenter, -pivot);
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.moveTo(typ.pointer_pivot, typ.orig_width / 2);
        ctx.arc(pivot, hCenter, typ.pointer_pivot - (typ.scale_big+2), 0, duskArc * rad);
        ctx.lineTo(typ.pointer_pivot, typ.orig_width / 2);
        ctx.stroke();
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
    }    
};