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

 * Parameter meanings for the meter configuration;
 * All values are pixel positions within the original corresponding image file
 * - top:           distance from top of the image and the highest scale value
 * - center:        distance from top of the image and the lowest scale value
 * - bottom:        distance from top of the image and the beginning of mercury
 * - width:         width of the panel element including space for the label
 * - mwidth:        stroke width of the mercury
 * - glass:         the glass image file
 */

var tmeter = {
    goldcap: {
        top: 248,
        center: 757,
        bottom: 818,
        width:  80,
        mwidth: 8,
        glass: "/images/therm_outdoor.png"
    },
    bronzecap: {
        top: 272,
        center: 823,
        bottom: 933,
        width: 80,
        mwidth: 8,
        glass: "/images/therm_outdoor2.png"
    },
    
    displayData: function(jGrp, oData, oVal, cb) {
        // in auto mode reserve 20 px for the label
        jGrp.parent().css('text-align', 'center'); // thing
        jGrp.css({   
                    'height':'calc(100% - 100px)',
                    'display': 'flex',
                    'justify-content': 'space-evenly'
                });
        jGrp.addClass('tmeter');
        oVal.css('width', this[oData.type].width +'px');
        oVal.prev().remove();  // remove label element
        var height = (oData.height === 'auto' ? oVal.parent().height() - 30 : oData.height);
        var oCont = $('<div/>')
                .css({
                    "display": "inline-block",
                    'position': 'relative'
                })
                .appendTo(oVal);
        var el = $('<img/>')
                .attr('src', this[oData.type].glass)
                .addClass('thermometer')
                .css({
                    'height': height
                })
                .appendTo(oCont);
        //oVal.parent().css('text-align', 'center');
        var scaleData = {
            type: oData.type,
            high: oData.high,
            low: oData.low,
            center: this[oData.type].center,
            top: this[oData.type].top,
            bottom: this[oData.type].bottom,
            height: height,
            mwidth: this[oData.type].mwidth,
            mcolor: oData.mcolor
        };
        el.get(0).onload = function() {
            var width = el.width();
            scaleData.width = width;
            scaleData.meterHeight = el.get(0).naturalHeight;
            scaleData.meterWidth = el.get(0).naturalWidth;
            var hsel = $('<canvas/>')
                    .addClass('thermoCanvas')
                    .attr('width', width)
                    .attr('height', height)
                    .css({
                        'position': 'absolute',
                        'left': 0,
                        'top': 0
                    })
                    .prop('tmeter', scaleData)
                    .appendTo(oCont);
            $('<div/>')
                    .addClass('tlabel')
                    .text(oData.label)
                    .css('text-align', 'center')
                    .appendTo(oVal);
        };
        if (cb) cb();
    },
    changeData: function(oEl, oMsg) {
        $(oEl).attr('title', oMsg.value);
        var jEl = $("canvas.thermoCanvas", oEl);
        var cEl = jEl.get(0);
        var tmeter = cEl.tmeter;
        var prop = tmeter.height / tmeter.meterHeight;
        var vCenter = tmeter.center * prop;
        var hCenter = tmeter.meterWidth / 2 * prop;
        var range = tmeter.high - tmeter.low;
        var top = tmeter.top * prop;
        var bottom = tmeter.bottom * prop;
        var mercury = vCenter - (oMsg.value-tmeter.low) * (vCenter-top) / range;
        var ctx = cEl.getContext("2d");
        ctx.clearRect(0, 0, cEl.width, cEl.height);
        ctx.beginPath();
        ctx.lineWidth = tmeter.mwidth * prop;
        ctx.strokeStyle = tmeter.mcolor;
        ctx.moveTo(hCenter, bottom);
        ctx.lineTo(hCenter, mercury);
        ctx.stroke();
    }
};


