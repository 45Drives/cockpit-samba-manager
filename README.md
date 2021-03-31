# Cockpit Samba Manager
A Cockpit plugin to make managing SMB shares easy.

## Installation
* `$ git clone https://github.com/45Drives/cockpit-samba-manager.git`
* `$ cd cockpit-samba-manager`
* `# make install`
* [Edit Samba configuration](#samba-configuration)

## Samba Configuration
/etc/samba/smb.conf:
```ini
[global]
include = registry
```
