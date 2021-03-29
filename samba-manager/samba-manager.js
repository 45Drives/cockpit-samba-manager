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

var info_timeout = {};

var group_info_timeout;
var smbpasswd_info_timeout;
var group_info_timeout;
var share_info_timeout;

var disallowed_groups = []
var valid_groups = []

function clear_info(id) {
	var info = document.getElementById(id + "-info");
	var info_icon = document.getElementById(id + "-info-icon");
	var info_message = document.getElementById(id + "-info-text");
	info.classList.remove(...all_alert_classes);
	info_icon.classList.remove(...all_icon_classes);
	info_message.innerText = "";
	return [info, info_icon, info_message];
}

function set_spinner(id) {
	[info, info_icon, info_message] = clear_info(id);
	info_icon.classList.add(...spinner_classes);
}

function set_error(id, message, timeout = -1) {
	[info, info_icon, info_message] = clear_info(id);
	info_icon.classList.add(...failure_icon_classes);
	info.classList.add(...failure_classes);
	info_message.innerText = message;
	if(timeout > 0){
		if(typeof info_timeout[id] !== 'undefined' && info_timeout[id] !== null)
			clearTimeout(info_timeout[id]);
		info_timeout[id] = setTimeout(function(){
			info.classList.remove(...all_alert_classes);
			info_icon.classList.remove(...all_icon_classes);
			info_message.innerText = "";
		}, 10000);
	}
}

function set_success(id, message, timeout = -1) {
	[info, info_icon, info_message] = clear_info(id);
	info_icon.classList.add(...success_icon_classes);
	info.classList.add(...success_classes);
	info_message.innerText = message;
	if(timeout > 0){
		if(typeof info_timeout[id] !== 'undefined' && info_timeout[id] !== null)
			clearTimeout(info_timeout[id]);
		info_timeout[id] = setTimeout(function(){
			info.classList.remove(...all_alert_classes);
			info_icon.classList.remove(...all_icon_classes);
			info_message.innerText = "";
		}, 10000);
	}
}

function set_current_user(selector) {
	var proc = cockpit.spawn(["whoami"]);
	proc.done(function(data){
		data = data.trim();
		selector.value = data;
		update_username_fields();
	});
}

