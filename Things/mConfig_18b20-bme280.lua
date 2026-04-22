M = {
    description = 'Wintergarten Winterthur',
    devices = {
      'mBme280',
      'mDs18b20',
      'mVent',
      'mSwitch'
    },
}

M.mBme280 = function()
    transmit.things.mBme280.sda = 2
    transmit.things.mBme280.scl = 1
    transmit.things.mBme280.services[1].altitude = 416;
    return
end

M.mDs18b20 = function()
    transmit.things.mDs18b20.pin = 5
    return
end

M.mVent = function()
    transmit.things.mVent.services[1].target = 'Ventilator'
    transmit.things.mVent.services[1].node = transmit.nodeId
end

M.mSwitch = function()
    transmit.things.mSwitch.services = {
        {
            name = 'Ventilator',
            type = 'Switch',
            datatype = 'Text',
            pin = 6,
            value = 'OFF',
            switchAssoc = 3,
            ts = 0
        },  
    }
end

return M
