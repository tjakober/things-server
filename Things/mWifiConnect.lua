local M = {}

local tl = tmr.create()  -- watchdog timer for connection
local apList, doConnect, isConnected, gotIp, disConneted

M.init = function()
	_G.log('Initialize Wireless')
	wifi.eventmon.register(wifi.eventmon.STA_CONNECTED, isConnected)
	wifi.eventmon.register(wifi.eventmon.STA_GOT_IP, gotIp)
	wifi.setmode(wifi.STATION)
	wifi.sta.getap(1, apList)
end

apList = function(list)
	local ap = require('mAplist')
    local i, k, v, inx
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
	else
		doConnect(myAp[inx])  -- connect to Ap with highes signal
	end
end

doConnect = function(ap)
	_G.log('try connect to '..ap.ssid)
	tprint(ap)
	wifi.sta.config(ap)
	wifi.sta.connect()
end

isConnected = function(oResult)
	_G.log('Connected to '..oResult.SSID)
	wifi.eventmon.register(wifi.eventmon.STA_DISCONNECTED, disConneted)
end


gotIp = function(oResult)
	_G.log('got IP Address '..oResult.IP..' gateway ..'..oResult.gateway)
	transmit = require('transmit')
	transmit.init()
end

isDisonneted = function(oResult)
	_G.log('Disconnected from Station '..oResult.SSID..' Reason: '..oResult.reason)
end

return M
