/* 
 * Vertical Outdoor Termometer
 * Parameters required in panel definition file
 * - name:          unique panel name
 * - from:          nodeId from where the data is delivered
 * - size:          pixels ¦ 'auto' (horizontal width)
 * - low:           start scale value (my be neagative)
 * - high:          end scale value
 * - height:        display height pixels ¦ auto
 * - js:            javascript file of the meter handler (this file)
 * 
 * -- Parameters for type 'mercury':
 * - mercury_color: the color name or code of the mercury
 * - total_width:   required width of the mercury thermoeter including the description (defaut: automatic)

 * Parameter meanings for the meter configuration;
 * All values are pixel positions within the original corresponding image file
 * - scale_top:      distance from top of the image and the highest scale value
 * - scale_bottom:   distance from top of the image and the lowest scale value
 * - mercury_bottom: distance from top of the image and the beginning of mercury
 * - total_width:    width of the panel element including space for the label
 * - mercury_width:  stroke width of the mercury
 * - bg:             the background image file (image of the meter ev. without scale)
 */

var vermeter = {
    goldcap: {
        type: 'mercury',
        scale_top: 248,
        scale_bottom: 757,
        mercury_bottom: 818,
        mercury_width: 8,
        bg: "/images/therm_outdoor.png"
    },
    bronzecap: {
        type: 'mercury',
        scale_top: 272,
        scale_bottom: 823,
        mercury_bottom: 933,
        mercury_width: 8,
        bg: "/images/therm_outdoor2.png"
    },
    silver: {
        type: 'pointer',
        pointer_type: 'triangle',
        scale_align: 'right',
        scale_top: 82,
        scale_bottom: 553,
        scale_left: 72,
        scale_stroke: 1,
        scale_font: '16px Arial',
        divsize: 29.75,
        subdivsize: 17,
        number_left: 68,            // scale numberts position from left
        number_align: 'right',      // align mode to this position: center, left, right
        pointer_length: 28,
        pointer_stroke: 4,
        unit_center: 74,
        unit_top: 70,
        unit_font: 'bold 25px Arial',
        bg: '/images/vermeter.png'
    },
    gray: {
        type: 'bargraph',
        scale_top: 66,
        scale_bottom: 478,
        scale_align: 'right',
        scale_left: 66,
        scale_stroke: 1,
        scale_color: 'blue',
        scale_font: '20px gill sans',
        divsize: 20,
        subdivsize: 10,
        number_left: 113,            // scale numberts position from left
        number_align: 'right',      // align mode to this position: center, left, right
        pixel_width: 17,
        pixel_height: 6,
        pixel_distance: 1,
        pixel_image: '/images/bargraph_vertical_grey_element_%.png',
        unit_center: 58,
        unit_top: 58,
        unit_font: 'normal 25px gill sans',
        bg: '/images/bargraph_vertical_gray.png'
    },
    black: {
        type: 'bargraph',
        scale_top: 63,
        scale_bottom: 487,
        scale_align: 'left',
        scale_left: 64,
        scale_stroke: 1,
        scale_color: 'white',
        scale_font: '15px Arial',
        divsize: 10,
        subdivsize: 4,
        number_left: 50,            // scale numberts position from left
        number_align: 'right',      // align mode to this position: center, left, right
        pixel_width: 24,
        pixel_height: 8,
        pixel_distance: 1,
        pixel_image: '/images/bargraph_vertical_black_element_%.png',
        unit_center: 76,
        unit_top: 50,
        unit_font: 'normal 25px Arial',
        bg: '/images/bargraph_vertical_black.png'
    },
    
    displayData: function(jGrp, oData, oVal, cb) {
        // in auto mode reserve 20 px for the label
        var type = this[oData.type];
        jGrp.parent().css('text-align', 'center'); // thing
        jGrp.css({   
                    'height': 'calc(100% - 100px)',
                    'display': 'flex',
                    'justify-content': 'space-evenly'
                });
        jGrp.addClass('vermeter');
        oVal.css('width', type.width +'px');
        oVal.prev().remove();  // remove label element
        var oCont = $('<div/>')
                .css({
                    "display": "inline-block",
                    'position': 'relative'
                })
                .appendTo(oVal);
        var img = new Image();
        img.onload = function() {
            vermeter.displayCont(this, oCont, jGrp, oData, oVal, cb);
        };
        img.src = type.bg;
    },
    
    displayCont: function(img, oCont, jGrp, oData, oVal, cb) {
        var type = this[oData.type];
        var height = (oData.height === 'auto' ? jGrp.height() - 40 : oData.height);
        var el = $(img)
                .addClass('vermeter')
                .css({
                    'height': height
                })
                .appendTo(oCont);
        
        //oVal.parent().css('text-align', 'center');
        var scaleData = {
            type: oData.type,
            height: img.height,
            oType: this[oData.type],
            oData: oData
        };
        if (type.pixel_image) {
            scaleData.pixel_image_obj = new Image();
            var url = type.pixel_image.replace('%', oData.pointer_color);
            scaleData.pixel_image_obj.src = url;
        }
        var width = el.width();
        scaleData.width = width;
        scaleData.meterHeight = el.get(0).naturalHeight;
        scaleData.meterWidth = el.get(0).naturalWidth;
        var prop = height / scaleData.meterHeight;
        scaleData.prop = prop;
        if (oData.scale_steps) {
            this.drawVerScale(oData, type, oCont, width, img.height, prop);
        }
        var hsel = $('<canvas/>')
                .addClass('vermeterCanvas')
                .attr('width', width)
                .attr('height', img.height)
                .css({
                    'position': 'absolute',
                    'left': 0,
                    'top': 0
                })
                .prop('scaleData', scaleData)
                .appendTo(oCont);
        var ctx = hsel.get(0).getContext("2d");
        ctx.scale(prop, prop);
        // add a label div below the gauge
        $('<div/>')
                .addClass('tlabel')
                .text(oData.label)
                .css({
                    'text-align': 'center',
                    'font-family': 'gill sans',
                    'font-size': '25px',
                    'color': 'gray',
                    'background-color': '#CFD8C5',
                    'border': '2px inset whitesmoke',
                    'border-radius': '8px'
                })
                .appendTo(oVal);
        if(cb) cb();
    },
    changeData: function(oEl, oMsg) {
        var jEl = $("canvas.vermeterCanvas", oEl);
        var cEl = jEl.get(0);
        var scaleData = cEl.scaleData;
        var ctx = cEl.getContext("2d");
        ctx.clearRect(0, 0, scaleData.meterWidth, scaleData.meterHeight);
        ctx.beginPath();
        var type = scaleData.oType;
        var range = scaleData.oData.high - scaleData.oData.low;
        var value = oMsg.value;
        if (scaleData.oData.function) {
            value = executeFunctionByName(scaleData.oData.function, window.top, value);  // data needs to be processed by a specioal function
            if (value === undefined) {
                return;     // data is not present
            }
        }
        $(oEl).attr('title', value + (scaleData.oData.munit ? scaleData.oData.munit : ''));
        switch (type.type) {
            case 'mercury':
                var vCenter = type.scale_bottom;
                var hCenter = scaleData.meterWidth / 2;
                var top = type.scale_top;
                var bottom = type.mercury_bottom;
                var mercury = vCenter - (value - scaleData.oData.low) * (vCenter-top) / range;
                ctx.lineWidth = type.mercury_width;
                ctx.strokeStyle = scaleData.oData.mcolor;
                ctx.moveTo(hCenter, bottom);
                ctx.lineTo(hCenter, mercury);
                ctx.stroke();
                break;
            
            case 'pointer':
                var x = type.scale_left - type.pointer_length;
                var y = type.scale_bottom  - (value - scaleData.oData.low) * (type.scale_bottom - type.scale_top) / range;
                ctx.lineWidth = type.pointer_stroke;
                ctx.strokeStyle = scaleData.oData.pointer_color;
                if (type.pointer_type === 'triangle') {
                    ctx.fillStyle = scaleData.oData.pointer_color;
                    var plHalf = type.pointer_length * 0.3; 
                    ctx.moveTo(x, y - plHalf);
                    ctx.lineTo(type.scale_left, y);
                    ctx.lineTo(x, y + plHalf);
                    ctx.lineTo(x, y - plHalf);
                    ctx.fill();
                } else {
                    ctx.moveTo(x, y);
                    ctx.lineTo(type.scale_left, y);
                }
                ctx.stroke();
                break;
                
            case 'bargraph':
                var x = (type.scale_align==='right' ? type.scale_left - type.pixel_width : type.scale_left);
                var y = type.scale_bottom - 2 - type.pixel_height / 2;
                var to = type.scale_bottom  - (Math.round(value, 0) + 1 - scaleData.oData.low) * (type.scale_bottom - type.scale_top) / range;
                for (; y >= to; y -= (type.pixel_height + type.pixel_distance)) {
                    ctx.drawImage(scaleData.pixel_image_obj, x, y);
                }
                break;
        }
    },
    drawVerScale: function(oData, type, oCont, width, height, prop) {
        var hsel = $('<canvas/>')
                .addClass('verScaleCanvas')
                .attr('width', width)
                .attr('height', height)
                .css({
                    'position': 'absolute',
                    'left': 0,
                    'top': 0
                })
                .appendTo(oCont);
        var cEl = hsel.get(0);
        // calc the scals factor from original image to the desired image
        var ctx = cEl.getContext("2d");
        ctx.scale(prop, prop);
        ctx.strokeStyle = (type.scale_color ? type.scale_color : '#000000');
        ctx.beginPath();
        ctx.lineWidth = type.scale_stroke;
        var font = type.scale_font;
        ctx.font = font;

        // find the beginning position of the scale
        var x = type.scale_left;
        var y = type.scale_bottom;
        var start_x = x;
        var start_y = y;
        // calc desired scale width
        // calculate the division width
        var divWidth = (type.scale_bottom - type.scale_top) / oData.scale_div;
        // calculate the subdivision width
        var subDivWidth = (divWidth / oData.scale_subdiv);
        var divSize = type.divsize;           // width of the corase divisions
        var subDivSize = type.subdivsize;     // width of the fine divisions
        var divs = oData.scale_div;           // number of dvisions to draw
        var subDivs = oData.scale_subdiv - 1; // number of subdivisions
        for (var div = 0; div < divs; div++) {
            ctx.moveTo(x, y);
            ctx.lineWidth = type.scale_stroke;
            if (type.scale_align === 'right') {
                ctx.lineTo(x+divSize, y);
            } else {
                ctx.lineTo(x-divSize, y);
            }
            y -= subDivWidth;
            for (var subDiv = 0; subDiv < subDivs; subDiv++) {
                ctx.moveTo(x, y);
                if (type.scale_align === 'right') {
                    ctx.lineTo(x+subDivSize, y);
                } else {
                    ctx.lineTo(x-subDivSize, y);
                }
                y -= subDivWidth;
            }
        }
        ctx.stroke();
        // draw the last division
        ctx.moveTo(x, y);
        if (type.scale_align === 'right') {
            ctx.lineTo(x+divSize, y);
        } else {
            ctx.lineTo(x-divSize, y);
        }
        ctx.stroke();
       
        // now write the scale numbers to the scale
        // begin with the lowest value
        var s = oData.low;
        // calculate the value increment between the steps
        var inc = (oData.high - oData.low) / oData.scale_steps;
        var stepWidth = (type.scale_bottom - type.scale_top) / oData.scale_steps;
        x = type.number_left;
        y = start_y + parseInt(ctx.font) * 0.4;
        ctx.fillStyle = type.scale_color;
        for (var steps = 0; steps < oData.scale_steps + 1; steps++) {
            var txt = s.toString();
            // find the left offset to center the text over the division
            var offset = ctx.measureText(txt).width;
            switch (type.number_align) {
                case 'right':
                    ctx.fillText(txt, x - offset, y);
                    break;
                case 'center':
                    ctx.fillText(txt, x - offset / 2, y);
                    break;
                case 'left':
                    ctx.fillText(txt, x, y);
                    break;
            }
            
            y -= stepWidth;
            s += inc;
        }
        ctx.font = type.unit_font;
        var txLength = ctx.measureText(oData.munit);
        ctx.fillText(oData.munit, type.unit_center - txLength.width / 2, type.unit_top);
    }
};
