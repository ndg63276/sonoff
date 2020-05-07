const appid = 'oeVkj2lYFGnJu5XUtWisfW4utiN4u9Mq';
const imei = uuidv4();
const os = 'iOS';
const model = 'iPhone10,6';
const romVersion = '11.1.2';
const appVersion = '3.5.3';
const apkVersion = '1.8';
const version = 6;
var proxyurl = "https://cors-anywhere.herokuapp.com/";

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
	var headers = {
		'Authorization' : 'Sign ' + sign,
		'Content-Type'  : 'application/json;charset=UTF-8'
	}
	var url = 'https://eu-api.coolkit.cc:8080/api/user/login'
	$.ajax({
		url: proxyurl+url,
		type: 'POST',
		headers: headers,
		data: JSON.stringify(app_details),
		dataType: 'json',
		async: false,
		success: function (json) {
			console.log(json);
			if ('at' in json) {
				to_return['bearer_token'] = json['at'];
				setCookie('bearer_token', json['at'], 1);
				to_return['user_apikey'] = json['user']['apikey'];
				setCookie('user_apikey', json['user']['apikey'], 1)
				to_return['logged_in'] = true;
			} else {
				to_return['logged_in'] = false;
			}
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
	var headers = {
		'Authorization' : 'Bearer ' + user_info['bearer_token'],
		'Content-Type'  : 'application/json;charset=UTF-8'
	}
	$.ajax({
		url: proxyurl+url,
		type: 'GET',
		headers: headers,
		data: query_params,
		dataType: 'json',
		async: false,
		success: function (json) {
			console.log(json);
			if (json['error'] == 0) {
				to_return['devices'] = json['devicelist'];
				to_return['success'] = true;
			} else {
				to_return['success'] = false;
			}
		}
	});
	return to_return
}

function get_ws_address(user_info) {
	var to_return = '';
	var url = 'https://eu-disp.coolkit.cc:8080/dispatch/app';
	$.ajax({
		url: proxyurl+url,
		type: 'GET',
		dataType: 'json',
		async: false,
		success: function (json) {
			console.log(json);
			to_return = 'wss://'+json['domain']+':'+json['port']+'/api/ws';
		}
	});
	return to_return;
}

function get_ws(user_info) {
	ws = new WebSocket(user_info['ws_address'])
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
	if (user_info['logged_in'] == true) {
		device_list = get_device_list(user_info);
		user_info['devices'] = device_list['devices']
		on_login(user_info);
	} else {
		document.getElementById('loginfailed').innerHTML = 'Login failed';
	}
}

function check_login(user_info) {
	if (! user_info['bearer_token'] == '') {
		console.log('Getting devices');
		device_list = get_device_list(user_info);
		return device_list;
	} else {
		console.log('No bearer_token');
		return false;
	}
}

function on_login(user_info) {
	var login = document.getElementById('login');
	login.classList.add('hidden');
	var switches = document.getElementById('switches');
	switches.classList.remove('hidden');
	update_devices(user_info);
	user_info['ws_address'] = get_ws_address(user_info);
	user_info['ws'] = get_ws(user_info);
}

function update_devices(user_info, force_update) {
	if (force_update == true) {
		device_list = get_device_list(user_info);
		user_info['devices'] = device_list['devices']
	}
	var devices = user_info['devices']
	var switches = document.getElementById('switches');
	switches.innerHTML = '';
	for (device in devices) {
		console.log(devices[device]);
		var brand = devices[device]['brandName'];
		var model = devices[device]['productModel'];
		var name = devices[device]['name'];
		var state = devices[device]['params']['switch'];
		switches.innerHTML += '<br />'+brand+' '+model+' '+name+': ';
		if (state == 'off') {
			switches.innerHTML += '<a href="#" class="ui-btn ui-btn-b ui-btn-inline ui-icon-power ui-btn-icon-left" onclick="toggle('+device+');">Off</a>';
		} else {
			switches.innerHTML += '<a href="#" class="ui-btn ui-btn-inline ui-icon-power ui-btn-icon-left" onclick="toggle('+device+');">On</a>';
		}
	}
}

function toggle(device_no) {
	var device = user_info['devices'][device_no];
	var state = device['params']['switch'];
	if (state == 'off') {
		new_state = 'on';
	} else {
		new_state = 'off';
	}
	switch_device(device, user_info['ws'], new_state);
	update_devices(user_info, true);
}

function on_logout() {
	var switches = document.getElementById('switches');
	switches.classList.add('hidden');
	var login = document.getElementById('login');
	login.classList.remove('hidden');
}
	//ws = get_ws(user_info, ws_info)
	//switch_device(device_list[0], ws, 'on')

