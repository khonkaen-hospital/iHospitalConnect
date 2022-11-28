const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { machineId, machineIdSync } = require('node-machine-id');
const moment = require('moment');
const mqtt = require('mqtt');
const axios = require('axios');
const { menubar } = require('menubar');
const path = require('path');
const mqttTopicName = machineIdSync({ original: true });
const electronLog = require('electron-log');
electronLog.info('App starting...');
const apiUrl = 'http://127.0.0.1:8189';
var client = null;

var ip = require('ip');
const ipAddress = ip.address();
electronLog.info('ip address: ' + ipAddress);

const { autoUpdater } = require("electron-updater");
autoUpdater.logger = electronLog;
autoUpdater.autoDownload = true;
autoUpdater.logger.transports.file.level = 'info';

const Store = require('electron-store');
const schema = {
	settings: {
		mqttHostName: { type: 'string' },
		mqttUsername: { type: 'string' },
		mqttPassword: { type: 'string' },
		mqttPort: { type: 'string' },
		mqttTopicName: { type: 'string' },
		readImageFlag: { type: 'string' }
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
	icon: path.join(__dirname, 'win-icon/icon.png'),
	preloadWindow: true
});

mb.on('ready', () => {
	console.log('Menubar app is ready.');
	autoUpdater.checkForUpdatesAndNotify();
});

mb.app.setLoginItemSettings({
	openAtLogin: true
})

