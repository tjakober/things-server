-- Switch module
local M = {    
	thing = 'Switch',
    description = 'Test Switch and Mail services',
    services = {
    }
}

local digVal = function(value)
	if value == 'ON' then
		return gpio.HIGH
	else
		return gpio.LOW
	end
end

local saveServices = function()
	file.putcontents('svSwitch.json', sjson.encode(M.services))
end

local setSwitch = function(ss, value)
    if ss.pin ~= nil then
        if value == 'TOGGLE' then
            if ss.value == 'OFF' then
                value = 'ON'
            else
                value = 'OFF'
            end
        end
        ss.value = value
		if ss.value == 'ON' then
			gpio.write(ss.pin, gpio.HIGH)
		else
			gpio.write(ss.pin, gpio.LOW)
		end
		saveServices()
        transmit.log('Setswitch', ss.name, ss.value)
		transmit.send(M.thing, {ss})		
    end       
end

local switch = function(sv, level, when)
	--print("pin " .. mSwitch.services[sv].switchAssoc .. ' pressed')
	local d = when - sv.ts
	-- prevent switch bouncing, accept only interrupts after 1000000 microseconds (1 second)
	if d > 1000000 or when < sv.ts then
		sv.ts = when
		setSwitch(sv, 'TOGGLE')
	end
end

local setupToggleSwitch = function(sv)
    gpio.mode(sv.switchAssoc, gpio.INT, gpio.PULLUP)
    gpio.trig(sv.switchAssoc, "up", function(level, when) switch(sv, level, when) end)
end

M.init = function(callback)
	transmit.config.mSwitch()
	if file.exists('svSwitch.json') then
		M.services = sjson.decode(file.getcontents('svSwitch.json'))
	end
	for i, sv in ipairs(M.services) do
		gpio.mode(sv.pin, gpio.OUTPUT, gpio.PULLUP)
		gpio.write(sv.pin, digVal(sv.value))
		setupToggleSwitch(sv)
	end
	transmit.log(#M.services .. ' Switches initialized')
	callback(M.thing)
end

M.set = function(services)
    local i, k, sv, ss
    for i, sv in ipairs(services) do
        for k, ss in ipairs(M.services) do
            if sv.name == ss.name then
				transmit.log('Set switch'..ss.name..' '..sv.value)
                setSwitch(ss, sv.value)
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

