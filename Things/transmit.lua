local M = {
	sendLog = false,
	logTo = '',
	sendDisable = false,
	initPhase = true,
	things = {},
	nodeId = tostring(node.info('hw').chip_id),
	config = require('mConfig'),
	tmCommto = nil,
	ws = nil,
	commCall = nil
}

mCmd = require('mCmd')		-- Commands Module (must be global)
local wsConnect, cont, register, receive, wsClose, cTimeout, commTimeout, checkTime, collectData
local tmCto, rcCount, rcTime, rcBase, tmReconnect, regCnt
local nDev = #M.config.devices
local mStimer = require('mStimer')
local rcCount = 0											-- Reconnection counter
local rcTime = 0											-- Current wait time for reconnection
local rcBase = 10											-- Base wait time for reconnection
local regCnt = 0											-- Register retry attempt counter


-- Console log function. First col is Time and Date, second is heap then comes the message
M.log = function(...)
	--local cf = debug.getinfo(2).name  -- get the calling function name
	local tm = _G.time()
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
		M.ws:send(sjson.encode(msg))
	end	
end

M.init = function()
	_G.log('Broker is '.._G.broker)
	if nDev == 0 then 
		cont('none')
	else
		M.initPhase = true
		for i, v in ipairs(M.config.devices) do
			_G.log('Transmit module '..i..': '..v)
			M.things[v] = require(v)
			local mod = M.things[v]
			
			mod.nodeId = M.nodeId
			if type(M.config[v]) == 'function' then
				M.config[v]()
			end
			mod.init(cont)				-- initialize thing	which calls back to cont
		end
	end
end

cont = function(module)
	M.log('Module '..module..' initialized')
	nDev = nDev - 1
	if nDev > 0 then
		return   							-- promise: not all devices finish init yet
	end
	wifi.sta.sethostname("Node-"..M.nodeId)
	wsConnect()
end

cTimeout = function()						-- handle connection timeout
	local dly = mStimer.register(1, 10, wsConnect)	-- wait for try to reconnect
end

wsConnect = function()
	M.log('connecting to "'..broker..'"')
	M.ws = nil
	M.ws = websocket.createClient()
	M.ws:on('receive', receive)					-- connect the receive method
	M.ws:on('close', wsClose)					-- disconnected, handle reconnect
	M.ws:on('connection', function()			-- first action after connection is to register the thing
		mStimer.stop(tmCto)						-- connection has been in time
		M.log('Websocket connected')
		rcTime = rcBase
		rcCount = 0
		register()
	end)
	M.ws:connect('ws://'..broker)				-- new broker definition in global (defined in init.lua)
	tmCto = mStimer.register(2, 10, cTimeout) 	-- Connection timeout timer
	mStimer.start(tmCto) 						-- start connection timeout timer
end

commTimeout = function()
	M.log('communication timeout ( no communication received since 15 min')
	M.collectData()
	local msg = {
		cmd = 'time',
		type = 'node',
		thing = thing,
		nodeId = M.nodeId
	}
	M.sendRaw(msg)									-- request time from server
	mStimer.start(M.tmCommto);						-- start timer
end	

wsClose = function(ws, status)
	-- websocket has been closed
	M.log('connection closed, status: '..status)
--[[
	if rcCount < 5 then								-- try reconnect 5 times with increasing wait time in between
		M.sendDisable = true
		rcCount = rcCount + 1						-- count reconnection attempts
		M.log('try reconnect, attempt # '..rcCount)
		M.ws:close()
		rcTime = rcTime + rcCount * rcBase			-- increase wait time for each attempt
		tmReconnect = mStimer.register(1, rcTime, wsConnect)	-- Reconnection timer
		mStimer.start(tmReconnect, rcTime)			-- start wait timer
		M.log('wait '..rcTime..' s for connection')
		return
	end
]]-- 
	M.log('could not connect, must reboot...')
	M.nodereboot()
end

