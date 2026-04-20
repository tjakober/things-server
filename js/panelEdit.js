/*
 *  Panel Editor module
 *  Provides a graphical configuration UI for panel JSON files.
 *  Lifecycle: init(el) once at startup, enable() after panels load, renew() on tab show.
 */

var panelEdit = {
    _tabIdx: -1,
    _current: null,   // panel object being edited
    _panelName: '',   // current filename (without .json)
    _nodes: [],       // [{nodeId, name, description, services:[...]}] from websocket

    init: function(el) {
        panelEdit._tabIdx = menu.tabs.findIndex(function(t) { return t.dest === 'panelEdit'; });
        var cont = $('#m_panelEdit').addClass('pe-container');

        var sb = $('<div class="pe-sidebar"/>').appendTo(cont);
        $('<div class="pe-sidebar-title">Panels</div>').appendTo(sb);
        $('<button class="pe-btn pe-btn-new">+ New Panel</button>')
            .click(panelEdit._newPanel).appendTo(sb);
        $('<div class="pe-panel-list" id="pe-list"/>').appendTo(sb);

        $('<div class="pe-main" id="pe-main"/>').appendTo(cont);
    },

    enable: function() {
        $('ul#menu li').eq(panelEdit._tabIdx).removeClass('tab-disabled');
    },

    renew: function() {
        panelEdit._loadPanelList();
        panelEdit._loadNodes();
        if (panelEdit._current) panelEdit._renderEditor();
    },

    allowEdit: function() {},   // stub referenced by panel.js activity indicator

    // ── Panel list ────────────────────────────────────────────────────────────

    _loadPanelList: function() {
        $.post('panel', {cmd: 'panelList'}, function(s) {
            var list = $('#pe-list').empty();
            var names = s.split(',')
                .filter(function(f) { return f.slice(-5) === '.json'; })
                .map(function(f) { return f.slice(0, -5); });
            names.sort();
            names.forEach(function(n) {
                $('<div class="pe-panel-item"/>').text(n)
                    .toggleClass('pe-active', n === panelEdit._panelName)
                    .click(function() { panelEdit._selectPanel(n); })
                    .appendTo(list);
            });
        });
    },

    _selectPanel: function(name) {
        panelEdit._panelName = name;
        $('#pe-list .pe-panel-item').each(function() {
            $(this).toggleClass('pe-active', $(this).text() === name);
        });
        $.post('panel', {cmd: 'loadThing', fn: name}, function(data) {
            panelEdit._current = data;
            panelEdit._renderEditor();
        });
    },

    _newPanel: function() {
        panelEdit._panelName = '';
        panelEdit._current = {
            name: 'New Panel', filename: 'new_panel',
            size: {rows: 6, cols: 6}, pos: {left: 0, top: 0},
            css: '', groups: []
        };
        $('#pe-list .pe-panel-item').removeClass('pe-active');
        panelEdit._renderEditor();
    },

    // ── Rendering ─────────────────────────────────────────────────────────────

    _renderEditor: function() {
        var main = $('#pe-main').empty();
        var p = panelEdit._current;
        if (!p) return;

        // Panel header section
        var hSec = $('<div class="pe-section"/>').appendTo(main);
        $('<div class="pe-section-title"><span>Panel</span></div>').appendTo(hSec);
        var hf = $('<div class="pe-fields"/>').appendTo(hSec);
        panelEdit._inp(hf, 'Name',     'text',   p.name,      'ph-name');
        panelEdit._inp(hf, 'Filename', 'text',   p.filename,  'ph-filename');
        panelEdit._inp(hf, 'Rows',     'number', p.size.rows, 'ph-rows');
        panelEdit._inp(hf, 'Cols',     'number', p.size.cols, 'ph-cols');
        panelEdit._inp(hf, 'Pos left', 'number', p.pos.left,  'ph-left');
        panelEdit._inp(hf, 'Pos top',  'number', p.pos.top,   'ph-top');
        panelEdit._inp(hf, 'CSS file', 'text',   p.css||'',   'ph-css', true);

        // Groups section
        var gSec = $('<div class="pe-section"/>').appendTo(main);
        var gHdr = $('<div class="pe-groups-header"/>').appendTo(gSec);
        $('<span>Groups</span>').appendTo(gHdr);
        var gList = $('<div class="pe-group-list"/>');
        $('<button class="pe-btn pe-btn-add">+ Add Group</button>').click(function() {
            p.groups.push({name: 'New Group', data: []});
            panelEdit._renderGroups(gList, p.groups);
        }).appendTo(gHdr);
        gList.appendTo(gSec);
        panelEdit._renderGroups(gList, p.groups);

        // Actions bar
        var act = $('<div class="pe-actions"/>').appendTo(main);
        $('<button class="pe-btn pe-btn-save">Save</button>')
            .click(panelEdit._savePanel).appendTo(act);
        if (panelEdit._panelName) {
            $('<button class="pe-btn pe-btn-del-panel">Delete Panel</button>')
                .click(panelEdit._deletePanel).appendTo(act);
        }
        $('<span class="pe-status" id="pe-status"/>').appendTo(act);
    },

    _renderGroups: function(container, groups) {
        container.empty();
        groups.forEach(function(g, gi) {
            panelEdit._renderGroup(container, groups, gi, g);
        });
    },

    _renderGroup: function(container, groups, gi, g) {
        var grp = $('<div class="pe-group"/>').appendTo(container);
        var hdr = $('<div class="pe-group-hdr"/>').appendTo(grp);
        var tog = $('<span class="pe-toggle">▼</span>').appendTo(hdr);
        $('<span class="pe-group-label"/>').text(g.name || 'Group '+(gi+1)).appendTo(hdr);
        var ctrls = $('<div class="pe-group-ctrls"/>').appendTo(hdr);

        panelEdit._moveBtn(ctrls, '↑', function() {
            if (gi === 0) return;
            groups.splice(gi-1, 0, groups.splice(gi, 1)[0]);
            panelEdit._renderGroups(container, groups);
        });
        panelEdit._moveBtn(ctrls, '↓', function() {
            if (gi >= groups.length-1) return;
            groups.splice(gi+1, 0, groups.splice(gi, 1)[0]);
            panelEdit._renderGroups(container, groups);
        });
        panelEdit._rmBtn(ctrls, function() {
            if (!confirm('Delete group "'+g.name+'"?')) return;
            groups.splice(gi, 1);
            panelEdit._renderGroups(container, groups);
        });

        var body = $('<div class="pe-group-body"/>').appendTo(grp);
        tog.click(function() {
            var open = body.is(':visible');
            tog.text(open ? '▶' : '▼');
            body.toggle(!open);
        });

        // Group header fields
        var gf = $('<div class="pe-group-fields pe-fields"/>').appendTo(body);
        panelEdit._inp(gf, 'Name', 'text',   g.name||'',
            'g'+gi+'-name');
        panelEdit._inp(gf, 'Rows', 'number', g.size ? (g.size.rows !== undefined ? g.size.rows : '') : '',
            'g'+gi+'-rows', true);
        panelEdit._inp(gf, 'Cols', 'number', g.size ? (g.size.cols !== undefined ? g.size.cols : '') : '',
            'g'+gi+'-cols', true);
        panelEdit._inp(gf, 'Top',  'number', g.pos  ? (g.pos.top   !== undefined ? g.pos.top   : '') : '',
            'g'+gi+'-top',  true);
        panelEdit._inp(gf, 'Left', 'number', g.pos  ? (g.pos.left  !== undefined ? g.pos.left  : '') : '',
            'g'+gi+'-left', true);

        // Data elements
        var dHdr = $('<div class="pe-data-header-row"/>').appendTo(body);
        $('<span>Data Elements</span>').appendTo(dHdr);
        var dList = $('<div/>').appendTo(body);
        $('<button class="pe-btn pe-btn-add pe-btn-sm">+ Add</button>').click(function() {
            g.data = g.data || [];
            g.data.push({sq: g.data.length+1, label:'', name:'', from:'', value:'', unit:'', format:'n3_1'});
            panelEdit._renderDataList(dList, gi, g);
        }).appendTo(dHdr);
        panelEdit._renderDataList(dList, gi, g);
    },

    _renderDataList: function(container, gi, g) {
        container.empty();
        if (!g.data) return;
        g.data.forEach(function(d, di) {
            panelEdit._renderDataElem(container, gi, di, d, g);
        });
    },

    _renderDataElem: function(container, gi, di, d, g) {
        var ek = 'g'+gi+'d'+di;
        var info = d.js ? (d.js + (d.type ? ' / '+d.type : '')) : ('fmt: '+(d.format||'?'));

        var elem = $('<div class="pe-elem"/>').appendTo(container);
        var ehdr = $('<div class="pe-elem-hdr"/>').appendTo(elem);
        var etog = $('<span class="pe-toggle">▼</span>').appendTo(ehdr);
        $('<span class="pe-elem-info"/>').text(
            '#'+(di+1)+' '+(d.label||d.name||'')+' ('+info+')'
        ).appendTo(ehdr);
        var ec = $('<div class="pe-elem-ctrls"/>').appendTo(ehdr);

        panelEdit._moveBtn(ec, '↑', function() {
            if (di === 0) return;
            g.data.splice(di-1, 0, g.data.splice(di, 1)[0]);
            panelEdit._renderDataList(container, gi, g);
        });
        panelEdit._moveBtn(ec, '↓', function() {
            if (di >= g.data.length-1) return;
            g.data.splice(di+1, 0, g.data.splice(di, 1)[0]);
            panelEdit._renderDataList(container, gi, g);
        });
        panelEdit._rmBtn(ec, function() {
            if (!confirm('Delete element "'+(d.label||d.name||'#'+(di+1))+'"?')) return;
            g.data.splice(di, 1);
            panelEdit._renderDataList(container, gi, g);
        });

        var ebody = $('<div class="pe-elem-body"/>').appendTo(elem);
        etog.click(function() {
            var open = ebody.is(':visible');
            etog.text(open ? '▶' : '▼');
            ebody.toggle(!open);
        });

        // Module selector
        var mrow = $('<div class="pe-field-row" style="padding:3px 0 5px;border-bottom:1px solid #eee;margin-bottom:4px"/>').appendTo(ebody);
        $('<div class="pe-label">Module</div>').appendTo(mrow);
        var msel = $('<select class="pe-select"/>').attr('data-key', ek+'-js').appendTo(mrow);
        $('<option value="">Standard</option>').appendTo(msel);
        ['vmeter.js','hormeter.js','vermeter.js','tmeter.js','clock.js','sunpos.js','dials.js'].forEach(function(m) {
            $('<option/>').val(m).text(m).appendTo(msel);
        });
        msel.val(d.js || '');

        var typeArea = $('<div class="pe-fields"/>').appendTo(ebody);
        panelEdit._renderTypeFields(typeArea, ek, d);

        msel.change(function() {
            var jsVal = $(this).val();
            if (!jsVal) {
                delete d.js; delete d.type; delete d.size;
                delete d.low; delete d.high;
                delete d.scale_steps; delete d.scale_div; delete d.scale_subdiv;
                delete d.munit; delete d.cover; delete d.pointer_color;
                delete d.lat; delete d.lon;
                if (!d.format) d.format = 'n3_1';
            } else {
                d.js = jsVal;
                delete d.format; delete d.field; delete d.formula;
                if (!d.size) d.size = 'auto';
            }
            panelEdit._renderTypeFields(typeArea, ek, d);
        });
    },

    _renderTypeFields: function(container, ek, d) {
        container.empty();
        if (!d.js) {
            panelEdit._inp(container, 'Label', 'text', d.label||'', ek+'-label');
            var fromEl = panelEdit._fromSel(container, ek+'-from', d.from||'');
            var nameCont = $('<div/>').appendTo(container);
            panelEdit._refreshNameSel(nameCont, ek+'-name', d.from||'', d.name||'');
            fromEl.on('change', function() {
                panelEdit._refreshNameSel(nameCont, ek+'-name', $(this).val(), '');
            });
            panelEdit._inp(container, 'Value',   'text', d.value !== undefined ? String(d.value) : '', ek+'-value',   true);
            panelEdit._inp(container, 'Unit',    'text', d.unit||'',    ek+'-unit',    true);
            panelEdit._inp(container, 'Field',   'text', d.field||'',   ek+'-field',   true);
            panelEdit._inp(container, 'Formula', 'text', d.formula||'', ek+'-formula', true);
            panelEdit._fmtRow(container, ek, d.format || 'n3_1');
        } else {
            var js = d.js;
            if (js !== 'clock.js') {
                if (js === 'sunpos.js') {
                    panelEdit._inp(container, 'Name (location)', 'text', d.name||'', ek+'-name');
                    panelEdit._inp(container, 'Latitude',  'text', d.lat  !== undefined ? String(d.lat)  : '', ek+'-lat');
                    panelEdit._inp(container, 'Longitude', 'text', d.lon  !== undefined ? String(d.lon)  : '', ek+'-lon');
                } else {
                    var fromEl = panelEdit._fromSel(container, ek+'-from', d.from||'');
                    var nameCont = $('<div/>').appendTo(container);
                    panelEdit._refreshNameSel(nameCont, ek+'-name', d.from||'', d.name||'');
                    fromEl.on('change', function() {
                        panelEdit._refreshNameSel(nameCont, ek+'-name', $(this).val(), '');
                    });
                    panelEdit._inp(container, 'Value', 'text', d.value !== undefined ? String(d.value) : '', ek+'-value', true);
                }
            }
            panelEdit._inp(container, 'Instrument type', 'text', d.type||'', ek+'-type');
            panelEdit._sizeRow(container, ek, d.size);

            if (js === 'vmeter.js' || js === 'hormeter.js' || js === 'vermeter.js') {
                panelEdit._inp(container, 'Low',          'number', d.low          !== undefined ? d.low          : '', ek+'-low');
                panelEdit._inp(container, 'High',         'number', d.high         !== undefined ? d.high         : '', ek+'-high');
                panelEdit._inp(container, 'Scale steps',  'number', d.scale_steps  !== undefined ? d.scale_steps  : '', ek+'-scale_steps',  true);
                panelEdit._inp(container, 'Scale div',    'number', d.scale_div    !== undefined ? d.scale_div    : '', ek+'-scale_div',    true);
                panelEdit._inp(container, 'Scale subdiv', 'number', d.scale_subdiv !== undefined ? d.scale_subdiv : '', ek+'-scale_subdiv', true);
                panelEdit._inp(container, 'Unit (munit)', 'text',   d.munit||'',                                        ek+'-munit');
                panelEdit._inp(container, 'Cover',        'number', d.cover        !== undefined ? d.cover        : '', ek+'-cover',        true);
                panelEdit._inp(container, 'Pointer color','text',   d.pointer_color||'',                                ek+'-pointer_color', true);
            }
            if (js === 'dials.js') {
                panelEdit._inp(container, 'Unit (munit)', 'text', d.munit||'',         ek+'-munit');
                panelEdit._inp(container, 'Pointer color','text', d.pointer_color||'', ek+'-pointer_color', true);
            }
        }
    },

    _sizeRow: function(container, ek, sizeVal) {
        var row = $('<div class="pe-field-row"/>').appendTo(container);
        $('<div class="pe-label">Size</div>').appendTo(row);
        var sel = $('<select class="pe-select"/>').attr('data-key', ek+'-size-mode').appendTo(row);
        $('<option value="auto">auto</option>').appendTo(sel);
        $('<option value="px">pixels</option>').appendTo(sel);
        var inp = $('<input class="pe-num-small" type="number" min="50" max="2000"/>')
            .attr('data-key', ek+'-size-px').appendTo(row);
        var isAuto = !sizeVal || sizeVal === 'auto';
        sel.val(isAuto ? 'auto' : 'px');
        if (isAuto) { inp.hide(); } else { inp.val(sizeVal); }
        sel.change(function() { inp.toggle($(this).val() === 'px'); });
    },

    _loadNodes: function() {
        if (typeof ws === 'undefined' || !ws.connected) return;
        ws.send({cmd: 'nodeList'}, function(list) {
            panelEdit._nodes = list || [];
        });
    },

    // Creates a "From (nodeId)" select (or text fallback). Returns the jQuery element.
    _fromSel: function(container, key, fromVal) {
        var row = $('<div class="pe-field-row"/>').appendTo(container);
        $('<div class="pe-label">From (nodeId)</div>').appendTo(row);
        var el;
        if (panelEdit._nodes.length > 0) {
            el = $('<select class="pe-select" style="max-width:170px;flex:1"/>').attr('data-key', key);
            $('<option value="">-- node --</option>').appendTo(el);
            var found = false;
            panelEdit._nodes.forEach(function(n) {
                var opt = $('<option/>').val(String(n.nodeId))
                    .text(n.nodeId + ' \u2013 ' + n.name);
                if (String(n.nodeId) === String(fromVal)) { opt.prop('selected', true); found = true; }
                opt.appendTo(el);
            });
            if (fromVal && !found) {
                $('<option/>').val(String(fromVal)).text(String(fromVal) + ' (offline)')
                    .prop('selected', true).appendTo(el);
            }
        } else {
            el = $('<input class="pe-input" type="text"/>').attr('data-key', key).val(fromVal || '');
        }
        el.appendTo(row);
        return el;
    },

    // Renders/refreshes the "Name (service)" row inside container for the given nodeId.
    _refreshNameSel: function(container, key, fromVal, nameVal) {
        container.empty();
        var row = $('<div class="pe-field-row"/>').appendTo(container);
        $('<div class="pe-label">Name (service)</div>').appendTo(row);
        var node = panelEdit._nodes.find(function(n) { return String(n.nodeId) === String(fromVal); });
        var services = (node && node.services) ? node.services : [];
        var el;
        if (services.length > 0) {
            el = $('<select class="pe-select" style="max-width:170px;flex:1"/>').attr('data-key', key);
            $('<option value="">-- service --</option>').appendTo(el);
            var found = false;
            services.forEach(function(svc) {
                var svcName = typeof svc === 'string' ? svc : (svc && svc.name ? svc.name : null);
                if (!svcName) return;
                var opt = $('<option/>').val(svcName).text(svcName);
                if (svcName === nameVal) { opt.prop('selected', true); found = true; }
                opt.appendTo(el);
            });
            if (nameVal && !found) {
                $('<option/>').val(nameVal).text(nameVal).prop('selected', true).appendTo(el);
            }
        } else {
            el = $('<input class="pe-input" type="text"/>').attr('data-key', key).val(nameVal || '');
        }
        el.appendTo(row);
    },

    _fmtRow: function(container, ek, fmtStr) {
        var pf = panelEdit._parseFmt(fmtStr);
        var row = $('<div class="pe-field-row"/>').appendTo(container);
        $('<div class="pe-label">Format</div>').appendTo(row);
        var sel = $('<select class="pe-select"/>').attr('data-key', ek+'-fmt-type').appendTo(row);
        [['n','n read-only num'], ['N','N input num'], ['i','i indicator'],
         ['p','p pushbutton'],   ['s','s switch'],     ['t','t time'],
         ['d','d date'],         ['r','r slider']
        ].forEach(function(o) {
            $('<option/>').val(o[0]).text(o[1]).appendTo(sel);
        });
        sel.val(pf.t || 'n');
        var sub = $('<span class="pe-fmt-sub"/>').appendTo(row);
        panelEdit._renderFmtSub(sub, ek, pf);
        sel.change(function() {
            pf = {t: $(this).val()};
            panelEdit._renderFmtSub(sub, ek, pf);
        });
    },

    _renderFmtSub: function(sub, ek, pf) {
        sub.empty();
        switch ((pf.t || 'n').toLowerCase()) {
            case 'n':
                $('<span>W:</span>').appendTo(sub);
                $('<input class="pe-num-small" type="number" min="1" max="10"/>')
                    .attr('data-key', ek+'-fmt-w').val(pf.w || '3').appendTo(sub);
                $('<span>D:</span>').appendTo(sub);
                $('<input class="pe-num-small" type="number" min="0" max="6"/>')
                    .attr('data-key', ek+'-fmt-d').val(pf.d || '0').appendTo(sub);
                break;
            case 's':
                $('<span>Val:</span>').appendTo(sub);
                $('<input class="pe-input-sm" type="text"/>')
                    .attr('data-key', ek+'-fmt-sv').val(pf.sv || 'Toggle').appendTo(sub);
                break;
            case 'r':
                $('<span>min:</span>').appendTo(sub);
                $('<input class="pe-num-small" type="number"/>')
                    .attr('data-key', ek+'-fmt-mn').val(pf.mn || '0').appendTo(sub);
                $('<span>max:</span>').appendTo(sub);
                $('<input class="pe-num-small" type="number"/>')
                    .attr('data-key', ek+'-fmt-mx').val(pf.mx || '100').appendTo(sub);
                break;
            case 'd':
                $('<span>Pat:</span>').appendTo(sub);
                $('<input class="pe-input-sm" type="text" placeholder="DD.MM.YYYY"/>')
                    .attr('data-key', ek+'-fmt-dp').val(pf.sv || '').appendTo(sub);
                break;
            // i, p, t: no sub-fields
        }
    },

    _parseFmt: function(fmt) {
        if (!fmt) return {t: 'n', w: '3', d: '0'};
        var t = fmt.charAt(0), rest = fmt.slice(1);
        switch (t.toLowerCase()) {
            case 'n': {
                var np = rest.split('_');
                return {t: t, w: np[0] || '3', d: np[1] || '0'};
            }
            case 's': return {t: 's', sv: rest || 'Toggle'};
            case 'r': {
                var rp = rest.split(',');
                if (rp.length < 2) rp = rest.split('_');
                return {t: 'r', mn: rp[0] || '0', mx: rp[1] || '100'};
            }
            case 'd': return {t: 'd', sv: rest || ''};
            default:  return {t: t.toLowerCase()};
        }
    },

    _buildFmt: function(ek) {
        var gv = function(k) { return panelEdit._v(ek + k) || ''; };
        var t = gv('-fmt-type');
        if (!t) return 'n3';
        switch (t.toLowerCase()) {
            case 'n': {
                var w = gv('-fmt-w') || '3';
                var d = gv('-fmt-d') || '0';
                return t + w + (d !== '0' ? '_'+d : '');
            }
            case 's': return 's' + (gv('-fmt-sv') || 'Toggle');
            case 'r': return 'r' + (gv('-fmt-mn') || '0') + ',' + (gv('-fmt-mx') || '100');
            case 'd': return 'd' + gv('-fmt-dp');
            default:  return t;
        }
    },

    // ── DOM helpers ───────────────────────────────────────────────────────────

    _inp: function(container, label, type, value, key, optional) {
        var row = $('<div class="pe-field-row"/>').appendTo(container);
        $('<div class="pe-label'+(optional ? ' pe-optional' : '')+'">' + label + '</div>').appendTo(row);
        $('<input class="pe-input"/>').attr({type: type, 'data-key': key})
            .val(value !== undefined && value !== null ? value : '').appendTo(row);
    },

    _moveBtn: function(container, txt, fn) {
        $('<button class="pe-btn pe-btn-sm pe-btn-move"/>').text(txt).click(fn).appendTo(container);
    },

    _rmBtn: function(container, fn) {
        $('<button class="pe-btn pe-btn-sm pe-btn-rm"/>').text('✕').click(fn).appendTo(container);
    },

    _v: function(key) {
        var v = $('[data-key="' + key + '"]').val();
        return v !== undefined ? v : '';
    },

    // ── Collect form → JSON ───────────────────────────────────────────────────

    _collectPanel: function() {
        var v = panelEdit._v;
        var p = JSON.parse(JSON.stringify(panelEdit._current));

        p.name     = v('ph-name');
        p.filename = v('ph-filename').trim();
        p.size     = {rows: +v('ph-rows') || 0, cols: +v('ph-cols') || 0};
        p.pos      = {left: +v('ph-left'), top: +v('ph-top')};
        p.css      = v('ph-css');

        p.groups.forEach(function(g, gi) {
            g.name = v('g'+gi+'-name') || g.name;
            var rows = v('g'+gi+'-rows'), cols = v('g'+gi+'-cols');
            var top  = v('g'+gi+'-top'),  left = v('g'+gi+'-left');
            if (rows !== '' || cols !== '') {
                g.size = g.size || {};
                if (rows !== '') g.size.rows = +rows;
                if (cols !== '') g.size.cols = +cols;
            }
            if (top !== '' || left !== '') {
                g.pos = g.pos || {};
                if (top  !== '') g.pos.top  = +top;
                if (left !== '') g.pos.left = +left;
            }

            (g.data || []).forEach(function(d, di) {
                var ek = 'g'+gi+'d'+di;
                var jsVal = v(ek+'-js');
                d.sq = di + 1;

                if (!jsVal) {
                    delete d.js; delete d.type; delete d.size;
                    delete d.low; delete d.high;
                    delete d.scale_steps; delete d.scale_div; delete d.scale_subdiv;
                    delete d.munit; delete d.cover; delete d.pointer_color;
                    delete d.lat; delete d.lon;
                    d.label  = v(ek+'-label');
                    d.name   = v(ek+'-name');
                    d.from   = v(ek+'-from');
                    d.value  = v(ek+'-value');
                    var unit    = v(ek+'-unit');    if (unit)    d.unit    = unit;    else delete d.unit;
                    var field   = v(ek+'-field');   if (field)   d.field   = field;   else delete d.field;
                    var formula = v(ek+'-formula'); if (formula) d.formula = formula; else delete d.formula;
                    d.format = panelEdit._buildFmt(ek);
                } else {
                    delete d.format; delete d.label; delete d.unit;
                    delete d.field; delete d.formula;
                    d.js = jsVal;
                    var typ = v(ek+'-type'); if (typ) d.type = typ; else delete d.type;
                    d.size = (v(ek+'-size-mode') === 'px') ? (+v(ek+'-size-px') || 'auto') : 'auto';

                    if (jsVal !== 'clock.js') {
                        if (jsVal === 'sunpos.js') {
                            d.name = v(ek+'-name');
                            var lat = v(ek+'-lat'), lon = v(ek+'-lon');
                            if (lat !== '') d.lat = +lat; else delete d.lat;
                            if (lon !== '') d.lon = +lon; else delete d.lon;
                            delete d.from; delete d.value;
                        } else {
                            d.name  = v(ek+'-name');
                            d.from  = v(ek+'-from');
                            d.value = v(ek+'-value');
                        }
                    } else {
                        delete d.name; delete d.from; delete d.value;
                    }

                    if (jsVal === 'vmeter.js' || jsVal === 'hormeter.js' || jsVal === 'vermeter.js') {
                        var low  = v(ek+'-low');    if (low  !== '') d.low  = +low;  else delete d.low;
                        var high = v(ek+'-high');   if (high !== '') d.high = +high; else delete d.high;
                        var ss   = v(ek+'-scale_steps');  if (ss  !== '') d.scale_steps  = +ss;  else delete d.scale_steps;
                        var sd   = v(ek+'-scale_div');    if (sd  !== '') d.scale_div    = +sd;   else delete d.scale_div;
                        var ssd  = v(ek+'-scale_subdiv'); if (ssd !== '') d.scale_subdiv = +ssd;  else delete d.scale_subdiv;
                        var mu   = v(ek+'-munit');        d.munit = mu || undefined;
                        var cov  = v(ek+'-cover');        if (cov !== '') d.cover = +cov; else delete d.cover;
                        var pc   = v(ek+'-pointer_color'); if (pc) d.pointer_color = pc; else delete d.pointer_color;
                    }
                    if (jsVal === 'dials.js') {
                        var mu2 = v(ek+'-munit');  d.munit = mu2 || undefined;
                        var pc2 = v(ek+'-pointer_color'); if (pc2) d.pointer_color = pc2; else delete d.pointer_color;
                    }
                }
            });
        });
        return p;
    },

    // ── Save / Delete ─────────────────────────────────────────────────────────

    _savePanel: function() {
        var p = panelEdit._collectPanel();
        if (!p.filename) {
            panelEdit._status('Filename required', 'err');
            return;
        }
        $.post('panel', {cmd: 'savePanel', fn: p.filename, data: JSON.stringify(p, null, 2)}, function(resp) {
            if (resp === 'success') {
                panelEdit._panelName = p.filename;
                panelEdit._current = p;
                panelEdit._loadPanelList();
                panelEdit._renderEditor();
                panelEdit._status('Saved', 'ok');
            } else {
                panelEdit._status('Error: ' + resp, 'err');
            }
        });
    },

    _deletePanel: function() {
        var fn = panelEdit._panelName;
        if (!fn || !confirm('Delete panel "'+fn+'"?')) return;
        $.post('panel', {cmd: 'deletePanel', fn: fn}, function(resp) {
            if (resp === 'success') {
                panelEdit._panelName = '';
                panelEdit._current = null;
                panelEdit._loadPanelList();
                $('#pe-main').empty();
            } else {
                panelEdit._status('Delete error: '+resp, 'err');
            }
        });
    },

    _status: function(msg, type) {
        var el = $('#pe-status');
        el.text(msg).removeClass('pe-status-ok pe-status-err')
            .addClass(type === 'ok' ? 'pe-status-ok' : 'pe-status-err');
        if (type === 'ok') {
            window.setTimeout(function() { el.text('').removeClass('pe-status-ok'); }, 3000);
        }
    }
};
