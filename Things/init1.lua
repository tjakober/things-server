debug = true
function log(...)
    if debug then
        print(node.heap(), ...)
    end
end
--broker = 'ws://3sopus.homeip.net:8081'
--broker = 'ws://192.168.88.130:8081'
--broker = 'ws://192.168.88.115:8081'
broker = 'ws://192.168.1.124:8081'

local tm = tmr.create()
local wc, abort
tm:register(1000,tmr.ALARM_SINGLE, function()
    -- initailize abort boolean flag
    abort = false
    print('Press "FLASH" button to abort startup')
    -- if FLASH button is pressed, call abortTest
    gpio.mode(3, gpio.INT)
    gpio.trig(3, 'both', function() 
        print('Abort...')
        abort = true
        gpio.trig(3) -- reset gpio interrupt
        tm:interval(1) -- set timer to expire soon
    end)
    -- start timer to execute startup function in 5 seconds
    tm:register(5000,tmr.ALARM_SINGLE,function()
        gpio.trig(3) -- reset gpio interrupt
        -- if user requested abort, exit
        if abort == true then
            print('startup aborted')
            return
        end
        -- otherwise, start up
        log('in startup')
        tm:unregister()
        wc = require('mWifiConnect')
		wc.init()
    end)
    tm:start()
end)
tm:start()

function doFlashReload()
	_G['transmit'] = nil
	package.loaded['transmit'] = nil
	wc = nil
	print('Now do flashrelad. Heap is:', node.heap())
	node.flashreload('lfs.img')
end

function tprint(tbl, indent)
	if tbl == nil then
		print('nil')
		return
	end
	if not indent then indent = 0 end
		for k, v in pairs(tbl) do
		vt = type(v)
		formatting = string.rep("  ", indent) .. k .. ": "
		if vt == "table" then
			print(formatting)
			tprint(v, indent+1)
		elseif vt == "string" then
			print(formatting .. '"' .. v .. '"')
		elseif vt == "number" or vt == "boolean" then
			print(formatting .. tostring(v))
		else
			print(formatting .. vt)
		end
	end
end

--
-- File: _init.lua
--[[

  This is a template for the LFS equivalent of the SPIFFS init.lua.

  It is a good idea to such an _init.lua module to your LFS and do most of the LFS
  module related initialisaion in this. This example uses standard Lua features to
  simplify the LFS API.

  The first section adds a 'LFS' table to _G and uses the __index metamethod to
  resolve functions in the LFS, so you can execute the main function of module
  'fred' by executing LFS.fred(params), etc. It also implements some standard
  readonly properties:

  LFS._time    The Unix Timestamp when the luac.cross was executed.  This can be
               used as a version identifier.

  LFS._config  This returns a table of useful configuration parameters, hence
                 print (("0x%6x"):format(LFS._config.lfs_base))
               gives you the parameter to use in the luac.cross -a option.

  LFS._list    This returns a table of the LFS modules, hence
                 print(table.concat(LFS._list,'\n'))
               gives you a single column listing of all modules in the LFS.

---------------------------------------------------------------------------------]]

local index = node.flashindex

local lfs_t = {
  __index = function(_, name)
      local fn_ut, ba, ma, size, modules = index(name)
      if not ba then
        return fn_ut
      elseif name == '_time' then
        return fn_ut
      elseif name == '_config' then
        local fs_ma, fs_size = file.fscfg()
        return {lfs_base = ba, lfs_mapped = ma, lfs_size = size,
                fs_mapped = fs_ma, fs_size = fs_size}
      elseif name == '_list' then
        return modules
      else
        return nil
      end
    end,

  __newindex = function(_, name, value)
      error("LFS is readonly. Invalid write to LFS." .. name, 2)
    end,

  }

local G=getfenv()
G.LFS = setmetatable(lfs_t,lfs_t)

--[[-------------------------------------------------------------------------------
  The second section adds the LFS to the require searchlist, so that you can
  require a Lua module 'jean' in the LFS by simply doing require "jean". However
  note that this is at the search entry following the FS searcher, so if you also
  have jean.lc or jean.lua in SPIFFS, then this SPIFFS version will get loaded into
  RAM instead of using. (Useful, for development).

  See docs/en/lfs.md and the 'loaders' array in app/lua/loadlib.c for more details.

---------------------------------------------------------------------------------]]

package.loaders[3] = function(module) -- loader_flash
  local fn, ba = index(module)
  return ba and "Module not in LFS" or fn
end

--[[-------------------------------------------------------------------------------
  You can add any other initialisation here, for example a couple of the globals
  are never used, so setting them to nil saves a couple of global entries
---------------------------------------------------------------------------------]]

G.module       = nil    -- disable Lua 5.0 style modules to save RAM
package.seeall = nil

--[[-------------------------------------------------------------------------------
  These replaces the builtins loadfile & dofile with ones which preferentially
  loads the corresponding module from LFS if present.  Flipping the search order
  is an exercise left to the reader.-
---------------------------------------------------------------------------------]]

local lf, df = loadfile, dofile
G.loadfile = function(n)
  local mod, ext = n:match("(.*)%.(l[uc]a?)");
  local fn, ba   = index(mod)
  if ba or (ext ~= 'lc' and ext ~= 'lua') then return lf(n) else return fn end
end

G.dofile = function(n)
  local mod, ext = n:match("(.*)%.(l[uc]a?)");
  local fn, ba   = index(mod)
  if ba or (ext ~= 'lc' and ext ~= 'lua') then return df(n) else return fn() end
end