register = function()							-- registers the thing with the server
	local sv = {}
	local nodename = ''
	for k, v in pairs(M.things) do				-- collect the services form all the devices on the thing
		for i, w in ipairs(v.services) do
			table.insert(sv, w)
		end
		nodename = nodename .. v.thing .. ','
	end
	local rg = {								-- setup the message
		cmd = 'register',
		thing = nodename,
		nodeId = M.nodeId,						-- the nodeId identifies the thing
		services = sv
	}
	if M.config.description then
		rg.description = M.config.description
	end
	
	local msg = sjson.encode(rg)
	M.sendDisable = false
	M.ws:send(msg)		-- send the message. Waits on regOk from server, reception is handled by 'receive' function
	M.tmRegto = mStimer.register(1, 10, function()
		regCnt = regCnt + 1
		if regCnt > 5 then
			M.nodereboot()
		end
		M.log('register timeout, try again')
		register()
	end)		-- start the register timeout timer ant retry if timeout
	M.log('register:', msg)
end

M.nodereboot = function()
	M.ws:close()
	M.log('Node will be restarted...')
	mStimer.register(1, 5, function() 	-- wait 5 seconds then reboot node
		node.restart()
	end)
end

checkTime = function(oResp)
	if oResp.epoch == nil then return end
	local serverTime = math.floor(oResp.epoch/1000)
	if rtctime.get() ~= servertime then
		M.log('adjust realtime clock')
		rtctime.set(serverTime) 
		--M.log( tonumber(string.sub(oResp.date, 12, 13)) - rtctime.epoch2cal(rtctime.get()).hour)
		if tonumber(string.sub(oResp.date, 12, 13)) - rtctime.epoch2cal(rtctime.get()).hour > 1  then
			M.log("it's daylight saving time")
			setDst(1)
		else
			setDst(0)
		end
	end
end

M.collectData = function()
	-- collect all services of all device modules
	local sv = {}
	for i, v in ipairs(M.config.devices) do
		_G.log('Collect data for '..v)
		if #M.things[v].services > 0 then
			for k, w in ipairs(M.things[v].data(M.things[v].services, true)) do
				_G.log('   Collect service '.. w.name)
				table.insert(sv, w)
			end
		end
	end
	M.send(M.thing, sv)
end

receive = function(ws, msg, opcode)			-- receive messages an decode the actions	
	M.log('got message:', msg, opcode)
	if type(M.commCall) == 'function' then
		M.commCall()												-- function to be called whenever a receive is executed
	end

	if M.tmCommto == nil then
		M.tmCommto = mStimer.register(2, 15*60, commTimeout)	-- Communication timeout timer
	end
	mStimer.start(M.tmCommto)					-- restart communication timeout timer
	rcCount = 0 							-- reset reconnection counter (limits the reconnect retries)
	if opcode == 1 then
		M.oResp = sjson.decode(msg)			-- decode the message into a table
		msg = nil
		-- now determine date and time and whether it's daylight saving time form server's epoch which is in microsec
		checkTime(M.oResp)
		mCmd.init(M)
		local f = _G['mCmd'][M.oResp.cmd]  	-- find the received command in the mCmd.lua 
		if type(f) == 'function' then
			setfenv(f, getfenv())
			f()								-- yes found, execute it
		elseif string.find(M.oResp.cmd, 'File', 1, true) ~= nil then				-- file commands
			mFile = require('mFile')
			ws:send(mFile.cmds(M.oResp))
			package.loaded.mFile = nil				-- unload the module
		else
			M.log('unknown command: '..M.oResp.cmd)
		end
	end
end

M.send = function(thing, oServices, callback)		-- send data of certain services
	if M.sendDisable then
		M.log('send data from devices is currently disabled')
		return
	end
	local oData = {
		cmd = 'data',
		type = 'node',
		thing = thing,
		nodeId = M.nodeId,
		time = time(),
		services = {}
	}
	for i, v in ipairs(oServices) do
		table.insert(oData.services, v)
	end
	M.sendRaw(oData)
end

M.sendRaw = function(oData, callback)							-- send raw data not in services e.g. device info
	if type(M.commCall) == 'function' then
		M.commCall()												-- function to be called whenever a sendRaw is executed
	end
	local msg = sjson.encode(oData)
	M.log('send data', msg)
	err = M.ws:send(msg)
	if err == nil then
		mStimer.start(M.tmCommto)
		if callback then
			callback()
		end
	else
		M.log('Websocket error: '+err)
		wsClose(M.ws, err)
	end
end

M.https = function(thing, url, callback)
	if M.httpsCallback ~= nil then
		M.log('No concurrent https calls allowed')
		return
	end
	M.httpsCallback = callback
	local oData = {
		cmd = 'https',
		type = 'node',
		thing = thing,
		nodeId = M.nodeId,
		time = time(),
		url = url
	}
	M.sendRaw(oData)
end

return M