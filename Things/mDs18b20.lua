-- read temperature with DS18B20 
local M = {
	thing = 'Thermometer',
	pin = 3,
	interval = 0.5,
	services = {}
}

local ds18b20 = require('ds18b20')
local readout
local timer = tmr.create()
local cb

M.init = function(callback)
	transmit.config.mDs18b20()
	cb = callback
	--ds18b20.enable_debug()
	ds18b20:read_temp(readout, M.pin, 'C', true)
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
			timer:start()
		end
		for addr, t in pairs(tmp) do
			for k, s in ipairs(M.services) do
				if s.addr == addr then
					--transmit.log('Sensor '..k, s.value, t)
					-- evaluate whether there was a change
					local tr = string.format('%3.1f', t)
					if s.value ~= tr then
						if tonumber(tr) > tonumber(s.value) then
							s.change = 1 -- trend is up
						else
							s.change = -1 -- trend is down
						end
						s.value = tr
					else
						s.change = 0  -- no change
					end
				end
			end
		end
		if lSend then
			--send all service data exept pair 'addr'
			sv = {}
			for i, v in ipairs(M.services) do
				if v.change ~= 0 then
					table.insert(sv, v)
				end
				--transmit.log('sensor '..i, v.value, 'change is', v.change)
			end
			transmit.log('Thermometer update '..#sv..' services')
			if #sv > 0 then
				transmit.send(M.thing, sv) -- send only if there was a change
			end
		else
			if cb then
				local xcb = cb
				cb = nil
				xcb(M.thing)
			end
		end
	else
		transmit.log('No ds18b20 sensors found')
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

timer:register(M.interval * 60 * 1000, tmr.ALARM_AUTO, function()
	ds18b20:read_temp(readout, M.pin, 'C')
end)

return M
