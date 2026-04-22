local M = {
	thing = 'indicator',
	pin_red = 5,
	pin_green = 6, 
	interval = 10,
	blink = 100,
	services = {
		{
			name = 'red',
			value = 0
		},
		{
			name = 'green',
			value = 0
		}
	}
}

M.vRed = M.services[1].value
M.vGreen = M.services[2].value
local tmR = tmr.create()
local tmG = tmr.create()

M.init = function(callback)
	gpio.mode(M.pin_red, gpio.OUTPUT)
	gpio.write(M.pin_red, gpio.HIGH)
	gpio.mode(M.pin_green, gpio.OUTPUT)
	gpio.write(M.pin_green, gpio.HIGH)
	transmit.commCall = function()
		print('Blink!')
		M.blinkRed()
	end
	print("Indicator initialized")
	callback(M.thing)
end	

M.registered = function()
	print("Indicator registered")
	M.setGreen(1)
end

M.setRed = function(v)
	if v then
		if M.vGreen then
			gpio.write(M.pin_green, gpio.HIGH)
			vGreen = 0
		end
		gpio.write(M.pin_red, gpio.LOW)
	else
		gpio.write(M.pin_red, gpio.HIGH)
	end
end

M.setGreen = function(v)
	if v then
		if M.vRed then
			gpio.write(M.pin_red, gpio.HIGH)
			vRed = 0
		end
		gpio.write(M.pin_green, gpio.LOW)
	else
		gpio.write(M.pin_green, gpio.HIGH)
	end
end

M.blinkRed = function()
	if vGreen then
		gpio.write(M.pin_green, gpio.HIGH)
	end
	gpio.write(M.pin_red, gpio.LOW)
	tmR:register(M.blink, tmr.ALARM_SINGLE, function()
		gpio.write(M.pin_red, gpio.HIGH)
		if M.vGreen then
			gpio.write(M.pin_green, gpio.LOW)
		end
	end)
	tmR:start()
end
	
M.blinkGreen = function()
	if vRed then
		gpio.write(M.pin_red, gpio.HIGH)
	end
	gpio.write(M.pin_green, gpio.LOW)
	tmG:register(M.blink, tmr.ALARM_SINGLE, function()
		gpio.write(M.pin_green, gpio.HIGH)
		if M.vRed then
			gpio.write(M.pin_red, gpio.LOW)
		end
	end)
	tmG:start()
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
