const appid = get_text("appid.txt");
const version = 6;
var proxyurl = "https://cors-anywhere.herokuapp.com/";

function get_time() {
	var now = new Date();
	return Math.floor(now.getTime()/1000);
}

function login(username, password, region, storecreds) {
	var to_return = {"region": region};
	var app_details = {
		"password": password,
		"ts": get_time(),
		"appid": appid.deobfuscate(),
	}
	if (username.indexOf("@") > -1) {
		app_details["email"] = username;
	} else {
		app_details["phoneNumber"] = username;
	}
	var secret = get_text("appsecret.txt");
	var nonce = JSON.stringify(app_details);
	var hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, secret.deobfuscate());
	hmac.update(nonce);
	var hash = hmac.finalize();
	var sign = hash.toString(CryptoJS.enc.Base64);
	var headers = {
		"Authorization" : "Sign " + sign,
		"Content-Type"  : "application/json;charset=UTF-8"
	}
	if (region == "cn") {
		var url = "https://"+region+"-api.coolkit.cn:8080/api/user/login";
	} else {
		var url = "https://"+region+"-api.coolkit.cc:8080/api/user/login";
	}
	$.ajax({
		url: proxyurl+url,
		type: "POST",
		headers: headers,
		data: JSON.stringify(app_details),
		dataType: "json",
		async: false,
		success: function (json) {
			console.log(json);
			if ("at" in json) {
				to_return["bearer_token"] = json["at"];
				to_return["refresh_token"] = json["rt"];
				to_return["user_apikey"] = json["user"]["apikey"];
				to_return["logged_in"] = true;
				if (storecreds == true) {
					setCookie("bearer_token", json["at"], 24*365);
					setCookie("refresh_token", json["rt"], 24*365);
					setCookie("user_apikey", json["user"]["apikey"], 24*365)
					setCookie("region", region, 24*365)
				}
			} else {
				to_return["logged_in"] = false;
			}
		}
	});
	return to_return;
}

function refresh_token(user_info) {
	console.log("refreshing token");
	if (region == "cn") {
		var url = "https://"+user_info["region"]+"-api.coolkit.cn:8080/api/user/refresh";
	} else {
		var url = "https://"+user_info["region"]+"-api.coolkit.cc:8080/api/user/refresh";
	}
	var params = {
		"grantType": "refresh",
		"rt": user_info["refresh_token"],
		"appid": appid.deobfuscate()
	}
	$.ajax({
		url: proxyurl+url,
		type: "GET",
		data: params,
		dataType: "json",
		success: function (json) {
			console.log("new token");
			if ("at" in json) {
				user_info["bearer_token"] = json["at"];
				user_info["refresh_token"] = json["rt"];
				setCookie("bearer_token", json["at"], 24*365);
				setCookie("refresh_token", json["rt"], 24*365);
			}
		}
	});
}

function get_device_list(user_info) {
	to_return = {};
	query_params = {
		"lang": "en",
		"version": version,
		"appid": appid.deobfuscate(),
	}
	if (region == "cn") {
		var url = "https://"+user_info["region"]+"-api.coolkit.cn:8080/api/user/device";
	} else {
		var url = "https://"+user_info["region"]+"-api.coolkit.cc:8080/api/user/device";
	}
	var headers = {
		"Authorization" : "Bearer " + user_info["bearer_token"],
		"Content-Type"  : "application/json;charset=UTF-8"
	}
	$.ajax({
		url: proxyurl+url,
		type: "GET",
		headers: headers,
		data: query_params,
		dataType: "json",
		async: false,
		success: function (json) {
			console.log(json);
			if (json["error"] == 0) {
				to_return["devices"] = {};
				for (device in json["devicelist"]) {
					var device_id = json["devicelist"][device]["deviceid"];
					to_return["devices"][device_id] = json["devicelist"][device];
				}
				to_return["success"] = true;
			} else {
				to_return["success"] = false;
			}
		}
	});
	return to_return;
}

function get_ws_address(user_info, lookup) {
	if (lookup == true) {
		var to_return = user_info["ws_address"];
		if (region == "cn") {
			var url = "https://"+user_info["region"]+"-disp.coolkit.cn:8080/dispatch/app";
		} else {
			var url = "https://"+user_info["region"]+"-disp.coolkit.cc:8080/dispatch/app";
		}
		$.ajax({
			url: proxyurl+url,
			type: "GET",
			dataType: "json",
			async: false,
			success: function (json) {
				console.log(json);
				to_return = "wss://"+json["domain"]+":"+json["port"]+"/api/ws";
			}
		});
		return to_return;
	} else {
		var domain = user_info["region"]+"-pconnect"+Math.ceil(Math.random()*3)+".coolkit.cc";
		return "wss://"+domain+":8080/api/ws";
	}
}

function get_ws(user_info, lookup) {
	if (lookup == true) {
		user_info["ws_address"] = get_ws_address(user_info, lookup);
	}
	ws = new WebSocket(user_info["ws_address"]);
	ws.onmessage = function (event) {
		var data = JSON.parse(event["data"]);
		console.log(data);
		if ("action" in data && data["action"] == "update" && "params" in data && "switch" in data["params"]) {
			var device_id = data["deviceid"];
			var new_state = data["params"]["switch"];
			var device = user_info["devices"][device_id];
			device["params"]["switch"] = new_state;
			redraw_devices(user_info);
		}
		if ("action" in data && data["action"] == "sysmsg" && "params" in data && "online" in data["params"]) {
			var device_id = data["deviceid"];
			var new_online = data["params"]["online"];
			var device = user_info["devices"][device_id];
			device["online"] = new_online;
			redraw_devices(user_info);
		}
	}
	ws.onopen = function (event) {
		console.log("ws open");
		ping_ws(user_info, ws);
		setInterval(ping_ws, 120000, user_info, ws);
	}
	ws.onclose = function (event) {
		console.log("ws closed. Reconnect will be attempted in 1 second.", event.reason);
		setTimeout(function() {
			user_info["ws"] = get_ws(user_info, true);
		}, 1000);
	};
	return ws;
}