mb.app.whenReady().then(() => {
	ipcMain.handle('initData', async () => {
		return {
			version: app.getVersion(),
			deviceID: mqttTopicName,
			ipAddress: ipAddress
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
	console.log('saveSetting', data);
	store.set('settings', {
		mqttTopicName: data.mqttTopicName,
		mqttHostName: data.mqttHostName,
		mqttUsername: data.mqttUsername,
		mqttPassword: data.mqttPassword,
		mqttPort: data.mqttPort,
		readImageFlag: data.readImageFlag,
	});
}

function getSettings() {
	const settings = store.get('settings');
	console.log('settings', settings);
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
		mqttStatus(1);
		console.log('mqtt is connect');
		client.subscribe('request/read/' + settings.mqttTopicName, { qos: 2 }, (err) => {
			if (!err) {
				log('subscribe request/read/' + settings.mqttTopicName);
			}
		});

		client.subscribe('request/read-card-only/' + settings.mqttTopicName, { qos: 2 }, (err) => {
			if (!err) {
				log('subscribe request/read-card-only/' + settings.mqttTopicName);
			}
		});

		client.subscribe('request/confirm-save/' + settings.mqttTopicName, { qos: 2 }, (err) => {
			if (!err) {
				log('subscribe request/confirm-save/' + settings.mqttTopicName);
			}
		});

		client.subscribe('request/api-preference/' + settings.mqttTopicName, { qos: 2 }, (err) => {
			if (!err) {
				log('subscribe request/api-preference/' + settings.mqttTopicName);
			}
		});

		client.subscribe('request/latest-authen-code/' + settings.mqttTopicName, { qos: 2 }, (err) => {
			if (!err) {
				log('subscribe request/latest-authen-code/' + settings.mqttTopicName);
			}
		});
		client.subscribe('request/latest-5-authen-code-all-hospital/' + settings.mqttTopicName, { qos: 2 }, (err) => {
			if (!err) {
				log('subscribe request/latest-5-authen-code-all-hospital/' + settings.mqttTopicName);
			}
		});
	})


	client.on('message', (topic, message) => {
		// message is Buffer
		console.log('on message of ', topic);
		console.log('on message  ', message.toString());
		let data = undefined;
		try {
			data = JSON.parse(message.toString());
		} catch (error) {
			log('error:' + error.getMessage());
		}
		log('topic:' + topic);
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
		else if (topic === 'request/latest-5-authen-code-all-hospital/' + settings.mqttTopicName) {
			log('ihospital: ขอตรวจสอบรายการที่ขอ authen 5 รายการล่าสุด');
			getLast5AuthenCodeAllHospital(data.pid);
		}
		else if (topic === 'request/api-preference/' + settings.mqttTopicName) {
			getApiPrefrence();
		}
	})


	client.on('error', (err) => {
		console.log(err);
		log('ihospital: ไม่สามารถเชื่อมต่อ MQTT ได้');
		mqttStatus(0);
	})

	client.on('close', function () {
		console.log('mqtt closed');
		log('ihospital: ปิดการเชื่อมต่อ MQTT');
		mqttStatus(0);
	});

	client.on('offline', function () {
		console.log('offline');
		log('ihospital: MQTT ไม่สามารถติดต่อได้');
		mqttStatus(0);
	});

	client.on('reconnect', function () {
		console.log('reconnect');
		log('ihospital: กำลัง reconnect กับ MQTT อีกครั้ง');
		mqttStatus(0);
	});

	client.on('disconnect', function () {
		console.log('disconnect');
		log('ihospital: ยกเลิกการเชื่อมต่อกับ MQTT สำเร็จ');
		mqttStatus(0);
	});
}

function stopMQTT() {
	console.log('stopMQTT: disconnect');
	try {
		client.disconnect();
	} catch (error) {

	}
}

function getRead() {
	const settings = getSettings();
	const readImageFlag = settings.readImageFlag ? 'true' : 'false';
	const topicName = 'response/read/' + settings.mqttTopicName;
	log('topic: ' + topicName);
	log('NHSO SmartCard Agent: กำลังอ่านข้อมูลจากบัตรประชาชนและส่งตรวจสอบสิทธิที่ สปสช.');
	axios.get(apiUrl + '/api/smartcard/read?readImageFlag=' + readImageFlag)
		.then((response) => {
			log('NHSO SmartCard Agent: สำเร็จ สปสช. ตอบกลับข้อมูลสิทธิการรักษา');
			client.publish(topicName, JSON.stringify({
				success: true,
				data: response.data
			}))
		})
		.catch((error) => {
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

			client.publish(topicName, JSON.stringify({
				success: false,
				message: message
			}));
		})
		.finally(() => {
			// always executed

		});
}

function getReadCardOnly() {
	const settings = getSettings();
	const readImageFlag = settings.readImageFlag ? 'true' : 'false';
	const topicName = 'response/read-card-only/' + settings.mqttTopicName;
	log('NHSO SmartCard Agent: กำลังอ่านข้อมูลจากบัตรประชาชน');
	axios.get(apiUrl + '/api/smartcard/read-card-only?readImageFlag=' + readImageFlag)
		.then((response) => {
			console.log(response);
			client.publish(topicName, JSON.stringify({
				success: true,
				data: response.data
			}))
		})
		.catch((error) => {
			console.log(error);
			const errorData = error?.response?.data;
			const message = errorData?.message || error?.message;
			client.publish(topicName, JSON.stringify({
				success: false,
				message: message
			}));
		})
		.finally(() => {
			// always executed
		});
}

function getReadConfirmSave(data) {
	console.log('confirmSave:', data);
	const settings = getSettings();
	const topicName = 'response/confirm-save/' + settings.mqttTopicName;
	log('NHSO SmartCard Agent: รับข้อมูลและส่งต่อขอ authen code สปสช');
	axios.post(apiUrl + '/api/nhso-service/confirm-save', data)
		.then((response) => {
			log('NHSO SmartCard Agent: Authen สำเร็จ ส่งข้อมูลกลับไปให้ ihospital');
			console.log(response);
			client.publish(topicName, JSON.stringify({
				success: true,
				data: response.data
			}))
		})
		.catch(async (error) => {
			console.log(error);
			const result = await _getLast5AuthenCodeAllHospital(data.pid);
			if (result.data?.length > 0) {
				log('NHSO SmartCard Agent: มีรายการขอ authen code แล้วส่งรหัสเดิมกลับคืนให้ iHospital');
				const claimData = result.data.find(f => f.claimType === data.claimType && moment(f.claimDateTime).format('YYYY-MM-DD') === moment().format('YYYY-MM-DD'));
				if (claimData) {
					client.publish(topicName, JSON.stringify({
						success: true,
						data: claimData
					}))
				}
			} else {
				log('NHSO SmartCard Agent: Authen ไม่สำเร็จ ส่งข้อมูลกลับไปให้ ihospital');
				const errorData = error?.response?.data;
				const message = (errorData?.error || error?.message);
				client.publish(topicName, JSON.stringify({
					success: false,
					message: message,
					data: errorData?.errors
				}));
				log('NHSO SmartCard Agent: error: ' + message);
			}
		})
		.finally(() => {
			log('topic:' + topicName);
			// always executed
		});
}

function getLastAuthenCode(pid) {
	const settings = getSettings();
	const topicName = 'response/latest-authen-code/' + settings.mqttTopicName;
	axios.get(apiUrl + '/api/nhso-service/latest-authen-code/' + pid)
		.then((response) => {
			console.log(response);
			client.publish(topicName, JSON.stringify({
				success: true,
				data: response.data
			}))
		})
		.catch((error) => {
			// handle error
			console.log(error);
			const errorData = error.response.data;
			client.publish(topicName, JSON.stringify({
				success: false,
				message: errorData.error,
				data: errorData.errors
			}))
		})
		.finally(() => {
			// always executed
		});
}

function _getLast5AuthenCodeAllHospital(pid) {
	return axios.get(apiUrl + '/api/nhso-service/latest-5-authen-code-all-hospital/' + pid);
}

function getLast5AuthenCodeAllHospital(pid) {
	const settings = getSettings();
	const topicName = 'response/latest-5-authen-code-all-hospital/' + settings.mqttTopicName;
	axios.get(apiUrl + '/api/nhso-service/latest-5-authen-code-all-hospital/' + pid)
		.then((response) => {
			console.log('latest-5-authen-code-all-hospital', response);
			client.publish(topicName, JSON.stringify({
				success: true,
				data: response.data
			}))
		})
		.catch((error) => {
			// handle error
			console.log(error);
			const errorData = error.response.data;
			client.publish(topicName, JSON.stringify({
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
	const settings = getSettings();
	const topicName = 'response/api-preference/' + settings.mqttTopicName;
	log('ihospital: ตรวจสอบ NHSO SmartCard Agent ทำงานหรือไม่?');
	axios.get(apiUrl + '/api/api/preference')
		.then((response) => {
			log('NHSO SmartCard Agent: สถานะ ปกติ');
			client.publish(topicName, JSON.stringify({
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
			// client.publish(topicName, JSON.stringify({
			// 	success: false,
			// 	message: errorData.error,
			// 	data: errorData.errors
			// }))
		})
		.finally(() => {
			// always executed
		});
}

autoUpdater.on('checking-for-update', () => {
	log('Checking for update...');
})
autoUpdater.on('update-available', (info) => {
	log('Update available.');
})
autoUpdater.on('update-not-available', (info) => {
	log('Update not available.');
})
autoUpdater.on('error', (err) => {
	log('Error in auto-updater. ' + err);
})
autoUpdater.on('download-progress', (progressObj) => {
	let log_message = "Download speed: " + progressObj.bytesPerSecond;
	log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
	log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
	log(log_message);
})
autoUpdater.on('update-downloaded', (info) => {
	log('Update downloaded');
});

function log(message) {
	const windows = mb.window;
	windows.webContents.send('logs', message);
	electronLog.info(message);
}

function mqttStatus(status) {
	const win = mb.window;
	win.webContents.send('mqttStatus', status); // 1 online, 0 offline
}








