local M = {}
function M.loadFile(oResp)
    -- file to store
    -- check consistency
    transmit.sendDisable = true
    collectgarbage()
    local fd
    local oOk = {
        cmd = 'chunkOk',
        from = node.chipid(),
        to = oResp.from,
        chunkNo = oResp.chunkNo,
        nChunks = oResp.nChunks,
        ok = 'NO'
    }
    if oResp.chunkNo == 0 then
        fd = file.open('TEMP', 'w+')
    else
        fd = file.open('TEMP', 'a+')
    end
    fd:write(oResp.content)
    transmit.log('Chunk '..(oResp.chunkNo+1)..' of '..oResp.nChunks..' saved')
    fd:close()
    if oResp.chunkNo < oResp.nChunks-1 then
        oOk.ok = 'YES'
     else
		transmit.log('convert the file back from base64')
		file.remove('TEMP2')  --just in case a file left over
		local fi = file.open('TEMP', 'r')
		local fo = file.open('TEMP2', 'a+')
		while(true) do
			local buf = fi:read(300)
			if buf == nil then
				break
			end
			fo:write(encoder.fromBase64(buf))
		end
		fi:close()
		fo:close()
		transmit.log('Size before:', file.stat('TEMP').size, 'after:', file.stat('TEMP2').size)
		file.remove('TEMP')
        transmit.log('calculate Checksum')
        fd = file.open('TEMP2', 'r')
        local oHash = crypto.new_hash('SHA1')
        local pos = fd:seek('set')
        repeat
            transmit.log(pos)
            pos = fd:seek('cur')
            local c = fd:read()
            if c ~= nil then
                oHash:update(c)
            end
        until c == nil
        local sha1 = crypto.toHex(oHash:finalize())
        transmit.log(sha1)
        transmit.log(oResp.checksum)
        fd:close()
        oOk.cmd = 'fileOk'
        if oResp.checksum == sha1 then
            file.remove('oResp.filename')
			file.rename('TEMP2', oResp.fileName)
            oOk.ok = 'YES'
            local st = file.stat(oResp.fileName)
            transmit.log('File succsessful saved ' .. st.size)
        else
            oOk.ok = 'Checksum Error'
            transmit.log('File checksum error')
        end
        transmit.sendDisable = false
    end
    return(sjson.encode(oOk))
end
return M              
