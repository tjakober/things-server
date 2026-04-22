M = {
    description = '7 Segment Display',
    devices = {
        'mTm1637'
    }
}

M.mTm1637 = function()
    transmit.things.mTm1637.services = {
        {
            name = '4 Digit Display',
            type = 'Display',
            value = '0',
            dp = 1,
            brightness = 6,
            pinClk = 1,
            pinDio = 2
         }
    }
end

return M
