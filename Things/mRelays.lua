-- Relays module
-- Switch on and off a relay
local M = {
	thing = 'Relays',
	description = 'Switch on and off a relay',
	
	services = { --[[
        {
			name = 'Pumpe',
			type = 'Relay',
			datatype = 'Text',
			pin = 6,
			value = 'OFF'
        } ]]--
	}
}

local saveServices = function()
	if M.saveState == true then
		file.putcontents('svRelays.json', sjson.encode(M.services))
	end
end

local setRelay = function(ss, value)
	transmit.log('SETRELAY', value)
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
			if ss.invert == true then
				gpio.write(ss.pin, gpio.LOW)
			else
				gpio.write(ss.pin, gpio.HIGH)
			end
		else
			if ss.invert == true then
				gpio.write(ss.pin, gpio.HIGH)
			else
				gpio.write(ss.pin, gpio.LOW)
			end
		end
		saveServices()
        transmit.log('SETRELAY set to '..ss.name..', '..ss.value..' ('..value..')')
		if transmit.initPhase == true then
			transmit.log('in init phase, do not send message')
		else
			transmit.send(M.thing, {ss})
		end
    end       
end

M.set = function(data)
	-- set relay from remote
    local sr = {}
    for i,ss in ipairs(data) do
        for k,sv in ipairs(M.services) do
            if ss.name == sv.name then
                if ss.para == nil then
                    transmit.log('Set '..ss.name..' to '..ss.value)
					setRelay(sv, ss.value)
                else
                    transmit.log('Set '..ss.name..'->'..ss.para..' to '..ss.value)
                    sv[ss.para] = ss.value
                    table.insert(sr, sv)
                end
            end
        end 
    end
    saveServices()
    if #sr == 0 then
        return nil
    else 
        return sr
    end
end

M.init = function(callback)
	if file.exists('svRelays.json') then
		M.services = sjson.decode(file.getcontents('svRelays.json'))
	end
	for i, sv in ipairs(M.services) do
		transmit.log('Initialize relay '..sv.name..' on pin '..sv.pin..' to '..sv.value)
		gpio.mode(sv.pin, gpio.OUTPUT, gpio.PULLUP)
		setRelay(sv, sv.value)
	end
	transmit.log(#M.services .. ' Relays initialized')
	callback(M.thing)
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
