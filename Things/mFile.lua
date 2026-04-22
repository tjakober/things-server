local M = {}

local function loadFile(oResp)
	print('in loadFile')
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
        transmit.log('calculate Checksum')
		local sha1 = encoder.toHex(crypto.fhash('sha1', 'TEMP'))
        transmit.log(sha1)
        transmit.log(oResp.checksum)
        fd:close()
        oOk.cmd = 'fileOk'
        if oResp.checksum == sha1 then
            file.remove(oResp.filename)
			file.rename('TEMP2', oResp.fileName)
            oOk.ok = 'YES'
            local st = file.stat(oResp.fileName)
            transmit.log('File succsessful saved ' .. st.size)
        else
            oOk.ok = 'Checksum Error'
            transmit.log('File checksum error')
        end
		file.remove('TEMP')
        transmit.sendDisable = false
    end
    return(sjson.encode(oOk))
end

local function listFiles(oResp)
	local msg = {
		cmd = 'fileList',
        from = node.chipid(),
        to = oResp.to,
		list = {}
	}
	msg.list = file.list()
	return sjson.encode(msg)
end

local function delFile(oResp)
	print('in delFile')
    local oOk = {
        cmd = 'deleteOk',
        from = node.chipid(),
        to = oResp.to,
		file = oResp.file,
		ok = ''
    }
	file.remove(oResp.file)
	if file.exists(oResp.file) then
		oOk.ok = ' deleted'
	else
		oOk.ok = ' NOT deleted'
	end
	return(sjson.encode(oOk))
end

local function getFile(oResp)
	local file = file.getcontents(oResp.filename)
	local data = {
		cmd = 'editFile',
		from = oResp.from,
		to = oResp.to,
		nodeId = node.info('hw').chip_id,
		content = encoder.toBase64(file)
	}
	return sjson.encode(data)
end

local function setFile(oResp)
	file.remove(oResp.fileName)
	file.putcontents(oResp.fileName, encoder.fromBase64(oResp.content))
    local oOk = {
        cmd = 'saveOk',
        from = node.chipid(),
        to = oResp.from,
		file = oResp.file,
		ok = 'true'
    }
    return (sjson.encode(oOk))
end

function M.cmds(oResp)
	local msg
	if oResp.cmd == 'loadFile' then
		msg = loadFile(oResp)
	elseif oResp.cmd == 'listFiles' then
		msg = listFiles(oResp)
	elseif oResp.cmd == 'delFile' then
		msg = delFile(oResp)
    elseif oResp.cmd == 'getFile' then
        msg = getFile(oResp)
    elseif oResp.cmd == 'setFile' then
        msg = setFile(oResp)
	else
		transmit.log('bad command:', oResp.cmd)
	end
	transmit.log('send file list: '..msg)
	return msg
end

return M              
