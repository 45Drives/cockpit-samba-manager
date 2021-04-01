# Cockpit Samba Manager
A Cockpit plugin to make managing SMB shares easy.

## Installation
### Ubuntu
1. `$ wget https://github.com/45Drives/cockpit-samba-manager/releases/download/v1.0/cockpit-samba-manager_1.0.0-1focal_all.deb`
1. `# dpkg -i cockpit-samba-manager_1.0.0-1focal_all.deb`
1. [Edit Samba configuration](#samba-configuration)
### RHEL7
1. `# yum install https://github.com/45Drives/cockpit-samba-manager/releases/download/v1.0/cockpit-samba-manager-1.0.0-1.el7.noarch.rpm`
1. [Edit Samba configuration](#samba-configuration)
### From Source
1. `$ git clone https://github.com/45Drives/cockpit-samba-manager.git`
1. `$ cd cockpit-samba-manager`
1. `# make install`
1. [Edit Samba configuration](#samba-configuration)

## Samba Configuration
/etc/samba/smb.conf:
```ini
[global]
include = registry
```
