M = {
    devices = {
        'mBme280'
    },
    description = 'Test BME280'
}

M.mBme280 = function()
    transmit.things.mBme280.sda = 2
    transmit.things.mBme280.scl = 1
    transmit.things.mBme280.services[1].altitude = 412
    transmit.things.mBme280.services[1].chg = 10  --Pressure
    transmit.things.mBme280.services[2].chg = 1   --Humidity  
    transmit.things.mBme280.services[3].chg = 1   --Dew Point
    transmit.things.mBme280.services[4].chg = 1   --Temperature
    return
end



return M
