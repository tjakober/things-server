-- PIR / Radar Sensor Allows to send control messages to a light switch and turn it on for a time
local M = {
	--thing = 'PIR and Light Sensor',
	--description = 'Standalone PIR Sensor',
	--ssv = true, --Save Services
--[[
	services = {
        {
            name = 'Light Sensor',
            value = 0,
            onbelow = 20,
            light = 1024,
            dark = 0
        },
        {
            name = 'PIR Sensor',
			value = 'ON', 		-- active / inactive
            pin = 1,
            pinIndicator = 3,	-- red led
			pinActive = 4,		-- green led
            retrigger = true,
            duration = 3,
            rest = 0,
            target = 'Main Light',
            node = transmit.nodeId   --target is local switch
        }
	} ]]--
}

local start, minute, setTarget, svadc, svpir, brightness, isRemote

local saveServices = function()
	if M.ssv then
		file.putcontents('svPir.json', sjson.encode(M.services))
	end
end

local nSec = 0
local ssv = {}

local lton = function (par) 
	if par then 
		return 1 
	else 
		return 0 
	end
end

local second = function ()	
	if #ssv > 0 then
		-- send scheduled messages
		transmit.send(M.thing, ssv)
		ssv = {}
	end
	for i, sv in ipairs(M.services) do
		if sv.name == 'Light Sensor' then
			if (nSec % 2) == 0 then
				if M.brightness() then
					--setTarget(svpir.target, sv.node, 'ON')
					table.insert(ssv, sv)		-- schedule message for next second
				end
			end
		else
			if (nSec % 60) == 0 then
				sv.rest = tonumber(sv.rest)
				if sv.rest > 0 then
					sv.rest = sv.rest - 1
					transmit.log('Sensor '..sv.name..' still '..sv.rest..' min')
					if sv.rest == 0 then
						print('Switch OFF')
						setTarget(sv.target, sv.node, 'OFF')
					end
					table.insert(ssv, sv)		-- schedule message for next second
				end
			end
		end
	end
	nSec = nSec + 1
	if nSec == 60 then
		nSec = 0
	end
end

local indTm = tmr.create()

local indicate = function(sv)
	local stop = function()
		gpio.write(sv.pinIndicator, gpio.HIGH)
		if sv.pinActive then
			gpio.write(sv.pinActive, lton(sv.value=='OFF'))
		end
	end
	if sv.pinIndicator then
		if sv.pinActive then
			gpio.write(sv.pinActive, gpio.HIGH)  -- Switch active indicator OFF during motion indicator  
		end
		indTm:register(500, tmr.ALARM_SINGLE, stop)
		gpio.write(sv.pinIndicator, gpio.LOW)
		indTm:start()
	end
end

local activate = function(sv, value)
	if value then
		if value == 'TOGGLE' then
			if sv.value == 'OFF' then
				sv.value = 'ON'
			else
				sv.value = 'OFF'
			end
		else
			sv.value = value
		end
	end
	gpio.write(sv.pinActive, lton(sv.value=='OFF'))
	M.data({sv})
end

local sec = tmr.create()
sec:register(1000, tmr.ALARM_AUTO, second)

local tol = 2;
M.brightness = function()
	local v = math.floor(((adc.read(0) - svadc.light) / (svadc.dark - svadc.light) * 100))
	local changed = (v > svadc.value+tol or v < svadc.value-tol)
	svadc.value = v
	--transmit.log('Brightness is '..svadc.value..'%')
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
			-- setup PIR sensor
			svpir = sv
			gpio.mode(sv.pin, gpio.INT, gpio.FLOAT)
			gpio.trig(sv.pin, 'up', function()
				start(sv)
			end)
			if sv.pinActive then
				gpio.mode(sv.pinActive, gpio.OUTPUT, gpio.FLOAT)
				gpio.write(sv.pinActive, lton(sv.value=='OFF'))
			end
			if sv.pinIndicator then
				gpio.mode(sv.pinIndicator, gpio.OUTPUT, gpio.FLOAT)
				gpio.write(sv.pinIndicator, gpio.HIGH)
			end
		end
		transmit.log('Sensor '..sv.name..' initialized')
	end
	M.brightness()
	callback(M.thing)
end

M.registered = function()
	transmit.log('Module mPir registered')
	sec:start()
end

start = function(sv)
	transmit.log('Sensor '..sv.name..' has detected something ')
	indicate(sv)
	if sv.value == 'OFF' then return end
	if svadc.value < tonumber(svadc.onbelow) then
		transmit.log(svadc.value, svadc.onbelow, "it's dark", sv.rest)
		if sv.rest == 0 then
			print('switch on')
			sv.rest = sv.duration
			setTarget(sv.target, sv.node, 'ON')
			table.insert(ssv, sv) -- message will be sent next second
		else
			if sv.retrigger then
				print('retrigger?')
				sv.rest = sv.duration
				table.insert(ssv, sv) -- message will be sent next second
			end
		end
	else
		transmit.log(svadc.value, svadc.onbelow, "it's light")
		sv.rest = tonumber(sv.rest)
		if sv.retrigger and (sv.rest > 0) then
			print('retrigger')
			sv.rest = sv.duration
			table.insert(ssv, sv) -- message will be sent next second
		else
			transmit.log("it's too light to switch on")
		end
	end
end

setTarget = function(target, node, state)
	print('Set target ',target,' on Node ',node,' to ',state)
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
		transmit.log('remote device ',target,' set ',state)
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
	for i, sv in ipairs(M.services) do
        for k, ss in ipairs(services) do
            if sv.name == ss.name then
				--tprint(ss)
				if ss.para then
					transmit.log('Set '..ss.para..' of '..sv.name..' to '..ss.value)
					sv[ss.para] = ss.value
				else
					transmit.log('Set value of '..ss.name..' to '..ss.value)
					activate(sv, ss.value)
				end
           end
        end
    end
	saveServices()
	transmit.send(M.thing, M.services)
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
