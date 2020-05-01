-- PIR / Radar Sensor
local M = {
	thing = 'PIR / Radar Sensor',
	services = {}
}

local start, minute, setTarget, svadc, brightness

local saveServices = function()
	file.putcontents('svPir.json', sjson.encode(M.services))
end

minute = function()
	local ssv = {}
	for i, sv in ipairs(M.services) do
		if sv.name == 'Light Sensor' then
			if M.brightness() then
				table.insert(ssv, sv)
			end
		else
			sv.rest = tonumber(sv.rest)
			if sv.rest > 0 then
				sv.rest = sv.rest - 1
				transmit.log('Sensor '..sv.name..' still '..sv.rest..' min')
				if sv.rest == 0 then
					if sv.rest then
						gpio.write(sv.pinIndicator, gpio.LOW)
					end
					setTarget(sv.target, sv.node, 'OFF')
				end
				table.insert(ssv, sv)
			end
		end
	end
	if #ssv > 0 then
		transmit.send(M.thing, ssv)
	end
end

local min = tmr.create()
min:register(60000, tmr.ALARM_AUTO, minute)

M.brightness = function()
	local v = math.floor(100 - ((adc.read(0) - svadc.light) / (svadc.dark - svadc.light) * 100))
	local changed = (v ~= svadc.value)
	svadc.value = v
	transmit.log('Brightness is '..svadc.value..'%')
	return changed
end	

M.init = function(callback)
	if file.exists('svPir.json') then
		M.services = sjson.decode(file.getcontents('svPir.json'))
	else
		transmit.config.mPir()
	end
	if adc.force_init_mode(adc.INIT_ADC) then
		node.restart()
	end
	for i, sv in ipairs(M.services) do
		if sv.name == 'Light Sensor' then
			svadc = sv
		else
			gpio.mode(sv.pin, gpio.INT, gpio.FLOAT)
			gpio.trig(sv.pin, 'up', function()
				start(sv)
			end)
			if sv.pinIndicator then
				gpio.mode(sv.pinIndicator, gpio.OUTPUT, gpio.PULLUP)
				gpio.write(sv.pinIndicator, gpio.LOW)
			end
		end
		transmit.log('Sensor '..sv.name..' initialized')
	end
	M.brightness()
	callback(M.thing)
end

M.registered = function()
	transmit.log('Module mPir registered')
	min:start()
end

start = function(sv)
	transmit.log('Sensor '..sv.name..' has detected something')
	if svadc.value < tonumber(svadc.onbelow) then
		sv.rest = sv.duration
		if sv.pinIndicator then
			gpio.write(sv.pinIndicator, gpio.HIGH)
		end
		setTarget(sv.target, sv.node, 'ON')
	else
		transmit.log("it's too light to switch on")
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
		transmit.log('remote device ', target, ' set ', state)
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

M.set = function(services)
    local i, k, sv, ss
	local sss = {}
    for i, sv in ipairs(services) do
        for k, ss in ipairs(M.services) do
            if sv.name == ss.name then
				if sv.para then
					transmit.log('Set '..sv.para..' of '..ss.name..' to '..sv.value)
					ss[sv.para] = sv.value
				else
					transmit.log('Set value of '..ss.name..' to '..sv.value)
				end
				table.insert(sss, ss)
            end
        end
    end
	if #sss > 0 then
	saveServices()
		transmit.send(M.thing, sss)
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