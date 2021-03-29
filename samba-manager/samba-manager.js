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
var group_info_timeout;

var disallowed_groups = []
var valid_groups = []

function set_current_user(selector) {
	var proc = cockpit.spawn(["whoami"]);
	proc.done(function(data){
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
	set_curr_user_group_list();
}

function add_group_options() {
	var select = document.getElementById("samba-group-selection");
	var groups_list = document.getElementById("groups-list");
	var info = document.getElementById("add-group-info");
	var info_icon = document.getElementById("add-group-info-icon");
	var info_message = document.getElementById("add-group-info-text");
	info.classList.remove(...all_alert_classes);
	info_icon.classList.remove(...all_icon_classes);
	info_message.innerText = "";
	info_icon.classList.add(...spinner_classes);
	
	while (select.firstChild) {
		select.removeChild(select.firstChild);
	}
	
	while (groups_list.firstChild) {
		groups_list.removeChild(groups_list.firstChild);
	}
	
	var proc = cockpit.spawn(["cat", "/etc/group"], {err: "out"});
	proc.done(function(data) {
		var rows = data.split("\n");
		// get groups with gid >= 1000
		valid_groups.length = disallowed_groups.length = 0;
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
				valid_groups.push(group);
			}
		});
		valid_groups.sort();
		valid_groups.forEach(group => groups_list.appendChild(create_group_list_entry(group)));
		update_group_fields();
		info_icon.classList.remove(...spinner_classes);
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

function set_curr_user_group_list() {
	var user = document.getElementById("user-selection").value;
	var info = document.getElementById("user-select-info");
	var info_icon = document.getElementById("user-select-info-icon");
	var info_message = document.getElementById("user-select-info-text");
	info.classList.remove(...all_alert_classes);
	info_icon.classList.remove(...all_icon_classes);
	info_message.innerText = "";
	info_icon.classList.add(...spinner_classes);
	var proc = cockpit.spawn(["groups", user], {err: "out", superuser: "require"});
	proc.done(function(data) {
		var group_list = data.trim().split(" ");
		group_list = group_list.filter(group => group.length > 0 && !disallowed_groups.includes(group));
		document.getElementById("user-group-list").innerText = group_list.sort().join(', ');
		info_icon.classList.remove(...spinner_classes);
	});
	proc.fail(function(ex, data) {
		document.getElementById("user-group-list").innerText = "Could not determine current groups.";
		info_icon.classList.remove(...spinner_classes);
	});
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
		set_curr_user_group_list();
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
		set_curr_user_group_list();
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

function create_group_list_entry(group_name) {
	var entry = document.createElement("div");
	entry.classList.add("row-45d", "flex-45d-space-between", "flex-45d-center", "highlight-grey");
	
	var name = document.createElement("div");
	name.innerText = group_name;
	name.classList.add("monospace-45d");
	
	var spacer = document.createElement("div");
	var subspacer = document.createElement("div");
	subspacer.classList.add("horizontal-spacer");
	spacer.appendChild(subspacer);
	
	var del = document.createElement("button");
	del.classList.add("circle-icon", "circle-icon-danger");
	del.addEventListener("click", function() {
		show_rm_group_dialog(group_name, [del, subspacer, spacer, name, entry]);
	});
	del.innerHTML = "&times;";
	
	entry.appendChild(name);
	entry.appendChild(spacer);
	entry.appendChild(del);
	return entry;
}

function show_rm_group_dialog(group_name, element_list) {
	var group_name_fields = document.getElementsByClassName("group-to-remove");
	for(let field of group_name_fields){
		field.innerText = group_name;
	}
	var modal = document.getElementById("rm-group-modal");
	modal.style.display = "block";
	window.onclick = function(event){
		if(event.target == modal){
			modal.style.display = "none";
		}
	}
	var continue_rm_group = document.getElementById("continue-rm-group");
	continue_rm_group.onclick = function() {
		rm_group(group_name, element_list);
	}
}

function hide_rm_group_dialog() {
	var modal = document.getElementById("rm-group-modal");
	modal.style.display = "none";
}

function rm_group(group_name, element_list) {
	var info = document.getElementById("group-info");
	var info_icon = document.getElementById("group-info-icon");
	var info_message = document.getElementById("group-info-text");
	info.classList.remove(...all_alert_classes);
	info_icon.classList.remove(...all_icon_classes);
	info_message.innerText = "";
	info_icon.classList.add(...spinner_classes);
	var proc = cockpit.spawn(["groupdel", group_name], {err: "out", superuser: "require"});
	proc.done(function(data) {
		info_icon.classList.remove(...spinner_classes);
		element_list.forEach(elem => elem.remove());
		add_group_options();
		set_curr_user_group_list();
	});
	proc.fail(function(ex, data) {
		info_icon.classList.remove(...spinner_classes);
		info_icon.classList.add(...failure_icon_classes);
		info.classList.add(...failure_classes);
		info_message.innerText = data;
	});
	if(typeof group_info_timeout !== 'undefined' && smbpasswd_info_timeout !== null)
		clearTimeout(group_info_timeout);
	group_info_timeout = setTimeout(function(){
		info.classList.remove(...all_alert_classes);
		info_icon.classList.remove(...all_icon_classes);
		info_message.innerText = "";
	}, 10000);
	hide_rm_group_dialog();
}

function show_add_group_dialog() {
	var modal = document.getElementById("add-group-modal");
	check_group_name();
	modal.style.display = "block";
	window.onclick = function(event){
		if(event.target == modal){
			modal.style.display = "none";
		}
	}
}

function hide_add_group_dialog() {
	var modal = document.getElementById("add-group-modal");
	modal.style.display = "none";
}

function add_group() {
	var group_name = document.getElementById("new-group-name").value;
	var info = document.getElementById("add-group-modal-info");
	var info_icon = document.getElementById("add-group-modal-info-icon");
	var info_message = document.getElementById("add-group-modal-info-text");
	info.classList.remove(...all_alert_classes);
	info_icon.classList.remove(...all_icon_classes);
	info_message.innerText = "";
	if(check_group_name()){
		info_icon.classList.add(...spinner_classes);
		var proc = cockpit.spawn(["groupadd", group_name], {err: "out", superuser: "require"});
		proc.done(function(data) {
			add_group_options();
			info_icon.classList.remove(...spinner_classes);
			hide_add_group_dialog();
		});
		proc.fail(function(ex, data) {
			info_icon.classList.remove(...spinner_classes);
			info_icon.classList.add(...failure_icon_classes);
			info.classList.add(...failure_classes);
			info_message.innerText = data;
		});
	}
}

function check_group_name() {
	var group_name = document.getElementById("new-group-name").value;
	var button = document.getElementById("continue-add-group");
	var info_message = document.getElementById("add-group-modal-feedback");
	info_message.innerText = " ";
	if(group_name.length === 0){
		button.disabled = true;
		info_message.innerText = "Group name is empty.";
		return false;
	}else if(!group_name.match(/^[a-z_][a-z0-9_-]*[$]?$/)){
		button.disabled = true;
		var invalid_chars = [];
		if(group_name[0].match(/[^a-z_]/))
			invalid_chars.push("'"+group_name[0]+"'");
		for(char of group_name.slice(1,-1))
			if(char.match(/[^a-z0-9_-]/))
				invalid_chars.push("'"+char+"'");
		if(group_name[group_name.length - 1].match(/[^a-z0-9_\-$]/))
			invalid_chars.push("'"+group_name[group_name.length - 1]+"'");
		info_message.innerText = "Group name contains invalid characters: " + invalid_chars.join(", ");
		return false;
	}
	button.disabled = false;
	return true;
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
	
	document.getElementById("cancel-rm-group").addEventListener("click", hide_rm_group_dialog);
	document.getElementById("close-rm-group").addEventListener("click", hide_rm_group_dialog);
	
	document.getElementById("add-group-btn").addEventListener("click", show_add_group_dialog);
	document.getElementById("cancel-add-group").addEventListener("click", hide_add_group_dialog);
	document.getElementById("close-add-group").addEventListener("click", hide_add_group_dialog);
	document.getElementById("continue-add-group").addEventListener("click", add_group);
	document.getElementById("new-group-name").addEventListener("input", check_group_name);
}

function main() {
	add_user_options();
	add_group_options();
	set_up_buttons();
}

main();
