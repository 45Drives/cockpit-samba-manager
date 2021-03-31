default:
	

all: default

install:
	mkdir -p $(DESTDIR)/usr/share/cockpit/
	cp -rf samba-manager $(DESTDIR)/usr/share/cockpit

uninstall:
	rm -rf $(DESTDIR)/usr/share/cockpit/samba-manager

install-local:
	mkdir -p $(HOME)/.local/share/cockpit
	cp -rf samba-manager $(HOME)/.local/share/cockpit
	sed -i "s#/usr/share/cockpit/samba-manager/set_parms.py#$(HOME)/.local/share/cockpit/samba-manager/set_parms.py#" $(HOME)/.local/share/cockpit/samba-manager/samba-manager.js
	sed -i "s#/usr/share/cockpit/samba-manager/del_parms.py#$(HOME)/.local/share/cockpit/samba-manager/del_parms.py#" $(HOME)/.local/share/cockpit/samba-manager/samba-manager.js

make uninstall-local:
	rm -rf $(HOME)/.local/share/cockpit/samba-manager
