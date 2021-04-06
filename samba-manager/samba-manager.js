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

const timeout_ms = 3200; // info message timeout

var info_timeout = {}; // object to hold timeouts returned from setTimeout

var disallowed_groups = []
var valid_groups = []


/* clear_info
 * Receives: id string for info fields in DOM
 * Does: clears alert
 * Returns: element objects for info div, icon, and text
 */
function clear_info(id) {
	var info = document.getElementById(id + "-info");
	var info_icon = document.getElementById(id + "-info-icon");
	var info_message = document.getElementById(id + "-info-text");
	info.classList.remove(...all_alert_classes);
	info_icon.classList.remove(...all_icon_classes);
	info_message.innerText = "";
	return [info, info_icon, info_message];
}

/* set_spinner
 * Receives: id string for info fields in DOM
 * Does: calls clear_info, sets icon to loading spinner
 * Returns: nothing
 */
function set_spinner(id) {
	[info, info_icon, info_message] = clear_info(id);
	info_icon.classList.add(...spinner_classes);
}

/* set_error
 * Receives: id string for info fields in DOM, error message, optional timeout
 * time in milliseconds to clear message
 * Does: calls clear_info, sets icon and div to error classes, sets text to message,
 * clears old timeout, sets new timeout if passed.
 * Returns: nothing
 */
function set_error(id, message, timeout = -1) {
	[info, info_icon, info_message] = clear_info(id);
	info_icon.classList.add(...failure_icon_classes);
	info.classList.add(...failure_classes);
	info_message.innerText = message;
	if(typeof info_timeout[id] !== 'undefined' && info_timeout[id] !== null)
		clearTimeout(info_timeout[id]);
	if(timeout > 0){
		info_timeout[id] = setTimeout(function(){
			clear_info(id);
		}, timeout);
	}
}

/* set_success
 * Receives: id string for info fields in DOM, message, optional timeout time
 * in milliseconds to clear message
 * Does: calls clear_info, sets icon and div to success classes, sets text to message,
 * clears old timeout, sets new timeout if passed.
 * Returns: nothing
 */
function set_success(id, message, timeout = -1) {
	[info, info_icon, info_message] = clear_info(id);
	info_icon.classList.add(...success_icon_classes);
	info.classList.add(...success_classes);
	info_message.innerText = message;
	if(typeof info_timeout[id] !== 'undefined' && info_timeout[id] !== null)
		clearTimeout(info_timeout[id]);
	if(timeout > 0){
		info_timeout[id] = setTimeout(function(){
			clear_info(id);
		}, timeout);
	}
}

/* set_current_user
 * Receives: DOM element object for selector list
 * Does: Calls `whoami`, uses return value to set default list selection to
 * current logged in user
 * Returns: nothing
 */
function set_current_user(selector) {
	var proc = cockpit.spawn(["whoami"]);
	proc.done(function(data){
		data = data.trim();
		selector.value = data;
		update_username_fields();
	});
}

/* add_user_options
 * Receives: nothing
 * Does: parses /etc/passwd to get a list of users, filtering out system users
 * with $SHELL == nologin, then populates user-selection select dropdown with
 * one option per user
 * Returns: nothing
 */
function add_user_options() {
	set_spinner("user-select");
	var selects = document.getElementsByClassName("user-selection");
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
			for(let select of selects)
				select.add(option.cloneNode(true));
			option.remove();
		});
		set_current_user(document.getElementById("user-selection"));
		clear_info("user-select");
	});
	proc.fail(function(ex, data) {
		set_error("user-select", "Failed to get list of users: " + data);
	});
}

/* update_username_fields
 * Receives: nothing
 * Does: replaces innerText of each element in username-45d class
 * with the value of the user-selection dropdown, then calls
 * set_curr_user_group_list
 * Returns: nothing
 */
function update_username_fields() {
	var user = document.getElementById("user-selection").value;
	var fields = document.getElementsByClassName("username-45d");
	for(let field of fields){
		field.innerText = user;
	}
	set_curr_user_group_list();
}

/* add_group_options
 * Receives: nothing
 * Does: clears group management list and group select lists, then
 * parses /etc/group to repopulate these lists
 * Returns: nothing
 */
