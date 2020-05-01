-- Transmit.lua Process the transmission of data to the thingsServer

local M = {}
M.dst = 0
M.sendLog = false
M.logTo = ''

M.getTime = function(epoch, usec)
	if usec == nil then
		usec = 0
	end
	if epoch == nil then
		epoch, usec = rtctime.get()
	end
	epoch = epoch + (3600 * (1 + M.dst)) -- MEZ + dst
	local tm = rtctime.epoch2cal(epoch)
	tm.usec = usec
	return tm
end

M.time = function(epoch)
	local tm = M.getTime(epoch)
	return string.format('%04d-%02d-%02d %02d:%02d:%02d.%06d', tm.year, tm.mon, tm.day, tm.hour, tm.min, tm.sec, tm.usec)
end

local ws, register, wsclose, receive, collectData, cont

-- Console log function. First col is Dime and Date, second is heap then comes the message
M.log = function(...)
	local tm = M.time()
	_G.log(tm, ...)			-- the basic log function is defined in the init1.lua (with heap but without time)
	if M.sendLog then		-- When this vaiable is set the log lines will be sent to the control panel in the browser
		local msg = {
			cmd = 'log',
			type = 'node',
			from = M.nodeId,
			to = M.logTo,
			log = node.heap()..' '.. tm
		}
		for i=1, select('#',...) do
			local e = select(i, ...)
			msg.log = msg.log .. ' '
			if e == nil then
				msg.log = msg.log .. 'nil'
			else
				msg.log = msg.log .. e
			end
		end
		ws:send(sjson.encode(msg))
	end	
end
M.sendDisable = false
M.things = {}
M.nodeId = tostring(node.info('hw').chip_id)  -- nodeId is built from the chip_id
M.config = require('mConfig')				  -- load the configuration module, 
											  -- defines the device modules and specific initialisation

local ctm = tmr.create()
local cto = function()
	M.log('connect timeout')
	wsclose(ws, 18)
end
local ctmtime = 3000						-- connection timeout is 3 sec	
ctm:register(ctmtime, tmr.ALARM_SEMI, cto)  -- connection timer
local c99 = 0								-- connection timeout counter
local rto = function()
	M.log('register timeout')
	node.restart()
end

local rtm = tmr.create()
rtm:register(500, tmr.ALARM_SEMI, rto)	 	-- register timeout timer

local nDev = #M.config.devices				-- simulate promise: all devices must finish init
M.init = function()
	for i, v in ipairs(M.config.devices) do
		_G.log('Transmit module '..v)
		M.things[v] = require(v)
		M.things[v].nodeId = M.nodeId
		M.things[v].init(cont)				-- initialize thing	which calls back to cont
	end
end

cont = function(module)
	M.log('Module '..module..' initialized')
	nDev = nDev - 1
	if nDev > 0 then
		return   							-- promise: not all devices finish init yet
	end
	wifi.sta.sethostname("Node-"..M.nodeId)
	ws = websocket.createClient()
	ws:on('connection', register)			-- first action after connection is to register the thing
	ws:on('close', wsclose)
	ws:connect(M.config.broker)
	ctm:start() 							-- start connection timeout timer
	M.log('connecting to '..M.config.broker)
end

register = function(ws)						-- registers the thing with the server
	tmr.delay(10)
	M.log('Websocket connected, now register node')
	ctm:stop()								-- connection has been in time
	ws:on('receive', receive)				-- connect the receive method
	local sv = {}
	local nodename = ''
	for k, v in pairs(M.things) do			-- collect the services form all the devices on the thing
		for i, w in ipairs(v.services) do
			table.insert(sv, w)
		end
		nodename = nodename .. v.thing .. ','
	end
	local rg = sjson.encode({				-- setup the message
		cmd = 'register',
		thing = nodename,
		nodeId = M.nodeId,					-- the nodeId identifies the thing
		services = sv
	})
	M.log('register:', rg)
	rtm:start()								-- start the register tineout timer
	ws:send(rg)								-- send the message
end

