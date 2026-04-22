-- Second timer module: Module to handle intervals of seconds
local M = {
	index = 0,
	timers = setmetatable({}, {__mode="k"})
}

local errlist = {'timer not found', 'no callback specified'}
local terror = function(n, ...)
	print(errlist[n], ...)
end

local findTm = function(t)
	local i, v
	for i, v in ipairs(M.timers) do
		if v.index == t then
			return v
		end
	end
	terror(1, t)
end

M.register = function(type, interval, cb)
	-- type 1 = single auto (timer starts automatically, fires one time, then stops and unregisters)
	-- type 2 = single manual (timer starts after call M.start(), fires one time, then stops and can be restarted with M.start() )
	-- type 3 = repeating (timer fires after timeout and restarts automatically)
	local ix = M.index + 1
	M.index = ix
	table.insert(M.timers, {
		index = M.index,
		type = type,
		interval = interval,
		current = 0,
		callback = cb
	})
	if type == 1 then
		M.start(ix)
	end
	return M.timers[#M.timers].index
end

M.start = function(t, intv)
	local tm = findTm(t)
	if intv == nil then
		tm.current = tm.interval
	else
		tm.interval = intv
		tm.current = intv
	end
end

M.stop = function(t)
	local tm = findTm(t)
	tm.current = 0
	if tm.type == 1 then
		M.unregister(tm.index)
	end
end

M.unregister = function(t)
	local tm = findTm(t)
	table.remove(M.timers, tm.index)
end

local sec = tmr.create()
sec:register(1000, tmr.ALARM_AUTO, function()
	local i, v, cb
	-- scan over all registered timers 
	if (#M.timers > 0) then
		for i, v in ipairs(M.timers) do
			-- print('timer '..i..' interval: '..v.interval..' current: '..v.current..' type: '..v.type)
			if v.current > 0 then
				v.current = v.current - 1
				if v.current == 0 then
					cb = v.callback
					if cb == nil then tprint(v) tprint(M.timers) end
					if v.type == 3 then
						v.current = v.interval
					end
					if v.type == 1 then
						M.unregister(v.index)
					end
					cb()
				end
			end
		end
	end
end)
sec:start()

return M


