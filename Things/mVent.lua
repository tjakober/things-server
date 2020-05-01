-- mVent  Ventilatorsteuerung
M = {
	thing = 'Ventilation',
	services = {
		{
			name = 'Ventilator',
			type = 'Switch',
			value = 'OFF',
			pin = 4,
			swAssoc = 3,
			ts = 0
		},
		{
			name = 'Timer',
			value = -1,
			Start = '20:00',
			Duration = '60',
			cur = 0,
			Start2 = '10:00',
			Duration2 = '60',
			cur2 = 0
		}
	}
}

local vent, timer = 1, 2
local oTimer = tmr.create()
local minutes, minute, setSwitch, setToggleSwitch, split, saveServices, stToMin

M.init = function(callback)
	if file.exists('services.json') then
		transmit.log('has file')
		local f = file.getcontents('services.json')
		transmit.log('read file')
		local o = sjson.decode(f)
		transmit.log('decoded file')
		M.services = o
		transmit.log('stored in services')
		f=nil
		o=nil
	end
	
	-- Ventilator switch
	transmit.config.setup()
	local sv = M.services[vent]
	local sw
	if sv.value == 'OFF' then sw = gpio.LOW else sw = gpio.HIGH end
	gpio.mode(sv.pin, gpio.OUTPUT, gpio.PULLUP)
	gpio.write(sv.pin, sw)
	setToggleSwitch(sv)
	transmit.log('Ventilator initialized')
	
	-- Setup Timer
	oTimer:register(60*1000, tmr.ALARM_AUTO, minutes)
	oTimer:start()
	transmit.log('Timer initialized')
	callback(M.thing)
end

M.registered = function()
	transmit.log('"registered" called')
	local tm = transmit.getTime()
	minute = (tm.hour *  60 + tm.min) - 1
	transmit.log('Start at', tm.hour..':'..tm.min, minute)
	local sv = M.services[timer]
	if minute > stToMin(sv.Start) then
		sv.cur = stToMin(sv.Start) + tonumber(sv.Duration) - minute
		if sv.cur < 0 or sv.cur >= tonumber(sv.Duration) then
			sv.cur = 0
		end
	else
		sv.cur = 0
	end
	if minute > stToMin(sv.Start2) then
		sv.cur2 = stToMin(sv.Start2) + tonumber(sv.Duration2) - minute
		if sv.cur2 < 0 or sv.cur >= tonumber(sv.Duration) then
			sv.cur2 = 0
		end
	else
		sv.cur2 = 0
	end
	
	minutes()  -- call minutes first time after registration
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

M.set = function(services)
	local ssv = {}
	for i, v in ipairs(services) do
		for k, w in ipairs(M.services) do
			if v.name == w.name then
				if w.type == 'Switch' then
					setSwitch(w, v.value)
				else
					if v.para then
						w[v.para] = v.value
					else
						w.value = value
					end
				end
				table.insert(ssv, w)
			end
		end
	end
	saveServices()
	if #ssv > 0 then
		transmit.send(M.thing, ssv)
	end
end

M.stop = function()
	oTimer:stop()
	oTimer:unregister()
	gpio.trig(M.services[1].swAssoc, 'down')
end

setSwitch = function(sv, value)
	if value == 'TOGGLE' then
		if sv.value == 'ON' then
			sv.value = 'OFF'
		else
			sv.value = 'ON'
		end
	else
		sv.value = value
	end
	if sv.value == 'ON' then
		gpio.write(sv.pin, gpio.HIGH)
	else
		gpio.write(sv.pin, gpio.LOW)
	end
	transmit.log('Switch switched '..sv.value)
	saveServices()
end

setToggleSwitch = function(sv)
	gpio.mode(sv.swAssoc, gpio.INT, gpio.PULLUP)
	gpio.trig(sv.swAssoc, 'up', function(level, when)
		-- prevent switch bouncing, accept only interrupts after 1000000 microseconds
		local d = when - sv.ts
		transmit.log('Switch pressed', d, when, sv.ts)
		if d > 1000000 or when < sv.ts then
			sv.ts = when
			setSwitch(sv, 'TOGGLE')
			transmit.send(M.thing, {sv})
		end
	end)
end

split = function(inputstr, sep)
    if sep == nil then
        sep = "%s"
    end
    local t={} ; i=1
    for str in string.gmatch(inputstr, "([^"..sep.."]+)") do
        t[i] = str
        i = i + 1
    end
    return t
end

minutes = function()
	local sv = M.services[timer]
	local ss = M.services[vent]
	minute = minute + 1
	if minute >= 24 * 60 then
		minute = 0
	end
	if tonumber(sv.cur) > 0 then
		sv.cur = tonumber(sv.cur) - 1
		if sv.cur == 0 then
			setSwitch(ss, 'OFF')
		end
		saveServices()
		transmit.send(M.thing, M.services)		-- update panels with both services
	end
	if tonumber(sv.cur2) > 0 then
		sv.cur2 = tonumber(sv.cur2) - 1
		if sv.cur2 == 0 then
			setSwitch(ss, 'OFF')
		end
		saveServices()
		transmit.send(M.thing, M.services)		-- update panels with both services
	end
	transmit.log('Minute '..minute, '('..math.floor((minute)/60)..':'..((minute)%60)..')')
	local st = split(sv.Start, ':')
	local start = stToMin(sv.Start)
	transmit.log('Start:', start, '('..sv.Start..')', 'Duration still:', sv.cur)
	if minute >= start and minute < start + tonumber(sv.Duration) and ss.value == 'OFF' then
		setSwitch(ss, 'ON')
		sv.cur = tonumber(sv.Duration)
		saveServices()
		transmit.send(M.thing, M.services)		-- update panels with both services
	end
	local start2 = stToMin(sv.Start2)
	transmit.log('Start2:', start2, '('..sv.Start2..')', 'Duration still:', sv.cur2)
	if minute >= start2 and minute < start2 + tonumber(sv.Duration2) and ss.value == 'OFF' then
		setSwitch(ss, 'ON')
		sv.cur2 = tonumber(sv.Duration2)
		saveServices()
		transmit.send(M.thing, M.services)		-- update panels with both services
	end
end

stToMin = function(Start)
	local st = split(Start, ':')
	return tonumber(st[1]*60 + tonumber(st[2]))
end

saveServices = function()
	file.putcontents('services.json', sjson.encode(M.services))
end
	

return M
