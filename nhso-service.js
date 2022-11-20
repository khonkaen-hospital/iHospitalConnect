import { MqttClient } from 'mqtt';

const axios = require('axios');

export default class NhsoService {
	constructor() {

	}

	static getInstance() {
		return new NhsoService();
	}

	getRead() {
		return axios.get(apiUrl + '/api/smartcard/read?readImageFlag=true');
	}

	getReadCardOnly() {
		return axios.get(apiUrl + '/api/smartcard/read-card-only?readImageFlag=true');
	}

	getReadConfirmSave(data) {
		return axios.post(apiUrl + '/api/nhso-service/confirm-save', data);
	}

	getLastAuthenCode(pid) {
		return axios.get(apiUrl + '/api/nhso-service/latest-authen-code/' + pid);
	}

	getApiPrefrence() {
		return axios.get(apiUrl + '/api/api/preference');
	}


}