function add_user_options() {
	set_spinner("user-select");
	var select = document.getElementById("user-selection");
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
		clear_info("user-select");
	});
	proc.fail(function(ex, data) {
		set_error("user-select", "Failed to get list of users: " + data);
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
	set_spinner("add-group");
	var select = document.getElementById("samba-group-selection");
	var groups_list = document.getElementById("groups-list");
	
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
		clear_info("add-group");
	});
	proc.fail(function(ex, data) {
		set_error("add-group", "Failed to get list of groups: " + data);
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
	set_spinner("user-select");
	var user = document.getElementById("user-selection").value;
	var proc = cockpit.spawn(["groups", user], {err: "out", superuser: "require"});
	proc.done(function(data) {
		var group_list = data.trim().split(" ");
		group_list = group_list.filter(group => group.length > 0 && !disallowed_groups.includes(group));
		document.getElementById("user-group-list").innerText = group_list.sort().join(', ');
		clear_info("user-select");
	});
	proc.fail(function(ex, data) {
		document.getElementById("user-group-list").innerText = "Could not determine current groups.";
		clear_info("user-select");
	});
}

function add_to_group() {
	set_spinner("add-group");
	var user = document.getElementById("user-selection").value;
	var group = document.getElementById("samba-group-selection").value;
	var proc = cockpit.spawn(["usermod", "-aG", group, user], {err: "out", superuser: "require"});
	proc.done(function(data){
		set_success("add-group", "Successfully added " + user + " to " + group + ".", 10000);
		set_curr_user_group_list();
	});
	proc.fail(function(ex, data){
		set_error("add-group", data, 10000);
	});
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
	set_spinner("add-group");
	var user = document.getElementById("user-selection").value;
	var group = document.getElementById("samba-group-selection").value;
	var proc = cockpit.script("gpasswd -d " + user + " " + group + " > /dev/null", {err: "out", superuser: "require"});
	proc.done(function(data){
		set_success("add-group", "Successfully removed " + user + " from " + group + ".", 10000);
		set_curr_user_group_list();
	});
	proc.fail(function(ex, data){
		set_error("add-group", data, 10000);
	});
	hide_rm_from_group_dialog();
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
	clear_info("smbpasswd-modal");
	var pw1 = document.getElementById("smbpasswd-pw1").value;
	var pw2 = document.getElementById("smbpasswd-pw2").value;
	if(pw1.length == 0 || pw2.length == 0){
		set_error("smbpasswd-modal", "Password cannot be empty!");
		return [false, ""];
	}
	if(pw1 !== pw2){
		set_error("smbpasswd-modal", "Passwords do not match!");
		return [false, ""];
	}
	return [true, pw1];
}

function set_smbpasswd() {
	set_spinner("smbpasswd-modal");
	var user = document.getElementById("user-selection").value;
	const [res, passwd] = check_passwords();
	if(res === true){
		var proc = cockpit.spawn(["smbpasswd", "-s", "-a", user], { err: "out", superuser: "required" });
		proc.input(passwd + "\n" + passwd + "\n");
		proc.done(function(){
			clear_info("smbpasswd-modal");
			set_success("smbpasswd", "Successfully set Samba password for " + user + ".", 10000);
			hide_smbpasswd_dialog();
		});
		proc.fail(function(ex, data){
			var why = ""
			if(ex.problem === "not-found")
				why = "smbpasswd not found.";
			else
				why = data;
			set_error("smbpasswd-modal", "Error setting samba password: " + why);
		});
	}
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
	set_spinner("smbpasswd")
	var user = document.getElementById("user-selection").value;
	
	var proc = cockpit.script("smbpasswd -x " + user, {err: "out", superuser: "require"});
	proc.done(function(data){
		set_success("smbpasswd", "Successfully removed Samba password for " + user + ".", 10000);
	});
	proc.fail(function(ex, data){
		set_error("smbpasswd", data, 10000);
	});
	hide_rm_smbpasswd_dialog();
}

function create_list_entry(entry_name, on_delete) {
	var entry = document.createElement("div");
	entry.classList.add("row-45d", "flex-45d-space-between", "flex-45d-center", "highlight-grey");
	
	var name = document.createElement("div");
	name.innerText = entry_name;
	name.classList.add("monospace-45d");
	
	var spacer = document.createElement("div");
	var subspacer = document.createElement("div");
	subspacer.classList.add("horizontal-spacer");
	spacer.appendChild(subspacer);
	
	var del = document.createElement("button");
	del.classList.add("circle-icon", "circle-icon-danger");
	del.addEventListener("click", function() {
		on_delete(entry_name, [del, subspacer, spacer, name, entry]);
	});
	del.innerHTML = "&times;";
	
	entry.appendChild(name);
	entry.appendChild(spacer);
	entry.appendChild(del);
	return entry;
}

function create_group_list_entry(group_name) {
	 return create_list_entry(group_name, show_rm_group_dialog);
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
	set_spinner("group");
	var proc = cockpit.spawn(["groupdel", group_name], {err: "out", superuser: "require"});
	proc.done(function(data) {
		set_success("group", "Successfully deleted " + group_name + ".", 10000);
		element_list.forEach(elem => elem.remove());
		add_group_options();
		set_curr_user_group_list();
	});
	proc.fail(function(ex, data) {
		set_error("group", data, 10000);
	});
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
	if(check_group_name()){
		set_spinner("add-group-modal");
		var proc = cockpit.spawn(["groupadd", group_name], {err: "out", superuser: "require"});
		proc.done(function(data) {
			hide_add_group_dialog();
			add_group_options();
			clear_info("add-group-modal");
			set_success("group", "Successfully added " + group_name, 10000);
		});
		proc.fail(function(ex, data) {
			set_error("add-group-modal", data);
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

function parse_shares(lines) {
	var shares = {};
	var global_samba_conf = {};
	var section = ""
	for(let line of lines){
		line = line.trim();
		if(line.length === 0)
			continue;
		var section_match = line.match(/^\[([^\]]+)\]$/)
		if(section_match){
			section = section_match[1].trim();
			if(!section.match(/^[Gg]lobal$/))
				shares[section] = {};
			continue;
		}
		var option_match = line.match(/^([^=]+)=(.+)$/)
		if(option_match){
			key = option_match[1].toLowerCase().replace(/\s/g, "");
			value = option_match[2].trim();
			if(section.match(/^[Gg]lobal$/))
				global_samba_conf[key] = value;
			else
				shares[section][key] = value;
			continue;
		}
		console.log("Unknown smb entry: " + line);
	}
	return [shares, global_samba_conf];
}

function create_share_list_entry(share_name, on_delete) {
	var entry = create_list_entry(share_name, on_delete);
	return entry;
}

function populate_share_list() {
	var shares_list = document.getElementById("shares-list");
	
	while (shares_list.firstChild) {
		shares_list.removeChild(shares_list.firstChild);
	}
	
	var proc = cockpit.spawn(["net", "conf", "list"], {err: "out", superuser: "require"});
	proc.done(function(data) {
		const [shares, glob] = parse_shares(data.split("\n"));
		if(Object.keys(shares).length === 0){
			var msg = document.createElement("div");
			msg.innerText = "No shares. Click \"New Share\" to add one.";
			msg.classList.add("row-45d");
			shares_list.appendChild(msg);
		}else{
			Object.keys(shares).forEach(function(share_name) {
				var item = create_share_list_entry(share_name, show_rm_share_dialog);
				item.firstChild.onclick = function() {
					show_share_dialog("edit", share_name, shares[share_name]);
				}
				item.firstChild.classList.add("clickable");
				shares_list.appendChild(item);
			});
		}
	});
	proc.fail(function(ex, data) {
		set_error("share", data);
	});
}

function show_share_dialog(create_or_edit, share_name = "", share_settings = {}) {
	var modal = document.getElementById("share-modal");
	var func = document.getElementById("share-modal-function");
	var button = document.getElementById("continue-share");
	if(create_or_edit === "create"){
		func.innerText = "Add New";
		button.onclick = function(){
			add_share();
		}
		document.getElementById("share-name").disabled = false;
		set_share_defaults();
	}else if(create_or_edit === "edit"){
		document.getElementById("share-name").value = share_name;
		func.innerText = "Edit";
		button.onclick = function(){
			edit_share(share_name, share_settings);
		}
		document.getElementById("share-name").disabled = true;
		populate_share_settings(share_settings);
	}
	modal.style.display = "block";
	window.onclick = function(event){
		if(event.target == modal){
			modal.style.display = "none";
		}
	}
}

function hide_share_dialog() {
	var modal = document.getElementById("share-modal");
	modal.style.display = "none";
}

function set_share_defaults() {
	document.getElementById("share-name").value = "";
	document.getElementById("share-path").value = "";
}

function add_share() {
	set_spinner("share-modal");
	var name = document.getElementById("share-name").value;
	var path = document.getElementById("share-path").value;
	var proc = cockpit.spawn(["net", "conf", "addshare", name, path], {err: "out", superuser: "require"});
	proc.done(function(data) {
		clear_info("share-modal");
		populate_share_list();
		hide_share_dialog();
		set_success("share", "Successfully added " + name + ".", 10000);
	});
	proc.fail(function(ex, data) {
		set_error("share-modal", data);
	});
}

function populate_share_settings(settings) {
	console.log(settings);
	var path = document.getElementById("path");
	path.value = settings["path"];
}

function edit_share(share_name, settings) {
	/* Params have DOM id the same as net conf setparm <param>
	 */
	set_spinner("share-modal");
	var params = document.getElementsByClassName("share-param");
	var changed_settings = {};
	for(let param of params){
		if(settings[param.id] !== param.value)
			changed_settings[param.id] = param.value;
		settings[param.id] = param.value;
	}
	var payload = {};
	payload["section"] = share_name;
	payload["parms"] = changed_settings;
	var proc = cockpit.spawn(["/usr/share/cockpit/samba-manager/set_parms.py"], {err: "out", superuser: "require"});
	proc.input(JSON.stringify(payload));
	proc.done(function(data) {
		clear_info("share-modal");
		set_success("share", "Successfully updated " + share_name + ".", 10000);
		hide_share_dialog();
	});
	proc.fail(function(ex, data) {
		set_error("share-modal", data);
	});
}

function show_rm_share_dialog(share_name, element_list) {
	var share_name_fields = document.getElementsByClassName("share-to-remove");
	for(let field of share_name_fields){
		field.innerText = share_name;
	}
	var modal = document.getElementById("rm-share-modal");
	modal.style.display = "block";
	window.onclick = function(event){
		if(event.target == modal){
			modal.style.display = "none";
		}
	}
	var continue_rm_share = document.getElementById("continue-rm-share");
	continue_rm_share.onclick = function() {
		rm_share(share_name, element_list);
	}
}

function hide_rm_share_dialog() {
	var modal = document.getElementById("rm-share-modal");
	modal.style.display = "none";
}

function rm_share(share_name, element_list) {
	set_spinner("share");
	var proc = cockpit.spawn(["net", "conf", "delshare", share_name], {err: "out", superuser: "require"});
	proc.done(function(data) {
		populate_share_list();
		set_success("share", "Successfully deleted " + share_name + ".", 10000);
		element_list.forEach(elem => elem.remove());
	});
	proc.fail(function(ex, data) {
		set_error("share", data, 10000);
	});
	hide_rm_share_dialog();
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
	
	document.getElementById("add-share-btn").addEventListener("click", function(){show_share_dialog("create")});
	document.getElementById("cancel-share").addEventListener("click", hide_share_dialog);
	document.getElementById("close-share").addEventListener("click", hide_share_dialog);
	
	document.getElementById("cancel-rm-share").addEventListener("click", hide_rm_share_dialog);
	document.getElementById("close-rm-share").addEventListener("click", hide_rm_share_dialog);
}

function main() {
	add_user_options();
	add_group_options();
	populate_share_list();
	set_up_buttons();
}

main();
