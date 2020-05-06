const appid = 'oeVkj2lYFGnJu5XUtWisfW4utiN4u9Mq';
const imei = uuidv4();
const os = 'iOS';
const model = 'iPhone10,6';
const romVersion = '11.1.2';
const appVersion = '3.5.3';
const apkVersion = '1.8';
const version = 6;
var proxyurl = '';
if (location.port >= 8000) {
	proxyurl = "https://cors-anywhere.herokuapp.com/";
}

function uuidv4() {
	return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
		(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
	);
}

function get_time() {
	var now = new Date();
	return Math.floor(now.getTime()/1000);
}

function generate_nonce() {
	return Math.floor(Math.random()*1e15).toString();
}

function login(username, password) {
	var to_return = {};
	var app_details = {
		'email': username,
		'password': password,
		'version': version,
		'ts': get_time(),
		'nonce': generate_nonce(),
		'appid': appid,
		'imei': imei,
		'os': os,
		'model': model,
		'romVersion': romVersion,
		'appVersion': appVersion
	}
	var secret="6Nz4n0xA8s8qdxQf2GqurZj2Fs55FUvM";
	var nonce = JSON.stringify(app_details);
	var hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256,secret);
	hmac.update(nonce);
	var hash = hmac.finalize();
	var sign = hash.toString(CryptoJS.enc.Base64);
	to_return['headers'] = {
		'Authorization' : 'Sign ' + sign,
		'Content-Type'  : 'application/json;charset=UTF-8'
	}
	var url = 'https://eu-api.coolkit.cc:8080/api/user/login'
	$.ajax({
		url: proxyurl+url,
		type: 'POST',
		headers:to_return['headers'],
		data: JSON.stringify(app_details),
		dataType: 'json',
		async: false,
		success: function (json) {
			console.log('success');
			console.log(json);
			to_return['bearer_token'] = json['at'];
			to_return['user_apikey'] = json['user']['apikey'];
			to_return['headers']['Authorization'] = 'Bearer '+json['at']
		},
		error: function (json) {
			console.log('error');
			console.log(json);
		}
	});
	return to_return;
}

function get_device_list(user_info) {
	to_return = {};
	query_params = {
		'lang': 'en',
		'version': version,
		'ts': get_time(),
		'nonce': generate_nonce(),
		'appid': appid,
		'imei': imei,
		'os': os,
		'model': model,
		'romVersion': romVersion,
		'appVersion': appVersion
	}
	var url = 'https://eu-api.coolkit.cc:8080/api/user/device';
	$.ajax({
		url: proxyurl+url,
		type: 'GET',
		headers: user_info['headers'],
		data: query_params,
		dataType: 'json',
		async: false,
		success: function (json) {
			console.log('success');
			console.log(json);
			to_return = json['devicelist'];
		},
		error: function (json) {
			console.log('error');
			console.log(json);
		}
	});
	return to_return
}

function get_ws_info(user_info) {
	var to_return = {};
	var url = 'https://eu-disp.coolkit.cc:8080/dispatch/app';
	$.ajax({
		url: proxyurl+url,
		type: 'POST',
		headers: user_info['headers'],
		dataType: 'json',
		async: false,
		success: function (json) {
			console.log('success');
			console.log(json);
			to_return = json;
		},
		error: function (json) {
			console.log('error');
			console.log(json);
		}
	});
	return to_return;
}

function get_ws(user_info, ws_info) {
	ws = new WebSocket('wss://'+ws_info['domain']+':'+ws_info['port']+'/api/ws')

	payload = {
		'action'    : 'userOnline',
		'userAgent' : 'app',
		'version'   : version,
		'nonce'     : generate_nonce(),
		'apkVersion': apkVersion,
		'os'        : os,
		'at'        : user_info['bearer_token'],
		'apikey'    : user_info['user_apikey'],
		'ts'        : get_time(),
		'model'     : model,
		'romVersion': romVersion,
		'sequence'  : get_time()
	}
	ws.onmessage = function (event) {
		console.log(event.data);
	}
	ws.onopen = function (event) {
		console.log('ws open');
		ws.send(JSON.stringify(payload));
	}
	return ws;
}

function switch_device(device, ws, new_state) {
	payload = {
		'action'        : 'update',
		'userAgent'     : 'app',
		'params'        : { 'switch' : new_state },
		'apikey'        : device['apikey'],
		'deviceid'      : device['deviceid'],
		'sequence'      : get_time(),
		'ts'		: 0
        }
        if ('controlType' in device['params']) {
        	payload['controlType'] = device['params']['controlType'];
        } else {
        	payload['controlType'] = 4;
        }
        ws.send(JSON.stringify(payload));
}

function do_login() {
	var username = document.getElementById("username").value;
	var password = document.getElementById("password").value;
	user_info = login(username, password)
	device_list = get_device_list(user_info)
	ws_info = get_ws_info(user_info)
	ws = get_ws(user_info, ws_info)
	//switch_device(device_list[0], ws, 'on')
}
