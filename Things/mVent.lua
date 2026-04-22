-- mVent  Ventilatorsteuerung
M = {
	thing = 'Ventilation',
	interval = 1,
	services = {
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

local timer = 1
local stToMin, saveServices, setTarget
local oTimer = tmr.create()
local minutes, minute, setSwitch, setToggleSwitch, split, saveServices, stToMin

M.init = function(callback)
	if file.exists('vent.json') then
		M.services = sjson.decode(file.getcontents('vent.json'))
	end
	
	-- Setup Timer
	oTimer:register(60*1000, tmr.ALARM_AUTO, minutes)
	oTimer:start()
	transmit.log('Timer initialized')
	callback(M.thing)
end

M.registered = function()
	transmit.log('"registered" called')
	local tm = getTime()
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

M.stop = function()
	oTimer:stop()
	oTimer:unregister()
	gpio.trig(M.services[1].swAssoc, 'down')
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
	local ss = transmit.things.mSwitch.services[1]
	minute = minute + 1
	if minute >= 24 * 60 then
		minute = 0
	end
	if tonumber(sv.cur) > 0 then
		sv.cur = tonumber(sv.cur) - 1
		if sv.cur == 0 then
			setTarget(sv.target, sv.node, 'OFF')
		end
		--saveServices()
		transmit.send(M.thing, M.services)		-- update panels with both services
	end
	if tonumber(sv.cur2) > 0 then
		sv.cur2 = tonumber(sv.cur2) - 1
		if sv.cur2 == 0 then
			setTarget(sv.target, sv.node, 'OFF')
		end
		--saveServices()
		transmit.send(M.thing, M.services)		-- update panels with both services
	end
	transmit.log('Minute '..minute, '('..math.floor((minute)/60)..':'..((minute)%60)..')')
	local st = split(sv.Start, ':')
	local start = stToMin(sv.Start)
	transmit.log('Start:', start, '('..sv.Start..')', 'Duration still:', sv.cur)
	if minute >= start and minute < start + tonumber(sv.Duration) and ss.value == 'OFF' then
		setTarget(sv.target, sv.node, 'ON')
		sv.cur = tonumber(sv.Duration)
		--saveServices()
		transmit.send(M.thing, M.services)		-- update panels with both services
	end
	local start2 = stToMin(sv.Start2)
	transmit.log('Start2:', start2, '('..sv.Start2..')', 'Duration still:', sv.cur2)
	if minute >= start2 and minute < start2 + tonumber(sv.Duration2) and ss.value == 'OFF' then
		setTarget(sv.target, sv.node, 'ON')
		sv.cur2 = tonumber(sv.Duration2)
		--saveServices()
		transmit.send(M.thing, M.services)		-- update panels with both services
	end
end

setTarget = function(target, node, state)
	--print('Set target '..target..' on Node '..node..' to '..state)
	if transmit.nodeId == node then
		for dev, thing in pairs(transmit.things) do
			for k, sv in ipairs(thing.services) do
				if sv.name == target then
					transmit.log('local device '..target..' set '..state)
					local ssv = {
						name = sv.name,
						value = state
					}
					thing.set({ssv})
				end
			end
		end
	else
		transmit.log('remote device '..target..' set '..state)
		local oData = {
			cmd = 'set',
			type = 'control',
			from = M.nodeId,
			to = node,
			services = {{name = target, value = state}}
		}
		transmit.sendRaw(oData)
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

M.set = function(services)
    local i, k, sv, ss
    for i, sv in ipairs(services) do
        for k, ss in ipairs(M.services) do
            if sv.name == ss.name then
				if sv.name == 'Timer' then
					if sv.para == 'Duration' or sv.para == 'Duration2' then
						transmit.log('Set '..sv.para..' to '..sv.value)
						ss[sv.para] = sv.value
						saveServices()
					end
				end
            end
        end
    end
end

stToMin = function(Start)
	local st = split(Start, ':')
	return tonumber(st[1]*60 + tonumber(st[2]))
end

saveServices = function()
	file.putcontents('vent.json', sjson.encode(M.services))
end	

return M
