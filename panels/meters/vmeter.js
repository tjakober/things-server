/* 
 * Round or square meters instruments with one or more pointers
 * Each meter requirea one panel. Multiple values are used for multiple pointers
 * on the same instrument
 * Parameters required in panel definition file
 * - name:           unique panel name
 * - from:           nodeId from where the data is delivered
 * - size:           pixels ¦ 'auto' (horizontal width)
 * - low and high are required in panel definition file if scale is to be drawn
 * - low:            start scale value (my be neagative)
 * - high:           end scale value
 * + cover:          instrument has multiple pointers, numbered by cover.
 *                   1 is the lowest and displays the instrument image
 * + scale_steps:    steps to be indicated by a number value   0      10      20
 * + scale_div:      corase scale divisions per step           |   |   |   |   |
 * + scale_subdiv:   fine scale divisions per division         |||||||||||||||||
 * + means optional. If scale values are missing, no scale is drawn
 *                   also if no subdiv's are specified, no subdivs ar dwawn
 * - munit:          meter unit text e.g. V, A, W, %
 * + pointer_color:  color of the movable hand
 * - js:             javascript file of the meter handler
 * 
 * Parameter meanings for the meter configuration;
 * All values are pixel positions within the original corresponding image file
 * - angle           Angle of the scale in degrees
 * - low and high is required here when scale scale is on the main picture
 * - low:            start scale value (my be neagative)
 * - high:           end scale value
 * + centerangle     angle of middle of the scale from vertical position
 * - start_at:       beginning angle of scale mesured from vertical center
 * - pointer_top:    end of the pointer from the top (when in vertical position)
 *                   only needed if the pointer is not an image
 * - pointer_pivot:  pivot point of the pointer measured from top
 * + pointer_center: center of the poiter: pivot point within pointer image
 * + pointer_stroke: stroke width of the pointer if pointer is drawn
 * + pointer_style:  stroke style if pointer is drawn
 * + pointer_img     source of Image of the pointer if it is a graphic
 * + scale_center:   lower line of scale mesured from top
 * + scale_base:     font base line measured from the top
 * + scale_big:      top pos of of big scale divisions
 * + scale_small:    top pos of of small scale divisions
 * + scale_font:     size and font name for scale numbers e.g. '9px Arial'
 * + mid_line:       true if small divisions ar closed by a line
 * - munit_font:     size anf font name for unit
 * + munit_x:        center of the unit text measured from left, default is center
 * - munit_y         base line for unit measured fropm top
 * + function:       function to calculate the value
 * 
 * orig_height, orig_width, pointer_imgObj, prop and size ar calculated values
 */


/* global scheduler, panel */

