-- Switch module
-- Handles toggle Switches with bouncing suppression
-- and supports associated indicator light
-- Switch action can be sent to a remote thing eg switch or relay

local M = {    
	thing = 'Switch',
    description = 'Handles Switches with associated indicator led',
    services = { --[[   
		{
			name = 'Pumpe',
			type = 'Switch',
			datatype = 'Text',
			pin = 1,
			value = 'OFF',
			switchAssoc = 3,
			ts = 0
		} ]]--
    }
}

local saveServices = function()
	if M.saveState == true then
		file.putcontents('svSwitch.json', sjson.encode(M.services))
	end
end

local setSwitch = function(ss, value)
	transmit.log('SETSWITCH '..value)
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
        transmit.log('SETSWITCH set to '..ss.name..', '..ss.value..' ('..value..')')
		if transmit.initPhase then
			transmit.log('in init phase, do not send message')
		else
			transmit.send(M.thing, {ss})
		end
    end       
end

setTarget = function(target, node, state)
	-- used to send the switch action to a remote switch or relay
	transmit.log('Set target '..target..' on Node '..node..' to '..state)
	if transmit.nodeId == node then
		for dev, thing in pairs(transmit.things) do
			--print('> ', dev, thing)
			for k, sv in ipairs(thing.services) do
				--print(sv.name)
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
		transmit.log('remote device "'..target..'" set '..state)
		local oData = {
			cmd = 'set',
			type = 'control',
			from = M.nodeId,
			to = node,
			services = {{name = target, value = state}}
		}
        local tm = tmr.create()
        tm:alarm(100, tmr.ALARM_SINGLE, function()
            transmit.sendRaw(oData)
        end)
	end
end

local setupToggleSwitch = function(sv)
	local function toggle(level, when, count)
		local d = when - sv.ts
		-- prevent switch bouncing, accept only interrupts after 1000000 microseconds (1 second)
		if d > 1000000 or when < sv.ts then
            transmit.log("pin " .. sv.switchAssoc .. ' pressed')
			sv.ts = when
			setSwitch(sv, 'TOGGLE')
			if sv.target then
                setTarget(sv.target, sv.node, sv.value)
			end
		end
	end
	
	if sv.switchType == 'Shelly 1' then
		gpio.mode(sv.switchAssoc, gpio.INT, gpio.FLOAT)
		gpio.trig(sv.switchAssoc, "both", function(level, when)
			transmit.log('Switch changed to '..level)
			switch(sv, level, when) 
		end)
		transmit.log('Switch Type Shelly initialized')	
	else
		gpio.mode(sv.switchAssoc, gpio.INT, gpio.PULLUP)
		--gpio.trig(sv.switchAssoc, "up", function()print('switch pressed')end)
		gpio.trig(sv.switchAssoc, "up", toggle)
		transmit.log('setupToggleSwitch: Listen on pin '..sv.switchAssoc..' as toggle switch')
	end
end

M.init = function(callback)
	if file.exists('svSwitch.json') then
		M.services = sjson.decode(file.getcontents('svSwitch.json'))
	end
	for i, sv in ipairs(M.services) do
		transmit.log('Initialize switch '..sv.name..' on pin '..sv.pin..' to '..sv.value)
		gpio.mode(sv.pin, gpio.OUTPUT, gpio.PULLUP)
		setSwitch(sv, sv.value)
		setupToggleSwitch(sv)
	end
	transmit.log(#M.services .. ' Switches initialized')
	callback(M.thing)
end

M.set = function(data)
    local sr = {}
    for i,ss in ipairs(data) do
        for k,sv in ipairs(M.services) do
            if ss.name == sv.name then
                if ss.para == nil then
                    transmit.log('Set '..ss.name..' to '..ss.value)
					setSwitch(sv, ss.value)
					if sv.target then
						setTarget(sv.target, sv.node, sv.value)
					end
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
