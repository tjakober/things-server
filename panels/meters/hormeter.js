/* 
 * Horizontal mounted flat meter
 * Parameters required in panel definition file
 * - name:          unique panel name
 * - from:          nodeId from where the data is delivered
 * - size:          pixels ¦ 'auto' (horizontal width)
 * - low:           start scale value (my be neagative)
 * - high:          end scale value
 * - scale_steps:   steps to be indicated by a number value   0      10      20
 * - scale_subdiv:  fine scale divisions                      |||||||||||||||||
 * - scale_div:     corase scale divisions                    |   |   |   |   |
 * - munit:         meter unit text e.g. V, A, W, %
 * - pointer_color: color of the movable hand
 * - js:            javascript file of the meter handler
 * 
 * Parameter meanings for the meter configuration;
 * All values are pixel positions within the original corresponding image file
 * - start_at:      horizontal beginning of scale
 * - end_at:        horizontal end of scale
 * - vcenter:       vertical center, resp. vertical beginning of dividions
 * - pointer-top:   top beginning of the pointer
 * - pointer_bottom:bottom end of the pointer
 */

var hormeter = {
    silver: {
        type: 'pointer',
        start_at: 77,
        end_at: 548,
        pointer_top: 48,
        pointer_bottom: 98,
        pointer_stroke: 4,
        pointer_triangle_factor: 0.15,
        scale_pos: 77,
        divsize: 29.75,
        subdivsize: 17,
        number_bottom: 71,
        number_font: '25px Arial',
        unit_left: 560,
        unit_bottom: 105,
        unit_font: 'bold 25px Arial',
        bg: "/images/hormeter.png"
    },
    black: {
        type: 'pointer',
        start_at: 60,
        end_at: 397,
        pointer_top: 48,
        pointer_bottom: 80,
        pointer_stroke: 4,
        pointer_triangle_factor: 0.2,
        scale_pos: 73,
        divsize: 20,
        subdivsize: 10,
        number_bottom: 68,
        number_font: '15px Arial',
        unit_left: 400,
        unit_bottom: 88,
        unit_font: 'bold 15px Arial',
        bg: "/images/hormeter_black.png"
    },
    bargraph_black: {
        type: 'bargraph',
        start_at: 47,
        end_at: 439,
        scale_color: '#ffffff',
        scale_pos: 50,
        scale_direction: 'up',
        divsize: 10,
        subdivsize: 4,
        number_font: '15px Arial',
        number_bottom: 35,
        pixel_top: 52,
        pixel_width: 6,
        pixel_height: 23,
        pixel_distance: 2,
        pixel_image: '/images/bargraph_horizontal_black_element_green.png',
        unit_left: 142,
        unit_bottom: 100,
        unit_font: 'bold 20px Arial',
        bg: '/images/bargraph_horizontal_black.png'  
    },
    /*
     * Create the required html elements on the panel
     */
    displayData: function(grp, oData, oVal, cb) {
        // first load the image for the meter
        var img = new Image();
        img.onload = function() {
            hormeter.displayCont(this, grp, oData, oVal);
        };
        img.src = this[oData.type].bg;
    },
    displayCont: function(img, grp, oData, oVal, cb) {
        var width = (oData.size === 'auto' ? grp.width() : oData.size);
        var height = (oData.height === 'auto' ? grp.height() : oData.height);
        var el = $(img)
                .addClass('hormeter')
                .css({
                    'width': width,
                    'position': 'relative'
                })
                .appendTo(oVal);
        var type = hormeter[oData.type];
        // then the canvas for the scale
        var height = el.height();
        var width = el.width();
        var hsel = $('<canvas>')
                .addClass('hormeterCanvas')
                .attr('width', width)
                .attr('height', height)
                .css({
                    'position': 'absolute',
                    'top': '10px',
                    'left': '10px'
                })
                .appendTo(oVal);
        var nWidth = el.get(0).naturalWidth;
        var prop = width / nWidth;
        var oSel = hsel.get(0);
        var ctx = oSel.getContext('2d');
        ctx.scale(prop, prop);
        var scaleWidth = (type.end_at - type.start_at);
        var scaleData = {
            type: type,
            function: oData.function,
            origWidth: nWidth,
            origHeight: el.get(0).naturalHeight,
            prop: prop,
            scaleWidth: scaleWidth,
            low: oData.low,
            high: oData.high,
            pointer_color: oData.pointer_color,
            pointer_type: oData.pointer_type,
            munit: oData.munit
        };
        if (type.pixel_image) {
            scaleData.pixel_image_obj = new Image();
            scaleData.pixel_image_obj.src = type.pixel_image;
        }

        // store the data on the panel's data element to use when data is changed
        hsel.parent().prop('scaleData', scaleData);    // save that stuff for the pointer
        // now draw the scale onto the canvas
        hormeter.drawHorScale(hsel, oData, type);
        // create the canvas for the pointer
        var ptr = $('<canvas>')
                .addClass('horpointerCanvas')
                .attr('width', width)
                .attr('height', height)
                .css({
                    'position': 'absolute',
                    'top': '10px',
                    'left': '10px'
                })
                .appendTo(oVal);
        var ctx1 = ptr.get(0).getContext('2d');
        ctx1.scale(prop, prop);
        if (cb) cb();
    },
    drawHorScale: function(hsel, oData, type) {
        var cEl = hsel.get(0);
        // calc the scals factor from original image to the desired image
        var ctx = cEl.getContext("2d");
        ctx.beginPath();
        // find the beginning position of the scale
        var scaleData = hsel.parent().prop('scaleData');
        ctx.strokeStyle = (type.scale_color ? type.scale_color : '#000000');
        ctx.lineWidth = 1;
        var x = type.start_at;
        var y = type.scale_pos;
        var start_x = x;
        var start_y = y;
        // calc desired scale width
        // calculate the division widht
        var divWidth = scaleData.scaleWidth / (oData.scale_div);
        // calculate the subdivision width
        var dir = (type.scale_direction ? type.scale_direction : 'down');
        var subDivWidth = (divWidth / oData.scale_subdiv);
        var divSize = type.divsize;      // height of th corase divisions
        var subDivSize = type.subdivsize;   // height of the fine divisions
        if (dir === 'up') {
            divSize = divSize * -1;
            subDivSize = subDivSize * -1;
        }
        var divs = oData.scale_div; // number of dvisions to draw
        var subDivs = oData.scale_subdiv - 1; // number of subdivisions
        for (var div = 0; div < divs; div++) {
            ctx.moveTo(x, y);
            ctx.lineTo(x, y+divSize);
            x += subDivWidth;
            for (var subDiv = 0; subDiv < subDivs; subDiv++) {
                ctx.moveTo(x, y);
                ctx.lineTo(x, y+subDivSize);
                x += subDivWidth;
            }
        }
        // draw the last division
        ctx.moveTo(x, y);
        ctx.lineTo(x, y+divSize);
        
        // now write the scale numbers to the scale
        ctx.font = type.number_font;
        ctx.fillStyle = type.scale_color;
        // begin with the lowest value
        var s = oData.low;
        // calculate the value increment between the steps
        var inc = (oData.high - oData.low) / oData.scale_steps;
        var stepWidth = scaleData.scaleWidth / oData.scale_steps;
        x = start_x;
        y = type.number_bottom;
        for (var steps = 0; steps < oData.scale_steps + 1; steps++) {
            var txt = s.toString();
            // find the left offset to center the text over the division
            var offset = ctx.measureText(txt).width / 2;
            ctx.fillText(txt, x - offset, y);
            x += stepWidth;
            s += inc;
        }
        ctx.stroke();
        ctx.font = type.unit_font;
        ctx.fillText(oData.munit, type.unit_left, type.unit_bottom);
    },
     /*
      * function to move the pointer according the value in the message
      */
    changeData: function(oEl, oMsg) {
        // find the canvas for the pointer
        var hsel = $(".horpointerCanvas", oEl);
        var cEl = hsel.get(0);
        var ctx = cEl.getContext("2d");
        // get the scaledata properties stored on the panel
        var scaleData = hsel.parent().prop('scaleData');
        var type = scaleData.type;
        oEl.title = oMsg.value + scaleData.munit;
        var range = scaleData.high - scaleData.low;
        // erase previous pointer
        ctx.clearRect(0, 0, scaleData.origWidth, scaleData.origHeight);
        ctx.beginPath();
        // set the pointer style
        var value = oMsg.value;
        if (scaleData.function) {
            value = executeFunctionByName(scaleData.function, window.top, value);  // data needs to be processed by a specioal function
            if (value === undefined) {
                return;     // data is not present
            }
        }

        switch (type.type) {
            case 'pointer':
                ctx.strokeStyle = scaleData.pointer_color;
                ctx.lineWidth = type.pointer_stroke;
                // calculate the position of the pointer within the scale
              //var pPosx = scaleData.x + ((oMsg.value - scaleData.low) / scaleData.high * scaleData.scaleWidth);
                var pPosx = type.start_at + (value - scaleData.low) * scaleData.scaleWidth / range;
                // draw the current pointer
                if (scaleData.pointer_type === 'triangle') {
                    var plHalf = (type.pointer_bottom - type.pointer_top) * type.pointer_triangle_factor;
                    ctx.fillStyle = scaleData.pointer_color;
                    ctx.moveTo(pPosx + plHalf, type.pointer_top);
                    ctx.lineTo(pPosx, type.pointer_bottom);
                    ctx.lineTo(pPosx - plHalf, type.pointer_top);
                    ctx.lineTo(pPosx + plHalf, type.pointer_top);
                    ctx.fill();
                } else {
                    ctx.moveTo(pPosx, type.pointer_top);
                    ctx.lineTo(pPosx, type.pointer_bottom);
                }
                ctx.stroke();
                break;
                
            case 'bargraph':
                var x = type.start_at - type.pixel_width / 2;
                var y = type.pixel_top;
                var to = x  - (value - scaleData.low) * (x - type.end_at) / range;
                for (; x < to; x += (type.pixel_width + type.pixel_distance)) {
                    ctx.drawImage(scaleData.pixel_image_obj, x, y);
                }
                break;
        }    
    }
};



