# Cockpit Samba Manager
A Cockpit plugin to make managing SMB shares easy.

## Installation
### Ubuntu
* `$ wget https://github.com/45Drives/cockpit-samba-manager/releases/download/v1.0/cockpit-samba-manager_1.0.0-1focal_all.deb`
* `# dpkg -i cockpit-samba-manager_1.0.0-1focal_all.deb`
### RHEL7
* `# yum install https://github.com/45Drives/cockpit-samba-manager/releases/download/v1.0/cockpit-samba-manager-1.0.0-1.el7.noarch.rpm`
### From Source
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
