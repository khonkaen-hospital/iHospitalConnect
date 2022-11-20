const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
	// render to main-process one-way
	quit: () => ipcRenderer.send('quit'),
	startMQTT: () => ipcRenderer.send('startMQTT'),
	stopMQTT: () => ipcRenderer.send('stopMQTT'),
	resetSetting: () => ipcRenderer.send('resetSetting'),
	// render to main-process two-way
	initData: () => ipcRenderer.invoke('initData'),
	getSettings: () => ipcRenderer.invoke('getSettings'),
	setSettings: (data) => ipcRenderer.invoke('setSettings', data),
	setLogs: (callback) => ipcRenderer.on('logs', callback)
})
