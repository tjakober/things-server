-- mConfig_PIR_test.lua
M = {
    description = 'Standalone PIR sensor',
    devices = {
        'mPir'
    }
}
M.mPir = function()
    transmit.things.mPir.services = {
        {
            name = 'Light Sensor',
            value = 0,
            onbelow = 20,
            light = 1024,
            dark = 0
        },
        {
            name = 'PIR Sensor',
            value = 'ON',       -- active / inactive
            pin = 1,
            pinIndicator = 4,   -- red led
            pinActive = 3,      -- green led
            retrigger = true,
            duration = 3,
            rest = 0,
            target = 'Toggle Switch 1',
            node = '11683194'
        }
    }
end

return M