function ping_ws(user_info, ws) {
	payload = {
		"action"    : "userOnline",
		"userAgent" : "app",
		"at"        : user_info["bearer_token"],
		"apikey"    : user_info["user_apikey"],
		"sequence"  : get_time(),
	}
	ws.send(JSON.stringify(payload));
}

function switch_device(device, user_info, new_state) {
	var ws = user_info["ws"];
	if (ws["readyState"] == 1) {
		payload = {
			"action"        : "update",
			"userAgent"     : "app",
			"params"        : { "switch" : new_state },
			"apikey"        : device["apikey"],
			"deviceid"      : device["deviceid"],
			"sequence"      : get_time(),
		}
		if ("controlType" in device["params"]) {
			payload["controlType"] = device["params"]["controlType"];
		} else {
			payload["controlType"] = 4;
		}
		ws.send(JSON.stringify(payload));
		return true;
	} else {
		return false;
	}
}

function do_login() {
	var login_div = document.getElementById("login");
	login_div.classList.add("hidden");
	var loader_div = document.getElementById("loader");
	loader_div.classList.remove("hidden");
	var username = document.getElementById("username").value;
	var password = document.getElementById("password").value;
	var region = document.getElementById("region").value;
	var storecreds = document.getElementById("storecreds").checked;
	setTimeout(function(){
		user_info = login(username, password, region, storecreds);
		if (user_info["logged_in"] == true) {
			device_list = get_device_list(user_info);
			user_info["devices"] = device_list["devices"];
			on_login(user_info);
		} else {
			on_logout();
			document.getElementById("loginfailed").innerHTML = "Login failed";
		}
	}, 100);
}

function check_login(user_info) {
	if (! user_info["bearer_token"] == "") {
		console.log("Getting devices");
		device_list = get_device_list(user_info);
		if (device_list["success"] == true) {
			user_info["devices"] = device_list["devices"];
			refresh_token(user_info);
			return true;
		}
		return false;
	} else {
		console.log("No bearer_token");
		return false;
	}
}

function on_login(user_info) {
	var login_div = document.getElementById("login");
	login_div.classList.add("hidden");
	var switches = document.getElementById("switches");
	switches.classList.remove("hidden");
	var loader_div = document.getElementById("loader");
	loader_div.classList.add("hidden");
	redraw_devices(user_info);
	user_info["ws_address"] = get_ws_address(user_info);
	user_info["ws"] = get_ws(user_info);
}

function redraw_devices(user_info) {
	var devices = user_info["devices"];
	var switches = document.getElementById("switches");
	switches.innerHTML = "";
	var tbl = document.createElement("table");
	var tbdy = document.createElement("tbody");
	for (device_id in devices) {
		var brand = devices[device_id]["brandName"];
		var model = devices[device_id]["productModel"];
		var name = devices[device_id]["name"];
		var online = devices[device_id]["online"];
		var state = devices[device_id]["params"]["switch"];
		var tr = document.createElement("tr");
		var td = document.createElement("td");
		td.appendChild(document.createTextNode(brand+" "+model+" "+name+": "))
		tr.appendChild(td);
		var td2 = document.createElement("td");
		var a = document.createElement("a");
		a.setAttribute("id", "id_"+device_id);
		a.classList.add("ui-btn", "ui-btn-inline", "ui-icon-power", "ui-btn-icon-left");
		var label = document.createTextNode(capitalise(state));
		if (online == false) {
			a.classList.add("ui-disabled");
			var label = document.createTextNode("Offline");
		} else if (state == "off") {
			a.classList.add("ui-btn-b");
		}
		a.appendChild(label);
		a.onclick = function() { toggle(this); };
		td2.appendChild(a);
		tr.appendChild(td2);
		tbdy.appendChild(tr);
	}
	tbl.appendChild(tbdy);
	switches.appendChild(tbl);
	switches.innerHTML += '<br /><div class="in-line-div"><button onclick="logout()" class="ui-btn ui-icon-action ui-btn-icon-left ui-shadow ui-corner-all borderShadow">Logout</button></div>';
}

function toggle(element) {
	device_id = element.id.replace("id_", "");
	var device = user_info["devices"][device_id];
	var state = device["params"]["switch"];
	if (state == "off") {
		new_state = "on";
	} else {
		new_state = "off";
	}
	var success = switch_device(device, user_info, new_state);
	if (success == true) {
		device["params"]["switch"] = new_state;
		setTimeout(redraw_devices, 500, user_info);
	}
}

function on_logout() {
	var switches = document.getElementById("switches");
	switches.classList.add("hidden");
	var login_div = document.getElementById("login");
	login_div.classList.remove("hidden");
	var loader_div = document.getElementById("loader");
	loader_div.classList.add("hidden");
}

function logout() {
	setCookie("bearer_token", "", -1);
	setCookie("refresh_token", "", -1);
	setCookie("user_apikey", "", -1);
	location.reload();
}