receive = function(ws, msg, opcode)			-- receive messages an decodr the actions	
	M.log('got message:', msg, opcode)
	c99 = 0 								-- reset close-99 counter (limits the reconnect retries)
	if opcode == 1 then
		local oResp = sjson.decode(msg)		-- decode the message into a table
		msg = nil
		if oResp.cmd == 'regOk' then		-- Register command success 
			rtm:stop()						-- register is in time
			sendDisable = false				-- allow again sending messages
			-- now determine date and time and whether it's daylight saving time form server's epoch which is in microsec
            rtctime.set(math.floor(oResp.epoch/1000), oResp.epoch % 1000) 
            --M.log( tonumber(string.sub(oResp.date, 12, 13)) - rtctime.epoch2cal(rtctime.get()).hour)
            if tonumber(string.sub(oResp.date, 12, 13)) - rtctime.epoch2cal(rtctime.get()).hour > 1  then
                M.log("it's daylight saving time")
                M.dst = 1
            else
                M.dst = 0
            end
			-- call each device's registered function. Used for initialisations which need correct time.
			for i, v in ipairs(M.config.devices) do
				if M.things[v].registered then
					M.things[v].registered()		-- call devices after registration procedure if present
				end
			end
			collectData()							-- send all data back to the server 
		elseif oResp.cmd == 'rqData' then			-- this is also required when a Control panel connects
			collectData()
		elseif oResp.cmd == 'set' then				-- a control panel wants to send data to the thing
			for i, v in ipairs(M.config.devices) do
				M.things[v].set(oResp.services)
			end
		elseif oResp.cmd == 'info' then				-- control panel needs information about the thing	
			local mInfo = require('mInfo')
			ws:send(mInfo.sendInfo(oResp))
			package.loaded['mInfo'] = nil			-- don't need this module anymore
		elseif oResp.cmd == 'file' then				-- file transfer comes
			mFile = require('mFile')
			ws:send(mFile.loadFile(oResp))
			package.loaded.mFile = nil				-- unload the module
		elseif oResp.cmd == 'boot' then				-- Control panel wants to boot the thing
			M.log('Device will be rebooted')
			ws:close()
			node.restart()
		elseif oResp.cmd == 'flashreload' then		-- Control panel wants to reload the lfs
			M.log('Flash Reload required')
			file.putcontents('flashreload', M.time()) -- flashreload will be initiated at ini.lua
			node.restart()							-- first boot the thing	
		elseif oResp.cmd == 'sendLog' then			-- switch sendin log lines on
			M.sendLog = true
			M.logTo = oResp.to
		elseif oResp.cmd == 'stopLog' then			-- switch sendin log lines off
			M.sendLog = false
		else
			M.log('Unknown command')
		end
	else
		M.log('illegal opcode: ', opcode)
	end
end

collectData = function()							-- collect all services of all device modules
	local sv = {}
	for i, v in ipairs(M.config.devices) do
		for k, w in ipairs(M.things[v].data(M.things[v].services, true)) do
			table.insert(sv, w)
		end
	end
	M.send(M.thing, sv)
end

M.send = function(thing, oServices, callback)		-- send data of certain services
	if sendDisable then
		-- send data from devices is currently disabled
		return
	end
	local oData = {
		cmd = 'data',
		type = 'node',
		thing = thing,
		nodeId = M.nodeId,
		time = M.time(),
		services = {}
	}
	for i, v in ipairs(oServices) do
		table.insert(oData.services, v)
	end
	M.sendRaw(oData)
end

M.sendRaw = function(oData)							-- send raw date not in services e.g. device info
	local msg = sjson.encode(oData)
	M.log('send data', msg)
	ws:send(msg)
	if callback then
		callback()
	end
end

wsclose = function(ws, status)						-- websocket has been closed
	M.log('connection closed, status: '..status, c99)
	if c99 < 5 then									-- try reconnect 5 times with increasing wait time in between
		sendDisable = true
		c99 = c99 + 1
		M.log('try reconnect')
		ws:close()
		ws = nil
		ws = websocket.createClient()
		ws:on('connection', register)
		ws:connect(M.config.broker)
		ctmtime = ctmtime * c99						-- increase wait time quadratic
		ctm:interval(ctmtime)
		ctm:start()
	else
		M.log('must reboot...')						-- could not reconnect
		node.restart()
	end
end

return M
