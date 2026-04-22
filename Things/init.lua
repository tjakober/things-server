if (node.LFS.list()) == nil then
    node.LFS.reload('lfs.img')
end
node.LFS._init()
if file.exists('flashreload') then
	function log(...)
		print(node.heap(), node.egc.meminfo(), ...)
	end
	log(fl)
	node.LFS.mWifiConnect().init('mChangeLFS')
else
    node.LFS.init1()
end
