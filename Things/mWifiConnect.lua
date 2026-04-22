local M = {}

local tl = tmr.create()  -- watchdog timer for connection
tl:register(5000, tmr.ALARM_SINGLE, function()
	_G.log('Network connection timeout')
	node.restart()
end)

local apList, doConnect, isConnected, gotIp, disConneted

M.init = function(module)
	_G.log('Initialize Wireless')
	if module then
		M.module = module
	else
		M.module = 'transmit'
	end
	_G.log(M.module)
	wifi.eventmon.register(wifi.eventmon.STA_CONNECTED, M.isConnected)
	wifi.eventmon.register(wifi.eventmon.STA_GOT_IP, M.gotIp)
	wifi.setmode(wifi.STATION)
	wifi.sta.getap(1, M.apList)
end

M.apList = function(list)
	local ap = require('mAplist')
    local i, k, v
    local inx = 0
	local signal = -1000
	local myAp = {}
    for k,v in pairs(list) do
        local ssid, rssi, authmode, channel = string.match(v, "([^,]+),([^,]+),([^,]+),([^,]*)")
        -- find it in the ap list 
       for i=1, #ap do
            if ssid == ap[i].ssid then
                -- found, store the rssi
				print(ssid, k, rssi, authmode, channel)
				table.insert(myAp, {
					ssid = ssid,
					pwd = ap[i].pwd,
					bssi = k, 
					auto = false,
					save = false,
					rssi = tonumber(rssi), 
					authmode = authmode, 
					channel = tonumber(channel)
				})
				if myAp[#myAp].rssi > signal then
					signal = myAp[#myAp].rssi
					inx = #myAp
				end
            end
        end
    end
	if inx == 0 then
	    _G.log('no Acess Point found')
        node.restart()
	else
		M.doConnect(myAp[inx])  -- connect to Ap with highes signal
	end
end

M.doConnect = function(ap)
	_G.log('try connect to '..ap.ssid)
	wifi.sta.config(ap)
	wifi.sta.connect()
end

M.isConnected = function(oResult)
	_G.log('Connected to '..oResult.SSID)
	wifi.eventmon.register(wifi.eventmon.STA_DISCONNECTED, M.disConneted)
end


M.gotIp = function(oResult)
    tl:unregister()
	_G.log('got IP Address '..oResult.IP..' gateway ..'..oResult.gateway)
	_G[M.module] = require(M.module)
	_G[M.module].init()
end

M.isDisonneted = function(oResult)
	_G.log('Disconnected from Station '..oResult.SSID..' Reason: '..oResult.reason)
end

return M
