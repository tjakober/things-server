---- bme280 barometer / hygrometer
local M = {
	thing = 'Barometer / Hygrometer',
	sda = 2,
	scl = 1, 
	interval = 1,
	services = {
		{
			name = 'Air Pressure',
			type = 'Output',
			datatype = 'number',
			value = '0.0',
			altitude = 0,
			p24h = {}
		},
		{
			name = 'Air Humidity',
			type = 'Output',
			datatype = 'number',
			value = '0.0'
		},
		{
			name = 'Dewpoint',
			type = 'Output',
			datatype = 'number',
			value = '0.0'
		},
		{
			name = 'Temperature',
			type = 'Output',
			datatype = 'number',
			value = '0.0'
		},
	}
	
}

local timer, readout, cycllocal 
--bme280 = require('bme280')

M.init = function(callback)
	i2c.setup(0, M.sda, M.scl, i2c.SLOW)
	bme280.setup()
	callback(M.thing)
end

local start = function()
	if file.exists('p24h.json') then
		local t = sjson.decode(file.getcontents('p24h.json'))
		M.services[1].p24h = t
	end
	readout(true)
	timer:start()
end

M.registered = function()
	if bme280 == nil then
		-- no sensor
		transmit.log('"---> No Pressure Sensor found"\n')
		local tm = tmr.create()
		tm:register(20 * 1000, tmr.ALARM_SINGLE, function()
			transmit.nodereboot()
		end)
		tm:start()
	else
		transmit.log('mBme280 module found, registered')
		if file.exists('altitude') then
			M.services[1].altitude = tonumber(file.getcontents('altitude'))
			transmit.log('load altitude from file:', M.services[1].altitude..'m')
		end
		start()
	end
end



local ssv = {}
local function update(ix, value)
	if value == nil then return end		-- probably BMP280 humidity
	local change = 0
	local upd = false
	local sv = M.services[ix]
	if tonumber(sv.value) > tonumber(value) + 1 then
		change = 1
	end
	if tonumber(sv.value) < tonumber(value) - 1 then
		change = -1
	end
	--change = tonumber(string.format("%4.1f", tonumber(sv.value) - tonumber(value)))
	if math.abs(change) > 0 then
		upd = true
	end
	sv.change = change
	if upd or getTime().min == 0 then
		sv.value = string.format('%4.1f', value)
		table.insert(ssv, sv)
	end
end

readout = function(initial)
	local ap, ah, dp, tp = 1,2,3,4
	print(tonumber(M.services[ap].altitude))
	local t, p, h, qnh = bme280.read(tonumber(M.services[ap].altitude))
	transmit.log('t,p,h,qnh,alt=',t,p,h,qnh,M.services[ap].altitude)
	local tn = t/100
	local pn = p/1000
	local hn = 0
	if h ~= nil then
		hn = h/1000		-- is BME280
	else
		if initial then
			transmit.log('Only BMP280 installed, no humidity value available')
		end
	end
	qnhn = qnh/1000
	
	ssv = {}
	update(tp, tn)
	update(ap, qnhn)
	update(ah, hn)
	if h ~= nil then					-- no humidity on BMP280
		local dn = bme280.dewpoint(h, t) / 100		
		update(dp, dn)
	end
	tm = getTime()
	if tm.min == 0 and not initial then
		M.services[1].p24h['h'..tm.hour] = M.services[1].value		-- save value every full hour
		file.putcontents('p24h.json', sjson.encode(M.services[1].p24h))
	end
	transmit.log('Barometer update '..#ssv..' services')
end

cycle = function()
	readout()
	if #ssv > 0 then
		transmit.send(M.thing, ssv)
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
				if ss.name == 'Air Pressure' then
					if para == 'altitude' then
						transmit.log('Set altitude to '..sv.value)
						ss[para] = sv.vlaue
					end
				end
            end
        end
    end
end

timer = tmr.create()
timer:register(M.interval * 60 * 1000, tmr.ALARM_AUTO, cycle)


return M 
