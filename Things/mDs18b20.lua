-- read temperature with DS18B20 
local M = {
	thing = 'Thermometer',
	--pin = 3,
	interval = 10,
	
	services = {}
}

local ds18b20 = require('ds18b20')
local ext = false
local readout
local tm = tmr.create()
local cb
local timer = tmr.create()
local retries = 5
local nRetry = 0

M.init = function(callback)
	if M.extend then
		transmit.log('Extension defined: '..M.extend)
		M.ext = require (M.extend)
	end
    transmit.log('find sensors on pin '..M.pin)
	--ds18b20.enable_debug()
	cb = callback
	gpio.mode(M.pin, gpio.OUTPUT, gpio.PULLUP)
	ds18b20:read_temp(readout, M.pin, 'C', true)	-- force scan for sensors
end

M.registered = function()
	transmit.log('Registered, now start temperature read interval of '..M.interval..' seconds')
	timer:register(M.interval * 1000, tmr.ALARM_AUTO, function()
		ds18b20:read_temp(readout, M.pin, 'C')
	end)
	timer:start()
end

readout = function(temp)
	local tmp = {}
	for addr, t in pairs(temp) do
		local x = ('%02X%02X%02X%02X%02X%02X%02X%02X'):format(addr:byte(1,8))
		tmp[x] = t
	end
	local lSend = true
	if #ds18b20.sens > 0 then
		if #M.services == 0 then
			transmit.log(#ds18b20.sens..' ds18b20 sensors found')
			lSend = false	-- do not send data in init phase
			for i, addr in ipairs(ds18b20.sens) do
				local rom = ('%02X%02X%02X%02X%02X%02X%02X%02X'):format(addr:byte(1,8))
				local sens = {
					name = 'Temp '..rom,
					type = 'Output',
					datatype = 'Number',
					addr = rom,
					value = '0.0',
					change = 0
				}
				table.insert(M.services, sens)
			end
			if M.extend then
				M.ext.init()
			end
			cb(M.thing)
		end
		--transmit.log('in Readout', lSend, 'interval:', M.interval, timer:state())
		for addr, t in pairs(tmp) do
			for k, s in ipairs(M.services) do
				if s.addr == addr then
					--transmit.log('Sensor '..k, s.value, t)
					-- evaluate whether there was a change
					local tr = string.format('%3.1f', t)
					if math.abs(s.value - tr) >= 0.2 then
						if tonumber(tr) > tonumber(s.value) then
							s.change = 1 -- trend is up
						else
							s.change = -1 -- trend is down
						end
						s.value = tr
					else
						s.change = 0  -- no change
					end
					if M.extend then
						M.ext.change(s)
					end
				end
			end
		end
		if lSend then
			--send all service data exept pair 'addr'
			sv = {}
			for i, v in ipairs(M.services) do
				--transmit.log('sensor '..i, v.value, 'change is', v.change)
				if v.change ~= 0 then
					transmit.log('sensor '..i, v.value)
					table.insert(sv, v)
				end
				--
         	end
			if #sv > 0 then
				transmit.send(M.thing, sv) -- send only if there was a change
			end
		end
	else
		transmit.log('"---> No ds18b20 sensors found"\n')
		-- wait for ten seconds to show the message before rebooting
		--tm:register(60*1000, tmr.ALARM_SINGLE, function()
		--	transmit.nodereboot()
		--end)
		--tm:start()
		if nRetry < retries then
			nRetry = nRetry + 1
			transmit.log(nRetry..'. retry')
			tm:register(20*1000, tmr.ALARM_SINGLE, function()
				print('now retry')
				ds18b20:read_temp(readout, M.pin, 'C', true)	-- force scan for sensors
			end)
			tm:start()
		else
			transmit.nodereboot()
		end
	end
end

M.data = function(services, collect)
	if services == nil then
		services = M.services  -- send all services
	end
	local sv = {}
	for i, v in ipairs(services) do
		for k, w in ipairs(M.services) do
			if v.name == w.name then
				table.insert(sv, w)
			end
		end
	end
	if #sv > 0 then
		if collect then
			return sv
		else
			transmit.send(M.thing, sv)
		end
	end
end

return M
