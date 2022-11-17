const { menubar } = require('menubar');

const mb = menubar({
	browserWindow: {
		width: 650,
		height: 480,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			enableRemoteModule: true
		}
	},
	icon: 'win-icon/icon.png'
});

mb.on('ready', () => {
	console.log('Menubar app is ready.');
});

mb.app.setLoginItemSettings({
	openAtLogin: true
})

