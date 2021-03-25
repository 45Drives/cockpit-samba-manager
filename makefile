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

make uninstall-local:
	rm -rf $(HOME)/.local/share/cockpit/samba-manager
