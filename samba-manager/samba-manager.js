/*  Cockpit Samba Manager - Cockpit plugin for managing Samba.
 *  Copyright (C) 2021 Josh Boudreau <jboudreau@45drives.com>
 * 
 *  This file is part of Cockpit Samba Manager.
 *
 *  Cockpit Samba Manager is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  Cockpit Samba Manager is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with Cockpit Samba Manager.  If not, see <https://www.gnu.org/licenses/>.
 */

var spinner_classes = ["spinner", "spinner-xs", "spinner-inline"];
var success_icon_classes = ["pficon", "pficon-ok"];
var failure_icon_classes = ["pficon", "pficon-error-circle-o"];
var success_classes = ["alert", "alert-success"];
var failure_classes = ["alert", "alert-danger"];
var all_alert_classes = [...success_classes, ...failure_classes];
var all_icon_classes = [...spinner_classes, ...success_icon_classes, ...failure_icon_classes];

var group_info_timeout;
var smbpasswd_info_timeout;

var disallowed_groups = []

function set_current_user(selector) {
	var proc = cockpit.spawn(["whoami"]);
	proc.done(function(data){
		console.log(data);
		data = data.trim();
		selector.value = data;
		update_username_fields();
	});
}

function add_user_options() {
	var select = document.getElementById("user-selection");
	var info = document.getElementById("user-select-info");
	var info_icon = document.getElementById("user-select-info-icon");
	var info_message = document.getElementById("user-select-info-text");
	info_icon.classList.add(...spinner_classes);
	var proc = cockpit.spawn(["cat", "/etc/passwd"], {err: "out"});
	proc.done(function(data) {
		var rows = data.split("\n");
		var users = rows.filter(row => row.length != 0 && !row.match("nologin$") && !row.match("^ntp:") && !row.match("^git:"));
		users = users.sort();
		users.forEach(function(user_row){
			var user = user_row.slice(0, user_row.indexOf(":"));
			var option = document.createElement("option");
			option.value = user;
			option.innerHTML = user;
			select.add(option);
		});
		set_current_user(select);
		info_icon.classList.remove(...spinner_classes);
	});
	proc.fail(function(ex, data) {
		info_icon.classList.remove(...spinner_classes);
		info_icon.classList.add(...failure_icon_classes);
		info.classList.add(...failure_classes);
		info_message.innerText = "Failed to get list of users: " + data;
	});
}

function update_username_fields() {
	var user = document.getElementById("user-selection").value;
	var fields = document.getElementsByClassName("username-45d");
	for(let field of fields){
		field.innerText = user;
	}
}

function add_group_options() {
	var select = document.getElementById("samba-group-selection");
	var info = document.getElementById("add-group-info");
	var info_icon = document.getElementById("add-group-info-icon");
	var info_message = document.getElementById("add-group-info-text");
	info.classList.remove(...all_alert_classes);
	info_icon.classList.remove(...all_icon_classes);
	info_message.innerText = "";
	info_icon.classList.add(...spinner_classes);
	var proc = cockpit.spawn(["cat", "/etc/group"], {err: "out"});
	proc.done(function(data) {
		var rows = data.split("\n");
		// get groups with gid >= 1000
		rows.forEach(function(row) {
			var fields = row.split(":");
			var group = fields[0];
			if(fields.length < 3 || parseInt(fields[2]) < 1000)
				disallowed_groups.push(group)
			else{
				var option = document.createElement("option");
				option.value = group;
				option.innerHTML = group;
				select.add(option);
			}
		});
		info_icon.classList.remove(...spinner_classes);
		update_group_fields();
	});
	proc.fail(function(ex, data) {
		info_icon.classList.remove(...spinner_classes);
		info_icon.classList.add(...failure_icon_classes);
		info.classList.add(...failure_classes);
		info_message.innerText = "Failed to get list of groups: " + data;
	});
}

function update_group_fields() {
	var group = document.getElementById("samba-group-selection").value;
	var fields = document.getElementsByClassName("samba-group-45d");
	for(let field of fields){
		field.innerText = group;
	}
}

