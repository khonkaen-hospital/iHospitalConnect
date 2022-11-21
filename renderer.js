var appVersion = 0;
var mqttTopicName = null;
var mqttHostName = null;
var mqttUsername = null;
var mqttPassword = null;
var mqttPort = null;

document.getElementById('btn-quit').addEventListener('click', () => {
	window.electronAPI.quit();
});

document.getElementById('btn-reset-settings').addEventListener('click', () => {
	window.electronAPI.resetSetting();
	getSettings();
});

document.getElementById('btn-start').addEventListener('click', () => {
	document.getElementById('btn-start').style.display = 'none';
	document.getElementById('btn-stop').style.display = 'block';
	startMQTT();
});

document.getElementById('btn-stop').addEventListener('click', () => {
	document.getElementById('btn-stop').style.display = 'none';
	document.getElementById('btn-start').style.display = 'block';
	stopMQTT();
});

document.getElementById('btn-save-setting').addEventListener('click', () => {
	saveSettings();
});

function initTabs() {
	const tabsLink = document.querySelectorAll('.siimple-tabs .siimple-tabs-item');
	const tabcontents = document.querySelectorAll('.tabcontents .tabcontent');
	tabcontents.forEach((tab, index) => tab.style.display = 'none');
	tabsLink.forEach((link, index) => {
		if (link.classList.contains('siimple-tabs-item--selected')) {
			const activeTab = document.getElementById(link.dataset.tab);
			activeTab.style.display = 'block';
		}
	});
}

function onClickTab(tabName) {
	const activeTab = document.getElementById(tabName);
	const tabsLink = document.querySelectorAll('.siimple-tabs .siimple-tabs-item');
	tabsLink.forEach((link) => link.classList.remove('siimple-tabs-item--selected'));
	activeTab.classList.add('siimple-tabs-item--selected');

	const tabcontents = document.querySelectorAll('.tabcontents .tabcontent');
	tabcontents.forEach((tab, index) => tab.style.display = 'none');
	const activeContent = document.getElementById(activeTab.dataset.tab);
	activeContent.style.display = 'block';
}

async function getSettings() {
	const settings = await window.electronAPI.getSettings();
	console.log('getSettings', settings, mqttTopicName);
	if (settings) {
		document.getElementById("mqtt-hostname").value = settings.mqttHostName;
		document.getElementById("mqtt-username").value = settings.mqttUsername;
		document.getElementById("mqtt-password").value = settings.mqttPassword;
		document.getElementById("mqtt-port").value = settings.mqttPort;
		document.getElementById("mqtt-topic-name").value = settings.mqttTopicName;
	} else {
		document.getElementById("mqtt-hostname").value = 'mqtt.kkh.go.th';
		document.getElementById("mqtt-topic-name").value = mqttTopicName;
		document.getElementById("mqtt-port").value = 1883;
	}
	return settings;
}

async function saveSettings() {
	mqttHostName = document.getElementById("mqtt-hostname").value;
	mqttUsername = document.getElementById("mqtt-username").value;
	mqttPassword = document.getElementById("mqtt-password").value;
	mqttTopicName = document.getElementById("mqtt-topic-name").value;
	mqttPort = document.getElementById("mqtt-port").value;

	if (mqttHostName && mqttUsername && mqttTopicName && mqttPort) {
		await window.electronAPI.setSettings({
			mqttHostName: mqttHostName,
			mqttTopicName: mqttTopicName,
			mqttUsername: mqttUsername,
			mqttUsername: mqttUsername,
			mqttPassword: mqttPassword,
			mqttPort: mqttPort
		});
		alert('บันทึกเสร็จเรียบร้อย');
	} else {
		alert('กรุณากรอกข้อมูลให้ครบถ้วน');
	}
}

function setLog(message) {
	const txtLog = document.getElementById('txt-log');
	txtLog.value += message + '\n';
}

async function getInitData() {
	const initData = await window.electronAPI.initData();
	appVersion = initData.version;
	mqttTopicName = initData.deviceID;
	document.getElementById("app-version").innerHTML = 'iHosConnect v. ' + appVersion;
}

function startMQTT() {
	window.electronAPI.startMQTT();
}

function stopMQTT() {
	window.electronAPI.stopMQTT();
	document.getElementById('title').style.color = 'red';
}

async function autoStartMQTT() {
	const settings = await getSettings();
	if (settings.mqttHostName && settings.mqttPort && settings.mqttUsername && settings.mqttPassword) {
		this.startMQTT();
		document.getElementById('btn-start').style.display = 'none';
		document.getElementById('btn-stop').style.display = 'block';
		console.log('autoStartMQTT');
	}
}

async function appInit() {
	await getInitData();
	initTabs();
	autoStartMQTT();

	window.electronAPI.setLogs((event, value) => {
		setLog(value);
	});

	window.electronAPI.mqttStatus((event, value) => {
		if (value == 1) {
			document.getElementById('title').style.color = 'green';
		} else {
			document.getElementById('title').style.color = 'red';
		}
	});
}


appInit();
