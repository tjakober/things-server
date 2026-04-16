/* 
 * Dials to enter a number value using the mouse-wheel
 * Parameters required in panel definition file
 * - name:          unique panel name
 * - to:            nodeId to where the data is sent
 * - size:          pixels ¦ 'auto' (horizontal width)
 * - start:         lowest number to be sent
 * - end:           highest number to be sent
 * - step:          incremental steps
 * - js:            dial.js (this file)
 * - type:          dial type
 * 
 */
/* global Promise, ZingTouch, panel, ws */

var dials = {
    brass_dial: {
        type: 'wheel',
        start: 0,
        end: 180,
        angle: 180,
        readpoint: 280,
        center_v: 224,
        size:   423,
        bg: "",
        dial: "/images/brassdial180.png",
        pointer: "/images/brassdial180_pointers.png"
    },
    bakelite_0_180: {
        type: 'wheel',
        start: 0,
        end: 180,
        angle: 180,
        readpoint: 0,
        center_v: 630,
        size:   1260,
        bg: "",
        dial: "/images/bakelite0-180.png",
        pointer: ""
    },
    aludial_0_100: {
        type: 'wheel',
        start: 0,
        end: 100,
        angle: 180,
        readpoint: 0,
        center_v: 424,
        size:   582,
        bg: "/images/aludial0-100_bg.png",
        dial: "/images/aludial0-100.png",
        pointer: ""
    },    
    loadImg: function(typ, img) {
        return new Promise(function(resolve, reject) {
            if (typ[img] === '') {
                return resolve(img);
            }
            typ[img+'Img'] = new Image();
            var imgObj = typ[img+'Img'];
            imgObj.onload = function() {
                resolve(img);
            };
            imgObj.onerror = function() {
                reject(img);
            };
            imgObj.src = typ[img];
        });
    },
    
    displayData: function(grp, oData, oVal) {
        var typ = this[oData.type];
        typ.oData = oData;
        return Promise.all([this.loadImg(typ, 'bg'), this.loadImg(typ, 'dial'), this.loadImg(typ, 'pointer')])
            .then(function(){
                dials.displayCont(typ, grp, oData, oVal);
            })
            .catch(function(img) {
                console.log('image file not found: '+typ[img]);
            });
    },
    
    displayCont: function(typ, grp, oData, oVal) {
        oVal.height(oVal.parent().parent().parent().height()-100);
        var width = (oData.size === 'auto' ? $('.data', grp).width() : oData.size);
        var height = (oData.size === 'auto' ? $('.data', grp).height() : oData.size);
        if (typ.bg !== '') {
            typ.prop = height / typ.bgImg.naturalHeight * 0.9;
        } else if (typ.pointer !== '') {
            typ.prop = height / typ.pointerImg.naturalHeight * 0.9;
        } else {
            typ.prop = height / typ.dialImg.naturalHeight * 0.9;
        }
        
        var hselTop = 0;
        var ptrTop = 0;
        $('.data', grp).css('position', 'relative');
        typ.step = typ.angle / (typ.end - typ.start);
        typ.n = parseInt(oData.value) * typ.step;
        if (typ.bg !== '') {
            ptrTop = 0;
            var oBg = $(typ.bgImg)
                    .addClass('dialbg')
                    .css({
                        'width': typ.bgImg.width * typ.prop,
                        'height': typ.bgImg.height * typ.prop,
                        'left': (width - typ.bgImg.width * typ.prop) / 2,
                        'top':  ptrTop,
                        'position': 'absolute',
                        'z-index': 0
                    })
                    .appendTo(oVal);
            hselTop = (typ.center_v - typ.dialImg.height / 2) * typ.prop;
        } else if (typ.pointer !== '') {
            ptrTop = (height - typ.pointerImg.height * typ.prop) / 2;
            var oPointer = $(typ.pointerImg)
                    .addClass('dialptr')
                    .css({
                        'width': typ.pointerImg.width * typ.prop,
                        'height': typ.pointerImg.height * typ.prop,
                        'left': (width - typ.pointerImg.width * typ.prop) / 2,
                        'top':  ptrTop,
                        'position': 'absolute',
                        'z-index': 10
                    })
                    .appendTo(oVal);
            hselTop = (typ.center_v * typ.prop - typ.dialImg.height / 2 * typ.prop) + ptrTop;
        } else {
            ptrTop = 0;
            hselTop = (height - typ.dialImg.height * typ.prop) / 2;
        }
        var hsel = $('<canvas>')
                .addClass('dialCanvas')
                .attr('width', typ.dialImg.width * typ.prop+'px')
                .attr('height', typ.dialImg.height * typ.prop+'px')
                .css({
                    'position': 'absolute',
                    'top':  hselTop,
                    'left': ((width - typ.dialImg.naturalWidth * typ.prop) / 2),
                    'z-index': 5
                })
                .appendTo(oVal);
        var canv = hsel.get(0);
        canv.typ = typ;
        var ctx = hsel.get(0).getContext('2d');
        
        ctx.drawImage(typ.dialImg, 0, 0, typ.dialImg.width * typ.prop, typ.dialImg.width * typ.prop);
        
        canv.parentElement.addEventListener("wheel", (e) => {
            var dir = Math.sign(e.deltaY);
            this.turn(oData, canv, dir, true);
        });
	
        var region = new ZingTouch.Region(grp.get(0));
        //var region = new ZingTouch.Region(document.body);
        //var rt = new ZingTouch.Rotate();
        var targetEl = canv;
        region.bind(targetEl, 'rotate', (e) => {
            //console.log('Rotate gesture emitted: ' + e.detail.angle, e.detail.distanceFromOrigin, e.detail.distanceFromLast);
            var dir = Math.sign(e.detail.distanceFromLast);
            this.turn(oData, canv, dir, true);
        });
    
    },
        
    turn: function(oData, canv, dir, sendit) {
        if (typeof oData.value !== 'Number') oData.value = Number(oData.value);
        if (oData.value > canv.typ.end || oData.value < canv.typ.start || isNaN(oData.value)) oData.value = 0;
        canv.typ.n = oData.value * canv.typ.step;
        //console.log(n);
        if (typeof(dir) !== 'undefined') {
            if (dir > 0) {
                if (canv.typ.n < canv.typ.angle) {
                    canv.typ.n++;
                }
            } else if (dir < 0) {
                if (canv.typ.n > 0) {
                    canv.typ.n--;
                }
            }
        }
        oData.value = (canv.typ.n / canv.typ.step).toString();
        var ctx = canv.getContext('2d');
        var center = canv.width / 2;
        ctx.clearRect(0, 0, canv.width, canv.width);
        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(degToRad(canv.typ.n));
        ctx.drawImage(canv.typ.dialImg, -center, -center, canv.width, canv.width);
        ctx.restore();
        if (sendit) {
            this.deferSend(oData);
        }
    },
    
    tmr: false,
    deferSend: function(oData) {
        if (this.tmr !== false) {
            window.clearTimeout(this.tmr);
        }
        this.tmr = window.setTimeout((oData) => {
            this.send(oData);
            this.tmr = false;
        }, 500, oData);
    },
    
    send: function(oData) {
        var msg = {
            cmd: 'set',
            type: 'control',
            from: panel.uuId,
            to: oData.from,
            services: [
                {
                    name: oData.name,
                    value: oData.value
                }
            ]
        };
        ws.send(msg);
        
    },
    
    changeData: function(oEl, oMsg) {
        var hsel = $(".dialCanvas", oEl);
        this.turn({value: oMsg.value}, hsel.get(0));
    }
};