function add_to_group() {
	var user = document.getElementById("user-selection").value;
	var group = document.getElementById("samba-group-selection").value;
	var info = document.getElementById("add-group-info");
	var info_icon = document.getElementById("add-group-info-icon");
	var info_message = document.getElementById("add-group-info-text");
	info.classList.remove(...all_alert_classes);
	info_icon.classList.remove(...all_icon_classes);
	info_message.innerText = "";
	info_icon.classList.add(...spinner_classes);
	var proc = cockpit.spawn(["usermod", "-aG", group, user], {err: "out", superuser: "require"});
	proc.done(function(data){
		info_icon.classList.remove(...spinner_classes);
		info_icon.classList.add(...success_icon_classes);
		info.classList.add(...success_classes);
		info_message.innerText = "Successfully added " + user + " to " + group + ".";
	});
	proc.fail(function(ex, data){
		info_icon.classList.remove(...spinner_classes);
		info_icon.classList.add(...failure_icon_classes);
		info.classList.add(...failure_classes);
		info_message.innerText = data;
	});
	if(typeof group_info_timeout !== 'undefined' && group_info_timeout !== null)
		clearTimeout(group_info_timeout);
	setTimeout(function(){
		info.classList.remove(...all_alert_classes);
		info_icon.classList.remove(...all_icon_classes);
		info_message.innerText = "";
	}, 10000);
}

function show_rm_from_group_dialog() {
	var user = document.getElementById("user-selection").value;
	var modal = document.getElementById("rm-from-group-modal");
	modal.style.display = "block";
	window.onclick = function(event){
		if(event.target == modal){
			modal.style.display = "none";
		}
	}
}

function hide_rm_from_group_dialog() {
	var modal = document.getElementById("rm-from-group-modal");
	modal.style.display = "none";
}

function rm_from_group() {
	var user = document.getElementById("user-selection").value;
	var group = document.getElementById("samba-group-selection").value;
	var info = document.getElementById("add-group-info");
	var info_icon = document.getElementById("add-group-info-icon");
	var info_message = document.getElementById("add-group-info-text");
	info.classList.remove(...all_alert_classes);
	info_icon.classList.remove(...all_icon_classes);
	info_message.innerText = "";
	info_icon.classList.add(...spinner_classes);
	var proc = cockpit.script("gpasswd -d " + user + " " + group + " > /dev/null", {err: "out", superuser: "require"});
	proc.done(function(data){
		info_icon.classList.remove(...spinner_classes);
		info_icon.classList.add(...success_icon_classes);
		info.classList.add(...success_classes);
		info_message.innerText = "Successfully removed " + user + " from " + group + ".";
	});
	proc.fail(function(ex, data){
		info_icon.classList.remove(...spinner_classes);
		info_icon.classList.add(...failure_icon_classes);
		info.classList.add(...failure_classes);
		info_message.innerText = data;
	});
	hide_rm_from_group_dialog();
	if(typeof group_info_timeout !== 'undefined' && group_info_timeout !== null)
		clearTimeout(group_info_timeout);
	group_info_timeout = setTimeout(function(){
		info.classList.remove(...all_alert_classes);
		info_icon.classList.remove(...all_icon_classes);
		info_message.innerText = "";
	}, 10000);
}

function show_smbpasswd_dialog() {
	var modal = document.getElementById("smbpasswd-modal");
	modal.style.display = "block";
	window.onclick = function(event){
		if(event.target == modal){
			modal.style.display = "none";
		}
	}
}

function hide_smbpasswd_dialog() {
	var modal = document.getElementById("smbpasswd-modal");
	modal.style.display = "none";
}

function check_passwords() {
	var info = document.getElementById("smbpasswd-modal-info");
	var info_icon = document.getElementById("smbpasswd-modal-info-icon");
	var info_message = document.getElementById("smbpasswd-modal-info-text");
	info.classList.remove(...all_alert_classes);
	info_icon.classList.remove(...all_icon_classes);
	info_message.innerText = "";
	var pw1 = document.getElementById("smbpasswd-pw1").value;
	var pw2 = document.getElementById("smbpasswd-pw2").value;
	if(pw1.length == 0 || pw2.length == 0){
		info_icon.classList.add(...failure_icon_classes);
		info.classList.add(...failure_classes);
		info_message.innerText = "Password cannot be empty!";
		return [false, ""];
	}
	if(pw1 !== pw2){
		info_icon.classList.add(...failure_icon_classes);
		info.classList.add(...failure_classes);
		info_message.innerText = "Passwords do not match!";
		return [false, ""];
	}
	return [true, pw1];
}