function add_group_options() {
	set_spinner("add-group");
	var selects = document.getElementsByClassName("group-selection");
	var groups_list = document.getElementById("groups-list");
	
	for(let select of selects){
		var placeholder = null;
		while (select.firstChild) {
			if(select.firstChild.classList && select.firstChild.classList.contains("placeholder"))
				placeholder = select.firstChild.cloneNode(true);
			select.removeChild(select.firstChild);
		}
		if(placeholder)
			select.appendChild(placeholder);
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
				for(let select of selects)
					select.add(option.cloneNode(true));
				valid_groups.push(group);
				option.remove();
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

/* update_group_fields
 * Receives: nothing
 * Does: Replaces innerText of each element in class samba-group-45d with
 * the currently selected group
 * Returns: nothing
 */
function update_group_fields() {
	var group = document.getElementById("samba-group-selection").value;
	var fields = document.getElementsByClassName("samba-group-45d");
	for(let field of fields){
		field.innerText = group;
	}
}

/* set_curr_user_group_list
 * Receives: nothing
 * Does: calls `groups <selected user>`, parsing output to populate list of groups
 * the selected user is currently in
 * Returns: nothing
 */
function set_curr_user_group_list() {
	set_spinner("user-select");
	var user = document.getElementById("user-selection").value;
	var proc = cockpit.spawn(["groups", user], {err: "out", superuser: "require"});
	proc.done(function(data) {
		var group_list = data.trim().split(" ");
		if(group_list.length >= 2 && group_list[0] === user && group_list[1] === ":")
			group_list = group_list.slice(2);
		group_list = group_list.filter(group => group.length > 0 && !disallowed_groups.includes(group));
		document.getElementById("user-group-list").innerText = group_list.sort().join(', ');
		clear_info("user-select");
	});
	proc.fail(function(ex, data) {
		document.getElementById("user-group-list").innerText = "Could not determine current groups.";
		clear_info("user-select");
	});
}

/* add_to_group
 * Receives: nothing
 * Does: adds selected user to selected group by calling `usermod -aG <group> <user>`
 * Returns: nothing
 */
function add_to_group() {
	set_spinner("add-group");
	var user = document.getElementById("user-selection").value;
	var group = document.getElementById("samba-group-selection").value;
	var proc = cockpit.spawn(["usermod", "-aG", group, user], {err: "out", superuser: "require"});
	proc.done(function(data){
		set_success("add-group", "Successfully added " + user + " to " + group + ".", timeout_ms);
		set_curr_user_group_list();
	});
	proc.fail(function(ex, data){
		set_error("add-group", data, timeout_ms);
	});
}

/* show_rm_from_group_dialog
 * Receives: nothing
 * Does: shows modal dialog to confirm before removing selected user from selected group
 * Returns: nothing 
 */
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

/* hide_rm_from_group_dialog
 * Receives: nothing
 * Does: hides modal dialog to confirm before removing selected user from selected group
 * Returns: nothing 
 */
function hide_rm_from_group_dialog() {
	var modal = document.getElementById("rm-from-group-modal");
	modal.style.display = "none";
}

/* rm_from_group
 * Receives: nothing
 * Does: removes selected user from selected group by calling `gpasswd -d <user> <group>`
 * Returns: nothing
 */
function rm_from_group() {
	set_spinner("add-group");
	var user = document.getElementById("user-selection").value;
	var group = document.getElementById("samba-group-selection").value;
	var proc = cockpit.script("gpasswd -d " + user + " " + group + " > /dev/null", {err: "out", superuser: "require"});
	proc.done(function(data){
		set_success("add-group", "Successfully removed " + user + " from " + group + ".", timeout_ms);
		set_curr_user_group_list();
	});
	proc.fail(function(ex, data){
		set_error("add-group", data, timeout_ms);
	});
	hide_rm_from_group_dialog();
}

/* show_smbpasswd_dialog
 * Receives: nothing
 * Does: shows modal dialog to set smbpasswd
 * Returns: nothing
 */
function show_smbpasswd_dialog() {
	var modal = document.getElementById("smbpasswd-modal");
	modal.style.display = "block";
	window.onclick = function(event){
		if(event.target == modal){
			modal.style.display = "none";
		}
	}
}

/* hide_smbpasswd_dialog
 * Receives: nothing
 * Does: hides modal dialog to set smbpasswd
 * Returns: nothing
 */
function hide_smbpasswd_dialog() {
	var modal = document.getElementById("smbpasswd-modal");
	modal.style.display = "none";
}

/* check_passwords
 * Receives: nothing
 * Does: verifies that the passwords entered into smbpasswd modal dialog are valid
 * Returns: [false, ""] if invalid, [true, "<password>"] if valid
 */
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

/* set_smbpasswd
 * Receives: nothing
 * Does: calls check_passwords, if valid, set smbpasswd by calling `smbpasswd -s -a <user>` and
 * supplying new password via stdin
 * Returns: nothing
 */
function set_smbpasswd() {
	set_spinner("smbpasswd-modal");
	var user = document.getElementById("user-selection").value;
	const [res, passwd] = check_passwords();
	if(res === true){
		var proc = cockpit.spawn(["smbpasswd", "-s", "-a", user], { err: "out", superuser: "required" });
		proc.input(passwd + "\n" + passwd + "\n");
		proc.done(function(){
			clear_info("smbpasswd-modal");
			set_success("smbpasswd", "Successfully set Samba password for " + user + ".", timeout_ms);
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

/* show_rm_smbpasswd_dialog
 * Receives: nothing
 * Does: shows modal dialog to confirm before removing smbpasswd from user
 * Returns: nothing
 */
function show_rm_smbpasswd_dialog() {
	var modal = document.getElementById("rm-smbpasswd-modal");
	modal.style.display = "block";
	window.onclick = function(event){
		if(event.target == modal){
			modal.style.display = "none";
		}
	}
}

/* hide_rm_smbpasswd_dialog
 * Receives: nothing
 * Does: hides modal dialog to confirm before removing smbpasswd from user
 * Returns: nothing
 */
function hide_rm_smbpasswd_dialog() {
	var modal = document.getElementById("rm-smbpasswd-modal");
	modal.style.display = "none";
}

/* rm_smbpasswd
 * Receives: nothing
 * Does: removes selected user's samba password with `smbpasswd -x <user>`
 * Returns: nothing
 */
function rm_smbpasswd() {
	set_spinner("smbpasswd")
	var user = document.getElementById("user-selection").value;
	
	var proc = cockpit.script("smbpasswd -x " + user, {err: "out", superuser: "require"});
	proc.done(function(data){
		set_success("smbpasswd", "Successfully removed Samba password for " + user + ".", timeout_ms);
	});
	proc.fail(function(ex, data){
		set_error("smbpasswd", data, timeout_ms);
	});
	hide_rm_smbpasswd_dialog();
}

/* create_list_entry
 * Receives: list entry name as string, callback function to remove entry
 * Does: creates new element for list entry, with a text div for name and x button
 * for removal
 * Returns: created entry
 */
function create_list_entry(entry_name, on_delete) {
	var entry = document.createElement("div");
	entry.classList.add("highlight-entry");
	
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

/* create_group_list_entry
 * Receives: name of group as string
 * Does: calls create_list_entry with group_name as the name and
 * show_rm_group_dialog as the callback, and adds classes to have the entry span
 * the entire width of the list
 * Returns: the list entry element
 */
function create_group_list_entry(group_name) {
	var entry = create_list_entry(group_name, show_rm_group_dialog);
	entry.classList.add("row-45d", "flex-45d-space-between", "flex-45d-center");
	return entry;
}

/* show_rm_group_dialog
 * Receives: nothing
 * Does: shows modal dialog to confirm before removing group from list and system
 * Returns: nothing
 */
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

/* hide_rm_from_group_dialog
 * Receives: nothing
 * Does: hides modal dialog to confirm removing group from list and system
 * Returns: nothing
 */
function hide_rm_group_dialog() {
	var modal = document.getElementById("rm-group-modal");
	modal.style.display = "none";
}

/* rm_group
 * Receives: name of group to remove, list of elements to delete from DOM
 * Does: calls `groupdel <group_name>` to remove group from system, and on success,
 * removes element from list
 * Returns: nothing
 */
function rm_group(group_name, element_list) {
	set_spinner("group");
	var proc = cockpit.spawn(["groupdel", group_name], {err: "out", superuser: "require"});
	proc.done(function(data) {
		set_success("group", "Successfully deleted " + group_name + ".", timeout_ms);
		element_list.forEach(elem => elem.remove());
		add_group_options();
		set_curr_user_group_list();
	});
	proc.fail(function(ex, data) {
		set_error("group", data, timeout_ms);
	});
	hide_rm_group_dialog();
}

/* show_add_group_dialog
 * Receives: nothing
 * Does: shows modal dialog to create a new group
 * Returns: nothing
 */
function show_add_group_dialog() {
	var modal = document.getElementById("add-group-modal");
	modal.style.display = "block";
	window.onclick = function(event){
		if(event.target == modal){
			modal.style.display = "none";
		}
	}
}

/* hide_add_group_dialog
 * Receives: nothing
 * Does: hides modal dialog to create a new group
 * Returns: nothing
 */
function hide_add_group_dialog() {
	var modal = document.getElementById("add-group-modal");
	modal.style.display = "none";
}

/* add_group
 * Receives: nothing
 * Does: creates group with name supplied in modal dialog by calling `groupadd <group_name>`
 * Returns: nothing
 */
function add_group() {
	var group_name = document.getElementById("new-group-name").value;
	if(check_group_name()){
		set_spinner("add-group-modal");
		var proc = cockpit.spawn(["groupadd", group_name], {err: "out", superuser: "require"});
		proc.done(function(data) {
			hide_add_group_dialog();
			add_group_options();
			clear_info("add-group-modal");
			set_success("group", "Successfully added " + group_name, timeout_ms);
		});
		proc.fail(function(ex, data) {
			set_error("add-group-modal", data);
		});
	}
}

/* check_group_name
 * Receives: nothing
 * Does: checks if supplied group name is valid, if invalid, continue button is disabled
 * Returns: true if valid, false if invalid
 * 
 * Validity check is based on libmisc/chkname.c from the source code of shadow (https://github.com/shadow-maint/shadow)
 */
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

/* parse_shares
 * Receives: output of `net conf list` as array of strings, split at newlines
 * Does: parses each line of `net conf list` to get global settings in the global_samba_conf object,
 * and each of the share's settings in its own object in the shares object
 * Returns: [shares object, global_samba_conf object]
 */
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
		var option_match = line.match(/^([^=]+)=(.*)$/)
		if(option_match){
			key = option_match[1].toLowerCase().trim().replace(/\s+/g, "-");
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

/* create_share_list_entry
 * Receives: name of share as a string, callback function to delete share on click
 * Does: calls create_list_entry with share_name and on_delete, and appends classes
 * to make entry span width of list
 * Returns: entry element
 */
function create_share_list_entry(share_name, on_delete) {
	var entry = create_list_entry(share_name, on_delete);
	entry.classList.add("row-45d", "flex-45d-space-between", "flex-45d-center");
	return entry;
}

/* populate_share_list
 * Receives: nothing
 * Does: clears list of shares, repopulates list based on returned object from parse_shares
 * Returns: nothing
 */
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

/* show_share_dialog
 * Receives: string containing "create" or "edit", name of share being modified,
 * object containing share settings
 * Does: shows share modal dialog and sets up buttons in modal dialog
 * Returns: nothing
 */
function show_share_dialog(create_or_edit, share_name = "", share_settings = {}) {
	var modal = document.getElementById("share-modal");
	var func = document.getElementById("share-modal-function");
	var button = document.getElementById("continue-share");
	var text_area = document.getElementById("advanced-global-settings-input");
	text_area.style.height = "";
	text_area.style.height = Math.max(text_area.scrollHeight + 5, 50) + "px";
	if(create_or_edit === "create"){
		func.innerText = "Add New";
		button.onclick = function(){
			add_share();
		}
		button.innerText = "Add Share";
		document.getElementById("share-name").disabled = false;
		set_share_defaults();
	}else if(create_or_edit === "edit"){
		document.getElementById("share-name").value = share_name;
		func.innerText = "Edit";
		button.onclick = function(){
			edit_share(share_name, share_settings, "updated");
		}
		button.innerText = "Apply";
		document.getElementById("share-name").disabled = true;
		populate_share_settings(share_settings);
	}
	var add_user_select = document.getElementById("add-user-to-share");
	for(let user of add_user_select.childNodes){
		user.onclick = function() {
			add_user_to_share(user.value);
		}
	}
	var add_group_select = document.getElementById("add-group-to-share");
	for(let group of add_group_select.childNodes){
		group.onclick = function() {
			add_group_to_share(group.value);
		}
	}
	modal.style.display = "block";
	window.onclick = function(event){
		if(event.target == modal){
			modal.style.display = "none";
		}
	}
}

/* hide_share_dialog
 * Receives: nothing
 * Does: hides share modal dialog
 * Returns: nothing
 */
function hide_share_dialog() {
	var modal = document.getElementById("share-modal");
	modal.style.display = "none";
}

/* set_share_defaults
 * Receives: nothing
 * Does: fills in all fields in share dialog with default values for adding new share
 * Returns: nothing
 */
function set_share_defaults() {
	document.getElementById("share-name").value = "";
	document.getElementById("share-name-feedback").innerText = "";
	document.getElementById("comment").value = "";
	document.getElementById("path").value = "";
	document.getElementById("share-path-feedback").innerText = "";
	share_valid_groups.clear();
	share_valid_users.clear();
	update_users_in_share();
	update_groups_in_share();
	document.getElementById("guest-ok").checked = false;
	document.getElementById("read-only").checked = true;
	document.getElementById("browseable").checked = true;
	document.getElementById("advanced-share-settings-input").value = "";
	document.getElementById("continue-share").disabled = false;
}

/* add_share
 * Receives: nothing
 * Does: checks share settings with verify_share_settings(), if valid, calls
 * `net conf addshare <share name> <share path>`
 * Returns: nothing
 */
function add_share() {
	if(!verify_share_settings())
		return;
	set_spinner("share-modal");
	var name = document.getElementById("share-name").value;
	var path = document.getElementById("path").value;
	var proc = cockpit.spawn(["net", "conf", "addshare", name, path], {err: "out", superuser: "require"});
	proc.done(function(data) {
		edit_share(name, {}, "created");
	});
	proc.fail(function(ex, data) {
		set_error("share-modal", data);
	});
}

// object to store settings before changes to figure out which options were removed
var advanced_share_settings_before_change = {};

/* populate_share_settings
 * Receives: settings object returned from parse_shares
 * Does: populates share setting fields with current settings, placing extra parameters in
 * the advanced settings textarea
 * Returns: nothing
 */
function populate_share_settings(settings) {
	var params = document.getElementsByClassName("share-param");
	var advanced_settings = {...settings};
	share_valid_groups.clear();
	share_valid_users.clear();
	update_users_in_share();
	update_groups_in_share();
	for(let param of params){
		delete advanced_settings[param.id];
		var value = settings[param.id];
		if(value === "yes")
			param.checked = true;
		else if(value === "no")
			param.checked = false;
		else
			param.value = value;
	}
	advanced_share_settings_before_change = {...advanced_settings};
	var advanced_settings_list = []
	for(let key of Object.keys(advanced_settings)){
		advanced_settings_list.push(key.replace(/-/, " ") + " = " + advanced_settings[key]);
	}
	document.getElementById("advanced-share-settings-input").value = advanced_settings_list.join("\n");
	if(settings["valid-users"]){
		var users_and_groups = settings["valid-users"].split(", ");
		for (let user_or_group of users_and_groups){
			if(user_or_group[0] === '@'){
				add_group_to_share(user_or_group.slice(1));
			}else{
				add_user_to_share(user_or_group);
			}
		}
	}
	verify_share_settings();
}

// Sets to hold users and groups in currently edited share
var share_valid_users = new Set();
var share_valid_groups = new Set();

/* add_user_to_share
 * Receives: user name as string
 * Does: adds user string to global user Set, updates displayed list of users in share
 * Returns: nothing
 */
function add_user_to_share(user) {
	share_valid_users.add(user);
	update_users_in_share();
}

/* remove_user_from_share
 * Receives: user name as string
 * Does: deletes user string from global user Set, updates displayed list of users in share
 * Returns: nothing
 */
function remove_user_from_share(user) {
	share_valid_users.delete(user);
	update_users_in_share();
}

/* create_valid_user_list_entry
 * Receives: user name string, callback function to remove user from share
 * Does: creates list entry and appends class for valid user/group list CSS styling
 * Returns: entry element
 */
function create_valid_user_list_entry(user, on_delete) {
	var entry = create_list_entry(user, on_delete);
	entry.classList.add("valid-user-list-entry");
	return entry;
}

/* update_users_in_share
 * Receives: nothing
 * Does: clears users in share list, repopulates based on contents of global valid user Set,
 * calls update_in_share to reconstruct the span text to be used as "valid users" parameter value
 * Returns: nothing
 */
function update_users_in_share() {
	var in_share = document.getElementById("selected-users");
	var select = document.getElementById("add-user-to-share");
	select.childNodes[1].selected = true;
	while (in_share.firstChild) {
		in_share.removeChild(in_share.firstChild);
	}
	for(let user of share_valid_users) {
		var entry = create_valid_user_list_entry(user, function() {
			remove_user_from_share(user);
		});
		in_share.appendChild(entry);
	}
	update_in_share();
}

/* add_group_to_share
 * Receives: group name as string
 * Does: adds group string to global group Set, updates displayed list of groups in share
 * Returns: nothing
 */
function add_group_to_share(group) {
	share_valid_groups.add(group);
	update_groups_in_share();
}

/* remove_group_from_share
 * Receives: group name as string
 * Does: deletes group string from global user Set, updates displayed list of groups in share
 * Returns: nothing
 */
function remove_group_from_share(group) {
	share_valid_groups.delete(group);
	update_groups_in_share();
}

/* update_groups_in_share
 * Receives: nothing
 * Does: clears groups in group list, repopulates based on contents of global valid group Set,
 * calls update_in_share to reconstruct the span text to be used as "valid users" parameter value
 * Returns: nothing
 */
function update_groups_in_share() {
	var in_share = document.getElementById("selected-groups");
	var select = document.getElementById("add-group-to-share");
	select.childNodes[0].selected = true;
	while (in_share.firstChild) {
		in_share.removeChild(in_share.firstChild);
	}
	for(let group of share_valid_groups) {
		var entry = create_valid_user_list_entry(group, function() {
			remove_group_from_share(group);
		});
		in_share.appendChild(entry);
	}
	update_in_share();
}

/* update_in_share
 * Receives: nothing
 * Does: sets value of valid-users DOM element to string of valid users and groups from the global Sets
 * Returns: nothing
 */
function update_in_share() {
	var valid_users = document.getElementById("valid-users");
	var group_names = [...share_valid_groups];
	for(let i = 0; i < group_names.length; i++){
		group_names[i] = "@" + group_names[i];
	}
	valid_users.value = valid_users.innerText = [...share_valid_users, ...group_names].sort().join(", ");
}

/* get_extra_params
 * Receives: string containing "share" or "global"
 * Does: parses either the share or global advanced settings textarea based on share_or_global and object of
 * param key to param value
 * Returns: object of advanced parameters
 */
function get_extra_params(share_or_global) {
	var params = {};
	var advanced_settings_arr = document.getElementById("advanced-" + share_or_global + "-settings-input").value.split("\n");
	for(let param of advanced_settings_arr) {
		if(param.trim() === "")
			continue;
		var split = param.split("=");
		var key = split[0].trim().replace(/\s+/g, "-");
		var val = split[1].trim();
		params[key] = val;
	}
	return params;
}

/* verify_share_settings
 * Receives: nothing
 * Does: checks share name and path, if both are valid, continue button is undisabled
 * Returns: true if name and path are valid, false otherwise
 */
function verify_share_settings() {
	var name_res = verify_share_name();
	var path_res = verify_share_path();
	if(name_res && path_res){
		document.getElementById("continue-share").disabled = false;
		return true;
	}
	return false;
}

/* verify_share_name
 * Receives: nothing
 * Does: verifies share name, disabling continue button if invalid, and reporting disallowed
 * characters to user
 * Returns: true if valid, false otherwise
 */
function verify_share_name() {
	var share_name = document.getElementById("share-name").value;
	var feedback = document.getElementById("share-name-feedback");
	var button = document.getElementById("continue-share");
	feedback.innerText = "";
	var disallowed_names = ["ADMIN$", "IPC$", "c$"];
	if(share_name === ""){
		button.disabled = true;
		feedback.innerText = "Share name is empty.";
		return false;
	}
	if(share_name in disallowed_names){
		button.disabled = true;
		feedback.innerText = share_name + " is a reserved name.";
		return false;
	}
	if(!share_name.match(/^[^\s+\[\]"/\:;|<>,?*=][^+\[\]"/\:;|<>,?*=]*$/)){
		button.disabled = true;
		var invalid_chars = [];
		if(share_name[0].match(/[\s+\[\]"/\:;|<>,?*=]/))
			invalid_chars.push("'"+share_name[0]+"'");
		for(char of share_name.slice(1))
			if(char.match(/[+\[\]"/\:;|<>,?*=]/))
				invalid_chars.push("'"+char+"'");
		feedback.innerText = "Share name contains invalid characters: " + invalid_chars.join(", ");
		return false;
	}
	return true;
}

/* verify_share_path
 * Receives: nothing
 * Does: verifies that the share path is not empty and is absolute, disabling continue
 * button if invalid
 * Returns: true if valid, false otherwise
 */
function verify_share_path() {
	var path = document.getElementById("path").value;
	var feedback = document.getElementById("share-path-feedback");
	var button = document.getElementById("continue-share");
	feedback.innerText = "";
	if(path === ""){
		button.disabled = true;
		feedback.innerText = "Path is empty.";
		return false;
	}
	if(path[0] !== '/'){
		button.disabled = true;
		feedback.innerText = "Path must be absolute.";
		return false;
	}
	return true;
}

/* edit_share
 * Receives: name of share as string, object containing old share settings, string
 * containing "created" or "updated"
 * Does: checks settings with verify_share_settings, if valid, updates settings object with new settings,
 * stores newly changed settings in separate object, appends extra parameters from advanced config, and
 * calls edit_parms to apply changed settings
 * Returns: nothing
 */
function edit_share(share_name, settings, action) {
	/* Params have DOM id the same as net conf setparm <param>
	 */
	if(!verify_share_settings())
		return;
	set_spinner("share-modal");
	var params = document.getElementsByClassName("share-param");
	var changed_settings = {};
	for(let param of params){
		var value = "";
		if(param.type === "checkbox")
			if(param.checked)
				value = "yes";
			else
				value = "no";
		else
			value = param.value;
		if(settings[param.id] !== value)
			changed_settings[param.id] = value;
		settings[param.id] = value;
	}
	var extra_params = get_extra_params("share");
	for(let key of Object.keys(extra_params)){
		changed_settings[key] = extra_params[key];
	}
	var params_to_delete = new Set(Object.keys(advanced_share_settings_before_change));
	for(let param of params_to_delete){
		if(param in extra_params)
			params_to_delete.delete(param);
	}
	edit_parms(share_name, changed_settings, params_to_delete, action, hide_share_dialog, "share-modal");
}

/* edit_parms
 * Receives: name of share to edit, changed parameters, removed advanced paramters, string with "created" or "updated",
 * callback function to hide modal dialog, id string for info message
 * Does: constructs payload object containing parameters to delete to pass to del_parms.py as JSON, and on success,
 * calls set_parms with paramters to add/change
 * Returns: nothing
 */
function edit_parms(share_name, params_to_set, params_to_delete, action, hide_modal_func, info_id) {
	// delete parms first
	var payload = {};
	payload["section"] = share_name;
	payload["parms"] = [...params_to_delete];
	var proc = cockpit.spawn(["/usr/share/cockpit/samba-manager/del_parms.py"], {err: "out", superuser: "require"});
	proc.input(JSON.stringify(payload));
	proc.done(function(data) {
		clear_info(info_id);
		set_success("share", "Successfully " + action + " " + share_name + ".", timeout_ms);
		set_parms(share_name, params_to_set, action, hide_modal_func, info_id);
	});
	proc.fail(function(ex, data) {
		set_error(info_id, data);
	});
}

/* set_parms
 * Receives: name of share to edit, new/changed parameters, string with "created" or "updated",
 * callback function to hide modal dialog, id string for info message
 * Does: constructs payload object containing parameters to add/change to pass to set_parms.py as JSON
 * Returns: nothing
 */
function set_parms(share_name, params, action, hide_modal_func, info_id) {
	var payload = {};
	payload["section"] = share_name;
	payload["parms"] = params;
	var proc = cockpit.spawn(["/usr/share/cockpit/samba-manager/set_parms.py"], {err: "out", superuser: "require"});
	proc.input(JSON.stringify(payload));
	proc.done(function(data) {
		clear_info(info_id);
		set_success("share", "Successfully " + action + " " + share_name + ".", timeout_ms);
		populate_share_list();
		hide_modal_func();
	});
	proc.fail(function(ex, data) {
		set_error(info_id, data);
	});
}

/* toggle_advanced_share_settings
 * Receives: nothing
 * Does: shows/hides dropdown drawer containing textarea for advanced share settings,
 * spins dropdown triangle icon
 * Returns: nothing
 */
function toggle_advanced_share_settings() {
	var drawer = document.getElementById("advanced-share-settings-drawer");
	var arrow = document.getElementById("advanced-share-settings-arrow");
	drawer.hidden = !drawer.hidden;
	if(arrow.style.transform !== "rotate(180deg)")
		arrow.style.transform = "rotate(180deg)";
	else
		arrow.style.transform = "";
}

/* show_rm_share_dialog
 * Receives: name of share as string, list of elements to delete
 * Does: shows modal dialog to confirm removal of share, populates name fields with
 * passed share name, sets continue button's onclick to be rm_share with share name and
 * element list as arguments
 * Returns: nothing
 */
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

/* hide_rm_share_dialog
 * Receives: nothing
 * Does: hides modal dialog to confirm removal of share
 * Returns: nothing
 */
function hide_rm_share_dialog() {
	var modal = document.getElementById("rm-share-modal");
	modal.style.display = "none";
}

/* rm_share
 * Receives: name of share to remove as string, list of elements to delete to remove list entry
 * Does: calls `net conf delshare <share_name>` to delete share, and on success, share list element is removed
 * and dialog is hidden
 * Returns: nothing
 */
function rm_share(share_name, element_list) {
	set_spinner("share");
	var proc = cockpit.spawn(["net", "conf", "delshare", share_name], {err: "out", superuser: "require"});
	proc.done(function(data) {
		populate_share_list();
		set_success("share", "Successfully deleted " + share_name + ".", timeout_ms);
		element_list.forEach(elem => elem.remove());
	});
	proc.fail(function(ex, data) {
		set_error("share", data, timeout_ms);
	});
	hide_rm_share_dialog();
}

/* show_samba_global_dialog
 * Receives: nothing
 * Does: calls populate_samba_global to populate global setting fields and shows global settings modal dialog
 * Returns: nothing
 */
function show_samba_global_dialog() {
	populate_samba_global();
	var modal = document.getElementById("samba-global-modal");
	var text_area = document.getElementById("advanced-global-settings-input");
	text_area.style.height = "";
	text_area.style.height = Math.max(text_area.scrollHeight + 5, 50) + "px";
	modal.style.display = "block";
	window.onclick = function(event){
		if(event.target == modal){
			modal.style.display = "none";
		}
	}
}

/* hide_samba_modal_dialog
 * Receives: nothing
 * Does: hides samba global settings modal dialog
 * Returns: nothing
 */
function hide_samba_modal_dialog() {
	var modal = document.getElementById("samba-global-modal");
	modal.style.display = "none";
}

/* toggle_advanced_global_settings
 * Receives: nothing
 * Does: shows/hides dropdown drawer containing textarea for advanced global settings,
 * spins dropdown triangle icon
 * Returns: nothing
 */
function toggle_advanced_global_settings() {
	var drawer = document.getElementById("advanced-global-settings-drawer");
	var arrow = document.getElementById("advanced-global-settings-arrow");
	drawer.hidden = !drawer.hidden;
	if(arrow.style.transform !== "rotate(180deg)")
		arrow.style.transform = "rotate(180deg)";
	else
		arrow.style.transform = "";
}

// objects to store settings before changes to figure out which options were removed
var global_settings_before_change = {};
var advanced_global_settings_before_change = {};

/* populate_samba_global
 * Receives: nothing
 * Does: calls `net conf list` and uses returned global settings object to populate parameter fields
 * and advanced settings textarea in global settings dialog
 * Returns: nothing
 */
function populate_samba_global() {
	var proc = cockpit.spawn(["net", "conf", "list"], {err: "out", superuser: "require"});
	proc.done(function(data) {
		const [shares, glob] = parse_shares(data.split("\n"));
		var advanced_settings = {...glob};
		global_settings_before_change = {};
		var global_params = document.getElementsByClassName("global-param");
		for(let param of global_params){
			if(param.id in glob){
				var value = glob[param.id];
				if(param.id === "log-level"){
					var val = Number(value);
					if(isNaN(val)){
						param.disabled = true;
						param.value = "1";
					}else{
						param.disabled = false;
						delete advanced_settings[param.id];
						param.value = val;
						global_settings_before_change[param.id] = value;
					}
				}else{
					delete advanced_settings[param.id];
					if(value === "yes")
						param.checked = true;
					else if(value === "no")
						param.checked = false;
					else
						param.value = value;
					global_settings_before_change[param.id] = value;
				}
			}
		}
		advanced_global_settings_before_change = {...advanced_settings};
		var advanced_settings_list = []
		for(let key of Object.keys(advanced_settings)){
			advanced_settings_list.push(key.replace(/-/, " ") + " = " + advanced_settings[key]);
		}
		document.getElementById("advanced-global-settings-input").value = advanced_settings_list.join("\n");
	});
	proc.fail(function(ex, data) {
		set_error("share", data);
	});
}

/* check_enable_log_level_dropdown
 * Receives: nothing
 * Does: enables or disables log level dropdown selector based on if log level is overridden in advanced global settings
 * 
 */
function check_enable_log_level_dropdown() {
	var advanced_input_text = document.getElementById("advanced-global-settings-input").value;
	var log_level_select = document.getElementById("log-level");
	log_level_select.disabled = /log\s*level\s*=/.test(advanced_input_text);
}

/* edit_samba_global
 * Receives: nothing
 * Does: iterates through list of elements in class global-param, storing elem.value in object with elem.id as key, appends
 * extra params from advanced settings textarea, and passes objects of settings to edit_parms with section name as "global"
 * to apply changes
 * Returns: nothing
 */
function edit_samba_global() {
	set_spinner("samba-global-modal");
	var params = document.getElementsByClassName("global-param");
	var changed_settings = {};
	for(let param of params){
		var value = "";
		if(param.type === "checkbox")
			if(param.checked)
				value = "yes";
			else
				value = "no";
		else
			value = param.value;
		if(global_settings_before_change[param.id] !== value)
			changed_settings[param.id] = value;
		global_settings_before_change[param.id] = value;
	}
	var extra_params = get_extra_params("global");
	for(let key of Object.keys(extra_params)){
		changed_settings[key] = extra_params[key];
	}
	var params_to_delete = new Set(Object.keys(advanced_global_settings_before_change));
	for(let param of params_to_delete){
		if(param in extra_params)
			params_to_delete.delete(param);
	}
	edit_parms("global", changed_settings, params_to_delete, "updated", hide_samba_modal_dialog, "samba-global-modal");
}

/* set_up_buttons
 * Receives: nothing
 * Does: sets up event listener callbacks for button presses and field input
 * Returns: nothing
 */
function set_up_buttons() {
	// User Management
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
	
	// Group Management
	document.getElementById("cancel-rm-group").addEventListener("click", hide_rm_group_dialog);
	document.getElementById("close-rm-group").addEventListener("click", hide_rm_group_dialog);
	
	document.getElementById("add-group-btn").addEventListener("click", show_add_group_dialog);
	document.getElementById("cancel-add-group").addEventListener("click", hide_add_group_dialog);
	document.getElementById("close-add-group").addEventListener("click", hide_add_group_dialog);
	document.getElementById("continue-add-group").addEventListener("click", add_group);
	document.getElementById("new-group-name").addEventListener("input", check_group_name);
	
	// Share Management
	document.getElementById("add-share-btn").addEventListener("click", function(){show_share_dialog("create")});
	document.getElementById("cancel-share").addEventListener("click", hide_share_dialog);
	document.getElementById("close-share").addEventListener("click", hide_share_dialog);
	document.getElementById("show-advanced-share-dropdown-btn").addEventListener("click", toggle_advanced_share_settings);
	document.getElementById("share-name").addEventListener("input", verify_share_settings);
	document.getElementById("path").addEventListener("input", verify_share_settings);
	
	document.getElementById("cancel-rm-share").addEventListener("click", hide_rm_share_dialog);
	document.getElementById("close-rm-share").addEventListener("click", hide_rm_share_dialog);
	
	document.getElementById("samba-global-btn").addEventListener("click", show_samba_global_dialog);
	document.getElementById("cancel-samba-global").addEventListener("click", hide_samba_modal_dialog);
	document.getElementById("close-samba-global").addEventListener("click", hide_samba_modal_dialog);
	document.getElementById("show-advanced-global-dropdown-btn").addEventListener("click", toggle_advanced_global_settings);
	document.getElementById("continue-samba-global").addEventListener("click", edit_samba_global);
	document.getElementById("advanced-global-settings-input").addEventListener("input", check_enable_log_level_dropdown);
	
	// Set callback to dynamically resize textareas to fit height of text
	var text_areas = document.getElementsByTagName("textarea");
	for(let text_area of text_areas){
		text_area.oninput = function() {
			this.style.height = "";
			this.style.height = Math.max(this.scrollHeight + 5, 50) + "px";
		}
	}
}

/* check_permissions
 * Receives: nothing
 * Does: tries running `net conf list` as superuser, if successful, calls setup(), if unsuccessful,
 * shows error message and disables buttons
 * Returns: nothing
 */
function check_permissions() {
	var proc = cockpit.spawn(["net", "conf", "list"], {superuser: "require"});
	proc.then(function(data) {
		setup();
	});
	proc.catch(function(ex, data) {
		set_error("main", "User account lacks permission to configure Samba!");
		var all_buttons = document.getElementsByTagName("button");
		for(let button of all_buttons){
			button.disabled = true;
		}
	});
}

/* setup
 * Receives: nothing
 * Does: calls initialization functions to set up plugin
 * Returns: nothing
 */
function setup() {
	add_user_options();
	add_group_options();
	populate_share_list();
	set_up_buttons();
}

/* main
 * Entrypoint of script
 * Does: checks for permission to become root, which then calls setup on success
 * Returns: nothing
 */
function main() {
	check_permissions();
}

main();
