M = {
    description = 'Dual Line Switch',
    devices = {
        'mSwitch'
    }
}

M.mSwitch = function()
    transmit.things.mSwitch.services = {
        {
            name = 'Toggle Switch 1',
            type = 'Switch',
            datatype = 'Text',
            pin = 7,
            value = 'OFF',
            switchAssoc = 6,
            ts = 0
        },
        {
            name = 'Toggle Switch 2',
            type = 'Switch',
            datatype = 'Text',
            pin = 2,
            value = 'OFF',
            switchAssoc = 3,
            ts = 0
        }
    }
end

return M