function set_smbpasswd() {
	var user = document.getElementById("user-selection").value;
	var info = document.getElementById("smbpasswd-info");
	var info_icon = document.getElementById("smbpasswd-info-icon");
	var info_message = document.getElementById("smbpasswd-info-text");
	info.classList.remove(...all_alert_classes);
	info_icon.classList.remove(...all_icon_classes);
	info_message.innerText = "";
	info_icon.classList.add(...spinner_classes);
	const [res, passwd] = check_passwords();
	if(res === true){
		var proc = cockpit.spawn(["smbpasswd", "-s", "-a", user], { err: "out", superuser: "required" });
		proc.input(passwd + "\n" + passwd + "\n");
		proc.done(function(){
			hide_smbpasswd_dialog();
			info_icon.classList.remove(...spinner_classes);
			info_icon.classList.add(...success_icon_classes);
			info.classList.add(...success_classes);
			info_message.innerText = "Successfully set Samba password for " + user + ".";
		});
		proc.fail(function(ex, data){
			var info = document.getElementById("smbpasswd-modal-info");
			var info_icon = document.getElementById("smbpasswd-modal-info-icon");
			var info_message = document.getElementById("smbpasswd-modal-info-text");
			info.classList.remove(...all_alert_classes);
			info_icon.classList.remove(...all_icon_classes);
			info_icon.classList.add(...failure_icon_classes);
			info.classList.add(...failure_classes);
			info_message.innerText = "Error setting samba password:";
			if(ex.problem === "not-found")
				info_message.innerText += " smbpasswd not found.";
			else
				info_message.innerText += " " + data;
		});
	}
	if(typeof smbpasswd_info_timeout !== 'undefined' && smbpasswd_info_timeout !== null)
		clearTimeout(smbpasswd_info_timeout);
	smbpasswd_info_timeout = setTimeout(function(){
		info.classList.remove(...all_alert_classes);
		info_icon.classList.remove(...all_icon_classes);
		info_message.innerText = "";
	}, 10000);
}

function show_rm_smbpasswd_dialog() {
	var user = document.getElementById("user-selection").value;
	var modal = document.getElementById("rm-smbpasswd-modal");
	modal.style.display = "block";
	window.onclick = function(event){
		if(event.target == modal){
			modal.style.display = "none";
		}
	}
}

function hide_rm_smbpasswd_dialog() {
	var modal = document.getElementById("rm-smbpasswd-modal");
	modal.style.display = "none";
}

function rm_smbpasswd() {
	var user = document.getElementById("user-selection").value;
	var info = document.getElementById("smbpasswd-info");
	var info_icon = document.getElementById("smbpasswd-info-icon");
	var info_message = document.getElementById("smbpasswd-info-text");
	info.classList.remove(...all_alert_classes);
	info_icon.classList.remove(...all_icon_classes);
	info_message.innerText = "";
	info_icon.classList.add(...spinner_classes);
	var proc = cockpit.script("smbpasswd -x " + user, {err: "out", superuser: "require"});
	proc.done(function(data){
		info_icon.classList.remove(...spinner_classes);
		info_icon.classList.add(...success_icon_classes);
		info.classList.add(...success_classes);
		info_message.innerText = "Successfully removed Samba password for " + user + ".";
	});
	proc.fail(function(ex, data){
		info_icon.classList.remove(...spinner_classes);
		info_icon.classList.add(...failure_icon_classes);
		info.classList.add(...failure_classes);
		info_message.innerText = data;
	});
	hide_rm_smbpasswd_dialog();
	if(typeof smbpasswd_info_timeout !== 'undefined' && smbpasswd_info_timeout !== null)
		clearTimeout(smbpasswd_info_timeout);
	smbpasswd_info_timeout = setTimeout(function(){
		info.classList.remove(...all_alert_classes);
		info_icon.classList.remove(...all_icon_classes);
		info_message.innerText = "";
	}, 10000);
}

function set_up_buttons() {
	document.getElementById("user-selection").addEventListener("change", update_username_fields);
	document.getElementById("samba-group-selection").addEventListener("change", update_group_fields);
	
	document.getElementById("add-to-group-btn").addEventListener("click", add_to_group);
	
	document.getElementById("show-rm-from-group-btn").addEventListener("click", show_rm_from_group_dialog);
	document.getElementById("cancel-rm-from-group-btn").addEventListener("click", hide_rm_from_group_dialog);
	document.getElementById("close-rm-from-group-btn").addEventListener("click", hide_rm_from_group_dialog);
	document.getElementById("continue-rm-from-group-btn").addEventListener("click", rm_from_group);
	
	document.getElementById("show-smbpasswd-dialog-btn").addEventListener("click", show_smbpasswd_dialog);
	document.getElementById("cancel-smbpasswd").addEventListener("click", hide_smbpasswd_dialog);
	document.getElementById("close-smbpasswd").addEventListener("click", hide_smbpasswd_dialog);
	document.getElementById("set-smbpasswd").addEventListener("click", set_smbpasswd);
	document.getElementById("show-rm-smbpasswd-btn").addEventListener("click", show_rm_smbpasswd_dialog);
	document.getElementById("cancel-rm-smbpasswd").addEventListener("click", hide_rm_smbpasswd_dialog);
	document.getElementById("close-rm-smbpasswd").addEventListener("click", hide_rm_smbpasswd_dialog);
	document.getElementById("continue-rm-smbpasswd").addEventListener("click", rm_smbpasswd);
}

function main() {
	add_user_options();
	add_group_options();
	set_up_buttons();
}

main();
