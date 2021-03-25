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

function add_user_options(){
	var select = document.getElementById("user-selection");
	var info = document.getElementById("user-select-info");
	var info_icon = document.getElementById("user-select-info-icon");
	var info_message = document.getElementById("user-select-info-text");
	info_icon.classList.add(...spinner_classes);
	var proc = cockpit.spawn(["cat", "/etc/passwd"], {err: "out"});
	proc.done(function(data) {
		info_icon.classList.remove(...spinner_classes);
		var rows = data.split("\n");
		users = rows.filter(row => row.length != 0 && !row.match("nologin$") && !row.match("^ntp:") && !row.match("^git:"));
		users.forEach(function(user_row){
			user = user_row.slice(0, user_row.indexOf(":"));
			var option = document.createElement("option");
			option.value = user;
			option.innerHTML = user;
			select.add(option);
		});
	});
	proc.fail(function(ex, data) {
		info_icon.classList.remove(...spinner_classes);
		info_icon.classList.add(...failure_icon_classes);
		info.classList.add(...failure_classes);
		info_message.innerText = "Failed to get list of users: " + data;
	});
}

function add_group() {
	var user = document.getElementById("user-selection").value;
	var info = document.getElementById("add-group-info");
	var info_icon = document.getElementById("add-group-info-icon");
	var info_message = document.getElementById("add-group-info-text");
	info.classList.remove(...all_alert_classes);
	info_icon.classList.remove(...all_icon_classes);
	info_message.innerText = "";
	info_icon.classList.add(...spinner_classes);
	var proc = cockpit.spawn(["usermod", "-aG", "smbadmin", user], {err: "out", superuser: "require"});
	proc.done(function(data){
		info_icon.classList.remove(...spinner_classes);
		info_icon.classList.add(...success_icon_classes);
		info.classList.add(...success_classes);
		info_message.innerText = "Successfully added " + user + " to smbadmin.";
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

function rm_group() {
	var user = document.getElementById("user-selection").value;
	var info = document.getElementById("add-group-info");
	var info_icon = document.getElementById("add-group-info-icon");
	var info_message = document.getElementById("add-group-info-text");
	info.classList.remove(...all_alert_classes);
	info_icon.classList.remove(...all_icon_classes);
	info_message.innerText = "";
	info_icon.classList.add(...spinner_classes);
	var proc = cockpit.script("gpasswd -d " + user + " smbadmin > /dev/null", {err: "out", superuser: "require"});
	proc.done(function(data){
		info_icon.classList.remove(...spinner_classes);
		info_icon.classList.add(...success_icon_classes);
		info.classList.add(...success_classes);
		info_message.innerText = "Successfully removed " + user + " from smbadmin.";
	});
	proc.fail(function(ex, data){
		info_icon.classList.remove(...spinner_classes);
		info_icon.classList.add(...failure_icon_classes);
		info.classList.add(...failure_classes);
		info_message.innerText = data;
	});
	if(typeof group_info_timeout !== 'undefined' && group_info_timeout !== null)
		clearTimeout(group_info_timeout);
	group_info_timeout = setTimeout(function(){
		info.classList.remove(...all_alert_classes);
		info_icon.classList.remove(...all_icon_classes);
		info_message.innerText = "";
	}, 10000);
}

function show_smbpasswd_dialog() {
	var user = document.getElementById("user-selection").value;
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
	var info = document.getElementById("smbpasswd-info");
	var info_icon = document.getElementById("smbpasswd-info-icon");
	var info_message = document.getElementById("smbpasswd-info-text");
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
	const [res, passwd] = check_passwords();
	if(res === true){
		var proc = cockpit.spawn(["smbpasswd", "-s", "-a", user], { err: "out", superuser: "required" });
		proc.input(passwd + "\n" + passwd + "\n");
		proc.done(function(){
			hide_smbpasswd_dialog();
		});
		proc.fail(function(ex, data){
			var info = document.getElementById("smbpasswd-info");
			var info_icon = document.getElementById("smbpasswd-info-icon");
			var info_message = document.getElementById("smbpasswd-info-text");
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
}

function set_up_buttons() {
	document.getElementById("add-group-btn").addEventListener("click", add_group);
	document.getElementById("rm-group-btn").addEventListener("click", rm_group);
	document.getElementById("show-smbpasswd-dialog-btn").addEventListener("click", show_smbpasswd_dialog);
	document.getElementById("cancel-smbpasswd").addEventListener("click", hide_smbpasswd_dialog);
	document.getElementById("close-smbpasswd").addEventListener("click", hide_smbpasswd_dialog);
	document.getElementById("set-smbpasswd").addEventListener("click", set_smbpasswd);
}

function main() {
	add_user_options();
	set_up_buttons();
}

main();