var vmeter = {
    voltmeter: {
        angle: 90,
        pointer_top: 134,
        pointer_pivot: 372,
        pointer_stroke: 10,
        pointer_style: '#FF0000',
        scale_center: 158,
        scale_small: 136,
        scale_big: 116,
        scale_base: 108,
        scale_font: '30px Arial',
        mid_line: true,
        start_at: -45,
        munit_font: '50px Arial',
        munit_pos: 242,
        bg: '/images/meter.png'

    },
    mameter1: {
        angle: 90,
        pointer_pivot: 544,
        pointer_center: 279,
        scale_center: 286,
        scale_small: 264,
        scale_big: 250,
        scale_base: 240,
        scale_font: '40px Arial',
        mid_line: true,
        start_at: -45,
        munit_font: '50px Arial',
        munit_pos: 340,
        pointer_img: '/images/mameter1_pointer.png',
        bg: '/images/mameter1.png'
    },
    ammeter_siemens: {
        angle: 90,
        top_down: true,
        pointer_pivot: 158,
        pointer_top: 392,
        pointer_center: 0,
        scale_center: 386,
        scale_small: 403,
        scale_big: 419,
        scale_base: 438,
        scale_font: '18px Arial',
        mid_line: true,
        munit_pos: 305,
        munit_font: '30px Arial',
        pointer_img: '/images/amperemeter_siemens_pointer.png',
        bg: '/images/amperemeter_siemens.png'
    },
    // English - French Barometer with movable pointer
    baro_eng: {             // main barometer pointer
        angle: 270,
        low: 950,
        high: 1050,
        pointer_pivot: 365,
        pointer_center: 260,
        munit: 'kPa',
        munit_font: '45px Old English Text MT',
        munit_pos: 554,
        bg: '/images/baro_eng2.png',
        pointer_img: '/images/baro_eng_hand.png'
    },
    baro_eng_cur: {         // movable pointer of baro_eng
        angle: 270,
        low: 950,
        high: 1050,
        pointer_pivot: 365,
        pointer_center: 243,
        pointer_img: '/images/baro_eng_hand2.png',
        type_main: 'baro_eng'
    },
    thermo_hygro_thermo: {   // thermometer (left scale)
        angle: 64,
        low: 0,
        high: 40,
        centerangle: -58,
        pointer_pivot: 213,
        pointer_center: 175,
        center_left: 234,
        bg: "/images/thermo_hygro.png",
        pointer_img: "/images/thermo_hygro_hand.png"
    },
    thermo_hygro_hygro: {    // hygrometer (right scale)
        angle: -64,
        low: 15,
        high: 100,
        centerangle: 58,
        pointer_pivot: 213,
        pointer_center: 175,
        center_left: 97,
        pointer_img: "/images/thermo_hygro_hand.png",
        type_main: 'thermo_hygro_thermo'
    },
    thermo_hygro_fischer_hygro: {   // hygrometer (left scale)
        angle: 55,
        low: 20,
        high: 100,
        centerangle: -55,
        pointer_pivot: 313,
        pointer_center: 260,
        center_left: 336,
        bg: "/images/thermo_hygro_fischer.png",
        pointer_img: "/images/thermo_hygro_fischer_pointer.png"
    },
    thermo_hygro_fischer_thermo: {    // thermometer (right scale)
        angle: -55,
        low: -10,
        high: 40,
        centerangle: 55,
        pointer_pivot: 313,
        pointer_center: 260,
        center_left: 160,
        pointer_img: "/images/thermo_hygro_fischer_pointer.png",
        type_main: 'thermo_hygro_fischer_hygro'
    },
    thermo_hygro_fischer2_thermo: {    // thermometer (right scale)
        angle: 240,
        low: -30,
        high: 50,
        pointer_pivot: 358,
        pointer_center: 243,
        bg: "/images/thermo-hygrometer_fischer2.png",
        pointer_img: "/images/thermo-hygrometer_fischer2_pt_thermo.png"
    },
    thermo_hygro_fischer2_hygro: {   // hygrometer (left scale)
        angle: 270,
        low: 0,
        high: 100,
        pointer_pivot: 539,
        pointer_center: 115,
        pointer_img: "/images/thermo-hygrometer_fischer2_pt_hygro.png",
        type_main: 'thermo_hygro_fischer2_thermo'
    },
    baro_weems: {
        angle: 260,
        low: 951,
        high: 1047,
        pointer_pivot: 333,
        pointer_center: 260,
        pointer_img: '/images/baro_thermo_hygro_weems_hand.png',
        bg: '/images/baro_thermo_hygro_weems.png'
    },
    baro_weems_cur: {
        angle: 260,
        low: 951,
        high: 1047,
        pointer_pivot: 340,
        pointer_center: 256,
        pointer_img: '/images/baro_thermo_hygro_weems_movable.png',
        type_main: 'baro_weems'
    },
    baro_weems_hygro: {
        angle: -60,
        low: 20,
        high: 100,
        centerangle: 60,
        pointer_pivot: 535,
        pointer_center: 178,
        center_left: 243,
        pointer_img: '/images/baro_thermo_hygro_weems_hand_th.png',
        type_main: 'baro_weems'
    },
    baro_weems_thermo: {
        angle: 60,
        low: -10,
        high: 40,
        centerangle: -60,
        pointer_pivot: 535,
        pointer_center: 178,
        center_left: 416,
        pointer_img: '/images/baro_thermo_hygro_weems_hand_th.png',
        type_main: 'baro_weems'
    },        
    hygro_meyrowitz: {
        angle: 73,
        low: 30,
        high: 100,
        pointer_pivot: 341,
        pointer_center: 233,
        bg: "/images/hygro_meyrowitz.png",
        pointer_img: "images/hygro_meyrowitz_hand.png"
    },
    baro_metro: {
        angle: 275,
        low: 917.7,
        high: 1080.3,
        pointer_pivot: 187,
        pointer_center: 156,
        pointer_img: '/images/baro_metro_hand.png',
        bg: '/images/baro_metro.png'
   },
   baro_metro_movable: {
        angle: 275,
        low: 917.7,
        high: 1080.3,
        pointer_pivot: 189,
        pointer_center: 107,
        pointer_img: '/images/baro_metro_hand2.png',
        type_main: 'baro_metro'
   },
    baro_meyrowitz: {
        angle: 300,
        low: 917.7,
        high: 1083.6,
        pointer_pivot: 166,
        pointer_center: 105,
        pointer_img: '/images/baro_meyrowitz_hand.png',
        bg: '/images/baro_meyrowitz.png'
    },
    thermo_hygro_metro_thermo: {
        angle: 240,
        low: -30,
        high: 50,
        pointer_pivot: 180,
        pointer_center: 115,
        pointer_img: '/images/thermo_hygro_metro_pt_thermo.png',
        bg: '/images/thermo_hygro_metro.png'
    },
    thermo_hygro_metro_hygro: {
        angle: 270,
        low: 0,
        high: 100,
        pointer_pivot: 272,
        pointer_center: 58,
        pointer_img: '/images/thermo_hygro_metro_pt_hygro.png',
        type_main: 'thermo_hygro_metro_thermo'
    },
    
    h_w_sullivan_meter: {
        angle: 90,
        pointer_pivot: 173,
        pointer_center: 114,
        scale_center: 75,
        scale_base: 50,
        scale_big: 55,
        scale_small: 60,
        scale_font: "12px Georgia",
        mid_line: true,
        munit_font: "15px Georgia",
        munit_y: 160,
        pointer_img: '/images/meter_h_w_sullivan_pointer.png',
        bg: '/images/meter_h_w_sullivan.png'
        
    },
    brannan_max_min_thermo: {
        angle: 200,
        low: -20,
        high: 50,
        pointer_pivot: 221,
        pointer_center: 151,
        pointer_img: '/images/brannan_max_min_pointer.png',
        bg: 'images/brannan_max_min.png'
    },
    brannan_max_min_min: {
        angle: 200,
        low: -20,
        high: 50,
        pointer_pivot: 221,
        pointer_center: 151,
        pointer_img: '/images/brannan_max_min_pointer_min.png',
        type_main: 'brannan_max_min_thermo'
    },
    brannan_max_min_max: {
        angle: 200,
        low: -20,
        high: 50,
        pointer_pivot: 221,
        pointer_center: 151,
        pointer_img: '/images/brannan_max_min_pointer_max.png',
        type_main: 'brannan_max_min_thermo'
    },
    brannan_max_min_hygro: {
        angle: 270,
        low: 0,
        high: 100,
        pointer_pivot: 324,
        pointer_center: 41,
        pointer_img: '/images/brannan_max_min_pointer_hygro.png',
        type_main: 'brannan_max_min_thermo'
    },
        
    
    displayData: function(grp, oData, oVal, cb) {
        var typ = this[oData.type];
        if (!oData.cover || (oData.cover === 1)) {
            var prImage = new Promise((resolve, reject) => {
                typ.bgImg = new Image();
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
                    var el = $(typ.bgImg).clone()
                            .addClass('meter')
                            .css({
                                'width': typ.size,
                                'height': typ.size
                            })
                            .appendTo(oVal);
                    $(el).parent().css('margin-left', ((grp.width() - typ.size) / 2) +'px');
                    vmeter.displayCont(grp, oData, oVal, null);  // cb is handled by prImage.then()
                    grp.prop('loaded', true);
                    resolve();
                };
                typ.bgImg.src = typ.bg;
            });
            return prImage.then(() => {
                if (cb) cb();
            });
        } else {
            var promiseImg = new Promise(function (resolve, reject) {
                var waitForImg = function(){
                    if (grp.prop('loaded') === true) {
                        return resolve();
                    }
                    setTimeout(waitForImg, 30);
                };
                waitForImg();
            });
            return promiseImg.then(() => {
                this.displayCont(grp, oData, oVal, cb);
            });
        }
    },

    displayCont: function(grp, oData, oVal, cb) {
        var typ = this[oData.type];
        oVal.css({
            'position': 'relative'
        });
        var dt = oVal.parent();
        if (oData.cover) {
            if (oData.cover === 1) {
                dt.addClass('coverMain');
            } else {
                dt.addClass('cover');
            }
        }
        if (!oData.cover || (oData.cover === 1)) {
            oVal.parent().addClass(oData.type);
        } else {
            if (typ.type_main) {
                typ.size = this[typ.type_main].size;
                typ.prop = this[typ.type_main].prop;
            }
            oVal.css('margin-left', ((grp.width() - typ.size) / 2) +'px');
        }
        if (oData.scale_steps > 0) {
            // need to draw a scale
            var hsel = $('<canvas/>')
                    .addClass('scaleCanvas')
                    .attr('width', typ.size)
                    .attr('height', typ.size)
                    .css({
                        'position': 'absolute',
                        'left': '0',
                        'top': '0'
                    })
                    .appendTo(oVal);
            // Draw scale
            this.meterScale(hsel, oData);
        }
        // create pointer's  canvas
        var hsel = $('<canvas/>')
                .addClass('meterCanvas')
                .css({
                    'position': 'absolute',
                    'left': '0',
                    'top': '0'
                })
                .attr('width', typ.size)
                .attr('height', typ.size)
                .prop('vmeter', {
                    type: oData.type,
                    low: oData.low,
                    high: oData.high,
                    munit: oData.munit,
                    field: oData.field,
                    function: oData.function
                })
                .appendTo(oVal);
        if (oData.cover) {
            hsel.attr('id', 'cover'+oData.cover);
        }
        var ctx = hsel.get(0).getContext("2d");
        if (typ.type_main) {
            // get the prop value from main type
            ctx.scale(this[typ.type_main].prop, this[typ.type_main].prop);
            typ.orig_height = this[typ.type_main].orig_height;
            typ.orig_width = this[typ.type_main].orig_width;
        } else {
            ctx.scale(typ.prop, typ.prop);
        }
        
        if (typ.pointer_img) {
            typ.pointer_imgObj = $('<img src='+typ.pointer_img+'>').get(0);
        }
        /*
        if (oData.interval) {
            var oMsg = {
                cmd: 'rqData',
                type: 'control',
                from: oData.from,
                to: panel.uuId,
                name: oData.name,
                query: oData.query
            };
            scheduler.create(oData.interval, JSON.stringify(oMsg));
        }*/
        if (cb) cb();
    },
    // Draw meter scale
    meterScale: function(hsel, oData) { 
        var typ = this[oData.type];
        var cEl = hsel.get(0);
        var ctx = cEl.getContext("2d");
        ctx.scale(typ.prop, typ.prop);
        ctx.beginPath();
        var ha = degToRad(typ.angle / 2);     // half angle
        if (typ.top_down) {
            var factor = 0.5;
        } else {
            var factor = 1.5;
        }
        var x = typ.orig_width / 2;
        var y = typ.pointer_pivot;
        var r = (typ.top_down ? typ.scale_center - y : y - typ.scale_center);
        ctx.arc(x, y, r, factor * Math.PI - ha, factor * Math.PI + ha);
        ctx.stroke();
        if (typ.mid_line) {
            ctx.beginPath();
            r = (typ.top_down ? typ.scale_small - y : y - typ.scale_small);
            ctx.arc(x, y, r, factor * Math.PI - ha, factor * Math.PI + ha);
            ctx.stroke();
        }
        x = typ.size / 2;
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
        x = typ.orig_width / 2;
        var pivot = typ.pointer_pivot;
        if (typ.top_down) {
            var deg = (typ.angle / 2);
        } else {
            var deg = -(typ.angle / 2);
        }
        this.rotate(ctx, x, pivot, deg);
        ctx.font = typ.scale_font;
        while (step < oData.scale_steps) {
            ctx.beginPath();
            ctx.moveTo(x, r);
            ctx.lineTo(x, r2);
            ctx.stroke();
            txt = n.toString();
            offset = ctx.measureText(txt).width / 2;
            ctx.fillText(txt, x - offset, r3);
            n += inc;
            if (oData.scale_div) {
                for (nDiv = 0; nDiv < divs; nDiv++) { 
                    if (oData.scale_subdiv) { 
                        for (nSub = 0; nSub < subDivs; nSub++) {
                            this.rotate(ctx, x, pivot, subDeg);
                            ctx.beginPath();
                            ctx.moveTo(x, r);
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
                        ctx.lineTo(x, r2);
                        ctx.stroke();
                    }
                }
            }
            step++;
        }
        ctx.beginPath();
        ctx.moveTo(x, r);
        ctx.lineTo(x, r2);
        txt = n.toString();
        offset = ctx.measureText(txt).width / 2;
        ctx.fillText(txt, x - offset, r3);
        ctx.stroke();
        
    },
    
    rotate: function(ctx, x, pivot, deg) {
        ctx.translate(x, pivot);
        ctx.rotate(degToRad(deg));
        ctx.translate(-x, -pivot);
    },

    changeData: function(jEl, oMsg) {
        if (jEl.length === 0) {
            return;
        }
        $(jEl).attr('title', oMsg.value);
        var oEl = $("canvas.meterCanvas", jEl);
        var cEl = oEl.get(0);
        var typ = vmeter[cEl.vmeter.type];
        var size = typ.size;
        var angle = typ.angle;
        var pivot =  (typ.pointer_pivot !== undefined ? typ.pointer_pivot : typ.orig_height / 2);
        var ctx = cEl.getContext("2d");

        // hand is specified as an image which is placed on the background
        var low = (typeof(typ.low)==='number' ? typ.low : cEl.vmeter.low);
        var high = (typeof(typ.high)==='number' ? typ.high : cEl.vmeter.high);
        if (oMsg.value === undefined) {
            return; // don't display values out of limits
        }
        var max = high - low;
        var value = cEl.vmeter.field ? oMsg[cEl.vmeter.field] : oMsg.value;  // if value derives from a extra datafield instead ov value
        if (cEl.vmeter.function) {
            value = executeFunctionByName(cEl.vmeter.function, window.top, value);  // data needs to be processed by a specioal function
            if (value === undefined) {
                return;     // data is not present
            }
        }
        if (low) {
            // zero suppression
             value = value - low;
        }
        var alpha = (value *  angle / max - (angle / 2));
        if (typ.top_down) {
            alpha = -alpha + 180;
        }
        if (typ.centerangle) {
            // in case the center of the display angle is not at the top of the instrument
            alpha = alpha + typ.centerangle;
        }
        if (typ.pointer_img) {
            var pointerHeight = typ.pointer_imgObj.height;
            if (typ.top_down) {
                var pointerTop = typ.pointer_pivot - pointerHeight;
            } else {
                var pointerTop = pivot - typ.pointer_center;
            }
            var pointerWidth = typ.pointer_imgObj.width;
        } else {
            var pointerTop = typ.pointer_top;
            pointerWidth = typ.pointer_stroke;
        }
        if (typ.type_main) {
            var orig_width = this[typ.type_main].orig_width;
            var orig_height = this[typ.type_main].orig_height;
        } else {
            var orig_width = typ.orig_width;
            var orig_height = typ.orig_height;
        }
        if(typ.center_left) {
            // the horizontal center of the pointer is not in the middle of the instument
            var hCenter = typ.center_left;
        } else {
            // the horizontal center of the pointer is in the middle of the instrument
            var hCenter = orig_width / 2;
        }
        ctx.clearRect(0, 0, orig_width, orig_height);

        var pointerLeft = hCenter - (pointerWidth / 2);
        if (cEl.vmeter.munit) {
            ctx.font = typ.munit_font;
            var txt = cEl.vmeter.munit;
            var offset = ctx.measureText(txt).width / 2;
            ctx.fillText(txt, orig_width / 2 - offset, typ.munit_pos);
        }
        ctx.save();
        ctx.translate(hCenter, pivot);
        ctx.rotate(degToRad(alpha));
        ctx.translate(-hCenter, -pivot);
        if (typ.pointer_img) {
            ctx.drawImage(typ.pointer_imgObj, pointerLeft, pointerTop, pointerWidth, pointerHeight);
        } else {
            ctx.beginPath();
            ctx.lineWidth = typ.pointer_stroke;
            ctx.strokeStyle = typ.pointer_style;
            ctx.moveTo(hCenter, typ.pointer_pivot);
            ctx.lineTo(hCenter, pointerTop);
            ctx.stroke();
        }
        ctx.restore();
    } 
};