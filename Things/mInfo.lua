local M = {}
function M.sendInfo(oResp)
    transmit.log('Minfo')
    local phymode = { 'b', 'g', 'n'}
    local config = wifi.sta.getconfig(true)
    local lfstime, lfsmodule
    if (LFS) then
        local tm = rtctime.epoch2cal(rtctime.get())
        lfstime = string.format("%04d/%02d/%02d %02d:%02d:%02d", tm["year"], tm["mon"], tm["day"], tm["hour"], tm["min"], tm["sec"])
        lfsmodules = ''; for i, t in ipairs(LFS._list) do lfsmodules = lfsmodules .. t .. ', ' end
		lfsmodules = lfsmodules:sub(1, -3)
    else
        lfstime = 'no LFS installed'
        lfsmodules = 'none'
    end
	local mods = ''
	for m, v in pairs(transmit.things) do
		mods = mods .. '[' ..m .. ': ' .. v.thing .. '] '
	end
    oInfo = {
        cmd = 'nodeInfo',
        from = oResp.from,
        to = oResp.to,
        nodeId = node.info('hw').chip_id,
        dev_ver = node.info('sw_version').node_version_major .. '.'
			.. node.info('sw_version').node_version_minor .. '.'
			.. node.info('sw_version').node_version_revision,
        heap = node.heap(),
        flash_id = node.info('hw').flash_id,
        flash_size = node.info('hw').flash_size,
        flash_mode = node.info('hw').flash_mode,
        flash_speed = (node.info('hw').flash_speed / 1000000) .. 'MHz',
        ipaddress = wifi.sta.getip(),
        hostname = wifi.sta.gethostname(),
        macaddress = wifi.sta.getmac(),
        ssid = config.ssid,
        phymode = '802.11' .. phymode[wifi.getphymode()],
        rssi = wifi.sta.getrssi(),
        lfs_time = lfstime,
		lfs_size = node.info('build_config').lfs_size,
        lfs_modules = lfsmodules,
		build_modules = node.info('build_config').modules,
		things = mods
    }
	if transmit.config.description then
		oInfo.description = transmit.config.description
	end
	--tprint(oInfo)
	return sjson.encode(oInfo)
end
return M
