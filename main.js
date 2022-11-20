const { app, BrowserWindow, ipcMain } = require('electron');
const { machineId, machineIdSync } = require('node-machine-id');
const mqtt = require('mqtt');
const axios = require('axios');
const { menubar } = require('menubar');
const path = require('path');
const mqttTopicName = machineIdSync({ original: true });
const electronLog = require('electron-log');
electronLog.info('App starting...');
const apiUrl = 'http://127.0.0.1:8189';
var client = null;

require('update-electron-app')({
	repo: 'khonkaen-hospital/iHospitalConnect',
	updateInterval: '1 hour',
	logger: electronLog
});

const Store = require('electron-store');
const schema = {
	settings: {
		mqttHostName: { type: 'string' },
		mqttUsername: { type: 'string' },
		mqttPassword: { type: 'string' },
		mqttPort: { type: 'string' },
		mqttTopicName: { type: 'string' }
	}
};
const store = new Store(schema);

const mb = menubar({
	browserWindow: {
		width: 700,
		height: 500,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: true,
			enableRemoteModule: true,
			preload: path.join(__dirname, 'preload.js'),
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

mb.app.whenReady().then(() => {
	ipcMain.handle('initData', async () => {
		return {
			version: app.getVersion(),
			deviceID: mqttTopicName
		}
	});

	ipcMain.handle('getSettings', async (event) => {
		return getSettings();
	});

	ipcMain.handle('setSettings', async (event, data) => {
		return setSettings(data);
	});
});

ipcMain.on('quit', (event) => {
	app.quit();
});

ipcMain.on('startMQTT', (event) => {
	console.log('startMQTT');
	startMQTT();
});

ipcMain.on('stopMQTT', (event) => {
	console.log('stopMQTT');
	stopMQTT();
});
ipcMain.on('resetSetting', () => {
	resetSettings();
});

function setSettings(data) {
	store.set('settings', {
		mqttTopicName: data.mqttTopicName,
		mqttHostName: data.mqttHostName,
		mqttUsername: data.mqttUsername,
		mqttPassword: data.mqttPassword,
		mqttPort: data.mqttPort,
	});
}

function getSettings() {
	const settings = store.get('settings');
	return settings;
}

function resetSettings() {
	console.log('resetSettings');
	return store.delete('settings');
}


function startMQTT() {
	const settings = getSettings();
	if (!settings) return;

	log('iHosConnect: กำลังเชื่อมต่อ MQTT...');
	client = mqtt.connect(`mqtt://${settings.mqttHostName}`, {
		username: settings.mqttUsername,
		password: settings.mqttPassword,
		protocol: 'mqtt',
		port: +settings.mqttPort
	});

	client.on('connect', () => {
		log('iHosConnect: เชื่อมต่อ MQTT สำเร็จ');
		console.log('mqtt is connect');

		client.subscribe('request/read/' + settings.mqttTopicName, { qos: 2 }, (err) => {
			if (!err) {
				console.log('subscribe request/read/' + settings.mqttTopicName);
			}
		});

		client.subscribe('request/read-card-only/' + settings.mqttTopicName, { qos: 2 }, (err) => {
			if (!err) {
				console.log('subscribe request/read-card-only/' + settings.mqttTopicName);
			}
		});

		client.subscribe('request/confirm-save/' + settings.mqttTopicName, { qos: 2 }, (err) => {
			if (!err) {
				console.log('subscribe request/confirm-save/' + settings.mqttTopicName);
			}
		});

		client.subscribe('request/api-preference/' + settings.mqttTopicName, { qos: 2 }, (err) => {
			if (!err) {
				console.log('subscribe request/api-preference/' + settings.mqttTopicName);
			}
		});

		client.subscribe('request/latest-authen-code/' + settings.mqttTopicName, { qos: 2 }, (err) => {
			if (!err) {
				console.log('subscribe request/latest-authen-code/' + settings.mqttTopicName);
			}
		});
	})


	client.on('message', (topic, message) => {
		// message is Buffer
		console.log('on message of ', topic, message.toString());
		const data = JSON.parse(message.toString());

		if (topic === 'request/read/' + settings.mqttTopicName) {
			log('ihospital: ขออ่านบัตรประชาชนและตรวจสอบสิทธิ');
			getRead();
		}
		else if (topic === 'request/read-card-only/' + settings.mqttTopicName) {
			log('ihospital: ขออ่านบัตรประชาชน');
			getReadCardOnly();
		}
		else if (topic === 'request/confirm-save/' + settings.mqttTopicName) {
			log('ihospital: ขอเลข authen code');
			getReadConfirmSave(data);

		}
		else if (topic === 'request/latest-authen-code/' + settings.mqttTopicName) {
			log('ihospital: ขอตรวจสอบรายการที่ขอ authen ล่าสุด');
			getLastAuthenCode(data.pid);
		}
		else if (topic === 'request/api-preference/' + settings.mqttTopicName) {
			getApiPrefrence();
		}
	})


	client.on('error', (err) => {
		console.log(err);
		log('ihospital: ไม่สามารถเชื่อมต่อ MQTT ได้');
	})

	client.on('close', function () {
		console.log('mqtt closed');
		log('ihospital: ปิดการเชื่อมต่อ MQTT');
	});

	client.on('offline', function () {
		console.log('offline');
		log('ihospital: MQTT ไม่สามารถติดต่อได้');
	});

	client.on('reconnect', function () {
		console.log('reconnect');
		log('ihospital: กำลัง reconnect กับ MQTT อีกครั้ง');
	});

	client.on('disconnect', function () {
		console.log('disconnect');
		log('ihospital: ยกเลิกการเชื่อมต่อกับ MQTT สำเร็จ');
	});
}

function stopMQTT() {
	try {
		client.disconnect();
	} catch (error) {

	}
}

function getRead() {
	log('NHSO SmartCard Agent: กำลังอ่านข้อมูลจากบัตรประชาชนและส่งตรวจสอบสิทธิที่ สปสช.');
	axios.get(apiUrl + '/api/smartcard/read?readImageFlag=true')
		.then((response) => {
			// handle success
			log('NHSO SmartCard Agent: สำเร็จ สปสช. ตอบกลับข้อมูลสิทธิการรักษา');
			console.log(response);
			client.publish('response/read/' + mqttTopicName, JSON.stringify({
				success: true,
				data: response.data
			}));
			log('NHSO SmartCard Agent: ส่งข้อมูลกลับไปที่ ihospital');
		})
		.catch((error) => {
			// handle error
			console.log(error);
			let message = '';
			const errorData = error?.response?.data;
			if (errorData?.status === 418) {
				message = 'ไม่พบเครื่องอ่าน Smart card กรุณาเสียบเครื่องอ่านใหม่อีกครั้ง!!!';
			} else if (errorData?.status === 500) {
				message = 'กรุณาเสียบบัตรประชาชนของผู้ป่วย!!!';
			} else {
				message = errorData?.message || error?.message;
			}

			log('NHSO SmartCard Agent: ' + message);

			client.publish('response/read/' + mqttTopicName, JSON.stringify({
				success: false,
				message: message
			}));
		})
		.finally(() => {
			// always executed
		});
}

function getReadCardOnly() {
	log('NHSO SmartCard Agent: กำลังอ่านข้อมูลจากบัตรประชาชน');
	axios.get(apiUrl + '/api/smartcard/read-card-only?readImageFlag=true')
		.then((response) => {
			// handle success
			console.log(response);
			client.publish('response/read-card-only/' + mqttTopicName, 'Hello mqtt')
		})
		.catch((error) => {
			// handle error
			console.log(error);
			client.publish('response/read-card-only/' + mqttTopicName, 'error')
		})
		.finally(() => {
			// always executed
		});
}

function getReadConfirmSave(data) {
	log('NHSO SmartCard Agent: รับข้อมูลและส่งต่อขอ authen code สปสช');
	axios.post(apiUrl + '/api/nhso-service/confirm-save', data)
		.then((response) => {
			log('NHSO SmartCard Agent: Authen สำเร็จ ส่งข้อมูลกลับไปให้ ihospital');
			console.log(response);
			client.publish('response/confirm-save/' + mqttTopicName, JSON.stringify({
				success: true,
				data: response.data
			}))
		})
		.catch((error) => {
			// handle error
			console.log(error);
			const errorData = error?.response?.data;
			log('NHSO SmartCard Agent: Authen ไม่สำเร็จ ส่งข้อมูลกลับไปให้ ihospital');
			client.publish('response/confirm-save/' + mqttTopicName, JSON.stringify({
				success: false,
				message: errorData?.error || error?.message,
				data: errorData?.errors
			}))
		})
		.finally(() => {
			// always executed
		});
}

function getLastAuthenCode(pid) {
	axios.get(apiUrl + '/api/nhso-service/latest-authen-code/' + pid)
		.then((response) => {
			console.log(response);
			client.publish('response/latest-authen-code/' + mqttTopicName, JSON.stringify({
				success: true,
				data: response.data
			}))
		})
		.catch((error) => {
			// handle error
			console.log(error);
			const errorData = error.response.data;
			client.publish('response/latest-authen-code/' + mqttTopicName, JSON.stringify({
				success: false,
				message: errorData.error,
				data: errorData.errors
			}))
		})
		.finally(() => {
			// always executed
		});
}

function getApiPrefrence() {
	log('ihospital: ตรวจสอบ NHSO SmartCard Agent ทำงานหรือไม่?');
	axios.get(apiUrl + '/api/api/preference')
		.then((response) => {
			log('NHSO SmartCard Agent: สถานะ ปกติ');
			client.publish('response/api-preference/' + mqttTopicName, JSON.stringify({
				success: true,
				data: response.data
			}))
		})
		.catch((error) => {
			// handle error
			console.log(error);
			if (error.message === 'Network Error') {
				log('iHosConnect: ไม่สามารถเชื่อมต่อกับ NHSO SmartCard Agent ได้ โปรดตรวจสอบการติดตั้งอีกครั้ง');
			}
			// const errorData = error.response.data;
			// client.publish('response/api-preference/' + mqttTopicName, JSON.stringify({
			// 	success: false,
			// 	message: errorData.error,
			// 	data: errorData.errors
			// }))
		})
		.finally(() => {
			// always executed
		});
}

function log(message) {
	const windows = mb.window;
	windows.webContents.send('logs', message);
	electronLog.info(message);
}








