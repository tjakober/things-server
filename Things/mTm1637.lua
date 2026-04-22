local M = {
    thing = 'TM1637 Display',
    description = '4 Digit 7 Segment Display using tm1637 ic',
    services = {
        name = '4 Digit Display',
        type = 'display',
        value = 0,
        brightness = 6,
        dp = 1,
        pinClk = 1,
        pinDio = 2
    }
}

tm1637 = require('tm1637')

local display = function(v)
    local sv = M.services[1]
	tm1637.clear()
	if sv.datatype == 'string' then
		tm1637.write_string(v)
	else
		local f = '%'..4-sv.dp..'.'..sv.dp..'f'
		--print('['..string.format(f, v)..']', f)
		print(string.format(f, v))
		tm1637.write_string(string.format(f, v))
	end
end

M.init = function(callback)
    local sv = M.services[1]
    tm1637.init(sv.pinClk, sv.pinDio)
    tm1637.set_brightness(tonumber(sv.brightness))
    callback(M.thing)
end

M.registered = function()
    display('0.00')
end

M.set = function(data, from)
    -- set display value
    local sv = M.services[1]
    for i,ss in ipairs(data) do
        if ss.name == sv.name then
            if sv.para then
                if sv.para == 'brightness' then
                    tm1637.brightness(tonumber(sv[sv.para]))
                end
            else
				sv.value = ss.value
				display(sv.value)
				if from ~= nil then
					local oData = {
						cmd = 'data',
						type = 'node',
						thing = M.thing,
						nodeId = M.nodeId,
						time = time(),
						from = from,
						services = {}
					}
					table.insert(oData.services, sv)
					--tprint(data)
					transmit.sendRaw(oData)
				end
            end
        end
    end
    return nil
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
    