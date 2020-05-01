if file.exists('flashreload') then
	file.remove('flashreload')
	node.flashreload('lfs.img')
end

local fn = node.flashindex('init1')
dofile(fn())

