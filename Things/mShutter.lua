-- mShutter Rolladen kontrolle
local M = {
	thing = 'Shutter remote',
	pinUp	= 7,
	pinStop = 6,
	pinDown = 5,
	pinChan = 4,
	maxtime = 55,
	opentim	= 10,
	curChannel = 1,
	services = {
		{
			name = 'Shutter 1',
			value = 0,
			open = 0,
			dest = 0,
			current = 0,
			channel = 1
		},
		{
			name = 'Shutter 2',
			value = 0,
			open = 0,
			dest = 0,
			current = 0,
			channel = 2
		},
		{
			name = 'Shutter 3',
			value = 0,
			open = 0,
			dest = 0,
			current = 0,
			channel = 3
		},
		{
			name = 'Shutter 4',
			value = 0,
			open = 0,
			dest = 0,
			current = 0,
			channel = 4
		},
		{
			name = 'Shutter 5',
			value = 0,
			open = 0,
			dest = 0,
			current = 0,
			channel = 5
		}
	}
}

local createCallback, pulse, tPuls, pulsHigh, second, gotoChannel, pinSet

local tPuls = tmr.create()
pulse = function(pin)
	local pin = pin
	transmit.log('Pulse', pin)
	gpio.write(pin, gpio.LOW)
	tPuls:register(10, tmr.ALARM_SEMI, function()
		gpio.write(pin, gpio.HIGH)
	end)
	tPuls:start()
end

gotoChannel = function(sv, cb)
	transmit.log(M.curChannel, sv.channel)
	if M.curChannel == sv.channel then
		transmit.log('channel is ok')
		cb()
	end
	local tm = tmr.create()
	tm:register(100, tmr.ALARM_AUTO, function()
		if M.curChannel == sv.channel then
			tm:stop()
			tm:unregister()
			cb()
		end
		M.curChannel = M.curChannel  + 1
		pulse(pinChan)
		if M.curChannel == 7 then 		-- 6th channel is 'all' channels 	
			M.curChannel = 1
		end
	end)
end

second = function()
	for i, sv in ipairs(M.services) do
		if sv.current > 0 then
			sv.current = sv.current - 1
			transmit.log('still', sv.current)
			local ss = {}
			table.insert(ss, sv)
			transmit.send(M.thing, ss)
			if sv.current == 0 then
				gotoChannel(sv, function(sv)
					pulse(M.pinStop)
				end)
			end
		end
	end
end

pinSet = function(pin)
	gpio.mode(pin, gpio.OUTPUT, gpio.PULLUP)
	gpio.write(pin, gpio.HIGH)
end
	
local tSec = tmr.create()
tSec:register(1000, tmr.ALARM_AUTO, second)

M.init = function(callback)
	-- setup output pins
	pinSet(M.pinUp)
	pinSet(M.pinStop)
	pinSet(M.pinDown)
	pinSet(M.pinChan)
	callback(M.thing)
end

M.registered = function()
	tSec:start()				-- start loop
end

M.set = function(services)
    local i, k, sv, ss
    for i, sv in ipairs(services) do
        for k, ss in ipairs(M.services) do
            if sv.name == ss.name then
				transmit.log('Set shutter value of'..ss.name..' from '..ss.value..' to '..sv.value)
				local d = ss.dest
				ss.dest = math.floor(sv.value * M.maxtime / 100)
                if tonumber(sv.value) < tonumber(ss.value) then
					transmit.log('lower', d, ss.dest, ss.current)
					ss.current = d - ss.dest
					pulse(M.pinDown)
				elseif tonumber(sv.value) > tonumber(ss.value) then
					transmit.log('higher', d, ss.dest, ss.current)
					ss.current = ss.dest - d
					pulse(M.pinUp)
				end
				ss.value = sv.value
				local sss = {}
				table.insert(sss, ss)
				M.data(sss)
           end
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

