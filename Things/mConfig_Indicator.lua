M = {
    devices = {
        'mBme280',
        'mDs18b20',
		'mIndicator'
    },
    description = 'Mini Raumsensor'
}

M.mBme280 = function()
    transmit.things.mBme280.sda = 2
    transmit.things.mBme280.scl = 1
    transmit.things.mBme280.services[1].altitude = 1554 
    return
end

M.mDs18b20 = function()
    transmit.things.mDs18b20.pin = 4
    return
end

M.mIndicator = function()
	transmit.things.mIndicator.blink = 200
	return
end

return M
