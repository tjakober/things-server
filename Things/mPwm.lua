-- Module for LED Pulse Width Modulation
local M = {
	thing = 'LED PWM',
	description = 'Drive LEDs with pulse width modulation',
	pwmFreq = 500,
	saveState = false,
	services = { --[[
		{
			name = 'LED 1 PWM',
			type = 'Input',
			datatype = 'number',
			value = 0,
			vsave = 0,
			state = 'ON',
			pin = 5,
			stptm = 20,
			x = 0,
			rotary_ch = 0,
			rotary_a  = 6,
			rotary_b  = 7,
			rotary_sw = 1
		} ]]--
	}
}
M.timers = {}

local function saveServices()
	if M.saveState == true then
		file.putcontents('svPwm.json', sjson.encode(M.services))
	end
end

local setTo = function(sv)
	local function slow()
		--print('sv.v=', sv.v, ' sv.x=', sv.x)
		if sv.v < sv.x then
			sv.v = sv.v + 1
		end
		if sv.v > sv.x then
			sv.v = sv.v - 1
		end
		pwm.setduty(sv.pin, sv.v * 10)
		if sv.v == sv.x then
			M.timers[sv.index]:stop()
			sv.value = sv.x
			print('timer stopped, sv.value=', sv.value)
			M.data({sv})
		end
	end
	sv.v = sv.value
	print(sv.v, sv.value)
	M.timers[sv.index]:register(sv.stptm, tmr.ALARM_AUTO, slow)
	M.timers[sv.index]:start()
	transmit.log('timer['..sv.index..']', M.timers[sv.index]:state())
end
M.tm = tmr.create()
M.tm:register(2000, tmr.ALARM_SEMI, function()
	--print('sv.value='..sv.value)
	transmit.send(M.thing, M.services)
end)

--[[
local setupRotary = function(sv)
	turn = function(type, pos, when)
		--print(type, pos, when, sv.value)
		if type == rotary.TURN then
			local diff = pos - sv.last 
			sv.last = pos
			if sv.state == 'ON' then
				print(sv.value, pos, sv.last, diff)
				sv.value = math.min(math.max(sv.value + diff, 0), 100)
				pwm.setduty(sv.pin, sv.value * 10)
				M.tm:start()
			end
		end
	end
	rotary.setup(sv.rotary_ch, sv.rotary_a, sv.rotary_b)
	rotary.on(sv.rotary_ch, rotary.TURN, turn)
end
]]--

local setupRotary = function(sv)
	local turna = function(level, when, count)
		local diff = math.floor(when - sv.w)
		sv.w = when
		if diff < 10000 then return end
		local a = level
		local b = gpio.read(sv.rotary_b)
		local direction = 0
		if a == 1 and  b == 0 then
			direction = 1
		elseif b == 1 and a == 0 then
			direction = -1
		end
		--print('turna', a, b, direction, sv.value + direction, level, when, diff)
		if sv.state == 'ON' and direcion ~= 0 then
			sv.value = math.min(math.max(sv.value + direction, 0), 100)
			pwm.setduty(sv.pin, sv.value * 10)
			M.tm:start()
		end
	end
	local turnb = function(level, when, count)
		local diff = math.floor(when - sv.w)
		sv.w = when
		if diff < 10000 then return end
		local a = gpio.read(sv.rotary_a)
		local b = level
		if a == b then return end
		local direction = 0
		if b == 1 and a == 0 then
			direction = -1
		elseif a == 1 and b == 0 then
			direction = 1
		end
		--print('turnb', a, b, direction, sv.value + direction, level, when, diff)
		if sv.state == 'ON' and direcion ~= 0 then
			sv.value = math.min(math.max(sv.value + direction, 0), 100)
			pwm.setduty(sv.pin, sv.value * 10)
			M.tm:start()
		end
	end
	sv.w = 0
	gpio.mode(sv.rotary_a, gpio.INT, gpio.FLOAT)
	gpio.trig(sv.rotary_a, "up", turna)
	gpio.mode(sv.rotary_b, gpio.INT, gpio.FLOAT)
	gpio.trig(sv.rotary_b, "up", turnb)
end
		
M.init = function(callback)	
	if file.exists('svPwm.json') then
		M.services = sjson.decode(file.getcontents('svPwm.json'))
	end
	for i, sv in ipairs(M.services) do
		sv.x = 0
		sv.y = 0
		sv.index = i
		pwm.setup(sv.pin, M.pwmFreq, sv.value)
		pwm.start(sv.pin)
		setupRotary(sv)
		M.timers[i] = tmr.create()
	end
	transmit.log(#M.services .. ' PWM LED initialized')
	callback(M.thing)
end

M.set = function(data)
	-- set pulse width (value is between 0 and 100%)
	local chg = false
    for i,ss in ipairs(data) do
        for k,sv in ipairs(M.services) do
            if ss.name == sv.name then
				transmit.log('PWM received set to value '..ss.value, sv.value)
				if ss.value == 'OFF' then
					if sv.state ~= 'OFF' then
						sv.state = ss.value
						sv.vsave = sv.value
						sv.x = 0
						setTo(sv)
						chg = true
					end
				elseif ss.value == 'ON' then
					if sv.state ~= 'ON' then
						sv.state = ss.value
						sv.value = 0
						sv.x = sv.vsave
						setTo(sv)
						chg = true
					end
                elseif ss.value ~= nil then
					local value = tonumber(ss.value)
					if value == 0 then
						if sv.state == 'ON' then
							print('set switch off')
							transmit.things.mSwitch.set({{name = 'Rotary Switch', value = 'OFF'}})
							sv.state = 'OFF'
						end
					else
						if sv.state == 'OFF' then
							print('set switch on')
							transmit.things.mSwitch.set({{name = 'Rotary Switch', value = 'ON'}})
							sv.state = 'ON'
						end
					end
                    transmit.log('Set '..ss.name..' to '..ss.value)
					sv.x = math.min(math.max(value, 0), 100)  -- Target Value
                    setTo(sv)
					chg = true
                end
            end
        end
    end
	if chg then
		saveServices()
		-- M.data(M.services)	-- send new value to other displays
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
