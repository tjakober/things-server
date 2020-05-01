M = {
    devices = {
        'mBme280',
        'mDs18b20'
    },
    
    broker = 'ws://192.168.88.115:8081'
    --broker = 'ws://3sopus.homeip.net:8081'  
}

M.mBme280 = function()
    transmit.things.mBme280.services[1].altitude = 416;
    return
end

M.mDs18b20 = function()
    return
end

return M
