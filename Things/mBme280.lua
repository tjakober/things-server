-- bme280 barometer / hygrometer
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

local readout, cycle

M.init = function(callback)
	transmit.config.mBme280()
	i2c.setup(0, M.sda, M.scl, i2c.SLOW)
	local c
	local s = bme280.setup()
	if s == 1 then
		c = 'P'
	elseif s == 2 then
		c = 'E'
	else
		transmit.log('No Pressure Sensor found')
		return
	end
	transmit.log('BM'..c..'280 module found')
	readout()
	if callback then
		callback(M.thing)
	end
end

M.registered = function()
	transmit.log('"registered mBme280" called')
	timer:start()
	--[[
	if file.exists('altitude.json') then
		transmit.log('load altitude from file')
		local alt = sjson.decode(file.getcontents('altitude.json'))
		service[1].altitude = math.floor(alt[1].elevation)
		timer:start()

	else
		http.get('https://ipinfo.io/json', nil, function(status, body, headers)
			if status < 0 then
				transmit.log('Failed to get the IP Location')
				return
			end
			print(body)
			local gl = sjson.decode(body)
			transmit.log('The device is in '..gl.city..', '..gl.country)
			http.get('http://api.opentopodata.org/v1/eudem25m?locations='..gl.loc, nil, function(status, body, headers)
				if status < 0 then
					transmit.log('Could not get the altitude')
					return
				end
				file.putcontents('geolocation.json', body)
				local alt = sjson.decode(body)
				transmit.log('Devices altitude is: ', alt[1].elevation)
				file.putcontents('altitude.json', body)
				service[1].altitude = math.floor(alt[1].elevation)
				timer:start()

			end)
		end)
	end]]--
	if file.exists('p24h.json') then
		local t = sjson.decode(file.getcontents('p24h.json'))
		M.services[1].p24h = t
	end
end

local ssv = {}
local function update(ix, value)
	local change = 0
	local upd = false
	local sv = M.services[ix]
	change = tonumber(sv.value) - tonumber(value)
	if math.abs(change) > 1 then
		upd = true
	end
	sv.change = change
	if upd or transmit.getTime().min == 0 then
		sv.value = string.format('%4.1f', value)
		table.insert(ssv, sv)
	end
end

readout = function()
	local ap, ah, dp, tp = 1,2,3,4
	local t, p, h, qnh = bme280.read(M.services[ap].altitude)
	print(t,p,h,qnh)
	ssv = {}
	update(tp, t/100)
	update(ap, qnh/1000)
	update(ah, h/1000)
	local d = bme280.dewpoint(h, t)
	update(dp, d/100)
	tm = transmit.getTime()
	if tm.min == 0 then
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