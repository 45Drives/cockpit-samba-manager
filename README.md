# Cockpit Samba Manager
A Cockpit plugin to manage Samba shares and users.

## Installation
* `$ git clone https://github.com/45Drives/cockpit-samba-manager.git`
* `$ cd cockpit-samba-manager`
* `# make install`
* Edit Samba configuration

## Samba Configuration
/etc/smb.conf:
```ini
[global]
include = registry
```
